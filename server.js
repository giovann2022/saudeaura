const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();
const porta = process.env.PORT || 3000;

app.use(cors());
app.use(express.json()); 

app.get('/', (req, res) => res.send('🚀 API de Atendimento Ativa!'));

// === REPARAÇÃO DE BANCO ===
app.get('/reparar-banco', async (req, res) => {
    try {
        await pool.query(`ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS rua TEXT`);
        await pool.query(`ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS numero VARCHAR(20)`);
        await pool.query(`ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS complemento VARCHAR(100)`);
        await pool.query(`ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS cidade VARCHAR(100)`);
        await pool.query(`ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS estado VARCHAR(2)`);
        res.send('✅ Banco de dados atualizado com colunas de endereço!');
    } catch (e) { res.status(500).send('Erro: ' + e.message); }
});

// === UTILIZADORES ===
app.get('/usuarios', async (req, res) => {
    const r = await pool.query('SELECT id, nome, usuario, perfil FROM usuarios ORDER BY nome ASC');
    res.json(r.rows);
});

app.post('/usuarios', async (req, res) => {
    const { nome, usuario, senha, perfil } = req.body;
    try {
        await pool.query('INSERT INTO usuarios (nome, usuario, senha, perfil) VALUES ($1, $2, $3, $4)', [nome, usuario, senha, perfil]);
        res.json({ mensagem: '✅ Utilizador criado!' });
    } catch (e) { res.status(400).json({ erro: '❌ Login já existe' }); }
});

app.delete('/usuarios/:id', async (req, res) => {
    await pool.query('DELETE FROM usuarios WHERE id = $1', [req.params.id]);
    res.json({ mensagem: '✅ Removido!' });
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
    const { nome, data_dia1, vagas_dia1, data_dia2, vagas_dia2, local_atendimento, instrucoes_pdf, insta, whats, email, site } = req.body;
    try {
        await pool.query(`INSERT INTO eventos (nome, data_dia1, vagas_dia1, data_dia2, vagas_dia2, local_atendimento, instrucoes_pdf, insta, whats, email, site) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, 
        [nome, data_dia1, vagas_dia1, data_dia2, vagas_dia2, local_atendimento, instrucoes_pdf, insta, whats, email, site]);
        res.json({ mensagem: '✅ Evento criado!' });
    } catch (e) { res.status(500).json({ erro: 'Erro ao criar evento' }); }
});

app.put('/eventos/:id', async (req, res) => {
    const { nome, data_dia1, vagas_dia1, data_dia2, vagas_dia2, local_atendimento, instrucoes_pdf, insta, whats, email, site } = req.body;
    try {
        await pool.query(`UPDATE eventos SET nome=$1, data_dia1=$2, vagas_dia1=$3, data_dia2=$4, vagas_dia2=$5, local_atendimento=$6, instrucoes_pdf=$7, insta=$8, whats=$9, email=$10, site=$11 WHERE id=$12`, 
        [nome, data_dia1, vagas_dia1, data_dia2, vagas_dia2, local_atendimento, instrucoes_pdf, insta, whats, email, site, req.params.id]);
        res.json({ mensagem: '✅ Evento atualizado!' });
    } catch (e) { res.status(500).json({ erro: 'Erro ao atualizar evento' }); }
});

app.delete('/eventos/:id', async (req, res) => {
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

app.post('/login', async (req, res) => {
    const { usuario, senha } = req.body;
    const r = await pool.query('SELECT nome, perfil FROM usuarios WHERE usuario = $1 AND senha = $2', [usuario, senha]);
    if (r.rows.length > 0) res.json({ sucesso: true, perfil: r.rows[0].perfil, nome: r.rows[0].nome });
    else res.status(401).json({ erro: 'Incorreto' });
});

app.listen(porta, () => console.log(`Servidor na porta ${porta}`));