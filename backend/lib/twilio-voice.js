// ═══════════════════════════════════════════════════════════════
// lib/twilio-voice.js — Gestión de llamadas Twilio con IA
// ═══════════════════════════════════════════════════════════════
// Flujo: Llamada entrante → ConversationRelay (bidireccional)
//        con fallback DTMF → Agente especializado → Sesión online
// ═══════════════════════════════════════════════════════════════

import twilio from "twilio";
import { createSession, addMessage, getSession } from "./sessions-adapter.js";
import { classifyIntentAI } from "./agent-engine.js";
import { SERVICES } from "../config/services.js";
import { isAtCapacity, getQueueStats } from "./voice-queue.js";

const VoiceResponse = twilio.twiml.VoiceResponse;

const VOICE = () => process.env.TTS_VOICE || "Polly.Lucia-Neural";
const LANG  = () => process.env.STT_LANGUAGE || "es-ES";
const BASE  = () => process.env.BASE_URL || "https://romainge.com";

// ═══════════════════════════════════════════════════════════════
// 1. LLAMADA ENTRANTE — Conectar a ConversationRelay
// ═══════════════════════════════════════════════════════════════
export function handleIncomingCall(req) {
  const twiml = new VoiceResponse();
  const callerPhone = req.body.From || req.query.From || "unknown";
  const wsUrl = BASE().replace(/^http/, "ws") + "/voice-relay";

  // Connect to ConversationRelay for bidirectional real-time conversation
  const connect = twiml.connect();
  const relay = connect.conversationRelay({
    url: wsUrl,
    voice: VOICE(),
    language: LANG(),
    transcriptionProvider: "deepgram",
    speechModel: "nova-2-general",
    ttsProvider: "amazon_polly",
    dtmfDetection: "true",
    interruptible: "true",
    interruptByDtmf: "true",
    welcomeGreeting: "",
  });

  // After ConversationRelay ends (disconnect/transfer), check for human transfer
  const humanPhone = process.env.HUMAN_AGENT_PHONE;
  if (humanPhone) {
    twiml.say({ voice: VOICE(), language: LANG() },
      "Le transfiero con un agente. Un momento."
    );
    twiml.dial({ callerId: process.env.TWILIO_PHONE_NUMBER }, humanPhone);
  } else {
    twiml.say({ voice: VOICE(), language: LANG() },
      "Gracias por utilizar Romain Ge. ¡Hasta pronto!"
    );
  }

  return twiml.toString();
}

// ═══════════════════════════════════════════════════════════════
// 2. DTMF FALLBACK — Menú numérico si la voz falla
// ═══════════════════════════════════════════════════════════════
export function handleDTMFMenu(req) {
  const twiml = new VoiceResponse();
  const callerPhone = req.query.phone || req.body.From || "unknown";

  const gather = twiml.gather({
    input: "dtmf",
    numDigits: 2,
    timeout: 10,
    action: `${BASE()}/api/voice/dtmf-select?phone=${encodeURIComponent(callerPhone)}`,
    method: "POST",
  });

  gather.say({ voice: VOICE(), language: LANG() },
    "Marque el número del servicio que necesita. " +
    "1 para impuestos. 2 para aduanas. 3 para censos y NIF. " +
    "4 para certificados. 5 para recaudación. " +
    "36 para la renta 2025. 37 para IBI. " +
    "38 para modelo 303. 39 para autónomos. " +
    "O pulse estrella para volver al menú de voz."
  );

  twiml.say({ voice: VOICE(), language: LANG() },
    "No he recibido ninguna selección. Vuelva a intentarlo."
  );
  twiml.redirect(`${BASE()}/api/voice/dtmf-menu?phone=${encodeURIComponent(callerPhone)}`);

  return twiml.toString();
}

// Handle DTMF service selection
export async function handleDTMFSelect(req) {
  const twiml = new VoiceResponse();
  const callerPhone = req.query.phone || "unknown";
  const digits = req.body.Digits || "";

  if (digits === "*") {
    // Back to voice menu
    return handleIncomingCall(req);
  }

  const service = SERVICES.find(s => s.digit === digits);
  if (!service) {
    twiml.say({ voice: VOICE(), language: LANG() },
      `El número ${digits} no corresponde a ningún servicio. Inténtelo de nuevo.`
    );
    twiml.redirect(`${BASE()}/api/voice/dtmf-menu?phone=${encodeURIComponent(callerPhone)}`);
    return twiml.toString();
  }

  // Create session and connect via ConversationRelay
  const { key, session } = await createSession({
    callerName: "Cliente",
    callerLastName: "",
    callerPhone,
    serviceId: service.id,
  });

  await addMessage(session.id, "system", `Llamada DTMF. Servicio: ${service.shortName}`);

  // Connect to ConversationRelay with pre-set service
  const wsUrl = BASE().replace(/^http/, "ws") +
    `/voice-relay?sessionId=${session.id}&serviceId=${service.id}&key=${key}`;

  const connect = twiml.connect();
  connect.conversationRelay({
    url: wsUrl,
    voice: VOICE(),
    language: LANG(),
    dtmfDetection: "true",
    interruptible: "true",
    welcomeGreeting: `Le conecto con ${service.agent}, especialista en ${service.shortName}. Su clave de acceso es: ${key.split("").join(", ")}. ¿En qué puedo ayudarle?`,
  });

  return twiml.toString();
}

// ═══════════════════════════════════════════════════════════════
// 3. CALLBACK — Devolver llamada al usuario
// ═══════════════════════════════════════════════════════════════
export function handleCallbackConnect(req) {
  const twiml = new VoiceResponse();
  const name = req.query.name || "Cliente";
  const serviceId = req.query.serviceId;

  twiml.say({ voice: VOICE(), language: LANG() },
    `Hola ${name}, le llamamos de Romain Ge para atender su consulta pendiente. ` +
    `Le conecto con nuestro asistente.`
  );

  // Connect to ConversationRelay
  const wsUrl = BASE().replace(/^http/, "ws") +
    `/voice-relay?callback=true&name=${encodeURIComponent(name)}&serviceId=${encodeURIComponent(serviceId || "")}`;

  const connect = twiml.connect();
  connect.conversationRelay({
    url: wsUrl,
    voice: VOICE(),
    language: LANG(),
    dtmfDetection: "true",
    interruptible: "true",
  });

  return twiml.toString();
}

// ═══════════════════════════════════════════════════════════════
// 4. STATUS CALLBACK (monitorización)
// ═══════════════════════════════════════════════════════════════
export function handleStatusCallback(req) {
  const callSid = req.body.CallSid;
  const status = req.body.CallStatus;
  const duration = req.body.CallDuration;

  console.log(`[CALL] ${callSid} → ${status} (${duration || 0}s)`);

  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════
// 5. RECORDING — Acceso a grabaciones
// ═══════════════════════════════════════════════════════════════
export function handleRecordingStatus(req) {
  const recordingSid = req.body.RecordingSid;
  const recordingUrl = req.body.RecordingUrl;
  const callSid = req.body.CallSid;
  const duration = req.body.RecordingDuration;

  console.log(`[RECORDING] ${callSid} → ${recordingSid} (${duration}s) ${recordingUrl}`);

  // Here you could save the recording URL to the session
  return { ok: true };
}
