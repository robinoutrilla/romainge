// ═══════════════════════════════════════════════════════════════
// tests/sessions.test.js — Tests de integración para sesiones
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from "vitest";
import {
  createSession,
  findSession,
  getSession,
  addMessage,
  getMessages,
  destroySession,
  getStats,
} from "../lib/sessions.js";

describe("Sessions — ciclo de vida completo", () => {
  let sessionData;

  beforeEach(() => {
    sessionData = {
      callerName: "María",
      callerLastName: "García",
      callerPhone: "+34612345678",
      serviceId: "impuestos",
    };
  });

  it("crea una sesión con todos los campos requeridos", () => {
    const { sessionId, key, session } = createSession(sessionData);

    expect(sessionId).toBeTruthy();
    expect(key).toBeTruthy();
    expect(typeof key).toBe("string");
    expect(session.callerName).toBe("María");
    expect(session.callerLastName).toBe("García");
    expect(session.callerPhone).toBe("+34612345678");
    expect(session.serviceId).toBe("impuestos");
    expect(session.active).toBe(true);
    expect(session.keyUsed).toBe(false);
    expect(session.createdAt).toBeTruthy();
    expect(session.expiresAt).toBeTruthy();
  });

  it("genera clave de una palabra del pool", () => {
    const { key } = createSession(sessionData);
    expect(key.length).toBeGreaterThan(2);
    expect(key.length).toBeLessThan(20);
    // Should be a simple word (no spaces, no numbers)
    expect(/^[a-záéíóúñ]+$/i.test(key)).toBe(true);
  });

  it("encuentra sesión por clave + teléfono", () => {
    const { key, session } = createSession(sessionData);
    const found = findSession(key, "+34612345678");

    expect(found).not.toBeNull();
    expect(found.id).toBe(session.id);
    expect(found.keyUsed).toBe(true);
  });

  it("clave es single-use (no funciona dos veces)", () => {
    const { key } = createSession(sessionData);

    const first = findSession(key, "+34612345678");
    expect(first).not.toBeNull();

    const second = findSession(key, "+34612345678");
    expect(second).toBeNull();
  });

  it("normaliza teléfono al buscar (con espacios)", () => {
    const { key } = createSession(sessionData);
    const found = findSession(key, "+34 612 345 678");
    expect(found).not.toBeNull();
  });

  it("devuelve null para clave incorrecta", () => {
    createSession(sessionData);
    const found = findSession("clavefalsa", "+34612345678");
    expect(found).toBeNull();
  });

  it("devuelve null para teléfono incorrecto", () => {
    const { key } = createSession(sessionData);
    const found = findSession(key, "+34999999999");
    expect(found).toBeNull();
  });

  it("obtiene sesión por ID", () => {
    const { sessionId } = createSession(sessionData);
    const session = getSession(sessionId);

    expect(session).not.toBeNull();
    expect(session.callerName).toBe("María");
  });

  it("devuelve null para sesión inexistente", () => {
    expect(getSession("fake-id")).toBeNull();
  });

  it("destruye sesión correctamente", () => {
    const { sessionId } = createSession(sessionData);
    expect(getSession(sessionId)).not.toBeNull();

    destroySession(sessionId);
    expect(getSession(sessionId)).toBeNull();
  });
});

describe("Sessions — mensajes", () => {
  let sessionId;

  beforeEach(() => {
    const result = createSession({
      callerName: "Juan",
      callerLastName: "López",
      callerPhone: "+34698765432",
      serviceId: "renta2025",
    });
    sessionId = result.sessionId;
  });

  it("añade mensaje de usuario", () => {
    const msg = addMessage(sessionId, "user", "¿Cuándo es la campaña de la renta?");

    expect(msg).not.toBeNull();
    expect(msg.role).toBe("user");
    expect(msg.text).toBe("¿Cuándo es la campaña de la renta?");
    expect(msg.id).toBeTruthy();
    expect(msg.timestamp).toBeTruthy();
  });

  it("añade mensaje de agente", () => {
    const msg = addMessage(sessionId, "agent", "La campaña comienza el 2 de abril.");
    expect(msg.role).toBe("agent");
  });

  it("recupera historial de mensajes en orden", () => {
    addMessage(sessionId, "user", "Hola");
    addMessage(sessionId, "agent", "Buenos días");
    addMessage(sessionId, "user", "Tengo una duda");
    addMessage(sessionId, "agent", "Claro, dígame");

    const messages = getMessages(sessionId);
    expect(messages).toHaveLength(4);
    expect(messages[0].role).toBe("user");
    expect(messages[0].text).toBe("Hola");
    expect(messages[1].role).toBe("agent");
    expect(messages[2].role).toBe("user");
    expect(messages[3].role).toBe("agent");
  });

  it("devuelve array vacío para sesión inexistente", () => {
    expect(getMessages("fake-id")).toEqual([]);
  });

  it("devuelve null al añadir mensaje a sesión inexistente", () => {
    expect(addMessage("fake-id", "user", "test")).toBeNull();
  });
});

describe("Sessions — estadísticas y expiración", () => {
  it("getStats devuelve contador correcto", () => {
    const before = getStats().activeSessions;
    createSession({
      callerName: "Test",
      callerPhone: "+34600000001",
      serviceId: "impuestos",
    });
    const after = getStats().activeSessions;
    expect(after).toBeGreaterThanOrEqual(before + 1);
  });

  it("sesiones con TTL correcto", () => {
    const { session } = createSession({
      callerName: "Test",
      callerPhone: "+34600000002",
      serviceId: "impuestos",
    });
    const created = new Date(session.createdAt);
    const expires = new Date(session.expiresAt);
    const diffHours = (expires - created) / (1000 * 60 * 60);
    expect(diffHours).toBeCloseTo(24, 0);
  });
});
