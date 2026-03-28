// ═══════════════════════════════════════════════════════════════
// lib/sessions-redis.js — Sesiones con Redis para producción
// ═══════════════════════════════════════════════════════════════
// Reemplaza sessions.js cuando necesites escalabilidad real.
// Usa Upstash Redis (serverless) o Redis Cloud.
//
// npm install ioredis
// Añadir a .env: REDIS_URL=redis://default:xxxxx@eu1-xxxxx.upstash.io:6379
// ═══════════════════════════════════════════════════════════════

import Redis from "ioredis";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { encrypt, decrypt, isEncryptionEnabled } from "./encryption.js";

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  tls: process.env.REDIS_URL?.startsWith("rediss://") ? {} : undefined,
});

redis.on("error", (err) => console.error("Redis error:", err));
redis.on("connect", () => console.log("✅ Redis connected"));

const WORD_POOL = [
  "aurora", "brisa", "coral", "delta", "eco", "faro", "gema", "halo",
  "iris", "jade", "kite", "luna", "menta", "nube", "olivo", "perla",
  "quasar", "roca", "sol", "tigre", "umbral", "vela", "xenon", "yuca",
  "zafiro", "ambar", "bosque", "cielo", "duna", "estrella", "fuego",
  "glaciar", "hierro", "isla", "jungla", "karma", "lago", "monte",
  "nieve", "onda", "pino", "rio", "selva", "trueno", "volcan",
];

const TTL = () => (parseInt(process.env.SESSION_TTL_HOURS) || 24) * 3600;

function normalizePhone(phone) {
  return phone.replace(/[\s\-\(\)]/g, "").replace(/^00/, "+");
}

function generateSessionKey() {
  return WORD_POOL[crypto.randomInt(0, WORD_POOL.length)];
}

// ─── Keys ───────────────────────────────────────────────────
const sessionKey = (id) => `session:${id}`;
const lookupKey = (key, phone) => `lookup:${key.toLowerCase()}:${phone}`;
const messagesKey = (id) => `messages:${id}`;
const statsKey = () => "stats:sessions";

// ─── Crear sesión ───────────────────────────────────────────
export async function createSession({ callerName, callerLastName, callerPhone, serviceId }) {
  const sessionId = uuidv4();
  const key = generateSessionKey();
  const phone = normalizePhone(callerPhone);
  const ttl = TTL();

  const session = {
    id: sessionId,
    key,
    callerName,
    callerLastName: callerLastName || "",
    callerPhone: phone,
    serviceId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    active: true,
  };

  const pipeline = redis.pipeline();
  pipeline.set(sessionKey(sessionId), JSON.stringify(session), "EX", ttl);
  pipeline.set(lookupKey(key, phone), sessionId, "EX", ttl);
  pipeline.incr(statsKey());
  await pipeline.exec();

  return { sessionId, key, session };
}

// ─── Buscar sesión por clave + teléfono (single-use) ─────────
export async function findSession(key, phone) {
  const normalizedPhone = normalizePhone(phone);
  const lk = lookupKey(key, normalizedPhone);

  // Atomically get and delete the lookup key (single-use token)
  const sessionId = await redis.getdel(lk);
  if (!sessionId) return null;

  return getSession(sessionId);
}

// ─── Obtener sesión por ID ──────────────────────────────────
export async function getSession(sessionId) {
  const data = await redis.get(sessionKey(sessionId));
  if (!data) return null;
  return JSON.parse(data);
}

// ─── Añadir mensaje ─────────────────────────────────────────
export async function addMessage(sessionId, role, text, metadata = {}) {
  const encryptedText = isEncryptionEnabled() ? encrypt(text) : text;
  const message = {
    id: uuidv4(),
    role,
    text: encryptedText,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  await redis.rpush(messagesKey(sessionId), JSON.stringify(message));
  await redis.expire(messagesKey(sessionId), TTL());

  return { ...message, text }; // Return with original plaintext
}

// ─── Obtener mensajes ───────────────────────────────────────
export async function getMessages(sessionId) {
  const msgs = await redis.lrange(messagesKey(sessionId), 0, -1);
  return msgs.map(m => {
    const parsed = JSON.parse(m);
    return {
      ...parsed,
      text: isEncryptionEnabled() ? decrypt(parsed.text) : parsed.text,
    };
  });
}

// ─── Destruir sesión ────────────────────────────────────────
export async function destroySession(sessionId) {
  const session = await getSession(sessionId);
  if (!session) return;

  const pipeline = redis.pipeline();
  pipeline.del(sessionKey(sessionId));
  pipeline.del(lookupKey(session.key, session.callerPhone));
  pipeline.del(messagesKey(sessionId));
  pipeline.decr(statsKey());
  await pipeline.exec();
}

// ─── Stats ──────────────────────────────────────────────────
export async function getStats() {
  const count = await redis.get(statsKey());
  return { activeSessions: parseInt(count) || 0 };
}

// No necesitamos cleanup: Redis TTL se encarga automáticamente
export function cleanupExpiredSessions() {}

export default redis;
