// ═══════════════════════════════════════════════════════════════
// lib/sessions-pg.js — Sesiones con PostgreSQL (Prisma)
// ═══════════════════════════════════════════════════════════════
// Reemplaza sessions.js / sessions-redis.js cuando usas PostgreSQL.
// Soporta soft-delete con retención de 90 días.

import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { encrypt, decrypt, isEncryptionEnabled } from "./encryption.js";
import prisma from "./prisma.js";

const WORD_POOL = [
  "aurora", "brisa", "coral", "delta", "eco", "faro", "gema", "halo",
  "iris", "jade", "kite", "luna", "menta", "nube", "olivo", "perla",
  "quasar", "roca", "sol", "tigre", "umbral", "vela", "xenon", "yuca",
  "zafiro", "ambar", "bosque", "cielo", "duna", "estrella", "fuego",
  "glaciar", "hierro", "isla", "jungla", "karma", "lago", "monte",
  "nieve", "onda", "pino", "rio", "selva", "trueno", "volcan",
  "alba", "campo", "flor", "gota", "humo", "lava", "mar", "norte",
  "oeste", "playa", "rayos", "sur", "torre", "valle", "zinc",
];

const TTL_MS = () => (parseInt(process.env.SESSION_TTL_HOURS) || 24) * 3600 * 1000;
const RETENTION_DAYS = parseInt(process.env.SESSION_RETENTION_DAYS) || 90;

function normalizePhone(phone) {
  return phone.replace(/[\s\-\(\)]/g, "").replace(/^00/, "+");
}

function generateSessionKey() {
  return WORD_POOL[crypto.randomInt(0, WORD_POOL.length)];
}

// ─── Crear sesión ───────────────────────────────────────────
export async function createSession({ callerName, callerLastName, callerPhone, serviceId, tenantId }) {
  const key = generateSessionKey();
  const phone = normalizePhone(callerPhone);
  const ttl = TTL_MS();

  const session = await prisma.session.create({
    data: {
      key,
      callerName,
      callerLastName: callerLastName || "",
      callerPhone: phone,
      serviceId,
      tenantId: tenantId || null,
      expiresAt: new Date(Date.now() + ttl),
    },
  });

  return { sessionId: session.id, key, session: formatSession(session) };
}

// ─── Buscar sesión por clave + teléfono (single-use) ─────────
export async function findSession(key, phone) {
  const normalizedPhone = normalizePhone(phone);

  const session = await prisma.session.findFirst({
    where: {
      key: key.toLowerCase(),
      callerPhone: normalizedPhone,
      keyUsed: false,
      active: true,
      deletedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!session) return null;

  // Mark key as used (single-use token)
  await prisma.session.update({
    where: { id: session.id },
    data: { keyUsed: true },
  });

  return formatSession(session);
}

// ─── Obtener sesión por ID ──────────────────────────────────
export async function getSession(sessionId) {
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      deletedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!session) return null;
  return formatSession(session);
}

// ─── Añadir mensaje ─────────────────────────────────────────
export async function addMessage(sessionId, role, text, metadata = {}) {
  const encryptedText = isEncryptionEnabled() ? encrypt(text) : text;

  const message = await prisma.message.create({
    data: {
      sessionId,
      role,
      text: encryptedText,
      textPlain: text, // Plaintext for full-text search
      metadata,
    },
  });

  return { ...formatMessage(message), text };
}

// ─── Obtener mensajes ───────────────────────────────────────
export async function getMessages(sessionId) {
  const messages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });

  return messages.map((m) => ({
    ...formatMessage(m),
    text: isEncryptionEnabled() && m.text.startsWith("enc:") ? decrypt(m.text) : m.text,
  }));
}

// ─── Soft-delete sesión ─────────────────────────────────────
export async function destroySession(sessionId) {
  const retentionUntil = new Date(Date.now() + RETENTION_DAYS * 24 * 3600 * 1000);

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      deletedAt: new Date(),
      retentionUntil,
      active: false,
    },
  });
}

// ─── Restaurar sesión soft-deleted ──────────────────────────
export async function restoreSession(sessionId) {
  const session = await prisma.session.findFirst({
    where: {
      id: sessionId,
      deletedAt: { not: null },
      retentionUntil: { gt: new Date() },
    },
  });

  if (!session) return null;

  const restored = await prisma.session.update({
    where: { id: sessionId },
    data: {
      deletedAt: null,
      retentionUntil: null,
      active: true,
    },
  });

  return formatSession(restored);
}

// ─── Hard-delete: purgar sesiones expiradas de retención ────
export async function purgeExpiredRetention() {
  const result = await prisma.session.deleteMany({
    where: {
      retentionUntil: { lt: new Date() },
      deletedAt: { not: null },
    },
  });
  return result.count;
}

// ─── Estadísticas ───────────────────────────────────────────
export async function getStats() {
  const [activeSessions, deletedSessions] = await Promise.all([
    prisma.session.count({ where: { active: true, deletedAt: null } }),
    prisma.session.count({ where: { deletedAt: { not: null }, retentionUntil: { gt: new Date() } } }),
  ]);

  return { activeSessions, softDeletedSessions: deletedSessions };
}

// ─── Limpieza periódica ─────────────────────────────────────
export async function cleanupExpiredSessions() {
  // Soft-delete expired sessions
  await prisma.session.updateMany({
    where: {
      expiresAt: { lt: new Date() },
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
      retentionUntil: new Date(Date.now() + RETENTION_DAYS * 24 * 3600 * 1000),
      active: false,
    },
  });

  // Purge past retention
  await purgeExpiredRetention();
}

// ─── Helpers ────────────────────────────────────────────────
function formatSession(s) {
  return {
    id: s.id,
    key: s.key,
    callerName: s.callerName,
    callerLastName: s.callerLastName,
    callerPhone: s.callerPhone,
    serviceId: s.serviceId,
    active: s.active,
    keyUsed: s.keyUsed,
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    tenantId: s.tenantId,
  };
}

function formatMessage(m) {
  return {
    id: m.id,
    role: m.role,
    text: m.text,
    timestamp: m.createdAt.toISOString(),
    ...(typeof m.metadata === "object" && m.metadata !== null ? m.metadata : {}),
  };
}
