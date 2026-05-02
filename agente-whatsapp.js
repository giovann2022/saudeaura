const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORTA = process.env.AGENTE_PORT || 3001;
const EVOLUTION_URL = process.env.EVOLUTION_API_URL || 'https://evolution.cinecarneiro.online';
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY || 'carneiro2026';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'gio';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CADASTRO_API_URL = process.env.CADASTRO_API_URL || 'http://localhost:3000';
const CADASTRO_API_KEY = process.env.N8N_WEBHOOK_KEY || 'saudeaura_n8n_2026_secret';
const EVENTO_ID = parseInt(process.env.EVENTO_ID_ATIVO) || 1;

const conversas = new Map();

const EVOLUTION_HEADERS = { apikey: EVOLUTION_KEY, 'Content-Type': 'application/json' };

// Datas do evento — preenchidas no startup e atualizadas a cada hora
let dataDia1 = 'Dia 1';
let dataDia2 = 'Dia 2';

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
        const evento = resp.data.find(e => e.id === EVENTO_ID);
        if (evento) {
            const d1 = formatarData(evento.data_dia1);
            const d2 = formatarData(evento.data_dia2);
            if (d1) dataDia1 = `Dia 1 (${d1})`;
            if (d2) dataDia2 = `Dia 2 (${d2})`;
            console.log(`📅 Datas carregadas: ${dataDia1} | ${dataDia2}`);
        }
    } catch (err) {
        console.warn('⚠️  Não foi possível carregar datas do evento:', err.message);
    }
}

function gerarSystemPrompt() {
    return `Você é a Ana, voluntária da equipe de cadastro do Saúde Aura. Você faz os cadastros para o evento de atendimento espiritual pelo WhatsApp.

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
"Olá! 😊 Sou a Ana, estou ajudando a Eliete com os cadastros para o evento de atendimento espiritual, tudo bem?
Para começar, qual é o seu nome completo?"

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

    const resp = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
            system_instruction: { parts: [{ text: gerarSystemPrompt() }] },
            contents,
            generationConfig: { temperature: 0.4 }
        },
        { timeout: 30000 }
    );

    return resp.data.candidates[0].content.parts[0].text;
}

async function transcreverAudio(base64Audio, mimeType) {
    const resp = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
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

async function baixarAudio(messageKey) {
    const resp = await axios.post(
        `${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE}`,
        { message: { key: messageKey } },
        { headers: EVOLUTION_HEADERS, timeout: 15000 }
    );
    return { base64: resp.data.base64, mimeType: resp.data.mimetype || 'audio/ogg' };
}

async function enviarTexto(chatId, texto) {
    await axios.post(
        `${EVOLUTION_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
        { number: chatId, text: texto },
        { headers: EVOLUTION_HEADERS, timeout: 10000 }
    );
}

async function enviarArquivo(chatId, pdfBase64, filename, caption) {
    await axios.post(
        `${EVOLUTION_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`,
        {
            number: chatId,
            mediatype: 'document',
            mimetype: 'application/pdf',
            media: pdfBase64,
            caption,
            fileName: filename
        },
        { headers: EVOLUTION_HEADERS, timeout: 15000 }
    );
}

async function marcarLido(chatId, messageId) {
    await axios.post(
        `${EVOLUTION_URL}/chat/markMessageAsRead/${EVOLUTION_INSTANCE}`,
        { readMessages: [{ id: messageId, fromMe: false, remoteJid: chatId }] },
        { headers: EVOLUTION_HEADERS, timeout: 5000 }
    ).catch(() => {});
}

async function iniciarDigitacao(chatId) {
    await axios.post(
        `${EVOLUTION_URL}/chat/sendPresence/${EVOLUTION_INSTANCE}`,
        { number: chatId, options: { delay: 1200, presence: 'composing' } },
        { headers: EVOLUTION_HEADERS, timeout: 5000 }
    ).catch(() => {});
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

// Webhook principal — recebe mensagens do Evolution API
app.post('/webhook/whatsapp', async (req, res) => {
    res.sendStatus(200);

    const body = req.body;
    if (body?.event !== 'messages.upsert') return;

    const data = body?.data;
    if (!data) return;
    if (data.key?.fromMe) return;

    const chatId = data.key?.remoteJid;
    const messageId = data.key?.id;
    const messageType = data.messageType;

    if (!chatId) return;
    if (chatId.includes('@g.us')) return; // ignorar grupos

    let mensagemTexto = '';

    try {
        await marcarLido(chatId, messageId);

        if (messageType === 'audioMessage' || messageType === 'pttMessage') {
            const { base64, mimeType } = await baixarAudio(data.key);
            mensagemTexto = await transcreverAudio(base64, mimeType);
            console.log(`[${chatId}] Áudio transcrito: ${mensagemTexto.substring(0, 80)}...`);
        } else if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
            mensagemTexto = data.message?.conversation || data.message?.extendedTextMessage?.text || '';
        } else {
            return;
        }

        if (!mensagemTexto.trim()) return;

        // Detectar CEP na mensagem e enriquecer com dados do ViaCEP
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

        await iniciarDigitacao(chatId);
        const resposta = await chamarGemini(historico);
        historico.push({ role: 'model', content: resposta });

        if (resposta.includes('[FINALIZADO]')) {
            const dados = parsearDadosCadastro(resposta);
            if (!dados) {
                await enviarTexto(chatId, 'Desculpe, houve um problema ao processar seus dados. Pode tentar novamente? 🙏');
                return;
            }

            const mensagemFinal = getMensagemPosJson(resposta);
            const resultado = await cadastrarPaciente({ evento_id: EVENTO_ID, ...dados, whatsapp_chat_id: chatId });

            if (!resultado.sucesso) {
                const erroMsg = resultado.erro || 'As vagas para o dia selecionado podem estar esgotadas.';
                await enviarTexto(chatId, `😔 Ops! Não conseguimos finalizar seu cadastro.\n\n${erroMsg}\n\nPor favor, entre em contato pelo número oficial do Saúde Aura. Pedimos desculpas pelo transtorno. 🙏`);
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
});

app.get('/health', (req, res) => res.json({ status: 'ok', conversas_ativas: conversas.size, dia1: dataDia1, dia2: dataDia2 }));

// Carregar datas no startup e atualizar a cada hora
carregarDatasEvento();
setInterval(carregarDatasEvento, 60 * 60 * 1000);

app.listen(PORTA, () => {
    console.log(`🤖 Agente WhatsApp rodando na porta ${PORTA}`);
    console.log(`   Webhook: POST http://localhost:${PORTA}/webhook/whatsapp`);
    console.log(`   Evolution API: ${EVOLUTION_URL} | Instância: ${EVOLUTION_INSTANCE}`);
});
