// ═══════════════════════════════════════════════════════════════
// lib/calendar-reminders.js — Google Calendar + ICS fiscal reminders
// ═══════════════════════════════════════════════════════════════
// Integración con Google Calendar para recordatorios de plazos
// fiscales españoles. Funciona sin googleapis instalado (mock/interface).

import crypto from "crypto";

// ─── Google OAuth2 Interface (mock sin dependencia) ───────────
const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3001/api/calendar/callback";
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

let googleapisModule = null;

async function loadGoogleApis() {
  if (googleapisModule) return googleapisModule;
  try {
    googleapisModule = await import("googleapis");
    return googleapisModule;
  } catch {
    return null;
  }
}

export function getAuthUrl() {
  if (!CLIENT_ID) {
    return { error: "GOOGLE_CLIENT_ID not configured", url: null };
  }
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });
  return { error: null, url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
}

export async function handleCallback(code) {
  const gapis = await loadGoogleApis();
  if (!gapis) {
    return { error: "googleapis not installed — run npm i googleapis", tokens: null };
  }
  const { google } = gapis;
  const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  const { tokens } = await oauth2.getToken(code);
  return { error: null, tokens };
}

export async function getCalendarClient(tokens) {
  const gapis = await loadGoogleApis();
  if (!gapis) {
    return { error: "googleapis not installed", client: null };
  }
  const { google } = gapis;
  const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  oauth2.setCredentials(tokens);
  return { error: null, client: google.calendar({ version: "v3", auth: oauth2 }) };
}

// ─── Base de datos de plazos fiscales 2025 ────────────────────
const FISCAL_DEADLINES = [
  // Modelo 303 — IVA trimestral
  { model: "303", name: "IVA trimestral (1T)", date: "2025-01-20", quarter: 1, profiles: ["autonomo", "pyme"], description: "Declaración trimestral del IVA correspondiente al 4T del ejercicio anterior.", url: "https://sede.agenciatributaria.gob.es/Sede/iva/modelo-303.html" },
  { model: "303", name: "IVA trimestral (1T)", date: "2025-04-20", quarter: 1, profiles: ["autonomo", "pyme"], description: "Declaración trimestral del IVA correspondiente al 1T.", url: "https://sede.agenciatributaria.gob.es/Sede/iva/modelo-303.html" },
  { model: "303", name: "IVA trimestral (2T)", date: "2025-07-20", quarter: 2, profiles: ["autonomo", "pyme"], description: "Declaración trimestral del IVA correspondiente al 2T.", url: "https://sede.agenciatributaria.gob.es/Sede/iva/modelo-303.html" },
  { model: "303", name: "IVA trimestral (3T)", date: "2025-10-20", quarter: 3, profiles: ["autonomo", "pyme"], description: "Declaración trimestral del IVA correspondiente al 3T.", url: "https://sede.agenciatributaria.gob.es/Sede/iva/modelo-303.html" },

  // Modelo 130 — IRPF trimestral (autónomos)
  { model: "130", name: "IRPF pago fraccionado (4T anterior)", date: "2025-01-20", quarter: 4, profiles: ["autonomo"], description: "Pago fraccionado IRPF en estimación directa (4T anterior).", url: "https://sede.agenciatributaria.gob.es/Sede/irpf/modelo-130.html" },
  { model: "130", name: "IRPF pago fraccionado (1T)", date: "2025-04-20", quarter: 1, profiles: ["autonomo"], description: "Pago fraccionado IRPF en estimación directa (1T).", url: "https://sede.agenciatributaria.gob.es/Sede/irpf/modelo-130.html" },
  { model: "130", name: "IRPF pago fraccionado (2T)", date: "2025-07-20", quarter: 2, profiles: ["autonomo"], description: "Pago fraccionado IRPF en estimación directa (2T).", url: "https://sede.agenciatributaria.gob.es/Sede/irpf/modelo-130.html" },
  { model: "130", name: "IRPF pago fraccionado (3T)", date: "2025-10-20", quarter: 3, profiles: ["autonomo"], description: "Pago fraccionado IRPF en estimación directa (3T).", url: "https://sede.agenciatributaria.gob.es/Sede/irpf/modelo-130.html" },

  // Modelo 111 — Retenciones e ingresos a cuenta
  { model: "111", name: "Retenciones IRPF (4T anterior)", date: "2025-01-20", quarter: 4, profiles: ["autonomo", "pyme"], description: "Retenciones e ingresos a cuenta del IRPF sobre rendimientos del trabajo y actividades económicas.", url: "https://sede.agenciatributaria.gob.es/Sede/irpf/modelo-111.html" },
  { model: "111", name: "Retenciones IRPF (1T)", date: "2025-04-20", quarter: 1, profiles: ["autonomo", "pyme"], description: "Retenciones e ingresos a cuenta del IRPF (1T).", url: "https://sede.agenciatributaria.gob.es/Sede/irpf/modelo-111.html" },
  { model: "111", name: "Retenciones IRPF (2T)", date: "2025-07-20", quarter: 2, profiles: ["autonomo", "pyme"], description: "Retenciones e ingresos a cuenta del IRPF (2T).", url: "https://sede.agenciatributaria.gob.es/Sede/irpf/modelo-111.html" },
  { model: "111", name: "Retenciones IRPF (3T)", date: "2025-10-20", quarter: 3, profiles: ["autonomo", "pyme"], description: "Retenciones e ingresos a cuenta del IRPF (3T).", url: "https://sede.agenciatributaria.gob.es/Sede/irpf/modelo-111.html" },

  // Modelo 115 — Retenciones alquiler
  { model: "115", name: "Retenciones alquiler (4T anterior)", date: "2025-01-20", quarter: 4, profiles: ["autonomo", "pyme"], description: "Retenciones por arrendamiento de inmuebles urbanos (4T anterior).", url: "https://sede.agenciatributaria.gob.es/Sede/irpf/modelo-115.html" },
  { model: "115", name: "Retenciones alquiler (1T)", date: "2025-04-20", quarter: 1, profiles: ["autonomo", "pyme"], description: "Retenciones por arrendamiento de inmuebles urbanos (1T).", url: "https://sede.agenciatributaria.gob.es/Sede/irpf/modelo-115.html" },
  { model: "115", name: "Retenciones alquiler (2T)", date: "2025-07-20", quarter: 2, profiles: ["autonomo", "pyme"], description: "Retenciones por arrendamiento de inmuebles urbanos (2T).", url: "https://sede.agenciatributaria.gob.es/Sede/irpf/modelo-115.html" },
  { model: "115", name: "Retenciones alquiler (3T)", date: "2025-10-20", quarter: 3, profiles: ["autonomo", "pyme"], description: "Retenciones por arrendamiento de inmuebles urbanos (3T).", url: "https://sede.agenciatributaria.gob.es/Sede/irpf/modelo-115.html" },

  // Modelo 390 — Resumen anual IVA
  { model: "390", name: "Resumen anual IVA", date: "2025-01-30", quarter: 0, profiles: ["autonomo", "pyme"], description: "Declaración-resumen anual del IVA del ejercicio anterior.", url: "https://sede.agenciatributaria.gob.es/Sede/iva/modelo-390.html" },

  // Modelo 190 — Resumen anual retenciones
  { model: "190", name: "Resumen anual retenciones IRPF", date: "2025-01-31", quarter: 0, profiles: ["autonomo", "pyme"], description: "Resumen anual de retenciones e ingresos a cuenta del IRPF.", url: "https://sede.agenciatributaria.gob.es/Sede/irpf/modelo-190.html" },

  // Modelo 347 — Operaciones con terceros
  { model: "347", name: "Operaciones con terceros", date: "2025-02-28", quarter: 0, profiles: ["autonomo", "pyme"], description: "Declaración anual de operaciones con terceros superiores a 3.005,06 EUR.", url: "https://sede.agenciatributaria.gob.es/Sede/censos-nif/modelo-347.html" },

  // Modelo 349 — Operaciones intracomunitarias
  { model: "349", name: "Ops. intracomunitarias (4T anterior)", date: "2025-01-30", quarter: 4, profiles: ["autonomo", "pyme"], description: "Declaración recapitulativa de operaciones intracomunitarias (4T anterior).", url: "https://sede.agenciatributaria.gob.es/Sede/iva/modelo-349.html" },
  { model: "349", name: "Ops. intracomunitarias (1T)", date: "2025-04-20", quarter: 1, profiles: ["autonomo", "pyme"], description: "Declaración recapitulativa de operaciones intracomunitarias (1T).", url: "https://sede.agenciatributaria.gob.es/Sede/iva/modelo-349.html" },
  { model: "349", name: "Ops. intracomunitarias (2T)", date: "2025-07-20", quarter: 2, profiles: ["autonomo", "pyme"], description: "Declaración recapitulativa de operaciones intracomunitarias (2T).", url: "https://sede.agenciatributaria.gob.es/Sede/iva/modelo-349.html" },
  { model: "349", name: "Ops. intracomunitarias (3T)", date: "2025-10-20", quarter: 3, profiles: ["autonomo", "pyme"], description: "Declaración recapitulativa de operaciones intracomunitarias (3T).", url: "https://sede.agenciatributaria.gob.es/Sede/iva/modelo-349.html" },

  // Renta 2024
  { model: "100", name: "Renta 2024 — inicio campaña", date: "2025-04-02", quarter: 0, profiles: ["autonomo", "pyme", "particular"], description: "Inicio del plazo de presentación de la declaración de la Renta 2024.", url: "https://sede.agenciatributaria.gob.es/Sede/irpf.html" },
  { model: "100", name: "Renta 2024 — fin campaña", date: "2025-06-30", quarter: 0, profiles: ["autonomo", "pyme", "particular"], description: "Último día para presentar la declaración de la Renta 2024.", url: "https://sede.agenciatributaria.gob.es/Sede/irpf.html" },

  // Impuesto de Sociedades — Modelo 200
  { model: "200", name: "Impuesto de Sociedades", date: "2025-07-25", quarter: 0, profiles: ["pyme"], description: "Declaración anual del Impuesto sobre Sociedades (ejercicio anterior).", url: "https://sede.agenciatributaria.gob.es/Sede/impuesto-sociedades/modelo-200.html" },
];

// ─── Filtrado por perfil ──────────────────────────────────────
function filterByProfile(profileType) {
  if (profileType === "all") return FISCAL_DEADLINES;
  return FISCAL_DEADLINES.filter(d => d.profiles.includes(profileType));
}

// ─── Crear eventos en Google Calendar ─────────────────────────
export async function createDeadlineEvents(calendarClient, profileType = "all") {
  const deadlines = filterByProfile(profileType);
  const created = [];
  const errors = [];

  for (const dl of deadlines) {
    const event = {
      summary: `[AEAT] Modelo ${dl.model} — ${dl.name}`,
      description: `${dl.description}\n\nObligados: ${dl.profiles.join(", ")}\nMás info: ${dl.url}`,
      start: { date: dl.date, timeZone: "Europe/Madrid" },
      end: { date: dl.date, timeZone: "Europe/Madrid" },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 7 * 24 * 60 },  // 7 días antes
          { method: "popup", minutes: 7 * 24 * 60 },
          { method: "email", minutes: 1 * 24 * 60 },  // 1 día antes
          { method: "popup", minutes: 1 * 24 * 60 },
        ],
      },
      colorId: dl.model === "100" ? "10" : "11", // verde para renta, rojo para otros
    };

    try {
      const res = await calendarClient.events.insert({
        calendarId: "primary",
        resource: event,
      });
      created.push({ model: dl.model, name: dl.name, date: dl.date, eventId: res.data.id });
    } catch (err) {
      errors.push({ model: dl.model, name: dl.name, date: dl.date, error: err.message });
    }
  }

  return { created, errors, total: deadlines.length };
}

// ─── Subscripciones a recordatorios ───────────────────────────
const subscriptions = new Map(); // email → { profileType, phone, createdAt }

export function subscribeToReminders(email, profileType = "all", phone = null) {
  if (!email || !email.includes("@")) {
    return { error: "Email inválido" };
  }
  const validProfiles = ["autonomo", "pyme", "particular", "all"];
  if (!validProfiles.includes(profileType)) {
    return { error: `Perfil inválido. Usar: ${validProfiles.join(", ")}` };
  }
  const id = crypto.randomUUID();
  subscriptions.set(email, { id, profileType, phone, createdAt: new Date().toISOString() });
  return { error: null, id, email, profileType };
}

export function unsubscribeFromReminders(email) {
  if (!subscriptions.has(email)) return { error: "Email no encontrado" };
  subscriptions.delete(email);
  return { error: null, email };
}

export function listSubscriptions() {
  return [...subscriptions.entries()].map(([email, data]) => ({ email, ...data }));
}

// ─── Plazos próximos ──────────────────────────────────────────
export function checkUpcomingDeadlines(daysAhead = 7, profileType = "all") {
  const now = new Date();
  const limit = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const deadlines = filterByProfile(profileType);

  return deadlines
    .filter(dl => {
      const d = new Date(dl.date + "T23:59:59+01:00"); // CET
      return d >= now && d <= limit;
    })
    .map(dl => {
      const d = new Date(dl.date + "T23:59:59+01:00");
      const diffMs = d.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
      return { ...dl, daysLeft };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

// ─── Generación ICS (RFC 5545) ────────────────────────────────
function escapeICS(text) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function formatICSDate(dateStr) {
  return dateStr.replace(/-/g, "");
}

export function generateICS(profileType = "all") {
  const deadlines = filterByProfile(profileType);
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const events = deadlines.map(dl => {
    const uid = crypto.createHash("sha256").update(`romainge-${dl.model}-${dl.date}`).digest("hex").slice(0, 24);
    const dtstart = formatICSDate(dl.date);
    // All-day event: DTEND is the next day
    const endDate = new Date(dl.date);
    endDate.setDate(endDate.getDate() + 1);
    const dtend = formatICSDate(endDate.toISOString().split("T")[0]);

    return [
      "BEGIN:VEVENT",
      `UID:${uid}@romainge.com`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${dtstart}`,
      `DTEND;VALUE=DATE:${dtend}`,
      `SUMMARY:${escapeICS(`[AEAT] Modelo ${dl.model} — ${dl.name}`)}`,
      `DESCRIPTION:${escapeICS(`${dl.description}\\nObligados: ${dl.profiles.join(", ")}\\n${dl.url}`)}`,
      `URL:${dl.url}`,
      "BEGIN:VALARM",
      "TRIGGER:-P7D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeICS(`Quedan 7 días para Modelo ${dl.model}`)}`,
      "END:VALARM",
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeICS(`MAÑANA vence Modelo ${dl.model}`)}`,
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n");
  });

  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RomainGE//Calendario Fiscal ES//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Plazos Fiscales AEAT 2025",
    "X-WR-TIMEZONE:Europe/Madrid",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return calendar;
}

// ─── Exportar la base de datos de plazos ──────────────────────
export function getDeadlines(profileType = "all") {
  return filterByProfile(profileType);
}
