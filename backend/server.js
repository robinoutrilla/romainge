// ═══════════════════════════════════════════════════════════════
// server.js — Servidor principal RomainGE
// ═══════════════════════════════════════════════════════════════

import "dotenv/config";
import express from "express";
import compression from "compression";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { WebSocketServer } from "ws";
import http from "http";
import { v4 as uuidv4 } from "uuid";
import apiRoutes from "./api/routes.js";
import adminRoutes from "./api/admin-routes.js";
import whatsappRoutes from "./api/whatsapp-routes.js";
import publicApiRoutes from "./api/public-api-routes.js";
import { getSession, addMessage, cleanupExpiredSessions } from "./lib/sessions-adapter.js";
import { chatWithSpecialistStream } from "./lib/agent-engine.js";
import { SERVICES_MAP } from "./config/services.js";
import { verifyWsToken, csrfProtection } from "./lib/jwt.js";
import { handleVoiceRelayConnection } from "./lib/voice-relay.js";
import { initSentry, sentryErrorHandler } from "./lib/sentry.js";
import cookieParser from "cookie-parser";

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Compresión gzip/brotli ─────────────────────────────────
app.use(compression({
  level: 6,              // Balance velocidad/compresión
  threshold: 1024,       // Solo comprimir >1KB
  filter: (req, res) => {
    // No comprimir SSE streams
    if (req.headers.accept === "text/event-stream") return false;
    return compression.filter(req, res);
  },
}));

// ─── Middleware de seguridad ────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: [
        "'self'",
        "https://romainge.com",
        "https://api.romainge.com",
        "wss://romainge.com",
        "wss://api.romainge.com",
        "ws://localhost:*",
        "http://localhost:*",
      ],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(cors({
  origin: [
    "https://romainge.com",
    "https://www.romainge.com",
    "http://localhost:3000",  // Desarrollo
    "http://localhost:5173",  // Vite dev
  ],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intente de nuevo en unos minutos." },
});
app.use("/api/", limiter);

// Rate limit más estricto para chat (evitar abuso de API Claude)
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 mensajes por minuto
  message: { error: "Límite de mensajes alcanzado. Espere un momento." },
});
app.use("/api/sessions/:id/chat", chatLimiter);

// Cookie parsing (for CSRF double-submit pattern)
app.use(cookieParser());

// Body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// CSRF protection (skips Bearer auth, Twilio webhooks, GET/HEAD/OPTIONS)
app.use(csrfProtection);

// Logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path !== "/api/health") {
      console.log(`${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// ─── Rutas API ──────────────────────────────────────────────
app.use("/api", apiRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/v1", publicApiRoutes);

// ─── Ruta raíz ──────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    name: "RomainGE API",
    version: "1.0.0",
    description: "Plataforma de Gestión Fiscal con IA — España",
    endpoints: {
      health: "/api/health",
      services: "/api/services",
      sessionLogin: "POST /api/sessions/login",
      chat: "POST /api/sessions/:id/chat",
      voiceWebhook: "POST /api/voice/incoming",
      rentaSimulator: "POST /api/renta/simulate",
      whatsapp: "POST /api/whatsapp/webhook",
      publicApi: "/api/v1/",
      faq: "/api/faq",
      calendar: "/api/calendar",
      invoicing: "/api/invoicing",
    },
  });
});

// ─── Sentry error tracking ──────────────────────────────────
initSentry(app);
app.use(sentryErrorHandler());

// ─── Error handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Error no manejado:", err);
  res.status(500).json({
    error: "Error interno del servidor",
    ...(process.env.NODE_ENV !== "production" && { details: err.message }),
  });
});

// ─── Servidor HTTP + WebSocket ──────────────────────────────
const server = http.createServer(app);

// WebSocket para ConversationRelay (Twilio voz bidireccional)
const voiceWss = new WebSocketServer({ server, path: "/voice-relay" });

voiceWss.on("connection", (ws, req) => {
  console.log(`[VOICE-RELAY] Nueva conexión desde ${req.socket.remoteAddress}`);
  handleVoiceRelayConnection(ws);
});

// WebSocket para chat en tiempo real (frontend web)
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  let sessionId = null;

  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // Autenticación por sesión (with JWT)
      if (msg.type === "auth") {
        // Verify JWT if provided
        if (msg.token) {
          const payload = verifyWsToken(msg.token);
          if (!payload || payload.sessionId !== msg.sessionId) {
            ws.send(JSON.stringify({ type: "error", message: "Token inválido" }));
            ws.close();
            return;
          }
        }
        const session = await getSession(msg.sessionId);
        if (!session) {
          ws.send(JSON.stringify({ type: "error", message: "Sesión inválida" }));
          ws.close();
          return;
        }
        sessionId = msg.sessionId;
        ws.send(JSON.stringify({ type: "auth_ok", sessionId }));
        return;
      }

      // Mensaje de chat
      if (msg.type === "chat" && sessionId) {
        const session = await getSession(sessionId);
        if (!session) {
          ws.send(JSON.stringify({ type: "error", message: "Sesión expirada" }));
          return;
        }

        const service = SERVICES_MAP[session.serviceId];
        if (!service) return;

        await addMessage(sessionId, "user", msg.text);

        const callerInfo = {
          name: session.callerName,
          lastName: session.callerLastName,
          phone: session.callerPhone,
        };

        // Streaming response
        ws.send(JSON.stringify({ type: "typing", active: true }));

        const { getMessages } = await import("./lib/sessions-adapter.js");
        const messages = await getMessages(sessionId);
        const fullText = await chatWithSpecialistStream(
          service,
          callerInfo,
          messages,
          (chunk) => {
            ws.send(JSON.stringify({ type: "chunk", text: chunk }));
          }
        );

        await addMessage(sessionId, "agent", fullText);
        ws.send(JSON.stringify({ type: "done", text: fullText }));
      }
    } catch (err) {
      console.error("WebSocket error:", err);
      ws.send(JSON.stringify({ type: "error", message: "Error interno" }));
    }
  });

  ws.on("close", () => {
    console.log(`WS desconectado: sesión ${sessionId || "sin auth"}`);
  });
});

// ─── Arrancar servidor ──────────────────────────────────────
// ─── Periodic cleanup (soft-delete + retention purge) ────────
setInterval(() => {
  cleanupExpiredSessions().catch((err) =>
    console.error("Cleanup error:", err)
  );
}, 60 * 60 * 1000); // Every hour

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🏛️  RomainGE — Plataforma Fiscal IA                    ║
║                                                           ║
║   Servidor:    http://localhost:${PORT}                     ║
║   API:         http://localhost:${PORT}/api                 ║
║   WebSocket:   ws://localhost:${PORT}/ws                    ║
║   Voice Relay: ws://localhost:${PORT}/voice-relay           ║
║   Health:      http://localhost:${PORT}/api/health           ║
║                                                           ║
║   Servicios:   ${Object.keys(SERVICES_MAP).length} agentes especializados            ║
║   Entorno:     ${process.env.NODE_ENV || "development"}                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app; // Para Vercel serverless
