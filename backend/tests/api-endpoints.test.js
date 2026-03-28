// ═══════════════════════════════════════════════════════════════
// tests/api-endpoints.test.js — Tests de integración para endpoints REST
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeAll, vi } from "vitest";
import { createSession, getSession, addMessage } from "../lib/sessions.js";
import { SERVICES, SERVICES_MAP } from "../config/services.js";

// Mock modules that require external services
vi.mock("../lib/prisma.js", () => ({ default: {} }));
vi.mock("../lib/call-history.js", () => ({
  logCall: vi.fn(),
  getCallHistory: vi.fn(async () => ({ calls: [], total: 0 })),
  getCallStatsByService: vi.fn(async () => ({})),
  getCallStatsGlobal: vi.fn(async () => ({ totalCalls: 0, avgDuration: 0, byStatus: {}, byLanguage: {} })),
}));
vi.mock("../lib/search.js", () => ({
  searchMessages: vi.fn(async () => ({ results: [], total: 0 })),
  searchMessagesSimple: vi.fn(async () => ({ results: [], total: 0 })),
}));
vi.mock("../lib/response-cache.js", () => ({
  getCachedResponse: vi.fn(async () => null),
  cacheResponse: vi.fn(async () => {}),
  getCacheStats: vi.fn(async () => ({ hits: 0, misses: 0 })),
}));
vi.mock("../lib/documents.js", () => ({
  uploadDocument: vi.fn(),
  getDocument: vi.fn(),
  getDocumentContent: vi.fn(),
  listDocuments: vi.fn(async () => []),
  deleteDocument: vi.fn(),
}));
vi.mock("../lib/tenants.js", () => ({
  createTenant: vi.fn(), getTenantBySlug: vi.fn(), getTenant: vi.fn(),
  updateTenant: vi.fn(), listTenants: vi.fn(async () => ({ tenants: [], total: 0 })),
  setTenantAgent: vi.fn(), getTenantAgents: vi.fn(async () => []),
  getTenantStats: vi.fn(async () => ({})), deleteTenant: vi.fn(),
}));
vi.mock("../lib/sessions-adapter.js", async () => {
  const sessions = await import("../lib/sessions.js");
  return {
    ...sessions,
    restoreSession: vi.fn(async () => null),
    purgeExpiredRetention: vi.fn(async () => {}),
    cleanupExpiredSessions: vi.fn(async () => {}),
  };
});

describe("Session creation and lookup", () => {
  it("creates session with valid data", () => {
    const { sessionId, key, session } = createSession({
      callerName: "Test",
      callerLastName: "User",
      callerPhone: "+34611111111",
      serviceId: "impuestos",
    });

    expect(sessionId).toBeTruthy();
    expect(key).toBeTruthy();
    expect(session.serviceId).toBe("impuestos");
  });

  it("session login flow: find by key+phone → mark key as used", () => {
    const { key } = createSession({
      callerName: "Login",
      callerPhone: "+34622222222",
      serviceId: "renta2025",
    });

    // First lookup succeeds
    const session = findSessionDirect(key, "+34622222222");
    expect(session).not.toBeNull();
    expect(session.keyUsed).toBe(true);

    // Second lookup fails (single-use)
    const session2 = findSessionDirect(key, "+34622222222");
    expect(session2).toBeNull();
  });

  it("session survives getSession after findSession", () => {
    const { sessionId, key } = createSession({
      callerName: "Persist",
      callerPhone: "+34633333333",
      serviceId: "aduanas",
    });

    findSessionDirect(key, "+34633333333");
    const session = getSession(sessionId);
    expect(session).not.toBeNull();
    expect(session.callerName).toBe("Persist");
  });
});

describe("Chat message flow", () => {
  let sessionId;

  beforeAll(() => {
    const result = createSession({
      callerName: "Chat",
      callerPhone: "+34644444444",
      serviceId: "impuestos",
    });
    sessionId = result.sessionId;
  });

  it("adds user message and retrieves it", () => {
    addMessage(sessionId, "user", "¿Cuál es el tipo de IVA?");
    const messages = getMessagesForSession(sessionId);

    expect(messages.length).toBeGreaterThanOrEqual(1);
    const lastMsg = messages[messages.length - 1];
    expect(lastMsg.role).toBe("user");
    expect(lastMsg.text).toContain("IVA");
  });

  it("adds agent response", () => {
    addMessage(sessionId, "agent", "El IVA general es del 21%.");
    const messages = getMessagesForSession(sessionId);

    const agentMsgs = messages.filter(m => m.role === "agent");
    expect(agentMsgs.length).toBeGreaterThanOrEqual(1);
  });

  it("preserves conversation order", () => {
    const sid = createSession({
      callerName: "Order",
      callerPhone: "+34655555555",
      serviceId: "censos",
    }).sessionId;

    addMessage(sid, "user", "msg1");
    addMessage(sid, "agent", "msg2");
    addMessage(sid, "user", "msg3");

    const msgs = getMessagesForSession(sid);
    expect(msgs.map(m => m.text)).toEqual(["msg1", "msg2", "msg3"]);
    expect(msgs.map(m => m.role)).toEqual(["user", "agent", "user"]);
  });
});

describe("Services catalog", () => {
  it("has all required services", () => {
    const requiredIds = ["impuestos", "aduanas", "censos", "renta2025", "cnmc", "ibi", "modelo303", "autonomos"];
    for (const id of requiredIds) {
      expect(SERVICES_MAP[id]).toBeDefined();
    }
  });

  it("all services have agent names", () => {
    for (const svc of SERVICES) {
      expect(svc.agent).toBeTruthy();
      expect(typeof svc.agent).toBe("string");
    }
  });

  it("services map matches services array", () => {
    expect(Object.keys(SERVICES_MAP).length).toBe(SERVICES.length);
  });
});

// ─── Helpers (avoid import cycles) ──────────────────────────
import { findSession as findSessionDirect } from "../lib/sessions.js";
import { getMessages as getMessagesForSession } from "../lib/sessions.js";
