// ═══════════════════════════════════════════════════════════════
// lib/search.js — Búsqueda full-text en conversaciones
// ═══════════════════════════════════════════════════════════════
// Usa PostgreSQL full-text search sobre el campo text_plain.

import prisma from "./prisma.js";

const noDB = !prisma;

// ─── Búsqueda full-text en mensajes ─────────────────────────
export async function searchMessages({
  query,
  sessionId,
  role,
  tenantId,
  since,
  until,
  limit = 20,
  offset = 0,
}) {
  if (noDB || !query || query.trim().length < 2) {
    return { results: [], total: 0 };
  }

  // Convert user query to tsquery format: "iva trimestral" → "iva & trimestral"
  const tsQuery = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[^\wáéíóúñüÁÉÍÓÚÑÜ]/g, ""))
    .filter((w) => w.length > 1)
    .join(" & ");

  if (!tsQuery) return { results: [], total: 0 };

  const where = {
    textPlain: { not: null },
  };

  if (sessionId) where.sessionId = sessionId;
  if (role) where.role = role;
  if (since || until) {
    where.createdAt = {};
    if (since) where.createdAt.gte = new Date(since);
    if (until) where.createdAt.lte = new Date(until);
  }
  if (tenantId) {
    where.session = { tenantId };
  }

  // Use raw query for full-text search with ranking
  const results = await prisma.$queryRaw`
    SELECT
      m.id,
      m.session_id AS "sessionId",
      m.role,
      m.text_plain AS text,
      m.created_at AS "createdAt",
      s.caller_name AS "callerName",
      s.service_id AS "serviceId",
      ts_rank(to_tsvector('spanish', m.text_plain), to_tsquery('spanish', ${tsQuery})) AS rank,
      ts_headline('spanish', m.text_plain, to_tsquery('spanish', ${tsQuery}),
        'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15') AS highlight
    FROM messages m
    JOIN sessions s ON s.id = m.session_id
    WHERE m.text_plain IS NOT NULL
      AND to_tsvector('spanish', m.text_plain) @@ to_tsquery('spanish', ${tsQuery})
      ${sessionId ? prisma.$queryRaw`AND m.session_id = ${sessionId}` : prisma.$queryRaw``}
      ${role ? prisma.$queryRaw`AND m.role = ${role}` : prisma.$queryRaw``}
      ${tenantId ? prisma.$queryRaw`AND s.tenant_id = ${tenantId}` : prisma.$queryRaw``}
      AND s.deleted_at IS NULL
    ORDER BY rank DESC, m.created_at DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  const countResult = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total
    FROM messages m
    JOIN sessions s ON s.id = m.session_id
    WHERE m.text_plain IS NOT NULL
      AND to_tsvector('spanish', m.text_plain) @@ to_tsquery('spanish', ${tsQuery})
      AND s.deleted_at IS NULL
      ${tenantId ? prisma.$queryRaw`AND s.tenant_id = ${tenantId}` : prisma.$queryRaw``}
  `;

  return {
    results: results.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      role: r.role,
      text: r.text,
      highlight: r.highlight,
      rank: parseFloat(r.rank),
      callerName: r.callerName,
      serviceId: r.serviceId,
      createdAt: r.createdAt,
    })),
    total: countResult[0]?.total || 0,
    query,
  };
}

// ─── Búsqueda simple (LIKE) como fallback ───────────────────
export async function searchMessagesSimple({
  query,
  sessionId,
  tenantId,
  limit = 20,
  offset = 0,
}) {
  if (noDB || !query || query.trim().length < 2) {
    return { results: [], total: 0 };
  }

  const where = {
    textPlain: { contains: query.trim(), mode: "insensitive" },
  };

  if (sessionId) where.sessionId = sessionId;
  if (tenantId) where.session = { tenantId };

  const [results, total] = await Promise.all([
    prisma.message.findMany({
      where,
      include: {
        session: { select: { callerName: true, serviceId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.message.count({ where }),
  ]);

  return {
    results: results.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      role: m.role,
      text: m.textPlain,
      callerName: m.session.callerName,
      serviceId: m.session.serviceId,
      createdAt: m.createdAt,
    })),
    total,
    query,
  };
}
