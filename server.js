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
        const r = await pool.query('SELECT id, nome, senha, perfil FROM usuarios WHERE usuario = $1', [usuario]);
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
            const token = jwt.sign({ id: user.id, perfil: user.perfil, nome: user.nome }, SECRET_KEY, { expiresIn: '12h' });
            res.json({ sucesso: true, token, perfil: user.perfil, nome: user.nome });
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

        const ocup = parseInt((await pool.query('SELECT COUNT(*) FROM pacientes WHERE evento_id = $1 AND dia_atendimento = $2', [evento_id, dia_atendimento])).rows[0].count);

        if (dia_atendimento === 'Dia 1' && ocup >= ev.vagas_dia1) return res.status(400).json({ erro: 'Vagas esgotadas para Dia 1' });
        if (dia_atendimento === 'Dia 2' && ocup >= ev.vagas_dia2) return res.status(400).json({ erro: 'Vagas esgotadas para Dia 2' });

        const maxS = await pool.query('SELECT MAX(senha_atendimento) FROM pacientes WHERE evento_id = $1 AND dia_atendimento = $2', [evento_id, dia_atendimento]);
        const senha = maxS.rows[0].max ? parseInt(maxS.rows[0].max) + 1 : 1;

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
            const c1 = parseInt((await pool.query('SELECT COUNT(*) FROM pacientes WHERE evento_id = $1 AND dia_atendimento = $2', [ev.id, 'Dia 1'])).rows[0].count);
            const c2 = parseInt((await pool.query('SELECT COUNT(*) FROM pacientes WHERE evento_id = $1 AND dia_atendimento = $2', [ev.id, 'Dia 2'])).rows[0].count);
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
    const r = await pool.query('SELECT id, nome, usuario, perfil FROM usuarios ORDER BY nome ASC');
    res.json(r.rows);
});

app.post('/usuarios', async (req, res) => {
    if(req.user.perfil !== 'admin') return res.status(403).json({erro: 'Sem permissão'});
    const { nome, usuario, senha, perfil } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(senha, salt);
        await pool.query('INSERT INTO usuarios (nome, usuario, senha, perfil) VALUES ($1, $2, $3, $4)', [nome, usuario, hash, perfil]);
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
app.get('/eventos', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM eventos ORDER BY id DESC');
        const eventosComContagem = await Promise.all(result.rows.map(async (ev) => {
            const c1 = await pool.query('SELECT COUNT(*) FROM pacientes WHERE evento_id = $1 AND dia_atendimento = $2', [ev.id, 'Dia 1']);
            const c2 = await pool.query('SELECT COUNT(*) FROM pacientes WHERE evento_id = $1 AND dia_atendimento = $2', [ev.id, 'Dia 2']);
            return { ...ev, ocupadas_dia1: parseInt(c1.rows[0].count), ocupadas_dia2: parseInt(c2.rows[0].count) };
        }));
        res.json(eventosComContagem);
    } catch (e) { res.status(500).json({ erro: 'Erro ao listar eventos' }); }
});

app.post('/eventos', async (req, res) => {
    if(req.user.perfil !== 'admin') return res.status(403).json({erro: 'Sem permissão'});
    const { nome, data_dia1, vagas_dia1, data_dia2, vagas_dia2, local_atendimento, instrucoes_pdf, insta, whats, email, site } = req.body;
    try {
        await pool.query(`INSERT INTO eventos (nome, data_dia1, vagas_dia1, data_dia2, vagas_dia2, local_atendimento, instrucoes_pdf, insta, whats, email, site) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, 
        [nome, data_dia1, vagas_dia1, data_dia2, vagas_dia2, local_atendimento, instrucoes_pdf, insta, whats, email, site]);
        res.json({ mensagem: '✅ Evento criado!' });
    } catch (e) { res.status(500).json({ erro: 'Erro ao criar evento' }); }
});

app.put('/eventos/:id', async (req, res) => {
    if(req.user.perfil !== 'admin') return res.status(403).json({erro: 'Sem permissão'});
    const { nome, data_dia1, vagas_dia1, data_dia2, vagas_dia2, local_atendimento, instrucoes_pdf, insta, whats, email, site } = req.body;
    try {
        await pool.query(`UPDATE eventos SET nome=$1, data_dia1=$2, vagas_dia1=$3, data_dia2=$4, vagas_dia2=$5, local_atendimento=$6, instrucoes_pdf=$7, insta=$8, whats=$9, email=$10, site=$11 WHERE id=$12`, 
        [nome, data_dia1, vagas_dia1, data_dia2, vagas_dia2, local_atendimento, instrucoes_pdf, insta, whats, email, site, req.params.id]);
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
app.get('/pacientes', async (req, res) => {
    const r = await pool.query(`SELECT p.*, e.nome as nome_evento, e.data_dia1, e.data_dia2, e.local_atendimento, e.instrucoes_pdf, e.insta, e.whats, e.email, e.site FROM pacientes p JOIN eventos e ON p.evento_id = e.id ORDER BY p.id DESC`);
    res.json(r.rows);
});

app.post('/pacientes', async (req, res) => {
    const { evento_id, dia_atendimento, tipo_tratamento, nome, telefone, nascimento, idade, rua, numero, complemento, bairro, cidade, estado, queixa1, queixa2, queixa3 } = req.body;
    try {
        const ev = (await pool.query('SELECT * FROM eventos WHERE id = $1', [evento_id])).rows[0];
        const ocup = parseInt((await pool.query('SELECT COUNT(*) FROM pacientes WHERE evento_id = $1 AND dia_atendimento = $2', [evento_id, dia_atendimento])).rows[0].count);
        
        if (dia_atendimento === 'Dia 1' && ocup >= ev.vagas_dia1) return res.status(400).json({ erro: '🚫 Vagas esgotadas D1' });
        if (dia_atendimento === 'Dia 2' && ocup >= ev.vagas_dia2) return res.status(400).json({ erro: '🚫 Vagas esgotadas D2' });
        
        const maxS = await pool.query('SELECT MAX(senha_atendimento) FROM pacientes WHERE evento_id = $1 AND dia_atendimento = $2', [evento_id, dia_atendimento]);
        let s = maxS.rows[0].max ? parseInt(maxS.rows[0].max) + 1 : 1;
        
        await pool.query(`INSERT INTO pacientes (evento_id, senha_atendimento, dia_atendimento, tipo_tratamento, nome, telefone, nascimento, idade, endereco, numero, complemento, bairro, cidade, estado, queixa1, queixa2, queixa3) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`, 
        [evento_id, s, dia_atendimento, tipo_tratamento, nome, telefone, nascimento, idade, rua, numero, complemento, bairro, cidade, estado, queixa1, queixa2, queixa3]);
        res.status(201).json({ senha: s });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.put('/pacientes/:id', async (req, res) => {
    const { evento_id, dia_atendimento, tipo_tratamento, nome, telefone, nascimento, idade, rua, numero, complemento, bairro, cidade, estado, queixa1, queixa2, queixa3 } = req.body;
    try {
        await pool.query(`UPDATE pacientes SET evento_id=$1, dia_atendimento=$2, tipo_tratamento=$3, nome=$4, telefone=$5, nascimento=$6, idade=$7, endereco=$8, numero=$9, complemento=$10, bairro=$11, cidade=$12, estado=$13, queixa1=$14, queixa2=$15, queixa3=$16 WHERE id=$17`,
        [evento_id, dia_atendimento, tipo_tratamento, nome, telefone, nascimento, idade, rua, numero, complemento, bairro, cidade, estado, queixa1, queixa2, queixa3, req.params.id]);
        res.json({ mensagem: '✅ Atualizado!' });
    } catch (e) { res.status(500).json({ erro: e.message }); }
});

app.delete('/pacientes/:id', async (req, res) => {
    await pool.query('DELETE FROM pacientes WHERE id = $1', [req.params.id]);
    res.json({ m: 'OK' });
});

app.listen(porta, () => console.log(`Servidor seguro rodando na porta ${porta}`));