const express = require('express');
const axios = require('axios');
const pino = require('pino');
require('dotenv').config();

const baileys = require('@whiskeysockets/baileys');
const makeWASocket = baileys.default || baileys.makeWASocket;
const { useMultiFileAuthState, DisconnectReason, downloadMediaMessage, fetchLatestBaileysVersion } = baileys;
const QRCode = require('qrcode');
const qrTerminal = require('qrcode-terminal');

const app = express();
app.use(express.json());

const PORTA = process.env.AGENTE_PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CADASTRO_API_URL = process.env.CADASTRO_API_URL || 'http://localhost:3000';
const CADASTRO_API_KEY = process.env.N8N_WEBHOOK_KEY || 'saudeaura_n8n_2026_secret';
const EVENTO_ID_CONFIG = parseInt(process.env.EVENTO_ID_ATIVO) || 1;
const WHATSAPP_PHONE = process.env.WHATSAPP_PHONE;

const logger = pino({ level: 'silent' });
const conversas = new Map();
const conversasPausadas = new Set();
let sock = null;
let ultimoQR = null;

let dataDia1 = 'Dia 1';
let dataDia2 = 'Dia 2';
let eventoIdAtivo = EVENTO_ID_CONFIG;

function formatarData(dataISO) {
    if (!dataISO) return null;
    const d = new Date(dataISO);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

async function carregarDatasEvento() {
    try {
        const resp = await axios.get(
            `${CADASTRO_API_URL}/api/webhook/n8n/eventos`,
            { headers: { 'x-api-key': CADASTRO_API_KEY }, timeout: 10000 }
        );
        const eventos = resp.data;
        if (!eventos || eventos.length === 0) {
            console.warn('⚠️  Nenhum evento encontrado no banco');
            return;
        }
        // Tenta usar o evento configurado; se não existir, usa o mais recente
        const evento = eventos.find(e => e.id === EVENTO_ID_CONFIG) || eventos[0];
        eventoIdAtivo = evento.id;
        const d1 = formatarData(evento.data_dia1);
        const d2 = formatarData(evento.data_dia2);
        if (d1) dataDia1 = `Dia 1 (${d1})`;
        if (d2) dataDia2 = `Dia 2 (${d2})`;
        console.log(`📅 Evento ativo: id=${eventoIdAtivo} | ${dataDia1} | ${dataDia2}`);
    } catch (err) {
        console.warn('⚠️  Não foi possível carregar datas do evento:', err.message);
    }
}

function gerarSystemPrompt() {
    return `Você é a Eliéte, voluntária da equipe de cadastro. Você faz os cadastros para o evento de atendimento espiritual pelo WhatsApp.

PERSONALIDADE E TOM:
- Seja calorosa, acolhedora e paciente — como uma voluntária gentil
- Use linguagem natural e simples, sem formalidade excessiva
- Pode usar emojis com moderação (🙏 💛 ✅ 😊)
- NUNCA mencione que você é um robô, IA ou sistema automatizado
- Se perguntarem se você é humana, diga que é voluntária da equipe

REGRAS IMPORTANTES:
1. Faça APENAS UMA pergunta por vez — nunca várias de uma vez
2. Se a resposta for confusa ou incompleta, peça gentilmente para repetir
3. O paciente pode responder por texto OU por áudio (já transcrito). Trate igualmente
4. Seja especialmente paciente com pessoas mais idosas

SAUDAÇÃO INICIAL:
Na primeira mensagem ou saudação ("oi", "olá", "bom dia", etc.), apresente-se:
"Olá! Sou a Eliéte, vamos fazer seu cadastro para o atendimento espiritual, tudo bem? Para começar, qual é seu nome completo?"

ORDEM DA COLETA (siga esta ordem sem pular etapas):
1. Nome Completo
2. Data de Nascimento (formato DD/MM/AAAA)
3. Telefone — confirme o número do WhatsApp: "Posso usar o número que você está me enviando?"
4. Endereço:
   - Pergunte o CEP
   - Se o sistema encontrar o CEP, você receberá uma linha: [CEP ENCONTRADO: rua=X, bairro=Y, cidade=Z, estado=W]
     → Confirme com a pessoa: "Encontrei seu endereço: [rua], [bairro], [cidade]-[estado]. Está correto?"
     → Após confirmação, pergunte apenas o Número e depois o Complemento (opcional)
   - Se receber [CEP NÃO ENCONTRADO], peça manualmente: Rua, Número, Complemento (opcional), Bairro, Cidade, Estado (sigla)
   - Se a pessoa disser que não sabe o CEP, peça diretamente: Rua, Número, Complemento (opcional), Bairro, Cidade, Estado (sigla)
5. Dia de Atendimento preferido: "${dataDia1}" ou "${dataDia2}"
6. Tipo de Atendimento: "Socorro Espiritual" ou "Cura Espiritual"
7. Queixas:
   - SOCORRO ESPIRITUAL: 1 queixa principal
   - CURA ESPIRITUAL: até 3 queixas (1ª obrigatória — após ela pergunte se tem mais)

CONFIRMAÇÃO:
Após coletar todos os dados, apresente resumo e peça confirmação:
"Perfeito! 🙏 Deixa eu confirmar seus dados:

📝 *Nome:* [nome]
🎂 *Nascimento:* [data]
📱 *Telefone:* [telefone]
📍 *Endereço:* [endereço completo]
📅 *Dia:* [dia]
🏥 *Tipo:* [tipo]
💬 *Queixa(s):* [queixas]

Está tudo certinho? Posso finalizar?"

Se o paciente CONFIRMAR, responda com EXATAMENTE este formato:

[FINALIZADO]
\`\`\`json
{
  "nome": "Nome Completo",
  "telefone": "(XX) XXXXX-XXXX",
  "nascimento": "AAAA-MM-DD",
  "idade": 70,
  "rua": "Nome da Rua",
  "numero": "123",
  "complemento": "Apto 4",
  "bairro": "Nome do Bairro",
  "cidade": "Nome da Cidade",
  "estado": "SP",
  "dia_atendimento": "Dia 1",
  "tipo_tratamento": "Socorro Espiritual",
  "queixa1": "Primeira queixa",
  "queixa2": "Segunda queixa",
  "queixa3": "Terceira queixa"
}
\`\`\`

Que Deus abençoe! 🙏 Seu cadastro foi realizado. Em instantes você receberá seu comprovante com a senha de atendimento aqui no WhatsApp. Nos vemos no evento! 💛

OBSERVAÇÕES TÉCNICAS:
- Calcule a idade a partir da data de nascimento
- Data no JSON: formato AAAA-MM-DD
- Telefone: formato (XX) XXXXX-XXXX
- Estado: sigla de 2 letras (SP, RJ, MG, etc.)
- No campo "dia_atendimento" do JSON use sempre "Dia 1" ou "Dia 2" (sem a data)
- Se queixa2 ou queixa3 não existirem, NÃO as inclua no JSON
- NUNCA invente dados — use APENAS o que a pessoa informou
- Se a pessoa desistir, agradeça e encerre SEM usar [FINALIZADO]`;
}

async function chamarGemini(mensagens) {
    const contents = mensagens.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
    }));

    try {
        const resp = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                system_instruction: { parts: [{ text: gerarSystemPrompt() }] },
                contents,
                generationConfig: { temperature: 0.4 }
            },
            { timeout: 30000 }
        );
        return resp.data.candidates[0].content.parts[0].text;
    } catch (err) {
        const status = err.response?.status;
        const body = JSON.stringify(err.response?.data).substring(0, 300);
        console.error(`[Gemini] Erro ${status}: ${body}`);
        throw err;
    }
}

async function transcreverAudio(base64Audio, mimeType) {
    const resp = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
            contents: [{
                parts: [
                    { inline_data: { mime_type: mimeType, data: base64Audio } },
                    { text: 'Transcreva este áudio em português brasileiro. Retorne APENAS o texto falado, sem comentários adicionais.' }
                ]
            }]
        },
        { timeout: 30000 }
    );
    return resp.data.candidates[0].content.parts[0].text;
}

async function enviarTexto(chatId, texto) {
    if (!sock) throw new Error('WhatsApp não conectado');
    await sock.sendMessage(chatId, { text: texto });
}

async function enviarArquivo(chatId, pdfBase64, filename, caption) {
    if (!sock) throw new Error('WhatsApp não conectado');
    await sock.sendMessage(chatId, {
        document: Buffer.from(pdfBase64, 'base64'),
        mimetype: 'application/pdf',
        fileName: filename,
        caption: caption
    });
}

async function consultarCEP(cep) {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return null;
    try {
        const resp = await axios.get(`https://viacep.com.br/ws/${cepLimpo}/json/`, { timeout: 5000 });
        if (resp.data.erro) return null;
        return resp.data;
    } catch {
        return null;
    }
}

async function cadastrarPaciente(dados) {
    const resp = await axios.post(
        `${CADASTRO_API_URL}/api/webhook/n8n`,
        dados,
        {
            headers: { 'x-api-key': CADASTRO_API_KEY, 'Content-Type': 'application/json' },
            timeout: 15000,
            validateStatus: () => true
        }
    );
    return resp.data;
}

function parsearDadosCadastro(output) {
    const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) return null;
    try {
        return JSON.parse(jsonMatch[1]);
    } catch {
        return null;
    }
}

function getMensagemPosJson(output) {
    const partes = output.split('```');
    return partes.length >= 3 ? partes[2].trim() : 'Que Deus abençoe! 🙏';
}

async function processarMensagem(msg) {
    const chatId = msg.key.remoteJid;
    const messageContent = msg.message || {};
    const messageType = Object.keys(messageContent)[0];

    let mensagemTexto = '';

    try {
        await sock.readMessages([msg.key]).catch(() => {});

        if (messageType === 'audioMessage' || messageType === 'pttMessage') {
            const buffer = await downloadMediaMessage(
                msg, 'buffer', {},
                { logger, reuploadRequest: sock.updateMediaMessage }
            );
            const base64Audio = buffer.toString('base64');
            mensagemTexto = await transcreverAudio(base64Audio, 'audio/ogg; codecs=opus');
            console.log(`[${chatId}] Áudio transcrito: ${mensagemTexto.substring(0, 80)}...`);
        } else if (messageType === 'conversation') {
            mensagemTexto = messageContent.conversation || '';
        } else if (messageType === 'extendedTextMessage') {
            mensagemTexto = messageContent.extendedTextMessage?.text || '';
        } else {
            return;
        }

        if (!mensagemTexto.trim()) return;

        const cepMatch = mensagemTexto.match(/\b\d{5}-?\d{3}\b/);
        if (cepMatch) {
            const dadosCEP = await consultarCEP(cepMatch[0]);
            if (dadosCEP) {
                mensagemTexto += `\n[CEP ENCONTRADO: rua=${dadosCEP.logradouro}, bairro=${dadosCEP.bairro}, cidade=${dadosCEP.localidade}, estado=${dadosCEP.uf}]`;
            } else {
                mensagemTexto += `\n[CEP NÃO ENCONTRADO]`;
            }
        }

        if (!conversas.has(chatId)) conversas.set(chatId, []);
        const historico = conversas.get(chatId);
        historico.push({ role: 'user', content: mensagemTexto });
        if (historico.length > 20) historico.splice(0, historico.length - 20);

        await sock.sendPresenceUpdate('composing', chatId).catch(() => {});
        const resposta = await chamarGemini(historico);
        historico.push({ role: 'model', content: resposta });

        // Pausa proporcional ao tamanho da resposta (mín 2s, máx 6s)
        const pausaMs = Math.min(6000, Math.max(2000, resposta.length * 25));
        await new Promise(r => setTimeout(r, pausaMs));

        await sock.sendPresenceUpdate('paused', chatId).catch(() => {});

        if (resposta.includes('[FINALIZADO]')) {
            const dados = parsearDadosCadastro(resposta);
            if (!dados) {
                await enviarTexto(chatId, 'Desculpe, houve um problema ao processar seus dados. Pode tentar novamente? 🙏');
                return;
            }

            const mensagemFinal = getMensagemPosJson(resposta);
            const resultado = await cadastrarPaciente({ evento_id: eventoIdAtivo, ...dados, whatsapp_chat_id: chatId });

            if (!resultado.sucesso) {
                const erroMsg = resultado.erro || 'As vagas para o dia selecionado podem estar esgotadas.';
                await enviarTexto(chatId, `😔 Ops! Não conseguimos finalizar seu cadastro.\n\n${erroMsg}\n\nNossa equipe irá verificar o ocorrido e entrará em contato em breve. Pedimos desculpas pelo transtorno. 🙏`);
                conversas.delete(chatId);
                return;
            }

            const { senha, pdf_base64, pdf_filename } = resultado;
            await enviarTexto(chatId, `${mensagemFinal}\n\n✅ *Cadastro confirmado!*\n📋 Sua senha de atendimento é: *${senha}*\n\nGuarde este número! Enviando seu comprovante... 📄`);

            if (pdf_base64) {
                await enviarArquivo(chatId, pdf_base64, pdf_filename || `Comprovante_Senha_${senha}.pdf`, `📋 Comprovante de Cadastro - Senha ${senha}`);
            }

            conversas.delete(chatId);
            console.log(`[${chatId}] Cadastro concluído: ${dados.nome} | Senha ${senha}`);
        } else {
            await enviarTexto(chatId, resposta);
        }

    } catch (err) {
        console.error(`[${chatId}] Erro:`, err.message);
        await enviarTexto(chatId, 'Desculpe, ocorreu um erro. Por favor, tente novamente em instantes. 🙏').catch(() => {});
    }
}

async function conectarWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_baileys');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger,
        printQRInTerminal: true,
        browser: ['AnaBot', 'Safari', '16.0'],
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            ultimoQR = qr;
            qrTerminal.generate(qr, { small: true });
            console.log('\n📱 Escaneie o QR code acima com o WhatsApp Business\n');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`Conexão encerrada (código ${statusCode}). Reconectando: ${shouldReconnect}`);
            if (shouldReconnect) {
                setTimeout(conectarWhatsApp, 5000);
            } else {
                console.log('Sessão encerrada. Delete a pasta auth_baileys e reinicie para reconectar.');
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp conectado!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!msg.message) continue;
            if (msg.key.remoteJid?.includes('@g.us')) continue;

            const chatId = msg.key.remoteJid;
            const texto = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

            // Comandos de admin (mensagens enviadas por você)
            if (msg.key.fromMe && texto.startsWith('!')) {
                const cmd = texto.trim().toLowerCase();
                if (cmd === '!pausa') {
                    conversasPausadas.add(chatId);
                    conversas.delete(chatId);
                    console.log(`[ADMIN] Bot pausado para ${chatId}`);
                    await sock.sendMessage(chatId, { text: '⏸️ Bot pausado. Você está no controle. Digite !retoma para reativar.' }).catch(() => {});
                } else if (cmd === '!retoma') {
                    conversasPausadas.delete(chatId);
                    console.log(`[ADMIN] Bot retomado para ${chatId}`);
                    await sock.sendMessage(chatId, { text: '▶️ Bot reativado. Olá! Posso ajudar você com o cadastro? 😊' }).catch(() => {});
                } else if (cmd === '!limpa') {
                    conversas.delete(chatId);
                    conversasPausadas.delete(chatId);
                    console.log(`[ADMIN] Histórico limpo para ${chatId}`);
                } else if (cmd === '!status') {
                    const pausadas = [...conversasPausadas].join('\n') || 'nenhuma';
                    const ativas = [...conversas.keys()].join('\n') || 'nenhuma';
                    await sock.sendMessage(chatId, { text: `📊 *Status do Bot*\n\nEvento ativo: id=${eventoIdAtivo}\nConversas ativas:\n${ativas}\n\nPausadas:\n${pausadas}` }).catch(() => {});
                }
                continue;
            }

            if (msg.key.fromMe) continue;

            // Ignora pacientes com bot pausado
            if (conversasPausadas.has(chatId)) {
                console.log(`[MSG] ${chatId} (bot pausado — ignorando)`);
                continue;
            }

            console.log(`[MSG] De: ${chatId}`);
            processarMensagem(msg).catch(err => {
                console.error(`[${chatId}] Erro não tratado:`, err.message);
            });
        }
    });
}

app.get('/qr', async (req, res) => {
    if (!ultimoQR) return res.send('<html><body style="font-family:sans-serif;text-align:center;padding:50px"><h2>QR não disponível</h2><p>Aguarde o agente iniciar ou já está conectado.</p></body></html>');
    try {
        const qrImage = await QRCode.toDataURL(ultimoQR);
        res.send(`<html><body style="background:#111;text-align:center;padding:40px"><img src="${qrImage}" style="width:280px;height:280px;border:10px solid white;border-radius:8px"/><p style="color:white;font-size:18px;margin-top:20px">Escaneie com o WhatsApp Business</p><p style="color:#aaa">Configurações → Dispositivos vinculados → Vincular dispositivo</p></body></html>`);
    } catch (e) {
        res.status(500).send('Erro ao gerar QR');
    }
});

app.get('/health', (req, res) => res.json({
    status: 'ok',
    whatsapp: sock ? 'conectado' : 'desconectado',
    conversas_ativas: conversas.size,
    dia1: dataDia1,
    dia2: dataDia2
}));

carregarDatasEvento();
setInterval(carregarDatasEvento, 60 * 60 * 1000);

conectarWhatsApp().catch(err => console.error('Erro ao iniciar WhatsApp:', err));

app.listen(PORTA, () => {
    console.log(`🤖 Agente WhatsApp (Baileys) rodando na porta ${PORTA}`);
});
