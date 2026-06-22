const express = require('express');
const cors = require('cors');
const pool = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { gerarPDFReciboBuffer } = require('./pdfRecibo');
require('dotenv').config();

const app = express();
const porta = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET || 'chave_super_secreta_saudeaura'; // In prod, rely on env

app.use(cors()); 
app.use(express.json()); 

app.get('/', (req, res) => res.send('🚀 API de Atendimento Ativa e Protegida!'));

// Proxy do QR code do agente WhatsApp
app.get('/qr', async (req, res) => {
    try {
        const r = await require('axios').get('http://localhost:3001/qr', { timeout: 5000 });
        res.send(r.data);
    } catch {
        res.send('<html><body style="font-family:sans-serif;text-align:center;padding:50px"><h2>QR não disponível</h2><p>Aguarde o agente iniciar.</p></body></html>');
    }
});

// Middleware de Autenticação JWT
const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato: Bearer <token>
    
    if (!token) return res.status(401).json({ erro: 'Acesso negado. Token não fornecido.' });
    
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ erro: 'Token inválido ou expirado.' });
        req.user = user;
        next();
    });
};

// Autenticação (Login Aberto)
app.post('/login', async (req, res) => {
    const { usuario, senha } = req.body;
    try {
        const r = await pool.query('SELECT id, nome, senha, perfil, evento_id FROM usuarios WHERE usuario = $1', [usuario]);
        if (r.rows.length === 0) return res.status(401).json({ erro: 'Utilizador não encontrado' });
        
        const user = r.rows[0];
        
        // Proteção retro-compatível: se a senha não estiver cryptada (antigas de texte limp) assume-se como limpa
        let senhaCorreta = false;
        if (!user.senha.startsWith('$')) {
            senhaCorreta = (senha === user.senha);
        } else {
            senhaCorreta = await bcrypt.compare(senha, user.senha);
        }
        
        if (senhaCorreta) {
            // Gerar Token
            const token = jwt.sign({ id: user.id, perfil: user.perfil, nome: user.nome, evento_id: user.evento_id }, SECRET_KEY, { expiresIn: '12h' });
            res.json({ sucesso: true, token, perfil: user.perfil, nome: user.nome, evento_id: user.evento_id });
        } else {
            res.status(401).json({ erro: 'Senha incorreta' });
        }
    } catch (e) {
        res.status(500).json({ erro: 'Erro interno no login' });
    }
});

// === REPARAÇÃO E MIGRAÇÃO DE BANCO ===
app.get('/migrar-senhas', async (req, res) => {
    // Rota utilitária temporária para criptografar as senhas antigas em texto limpo
    try {
        const r = await pool.query('SELECT id, senha FROM usuarios');
        let atualizados = 0;
        for (let user of r.rows) {
            if (!user.senha.startsWith('$')) {
                const salt = await bcrypt.genSalt(10);
                const hash = await bcrypt.hash(user.senha, salt);
                await pool.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [hash, user.id]);
                atualizados++;
            }
        }
        res.send(`✅ Migração concluída: ${atualizados} utilizadores atualizados para senhas protegidas com bcrypt.`);
    } catch (e) { res.status(500).send('Erro: ' + e.message); }
});

app.get('/reparar-banco', async (req, res) => {
    try {
        await pool.query(`ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS rua TEXT`);
        await pool.query(`ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS numero VARCHAR(20)`);
        await pool.query(`ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS complemento VARCHAR(100)`);
        await pool.query(`ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS cidade VARCHAR(100)`);
        await pool.query(`ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS estado VARCHAR(2)`);
        res.send('✅ Banco de dados atualizado!');
    } catch (e) { res.status(500).send('Erro: ' + e.message); }
});

// Auto-migrate database sizes for BCrypt
pool.query('ALTER TABLE usuarios ALTER COLUMN senha TYPE VARCHAR(255)').catch(() => {});
pool.query('ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS entregue BOOLEAN DEFAULT false').catch(() => {});
pool.query('ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS preferencial BOOLEAN DEFAULT false').catch(() => {});

// Auto-migrate: usuário vinculado a um evento (null = vê todos / admin)
pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS evento_id INTEGER').catch(() => {});
// Auto-migrate: eventos de 1 a 5 dias (qtd_dias + colunas dia 3..5; dias antigos = 2)
pool.query('ALTER TABLE eventos ADD COLUMN IF NOT EXISTS qtd_dias INTEGER DEFAULT 2').catch(() => {});
pool.query('ALTER TABLE eventos ADD COLUMN IF NOT EXISTS data_dia3 DATE').catch(() => {});
pool.query('ALTER TABLE eventos ADD COLUMN IF NOT EXISTS vagas_dia3 INTEGER').catch(() => {});
pool.query('ALTER TABLE eventos ADD COLUMN IF NOT EXISTS data_dia4 DATE').catch(() => {});
pool.query('ALTER TABLE eventos ADD COLUMN IF NOT EXISTS vagas_dia4 INTEGER').catch(() => {});
pool.query('ALTER TABLE eventos ADD COLUMN IF NOT EXISTS data_dia5 DATE').catch(() => {});
pool.query('ALTER TABLE eventos ADD COLUMN IF NOT EXISTS vagas_dia5 INTEGER').catch(() => {});
// Dias 2..5 podem ficar vazios em eventos de menos dias
pool.query('ALTER TABLE eventos ALTER COLUMN data_dia2 DROP NOT NULL').catch(() => {});
pool.query('ALTER TABLE eventos ALTER COLUMN vagas_dia2 DROP NOT NULL').catch(() => {});

// Helpers de dia de atendimento: "Dia 3" -> 3, e vagas/data da coluna correspondente
const numeroDoDia = (s) => parseInt(String(s || '').replace(/\D/g, ''), 10) || 1;
const vagasDoDia = (ev, diaStr) => ev[`vagas_dia${numeroDoDia(diaStr)}`];
const DIAS_MAX = 5;

// === WEBHOOK N8N (WhatsApp) — autenticação por API Key ===
const N8N_WEBHOOK_KEY = process.env.N8N_WEBHOOK_KEY || 'saudeaura_n8n_2026_secret';

app.post('/api/webhook/n8n', async (req, res) => {
    // Verificar API Key
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== N8N_WEBHOOK_KEY) {
        return res.status(401).json({ erro: 'API Key inválida' });
    }

    const { evento_id, dia_atendimento, tipo_tratamento, nome, telefone, nascimento, idade, rua, numero, complemento, bairro, cidade, estado, queixa1, queixa2, queixa3, whatsapp_chat_id } = req.body;

    // Validação dos campos obrigatórios
    if (!evento_id || !dia_atendimento || !tipo_tratamento || !nome || !telefone || !queixa1) {
        return res.status(400).json({ erro: 'Campos obrigatórios faltando: evento_id, dia_atendimento, tipo_tratamento, nome, telefone, queixa1' });
    }

    try {
        const ev = (await pool.query('SELECT * FROM eventos WHERE id = $1', [evento_id])).rows[0];
        if (!ev) return res.status(404).json({ erro: 'Evento não encontrado' });

        const ocup = parseInt((await pool.query("SELECT COUNT(*) FROM pacientes WHERE evento_id = $1 AND dia_atendimento = $2 AND tipo_tratamento != 'Socorro Espiritual'", [evento_id, dia_atendimento])).rows[0].count);

        if (tipo_tratamento !== 'Socorro Espiritual') {
            const vagas = vagasDoDia(ev, dia_atendimento);
            if (vagas != null && ocup >= vagas) return res.status(400).json({ erro: `Vagas esgotadas para ${dia_atendimento}` });
        }

        let senha = null;
        if (tipo_tratamento !== 'Socorro Espiritual') {
            const maxS = await pool.query('SELECT MAX(senha_atendimento) FROM pacientes WHERE evento_id = $1 AND dia_atendimento = $2', [evento_id, dia_atendimento]);
            senha = maxS.rows[0].max ? parseInt(maxS.rows[0].max) + 1 : 1;
        }

        await pool.query(
            `INSERT INTO pacientes (evento_id, senha_atendimento, dia_atendimento, tipo_tratamento, nome, telefone, nascimento, idade, endereco, numero, complemento, bairro, cidade, estado, queixa1, queixa2, queixa3)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
            [evento_id, senha, dia_atendimento, tipo_tratamento, nome, telefone, nascimento, idade || null, rua || null, numero || null, complemento || null, bairro || null, cidade || null, estado || null, queixa1, queixa2 || null, queixa3 || null]
        );

        console.log(`[n8n/WhatsApp] Paciente cadastrado: ${nome} | Senha: ${senha} | Chat: ${whatsapp_chat_id || 'N/A'}`);

        // Gerar PDF do comprovante
        let pdf_base64 = null;
        try {
            const pdfBuffer = await gerarPDFReciboBuffer(senha, nome, dia_atendimento, tipo_tratamento, ev);
            pdf_base64 = pdfBuffer.toString('base64');
        } catch (pdfErr) {
            console.error('[n8n/WhatsApp] Erro ao gerar PDF:', pdfErr.message);
        }

        res.status(201).json({ sucesso: true, senha, nome, mensagem: `Paciente ${nome} cadastrado com senha ${senha}`, pdf_base64, pdf_filename: `Comprovante_Senha_${senha}_${nome.split(' ')[0]}.pdf` });
    } catch (e) {
        console.error('[n8n/WhatsApp] Erro:', e.message);
        res.status(500).json({ erro: e.message });
    }
});

// Rota auxiliar: listar eventos disponíveis (para o n8n saber qual evento_id usar)
app.get('/api/webhook/n8n/eventos', async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== N8N_WEBHOOK_KEY) {
        return res.status(401).json({ erro: 'API Key inválida' });
    }

    try {
        const result = await pool.query('SELECT id, nome, data_dia1, vagas_dia1, data_dia2, vagas_dia2 FROM eventos ORDER BY id DESC');
        const eventos = await Promise.all(result.rows.map(async (ev) => {
            const c1 = parseInt((await pool.query("SELECT COUNT(*) FROM pacientes WHERE evento_id = $1 AND dia_atendimento = $2 AND tipo_tratamento != 'Socorro Espiritual'", [ev.id, 'Dia 1'])).rows[0].count);
            const c2 = parseInt((await pool.query("SELECT COUNT(*) FROM pacientes WHERE evento_id = $1 AND dia_atendimento = $2 AND tipo_tratamento != 'Socorro Espiritual'", [ev.id, 'Dia 2'])).rows[0].count);
            return { ...ev, vagas_disponiveis_dia1: ev.vagas_dia1 - c1, vagas_disponiveis_dia2: ev.vagas_dia2 - c2 };
        }));
        res.json(eventos);
    } catch (e) {
        res.status(500).json({ erro: e.message });
    }
});

// Todas as rotas daqui para baixo requerem Autenticação
app.use(verificarToken);

// === UTILIZADORES ===
app.get('/usuarios', async (req, res) => {
    if(req.user.perfil !== 'admin') return res.status(403).json({erro: 'Sem permissão'});
    const r = await pool.query('SELECT u.id, u.nome, u.usuario, u.perfil, u.evento_id, e.nome AS nome_evento FROM usuarios u LEFT JOIN eventos e ON u.evento_id = e.id ORDER BY u.nome ASC');
    res.json(r.rows);
});

app.post('/usuarios', async (req, res) => {
    if(req.user.perfil !== 'admin') return res.status(403).json({erro: 'Sem permissão'});
    const { nome, usuario, senha, perfil, evento_id } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(senha, salt);
        await pool.query('INSERT INTO usuarios (nome, usuario, senha, perfil, evento_id) VALUES ($1, $2, $3, $4, $5)', [nome, usuario, hash, perfil, evento_id || null]);
        res.json({ mensagem: '✅ Utilizador criado com sucesso!' });
    } catch (e) {
        if (e.message.includes('unique')) {
            res.status(400).json({ erro: '❌ Este login já existe. Escolha outro.' });
        } else {
            res.status(400).json({ erro: 'Erro BD: ' + e.message });
        }
    }
});

app.delete('/usuarios/:id', async (req, res) => {
    if(req.user.perfil !== 'admin') return res.status(403).json({erro: 'Sem permissão'});
    await pool.query('DELETE FROM usuarios WHERE id = $1', [req.params.id]);
    res.json({ mensagem: '✅ Utilizador removido!' });
});

// === EVENTOS ===
app.get('/backup', async (req, res) => {
    if (req.user.perfil !== 'admin') return res.status(403).json({ erro: 'Acesso restrito a administradores' });
    const { evento_id } = req.query;

    const eventosFiltro = evento_id
        ? (await pool.query('SELECT * FROM eventos WHERE id = $1', [evento_id])).rows
        : (await pool.query('SELECT * FROM eventos ORDER BY id ASC')).rows;

    const resultado = await Promise.all(eventosFiltro.map(async (ev) => {
        const { rows: pacientes } = await pool.query(
            'SELECT * FROM pacientes WHERE evento_id = $1 ORDER BY dia_atendimento, senha_atendimento NULLS LAST, nome',
            [ev.id]
        );
        return { ...ev, pacientes };
    }));

    const nomeArquivo = evento_id
        ? `backup_evento_${evento_id}_${new Date().toISOString().slice(0,10)}.json`
        : `backup_completo_${new Date().toISOString().slice(0,10)}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.json({ exportado_em: new Date().toISOString(), versao: '1.0', eventos: resultado });
});

app.get('/eventos', async (req, res) => {
    try {
        // Voluntário vinculado a um evento só enxerga esse evento; admin (ou usuário sem
        // vínculo, legado) enxerga todos.
        const restrito = req.user.perfil !== 'admin' && req.user.evento_id;
        const result = restrito
            ? await pool.query('SELECT * FROM eventos WHERE id = $1 ORDER BY id DESC', [req.user.evento_id])
            : await pool.query('SELECT * FROM eventos ORDER BY id DESC');

        const eventosComContagem = await Promise.all(result.rows.map(async (ev) => {
            // Uma única consulta agrupada por dia: cura (conta vaga) x socorro (sem vaga)
            const cont = await pool.query(
                `SELECT dia_atendimento,
                        COUNT(*) FILTER (WHERE tipo_tratamento != 'Socorro Espiritual') AS cura,
                        COUNT(*) FILTER (WHERE tipo_tratamento = 'Socorro Espiritual')  AS socorro
                 FROM pacientes WHERE evento_id = $1 GROUP BY dia_atendimento`, [ev.id]);
            const porDia = {};
            cont.rows.forEach(r => { porDia[r.dia_atendimento] = { cura: parseInt(r.cura), socorro: parseInt(r.socorro) }; });

            const qtd = ev.qtd_dias || 2;
            const dias = [];
            for (let n = 1; n <= qtd; n++) {
                const label = `Dia ${n}`;
                const c = porDia[label] || { cura: 0, socorro: 0 };
                dias.push({ numero: n, label, data: ev[`data_dia${n}`], vagas: ev[`vagas_dia${n}`], ocupadas: c.cura, socorro: c.socorro });
            }
            return { ...ev, dias };
        }));
        res.json(eventosComContagem);
    } catch (e) { res.status(500).json({ erro: 'Erro ao listar eventos' }); }
});

// Colunas data_diaN / vagas_diaN para o INSERT/UPDATE de eventos (dia 1..5)
const COLS_DIAS = Array.from({ length: DIAS_MAX }, (_, i) => i + 1)
    .flatMap(n => [`data_dia${n}`, `vagas_dia${n}`]);
// Lê os dias do corpo respeitando qtd_dias: dias além do escolhido viram null
const valoresDias = (body) => {
    const qtd = Math.min(Math.max(parseInt(body.qtd_dias, 10) || 2, 1), DIAS_MAX);
    return COLS_DIAS.map((col) => {
        const n = numeroDoDia(col);
        if (n > qtd) return null;
        const v = body[col];
        return v === '' || v === undefined ? null : v;
    });
};

app.post('/eventos', async (req, res) => {
    if(req.user.perfil !== 'admin') return res.status(403).json({erro: 'Sem permissão'});
    const { nome, qtd_dias, local_atendimento, instrucoes_pdf, insta, whats, email, site } = req.body;
    try {
        const dias = valoresDias(req.body);
        const qtd = Math.min(Math.max(parseInt(qtd_dias, 10) || 2, 1), DIAS_MAX);
        // Colunas: nome, qtd_dias, data_dia1, vagas_dia1, ..., data_dia5, vagas_dia5, local..., site
        const cols = ['nome', 'qtd_dias', ...COLS_DIAS, 'local_atendimento', 'instrucoes_pdf', 'insta', 'whats', 'email', 'site'];
        const vals = [nome, qtd, ...dias, local_atendimento, instrucoes_pdf, insta, whats, email, site];
        const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
        await pool.query(`INSERT INTO eventos (${cols.join(', ')}) VALUES (${placeholders})`, vals);
        res.json({ mensagem: '✅ Evento criado!' });
    } catch (e) { res.status(500).json({ erro: 'Erro ao criar evento' }); }
});

app.put('/eventos/:id', async (req, res) => {
    if(req.user.perfil !== 'admin') return res.status(403).json({erro: 'Sem permissão'});
    const { nome, qtd_dias, local_atendimento, instrucoes_pdf, insta, whats, email, site } = req.body;
    try {
        const dias = valoresDias(req.body);
        const qtd = Math.min(Math.max(parseInt(qtd_dias, 10) || 2, 1), DIAS_MAX);
        const cols = ['nome', 'qtd_dias', ...COLS_DIAS, 'local_atendimento', 'instrucoes_pdf', 'insta', 'whats', 'email', 'site'];
        const vals = [nome, qtd, ...dias, local_atendimento, instrucoes_pdf, insta, whats, email, site, req.params.id];
        const sets = cols.map((c, i) => `${c}=$${i + 1}`).join(', ');
        await pool.query(`UPDATE eventos SET ${sets} WHERE id=$${cols.length + 1}`, vals);
        res.json({ mensagem: '✅ Evento atualizado!' });
    } catch (e) { res.status(500).json({ erro: 'Erro ao atualizar evento' }); }
});

app.delete('/eventos/:id', async (req, res) => {
    if(req.user.perfil !== 'admin') return res.status(403).json({erro: 'Sem permissão'});
    await pool.query('DELETE FROM pacientes WHERE evento_id = $1', [req.params.id]);
    await pool.query('DELETE FROM eventos WHERE id = $1', [req.params.id]);
    res.json({ mensagem: '✅ Evento removido!' });
});

// === PACIENTES ===
app.get('/pacientes/buscar', async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim().length < 3) return res.json([]);
    const digitos = q.trim().replace(/\D/g, '');
    const r = await pool.query(
        `SELECT DISTINCT ON (p.telefone, p.nome) p.nome, p.telefone, p.nascimento, p.idade,
                p.endereco, p.numero, p.complemento, p.bairro, p.cidade, p.estado
         FROM pacientes p
         WHERE p.nome ILIKE $1
            OR p.telefone ILIKE $1
            OR (length($2) >= 3 AND regexp_replace(p.telefone, '[^0-9]', '', 'g') LIKE $2)
         ORDER BY p.telefone, p.nome, p.id DESC
         LIMIT 8`,
        [`%${q.trim()}%`, `%${digitos}%`]
    );
    res.json(r.rows);
});

app.get('/pacientes/exportar-vcf', async (req, res) => {
    if (req.user.perfil !== 'admin') return res.status(403).json({ erro: 'Acesso restrito a administradores' });
    const { evento_id } = req.query;
    const params = [];
    let where = '';
    if (evento_id) { where = ' WHERE p.evento_id = $1'; params.push(evento_id); }
    const r = await pool.query(
        `SELECT DISTINCT ON (p.telefone) p.nome, p.telefone FROM pacientes p${where} ORDER BY p.telefone, p.nome`,
        params
    );

    const normalizarTel = (tel) => {
        if (!tel) return null;
        const d = tel.replace(/\D/g, '');
        if (d.length >= 10 && d.length <= 11) return `+55${d}`;
        if (d.length === 13 && d.startsWith('55')) return `+${d}`;
        return d || null;
    };

    const linhas = r.rows.map(p => {
        const tel = normalizarTel(p.telefone);
        const linhasVcard = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${p.nome}`, `N:${p.nome.split(' ').slice(-1)[0]};${p.nome.split(' ').slice(0, -1).join(' ')};;;`];
        if (tel) linhasVcard.push(`TEL;TYPE=CELL:${tel}`);
        linhasVcard.push('END:VCARD');
        return linhasVcard.join('\r\n');
    });

    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="contatos_saude_aura.vcf"');
    res.send(linhas.join('\r\n'));
});

app.get('/pacientes', async (req, res) => {
    // Voluntário vinculado só vê pacientes do seu evento; admin/legado vê todos.
    const restrito = req.user.perfil !== 'admin' && req.user.evento_id;
    const base = `SELECT p.*, e.nome as nome_evento, e.data_dia1, e.data_dia2, e.data_dia3, e.data_dia4, e.data_dia5, e.local_atendimento, e.instrucoes_pdf, e.insta, e.whats, e.email, e.site FROM pacientes p JOIN eventos e ON p.evento_id = e.id`;
    const r = restrito
        ? await pool.query(`${base} WHERE p.evento_id = $1 ORDER BY p.id DESC`, [req.user.evento_id])
        : await pool.query(`${base} ORDER BY p.id DESC`);
    res.json(r.rows);
});

app.post('/pacientes', async (req, res) => {
    const { evento_id, dia_atendimento, tipo_tratamento, nome, telefone, nascimento, idade, rua, numero, complemento, bairro, cidade, estado, queixa1, queixa2, queixa3 } = req.body;
    // Voluntário vinculado só cadastra no próprio evento
    if (req.user.perfil !== 'admin' && req.user.evento_id && String(req.user.evento_id) !== String(evento_id)) {
        return res.status(403).json({ erro: 'Sem permissão para este evento' });
    }
    try {
        const ev = (await pool.query('SELECT * FROM eventos WHERE id = $1', [evento_id])).rows[0];
        const ocup = parseInt((await pool.query("SELECT COUNT(*) FROM pacientes WHERE evento_id = $1 AND dia_atendimento = $2 AND tipo_tratamento != 'Socorro Espiritual'", [evento_id, dia_atendimento])).rows[0].count);

        if (tipo_tratamento !== 'Socorro Espiritual') {
            const vagas = vagasDoDia(ev, dia_atendimento);
            if (vagas != null && ocup >= vagas) return res.status(400).json({ erro: `🚫 Vagas esgotadas ${dia_atendimento}` });
        }

        let s = null;
        if (tipo_tratamento !== 'Socorro Espiritual') {
            const maxS = await pool.query('SELECT MAX(senha_atendimento) FROM pacientes WHERE evento_id = $1 AND dia_atendimento = $2', [evento_id, dia_atendimento]);
            s = maxS.rows[0].max ? parseInt(maxS.rows[0].max) + 1 : 1;
        }

        await pool.query(`INSERT INTO pacientes (evento_id, senha_atendimento, dia_atendimento, tipo_tratamento, nome, telefone, nascimento, idade, endereco, numero, complemento, bairro, cidade, estado, queixa1, queixa2, queixa3) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [evento_id, s, dia_atendimento, tipo_tratamento, nome, telefone, nascimento, idade, rua, numero, complemento, bairro, cidade, estado, queixa1, queixa2, queixa3]);
        res.status(201).json({ senha: s });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.put('/pacientes/:id', async (req, res) => {
    const { evento_id, dia_atendimento, tipo_tratamento, nome, telefone, nascimento, idade, rua, numero, complemento, bairro, cidade, estado, queixa1, queixa2, queixa3 } = req.body;
    try {
        const atual = (await pool.query('SELECT dia_atendimento, evento_id, senha_atendimento, tipo_tratamento FROM pacientes WHERE id = $1', [req.params.id])).rows[0];
        let senha_final = null;
        let novaSenhaNaResposta = null;
        if (tipo_tratamento !== 'Socorro Espiritual') {
            const precisaNovasenha = atual && (
                atual.tipo_tratamento === 'Socorro Espiritual' ||
                atual.dia_atendimento !== dia_atendimento ||
                String(atual.evento_id) !== String(evento_id)
            );
            if (precisaNovasenha) {
                const maxS = await pool.query('SELECT MAX(senha_atendimento) FROM pacientes WHERE evento_id = $1 AND dia_atendimento = $2', [evento_id, dia_atendimento]);
                senha_final = maxS.rows[0].max ? parseInt(maxS.rows[0].max) + 1 : 1;
                novaSenhaNaResposta = senha_final;
            } else {
                senha_final = atual ? atual.senha_atendimento : 1;
            }
        }
        await pool.query(
            `UPDATE pacientes SET evento_id=$1, dia_atendimento=$2, tipo_tratamento=$3, nome=$4, telefone=$5, nascimento=$6, idade=$7, endereco=$8, numero=$9, complemento=$10, bairro=$11, cidade=$12, estado=$13, queixa1=$14, queixa2=$15, queixa3=$16, senha_atendimento=$17 WHERE id=$18`,
            [evento_id, dia_atendimento, tipo_tratamento, nome, telefone, nascimento, idade, rua, numero, complemento, bairro, cidade, estado, queixa1, queixa2, queixa3, senha_final, req.params.id]
        );
        res.json({ mensagem: '✅ Atualizado!', nova_senha: novaSenhaNaResposta });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.put('/pacientes/:id/entregue', async (req, res) => {
    const { entregue } = req.body;
    try {
        await pool.query('UPDATE pacientes SET entregue = $1 WHERE id = $2', [!!entregue, req.params.id]);
        res.json({ sucesso: true, entregue: !!entregue });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.put('/pacientes/:id/preferencial', async (req, res) => {
    const { preferencial } = req.body;
    try {
        await pool.query('UPDATE pacientes SET preferencial = $1 WHERE id = $2', [!!preferencial, req.params.id]);
        res.json({ sucesso: true, preferencial: !!preferencial });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.delete('/pacientes/:id', async (req, res) => {
    await pool.query('DELETE FROM pacientes WHERE id = $1', [req.params.id]);
    res.json({ m: 'OK' });
});

app.listen(porta, () => console.log(`Servidor seguro rodando na porta ${porta}`));