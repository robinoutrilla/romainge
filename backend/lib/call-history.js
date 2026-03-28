// ═══════════════════════════════════════════════════════════════
// lib/call-history.js — Historial de llamadas con estadísticas
// ═══════════════════════════════════════════════════════════════

import prisma from "./prisma.js";

// ─── Registrar llamada ──────────────────────────────────────
export async function logCall({
  callSid,
  callerPhone,
  serviceId,
  status = "completed",
  duration = 0,
  language = "es-ES",
  nifProvided,
  sessionId,
  recordingUrl,
  transferredTo,
  metadata = {},
  tenantId,
}) {
  return prisma.callHistory.create({
    data: {
      callSid,
      callerPhone,
      serviceId,
      status,
      duration,
      language,
      nifProvided,
      sessionId,
      recordingUrl,
      transferredTo,
      metadata,
      tenantId: tenantId || null,
    },
  });
}

// ─── Obtener historial con filtros ──────────────────────────
export async function getCallHistory({
  serviceId,
  callerPhone,
  status,
  since,
  until,
  tenantId,
  limit = 50,
  offset = 0,
} = {}) {
  const where = {};
  if (serviceId) where.serviceId = serviceId;
  if (callerPhone) where.callerPhone = callerPhone;
  if (status) where.status = status;
  if (tenantId) where.tenantId = tenantId;
  if (since || until) {
    where.createdAt = {};
    if (since) where.createdAt.gte = new Date(since);
    if (until) where.createdAt.lte = new Date(until);
  }

  const [calls, total] = await Promise.all([
    prisma.callHistory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.callHistory.count({ where }),
  ]);

  return { calls, total };
}

// ─── Estadísticas por servicio ──────────────────────────────
export async function getCallStatsByService({ since, until, tenantId } = {}) {
  const where = {};
  if (tenantId) where.tenantId = tenantId;
  if (since || until) {
    where.createdAt = {};
    if (since) where.createdAt.gte = new Date(since);
    if (until) where.createdAt.lte = new Date(until);
  }

  const stats = await prisma.callHistory.groupBy({
    by: ["serviceId"],
    where,
    _count: { id: true },
    _avg: { duration: true },
    _sum: { duration: true },
  });

  // Status breakdown per service
  const statusBreakdown = await prisma.callHistory.groupBy({
    by: ["serviceId", "status"],
    where,
    _count: { id: true },
  });

  const byService = {};
  for (const s of stats) {
    byService[s.serviceId] = {
      totalCalls: s._count.id,
      avgDuration: Math.round(s._avg.duration || 0),
      totalDuration: s._sum.duration || 0,
      statuses: {},
    };
  }

  for (const sb of statusBreakdown) {
    if (byService[sb.serviceId]) {
      byService[sb.serviceId].statuses[sb.status] = sb._count.id;
    }
  }

  return byService;
}

// ─── Estadísticas globales ──────────────────────────────────
export async function getCallStatsGlobal({ since, until, tenantId } = {}) {
  const where = {};
  if (tenantId) where.tenantId = tenantId;
  if (since || until) {
    where.createdAt = {};
    if (since) where.createdAt.gte = new Date(since);
    if (until) where.createdAt.lte = new Date(until);
  }

  const [total, avgDuration, byStatus, byLanguage] = await Promise.all([
    prisma.callHistory.count({ where }),
    prisma.callHistory.aggregate({ where, _avg: { duration: true } }),
    prisma.callHistory.groupBy({ by: ["status"], where, _count: { id: true } }),
    prisma.callHistory.groupBy({ by: ["language"], where, _count: { id: true } }),
  ]);

  return {
    totalCalls: total,
    avgDuration: Math.round(avgDuration._avg.duration || 0),
    byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count.id])),
    byLanguage: Object.fromEntries(byLanguage.map((l) => [l.language, l._count.id])),
  };
}
