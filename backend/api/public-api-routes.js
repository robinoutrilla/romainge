// ═══════════════════════════════════════════════════════════════
// api/public-api-routes.js — Public API v1 for third-party integrations
// ═══════════════════════════════════════════════════════════════

import { Router } from "express";
import { requireApiKey, hasPermission } from "../lib/api-keys.js";
import { SERVICES, SERVICES_MAP, classifyIntent } from "../config/services.js";
import { chatWithSpecialist, classifyIntentAI } from "../lib/agent-engine.js";
import { simularRenta } from "../lib/renta-simulator.js";
import { validateTaxId } from "../lib/nif-validator.js";
import { getDeadlines, checkUpcomingDeadlines } from "../lib/calendar-reminders.js";

const router = Router();

// All routes require a valid API key
router.use(requireApiKey);

// ─── Standard JSON response helpers ───────────────────────────
function ok(res, data) {
  return res.json({ ok: true, data });
}

function fail(res, status, error) {
  return res.status(status).json({ ok: false, error });
}

function requirePerm(req, res, permission) {
  if (!hasPermission(req, permission)) {
    fail(res, 403, `Missing permission: ${permission}`);
    return false;
  }
  return true;
}

// ─── GET /api/v1/health — API status ──────────────────────────
router.get("/health", (_req, res) => {
  ok(res, {
    status: "operational",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    services: SERVICES.length,
  });
});

// ─── GET /api/v1/services — List all services ─────────────────
router.get("/services", (req, res) => {
  if (!requirePerm(req, res, "services:read")) return;

  const services = SERVICES.map(s => ({
    id: s.id,
    name: s.name,
    shortName: s.shortName,
    agent: s.agent,
  }));
  ok(res, { services, total: services.length });
});

// ─── POST /api/v1/chat — Send message to agent ───────────────
router.post("/chat", async (req, res) => {
  if (!requirePerm(req, res, "chat:write")) return;

  const { serviceId, message, sessionToken } = req.body;
  if (!serviceId || !message) {
    return fail(res, 400, "serviceId and message are required");
  }

  const service = SERVICES_MAP[serviceId];
  if (!service) {
    return fail(res, 400, `Unknown service: ${serviceId}. Use GET /api/v1/services for valid IDs.`);
  }

  try {
    // Build a minimal conversation history
    const conversationHistory = [];
    if (sessionToken) {
      // sessionToken carries previous context (opaque to the caller)
      try {
        const decoded = JSON.parse(Buffer.from(sessionToken, "base64url").toString("utf8"));
        if (Array.isArray(decoded)) {
          conversationHistory.push(...decoded);
        }
      } catch {
        // Invalid token — start fresh
      }
    }
    conversationHistory.push({ role: "user", content: message });

    const callerInfo = { channel: "api", app: req.apiApp.appName };
    const response = await chatWithSpecialist(service, callerInfo, conversationHistory);

    conversationHistory.push({ role: "assistant", content: response });

    // Keep only last 20 messages to avoid token overflow
    const trimmed = conversationHistory.slice(-20);
    const newToken = Buffer.from(JSON.stringify(trimmed)).toString("base64url");

    ok(res, { response, sessionToken: newToken, serviceId });
  } catch (err) {
    fail(res, 500, `Chat error: ${err.message}`);
  }
});

// ─── POST /api/v1/classify — Classify user intent ────────────
router.post("/classify", async (req, res) => {
  if (!requirePerm(req, res, "services:read")) return;

  const { message } = req.body;
  if (!message) {
    return fail(res, 400, "message is required");
  }

  try {
    // Fast keyword classifier first
    const fast = classifyIntent(message);
    if (fast) {
      return ok(res, {
        serviceId: fast.id,
        serviceName: fast.name,
        confidence: "high",
        method: "keyword",
      });
    }

    // Fallback to AI classifier
    const aiResult = await classifyIntentAI(message);
    if (aiResult) {
      const service = SERVICES_MAP[aiResult];
      return ok(res, {
        serviceId: aiResult,
        serviceName: service ? service.name : aiResult,
        confidence: "medium",
        method: "ai",
      });
    }

    ok(res, { serviceId: null, serviceName: null, confidence: "none", method: "none" });
  } catch (err) {
    fail(res, 500, `Classification error: ${err.message}`);
  }
});

// ─── POST /api/v1/renta/simulate — IRPF simulation ───────────
router.post("/renta/simulate", (req, res) => {
  if (!requirePerm(req, res, "renta:simulate")) return;

  const { ingresos, ccaa, situacion, hijos, discapacidad, hipoteca, alquiler, donaciones, planes_pensiones } = req.body;
  if (ingresos === undefined || ingresos === null) {
    return fail(res, 400, "ingresos is required");
  }

  try {
    const result = simularRenta({
      ingresos: Number(ingresos),
      ccaa: ccaa || "general",
      situacion: situacion || "soltero",
      hijos: Number(hijos) || 0,
      discapacidad: Number(discapacidad) || 0,
      hipoteca: Number(hipoteca) || 0,
      alquiler: Number(alquiler) || 0,
      donaciones: Number(donaciones) || 0,
      planes_pensiones: Number(planes_pensiones) || 0,
    });
    ok(res, result);
  } catch (err) {
    fail(res, 500, `Simulation error: ${err.message}`);
  }
});

// ─── GET /api/v1/calendar — Fiscal calendar ──────────────────
router.get("/calendar", (req, res) => {
  if (!requirePerm(req, res, "calendar:read")) return;

  const profile = req.query.profile || "all";
  try {
    const deadlines = getDeadlines(profile);
    ok(res, { profile, deadlines });
  } catch (err) {
    fail(res, 500, `Calendar error: ${err.message}`);
  }
});

// ─── GET /api/v1/calendar/upcoming — Upcoming deadlines ──────
router.get("/calendar/upcoming", (req, res) => {
  if (!requirePerm(req, res, "calendar:read")) return;

  const days = parseInt(req.query.days, 10) || 7;
  const profile = req.query.profile || "all";
  try {
    const upcoming = checkUpcomingDeadlines(days, profile);
    ok(res, { days, profile, deadlines: upcoming });
  } catch (err) {
    fail(res, 500, `Calendar error: ${err.message}`);
  }
});

// ─── GET /api/v1/faq — FAQ by service ────────────────────────
router.get("/faq", (req, res) => {
  if (!requirePerm(req, res, "faq:read")) return;

  const { serviceId } = req.query;
  const faqs = getFAQs(serviceId || null);
  ok(res, { serviceId: serviceId || "all", faqs });
});

// ─── GET /api/v1/faq/search — Search FAQ ────────────────────
router.get("/faq/search", (req, res) => {
  if (!requirePerm(req, res, "faq:read")) return;

  const { q } = req.query;
  if (!q) {
    return fail(res, 400, "q (query) parameter is required");
  }

  const results = searchFAQs(q);
  ok(res, { query: q, results });
});

// ─── POST /api/v1/nif/validate — Validate NIF/NIE/CIF ───────
router.post("/nif/validate", (req, res) => {
  if (!requirePerm(req, res, "services:read")) return;

  const { nif } = req.body;
  if (!nif) {
    return fail(res, 400, "nif is required");
  }

  const result = validateTaxId(nif);
  ok(res, result);
});

// ═══════════════════════════════════════════════════════════════
// Built-in FAQ data (no external dependency needed)
// ═══════════════════════════════════════════════════════════════

const FAQ_DATA = [
  { serviceId: "renta2025", q: "Cuando empieza la campana de Renta 2025?", a: "La campana de Renta 2025 comienza el 2 de abril de 2026 para presentacion por internet, y el 5 de mayo para atencion telefonica." },
  { serviceId: "renta2025", q: "Que documentos necesito para hacer la Renta?", a: "Necesitas: DNI/NIE, datos fiscales (Renta WEB), certificados de retenciones, datos de inmuebles (referencia catastral), y justificantes de deducciones." },
  { serviceId: "renta2025", q: "Como obtengo el borrador de la Renta?", a: "Accede a Renta WEB en sede.agenciatributaria.gob.es con Cl@ve, certificado digital o referencia. El borrador estara disponible desde el 2 de abril." },
  { serviceId: "impuestos", q: "Que es el IVA y cuales son los tipos?", a: "El IVA es el Impuesto sobre el Valor Anadido. Tipos: general 21%, reducido 10%, superreducido 4%." },
  { serviceId: "impuestos", q: "Cuando se presenta el modelo 303?", a: "Trimestralmente: 1-20 de abril (1T), julio (2T), octubre (3T) y 1-30 de enero (4T). Grandes empresas mensualmente." },
  { serviceId: "autonomos", q: "Cual es la cuota de autonomos en 2025?", a: "En 2025 la cuota depende de los rendimientos netos. La cuota minima es de 230 EUR/mes y la maxima de 530 EUR/mes, con tarifa plana de 80 EUR los primeros 12 meses para nuevos autonomos." },
  { serviceId: "autonomos", q: "Que modelos debe presentar un autonomo?", a: "Modelo 130 (IRPF trimestral), modelo 303 (IVA trimestral), modelo 390 (resumen anual IVA), declaracion de Renta anual, y modelo 036/037 para alta censal." },
  { serviceId: "certificados", q: "Como obtengo un certificado de estar al corriente?", a: "Puedes obtenerlo en sede.agenciatributaria.gob.es con certificado digital o Cl@ve. Tambien presencialmente con cita previa en oficinas de la AEAT." },
  { serviceId: "clave", q: "Como me registro en Cl@ve?", a: "Puedes registrarte online con certificado electronico o DNIe, por videollamada, o presencialmente en oficinas de la AEAT, Seguridad Social o ayuntamientos adheridos." },
  { serviceId: "cita", q: "Como pido cita previa en la AEAT?", a: "Llama al 901 200 351 o al 91 290 13 40, o accede a sede.agenciatributaria.gob.es > Cita previa. Necesitas DNI/NIE." },
  { serviceId: "modelo303", q: "Que gastos puedo deducir en el modelo 303?", a: "Puedes deducir el IVA soportado en compras y gastos necesarios para la actividad: suministros, material, servicios profesionales, alquiler del local, etc." },
  { serviceId: "censos", q: "Que es el modelo 036 y 037?", a: "Son declaraciones censales. El 036 es el completo (sociedades y todos los casos) y el 037 es el simplificado (autonomos personas fisicas con requisitos simples)." },
  { serviceId: "recaudacion", q: "Puedo aplazar el pago de impuestos?", a: "Si, puedes solicitar aplazamiento o fraccionamiento en sede electrónica. Deudas hasta 50.000 EUR no requieren garantia. Se aplican intereses de demora." },
  { serviceId: "notificaciones", q: "Que es la DEH?", a: "La Direccion Electronica Habilitada (DEH) es un buzon electronico donde la AEAT deposita notificaciones. Es obligatoria para sociedades y opcional para personas fisicas." },
  { serviceId: "ibi", q: "Quien debe pagar el IBI?", a: "El propietario del inmueble a 1 de enero del ano fiscal. Incluso si vendes el inmueble despues, debes pagar el IBI de ese ano completo." },
  { serviceId: "vies", q: "Que es el VIES?", a: "El VIES (VAT Information Exchange System) permite verificar la validez de numeros de IVA intracomunitarios para operaciones dentro de la UE." },
];

function getFAQs(serviceId) {
  if (!serviceId) return FAQ_DATA;
  return FAQ_DATA.filter(f => f.serviceId === serviceId);
}

function searchFAQs(query) {
  const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return FAQ_DATA.filter(f => {
    const text = (f.q + " " + f.a).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return q.split(/\s+/).every(word => text.includes(word));
  });
}

export default router;
