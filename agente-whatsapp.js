const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORTA = process.env.AGENTE_PORT || 3001;
const WAHA_URL = process.env.WAHA_API_URL || 'http://localhost:3000';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CADASTRO_API_URL = process.env.CADASTRO_API_URL || 'http://localhost:3000';
const CADASTRO_API_KEY = process.env.N8N_WEBHOOK_KEY || 'saudeaura_n8n_2026_secret';
const EVENTO_ID = parseInt(process.env.EVENTO_ID_ATIVO) || 1;

// Memória de conversas: chatId → array de mensagens
const conversas = new Map();

const SYSTEM_PROMPT = `Você é a Ana, voluntária da equipe de cadastro do Saúde Aura. Você faz os cadastros para o evento de atendimento espiritual pelo WhatsApp.

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
"Olá! 😊 Aqui é a Ana, da equipe do Saúde Aura. Vou te ajudar com o cadastro para o evento de atendimento espiritual, tudo bem?
Para começar, qual é o seu nome completo?"

ORDEM DA COLETA (siga esta ordem sem pular etapas):
1. Nome Completo
2. Data de Nascimento (formato DD/MM/AAAA)
3. Telefone — confirme o número do WhatsApp: "Posso usar o número que você está me enviando?"
4. Endereço:
   - Pergunte o CEP primeiro
   - Se não souber: Rua, Número, Complemento (opcional), Bairro, Cidade, Estado (sigla)
5. Dia de Atendimento preferido: "Dia 1" ou "Dia 2"
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
- Se queixa2 ou queixa3 não existirem, NÃO as inclua no JSON
- NUNCA invente dados — use APENAS o que a pessoa informou
- Se a pessoa desistir, agradeça e encerre SEM usar [FINALIZADO]`;

async function chamarGemini(mensagens) {
    const contents = mensagens.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
    }));

    const resp = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
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

async function baixarAudio(session, chatId, messageId) {
    const resp = await axios.get(
        `${WAHA_URL}/api/${session}/chats/${chatId}/messages/${messageId}/download`,
        { responseType: 'arraybuffer', timeout: 15000 }
    );
    const buffer = Buffer.from(resp.data);
    const contentType = resp.headers['content-type'] || 'audio/ogg';
    return { base64: buffer.toString('base64'), mimeType: contentType };
}

async function enviarTexto(session, chatId, texto) {
    await axios.post(`${WAHA_URL}/api/sendText`, {
        session,
        chatId,
        text: texto
    }, { timeout: 10000 }).catch(err => {
        // fallback para rota alternativa
        return axios.post(`${WAHA_URL}/api/${session}/sendText`, {
            chatId,
            text: texto
        }, { timeout: 10000 });
    });
}

async function enviarArquivo(session, chatId, pdfBase64, filename, caption) {
    await axios.post(`${WAHA_URL}/api/sendFile`, {
        session,
        chatId,
        file: { mimetype: 'application/pdf', filename, data: pdfBase64 },
        caption
    }, { timeout: 15000 }).catch(() => {
        return axios.post(`${WAHA_URL}/api/${session}/sendFile`, {
            chatId,
            file: { mimetype: 'application/pdf', filename, data: pdfBase64 },
            caption
        }, { timeout: 15000 });
    });
}

async function marcarLido(session, chatId, messageId) {
    await axios.post(`${WAHA_URL}/api/${session}/chats/${chatId}/messages/${messageId}/markSeen`, {}, { timeout: 5000 }).catch(() => {});
}

async function iniciarDigitacao(session, chatId) {
    await axios.post(`${WAHA_URL}/api/${session}/startTyping`, { chatId }, { timeout: 5000 }).catch(() => {});
}

async function pararDigitacao(session, chatId) {
    await axios.post(`${WAHA_URL}/api/${session}/stopTyping`, { chatId }, { timeout: 5000 }).catch(() => {});
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

// Webhook principal — recebe mensagens do WAHA
app.post('/webhook/whatsapp', async (req, res) => {
    res.sendStatus(200); // responder imediatamente ao WAHA

    const body = req.body;
    const event = body?.event;
    const payload = body?.payload;
    const session = body?.session;

    if (!payload || event !== 'message') return;
    if (payload.fromMe) return; // ignorar mensagens do próprio bot

    const chatId = payload._data?.from || payload.from;
    const messageId = payload.id;
    const hasMedia = payload.hasMedia;
    const messageType = payload._data?.type;
    const pushName = payload._data?.notifyName || '';

    if (!chatId) return;

    let mensagemTexto = '';

    try {
        // Marcar como lido
        await marcarLido(session, chatId, messageId);

        if (hasMedia && (messageType === 'ptt' || messageType === 'audio')) {
            // Transcrever áudio
            const { base64, mimeType } = await baixarAudio(session, chatId, messageId);
            mensagemTexto = await transcreverAudio(base64, mimeType);
            console.log(`[${chatId}] Áudio transcrito: ${mensagemTexto.substring(0, 80)}...`);
        } else if (!hasMedia && payload.body) {
            mensagemTexto = payload.body;
        } else {
            return; // ignorar outros tipos de mídia
        }

        // Buscar ou criar histórico da conversa
        if (!conversas.has(chatId)) {
            conversas.set(chatId, []);
        }
        const historico = conversas.get(chatId);
        historico.push({ role: 'user', content: mensagemTexto });

        // Limitar histórico a 20 mensagens (10 pares)
        if (historico.length > 20) {
            historico.splice(0, historico.length - 20);
        }

        // Indicar digitação enquanto o Gemini processa
        await iniciarDigitacao(session, chatId);

        const resposta = await chamarGemini(historico);
        historico.push({ role: 'model', content: resposta });

        await pararDigitacao(session, chatId);

        if (resposta.includes('[FINALIZADO]')) {
            const dados = parsearDadosCadastro(resposta);
            if (!dados) {
                await enviarTexto(session, chatId, 'Desculpe, houve um problema ao processar seus dados. Pode tentar novamente? 🙏');
                return;
            }

            const mensagemFinal = getMensagemPosJson(resposta);

            const resultado = await cadastrarPaciente({
                evento_id: EVENTO_ID,
                ...dados,
                whatsapp_chat_id: chatId
            });

            if (!resultado.sucesso) {
                const erroMsg = resultado.erro || 'As vagas para o dia selecionado podem estar esgotadas.';
                await enviarTexto(session, chatId,
                    `😔 Ops! Não conseguimos finalizar seu cadastro.\n\n${erroMsg}\n\nPor favor, entre em contato pelo número oficial do Saúde Aura. Pedimos desculpas pelo transtorno. 🙏`
                );
                conversas.delete(chatId); // limpar conversa para recomeçar
                return;
            }

            const { senha, pdf_base64, pdf_filename } = resultado;

            // Enviar mensagem de confirmação com senha
            await enviarTexto(session, chatId,
                `${mensagemFinal}\n\n✅ *Cadastro confirmado!*\n📋 Sua senha de atendimento é: *${senha}*\n\nGuarde este número! Enviando seu comprovante... 📄`
            );

            // Enviar PDF
            if (pdf_base64) {
                await enviarArquivo(session, chatId, pdf_base64, pdf_filename || `Comprovante_Senha_${senha}.pdf`, `📋 Comprovante de Cadastro - Senha ${senha}`);
            }

            conversas.delete(chatId); // limpar conversa após cadastro concluído
            console.log(`[${chatId}] Cadastro concluído: ${dados.nome} | Senha ${senha}`);
        } else {
            await enviarTexto(session, chatId, resposta);
        }

    } catch (err) {
        console.error(`[${chatId}] Erro:`, err.message);
        await pararDigitacao(session, chatId).catch(() => {});
        await enviarTexto(session, chatId, 'Desculpe, ocorreu um erro. Por favor, tente novamente em instantes. 🙏').catch(() => {});
    }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', conversas_ativas: conversas.size }));

app.listen(PORTA, () => {
    console.log(`🤖 Agente WhatsApp rodando na porta ${PORTA}`);
    console.log(`   Webhook: POST http://localhost:${PORTA}/webhook/whatsapp`);
    console.log(`   Configurar no WAHA: aponte o webhook para esta URL`);
});
