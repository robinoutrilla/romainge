// ═══════════════════════════════════════════════════════════════
// lib/voice-relay.js — ConversationRelay WebSocket handler
// ═══════════════════════════════════════════════════════════════
// Maneja la conversación bidireccional en tiempo real via Twilio
// ConversationRelay: recibe transcripciones, envía texto para TTS.
//
// Refactored to use VoiceStateMachine (lib/voice-state-machine.js)
// for explicit state transitions, guards, and history tracking.
// ═══════════════════════════════════════════════════════════════

import { createSession, addMessage, getSession } from "./sessions-adapter.js";
import { classifyIntentAI, generateVoiceResponse } from "./agent-engine.js";
import { classifyIntentFast } from "./agent-engine.js";
import { SERVICES, SERVICES_MAP } from "../config/services.js";
import { normalizeSpokenNIF, validateTaxId, formatNIFForVoice } from "./nif-validator.js";
import { registerCall, unregisterCall, isAtCapacity, addToQueue, requestCallback } from "./voice-queue.js";
import { createVoiceStateMachine, STATES, EVENTS } from "./voice-state-machine.js";

// ─── Language config ──────────────────────────────────────────
const LANG_CONFIG = {
  "es-ES": { voice: "Polly.Lucia-Neural", greeting: "Buenos días", name: "español" },
  "ca-ES": { voice: "Polly.Arlet-Neural", greeting: "Bon dia", name: "catalán" },
  "gl-ES": { voice: "Polly.Lucia-Neural", greeting: "Bos días", name: "gallego" },
  "eu-ES": { voice: "Polly.Lucia-Neural", greeting: "Egun on", name: "euskera" },
};

const CATALAN_MARKERS = ["bon dia", "bona tarda", "sisplau", "gràcies", "necessito", "vull", "puc", "tinc", "com puc", "on puc"];
const GALICIAN_MARKERS = ["bos días", "boa tarde", "por favor", "grazas", "necesito", "quero", "podo", "teño"];
const BASQUE_MARKERS = ["egun on", "arratsalde on", "mesedez", "eskerrik", "behar dut", "nahi dut"];

function detectLanguage(text) {
  const lower = text.toLowerCase();
  if (CATALAN_MARKERS.some(m => lower.includes(m))) return "ca-ES";
  if (GALICIAN_MARKERS.some(m => lower.includes(m))) return "gl-ES";
  if (BASQUE_MARKERS.some(m => lower.includes(m))) return "eu-ES";
  return "es-ES";
}

// ─── Voice command detection ──────────────────────────────────
const REPEAT_PHRASES = ["repetir", "repite", "otra vez", "no he entendido", "puede repetir", "repítelo", "repita"];
const HUMAN_PHRASES = ["hablar con humano", "persona real", "agente humano", "transferir", "no me entiendes", "quiero hablar con alguien", "operador", "quiero un humano"];
const NIF_TRIGGER = ["mi nif", "mi nie", "mi cif", "digo mi nif", "le digo el nif", "numero de identificacion", "identificación fiscal"];
const CALLBACK_PHRASES = ["llámame", "llamadme", "devolver llamada", "prefiero que me llamen", "callback"];

// ═══════════════════════════════════════════════════════════════
// WebSocket message senders
// ═══════════════════════════════════════════════════════════════

function sendText(ctx, text, last = true) {
  if (ctx.ws.readyState !== 1) return; // OPEN
  ctx.ws.send(JSON.stringify({ type: "text", token: text, last }));
  if (last) ctx.lastAgentResponse = text;
}

function sendEnd(ctx) {
  if (ctx.ws.readyState !== 1) return;
  ctx.ws.send(JSON.stringify({ type: "end" }));
}

function sendLanguageSwitch(ctx, language, voice) {
  if (ctx.ws.readyState !== 1) return;
  ctx.ws.send(JSON.stringify({
    type: "config",
    language,
    voice,
    transcriptionLanguage: language,
  }));
}

// ═══════════════════════════════════════════════════════════════
// Main handler — one instance per active call
// ═══════════════════════════════════════════════════════════════
export function handleVoiceRelayConnection(ws) {
  const sm = createVoiceStateMachine();
  // Bind the ws to context immediately (needed for senders before SETUP)
  sm.getContext().ws = ws;

  ws.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      await handleRelayMessage(sm, msg);
    } catch (err) {
      console.error("[RELAY] Error processing message:", err);
    }
  });

  ws.on("close", () => {
    const ctx = sm.getContext();
    console.log(`[RELAY] Connection closed: ${ctx.callSid}`);
    if (ctx.callSid) unregisterCall(ctx.callSid);
  });

  ws.on("error", (err) => {
    console.error(`[RELAY] WebSocket error: ${sm.getContext().callSid}`, err.message);
  });
}

// ─── Message router ───────────────────────────────────────────
async function handleRelayMessage(sm, msg) {
  switch (msg.type) {
    case "setup":
      await handleSetup(sm, msg);
      break;

    case "prompt":
      await handlePrompt(sm, msg);
      break;

    case "interrupt":
      // User interrupted TTS — acknowledged, no action needed
      break;

    case "dtmf":
      await handleDTMF(sm, msg);
      break;

    case "error":
      console.error(`[RELAY] Twilio error:`, msg);
      break;

    default:
      console.log(`[RELAY] Unknown message type: ${msg.type}`);
  }
}

// ─── Setup: call just connected ───────────────────────────────
async function handleSetup(sm, msg) {
  const ctx = sm.getContext();

  // Transition IDLE → GREETING (also sets callSid, callerPhone, ws)
  await sm.transition(EVENTS.SETUP, {
    callSid: msg.callSid,
    from: msg.from || "unknown",
    ws: ctx.ws,
  });

  console.log(`[RELAY] New call: ${ctx.callSid} from ${ctx.callerPhone}`);

  // Check queue capacity
  if (isAtCapacity()) {
    sendText(ctx,
      "Buenos días, bienvenido a Romain Ge. " +
      "En este momento todos nuestros agentes están ocupados. " +
      "Puede esperar en línea, o si prefiere, diga 'llámame' y le devolveremos la llamada. " +
      "También puede marcar 1 para esperar o 2 para solicitar que le llamemos.",
      true
    );
    // Stay in GREETING — queue logic handled in prompt
    return;
  }

  registerCall(ctx.callSid, {
    phone: ctx.callerPhone,
    name: null,
    serviceId: null,
  });

  // Check if recording consent is needed
  if (process.env.ENABLE_RECORDING === "true") {
    await sm.transition(EVENTS.RECORDING_CONSENT);
    ctx.recordingConsent = "pending";
    sendText(ctx,
      "Buenos días, bienvenido a Romain Ge, su asistente fiscal inteligente. " +
      "Le informamos de que esta llamada puede ser grabada con fines de calidad. " +
      "Si está de acuerdo, diga 'sí' o 'acepto'. Si no, diga 'no' y continuaremos sin grabación. " +
      "También puede marcar 1 para aceptar o 2 para rechazar.",
      true
    );
    return;
  }

  // Standard greeting — go directly to GATHER_NAME
  await sm.transition(EVENTS.NAME_PROVIDED);
  sendText(ctx,
    "Buenos días, bienvenido a Romain Ge, su asistente fiscal inteligente. " +
    "Le atenderá nuestra recepcionista virtual. " +
    "Por favor, dígame su nombre completo.",
    true
  );
}

// ─── Prompt: user speech transcription ────────────────────────
async function handlePrompt(sm, msg) {
  const ctx = sm.getContext();
  const userText = (msg.voicePrompt || "").trim();
  if (!userText) return;

  // Language detection on first utterance
  if (ctx.conversationHistory.length === 0) {
    const detected = detectLanguage(userText);
    if (detected !== "es-ES") {
      ctx.language = detected;
      const langConf = LANG_CONFIG[detected];
      sendLanguageSwitch(ctx, detected, langConf.voice);
      console.log(`[RELAY] Language detected: ${detected} for ${ctx.callSid}`);
    }
  }

  const lower = userText.toLowerCase();

  // "Repetir" command — global transition (stays in same state)
  if (REPEAT_PHRASES.some(p => lower.includes(p)) && ctx.lastAgentResponse) {
    await sm.transition(EVENTS.REPEAT);
    sendText(ctx, ctx.lastAgentResponse, true);
    return;
  }

  // "Transfer to human" command — global-ish, handled explicitly
  if (HUMAN_PHRASES.some(p => lower.includes(p))) {
    await handleTransferToHuman(sm);
    return;
  }

  // "Callback" request when in queue
  if (CALLBACK_PHRASES.some(p => lower.includes(p)) && isAtCapacity()) {
    const result = requestCallback(ctx.callerPhone, ctx.callerName || "Cliente", ctx.service?.id);
    sendText(ctx,
      result.alreadyRequested
        ? "Ya tiene una solicitud de callback registrada. Le llamaremos lo antes posible."
        : `Perfecto, le devolveremos la llamada lo antes posible. Está en la posición ${result.position} de la cola. ¡Hasta pronto!`,
      true
    );
    if (!result.alreadyRequested) {
      await sm.transition(EVENTS.CALLBACK_REQUESTED);
      setTimeout(() => sendEnd(ctx), 3000);
    }
    return;
  }

  // State-specific handling
  const currentState = sm.getState();
  switch (currentState) {
    case STATES.GREETING:
      await handleGreetingResponse(sm, userText);
      break;

    case STATES.RECORDING_CONSENT:
      await handleRecordingConsentResponse(sm, userText);
      break;

    case STATES.GATHER_NAME:
      await handleNameCapture(sm, userText);
      break;

    case STATES.GATHER_QUERY:
      await handleQueryCapture(sm, userText);
      break;

    case STATES.SPECIALIST:
      await handleSpecialistChat(sm, userText);
      break;

    case STATES.NIF_DICTATION:
      await handleNIFDictation(sm, userText);
      break;

    default:
      sendText(ctx, "Disculpe, ¿puede repetir?", true);
  }
}

// ─── Recording consent response ──────────────────────────────
async function handleRecordingConsentResponse(sm, userText) {
  const ctx = sm.getContext();
  const lower = userText.toLowerCase();

  if (lower.includes("sí") || lower.includes("acepto") || lower.includes("de acuerdo") || lower.includes("vale")) {
    await sm.transition(EVENTS.CONSENT_GIVEN);
    console.log(`[RELAY] Recording consent granted: ${ctx.callSid}`);
  } else {
    await sm.transition(EVENTS.CONSENT_DENIED);
  }

  sendText(ctx,
    "Perfecto, gracias. Por favor, dígame su nombre completo.",
    true
  );
}

// ─── Greeting / Queue handling ───────────────────────────────
async function handleGreetingResponse(sm, userText) {
  const ctx = sm.getContext();
  const lower = userText.toLowerCase();

  // Queue handling (when at capacity)
  if (isAtCapacity()) {
    if (lower.includes("esperar") || lower.includes("espero")) {
      const { position, estimatedWait } = addToQueue(ctx.callerPhone, "Cliente", null);
      const minutes = Math.ceil(estimatedWait / 60);
      sendText(ctx,
        `De acuerdo, está en la posición ${position} de la cola. ` +
        `El tiempo estimado de espera es de ${minutes} minutos. ` +
        `Por favor, permanezca en línea.`,
        true
      );
      return;
    }
    if (CALLBACK_PHRASES.some(p => lower.includes(p)) || lower.includes("llam")) {
      const result = requestCallback(ctx.callerPhone, "Cliente", null);
      sendText(ctx,
        `Le devolveremos la llamada lo antes posible. Posición: ${result.position}. ¡Hasta pronto!`,
        true
      );
      await sm.transition(EVENTS.CALLBACK_REQUESTED);
      setTimeout(() => sendEnd(ctx), 3000);
      return;
    }
  }

  // Fallback — move to gather name
  await sm.transition(EVENTS.NAME_PROVIDED);
  sendText(ctx, "Por favor, dígame su nombre completo.", true);
}

// ─── Name capture ─────────────────────────────────────────────
async function handleNameCapture(sm, userText) {
  const ctx = sm.getContext();
  const parts = userText.trim().split(" ");
  const name = parts[0] || "Estimado cliente";
  const lastName = parts.slice(1).join(" ") || "";

  await sm.transition(EVENTS.NAME_CAPTURED, { name, lastName });

  sendText(ctx,
    `Encantada, ${ctx.callerName}. He registrado su número de teléfono. ` +
    `¿En qué puedo ayudarle hoy? Descríbame brevemente su consulta. ` +
    `Si el reconocimiento de voz no funciona bien, puede marcar el número del servicio. ` +
    `Por ejemplo, marque 1 para impuestos, 2 para aduanas.`,
    true
  );
}

// ─── Query capture and classification ─────────────────────────
async function handleQueryCapture(sm, userText) {
  const ctx = sm.getContext();

  // Transition to CLASSIFYING
  await sm.transition(EVENTS.INTENT_CLASSIFIED);

  sendText(ctx, "Un momento, estoy identificando su consulta.", false);

  try {
    const service = await classifyIntentAI(userText);

    if (!service) {
      // Back to GATHER_QUERY
      await sm.transition(EVENTS.UNCLASSIFIED);
      sendText(ctx,
        "Disculpe, no he podido identificar su consulta. " +
        "¿Puede darme más detalles? Por ejemplo, impuestos, la renta, un certificado, aduanas. " +
        "También puede marcar el número del servicio en su teclado.",
        true
      );
      return;
    }

    // Create session
    const { key, session } = await createSession({
      callerName: ctx.callerName,
      callerLastName: ctx.callerLastName,
      callerPhone: ctx.callerPhone,
      serviceId: service.id,
    });

    // Transition to SPECIALIST
    await sm.transition(EVENTS.SPECIALIST_READY, {
      sessionId: session.id,
      service,
    });

    await addMessage(session.id, "system", `Llamada entrante. Consulta: "${userText}"`);

    const keySpelled = key.split("").join(", ");

    sendText(ctx,
      `Perfecto, ${ctx.callerName}. Le conecto con nuestro ${service.agent}, ` +
      `especialista en ${service.shortName}. ` +
      `Su clave de acceso para la sesión online es: ${keySpelled}. ` +
      `Repito: ${key}. ` +
      `Puede usarla junto con su número de teléfono en romain ge punto com. ` +
      `Ahora dígame, ¿en qué puedo ayudarle?`,
      true
    );
  } catch (err) {
    console.error("[RELAY] Classification error:", err);
    await sm.transition(EVENTS.UNCLASSIFIED);
    sendText(ctx, "Disculpe, ha ocurrido un error. ¿Puede repetir su consulta?", true);
  }
}

// ─── Specialist conversation ──────────────────────────────────
async function handleSpecialistChat(sm, userText) {
  const ctx = sm.getContext();
  const lower = userText.toLowerCase();

  // NIF dictation trigger
  if (NIF_TRIGGER.some(t => lower.includes(t))) {
    await sm.transition(EVENTS.NIF_REQUESTED);
    sendText(ctx,
      "Por favor, dícteme su NIF o NIE letra a letra y número a número. " +
      "Por ejemplo: equis, uno, dos, tres, cuatro, cinco, seis, siete, letra te.",
      true
    );
    return;
  }

  // Normal specialist interaction
  await addMessage(ctx.sessionId, "user", userText);

  const session = await getSession(ctx.sessionId);
  if (!session) {
    sendText(ctx, "Su sesión ha expirado. Por favor, vuelva a llamar.", true);
    await sm.transition(EVENTS.END_CALL);
    setTimeout(() => sendEnd(ctx), 2000);
    return;
  }

  const callerInfo = {
    name: session.callerName,
    lastName: session.callerLastName,
    phone: session.callerPhone,
  };

  try {
    const agentResponse = await generateVoiceResponse(
      ctx.service,
      callerInfo,
      userText,
      session.messages
    );

    await addMessage(ctx.sessionId, "agent", agentResponse);
    ctx.lastAgentResponse = agentResponse;

    sendText(ctx, agentResponse, true);
  } catch (err) {
    console.error("[RELAY] Specialist error:", err);
    sendText(ctx, "Disculpe, ha ocurrido un problema técnico. ¿Puede repetir su pregunta?", true);
  }
}

// ─── NIF dictation and validation ─────────────────────────────
async function handleNIFDictation(sm, userText) {
  const ctx = sm.getContext();
  const normalized = normalizeSpokenNIF(userText);

  if (!normalized || normalized.length < 8) {
    await sm.transition(EVENTS.NIF_INVALID);
    sendText(ctx,
      "No he podido entender el NIF completo. " +
      "Necesito la letra inicial si es NIE, seguida de 7 u 8 dígitos y la letra final. " +
      "Inténtelo de nuevo, por favor.",
      true
    );
    return;
  }

  const result = validateTaxId(normalized);

  if (result.valid) {
    const spoken = formatNIFForVoice(result.formatted);
    await sm.transition(EVENTS.NIF_VALIDATED);
    sendText(ctx,
      `He registrado su ${result.type}: ${spoken}. Es un ${result.type} válido. ` +
      `Continuamos con su consulta.`,
      true
    );

    if (ctx.sessionId) {
      await addMessage(ctx.sessionId, "user", `Mi ${result.type} es ${result.formatted}`);
    }
  } else {
    await sm.transition(EVENTS.NIF_INVALID);
    const spoken = formatNIFForVoice(normalized);
    sendText(ctx,
      `He entendido: ${spoken}, pero no parece un ${result.type || "documento"} válido. ` +
      (result.expectedLetter ? `La letra correcta sería ${result.expectedLetter}. ` : "") +
      `¿Puede repetirlo o corregirlo?`,
      true
    );
  }
}

// ─── DTMF handling ────────────────────────────────────────────
async function handleDTMF(sm, msg) {
  const ctx = sm.getContext();
  const digit = msg.digit;
  const currentState = sm.getState();

  console.log(`[RELAY] DTMF: ${digit} from ${ctx.callSid}`);

  // During recording consent
  if (currentState === STATES.RECORDING_CONSENT) {
    if (digit === "1") {
      await sm.transition(EVENTS.CONSENT_GIVEN);
    } else {
      await sm.transition(EVENTS.CONSENT_DENIED);
    }
    sendText(ctx, "Gracias. Por favor, dígame su nombre completo.", true);
    return;
  }

  // Queue handling
  if (isAtCapacity() && currentState === STATES.GREETING) {
    if (digit === "1") {
      const { position } = addToQueue(ctx.callerPhone, ctx.callerName || "Cliente", null);
      sendText(ctx, `Está en la posición ${position}. Permanezca en línea.`, true);
      return;
    }
    if (digit === "2") {
      const result = requestCallback(ctx.callerPhone, ctx.callerName || "Cliente", null);
      sendText(ctx, `Le devolveremos la llamada. Posición: ${result.position}. ¡Hasta pronto!`, true);
      await sm.transition(EVENTS.CALLBACK_REQUESTED);
      setTimeout(() => sendEnd(ctx), 3000);
      return;
    }
  }

  // Service selection by DTMF (fallback for voice recognition)
  if (currentState === STATES.GATHER_QUERY || currentState === STATES.GREETING || currentState === STATES.GATHER_NAME) {
    const service = SERVICES.find(s => s.digit === digit);
    if (service) {
      // Skip name if not captured
      if (!ctx.callerName) ctx.callerName = "Cliente";

      const { key, session } = await createSession({
        callerName: ctx.callerName,
        callerLastName: ctx.callerLastName || "",
        callerPhone: ctx.callerPhone,
        serviceId: service.id,
      });

      // Force transition through to SPECIALIST
      // For GREETING/GATHER_NAME we need intermediate transitions
      if (currentState === STATES.GREETING) {
        await sm.transition(EVENTS.NAME_PROVIDED); // → GATHER_NAME
        await sm.transition(EVENTS.NAME_CAPTURED, { name: ctx.callerName, lastName: ctx.callerLastName || "" }); // → GATHER_QUERY
        await sm.transition(EVENTS.INTENT_CLASSIFIED); // → CLASSIFYING
      } else if (currentState === STATES.GATHER_NAME) {
        await sm.transition(EVENTS.NAME_CAPTURED, { name: ctx.callerName, lastName: ctx.callerLastName || "" }); // → GATHER_QUERY
        await sm.transition(EVENTS.INTENT_CLASSIFIED); // → CLASSIFYING
      } else {
        // GATHER_QUERY
        await sm.transition(EVENTS.INTENT_CLASSIFIED); // → CLASSIFYING
      }

      await sm.transition(EVENTS.SPECIALIST_READY, {
        sessionId: session.id,
        service,
      });

      await addMessage(session.id, "system", `Llamada entrante via DTMF. Servicio: ${service.shortName}`);

      const keySpelled = key.split("").join(", ");
      sendText(ctx,
        `Le conecto con ${service.agent}, especialista en ${service.shortName}. ` +
        `Su clave es: ${keySpelled}. ¿En qué puedo ayudarle?`,
        true
      );
      return;
    }
  }

  // Star (*) = repeat last response
  if (digit === "*" && ctx.lastAgentResponse) {
    await sm.transition(EVENTS.REPEAT);
    sendText(ctx, ctx.lastAgentResponse, true);
    return;
  }

  // Hash (#) = transfer to human
  if (digit === "#") {
    await handleTransferToHuman(sm);
    return;
  }
}

// ─── Transfer to human agent ──────────────────────────────────
async function handleTransferToHuman(sm) {
  const ctx = sm.getContext();
  const humanNumber = process.env.HUMAN_AGENT_PHONE;

  if (!humanNumber) {
    sendText(ctx,
      "Lo siento, en este momento no hay operadores humanos disponibles. " +
      "Le recomiendo acceder a su sesión online en romain ge punto com " +
      "donde podrá obtener asistencia más detallada. " +
      "¿Hay algo más en lo que pueda ayudarle como asistente virtual?",
      true
    );
    // If currently in specialist, stay there; otherwise go to specialist
    // This preserves the original behavior of setting state to SPECIALIST
    if (sm.getState() !== STATES.SPECIALIST) {
      // We cannot always transition to SPECIALIST from any state, so
      // just leave the state as-is — the user can continue talking.
    }
    return;
  }

  sendText(ctx,
    "Entendido, le transfiero con un agente humano. Un momento, por favor.",
    true
  );

  await sm.transition(EVENTS.TRANSFER_REQUESTED);

  if (ctx.sessionId) {
    await addMessage(ctx.sessionId, "system", "Transferencia a agente humano solicitada");
  }

  await sm.transition(EVENTS.TRANSFERRED);
  sendEnd(ctx);
}
