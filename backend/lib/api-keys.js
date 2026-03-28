// ═══════════════════════════════════════════════════════════════
// lib/api-keys.js — API key management for third-party integrations
// ═══════════════════════════════════════════════════════════════

import crypto from "crypto";

// ─── In-memory stores ─────────────────────────────────────────
const apiKeys = new Map();   // key → { appName, contactEmail, permissions, plan, active, createdAt }
const usageStore = new Map(); // key → { date: "YYYY-MM-DD", count, totalRequests }

// ─── Plan rate limits (requests per day) ──────────────────────
const PLAN_LIMITS = {
  free: 100,
  basic: 1000,
  pro: 10000,
  enterprise: Infinity,
};

// ─── Valid permissions ────────────────────────────────────────
const VALID_PERMISSIONS = new Set([
  "services:read",
  "chat:write",
  "renta:simulate",
  "calendar:read",
  "faq:read",
  "invoicing:write",
]);

// ─── Generate a new API key ───────────────────────────────────
export function generateApiKey(appName, contactEmail, permissions = [], plan = "free") {
  if (!appName || !contactEmail) {
    throw new Error("appName and contactEmail are required");
  }
  for (const perm of permissions) {
    if (!VALID_PERMISSIONS.has(perm)) {
      throw new Error(`Invalid permission: ${perm}`);
    }
  }
  if (!PLAN_LIMITS[plan]) {
    throw new Error(`Invalid plan: ${plan}. Must be one of: ${Object.keys(PLAN_LIMITS).join(", ")}`);
  }

  const key = "rge_" + crypto.randomBytes(32).toString("hex").slice(0, 32);
  apiKeys.set(key, {
    appName,
    contactEmail,
    permissions,
    plan,
    active: true,
    createdAt: new Date().toISOString(),
  });
  usageStore.set(key, { date: todayStr(), count: 0, totalRequests: 0 });

  return { key, appName, plan, permissions };
}

// ─── Validate an API key ──────────────────────────────────────
export function validateApiKey(key) {
  const entry = apiKeys.get(key);
  if (!entry || !entry.active) return null;
  return {
    appName: entry.appName,
    contactEmail: entry.contactEmail,
    permissions: entry.permissions,
    plan: entry.plan,
    createdAt: entry.createdAt,
  };
}

// ─── Revoke an API key ────────────────────────────────────────
export function revokeApiKey(key) {
  const entry = apiKeys.get(key);
  if (!entry) return false;
  entry.active = false;
  return true;
}

// ─── List all API keys (masked) ───────────────────────────────
export function listApiKeys() {
  const result = [];
  for (const [key, entry] of apiKeys) {
    result.push({
      key: key.slice(0, 8) + "..." + key.slice(-4),
      appName: entry.appName,
      contactEmail: entry.contactEmail,
      plan: entry.plan,
      active: entry.active,
      createdAt: entry.createdAt,
    });
  }
  return result;
}

// ─── Get usage stats for a key ────────────────────────────────
export function getApiKeyUsage(key) {
  const entry = apiKeys.get(key);
  if (!entry) return null;
  const usage = usageStore.get(key) || { date: todayStr(), count: 0, totalRequests: 0 };
  const limit = PLAN_LIMITS[entry.plan];
  return {
    appName: entry.appName,
    plan: entry.plan,
    today: usage.date === todayStr() ? usage.count : 0,
    dailyLimit: limit === Infinity ? "unlimited" : limit,
    totalRequests: usage.totalRequests,
  };
}

// ─── Check and increment rate limit ──────────────────────────
function checkRateLimit(key) {
  const entry = apiKeys.get(key);
  if (!entry) return { allowed: false, reason: "Invalid API key" };

  const limit = PLAN_LIMITS[entry.plan];
  const usage = usageStore.get(key);
  const today = todayStr();

  if (usage.date !== today) {
    usage.date = today;
    usage.count = 0;
  }

  if (limit !== Infinity && usage.count >= limit) {
    return { allowed: false, reason: `Daily rate limit exceeded (${limit} req/day for ${entry.plan} plan)` };
  }

  usage.count++;
  usage.totalRequests++;
  return { allowed: true };
}

// ─── Express middleware ───────────────────────────────────────
export function requireApiKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key) {
    return res.status(401).json({ ok: false, error: "Missing X-API-Key header" });
  }

  const info = validateApiKey(key);
  if (!info) {
    return res.status(401).json({ ok: false, error: "Invalid or revoked API key" });
  }

  const rateCheck = checkRateLimit(key);
  if (!rateCheck.allowed) {
    return res.status(429).json({ ok: false, error: rateCheck.reason });
  }

  req.apiKey = key;
  req.apiApp = info;
  next();
}

// ─── Permission check helper ─────────────────────────────────
export function hasPermission(req, permission) {
  return req.apiApp && req.apiApp.permissions.includes(permission);
}

// ─── Helpers ──────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
