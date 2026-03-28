// ═══════════════════════════════════════════════════════════════
// api/routes.js — Rutas API REST
// ═══════════════════════════════════════════════════════════════

import { Router } from "express";
import twilio from "twilio";
import {
  createSession,
  findSession,
  getSession,
  addMessage,
  getMessages,
  getStats,
} from "../lib/sessions-adapter.js";
import {
  chatWithSpecialist,
  chatWithSpecialistSupervised,
  chatWithSpecialistStream,
  classifyIntentAI,
  rentaSimulation,
} from "../lib/agent-engine.js";
import { simularRenta, compararIndividualVsConjunta, generarBorradorPDF } from "../lib/renta-simulator.js";
import {
  handleIncomingCall,
  handleDTMFMenu,
  handleDTMFSelect,
  handleCallbackConnect,
  handleStatusCallback,
  handleRecordingStatus,
} from "../lib/twilio-voice.js";
import { getQueueStats } from "../lib/voice-queue.js";
import { SERVICES, SERVICES_MAP } from "../config/services.js";
import {
  generateTokens,
  generateToken,
  requireAuth,
  verifyToken,
  refreshAccessToken,
  revokeSession,
  sessionRateLimit,
  csrfProtection,
  setIpWhitelist,
} from "../lib/jwt.js";
import { logAudit, auditContext, getAuditLog } from "../lib/audit-log.js";
import { restoreSession } from "../lib/sessions-adapter.js";
import { logCall, getCallHistory, getCallStatsByService, getCallStatsGlobal } from "../lib/call-history.js";
import { searchMessages, searchMessagesSimple } from "../lib/search.js";
import { getCachedResponse, cacheResponse, getCacheStats } from "../lib/response-cache.js";
import { uploadDocument, getDocument, getDocumentContent, listDocuments, deleteDocument } from "../lib/documents.js";
import { createTenant, getTenantBySlug, getTenant, updateTenant, listTenants, setTenantAgent, getTenantAgents, getTenantStats, deleteTenant } from "../lib/tenants.js";
import multer from "multer";

const router = Router();

// ─── Middleware: Validar firma Twilio (solo en producción) ───
function validateTwilioSignature(req, res, next) {
  if (process.env.NODE_ENV !== "production") return next();

  const signature = req.headers["x-twilio-signature"];
  const url = `${process.env.BASE_URL}${req.originalUrl}`;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (twilio.validateRequest(authToken, signature, url, req.body)) {
    return next();
  }
  return res.status(403).send("Invalid Twilio signature");
}

// ═══════════════════════════════════════════════════════════════
// VOICE WEBHOOKS (Twilio + ConversationRelay)
// ═══════════════════════════════════════════════════════════════

// Llamada entrante → ConversationRelay bidireccional
router.post("/voice/incoming", validateTwilioSignature, (req, res) => {
  const twiml = handleIncomingCall(req);
  res.type("text/xml").send(twiml);
});

// Menú DTMF (fallback si voz no funciona)
router.post("/voice/dtmf-menu", validateTwilioSignature, (req, res) => {
  const twiml = handleDTMFMenu(req);
  res.type("text/xml").send(twiml);
});

// Selección DTMF de servicio
router.post("/voice/dtmf-select", validateTwilioSignature, async (req, res) => {
  try {
    const twiml = await handleDTMFSelect(req);
    res.type("text/xml").send(twiml);
  } catch (err) {
    console.error("Error en dtmf-select:", err);
    res.status(500).type("text/xml").send("<Response><Say>Error interno</Say></Response>");
  }
});

// Callback: devolver llamada al usuario
router.post("/voice/callback-connect", validateTwilioSignature, (req, res) => {
  const twiml = handleCallbackConnect(req);
  res.type("text/xml").send(twiml);
});

// Status callback
router.post("/voice/status", validateTwilioSignature, (req, res) => {
  handleStatusCallback(req);
  res.json({ ok: true });
});

// Recording status callback
router.post("/voice/recording-status", validateTwilioSignature, (req, res) => {
  handleRecordingStatus(req);
  res.json({ ok: true });
});

// Queue stats (para dashboard admin)
router.get("/voice/queue-stats", (req, res) => {
  res.json(getQueueStats());
});

// ═══════════════════════════════════════════════════════════════
// SESSION API (Frontend web)
// ═══════════════════════════════════════════════════════════════

// Login a sesión con clave + teléfono (single-use token)
router.post("/sessions/login", async (req, res) => {
  const { key, phone } = req.body;

  if (!key || !phone) {
    return res.status(400).json({ error: "Se requiere clave y telefono" });
  }

  const session = await findSession(key, phone);
  if (!session) {
    logAudit("login_failed", { ...auditContext(req), key, phone: phone.slice(-4) });
    return res.status(404).json({ error: "Sesion no encontrada, expirada o clave ya utilizada" });
  }

  // Generate JWT access + refresh tokens
  const { accessToken, refreshToken, expiresIn } = generateTokens(session.id, session.callerPhone);

  logAudit("login_success", { ...auditContext(req), sessionId: session.id });

  res.json({
    sessionId: session.id,
    token: accessToken,
    refreshToken,
    expiresIn,
    callerName: session.callerName,
    callerLastName: session.callerLastName,
    serviceId: session.serviceId,
    serviceName: SERVICES_MAP[session.serviceId]?.name,
    agentName: SERVICES_MAP[session.serviceId]?.agent,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  });
});

// Refresh access token
router.post("/sessions/refresh", (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: "Refresh token requerido" });
  }

  const result = refreshAccessToken(refreshToken);
  if (!result) {
    return res.status(401).json({ error: "Refresh token invalido o sesion expirada", code: "REFRESH_INVALID" });
  }

  logAudit("token_refreshed", { ...auditContext(req), sessionId: result.sessionId });

  res.json({
    token: result.accessToken,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn,
  });
});

// Logout (revoke session tokens)
router.post("/sessions/logout", requireAuth, (req, res) => {
  revokeSession(req.auth.sessionId);
  logAudit("logout", { ...auditContext(req) });
  res.json({ ok: true });
});

// SMS verification endpoint (Twilio Verify)
router.post("/sessions/verify-phone", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Telefono requerido" });

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifySid = process.env.TWILIO_VERIFY_SID;

  if (!accountSid || !authToken || !verifySid) {
    return res.status(501).json({ error: "Verificacion SMS no configurada", message: "Configure TWILIO_VERIFY_SID" });
  }

  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);
    await client.verify.v2.services(verifySid).verifications.create({
      to: phone,
      channel: "sms",
    });
    logAudit("sms_verification_sent", { ...auditContext(req), phone: phone.slice(-4) });
    res.json({ ok: true, message: "Codigo de verificacion enviado" });
  } catch (err) {
    console.error("Error enviando SMS:", err);
    res.status(500).json({ error: "Error al enviar el codigo de verificacion" });
  }
});

// Verify SMS code
router.post("/sessions/verify-code", async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: "Telefono y codigo requeridos" });

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifySid = process.env.TWILIO_VERIFY_SID;

  if (!verifySid) {
    return res.status(501).json({ error: "Verificacion SMS no configurada" });
  }

  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);
    const check = await client.verify.v2.services(verifySid).verificationChecks.create({
      to: phone,
      code,
    });

    if (check.status === "approved") {
      logAudit("sms_verification_approved", { ...auditContext(req), phone: phone.slice(-4) });
      res.json({ verified: true });
    } else {
      logAudit("sms_verification_failed", { ...auditContext(req), phone: phone.slice(-4) });
      res.json({ verified: false, message: "Codigo incorrecto" });
    }
  } catch (err) {
    console.error("Error verificando SMS:", err);
    res.status(500).json({ error: "Error al verificar el codigo" });
  }
});

// IP whitelisting for sensitive sessions
router.post("/sessions/:sessionId/ip-whitelist", requireAuth, (req, res) => {
  const { ips } = req.body;
  if (!Array.isArray(ips)) return res.status(400).json({ error: "Lista de IPs requerida" });
  setIpWhitelist(req.auth.sessionId, ips);
  logAudit("ip_whitelist_set", { ...auditContext(req), ips });
  res.json({ ok: true, ips });
});

// Obtener mensajes de una sesión
router.get("/sessions/:sessionId/messages", requireAuth, async (req, res) => {
  const { sessionId } = req.params;
  const session = await getSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Sesión no encontrada" });
  }

  const messages = await getMessages(sessionId);
  res.json({ messages });
});

// Enviar mensaje al agente (chat online)
router.post("/sessions/:sessionId/chat", requireAuth, sessionRateLimit(15), async (req, res) => {
  const { sessionId } = req.params;
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Mensaje requerido" });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Sesión no encontrada" });
  }

  const service = SERVICES_MAP[session.serviceId];
  if (!service) {
    return res.status(500).json({ error: "Servicio no configurado" });
  }

  // Check response cache first
  const cached = await getCachedResponse(session.serviceId, message);
  if (cached) {
    await addMessage(sessionId, "user", message);
    const agentMsg = await addMessage(sessionId, "agent", cached.response);
    return res.json({
      response: cached.response,
      messageId: agentMsg.id,
      timestamp: agentMsg.timestamp,
      fromCache: true,
    });
  }

  // Registrar mensaje del usuario
  await addMessage(sessionId, "user", message);

  try {
    // Generar respuesta del agente
    const callerInfo = {
      name: session.callerName,
      lastName: session.callerLastName,
      phone: session.callerPhone,
    };

    const messages = await getMessages(sessionId);
    const { response: agentResponse, supervised, review } = await chatWithSpecialistSupervised(
      service,
      callerInfo,
      messages
    );

    // Registrar respuesta
    const agentMsg = await addMessage(sessionId, "agent", agentResponse);

    // Cache the response for future similar queries
    cacheResponse(session.serviceId, message, agentResponse).catch(() => {});

    // Track question for FAQ learning
    import("../lib/faq-engine.js")
      .then(({ trackQuestion }) => trackQuestion(session.serviceId, message, agentResponse))
      .catch(() => {});

    res.json({
      response: agentResponse,
      messageId: agentMsg.id,
      timestamp: agentMsg.timestamp,
      ...(supervised && { supervised: true, reviewConfidence: review?.confidence }),
    });
  } catch (err) {
    console.error("Error en chat:", err);
    res.status(500).json({ error: "Error al procesar la consulta" });
  }
});

// Chat con streaming (SSE)
router.get("/sessions/:sessionId/chat-stream", requireAuth, sessionRateLimit(15), async (req, res) => {
  const { sessionId } = req.params;
  const message = req.query.message;

  if (!message) {
    return res.status(400).json({ error: "Mensaje requerido" });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Sesión no encontrada" });
  }

  const service = SERVICES_MAP[session.serviceId];
  if (!service) {
    return res.status(500).json({ error: "Servicio no configurado" });
  }

  // Configurar SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  await addMessage(sessionId, "user", message);

  try {
    const callerInfo = {
      name: session.callerName,
      lastName: session.callerLastName,
      phone: session.callerPhone,
    };

    const sessionMessages = await getMessages(sessionId);
    const fullText = await chatWithSpecialistStream(
      service,
      callerInfo,
      sessionMessages,
      (chunk) => {
        res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
      }
    );

    await addMessage(sessionId, "agent", fullText);
    res.write(`data: ${JSON.stringify({ type: "done", text: fullText })}\n\n`);
    res.end();
  } catch (err) {
    console.error("Error en stream:", err);
    res.write(`data: ${JSON.stringify({ type: "error", message: "Error al procesar" })}\n\n`);
    res.end();
  }
});

// ═════════════════════════════════════════════════════════��═════
// PDF EXPORT
// ═══════════════════════════════════════════════════════════════

router.get("/sessions/:sessionId/export-pdf", requireAuth, async (req, res) => {
  const { sessionId } = req.params;
  const session = await getSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Sesión no encontrada" });
  }

  const service = SERVICES_MAP[session.serviceId];
  const messages = await getMessages(sessionId);

  try {
    const PDFDocument = (await import("pdfkit")).default;
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition",
      `attachment; filename="romainge-sesion-${sessionId.slice(0, 8)}.pdf"`);

    doc.pipe(res);

    // Header
    doc.fontSize(22).font("Helvetica-Bold")
      .text("RomainGE", { align: "center" });
    doc.fontSize(10).font("Helvetica")
      .fillColor("#666666")
      .text("Plataforma de Gestión Fiscal con IA — España", { align: "center" });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke();
    doc.moveDown(1);

    // Session info
    doc.fillColor("#333333").fontSize(12).font("Helvetica-Bold")
      .text("Datos de la sesión");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#444444");
    doc.text(`Cliente: ${session.callerName} ${session.callerLastName || ""}`);
    doc.text(`Servicio: ${service?.name || session.serviceId}`);
    doc.text(`Agente: ${service?.agent || "N/A"}`);
    doc.text(`Fecha: ${new Date(session.createdAt).toLocaleString("es-ES")}`);
    doc.text(`ID sesión: ${sessionId}`);
    doc.moveDown(1);

    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke();
    doc.moveDown(1);

    // Conversation
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#333333")
      .text("Conversación");
    doc.moveDown(0.5);

    for (const msg of messages) {
      const isAgent = msg.role === "agent";
      const sender = isAgent ? (service?.agent || "Agente") : session.callerName;
      const time = new Date(msg.timestamp).toLocaleTimeString("es-ES", {
        hour: "2-digit", minute: "2-digit",
      });

      doc.fontSize(9).font("Helvetica-Bold")
        .fillColor(isAgent ? "#00796b" : "#1565c0")
        .text(`${sender} · ${time}`, { continued: false });

      doc.fontSize(10).font("Helvetica").fillColor("#333333")
        .text(msg.text, { lineGap: 2 });

      doc.moveDown(0.6);

      // Add page if needed
      if (doc.y > 720) {
        doc.addPage();
      }
    }

    // Footer
    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#cccccc").stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).font("Helvetica").fillColor("#999999")
      .text(`Documento generado el ${new Date().toLocaleString("es-ES")} — romainge.com`, { align: "center" })
      .text("Herramienta de asistencia. No sustituye asesoramiento profesional.", { align: "center" });

    doc.end();
  } catch (err) {
    console.error("Error generando PDF:", err);
    res.status(500).json({ error: "Error al generar el PDF" });
  }
});

// ═══════════════════════════════════════════════════════════════
// RENTA 2025 SIMULATOR
// ═══════════════════════════════════════════════════════════════

// Simulación principal (cálculo determinístico + IA para recomendaciones)
router.post("/renta/simulate", async (req, res) => {
  try {
    // Cálculo determinístico local
    const result = simularRenta(req.body);
    res.json({ ...result, source: "local" });
  } catch (err) {
    console.error("Error en simulación renta:", err);
    // Fallback a IA
    try {
      const aiResult = await rentaSimulation(req.body);
      res.json({ ...aiResult, source: "ai" });
    } catch (err2) {
      console.error("Error en simulación IA:", err2);
      res.status(500).json({ error: "Error en la simulación" });
    }
  }
});

// Simulación con IA (para recomendaciones avanzadas)
router.post("/renta/simulate-ai", async (req, res) => {
  try {
    const result = await rentaSimulation(req.body);
    res.json({ ...result, source: "ai" });
  } catch (err) {
    console.error("Error en simulación renta IA:", err);
    res.status(500).json({ error: "Error en la simulación" });
  }
});

// Comparativa individual vs conjunta (matrimonios)
router.post("/renta/comparar", (req, res) => {
  try {
    const { declarante, conyuge } = req.body;
    if (!declarante || !conyuge) {
      return res.status(400).json({ error: "Se requieren datos de ambos cónyuges" });
    }
    const result = compararIndividualVsConjunta(declarante, conyuge);
    res.json(result);
  } catch (err) {
    console.error("Error en comparación:", err);
    res.status(500).json({ error: "Error al comparar declaraciones" });
  }
});

// Descargar borrador PDF
router.post("/renta/borrador-pdf", async (req, res) => {
  try {
    const result = simularRenta(req.body);
    await generarBorradorPDF(req.body, result, res);
  } catch (err) {
    console.error("Error generando borrador PDF:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error al generar el borrador PDF" });
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// AEAT API — Importación de datos fiscales (certificado electrónico)
// ═══════════════════════════════════════════════════════════════

// Endpoint preparado para integración futura con la sede electrónica AEAT.
// Requiere: certificado electrónico del contribuyente (PKCS#12),
// conexión con cl@ve PIN, o apoderamiento registrado.
// La AEAT expone servicios web SOAP en:
//   https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/taiif/ws.html
router.post("/renta/importar-aeat", requireAuth, async (req, res) => {
  const { nif, certificado, pin } = req.body;

  if (!nif) {
    return res.status(400).json({ error: "Se requiere el NIF del contribuyente" });
  }

  // Check if AEAT integration is configured
  if (!process.env.AEAT_CERT_PATH && !certificado) {
    return res.status(501).json({
      error: "Integración con AEAT no disponible",
      message: "La importación de datos fiscales requiere un certificado electrónico. " +
        "Esta funcionalidad estará disponible próximamente. " +
        "Por ahora, introduzca los datos manualmente en el simulador.",
      requiere: [
        "Certificado electrónico de persona física (FNMT) o DNIe",
        "Cl@ve PIN activa para acceso a sede electrónica",
        "Configuración AEAT_CERT_PATH y AEAT_CERT_PASS en servidor",
      ],
      serviciosAEAT: {
        datosEconomicos: "GET /wlpl/SCDL-CENT/DatosEconomicosQuery",
        datosFiscales: "GET /wlpl/SCDL-CENT/DatosFiscalesQuery",
        borrador: "GET /wlpl/SCDL-RENT/BorradorQuery",
        certificadoRenta: "GET /wlpl/SCDL-CERT/CertificadoQuery",
      },
    });
  }

  // Future: implement actual AEAT SOAP client
  // const aeatClient = new AEATClient(process.env.AEAT_CERT_PATH, process.env.AEAT_CERT_PASS);
  // const datosFiscales = await aeatClient.obtenerDatosFiscales(nif, 2025);
  // return res.json(datosFiscales);

  res.status(501).json({ error: "Funcionalidad en desarrollo" });
});

// ═══════════════════════════════════════════════════════════════
// SERVICES CATALOG
// ═══════════════════════════════════════════════════════════════

router.get("/services", (req, res) => {
  res.json({ services: SERVICES });
});

router.get("/services/:id", (req, res) => {
  const service = SERVICES_MAP[req.params.id];
  if (!service) return res.status(404).json({ error: "Servicio no encontrado" });
  res.json(service);
});

// ═══════════════════════════════════════════════════════════════
// CALENDARIO — Próximos plazos fiscales
// ═══════════════════════════════════════════════════════════════

const FISCAL_DEADLINES = [
  { date: "2026-01-20", modelo: "303", desc: "IVA 4T 2025" },
  { date: "2026-01-20", modelo: "111", desc: "Retenciones 4T 2025" },
  { date: "2026-01-20", modelo: "115", desc: "Alquileres 4T 2025" },
  { date: "2026-01-30", modelo: "130", desc: "Pago fraccionado IRPF 4T 2025" },
  { date: "2026-01-30", modelo: "390", desc: "Resumen anual IVA 2025" },
  { date: "2026-01-30", modelo: "190", desc: "Resumen anual retenciones 2025" },
  { date: "2026-01-30", modelo: "180", desc: "Resumen anual alquileres 2025" },
  { date: "2026-01-30", modelo: "349", desc: "Operaciones intracomunitarias 4T" },
  { date: "2026-02-28", modelo: "347", desc: "Operaciones con terceros 2025" },
  { date: "2026-03-31", modelo: "720", desc: "Bienes en el extranjero" },
  { date: "2026-04-20", modelo: "303", desc: "IVA 1T 2026" },
  { date: "2026-04-20", modelo: "111", desc: "Retenciones 1T 2026" },
  { date: "2026-04-20", modelo: "130", desc: "Pago fraccionado IRPF 1T 2026" },
  { date: "2026-06-25", modelo: "100", desc: "Renta 2025 — último día domiciliación" },
  { date: "2026-06-30", modelo: "100", desc: "Renta 2025 — fin campaña" },
  { date: "2026-07-20", modelo: "303", desc: "IVA 2T 2026" },
  { date: "2026-07-20", modelo: "111", desc: "Retenciones 2T 2026" },
  { date: "2026-07-20", modelo: "130", desc: "Pago fraccionado IRPF 2T 2026" },
  { date: "2026-07-25", modelo: "200", desc: "Impuesto de Sociedades 2025" },
  { date: "2026-10-20", modelo: "303", desc: "IVA 3T 2026" },
  { date: "2026-10-20", modelo: "111", desc: "Retenciones 3T 2026" },
  { date: "2026-10-20", modelo: "130", desc: "Pago fraccionado IRPF 3T 2026" },
  { date: "2026-12-20", modelo: "202", desc: "Pago fraccionado Sociedades 3P" },
];

router.get("/calendario/proximos", (req, res) => {
  const now = new Date();
  const limit = parseInt(req.query.limit) || 5;
  const profile = req.query.profile; // "autonomo", "empresa", "particular"

  let deadlines = FISCAL_DEADLINES
    .filter(d => new Date(d.date) >= now)
    .map(d => {
      const deadline = new Date(d.date);
      const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
      return { ...d, daysLeft, urgent: daysLeft <= 7 };
    });

  // Filter by profile if specified
  if (profile === "autonomo") {
    deadlines = deadlines.filter(d =>
      ["130", "303", "111", "390", "100", "347"].includes(d.modelo));
  } else if (profile === "empresa") {
    deadlines = deadlines.filter(d =>
      ["200", "202", "303", "111", "115", "390", "349"].includes(d.modelo));
  } else if (profile === "particular") {
    deadlines = deadlines.filter(d =>
      ["100", "347", "720"].includes(d.modelo));
  }

  res.json({ deadlines: deadlines.slice(0, limit) });
});

// ═══════════════════════════════════════════════════════════════
// SOFT-DELETE: Restore session
// ═══════════════════════════════════════════════════════════════

router.post("/sessions/:sessionId/restore", requireAuth, async (req, res) => {
  try {
    const session = await restoreSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Sesión no encontrada o período de retención expirado" });
    }
    logAudit("session_restored", { ...auditContext(req), sessionId: session.id });
    res.json({ session });
  } catch (err) {
    console.error("Error restaurando sesión:", err);
    res.status(500).json({ error: "Error al restaurar la sesión" });
  }
});

// ═══════════════════════════════════════════════════════════════
// CALL HISTORY & STATS
// ═══════════════════════════════════════════════════════════════

router.get("/calls/history", requireAuth, async (req, res) => {
  const { serviceId, callerPhone, status, since, until, limit, offset } = req.query;
  try {
    const result = await getCallHistory({
      serviceId, callerPhone, status, since, until,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    });
    res.json(result);
  } catch (err) {
    console.error("Error obteniendo historial:", err);
    res.status(500).json({ error: "Error al obtener el historial" });
  }
});

router.get("/calls/stats", async (req, res) => {
  const secret = req.headers["x-api-secret"] || req.query.secret;
  if (secret !== process.env.API_SECRET) {
    return res.status(401).json({ error: "API secret requerido" });
  }
  const { since, until, tenantId } = req.query;
  try {
    const [global, byService] = await Promise.all([
      getCallStatsGlobal({ since, until, tenantId }),
      getCallStatsByService({ since, until, tenantId }),
    ]);
    res.json({ global, byService });
  } catch (err) {
    console.error("Error stats llamadas:", err);
    res.status(500).json({ error: "Error al obtener estadísticas" });
  }
});

// ═══════════════════════════════════════════════════════════════
// FULL-TEXT SEARCH
// ═══════════════════════════════════════════════════════════════

router.get("/search", requireAuth, async (req, res) => {
  const { q, sessionId, role, since, until, limit, offset, mode } = req.query;
  try {
    const fn = mode === "simple" ? searchMessagesSimple : searchMessages;
    const result = await fn({
      query: q,
      sessionId, role, since, until,
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
    });
    res.json(result);
  } catch (err) {
    console.error("Error en búsqueda:", err);
    // Fallback to simple search on FTS error
    try {
      const result = await searchMessagesSimple({
        query: q, sessionId,
        limit: parseInt(limit) || 20,
        offset: parseInt(offset) || 0,
      });
      res.json({ ...result, fallback: true });
    } catch (err2) {
      res.status(500).json({ error: "Error en la búsqueda" });
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// RESPONSE CACHE MANAGEMENT
// ═══════════════════════════════════════════════════════════════

router.get("/cache/stats", async (req, res) => {
  const secret = req.headers["x-api-secret"] || req.query.secret;
  if (secret !== process.env.API_SECRET) {
    return res.status(401).json({ error: "API secret requerido" });
  }
  try {
    const stats = await getCacheStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener stats de caché" });
  }
});

// ═══════════════════════════════════════════════════════════════
// DOCUMENTS
// ═══════════════════════════════════════════════════════════════

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/sessions/:sessionId/documents", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Archivo requerido" });
  try {
    const doc = await uploadDocument({
      sessionId: req.params.sessionId,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      buffer: req.file.buffer,
      uploadedBy: "user",
    });
    logAudit("document_uploaded", { ...auditContext(req), documentId: doc.id, filename: doc.filename });
    res.json({ document: { id: doc.id, filename: doc.filename, mimeType: doc.mimeType, size: doc.size } });
  } catch (err) {
    console.error("Error subiendo documento:", err);
    res.status(400).json({ error: err.message || "Error al subir el documento" });
  }
});

router.get("/sessions/:sessionId/documents", requireAuth, async (req, res) => {
  try {
    const docs = await listDocuments(req.params.sessionId);
    res.json({ documents: docs });
  } catch (err) {
    res.status(500).json({ error: "Error al listar documentos" });
  }
});

router.get("/documents/:documentId", requireAuth, async (req, res) => {
  try {
    const result = await getDocumentContent(req.params.documentId);
    if (!result) return res.status(404).json({ error: "Documento no encontrado" });
    res.setHeader("Content-Type", result.doc.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${result.doc.filename}"`);
    res.send(result.buffer);
  } catch (err) {
    console.error("Error descargando documento:", err);
    res.status(500).json({ error: "Error al descargar" });
  }
});

router.delete("/documents/:documentId", requireAuth, async (req, res) => {
  try {
    const deleted = await deleteDocument(req.params.documentId);
    if (!deleted) return res.status(404).json({ error: "Documento no encontrado" });
    logAudit("document_deleted", { ...auditContext(req), documentId: req.params.documentId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar" });
  }
});

// ═══════════════════════════════════════════════════════════════
// MULTI-TENANT (Asesorías fiscales)
// ═══════════════════════════════════════════════════════════════

function requireApiSecret(req, res, next) {
  const secret = req.headers["x-api-secret"] || req.query.secret;
  if (secret !== process.env.API_SECRET) {
    return res.status(401).json({ error: "API secret requerido" });
  }
  next();
}

router.post("/tenants", requireApiSecret, async (req, res) => {
  const { name, slug, plan, maxAgents, settings } = req.body;
  if (!name || !slug) return res.status(400).json({ error: "name y slug requeridos" });
  try {
    const tenant = await createTenant({ name, slug, plan, maxAgents, settings });
    res.status(201).json({ tenant });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Slug ya existe" });
    console.error("Error creando tenant:", err);
    res.status(500).json({ error: "Error al crear tenant" });
  }
});

router.get("/tenants", requireApiSecret, async (req, res) => {
  const { limit, offset } = req.query;
  try {
    const result = await listTenants({ limit: parseInt(limit) || 50, offset: parseInt(offset) || 0 });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Error al listar tenants" });
  }
});

router.get("/tenants/:idOrSlug", requireApiSecret, async (req, res) => {
  try {
    const param = req.params.idOrSlug;
    const tenant = param.includes("-") ? await getTenant(param) : await getTenantBySlug(param);
    if (!tenant) return res.status(404).json({ error: "Tenant no encontrado" });
    const stats = await getTenantStats(tenant.id);
    res.json({ tenant, stats });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener tenant" });
  }
});

router.put("/tenants/:id", requireApiSecret, async (req, res) => {
  try {
    const tenant = await updateTenant(req.params.id, req.body);
    res.json({ tenant });
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar tenant" });
  }
});

router.delete("/tenants/:id", requireApiSecret, async (req, res) => {
  try {
    await deleteTenant(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error al eliminar tenant" });
  }
});

// Tenant agent customization
router.put("/tenants/:tenantId/agents/:serviceId", requireApiSecret, async (req, res) => {
  const { customName, customPrompt, enabled } = req.body;
  try {
    const agent = await setTenantAgent(req.params.tenantId, req.params.serviceId, {
      customName, customPrompt, enabled,
    });
    res.json({ agent });
  } catch (err) {
    res.status(500).json({ error: "Error al configurar agente" });
  }
});

router.get("/tenants/:tenantId/agents", requireApiSecret, async (req, res) => {
  try {
    const agents = await getTenantAgents(req.params.tenantId);
    res.json({ agents });
  } catch (err) {
    res.status(500).json({ error: "Error al listar agentes" });
  }
});

// Audit log (admin)
router.get("/admin/audit-log", requireApiSecret, (req, res) => {
  const { sessionId, event, ip, since, limit } = req.query;
  const log = getAuditLog({ sessionId, event, ip, since, limit: parseInt(limit) || 100 });
  res.json({ log });
});

// ═══════════════════════════════════════════════════════════════
// FAQ — Sistema inteligente de preguntas frecuentes
// ═══════════════════════════════════════════════════════════════

router.get("/faq", async (req, res) => {
  try {
    const { findSimilar, getPreseededFAQs, getTrending } = await import("../lib/faq-engine.js");
    const { q, serviceId } = req.query;
    if (q) {
      const results = findSimilar(q, serviceId);
      return res.json({ ok: true, results });
    }
    const faqs = getPreseededFAQs(serviceId);
    res.json({ ok: true, faqs, trending: getTrending(10) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/faq/stats", requireApiSecret, async (req, res) => {
  try {
    const { getFAQStats } = await import("../lib/faq-engine.js");
    res.json({ ok: true, stats: getFAQStats() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// CALENDARIO — Plazos fiscales y recordatorios
// ═══════════════════════════════════════════════════════════════

router.get("/calendar/deadlines", async (req, res) => {
  try {
    const { checkUpcomingDeadlines } = await import("../lib/calendar-reminders.js");
    const days = parseInt(req.query.days) || 30;
    const profile = req.query.profile || "all";
    const deadlines = checkUpcomingDeadlines(days, profile);
    res.json({ ok: true, deadlines });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/calendar/ics", async (req, res) => {
  try {
    const { generateICS } = await import("../lib/calendar-reminders.js");
    const profile = req.query.profile || "all";
    const ics = generateICS(profile);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="romainge-fiscal-${profile}.ics"`);
    res.send(ics);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/calendar/subscribe", async (req, res) => {
  try {
    const { subscribeToReminders } = await import("../lib/calendar-reminders.js");
    const { email, profileType, phone } = req.body;
    if (!email) return res.status(400).json({ ok: false, error: "Email requerido" });
    const sub = subscribeToReminders(email, profileType || "all", phone);
    res.json({ ok: true, subscription: sub });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// AEAT SCRAPER — Calendario actualizado
// ═══════════════════════════════════════════════════════════════

router.get("/calendar/aeat", async (req, res) => {
  try {
    const { getCachedCalendar } = await import("../lib/aeat-scraper.js");
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const calendar = await getCachedCalendar(year);
    res.json({ ok: true, year, calendar });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// FACTURACIÓN ELECTRÓNICA — TicketBAI + Verifactu
// ═══════════════════════════════════════════════════════════════

router.post("/invoicing/create", requireAuth, async (req, res) => {
  try {
    const { createInvoice } = await import("../lib/electronic-invoicing.js");
    const invoice = createInvoice(req.body);
    res.json({ ok: true, invoice });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.post("/invoicing/ticketbai", requireAuth, async (req, res) => {
  try {
    const { generateTicketBAI, validateTicketBAI } = await import("../lib/electronic-invoicing.js");
    const validation = validateTicketBAI(req.body);
    if (!validation.valid) return res.status(400).json({ ok: false, errors: validation.errors });
    const xml = generateTicketBAI(req.body);
    res.json({ ok: true, xml });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.post("/invoicing/verifactu", requireAuth, async (req, res) => {
  try {
    const { generateVerifactu, validateVerifactu } = await import("../lib/electronic-invoicing.js");
    const validation = validateVerifactu(req.body);
    if (!validation.valid) return res.status(400).json({ ok: false, errors: validation.errors });
    const record = generateVerifactu(req.body);
    res.json({ ok: true, record });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.get("/invoicing/list", requireAuth, async (req, res) => {
  try {
    const { getInvoices } = await import("../lib/electronic-invoicing.js");
    const invoices = getInvoices(req.query.nif);
    res.json({ ok: true, invoices });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// SII — Suministro Inmediato de Información
// ═══════════════════════════════════════════════════════════════

router.get("/sii/info", async (req, res) => {
  try {
    const { getSIIInfo } = await import("../lib/sii-module.js");
    res.json({ ok: true, info: getSIIInfo() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/sii/record", requireAuth, async (req, res) => {
  try {
    const { createSIIRecord, validateSIIRecord } = await import("../lib/sii-module.js");
    const { type, invoiceData } = req.body;
    const record = createSIIRecord(type, invoiceData);
    const validation = validateSIIRecord(record);
    res.json({ ok: true, record, validation });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.get("/sii/deadline", async (req, res) => {
  try {
    const { getSIIDeadlines } = await import("../lib/sii-module.js");
    const invoiceDate = req.query.date || new Date().toISOString().split("T")[0];
    const deadline = getSIIDeadlines(invoiceDate);
    res.json({ ok: true, invoiceDate, deadline });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/sii/status", requireAuth, async (req, res) => {
  try {
    const { getSIIStatus } = await import("../lib/sii-module.js");
    const { nif, period } = req.query;
    const status = getSIIStatus(nif, period);
    res.json({ ok: true, status });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// MODELOS TRIBUTARIOS — Generador automático
// ═══════════════════════════════════════════════════════════════

router.get("/forms/supported", async (req, res) => {
  try {
    const { getSupportedModels } = await import("../lib/tax-form-generator.js");
    res.json({ ok: true, models: getSupportedModels() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/forms/generate", requireAuth, async (req, res) => {
  try {
    const { generateModelo036, generateModelo303, generateModelo390, validateFormData, exportFormTXT } = await import("../lib/tax-form-generator.js");
    const { modelo, data } = req.body;
    if (!modelo || !data) return res.status(400).json({ ok: false, error: "modelo y data requeridos" });

    const validation = validateFormData(modelo, data);
    if (!validation.valid) return res.status(400).json({ ok: false, errors: validation.errors });

    let form;
    switch (modelo) {
      case "036": form = generateModelo036(data); break;
      case "303": form = generateModelo303(data); break;
      case "390": form = generateModelo390(data); break;
      default: return res.status(400).json({ ok: false, error: `Modelo ${modelo} no soportado` });
    }
    const summary = exportFormTXT(modelo, form);
    res.json({ ok: true, modelo, form, summary });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.get("/forms/:modelo/info", async (req, res) => {
  try {
    const { getFormInfo } = await import("../lib/tax-form-generator.js");
    const info = getFormInfo(req.params.modelo);
    if (!info) return res.status(404).json({ ok: false, error: "Modelo no encontrado" });
    res.json({ ok: true, info });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// FIRMA ELECTRÓNICA
// ═══════════════════════════════════════════════════════════════

router.get("/signature/fnmt/info", async (req, res) => {
  try {
    const { getCertificateTypes, getFNMTRegistrationUrl, getFNMTRenewalInfo } = await import("../lib/electronic-signature.js");
    res.json({
      ok: true,
      certificateTypes: getCertificateTypes(),
      registrationUrl: getFNMTRegistrationUrl(),
      renewalInfo: getFNMTRenewalInfo(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/signature/sign", requireAuth, async (req, res) => {
  try {
    const { signDocument } = await import("../lib/electronic-signature.js");
    const { documentPath, certificateInfo } = req.body;
    if (!documentPath || !certificateInfo) {
      return res.status(400).json({ ok: false, error: "documentPath y certificateInfo requeridos" });
    }
    const result = signDocument(documentPath, certificateInfo);
    res.json({ ok: true, signature: result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.post("/signature/verify", async (req, res) => {
  try {
    const { verifySignature } = await import("../lib/electronic-signature.js");
    const { documentPath, signatureEnvelope } = req.body;
    const result = verifySignature(documentPath, signatureEnvelope);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// COMPARADOR DE ASESORES FISCALES
// ═══════════════════════════════════════════════════════════════

router.get("/advisors", async (req, res) => {
  try {
    const { searchAdvisors } = await import("../lib/advisor-comparator.js");
    const results = searchAdvisors(req.query);
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/advisors/top", async (req, res) => {
  try {
    const { getTopRated } = await import("../lib/advisor-comparator.js");
    const results = getTopRated(req.query.ccaa, parseInt(req.query.limit) || 10);
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/advisors/near/:postalCode", async (req, res) => {
  try {
    const { getNearestAdvisors } = await import("../lib/advisor-comparator.js");
    const results = getNearestAdvisors(req.params.postalCode, parseInt(req.query.limit) || 5);
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/advisors/compare", async (req, res) => {
  try {
    const { compareAdvisors } = await import("../lib/advisor-comparator.js");
    const { id1, id2 } = req.query;
    if (!id1 || !id2) return res.status(400).json({ ok: false, error: "id1 e id2 requeridos" });
    const comparison = compareAdvisors(id1, id2);
    res.json({ ok: true, comparison });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/advisors/:id", async (req, res) => {
  try {
    const { getAdvisorById } = await import("../lib/advisor-comparator.js");
    const advisor = getAdvisorById(req.params.id);
    if (!advisor) return res.status(404).json({ ok: false, error: "Asesor no encontrado" });
    res.json({ ok: true, advisor });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// HEALTH & STATS
// ═══════════════════════════════════════════════════════════════

router.get("/health", async (req, res) => {
  const checks = {
    status: "ok",
    version: "1.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      unit: "MB",
    },
    ...getStats(),
    services: {},
  };

  // ─── Check Redis ───────────────────────────────────────────
  try {
    if (process.env.REDIS_URL) {
      const { default: Redis } = await import("ioredis");
      const redis = new Redis(process.env.REDIS_URL, {
        connectTimeout: 3000,
        lazyConnect: true,
      });
      const start = Date.now();
      await redis.ping();
      checks.services.redis = {
        status: "ok",
        latencyMs: Date.now() - start,
      };
      await redis.quit();
    } else {
      checks.services.redis = { status: "not_configured" };
    }
  } catch (err) {
    checks.services.redis = { status: "error", message: err.message };
    checks.status = "degraded";
  }

  // ─── Check PostgreSQL (Prisma) ─────────────────────────────
  try {
    if (process.env.DATABASE_URL) {
      const { prisma } = await import("../lib/prisma.js");
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      checks.services.postgresql = {
        status: "ok",
        latencyMs: Date.now() - start,
      };
    } else {
      checks.services.postgresql = { status: "not_configured" };
    }
  } catch (err) {
    checks.services.postgresql = { status: "error", message: err.message };
    checks.status = "degraded";
  }

  // ─── Check Claude API ──────────────────────────────────────
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic();
      const start = Date.now();
      // Lightweight call: count tokens (no generation)
      await client.messages.count_tokens({
        model: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
        messages: [{ role: "user", content: "ping" }],
      });
      checks.services.claude = {
        status: "ok",
        latencyMs: Date.now() - start,
        model: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
      };
    } else {
      checks.services.claude = { status: "not_configured" };
    }
  } catch (err) {
    // If count_tokens not available, try a minimal message
    try {
      if (process.env.ANTHROPIC_API_KEY) {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic();
        const start = Date.now();
        await client.messages.create({
          model: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        });
        checks.services.claude = {
          status: "ok",
          latencyMs: Date.now() - start,
          model: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
        };
      }
    } catch (err2) {
      checks.services.claude = { status: "error", message: err2.message };
      checks.status = "degraded";
    }
  }

  // ─── Check Twilio ──────────────────────────────────────────
  try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      checks.services.twilio = {
        status: "configured",
        phoneNumber: process.env.TWILIO_PHONE_NUMBER || "not_set",
      };
    } else {
      checks.services.twilio = { status: "not_configured" };
    }
  } catch {
    checks.services.twilio = { status: "error" };
  }

  const httpStatus = checks.status === "ok" ? 200 : 503;
  res.status(httpStatus).json(checks);
});

export default router;
