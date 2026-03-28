// ═══════════════════════════════════════════════════════════════
// lib/whatsapp.js — WhatsApp chatbot via Twilio WhatsApp API
// ═══════════════════════════════════════════════════════════════

import twilio from "twilio";
import {
  createSession,
  findSession,
  addMessage,
  getMessages,
} from "./sessions-adapter.js";
import {
  chatWithSpecialist,
  chatWithReceptionist,
  classifyIntentAI,
} from "./agent-engine.js";
import { SERVICES_MAP } from "../config/services.js";

// ─── Twilio client singleton ─────────────────────────────────
let twilioClient;
function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return twilioClient;
}

// ─── Rate limiting: max 20 messages per hour per number ──────
const rateLimits = new Map(); // phone → { count, resetAt }
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(phone) {
  const now = Date.now();
  let entry = rateLimits.get(phone);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimits.set(phone, entry);
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// Cleanup stale rate limit entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [phone, entry] of rateLimits) {
    if (now >= entry.resetAt) rateLimits.delete(phone);
  }
}, 30 * 60 * 1000);

// ─── Metrics ─────────────────────────────────────────────────
const stats = {
  messagesSent: 0,
  messagesReceived: 0,
  mediaReceived: 0,
  activeSessions: new Set(),
  rateLimited: 0,
  errors: 0,
  startedAt: Date.now(),
};

// ─── WhatsApp session mapping: phone → sessionId ─────────────
const whatsappSessions = new Map(); // phone → { sessionId, serviceId, conversationHistory }

// ─── Format response for WhatsApp ────────────────────────────
// Strip complex markdown, keep bold and simple lists
function formatForWhatsApp(text) {
  return text
    // Convert markdown headers to bold
    .replace(/^#{1,6}\s+(.+)$/gm, "*$1*")
    // Convert markdown bold **text** to WhatsApp bold *text*
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    // Convert markdown italic _text_ (keep as-is, WhatsApp uses same)
    // Convert markdown links [text](url) to text: url
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2")
    // Convert markdown code blocks to plain text
    .replace(/```[\s\S]*?```/g, (match) =>
      match.replace(/```\w*\n?/g, "").trim()
    )
    // Convert inline code to plain
    .replace(/`([^`]+)`/g, "$1")
    // Convert markdown tables to simple lines
    .replace(/\|[-:]+\|/g, "")
    .replace(/\|\s*/g, "")
    // Clean up extra blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Send WhatsApp message via Twilio ────────────────────────
export async function sendWhatsAppMessage(to, body) {
  const client = getTwilioClient();
  const from = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER}`;
  const toFormatted = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  const message = await client.messages.create({
    from,
    to: toFormatted,
    body: formatForWhatsApp(body),
  });

  stats.messagesSent++;
  return message;
}

// ─── Handle incoming WhatsApp message ────────────────────────
export async function handleIncomingWhatsApp(req, res) {
  try {
    const { From, Body, NumMedia, MediaUrl0, MediaContentType0 } = req.body;
    const phone = From.replace("whatsapp:", "");
    const messageText = (Body || "").trim();

    stats.messagesReceived++;
    stats.activeSessions.add(phone);

    // Rate limit check
    if (!checkRateLimit(phone)) {
      stats.rateLimited++;
      const twiml = new twilio.twiml.MessagingResponse();
      twiml.message("Has superado el limite de mensajes por hora (20). Por favor, espera un poco antes de enviar mas mensajes.");
      return res.type("text/xml").send(twiml.toString());
    }

    // Handle media (document uploads)
    if (parseInt(NumMedia) > 0 && MediaUrl0) {
      stats.mediaReceived++;
      // Acknowledge media receipt but focus on text interaction
      const twiml = new twilio.twiml.MessagingResponse();
      twiml.message("He recibido tu documento. Por ahora, el procesamiento de archivos solo esta disponible en la web romainge.com. Por favor, describe tu consulta por texto y te ayudo.");
      return res.type("text/xml").send(twiml.toString());
    }

    if (!messageText) {
      const twiml = new twilio.twiml.MessagingResponse();
      twiml.message("Hola, soy el asistente fiscal de RomainGE. Escribe tu consulta y te ayudare.");
      return res.type("text/xml").send(twiml.toString());
    }

    // Get or create session context
    let ctx = whatsappSessions.get(phone);

    if (!ctx) {
      // New user: create a session and start receptionist flow
      const session = await createSession({
        callerName: "WhatsApp",
        callerLastName: "",
        callerPhone: phone,
        serviceId: null,
      });

      ctx = {
        sessionId: session.id,
        serviceId: null,
        conversationHistory: [],
      };
      whatsappSessions.set(phone, ctx);
    }

    // Add user message to history
    ctx.conversationHistory.push({ role: "user", text: messageText });
    await addMessage(ctx.sessionId, { role: "user", text: messageText });

    let agentResponse;

    if (!ctx.serviceId) {
      // No service assigned yet: classify intent
      const service = await classifyIntentAI(messageText);

      if (service) {
        ctx.serviceId = service.id;
        // Respond with specialist
        agentResponse = await chatWithSpecialist(
          service,
          { phone, channel: "whatsapp" },
          ctx.conversationHistory
        );
      } else {
        // Could not classify: use receptionist
        agentResponse = await chatWithReceptionist(ctx.conversationHistory);
      }
    } else {
      // Already assigned to a service: continue with specialist
      const service = SERVICES_MAP[ctx.serviceId];
      agentResponse = await chatWithSpecialist(
        service,
        { phone, channel: "whatsapp" },
        ctx.conversationHistory
      );
    }

    // Store agent response
    ctx.conversationHistory.push({ role: "agent", text: agentResponse });
    await addMessage(ctx.sessionId, { role: "agent", text: agentResponse });

    // Send response via TwiML
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message(formatForWhatsApp(agentResponse));
    res.type("text/xml").send(twiml.toString());
  } catch (err) {
    stats.errors++;
    console.error("[WhatsApp] Error handling message:", err);
    const twiml = new twilio.twiml.MessagingResponse();
    twiml.message("Lo siento, ha ocurrido un error procesando tu mensaje. Intentalo de nuevo en unos minutos.");
    res.type("text/xml").send(twiml.toString());
  }
}

// ─── Stats ───────────────────────────────────────────────────
export function getWhatsAppStats() {
  return {
    messagesSent: stats.messagesSent,
    messagesReceived: stats.messagesReceived,
    mediaReceived: stats.mediaReceived,
    activeSessions: stats.activeSessions.size,
    rateLimited: stats.rateLimited,
    errors: stats.errors,
    uptimeMs: Date.now() - stats.startedAt,
  };
}
