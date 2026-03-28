// ═══════════════════════════════════════════════════════════════
// lib/tenants.js — Multi-tenant para asesorías fiscales
// ═══════════════════════════════════════════════════════════════
// Cada asesoría tiene su propio tenant con agentes personalizados.

import prisma from "./prisma.js";

// ─── Crear tenant ───────────────────────────────────────────
export async function createTenant({ name, slug, plan = "basic", maxAgents = 39, settings = {} }) {
  return prisma.tenant.create({
    data: { name, slug, plan, maxAgents, settings },
  });
}

// ─── Obtener tenant por slug ────────────────────────────────
export async function getTenantBySlug(slug) {
  return prisma.tenant.findUnique({
    where: { slug },
    include: { agents: true },
  });
}

// ─── Obtener tenant por ID ──────────────────────────────────
export async function getTenant(id) {
  return prisma.tenant.findUnique({
    where: { id },
    include: { agents: true },
  });
}

// ─── Actualizar tenant ──────────────────────────────────────
export async function updateTenant(id, data) {
  const { name, plan, maxAgents, settings } = data;
  return prisma.tenant.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(plan && { plan }),
      ...(maxAgents !== undefined && { maxAgents }),
      ...(settings && { settings }),
    },
  });
}

// ─── Listar tenants ─────────────────────────────────────────
export async function listTenants({ limit = 50, offset = 0 } = {}) {
  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        _count: { select: { sessions: true, callHistory: true } },
      },
    }),
    prisma.tenant.count(),
  ]);

  return { tenants, total };
}

// ─── Configurar agente personalizado para tenant ────────────
export async function setTenantAgent(tenantId, serviceId, { customName, customPrompt, enabled = true }) {
  return prisma.tenantAgent.upsert({
    where: { tenantId_serviceId: { tenantId, serviceId } },
    create: {
      tenantId,
      serviceId,
      customName,
      customPrompt,
      enabled,
    },
    update: {
      customName,
      customPrompt,
      enabled,
    },
  });
}

// ─── Obtener agentes del tenant ─────────────────────────────
export async function getTenantAgents(tenantId) {
  return prisma.tenantAgent.findMany({
    where: { tenantId },
    orderBy: { serviceId: "asc" },
  });
}

// ─── Obtener config de un agente específico para tenant ─────
export async function getTenantAgent(tenantId, serviceId) {
  return prisma.tenantAgent.findUnique({
    where: { tenantId_serviceId: { tenantId, serviceId } },
  });
}

// ─── Eliminar agente personalizado ──────────────────────────
export async function removeTenantAgent(tenantId, serviceId) {
  return prisma.tenantAgent.delete({
    where: { tenantId_serviceId: { tenantId, serviceId } },
  }).catch(() => null);
}

// ─── Estadísticas del tenant ────────────────────────────────
export async function getTenantStats(tenantId) {
  const [sessions, calls, documents, agents] = await Promise.all([
    prisma.session.count({ where: { tenantId, deletedAt: null } }),
    prisma.callHistory.count({ where: { tenantId } }),
    prisma.document.count({ where: { tenantId } }),
    prisma.tenantAgent.count({ where: { tenantId, enabled: true } }),
  ]);

  return { activeSessions: sessions, totalCalls: calls, totalDocuments: documents, activeAgents: agents };
}

// ─── Eliminar tenant (cascade) ──────────────────────────────
export async function deleteTenant(id) {
  return prisma.tenant.delete({ where: { id } });
}
