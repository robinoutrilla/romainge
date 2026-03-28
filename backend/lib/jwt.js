// ═══════════════════════════════════════════════════════════════
// lib/jwt.js — JWT authentication with refresh tokens
// ═══════════════════════════════════════════════════════════════

import jwt from "jsonwebtoken";
import crypto from "crypto";

const SECRET = process.env.JWT_SECRET || process.env.API_SECRET || "romainge-dev-secret-change-me";
const ACCESS_EXPIRES = process.env.JWT_EXPIRES_IN || "30m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || "24h";
const INACTIVITY_TIMEOUT_MS = (parseInt(process.env.SESSION_INACTIVITY_MINUTES) || 30) * 60 * 1000;

// Store for refresh tokens and session activity (in-memory; use Redis in production)
const refreshTokens = new Map();   // refreshToken → { sessionId, phone, createdAt, expiresAt }
const sessionActivity = new Map(); // sessionId → lastActivity timestamp
const ipWhitelist = new Map();     // sessionId → Set<ip>

// ─── Generate access + refresh tokens ─────────────────────────
export function generateTokens(sessionId, callerPhone) {
  const accessToken = jwt.sign(
    { sessionId, phone: callerPhone, type: "access" },
    SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );

  const refreshToken = crypto.randomBytes(48).toString("hex");
  const expiresAt = Date.now() + parseDuration(REFRESH_EXPIRES);

  refreshTokens.set(refreshToken, {
    sessionId,
    phone: callerPhone,
    createdAt: Date.now(),
    expiresAt,
  });

  // Track activity
  sessionActivity.set(sessionId, Date.now());

  return { accessToken, refreshToken, expiresIn: ACCESS_EXPIRES };
}

// ─── Legacy: single token generation (backwards compat) ───────
export function generateToken(sessionId, callerPhone) {
  const result = generateTokens(sessionId, callerPhone);
  return result.accessToken;
}

// ─── Refresh access token ─────────────────────────────────────
export function refreshAccessToken(refreshToken) {
  const data = refreshTokens.get(refreshToken);
  if (!data) return null;

  if (Date.now() > data.expiresAt) {
    refreshTokens.delete(refreshToken);
    return null;
  }

  // Check inactivity
  const lastActivity = sessionActivity.get(data.sessionId);
  if (lastActivity && Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS) {
    revokeSession(data.sessionId);
    return null;
  }

  // Generate new access token (rotate refresh token for security)
  const newRefreshToken = crypto.randomBytes(48).toString("hex");
  refreshTokens.delete(refreshToken);
  refreshTokens.set(newRefreshToken, {
    ...data,
    createdAt: Date.now(),
    expiresAt: Date.now() + parseDuration(REFRESH_EXPIRES),
  });

  const accessToken = jwt.sign(
    { sessionId: data.sessionId, phone: data.phone, type: "access" },
    SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );

  sessionActivity.set(data.sessionId, Date.now());

  return { accessToken, refreshToken: newRefreshToken, expiresIn: ACCESS_EXPIRES };
}

// ─── Revoke all tokens for a session ──────────────────────────
export function revokeSession(sessionId) {
  for (const [token, data] of refreshTokens) {
    if (data.sessionId === sessionId) refreshTokens.delete(token);
  }
  sessionActivity.delete(sessionId);
  ipWhitelist.delete(sessionId);
}

// ─── Verify JWT token ─────────────────────────────────────────
export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

// ─── Update session activity (for inactivity timeout) ─────────
export function touchSession(sessionId) {
  sessionActivity.set(sessionId, Date.now());
}

// ─── Check if session is inactive ─────────────────────────────
export function isSessionInactive(sessionId) {
  const lastActivity = sessionActivity.get(sessionId);
  if (!lastActivity) return false; // No tracking = not inactive
  return Date.now() - lastActivity > INACTIVITY_TIMEOUT_MS;
}

// ─── IP Whitelisting ──────────────────────────────────────────
export function setIpWhitelist(sessionId, ips) {
  ipWhitelist.set(sessionId, new Set(ips));
}

export function checkIpWhitelist(sessionId, ip) {
  const whitelist = ipWhitelist.get(sessionId);
  if (!whitelist) return true; // No whitelist = allow all
  return whitelist.has(ip);
}

// ─── Express middleware: require valid JWT ─────────────────────
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: "Token de autenticacion requerido" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: "Token invalido o expirado", code: "TOKEN_EXPIRED" });
  }

  // Verify sessionId matches URL param
  const urlSessionId = req.params.sessionId;
  if (urlSessionId && urlSessionId !== payload.sessionId) {
    return res.status(403).json({ error: "No autorizado para esta sesion" });
  }

  // Check inactivity timeout
  if (isSessionInactive(payload.sessionId)) {
    revokeSession(payload.sessionId);
    return res.status(401).json({ error: "Sesion expirada por inactividad", code: "INACTIVE" });
  }

  // IP whitelist check
  const clientIp = req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress;
  if (!checkIpWhitelist(payload.sessionId, clientIp)) {
    return res.status(403).json({ error: "IP no autorizada para esta sesion" });
  }

  // Update activity
  touchSession(payload.sessionId);

  req.auth = payload;
  next();
}

// ─── CSRF protection middleware ───────────────────────────────
// Double-submit cookie pattern: compare cookie with header
export function csrfProtection(req, res, next) {
  // Skip for Twilio webhooks (they use signature validation)
  if (req.path.startsWith("/voice/")) return next();
  // Skip for GET/HEAD/OPTIONS
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  // Skip for API calls with Bearer token (SPA pattern — the token itself is the CSRF protection)
  if (req.headers.authorization?.startsWith("Bearer ")) return next();

  // For cookie-based sessions, check X-CSRF-Token header matches csrf cookie
  const cookieToken = req.cookies?.csrf;
  const headerToken = req.headers["x-csrf-token"];

  if (cookieToken && headerToken && cookieToken === headerToken) {
    return next();
  }

  // If no CSRF mechanism is in play (no cookies), allow if it's a JSON API call
  const contentType = req.headers["content-type"];
  if (contentType && contentType.includes("application/json")) {
    return next(); // JSON API + CORS = safe from CSRF
  }

  return res.status(403).json({ error: "CSRF token invalido" });
}

// ─── Session-based rate limiting ──────────────────────────────
const sessionRateCounters = new Map(); // sessionId → { count, windowStart }

export function sessionRateLimit(maxPerMinute = 15) {
  return (req, res, next) => {
    const sessionId = req.auth?.sessionId;
    if (!sessionId) return next(); // Not authenticated = use IP-based limiter

    const now = Date.now();
    let counter = sessionRateCounters.get(sessionId);

    if (!counter || now - counter.windowStart > 60000) {
      counter = { count: 0, windowStart: now };
    }

    counter.count++;
    sessionRateCounters.set(sessionId, counter);

    if (counter.count > maxPerMinute) {
      return res.status(429).json({
        error: "Limite de mensajes por sesion alcanzado. Espere un momento.",
        retryAfter: Math.ceil((counter.windowStart + 60000 - now) / 1000),
      });
    }

    next();
  };
}

// ─── Verify JWT for WebSocket connections ─────────────────────
export function verifyWsToken(token) {
  return verifyToken(token);
}

// ─── Helpers ──────────────────────────────────────────────────
function parseDuration(str) {
  const match = str.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 24 * 3600 * 1000; // Default 24h
  const val = parseInt(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return val * (multipliers[unit] || 3600000);
}

// Cleanup expired refresh tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of refreshTokens) {
    if (now > data.expiresAt) refreshTokens.delete(token);
  }
  for (const [sessionId, lastActive] of sessionActivity) {
    if (now - lastActive > INACTIVITY_TIMEOUT_MS * 2) sessionActivity.delete(sessionId);
  }
  // Clean rate counters
  for (const [sid, counter] of sessionRateCounters) {
    if (now - counter.windowStart > 120000) sessionRateCounters.delete(sid);
  }
}, 5 * 60 * 1000);
