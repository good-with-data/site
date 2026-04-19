# GWD Chatbot — "Get in touch" Implementation Plan

## Overview
Add a chat modal to the Hugo site triggered by the "Get in touch" buttons.
A Node.js/Express API handles MistralAI calls (RAG + chat) and email via SMTP.
Developed locally, deployed to the GWD Ubuntu server.

## Stack
- **Frontend:** Vanilla JS modal in Hugo (Bootstrap 5 — already in theme)
- **Backend:** Node.js + Express (`chatbot-api/`)
- **LLM:** MistralAI JS SDK (`@mistralai/mistralai`) — chat + embeddings
- **RAG:** Manual cosine similarity (no LlamaIndex — officially deprecated March 2026)
- **Email:** Nodemailer via SMTP using `hello@goodwithdata.org.uk`

## Workspace Layout
```
site/                        ← Hugo site (existing)
chatbot-api/                 ← new, alongside site/
  src/
    index.js                 ← Express server, /chat and /contact routes
    rag.js                   ← cosine similarity RAG
    email.js                 ← Nodemailer SMTP
  knowledge/
    content.json             ← pre-embedded GWD content chunks
    build-index.js           ← one-off script: markdown → embeddings → content.json
  .env                       ← MISTRAL_API_KEY + SMTP creds (never committed)
  .env.example
  package.json
```

## API Routes
| Route | Input | Output |
|---|---|---|
| `POST /chat` | `{ message, history[] }` | `{ reply }` |
| `POST /contact` | `{ name, email, message }` | `{ ok }` + sends 2 emails |

## Conversation Flow
1. User clicks "Get in touch" → modal opens
2. Bot: *"Hi! I can answer questions about Good With Data CIC, or help you get in touch."*
3. **Question path:** RAG lookup → MistralAI answer → multi-turn via `history[]`
4. **Contact path:** collect name, email, message → `POST /contact` → emails sent to GWD and user

## System Prompt
The following system prompt is passed to MistralAI on every `/chat` request to constrain the model to GWD knowledge and prevent hallucination:

> You are a helpful assistant for Good With Data CIC, a non-profit community interest company that provides data-focused consultancy to NGOs and the charity sector. Answer questions only using the context provided below. If the answer is not in the context, say you don't know and suggest the user contact the team directly at hello@goodwithdata.org.uk. Do not invent or assume information about the company.

## Content Used in RAG Index
- `content/what_we_do.md`
- `content/who_we_are.md`
- `content/_index.md`
- Optional: hidden FAQ file (not rendered by Hugo, only used by chatbot)

## Email Behaviour
- **To GWD:** notification with user's name, email, message, and conversation log
- **To user:** acknowledgement + GWD email address (`hello@goodwithdata.org.uk`)

## Build Phases

### Phase 1 — API Backend
1. Scaffold `chatbot-api/` — create `package.json`, install dependencies:
   `express`, `@mistralai/mistralai`, `nodemailer`, `express-rate-limit`, `dotenv`
2. Write `knowledge/build-index.js` — reads `what_we_do.md`, `who_we_are.md`, `_index.md`, calls MistralAI embeddings API, writes `knowledge/content.json`
3. Write `src/rag.js` — embeds the user's query, runs cosine similarity against all chunks in `content.json`, returns top-2 matching passages
4. Write `src/email.js` — Nodemailer via SMTP: sends notification to GWD and acknowledgement to user
5. Write `src/index.js` — Express app with:
   - `POST /chat` — RAG lookup + MistralAI chat completion with system prompt
   - `POST /contact` — input validation + email sending
   - CORS locked to `goodwithdata.org.uk` + `localhost:1313`
   - Rate limiting middleware
6. Run `node knowledge/build-index.js` to generate the knowledge index
7. Test with `curl` or Postman before moving to the frontend

### Phase 2 — Frontend Chat Modal (Hugo site)
8. Create `layouts/partials/chat-modal.html` — Bootstrap 5 modal (theme already includes Bootstrap), with:
   - Chat message thread area
   - Input field + send button
   - Contact form (name, email, message) shown when user wants to get in touch
   - GDPR consent notice shown before contact form
9. Create `assets/js/chat.js` — vanilla JS handling:
   - Open/close modal
   - Send message via `fetch('POST /chat')` with conversation `history[]` array
   - Render bot replies
   - Switch to contact form flow
   - Submit contact form via `fetch('POST /contact')`
10. Edit `themes/up-business-theme/layouts/_default/baseof.html` — call `{{ partial "chat-modal.html" . }}` near `</body>`
11. Edit `themes/up-business-theme/layouts/partials/shared/header.html` — intercept navbar "Get in touch" button click to open modal instead of navigating to `/#contact`
12. Edit `themes/up-business-theme/layouts/partials/sections/hero.html` — intercept hero "Get in touch" button click to open modal instead of firing the `mailto:` link (currently set via `data/home/hero.yaml`)
13. Edit `themes/up-business-theme/assets/js/shared/shared.js` — import `chat.js`

### Phase 3 — Local Integration Test
14. Run `hugo server` on `:1313` and `node src/index.js` on `:3000` simultaneously
15. Work through the full verification checklist below

> Server deployment (Phase 4) is only needed when going live. Phases 1–3 run entirely locally.

## Hugo Changes
| File | Change |
|---|---|
| `themes/.../layouts/_default/baseof.html` | Inject chat modal partial near `</body>` |
| `themes/.../layouts/partials/shared/header.html` | Intercept navbar button click |
| `themes/.../layouts/partials/sections/hero.html` | Intercept hero button click (replaces `mailto:` link) |
| `themes/.../assets/js/shared/shared.js` | Import `chat.js` |
| `layouts/partials/chat-modal.html` | New: modal HTML |
| `assets/js/chat.js` | New: modal logic, fetch calls, history management |

## Security
- API key and SMTP credentials in `.env` only — never in browser JS
- CORS restricted to `https://goodwithdata.org.uk` + `http://localhost:1313` (dev)
- Rate limiting via `express-rate-limit`
- Input validation on all POST body fields

## GDPR
- Consent notice shown in modal before collecting name/email
- No conversation logs stored server-side
- Privacy policy update required (to be handled separately)

## Local Development
- Hugo: `hugo server` → `http://localhost:1313`
- API: `node src/index.js` → `http://localhost:3000`
- API URL in chat widget: `localhost:3000` (dev) → `api.goodwithdata.org.uk` (prod)

## Server Deployment
- Server: Ubuntu, Node.js installed
- Run API with `pm2` for process management
- Set up subdomain `api.goodwithdata.org.uk` pointing to the server
- Set environment variables on server (not via `.env` file)

## Rebuild RAG Index
Run `node knowledge/build-index.js` whenever site content changes.
This can be added as a step in a GitHub Actions deploy workflow.

## Verification Checklist
- [ ] `node build-index.js` completes, `content.json` contains embeddings
- [ ] `curl -X POST localhost:3000/chat -d '{"message":"what do you do?","history":[]}'` returns relevant answer
- [ ] Chat modal opens on button click on all pages
- [ ] Multi-turn conversation maintains context
- [ ] Contact form sends both emails correctly
- [ ] DevTools Network tab shows no API key
- [ ] >20 rapid requests returns 429 rate limit response
