# RomainGE — Plataforma de Gestión Fiscal con IA (España)

## Descripción

Plataforma web + central telefónica IA para gestión fiscal española. 36 agentes IA especializados en trámites AEAT y CNMC. Dominio: romainge.com

## Stack Tecnológico

- **Backend**: Node.js 20+, Express.js, WebSocket (ws), Twilio Voice API
- **Frontend**: React 18, Vite 6, Recharts (admin dashboard)
- **IA**: Anthropic Claude API (claude-sonnet-4-20250514)
- **Telefonía**: Twilio Programmable Voice (STT es-ES, TTS Polly.Lucia-Neural)
- **Base de datos**: PostgreSQL (Prisma ORM) / Redis (caché) / In-memory (dev)
- **Deploy**: Vercel (frontend) + Railway (backend) o todo en Vercel

## Estructura del Proyecto

```
romainge/
├── CLAUDE.md                    ← Este archivo
├── package.json                 ← Monorepo root
├── deploy.sh                   ← Script de despliegue
├── backend/
│   ├── server.js               ← Express + WebSocket server
│   ├── package.json
│   ├── vercel.json
│   ├── .env.example
│   ├── api/routes.js           ← REST: voice webhooks, sessions, chat, renta
│   ├── api/admin-routes.js     ← REST: admin dashboard, charts, export, tags, latency
│   ├── lib/
│   │   ├── agent-engine.js     ← Motor Claude API (chat, streaming, classify)
│   │   ├── prisma.js           ← Prisma client singleton
│   │   ├── sessions.js         ← Sesiones en memoria (dev)
│   │   ├── sessions-redis.js   ← Sesiones Redis (fallback)
│   │   ├── sessions-pg.js      ← Sesiones PostgreSQL (Prisma, soft-delete)
│   │   ├── sessions-adapter.js ← Auto-selección PG/Redis/memoria
│   │   ├── jwt.js              ← JWT auth, refresh tokens, CSRF, rate limit, IP whitelist
│   │   ├── encryption.js       ← AES-256-GCM cifrado de mensajes
│   │   ├── audit-log.js        ← Logs de auditoría de accesos
│   │   ├── call-history.js     ← Historial de llamadas + estadísticas por servicio
│   │   ├── search.js           ← Búsqueda full-text PostgreSQL (tsvector español)
│   │   ├── response-cache.js   ← Caché Redis/LRU para respuestas frecuentes
│   │   ├── documents.js        ← Store de documentos (local/S3)
│   │   ├── tenants.js          ← Multi-tenant para asesorías fiscales
│   │   ├── admin-auth.js       ← Autenticación admin dashboard (JWT separado)
│   │   ├── email-alerts.js     ← Alertas email (cola, latencia, costes)
│   │   ├── metrics.js          ← Tracking: tokens Claude, Twilio, latencia, encuestas, tags, heatmap
│   │   ├── twilio-voice.js     ← TwiML: ConversationRelay + DTMF fallback
│   │   ├── voice-relay.js      ← WebSocket handler bidireccional (voz IA)
│   │   ├── voice-queue.js      ← Cola de llamadas + callbacks
│   │   ├── nif-validator.js    ← Validación NIF/NIE/CIF por voz
│   │   ├── faq-engine.js       ← FAQ inteligente con aprendizaje automático
│   │   ├── whatsapp.js         ← Chatbot WhatsApp via Twilio API
│   │   ├── calendar-reminders.js ← Google Calendar + ICS + plazos fiscales
│   │   ├── electronic-signature.js ← Firma electrónica FNMT + XAdES
│   │   ├── advisor-comparator.js ← Comparador asesores fiscales por zona
│   │   ├── electronic-invoicing.js ← Facturación TicketBAI + Verifactu
│   │   ├── aeat-scraper.js     ← Scraper AEAT calendario contribuyente
│   │   ├── api-keys.js         ← API keys para API pública
│   │   ├── sii-module.js       ← SII (Suministro Inmediato de Información)
│   │   ├── tax-form-generator.js ← Generador modelos 036, 303, 390
│   │   ├── sentry.js           ← Error tracking (Sentry)
���   │   └── feature-flags.js    ← Feature flags con hot-reload
│   ├── prisma/
│   │   ├── schema.prisma       ← Modelos: Session, Message, CallHistory, Document, Tenant
│   │   └── migrations/         ← Migraciones SQL (incluye índice GIN full-text)
│   ├── config/
│   │   ├── services.js         ← 39 servicios + keyword classifier
│   │   └── feature-flags.json  ← Configuración de feature flags
│   ├── prompts/
│   │   ├── agents.js           ← System prompts recepcionista + 39 agentes
│   │   └── cnmc-specialist.js  ← Datos reales CNMC (sede.cnmc.gob.es)
│   ├── scripts/
│   │   ├── setup-twilio.js     ← Setup automático webhooks Twilio
│   │   ├── migrate.js          ← Migraciones DB con rollback
│   │   └── backup-redis.js     ← Backup automático sesiones Redis
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── vercel.json
    ├── public/
    │   ├── manifest.json       ← PWA manifest
    │   ├── sw.js               ← Service Worker (cache + push notifications)
    │   └── widget.js           ← Embeddable chat widget (vanilla JS)
    └── src/
        ├── main.jsx
        ├── api.js              ← Cliente API (REST, SSE, WebSocket, refresh tokens)
        ├── theme.js            ← Dark/Light theme system
        ├── i18n.js             ← Traducciones ES/CA/EU/GL
        ├── MarkdownRenderer.jsx ← Markdown + GFM para respuestas de agentes
        ├── ChatWidget.jsx      ← Widget React embebible
        ├── AdminDashboard.jsx  ← Dashboard admin completo (Recharts)
        └── App.jsx             ← App completa (~1150 líneas)
```

## Comandos

```bash
# Instalar todo
npm run install:all

# Desarrollo local (backend:3001 + frontend:3000)
npm run dev

# Solo backend
cd backend && npm run dev

# Solo frontend
cd frontend && npm run dev

# Setup Twilio
cd backend && npm run setup:twilio

# Tests backend (154 tests)
cd backend && npm test
cd backend && npm run test:coverage   # Con coverage report (v8)

# Tests frontend (19 tests)
cd frontend && npm test
cd frontend && npm run test:update    # Actualizar snapshots

# E2E tests (Playwright)
cd e2e && npx playwright test
cd e2e && npx playwright test --headed  # Con navegador visible

# Load tests (Artillery)
cd backend && npm run test:load       # Simula hasta 500 req/s

# Build frontend
cd frontend && npm run build

# Database (Prisma)
cd backend && npx prisma migrate deploy    # Aplicar migraciones
cd backend && npx prisma generate          # Regenerar cliente
cd backend && npx prisma studio            # GUI de base de datos

# Deploy
./deploy.sh all
./deploy.sh backend
./deploy.sh frontend
./deploy.sh railway
```

## Variables de Entorno (backend/.env)

```
ANTHROPIC_API_KEY=sk-ant-xxxxx
CLAUDE_MODEL=claude-sonnet-4-20250514
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE_NUMBER=+34900000000
BASE_URL=https://api.romainge.com
API_SECRET=<random-32-chars>
SESSION_ENCRYPTION_KEY=<random-32-chars>
PORT=3001
NODE_ENV=production
REDIS_URL=redis://...
STT_LANGUAGE=es-ES
TTS_VOICE=Polly.Lucia-Neural
SPEECH_TIMEOUT=3
```

## Arquitectura de Llamadas (ConversationRelay)

```
Llamada entrante → Twilio Voice API
  → POST /api/voice/incoming     (TwiML: Connect → ConversationRelay)
  → WebSocket ws://host/voice-relay  (bidireccional en tiempo real)
      ├── setup     → saludo + consentimiento grabación
      ├── prompt    → transcripción voz → clasificación → agente IA
      ├── dtmf      → fallback numérico (1=impuestos, 2=aduanas...)
      └── interrupt → usuario interrumpe TTS
  → Detección automática idioma (es/ca/gl/eu)
  → NIF dictado y validado por voz
  → Comando "repetir" / tecla * para repetir última respuesta
  → Comando "humano" / tecla # para transferir a operador
  → Cola de espera con callback si capacidad llena
  → Genera clave 1 palabra (ej: "aurora")
  → Usuario accede romainge.com con clave + teléfono → sesión privada
```

## API Endpoints

```
# Voice Webhooks (Twilio ConversationRelay)
POST /api/voice/incoming            (TwiML → ConversationRelay WS)
POST /api/voice/dtmf-menu           (menú DTMF fallback)
POST /api/voice/dtmf-select         (selección servicio por DTMF)
POST /api/voice/callback-connect    (devolver llamada al usuario)
POST /api/voice/status              (monitorización)
POST /api/voice/recording-status    (callback grabaciones)
GET  /api/voice/queue-stats         (estado cola/capacidad)
WS   ws://host/voice-relay          (ConversationRelay bidireccional)

# Sessions & Auth
POST /api/sessions/login          { key, phone } → { accessToken, refreshToken }
POST /api/sessions/refresh        { refreshToken } → { accessToken, refreshToken }
POST /api/sessions/logout         (requireAuth)
POST /api/sessions/verify-phone   { phone } → SMS via Twilio Verify
POST /api/sessions/verify-code    { phone, code }
GET  /api/sessions/:id/messages   (requireAuth)
POST /api/sessions/:id/chat       (requireAuth + sessionRateLimit + cache)
GET  /api/sessions/:id/chat-stream?message=...  (SSE, requireAuth)
PUT  /api/sessions/:id/ip-whitelist  { ips[] } (requireAuth)
POST /api/sessions/:id/restore    (requireAuth, soft-delete restore)
POST /api/sessions/:id/documents  (requireAuth, multipart upload)
GET  /api/sessions/:id/documents  (requireAuth)

# Documents
GET  /api/documents/:id           (requireAuth, download)
DELETE /api/documents/:id         (requireAuth)

# Search
GET  /api/search?q=...            (requireAuth, full-text PostgreSQL)

# Call History & Stats
GET  /api/calls/history           (requireAuth, filtros)
GET  /api/calls/stats             (API_SECRET, estadísticas por servicio)

# Response Cache
GET  /api/cache/stats             (API_SECRET)

# Multi-tenant
POST /api/tenants                 (API_SECRET, crear asesoría)
GET  /api/tenants                 (API_SECRET, listar)
GET  /api/tenants/:idOrSlug       (API_SECRET, detalle + stats)
PUT  /api/tenants/:id             (API_SECRET, actualizar)
DELETE /api/tenants/:id           (API_SECRET, eliminar)
PUT  /api/tenants/:id/agents/:svc (API_SECRET, personalizar agente)
GET  /api/tenants/:id/agents      (API_SECRET, listar agentes)

# Admin Dashboard
POST /api/admin/login             { email, password } → { token, admin }
GET  /api/admin/me                (requireAdmin)
GET  /api/admin/dashboard         (requireAdmin, overview con todos los datos)
GET  /api/admin/calls             (requireAdmin, historial paginado)
GET  /api/admin/calls/by-service  (requireAdmin, stats por servicio)
GET  /api/admin/calls/chart       (requireAdmin, datos gráfica hora/día/semana)
GET  /api/admin/calls/:sid/transcription  (requireAdmin, grabación + transcripción)
POST /api/admin/calls/:sid/tags   (requireAdmin, añadir etiqueta)
DELETE /api/admin/calls/:sid/tags/:tag  (requireAdmin, quitar etiqueta)
GET  /api/admin/tags/stats        (requireAdmin, estadísticas de etiquetas)
GET  /api/admin/costs             (requireAdmin, costes Claude + Twilio)
GET  /api/admin/latency           (requireAdmin, latencia en tiempo real)
GET  /api/admin/satisfaction      (requireAdmin, métricas de satisfacción)
POST /api/admin/satisfaction      (público, enviar encuesta post-llamada)
GET  /api/admin/heatmap           (requireAdmin, llamadas por CCAA)
GET  /api/admin/export/calls      (requireAdmin, CSV/Excel)
GET  /api/admin/export/costs      (requireAdmin, CSV costes)
GET  /api/admin/audit-log         (requireAdmin)
GET  /api/admin/queue             (requireAdmin, estado cola)
GET  /api/admin/cache             (requireAdmin, stats caché)

# WebSocket
ws://host/ws → auth → chat (streaming chunks)

# FAQ — Sistema inteligente
GET  /api/faq?q=...&serviceId=...     (búsqueda FAQ + trending)
GET  /api/faq/stats                    (API_SECRET, estadísticas)

# Calendario — Plazos fiscales
GET  /api/calendar/deadlines?days=30&profile=autonomo
GET  /api/calendar/ics?profile=autonomo  (descarga .ics)
POST /api/calendar/subscribe           { email, profileType, phone }
GET  /api/calendar/aeat?year=2025      (scraper AEAT actualizado)

# Facturación electrónica — TicketBAI + Verifactu
POST /api/invoicing/create             (requireAuth, crear factura)
POST /api/invoicing/ticketbai          (requireAuth, generar XML TicketBAI)
POST /api/invoicing/verifactu          (requireAuth, generar registro Verifactu)
GET  /api/invoicing/list?nif=...       (requireAuth, listar facturas)

# SII — Suministro Inmediato de Información
GET  /api/sii/info                     (knowledge base completa)
POST /api/sii/record                   (requireAuth, generar registro SII)
GET  /api/sii/deadline?date=2025-04-15 (calcular plazo envío)
GET  /api/sii/status?nif=...&period=... (requireAuth, estado envíos)

# Modelos tributarios — Generador automático
GET  /api/forms/supported              (modelos soportados)
POST /api/forms/generate               (requireAuth, generar modelo pre-rellenado)
GET  /api/forms/:modelo/info           (info del modelo)

# Firma electrónica
GET  /api/signature/fnmt/info          (tipos certificado, URLs FNMT)
POST /api/signature/sign               (requireAuth, firmar documento)
POST /api/signature/verify             (verificar firma)

# Comparador de asesores fiscales
GET  /api/advisors?city=Madrid&specialty=autonomos
GET  /api/advisors/top?ccaa=Madrid&limit=10
GET  /api/advisors/near/:postalCode
GET  /api/advisors/compare?id1=...&id2=...
GET  /api/advisors/:id

# WhatsApp
POST /api/whatsapp/webhook             (Twilio webhook)
GET  /api/whatsapp/stats               (API_SECRET, métricas)

# API Pública (v1) — requiere X-API-Key
GET  /api/v1/services
POST /api/v1/chat                      { serviceId, message }
POST /api/v1/classify                  { message }
POST /api/v1/renta/simulate
GET  /api/v1/calendar
GET  /api/v1/calendar/upcoming?days=30
GET  /api/v1/faq?serviceId=...
GET  /api/v1/faq/search?q=...
POST /api/v1/nif/validate              { nif }
GET  /api/v1/health

# Other
GET  /api/services
POST /api/renta/simulate
GET  /api/health
```

## 39 Servicios

Impuestos | Aduanas | Censos/NIF | Certificados | Recaudación | Beneficios Fiscales |
Comprobaciones/Sancionador | Requerimientos | Recursos/Reclamaciones | Otros Tributarios |
No Tributarios | AAPP | Colaboración Social | Apoderamiento | Sucesión | Calendario |
Cotejo | Denuncia Tributaria | Denuncia Efectivo | Canal Externo Ley 2/2023 |
Canal Interno Ley 2/2023 | Etiquetas | Notificaciones | Pago de Impuestos | Simuladores |
VIES | Concursos | Cl@ve | Cita Previa | Firma | Cert. Electrónico Representante |
Autorización Cert. | TOKEN | Financiación Autonómica | CNMC | Renta 2025 | IBI | Modelo 303 | Autónomos

## Convenciones de Código

- ESM modules (import/export), nunca CommonJS (require)
- Node.js 20+ con --watch para hot reload
- Respuestas de agentes IA: máximo 3-5 frases por teléfono, más extenso en chat
- Sesiones: clave de 1 palabra aleatoria + teléfono = acceso privado, TTL 24h
- System prompts en prompts/agents.js — cada agente tiene prompt propio
- Clasificador: keywords primero (rápido), fallback a Claude (preciso)
- Frontend: React con inline styles, sin CSS externo, dark theme
- Producción: DATABASE_URL auto-selecciona PostgreSQL (Prisma), REDIS_URL para caché

## Seguridad

- **JWT con refresh tokens**: Access token (30m) + refresh token (24h) con rotación automática
- **Rate limiting**: IP-based (express-rate-limit) + per-session (sessionRateLimit, 15/min)
- **AES-256-GCM**: Mensajes cifrados en almacenamiento (SESSION_ENCRYPTION_KEY)
- **CSRF**: Double-submit cookie pattern (se salta Bearer auth y webhooks Twilio)
- **Helmet CSP**: Content-Security-Policy configurado para frontend SPA
- **Tokens de un solo uso**: Clave de sesión se consume en primer login
- **Inactividad**: Auto-logout tras 30min (SESSION_INACTIVITY_MINUTES)
- **Auditoría**: Logs de todos los accesos a sesiones (lib/audit-log.js)
- **IP whitelisting**: Restricción opcional de IPs por sesión
- **SMS verificación**: Twilio Verify para verificar teléfono antes de crear sesión

## Tareas Pendientes

- [x] Integrar Twilio ConversationRelay para voz bidireccional en tiempo real
- [x] Añadir autenticación JWT con refresh tokens
- [x] Tests unitarios (Vitest) para classifier, NIF y renta
- [x] Internacionalización voz (catalán, euskera, gallego) — detección automática
- [x] Grabación de llamadas con consentimiento previo
- [x] Simulador IRPF completo con todas las CCAA
- [x] Seguridad: JWT refresh, AES-256, CSRF, CSP, rate limit, audit log
- [x] PostgreSQL con Prisma ORM (migración desde Redis/memoria)
- [x] Historial de llamadas con estadísticas por servicio
- [x] Búsqueda full-text en conversaciones (tsvector español)
- [x] Caché Redis/LRU para respuestas frecuentes de agentes
- [x] Store de documentos (PDF, imágenes) en sesiones (local/S3)
- [x] Soft-delete con retención de 90 días
- [x] Multi-tenant para asesorías fiscales
- [x] Frontend: modo claro/oscuro con toggle, i18n (ES/CA/EU/GL), PWA, push notifications
- [x] Frontend: widget embebible, markdown rendering, calendario fiscal, búsqueda global
- [x] Frontend: onboarding tutorial, subida de documentos al chat, landing page SEO
- [x] Dashboard admin con autenticación, gráficas Recharts, exportación CSV/Excel
- [x] Alertas email cuando cola > 50 llamadas (SMTP configurable)
- [x] Métricas de satisfacción post-llamada (encuestas 1-5 + NPS)
- [x] Panel de monitorización de costes (tokens Claude + minutos Twilio)
- [x] Visor de transcripciones de llamadas en admin
- [x] Sistema de etiquetado manual de llamadas
- [x] Mapa de calor de llamadas por comunidad autónoma
- [x] Monitorización de latencia Claude API en tiempo real (P50/P95/P99)
- [x] Tests unitarios completos: classifier, NIF, renta, sessions, metrics, admin (154 backend + 19 frontend)
- [x] E2E tests (Playwright): login, chat, renta, admin, theme toggle
- [x] Claude API mock para tests sin consumir tokens
- [x] Tests webhooks Twilio con firma simulada
- [x] Coverage reporting con v8 (c8) — HTML + LCOV
- [x] Load tests con Artillery (rampa hasta 500 req/s)
- [x] Snapshot tests componentes React (theme, i18n, MarkdownRenderer, ChatWidget)
- [x] CI/CD con GitHub Actions (test + build + deploy Railway/Vercel)
- [x] Dockerfile + docker-compose.yml (backend + Redis + frontend nginx)
- [x] Health check mejorado (Claude API, Redis, PostgreSQL, Twilio)
- [x] Blue-green deployment con Vercel preview URLs
- [x] Sentry error tracking (backend + frontend)
- [x] Scripts migración DB con rollback (Prisma)
- [x] Feature flags con hot-reload JSON + env overrides
- [x] Compresión gzip en backend
- [x] Backup automático sesiones Redis
- [x] FAQ inteligente con aprendizaje de preguntas frecuentes
- [x] Chatbot WhatsApp con Twilio WhatsApp API
- [x] Google Calendar + ICS para recordatorios plazos fiscales
- [x] Firma electrónica FNMT + XAdES-BES
- [x] Comparador de asesores fiscales por zona geográfica
- [x] Facturación electrónica TicketBAI + Verifactu
- [x] Scraper AEAT para calendario contribuyente actualizado
- [x] API pública (v1) con API keys y rate limiting
- [x] Soporte SII (Suministro Inmediato de Información)
- [x] Generador automático modelos tributarios (036, 303, 390)
- [ ] Integración con sede electrónica AEAT para datos en tiempo real
