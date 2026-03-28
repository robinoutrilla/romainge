// ═══════════════════════════════════════════════════════════════
// lib/sessions-adapter.js — Auto-selects PostgreSQL, Redis, or in-memory sessions
// ═══════════════════════════════════════════════════════════════
// Priority: DATABASE_URL (PostgreSQL) > REDIS_URL (Redis) > in-memory

let mod;
if (process.env.DATABASE_URL) {
  mod = await import("./sessions-pg.js");
  console.log("📦 Sessions: PostgreSQL (Prisma)");
} else if (process.env.REDIS_URL) {
  mod = await import("./sessions-redis.js");
  console.log("📦 Sessions: Redis (production)");
} else {
  mod = await import("./sessions.js");
  console.log("📦 Sessions: In-memory (development)");
}

export const createSession = mod.createSession;
export const findSession = mod.findSession;
export const getSession = mod.getSession;
export const addMessage = mod.addMessage;
export const getMessages = mod.getMessages;
export const destroySession = mod.destroySession;
export const getStats = mod.getStats;
export const cleanupExpiredSessions = mod.cleanupExpiredSessions;

// PostgreSQL-only exports (soft-delete, restore)
export const restoreSession = mod.restoreSession || (() => null);
export const purgeExpiredRetention = mod.purgeExpiredRetention || (() => 0);
