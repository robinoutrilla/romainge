// ══���════════════════════════════════════════════════════════════
// lib/audit-log.js — Logs de auditoría para accesos a sesiones
// ═══════════════��═══════════════════════════════════════════════

const auditEntries = [];
const MAX_ENTRIES = 10000;

export function logAudit(event, details) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...details,
  };

  auditEntries.push(entry);

  // Trim old entries
  if (auditEntries.length > MAX_ENTRIES) {
    auditEntries.splice(0, auditEntries.length - MAX_ENTRIES);
  }

  // Also log to stdout for production log aggregation
  if (process.env.NODE_ENV === "production" || process.env.AUDIT_LOG === "true") {
    console.log(`[AUDIT] ${JSON.stringify(entry)}`);
  }
}

export function getAuditLog(filters = {}) {
  let entries = [...auditEntries];

  if (filters.sessionId) {
    entries = entries.filter(e => e.sessionId === filters.sessionId);
  }
  if (filters.event) {
    entries = entries.filter(e => e.event === filters.event);
  }
  if (filters.ip) {
    entries = entries.filter(e => e.ip === filters.ip);
  }
  if (filters.since) {
    const since = new Date(filters.since);
    entries = entries.filter(e => new Date(e.timestamp) >= since);
  }
  if (filters.limit) {
    entries = entries.slice(-filters.limit);
  }

  return entries;
}

// Middleware to extract audit context from request
export function auditContext(req) {
  return {
    ip: req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"]?.slice(0, 200),
    sessionId: req.params?.sessionId || req.auth?.sessionId,
    phone: req.auth?.phone,
  };
}
