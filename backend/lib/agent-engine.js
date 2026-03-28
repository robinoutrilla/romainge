// ═══════════════════════════════════════════════════════════════
// lib/agent-engine.js — Motor de agentes IA con Claude API
// ═══════════════════════════════════════════════════════════════

import { SERVICES_MAP, classifyIntent } from "../config/services.js";
import {
  RECEPTIONIST_PROMPT,
  INTENT_CLASSIFIER_PROMPT,
  buildSpecialistPrompt,
} from "../prompts/agents.js";
import { trackClaudeUsage, trackLatency } from "./metrics.js";
import { withClient, getPoolStats } from "./claude-pool.js";

export { getPoolStats };

const MODEL = () => process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";
const FAST_MODEL = () => process.env.CLAUDE_FAST_MODEL || "claude-haiku-4-5-20251001";

// ─── Chat con la recepcionista ──────────────────────────────
export async function chatWithReceptionist(conversationHistory) {
  return withClient(async (anthropic) => {
    const response = await anthropic.messages.create({
      model: MODEL(),
      max_tokens: 300, // Respuestas breves por teléfono
      system: RECEPTIONIST_PROMPT,
      messages: conversationHistory.map(m => ({
        role: m.role === "agent" ? "assistant" : "user",
        content: m.text,
      })),
    });

    return response.content[0].text;
  });
}

// ─── Clasificación rápida solo por keywords (sin API) ────────
export function classifyIntentFast(userText) {
  return classifyIntent(userText);
}

// ─── Clasificación de intención con IA (fallback) ───────────
export async function classifyIntentAI(userText) {
  // Primero intentar clasificación rápida por keywords
  const keywordMatch = classifyIntent(userText);
  if (keywordMatch) return keywordMatch;

  // Fallback: usar Haiku (rápido y barato) para clasificar
  return withClient(async (anthropic) => {
    const response = await anthropic.messages.create({
      model: FAST_MODEL(),
      max_tokens: 30,
      system: INTENT_CLASSIFIER_PROMPT,
      messages: [{ role: "user", content: userText }],
    });

    const serviceId = response.content[0].text.trim().toLowerCase();
    return SERVICES_MAP[serviceId] || null;
  });
}

// ─── Chat con agente especializado ──────────────────────────
export async function chatWithSpecialist(service, callerInfo, conversationHistory) {
  const systemPrompt = buildSpecialistPrompt(service, callerInfo);

  // Construir mensajes para Claude
  const messages = conversationHistory.map(m => ({
    role: m.role === "agent" ? "assistant" : "user",
    content: m.text,
  }));

  // Gestión de contexto: si hay muchos mensajes, resumir los antiguos
  const MAX_MESSAGES = 40;
  let finalMessages = messages;

  if (messages.length > MAX_MESSAGES) {
    const summary = await summarizeConversation(messages.slice(0, -10));
    finalMessages = [
      { role: "user", content: `[Resumen de conversación anterior: ${summary}]` },
      { role: "assistant", content: "Entendido, continúo con la conversación." },
      ...messages.slice(-10),
    ];
  }

  return withClient(async (anthropic) => {
    const startMs = Date.now();
    const response = await anthropic.messages.create({
      model: MODEL(),
      max_tokens: 500,
      system: systemPrompt,
      messages: finalMessages,
    });
    const durationMs = Date.now() - startMs;

    trackClaudeUsage({
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      model: MODEL(),
      durationMs,
      serviceId: service?.id,
    });
    trackLatency({ durationMs, model: MODEL(), endpoint: "chat" });

    return response.content[0].text;
  });
}

// ─── Chat con agente especializado (streaming) ──────────────
export async function chatWithSpecialistStream(service, callerInfo, conversationHistory, onChunk) {
  const systemPrompt = buildSpecialistPrompt(service, callerInfo);

  const messages = conversationHistory.map(m => ({
    role: m.role === "agent" ? "assistant" : "user",
    content: m.text,
  }));

  return withClient(async (anthropic) => {
    const stream = await anthropic.messages.stream({
      model: MODEL(),
      max_tokens: 500,
      system: systemPrompt,
      messages,
    });

    let fullText = "";

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta?.text) {
        fullText += event.delta.text;
        onChunk(event.delta.text);
      }
    }

    return fullText;
  });
}

// ─── Resumir conversación larga ─────────────────────────────
async function summarizeConversation(messages) {
  const transcript = messages.map(m =>
    `${m.role === "assistant" ? "Agente" : "Usuario"}: ${m.content}`
  ).join("\n");

  return withClient(async (anthropic) => {
    const response = await anthropic.messages.create({
      model: MODEL(),
      max_tokens: 300,
      system: "Resume esta conversación en 3-4 frases, manteniendo los datos clave mencionados (NIF, importes, plazos, etc.).",
      messages: [{ role: "user", content: transcript }],
    });

    return response.content[0].text;
  });
}

// ─── Generar respuesta de voz (más corta para TTS) ──────────
export async function generateVoiceResponse(service, callerInfo, userSpeech, conversationHistory) {
  const systemPrompt = buildSpecialistPrompt(service, callerInfo) + `

## Reglas adicionales para respuesta de VOZ
- Máximo 2-3 frases cortas. El usuario está al teléfono.
- No uses formato markdown, listas ni viñetas.
- Usa lenguaje natural hablado.
- Si necesitas dar información extensa, di: "Le recomiendo conectarse a su sesión online
  para ver todos los detalles y enlaces."
`;

  const messages = [
    ...conversationHistory.map(m => ({
      role: m.role === "agent" ? "assistant" : "user",
      content: m.text,
    })),
    { role: "user", content: userSpeech },
  ];

  return withClient(async (anthropic) => {
    const response = await anthropic.messages.create({
      model: FAST_MODEL(), // Haiku: más rápido para voz en tiempo real
      max_tokens: 150, // Muy corto para voz — reduce latencia TTS
      system: systemPrompt,
      messages,
    });

    return response.content[0].text;
  });
}

// ─── Agente Supervisor (verifica respuestas) ─────────────────
const SUPERVISOR_PROMPT = `Eres un supervisor fiscal experto de RomainGE. Tu trabajo es revisar
las respuestas de los agentes especializados para detectar posibles errores.

Revisa la respuesta del agente buscando:
1. **Datos incorrectos**: plazos erróneos, tipos impositivos equivocados, casillas incorrectas,
   normativa derogada o inaplicable.
2. **Información inventada**: datos que el agente no puede saber (números concretos del contribuyente
   que no ha proporcionado, resultados de cálculos no solicitados).
3. **Omisiones peligrosas**: advertencias legales que faltan, plazos críticos no mencionados,
   consecuencias de no actuar.
4. **Incoherencias**: contradicciones con datos proporcionados por el usuario en la conversación.

Responde en formato JSON:
{
  "approved": true/false,
  "confidence": 0.0-1.0,
  "issues": [{"type": "error|warning|info", "description": "..."}],
  "correctedResponse": "..." // solo si approved=false, la versión corregida
}

Si la respuesta es correcta o no puedes verificar con certeza, aprueba con confidence < 1.0.
Solo rechaza (approved: false) si encuentras un ERROR CLARO y verificable.`;

export async function supervisorCheck(agentResponse, service, conversationHistory) {
  const transcript = conversationHistory.slice(-6).map(m =>
    `${m.role === "agent" || m.role === "assistant" ? "Agente" : "Usuario"}: ${m.text || m.content}`
  ).join("\n");

  return withClient(async (anthropic) => {
    const response = await anthropic.messages.create({
      model: MODEL(),
      max_tokens: 800,
      system: SUPERVISOR_PROMPT,
      messages: [{
        role: "user",
        content: `Servicio: ${service.name}\n\nConversación reciente:\n${transcript}\n\nRespuesta del agente a revisar:\n${agentResponse}`,
      }],
    });

    try {
      const text = response.content[0].text;
      const jsonStr = text.replace(/```json\n?|```/g, "").trim();
      return JSON.parse(jsonStr);
    } catch {
      return { approved: true, confidence: 0.5, issues: [], correctedResponse: null };
    }
  });
}

// ─── Chat con specialist + supervisión opcional ──────────────
export async function chatWithSpecialistSupervised(service, callerInfo, conversationHistory) {
  const agentResponse = await chatWithSpecialist(service, callerInfo, conversationHistory);

  // Only supervise if env flag is set (to save API calls)
  if (process.env.ENABLE_SUPERVISOR !== "true") {
    return { response: agentResponse, supervised: false };
  }

  const review = await supervisorCheck(agentResponse, service, conversationHistory);

  if (!review.approved && review.correctedResponse) {
    // Append disclaimer to corrected response
    const corrected = review.correctedResponse +
      "\n\n⚠️ _Esta respuesta fue revisada y corregida por nuestro sistema de calidad._";
    return {
      response: corrected,
      supervised: true,
      review,
    };
  }

  // Add warnings as footnotes if any
  if (review.issues?.length > 0) {
    const warnings = review.issues
      .filter(i => i.type === "warning")
      .map(i => i.description);
    if (warnings.length > 0) {
      return {
        response: agentResponse + "\n\n⚠️ " + warnings.join(" "),
        supervised: true,
        review,
      };
    }
  }

  return { response: agentResponse, supervised: true, review };
}

// ─── Simulador Renta 2025 con IA ────────────────────────────
export async function rentaSimulation(declarationData) {
  return withClient(async (anthropic) => {
    const response = await anthropic.messages.create({
      model: MODEL(),
      max_tokens: 2000,
      system: `Eres un experto en IRPF español. Dado los datos de un contribuyente,
calcula una simulación de la declaración de la Renta 2025 (ejercicio fiscal 2025).
Indica las casillas relevantes del modelo 100.

## IMPORTANTE: Deducciones Autonómicas
Si el contribuyente indica su Comunidad Autónoma, aplica las deducciones autonómicas correspondientes.
Principales deducciones autonómicas por CCAA:

- **Andalucía**: alquiler vivienda habitual (hasta 500€), inversión vivienda protegida, familia numerosa (200-400€), discapacidad (100-300€), nacimiento/adopción (200€ por hijo).
- **Aragón**: nacimiento/adopción (500€ 1er hijo, 600€ 2º, 700€ 3º+), alquiler jóvenes (<35 años, hasta 300€), gastos guardería (15%, max 250€).
- **Asturias**: alquiler vivienda habitual (hasta 455€), acogimiento familiar (253€), partos múltiples (505€), familia monoparental (303€).
- **Baleares**: gastos adquisición libros texto (100-200€ por hijo), alquiler jóvenes (hasta 400€), mejora sostenibilidad vivienda (hasta 10.000€).
- **Canarias**: nacimiento/adopción (200€), gastos estudios (hasta 1.500€), alquiler (hasta 500€), donaciones culturales (hasta 150€), familia numerosa (hasta 500€).
- **Cantabria**: alquiler jóvenes (<35 años, 10% max 300€), guardería (15% max 300€), gastos enfermedad (10% max 500€), familia numerosa (300-600€).
- **Castilla-La Mancha**: nacimiento/adopción (100-900€), discapacidad (300€), gastos adquisición libros texto, alquiler jóvenes (hasta 450€).
- **Castilla y León**: familia numerosa (246-610€), nacimiento/adopción (710-1.775€), cuidado hijos <4 años (hasta 1.320€), alquiler jóvenes (hasta 459€), rehabilitación vivienda rural.
- **Cataluña**: nacimiento/adopción (150€), alquiler vivienda habitual (hasta 300€), inversión empresa nueva (30%, max 6.000€), donaciones (hasta 15%).
- **Extremadura**: adquisición vivienda jóvenes (3% max 1.000€), alquiler jóvenes (hasta 300€), trabajo dependiente (75€), partos múltiples (300€ por hijo).
- **Galicia**: nacimiento/adopción (300-1.200€), familia numerosa (250-400€), alquiler jóvenes (hasta 300€), gastos guardería (hasta 400€ por hijo).
- **Madrid**: nacimiento/adopción (600-900€), acogimiento familiar (600-900€), gastos educativos (15% uniforme, 10% enseñanza idiomas, 5% escolaridad), alquiler (<35 años, 30% max 1.000€).
- **Murcia**: gastos guardería (15% max 330€), inversión vivienda jóvenes (5%), familia numerosa (hasta 400€).
- **La Rioja**: nacimiento/adopción (150-450€), gastos escuela infantil (30% max 600€), inversión vivienda nueva jóvenes (3-5%).
- **Comunidad Valenciana**: nacimiento/adopción (270€ 1er hijo, 550€ 2º, 800€ 3º+), familia numerosa (300-600€), alquiler (15% max 550€), gastos guardería (15% max 270€), discapacidad (179-418€), material escolar (100€).
- **País Vasco**: régimen foral propio (normativa diferente, deducciones especiales por alquiler, vivienda, hijos).
- **Navarra**: régimen foral propio (deducciones propias por vivienda, hijos, actividades culturales).

Si el contribuyente NO indica CCAA, incluye en recomendaciones que seleccione su comunidad para obtener deducciones autonómicas.

Responde en formato JSON con la estructura:
{
  "baseImponibleGeneral": number,
  "baseImponibleAhorro": number,
  "reduccionesPersonales": number,
  "cuotaIntegra": number,
  "deducciones": [{"concepto": string, "casilla": string, "importe": number}],
  "deduccionesAutonomicas": [{"concepto": string, "importe": number, "ccaa": string}],
  "cuotaLiquida": number,
  "retencionesIngresos": number,
  "cuotaDiferencial": number,
  "resultado": "a_devolver" | "a_ingresar",
  "importeResultado": number,
  "recomendaciones": string[],
  "casillasRelevantes": [{"casilla": string, "concepto": string, "valor": number}]
}`,
      messages: [{
        role: "user",
        content: `Datos del contribuyente:\n${JSON.stringify(declarationData, null, 2)}`,
      }],
    });

    try {
      const text = response.content[0].text;
      const jsonStr = text.replace(/```json\n?|```/g, "").trim();
      return JSON.parse(jsonStr);
    } catch {
      return { error: "No se pudo generar la simulación", raw: response.content[0].text };
    }
  });
}
