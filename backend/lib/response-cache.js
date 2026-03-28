// ═══════════════════════════════════════════════════════════════
// lib/response-cache.js — Caché Redis para respuestas frecuentes
// ═══════════════════════════════════════════════════════════════
// Cachea respuestas de agentes por servicio + hash del mensaje.
// Reduce llamadas a Claude API para preguntas repetitivas.

import crypto from "crypto";

const CACHE_TTL = parseInt(process.env.RESPONSE_CACHE_TTL) || 3600; // 1h default
const CACHE_MAX_SIZE = parseInt(process.env.RESPONSE_CACHE_MAX_SIZE) || 500;
const MIN_QUERY_LENGTH = 10; // Don't cache very short queries

// ─── In-memory LRU cache (fallback when no Redis) ──────────
class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key, value, ttl) {
    if (this.cache.size >= this.maxSize) {
      // Evict oldest (first key)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
  }

  del(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

// ─── Redis cache adapter ────────────────────────────────────
class RedisCache {
  constructor(redis) {
    this.redis = redis;
  }

  async get(key) {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key, value, ttl) {
    await this.redis.set(key, JSON.stringify(value), "EX", ttl);
  }

  async del(key) {
    await this.redis.del(key);
  }
}

// ─── Initialize cache backend ───────────────────────────────
let cache;
let redisInstance;

async function getCache() {
  if (cache) return cache;

  if (process.env.REDIS_URL) {
    try {
      const Redis = (await import("ioredis")).default;
      redisInstance = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 2,
        tls: process.env.REDIS_URL.startsWith("rediss://") ? {} : undefined,
        keyPrefix: "rcache:",
      });
      cache = new RedisCache(redisInstance);
      console.log("📦 Response cache: Redis");
    } catch {
      cache = new LRUCache(CACHE_MAX_SIZE);
      console.log("📦 Response cache: In-memory LRU (Redis unavailable)");
    }
  } else {
    cache = new LRUCache(CACHE_MAX_SIZE);
    console.log("📦 Response cache: In-memory LRU");
  }

  return cache;
}

// ─── Cache key generation ───────────────────────────────────
function cacheKey(serviceId, messageText) {
  const normalized = messageText
    .toLowerCase()
    .trim()
    .replace(/[^\wáéíóúñü\s]/g, "")
    .replace(/\s+/g, " ");

  const hash = crypto.createHash("md5").update(normalized).digest("hex").slice(0, 12);
  return `resp:${serviceId}:${hash}`;
}

// ─── Get cached response ────────────────────────────────────
export async function getCachedResponse(serviceId, messageText) {
  if (!serviceId || !messageText || messageText.length < MIN_QUERY_LENGTH) return null;

  const c = await getCache();
  const key = cacheKey(serviceId, messageText);
  const cached = await c.get(key);

  if (cached) {
    cached.fromCache = true;
    return cached;
  }

  return null;
}

// ─── Store response in cache ────────────────────────────────
export async function cacheResponse(serviceId, messageText, response) {
  if (!serviceId || !messageText || messageText.length < MIN_QUERY_LENGTH) return;
  if (!response) return;

  const c = await getCache();
  const key = cacheKey(serviceId, messageText);

  await c.set(key, {
    response,
    serviceId,
    cachedAt: new Date().toISOString(),
  }, CACHE_TTL);
}

// ─── Invalidate cache for a service ─────────────────────────
export async function invalidateServiceCache(serviceId) {
  const c = await getCache();
  if (c instanceof LRUCache) {
    // In-memory: iterate and delete matching keys
    for (const key of c.cache.keys()) {
      if (key.startsWith(`resp:${serviceId}:`)) c.del(key);
    }
  } else if (redisInstance) {
    // Redis: scan and delete
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redisInstance.scan(cursor, "MATCH", `rcache:resp:${serviceId}:*`, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) await redisInstance.del(...keys);
    } while (cursor !== "0");
  }
}

// ─── Cache stats ────────────────────────────────────────────
export async function getCacheStats() {
  const c = await getCache();
  if (c instanceof LRUCache) {
    return { backend: "memory", size: c.size, maxSize: CACHE_MAX_SIZE };
  }
  // Redis: approximate with dbsize
  const info = await redisInstance.dbsize();
  return { backend: "redis", approximateKeys: info };
}
