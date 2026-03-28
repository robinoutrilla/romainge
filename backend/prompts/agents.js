// ═══════════════════════════════════════════════════════════════
// prompts/agents.js — System Prompts para todos los agentes IA
// Loads prompt templates from markdown files in ./agents/
// ═══════════════════════════════════════════════════════════════

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { SERVICES } from "../config/services.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const agentsDir = join(__dirname, "agents");

// ─── Load and cache markdown files at startup ──────────────────
function loadPrompt(filename) {
  return readFileSync(join(agentsDir, filename), "utf-8").trim();
}

const _cache = {
  receptionist: loadPrompt("receptionist.md"),
  specialistBase: loadPrompt("specialist-base.md"),
  classifier: loadPrompt("classifier.md"),
  specific: {
    renta2025: loadPrompt("renta2025.md"),
    cnmc: loadPrompt("cnmc.md"),
    calendario: loadPrompt("calendario.md"),
    certificados: loadPrompt("certificados.md"),
    aduanas: loadPrompt("aduanas.md"),
    ibi: loadPrompt("ibi.md"),
    modelo303: loadPrompt("modelo303.md"),
    autonomos: loadPrompt("autonomos.md"),
  },
};

// ─── Recepcionista IA ────────────────────────────────────────
export const RECEPTIONIST_PROMPT = _cache.receptionist.replace(
  "{{services}}",
  SERVICES.map((s) => `- ${s.shortName}: ${s.name}`).join("\n")
);

// ─── Generador de prompt para agente especializado ──────────
export function buildSpecialistPrompt(service, callerInfo) {
  const basePrompt = _cache.specialistBase
    .replace(/\{\{agent\}\}/g, service.agent)
    .replace(/\{\{serviceName\}\}/g, service.name)
    .replace("{{name}} {{lastName}}", `${callerInfo.name} ${callerInfo.lastName || ""}`)
    .replace(/\{\{name\}\}/g, callerInfo.name)
    .replace("{{phone}}", callerInfo.phone)
    .replace(
      "{{keywords}}",
      service.keywords.map((k) => `- ${k}`).join("\n")
    );

  const specificPrompt = _cache.specific[service.id] || "";

  return basePrompt + (specificPrompt ? "\n\n" + specificPrompt : "");
}

// ─── Prompt para clasificación de intención por IA ──────────
export const INTENT_CLASSIFIER_PROMPT = _cache.classifier.replace(
  "{{services}}",
  SERVICES.map((s) => `${s.id}: ${s.name} (${s.keywords.join(", ")})`).join("\n")
);
