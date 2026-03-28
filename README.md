# RomainGE

**Plataforma de Gestion Fiscal con IA para Espana**

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Claude API](https://img.shields.io/badge/Claude%20API-Sonnet%204-blueviolet)](https://docs.anthropic.com/)
[![Twilio](https://img.shields.io/badge/Twilio-Voice%20%2B%20WhatsApp-F22F46?logo=twilio&logoColor=white)](https://www.twilio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

RomainGE is an AI-powered fiscal management platform built for Spain. It combines 39 specialized AI agents with real-time voice calling, web chat, and WhatsApp to help citizens and businesses navigate the Spanish tax system (AEAT, CNMC). Available at [romainge.com](https://romainge.com).

---

## Features

### AI Fiscal Agents

- **39 specialized agents** covering IRPF, IVA, customs, certificates, census, collections, and more
- Intelligent classifier routes queries to the right agent (keyword match first, Claude fallback)
- Each agent has its own system prompt with domain-specific fiscal knowledge
- Responses tuned per channel: concise for voice (3-5 sentences), detailed for web chat

### Voice & Messaging

- **Real-time voice calls** via Twilio ConversationRelay (bidirectional WebSocket)
- Automatic language detection: Castellano, Catalan, Euskera, Gallego
- NIF/NIE/CIF validation by voice dictation
- DTMF fallback menu for touch-tone navigation
- Call queue with callback support when capacity is full
- Call recording with prior consent
- **WhatsApp chatbot** integration
- **Web chat** with streaming responses (SSE + WebSocket)

### Tax Tools & Simulators

- **Renta 2025 simulator** with deductions for all 17 autonomous communities
- Electronic invoicing support (TicketBAI + Verifactu)
- SII (Suministro Inmediato de Informacion) integration
- Tax form generator: Modelos 036, 303, 390
- Smart FAQ that learns from frequently asked questions
- Fiscal calendar with ICS export and Google Calendar sync
- AEAT web scraper for up-to-date deadlines
- Tax advisor comparator by geographic zone
- Electronic signature (FNMT certificate) support

### Admin & Analytics

- Full **admin dashboard** with Recharts-based analytics
- Call history with per-service statistics and heatmap by autonomous community
- Real-time Claude API latency monitoring (P50/P95/P99)
- Cost tracking panel (Claude tokens + Twilio minutes)
- Call transcription viewer and manual tagging system
- Post-call satisfaction surveys (1-5 scale + NPS)
- CSV/Excel export for calls and costs
- Email alerts when call queue exceeds thresholds

### Platform

- **Multi-tenant** architecture for tax advisory firms
- Public API (v1) with API key authentication
- PWA with push notifications and offline support
- Dark/light theme toggle
- 4 languages: Spanish, Catalan, Basque, Galician
- Embeddable chat widget (vanilla JS)
- Full-text search across conversations (PostgreSQL tsvector)
- Document upload and storage (local/S3)

---

## Tech Stack

| Layer        | Technology                                          |
| ------------ | --------------------------------------------------- |
| **Backend**  | Node.js 20+, Express.js, WebSocket (ws)             |
| **Frontend** | React 18, Vite 6, Recharts                          |
| **AI**       | Anthropic Claude API (claude-sonnet-4-20250514)      |
| **Voice**    | Twilio Programmable Voice, ConversationRelay         |
| **Database** | PostgreSQL 16 (Prisma ORM), Redis 7 (cache/sessions)|
| **Auth**     | JWT with refresh tokens, AES-256-GCM encryption     |
| **Testing**  | Vitest, Playwright, Artillery, Supertest             |
| **Deploy**   | Vercel (frontend), Railway (backend), Docker         |

---

## Quick Start

### Prerequisites

- Node.js 20 or higher
- npm 9+
- PostgreSQL 16 (optional -- falls back to in-memory for dev)
- Redis 7 (optional -- falls back to LRU cache for dev)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/romainge.git
cd romainge

# Install all dependencies (backend + frontend)
npm run install:all

# Configure environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys (see Environment Variables below)

# Start development servers (backend :3001, frontend :3000)
npm run dev
```

### Docker Alternative

```bash
# Start the full stack with Docker Compose
docker compose up -d --build

# View logs
docker compose logs -f backend

# Stop everything
docker compose down
```

The Docker setup includes the backend API server, Redis for caching/sessions, and the frontend dev server. PostgreSQL can be enabled by uncommenting the relevant section in `docker-compose.yml`.

### Environment Variables

Create `backend/.env` with the following:

```env
ANTHROPIC_API_KEY=sk-ant-xxxxx          # Required: Claude API key
CLAUDE_MODEL=claude-sonnet-4-20250514    # Claude model to use
TWILIO_ACCOUNT_SID=ACxxxxx              # Twilio credentials (for voice)
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+34900000000
BASE_URL=https://api.romainge.com
API_SECRET=<random-32-chars>            # Secret for admin/internal endpoints
SESSION_ENCRYPTION_KEY=<random-32-chars> # AES-256 encryption key
PORT=3001
NODE_ENV=development
REDIS_URL=redis://localhost:6379        # Optional
DATABASE_URL=postgresql://...           # Optional (Prisma)
STT_LANGUAGE=es-ES
TTS_VOICE=Polly.Lucia-Neural
SPEECH_TIMEOUT=3
```

---

## Architecture

```
                          +------------------+
                          |    Browser /      |
                          |    Mobile PWA     |
                          +--------+---------+
                                   |
                          HTTPS / WSS
                                   |
                  +----------------v-----------------+
                  |       Frontend (Vite + React)     |
                  |       Port 3000 / Vercel          |
                  |  - App.jsx (SPA)                  |
                  |  - AdminDashboard.jsx (Recharts)  |
                  |  - ChatWidget.jsx (embeddable)    |
                  +----------------+-----------------+
                                   |
                            REST / SSE / WS
                                   |
     +------------+   +------------v--------------+   +-------------+
     |            |   |   Backend (Express.js)     |   |             |
     |   Twilio   +-->+   Port 3001 / Railway      +<->+ PostgreSQL  |
     |   Voice    |   |                            |   |  (Prisma)   |
     |   API      |   |  - 39 AI Agent Engine      |   +-------------+
     |            |   |  - Voice Relay (WS)        |
     +------------+   |  - JWT Auth + Encryption   |   +-------------+
                      |  - Session Management      +<->+    Redis    |
     +------------+   |  - Admin Routes            |   |   (Cache)   |
     |  Claude    +<--+  - Multi-tenant Engine     |   +-------------+
     |  API       |   |                            |
     +------------+   +----------------------------+

  Voice Call Flow:
  Phone --> Twilio --> POST /api/voice/incoming (TwiML)
                   --> WebSocket /voice-relay (ConversationRelay)
                       |-> Speech-to-Text (es-ES)
                       |-> Agent classification + Claude response
                       |-> Text-to-Speech (Polly.Lucia-Neural)
```

---

## API Overview

### Voice Webhooks (Twilio)

```
POST /api/voice/incoming           # TwiML response with ConversationRelay
POST /api/voice/dtmf-menu          # DTMF fallback menu
POST /api/voice/dtmf-select        # Service selection by touch-tone
POST /api/voice/callback-connect   # Return call to user
GET  /api/voice/queue-stats        # Call queue capacity
WS   /voice-relay                  # Bidirectional voice relay
```

### Sessions & Authentication

```
POST /api/sessions/login           # Login with session key + phone
POST /api/sessions/refresh         # Rotate refresh token
POST /api/sessions/logout          # End session
POST /api/sessions/verify-phone    # Send SMS verification code
POST /api/sessions/verify-code     # Validate SMS code
GET  /api/sessions/:id/messages    # Retrieve conversation history
POST /api/sessions/:id/chat        # Send message to AI agent
GET  /api/sessions/:id/chat-stream # SSE streaming responses
POST /api/sessions/:id/documents   # Upload documents
```

### Admin Dashboard

```
POST /api/admin/login              # Admin authentication
GET  /api/admin/dashboard          # Overview with all metrics
GET  /api/admin/calls              # Paginated call history
GET  /api/admin/calls/by-service   # Stats by service
GET  /api/admin/calls/chart        # Chart data (hour/day/week)
GET  /api/admin/costs              # Claude + Twilio cost breakdown
GET  /api/admin/latency            # Real-time P50/P95/P99
GET  /api/admin/satisfaction       # Survey results and NPS
GET  /api/admin/heatmap            # Calls by autonomous community
GET  /api/admin/export/calls       # CSV/Excel export
GET  /api/admin/export/costs       # CSV cost export
GET  /api/admin/audit-log          # Access audit trail
```

### Multi-Tenant

```
POST /api/tenants                  # Create a tax advisory firm
GET  /api/tenants                  # List all tenants
GET  /api/tenants/:idOrSlug        # Tenant details + stats
PUT  /api/tenants/:id              # Update tenant
PUT  /api/tenants/:id/agents/:svc  # Customize agent for tenant
GET  /api/tenants/:id/agents       # List tenant agents
```

### Other

```
GET  /api/services                 # List all 39 services
POST /api/renta/simulate           # IRPF simulation
GET  /api/search?q=...             # Full-text search (PostgreSQL)
GET  /api/health                   # Health check
```

### WebSocket

```
ws://host/ws
-> { type: "auth", sessionId: "xxx" }
<- { type: "auth_ok" }
-> { type: "chat", text: "my question" }
<- { type: "chunk", text: "..." }
<- { type: "done", text: "full response" }
```

---

## Testing

The project includes comprehensive test coverage across unit, integration, E2E, and load testing.

```bash
# Backend unit tests (154 tests)
cd backend && npm test

# Backend with coverage report (v8)
cd backend && npm run test:coverage

# Frontend unit tests (19 tests, includes snapshots)
cd frontend && npm test

# Update frontend snapshots
cd frontend && npm run test:update

# E2E tests with Playwright
cd e2e && npx playwright test
cd e2e && npx playwright test --headed    # With visible browser

# Load tests with Artillery (ramp up to 500 req/s)
cd backend && npm run test:load
```

**What is tested:**

- Classifier accuracy for all 39 services
- NIF/NIE/CIF validation edge cases
- IRPF simulator with all autonomous communities
- Session management (create, restore, soft-delete)
- Metrics and admin endpoint coverage
- Twilio webhook signature verification
- Claude API mocking (no tokens consumed during tests)
- React component snapshots (theme, i18n, ChatWidget, MarkdownRenderer)
- E2E flows: login, chat, renta simulation, admin dashboard, theme toggle

---

## Deployment

### Vercel + Railway (Recommended)

```bash
# Deploy everything
./deploy.sh all

# Deploy individually
./deploy.sh frontend    # Deploys to Vercel
./deploy.sh backend     # Deploys to Vercel serverless
./deploy.sh railway     # Deploys backend to Railway
```

### Docker

```bash
# Production build and run
docker compose up -d --build

# With PostgreSQL (uncomment the postgres service in docker-compose.yml)
docker compose up -d
```

### Database Migrations (Prisma)

```bash
cd backend
npx prisma migrate deploy     # Apply pending migrations
npx prisma generate            # Regenerate Prisma client
npx prisma studio              # Open database GUI
```

### CI/CD with GitHub Actions

A GitHub Actions pipeline is planned with the following stages:

1. **Lint + Unit Tests** -- on every push to any branch
2. **E2E Tests** -- on pull requests targeting `main`
3. **Staging Deploy** -- automatic on merge to `develop`
4. **Production Deploy** -- manual approval on merge to `main`

---

## Project Structure

```
romainge/
├── README.md
├── CLAUDE.md                       # AI agent instructions
├── package.json                    # Monorepo root (concurrently)
├── deploy.sh                       # Deployment script
├── docker-compose.yml              # Full stack Docker setup
│
├── backend/
│   ├── server.js                   # Express + WebSocket entry point
│   ├── package.json
│   ├── Dockerfile
│   ├── vercel.json
│   ├── .env.example
│   ├── api/
│   │   ├── routes.js               # Voice, sessions, chat, renta endpoints
│   │   └── admin-routes.js         # Admin dashboard endpoints
│   ├── config/
│   │   └── services.js             # 39 services + keyword classifier
│   ├── lib/
│   │   ├── agent-engine.js         # Claude API engine (chat, streaming)
│   │   ├── sessions-adapter.js     # Auto-select PG / Redis / memory
│   │   ├── sessions-pg.js          # PostgreSQL sessions (Prisma, soft-delete)
│   │   ├── sessions-redis.js       # Redis sessions (fallback)
│   │   ├── sessions.js             # In-memory sessions (dev)
│   │   ├── jwt.js                  # JWT auth, refresh tokens, CSRF, rate limit
│   │   ├── encryption.js           # AES-256-GCM message encryption
│   │   ├── admin-auth.js           # Admin dashboard authentication
│   │   ├── twilio-voice.js         # TwiML: ConversationRelay + DTMF
│   │   ├── voice-relay.js          # WebSocket voice handler (bidirectional)
│   │   ├── voice-queue.js          # Call queue + callbacks
│   │   ├── nif-validator.js        # NIF/NIE/CIF validation
│   │   ├── search.js               # Full-text PostgreSQL search (tsvector)
│   │   ├── response-cache.js       # Redis/LRU cache for frequent responses
│   │   ├── metrics.js              # Token, latency, cost tracking
│   │   ├── tenants.js              # Multi-tenant engine
│   │   ├── documents.js            # Document store (local/S3)
│   │   ├── audit-log.js            # Access audit logging
│   │   ├── email-alerts.js         # Queue/latency/cost email alerts
│   │   └── call-history.js         # Call history + per-service stats
│   ├── prompts/
│   │   ├── agents.js               # System prompts for all 39 agents
│   │   └── cnmc-specialist.js      # CNMC real data (sede.cnmc.gob.es)
│   ├── prisma/
│   │   ├── schema.prisma           # DB models (Session, Message, Call, etc.)
│   │   └── migrations/             # SQL migrations (incl. GIN full-text index)
│   ├── scripts/
│   │   └── setup-twilio.js         # Automated Twilio webhook setup
│   └── tests/                      # Vitest + Artillery test suites
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── Dockerfile
│   ├── vite.config.js
│   ├── vercel.json
│   ├── public/
│   │   ├── manifest.json           # PWA manifest
│   │   ├── sw.js                   # Service Worker (cache + push)
│   │   └── widget.js               # Embeddable chat widget (vanilla JS)
│   └── src/
│       ├── main.jsx                # Entry point
│       ├── App.jsx                 # Main application (~1150 lines)
│       ├── AdminDashboard.jsx      # Admin panel (Recharts)
│       ├── ChatWidget.jsx          # Embeddable React widget
│       ├── MarkdownRenderer.jsx    # Markdown + GFM rendering
│       ├── api.js                  # API client (REST, SSE, WebSocket)
│       ├── theme.js                # Dark/light theme system
│       └── i18n.js                 # ES/CA/EU/GL translations
│
└── e2e/                            # Playwright E2E tests
```

---

## Security

RomainGE implements multiple layers of security suitable for handling sensitive fiscal data:

| Measure                  | Details                                                        |
| ------------------------ | -------------------------------------------------------------- |
| **JWT + Refresh Tokens** | Access tokens (30 min) with automatic rotation of refresh tokens (24 h) |
| **AES-256-GCM**         | All stored messages are encrypted at rest                       |
| **CSRF Protection**      | Double-submit cookie pattern (bypassed for Bearer auth and Twilio webhooks) |
| **Rate Limiting**        | IP-based (express-rate-limit) + per-session (15 requests/min)   |
| **Helmet CSP**           | Content-Security-Policy configured for SPA frontend             |
| **One-Time Keys**        | Session access key is consumed on first login                   |
| **Inactivity Timeout**   | Auto-logout after 30 minutes of inactivity                      |
| **Audit Logging**        | All session access events are recorded                          |
| **IP Whitelisting**      | Optional per-session IP restriction                             |
| **SMS Verification**     | Phone verification via Twilio Verify before session creation    |
| **Soft Delete**          | 90-day data retention with recoverable deletion                 |

---

## Contributing

Contributions are welcome. Please follow these guidelines:

1. **Fork** the repository and create a feature branch from `main`
2. **Install** dependencies: `npm run install:all`
3. **Code style**: ESM modules only (`import`/`export`, never CommonJS). React components use inline styles -- no external CSS files.
4. **Test** your changes:
   ```bash
   cd backend && npm test
   cd frontend && npm test
   ```
5. **Commit** with clear, descriptive messages
6. **Open a Pull Request** describing what changed and why

### Key Conventions

- System prompts for agents live in `backend/prompts/agents.js`
- The classifier uses keywords first (fast), then falls back to Claude (accurate)
- Voice responses: max 3-5 sentences. Chat responses: detailed with markdown
- Sessions use a single random word as access key + phone number for authentication
- Production auto-selects PostgreSQL (via `DATABASE_URL`) and Redis (via `REDIS_URL`)

---

## License

This project is licensed under the [MIT License](LICENSE).

---

Built with [Claude](https://anthropic.com) | Powered by [Twilio](https://twilio.com) | Deployed on [Vercel](https://vercel.com) + [Railway](https://railway.app)
