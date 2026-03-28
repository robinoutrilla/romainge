// ═══════════════════════════════════════════════════════════════
// lib/sessions.js — Gestión segura de sesiones
// ═══════════════════════════════════════════════════════════════
// En producción, reemplazar el store en memoria por Redis/DynamoDB

import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { encrypt, decrypt, isEncryptionEnabled } from "./encryption.js";

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

// ─── Store en memoria (usar Redis en producción) ────────────
const sessions = new Map();
const sessionsByKey = new Map(); // key+phone → sessionId

// ─── Generar clave aleatoria de una palabra ─────────────────
function generateSessionKey() {
  // Evitar colisiones: intentar hasta encontrar una clave libre
  const usedKeys = new Set([...sessionsByKey.keys()].map(k => k.split("::")[0]));
  const available = WORD_POOL.filter(w => !usedKeys.has(w));
  const pool = available.length > 0 ? available : WORD_POOL;
  return pool[crypto.randomInt(0, pool.length)];
}

// ─── Normalizar teléfono ────────────────────────────────────
function normalizePhone(phone) {
  return phone.replace(/[\s\-\(\)]/g, "").replace(/^00/, "+");
}

// ─── Crear sesión ───────────────────────────────────────────
/**
 * Create a new session with a random single-use key.
 * @param {import('../types/index.d.ts').CreateSessionInput} input
 * @returns {import('../types/index.d.ts').CreateSessionResult}
 */
export function createSession({ callerName, callerLastName, callerPhone, serviceId }) {
  const sessionId = uuidv4();
  const key = generateSessionKey();
  const phone = normalizePhone(callerPhone);
  const ttlMs = (parseInt(process.env.SESSION_TTL_HOURS) || 24) * 60 * 60 * 1000;

  const session = {
    id: sessionId,
    key,
    callerName,
    callerLastName: callerLastName || "",
    callerPhone: phone,
    serviceId,
    messages: [],        // Historial de conversación
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    active: true,
    keyUsed: false,      // Single-use token: consumed on first login
  };

  sessions.set(sessionId, session);
  sessionsByKey.set(`${key}::${phone}`, sessionId);

  return { sessionId, key, session };
}

// ─── Buscar sesión por clave + teléfono ─────────────────────
/**
 * Find and consume a session by its single-use key and phone number.
 * Returns null if the key was already used or the session expired.
 * @param {string} key - The single-use session keyword
 * @param {string} phone - Caller phone number
 * @returns {import('../types/index.d.ts').Session | null}
 */
export function findSession(key, phone) {
  const normalizedPhone = normalizePhone(phone);
  const lookupKey = `${key.toLowerCase()}::${normalizedPhone}`;
  const sessionId = sessionsByKey.get(lookupKey);

  if (!sessionId) return null;

  const session = sessions.get(sessionId);
  if (!session) return null;

  // Verificar expiración
  if (new Date(session.expiresAt) < new Date()) {
    destroySession(sessionId);
    return null;
  }

  // Single-use token: mark as used on first login
  // Subsequent logins for the same session use JWT refresh tokens
  if (session.keyUsed) {
    return null; // Key already consumed
  }

  session.keyUsed = true;
  // Remove from lookup (can't be used again)
  sessionsByKey.delete(lookupKey);

  return session;
}

// ─── Obtener sesión por ID ──────────────────────────────────
/**
 * Retrieve an active session by its UUID. Returns null if expired.
 * @param {string} sessionId
 * @returns {import('../types/index.d.ts').Session | null}
 */
export function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (new Date(session.expiresAt) < new Date()) {
    destroySession(sessionId);
    return null;
  }
  return session;
}

// ─── Añadir mensaje al historial ────────────────────────────
/**
 * Append a message to a session's conversation history.
 * Text is encrypted at rest when SESSION_ENCRYPTION_KEY is set.
 * @param {string} sessionId
 * @param {"user" | "agent" | "system"} role
 * @param {string} text - Plain text content (encrypted before storage)
 * @param {Record<string, unknown>} [metadata={}]
 * @returns {import('../types/index.d.ts').Message | null} The message with decrypted text, or null if session not found
 */
export function addMessage(sessionId, role, text, metadata = {}) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  const message = {
    id: uuidv4(),
    role,        // "user" | "agent" | "system"
    text: isEncryptionEnabled() ? encrypt(text) : text,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  session.messages.push(message);
  return { ...message, text }; // Return with decrypted text
}

// ─── Obtener historial de mensajes ──────────────────────────
/**
 * Get all messages for a session, decrypted.
 * @param {string} sessionId
 * @returns {import('../types/index.d.ts').Message[]}
 */
export function getMessages(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return [];
  return session.messages.map(m => ({
    ...m,
    text: isEncryptionEnabled() ? decrypt(m.text) : m.text,
  }));
}

// ─── Destruir sesión ────────────────────────────────────────
/**
 * Remove a session from the in-memory store.
 * @param {string} sessionId
 * @returns {void}
 */
export function destroySession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    sessionsByKey.delete(`${session.key}::${session.callerPhone}`);
    sessions.delete(sessionId);
  }
}

// ─── Limpieza periódica de sesiones expiradas ───────────────
export function cleanupExpiredSessions() {
  const now = new Date();
  for (const [id, session] of sessions) {
    if (new Date(session.expiresAt) < now) {
      destroySession(id);
    }
  }
}

// Ejecutar limpieza cada hora
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

// ─── Estadísticas ───────────────────────────────────────────
/**
 * Get summary statistics for all active sessions.
 * @returns {import('../types/index.d.ts').SessionStats}
 */
export function getStats() {
  return {
    activeSessions: sessions.size,
    oldestSession: sessions.size > 0
      ? [...sessions.values()].reduce((a, b) =>
          new Date(a.createdAt) < new Date(b.createdAt) ? a : b
        ).createdAt
      : null,
  };
}
