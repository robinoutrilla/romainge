// ═══════════════════════════════════════════════════════════════
// tests/mocks/claude-mock.js — Mock de la API de Claude para tests
// ═══════════════════════════════════════════════════════════════

import { vi } from "vitest";

// ─── Respuestas simuladas por servicio ───────────────────────
const MOCK_RESPONSES = {
  impuestos: "El IVA general en España es del 21%. El tipo reducido es del 10% y el superreducido del 4%. Para más información, consulte el artículo 90 de la Ley 37/1992 del IVA.",
  aduanas: "Para realizar una importación, necesitará el documento DUA (Documento Único Administrativo). El despacho aduanero se tramita electrónicamente a través de la AEAT.",
  renta2025: "La campaña de la Renta 2025 comienza el 2 de abril. Puede consultar su borrador en la sede electrónica de la AEAT con Cl@ve PIN o certificado electrónico.",
  cnmc: "La Comisión Nacional de los Mercados y la Competencia supervisa el correcto funcionamiento de los mercados. Puede presentar denuncias a través de sede.cnmc.gob.es.",
  default: "Entendido. Le ayudo con su consulta. ¿Podría proporcionarme más detalles sobre su situación fiscal?",
};

// ─── Mock del clasificador de intención IA ────────────────────
const CLASSIFIER_RESPONSES = {
  "quiero saber sobre el iva": "impuestos",
  "importar productos de china": "aduanas",
  "declaracion de la renta": "renta2025",
  default: "impuestos",
};

// ─── Mock de la simulación de renta ───────────────────────────
const MOCK_RENTA_RESULT = {
  baseImponibleGeneral: 30000,
  baseImponibleAhorro: 500,
  reduccionesPersonales: 5550,
  cuotaIntegra: 5845,
  deducciones: [{ concepto: "Deducción por vivienda habitual", casilla: "547", importe: 500 }],
  deduccionesAutonomicas: [],
  cuotaLiquida: 5345,
  retencionesIngresos: 6000,
  cuotaDiferencial: -655,
  resultado: "a_devolver",
  importeResultado: 655,
  recomendaciones: ["Revise deducciones autonómicas de su comunidad"],
  casillasRelevantes: [{ casilla: "435", concepto: "Base imponible general", valor: 30000 }],
};

// ─── Mock del supervisor ──────────────────────────────────────
const MOCK_SUPERVISOR_RESULT = {
  approved: true,
  confidence: 0.85,
  issues: [],
  correctedResponse: null,
};

// ─── Crear respuesta mock de Claude API ───────────────────────
function createMockResponse(text, { inputTokens = 150, outputTokens = 80 } = {}) {
  return {
    id: `msg_mock_${Date.now()}`,
    type: "message",
    role: "assistant",
    content: [{ type: "text", text }],
    model: "claude-sonnet-4-20250514",
    stop_reason: "end_turn",
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

// ─── Stream mock ──────────────────────────────────────────────
function createMockStream(text) {
  const chunks = text.match(/.{1,20}/g) || [text];
  let index = 0;

  return {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          if (index < chunks.length) {
            const chunk = chunks[index++];
            return {
              done: false,
              value: { type: "content_block_delta", delta: { text: chunk } },
            };
          }
          return { done: true };
        },
      };
    },
  };
}

// ─── Mock del cliente Anthropic ───────────────────────────────
export function createMockAnthropicClient() {
  return {
    messages: {
      create: vi.fn(async ({ system, messages, max_tokens }) => {
        const lastMsg = messages[messages.length - 1]?.content || "";

        // Classifier requests (short max_tokens)
        if (max_tokens <= 30) {
          const text = lastMsg.toLowerCase();
          const serviceId = Object.entries(CLASSIFIER_RESPONSES).find(([key]) => text.includes(key))?.[1]
            || CLASSIFIER_RESPONSES.default;
          return createMockResponse(serviceId, { inputTokens: 50, outputTokens: 5 });
        }

        // Renta simulation
        if (system?.includes?.("IRPF español")) {
          return createMockResponse(JSON.stringify(MOCK_RENTA_RESULT), { inputTokens: 500, outputTokens: 400 });
        }

        // Supervisor
        if (system?.includes?.("supervisor fiscal")) {
          return createMockResponse(JSON.stringify(MOCK_SUPERVISOR_RESULT), { inputTokens: 300, outputTokens: 100 });
        }

        // Regular chat — find service-specific response
        const serviceKey = Object.keys(MOCK_RESPONSES).find(k =>
          (system || "").toLowerCase().includes(k)
        );
        return createMockResponse(
          MOCK_RESPONSES[serviceKey] || MOCK_RESPONSES.default,
          { inputTokens: 150, outputTokens: 80 },
        );
      }),

      stream: vi.fn(async ({ system, messages }) => {
        const serviceKey = Object.keys(MOCK_RESPONSES).find(k =>
          (system || "").toLowerCase().includes(k)
        );
        const text = MOCK_RESPONSES[serviceKey] || MOCK_RESPONSES.default;
        return createMockStream(text);
      }),
    },
  };
}

// ─── Setup: reemplazar el módulo Anthropic ────────────────────
export function setupClaudeMock() {
  const mockClient = createMockAnthropicClient();

  vi.mock("@anthropic-ai/sdk", () => ({
    default: class MockAnthropic {
      constructor() {
        return mockClient;
      }
    },
  }));

  return mockClient;
}

export { MOCK_RESPONSES, MOCK_RENTA_RESULT, MOCK_SUPERVISOR_RESULT };
