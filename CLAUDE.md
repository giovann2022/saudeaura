# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Patient-registration system for spiritual-care events ("Saúde Aura"). Two Node.js
processes plus a React panel, all deployed to an Oracle Cloud VPS. End users registering
via WhatsApp are mostly elderly, so the bot flow is deliberately one-question-at-a-time.

## Commands

Backend (repo root):
- `npm run dev` — runs **only** `server.js` (the API) via nodemon. There is no npm script
  for the WhatsApp agent; start it separately with `node agente-whatsapp.js`.
- No test suite exists (`npm test` just errors out).
- **Undeclared agent deps:** `agente-whatsapp.js` requires `@whiskeysockets/baileys`,
  `pino`, `qrcode`, and `qrcode-terminal`, none of which are in `package.json` /
  `package-lock.json` (they were installed manually on the VPS). It also calls Gemini via
  the raw REST endpoint (axios → `generativelanguage.googleapis.com`), not an SDK. So the
  agent won't run from a fresh `npm install` locally without installing those four packages
  by hand.

Frontend (`cd frontend`):
- `npm run dev` — Vite dev server (talks to `http://localhost:3000` directly)
- `npm run build` — production build into `frontend/dist`
- `npm run lint` — ESLint
- `npm run preview` — preview a production build

## Architecture

Three pieces that talk to each other:

1. **`server.js`** — Express API on port 3000. JWT auth, bcrypt passwords, CRUD for
   `eventos` / `pacientes` / `usuarios`. Talks to PostgreSQL via `db.js` (pg Pool, all
   config from `.env`).
2. **`agente-whatsapp.js`** — standalone process on port 3001. Connects to WhatsApp via
   **Baileys** (QR code, session in `./auth_baileys/`), runs an AI registration assistant
   on **Gemini 2.5 Flash**. It does NOT touch the DB directly — it POSTs to the API's
   `/api/webhook/n8n` endpoint using an `x-api-key` header.
3. **`frontend/`** — React 19 + Vite SPA (management panel). React Router with a
   `RequireAuth` wrapper; token in `localStorage`. Pages: Login, Dashboard, Cadastro,
   Triagem, Conferencia, Configuracoes.

`pdfRecibo.js` (server, pdfkit) and `frontend/src/services/pdfService.js` (client, jspdf)
generate the **same** comprovante/receipt layout in two places — keep them in sync when
changing the PDF.

### Two routing conventions you must respect

In production, nginx **strips the `/api/` prefix** before forwarding to port 3000:
- API routes in `server.js` are defined WITHOUT `/api/` (e.g. `/eventos`, `/pacientes`,
  `/login`). The frontend's `api.js` interceptor prepends `/api` only in PROD builds; in
  dev it hits `localhost:3000` with no prefix.
- **Exception:** webhook routes (`/api/webhook/n8n`, `/api/webhook/n8n/eventos`) keep the
  literal `/api/` in their path because the WhatsApp agent calls them server-to-server, not
  through the nginx strip.

So: a new frontend-facing route → no `/api/` prefix in `server.js`. A new agent-facing
route → include `/api/` literally.

### Auth model

`app.use(verificarToken)` is a hard divider in `server.js`. Routes declared **above** it
are public (`/login`, `/qr`, `/migrar-senhas`, `/reparar-banco`, the webhook endpoints with
their own `x-api-key` check). Everything **below** requires a Bearer JWT. Admin-only
mutations additionally check `req.user.perfil === 'admin'`.

### Domain rules (senhas & vagas)

- `senha_atendimento` is a per-event, per-day sequential ticket number, computed as
  `MAX(senha)+1` for that `evento_id`+`dia_atendimento`.
- `tipo_tratamento === 'Socorro Espiritual'` is special: it gets **no senha** (null) and
  does **not** count against the day's `vagas` (slot capacity). All vagas/senha logic
  branches on this string — match it exactly.
- Editing a patient (`PUT /pacientes/:id`) re-issues a new senha only when day/event/type
  changed in a way that requires it; otherwise it preserves the existing senha.
- `preferencial` (priority flag) and `entregue` (receipt-delivered flag) are toggled via
  dedicated routes `PUT /pacientes/:id/preferencial` and `PUT /pacientes/:id/entregue`,
  not the main PUT. Both are boolean columns on `pacientes`.
- DB column note: the API accepts `rua` in the request body but the column is named
  `endereco` — the INSERT/UPDATE statements map `rua` → `endereco`.

### WhatsApp agent specifics

- Bot persona is **"Eliéte"**, a volunteer. Never reveal it's a bot, never say the words
  "Saúde Aura" to patients. Flow: greet → nome → nascimento → telefone → CEP (ViaCEP
  lookup) → dia → tipo → queixas → confirm → register → send PDF.
- Active `evento_id` is loaded from the DB at startup (and refreshed hourly), falling back
  to the most recent event if `EVENTO_ID_ATIVO` doesn't exist.
- Audio messages are transcribed via Gemini; CEPs detected in text trigger a ViaCEP lookup
  that's injected back into the prompt.
- Admin commands, sent by the operator from their own phone in a patient chat (`fromMe`
  messages starting with `!`): `!pausa`, `!retoma`, `!limpa`, `!status`. The command
  message is auto-deleted so the patient doesn't see it.

## Deployment

- VPS at `/var/www/saudeaura`, managed by **PM2** (`api-saudeaura` :3000,
  `agente-whatsapp` :3001). Domain `saudeaura.site` behind Cloudflare HTTPS.
- The frontend is **built locally** and `frontend/dist` is **committed to git** (force-added
  despite `frontend/.gitignore` ignoring `dist`). Deploy is `git pull` on the VPS — do NOT
  run `npm run build` on the VPS.
- After changing `agente-whatsapp.js`, `pm2 restart agente-whatsapp` on the VPS.
- If `git pull` complains about overwriting local changes, `git checkout <file>` the
  conflicting tracked file first (commonly `frontend/dist/*` or `frontend/src/services/api.js`).

## Notes

- `triagem-carneiro-matos/` is a **separate git repo**, gitignored, and not part of this
  project's working tree — ignore it.
- `.env` holds DB credentials, `JWT_SECRET`, `GEMINI_API_KEY`, `N8N_WEBHOOK_KEY`,
  `EVENTO_ID_ATIVO`, ports. Code falls back to hardcoded defaults for the secrets when env
  vars are absent.
- `/migrar-senhas` and `/reparar-banco` are one-off, unauthenticated DB-maintenance GET
  routes left in `server.js`.
