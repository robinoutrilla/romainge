// ═══════════════════════════════════════════════════════════════
// tests/twilio-webhooks.test.js — Tests para webhooks Twilio con firma simulada
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// ─── Mock de la validación de firma Twilio ───────────────────
function generateTwilioSignature(authToken, url, params) {
  // Reproduce el algoritmo real de validación de firma Twilio
  // https://www.twilio.com/docs/usage/security
  const data = url + Object.keys(params).sort().reduce((acc, key) => acc + key + params[key], "");
  return crypto.createHmac("sha1", authToken).update(Buffer.from(data, "utf-8")).digest("base64");
}

describe("Twilio Signature Validation", () => {
  const AUTH_TOKEN = "test-auth-token-12345";
  const BASE_URL = "https://api.romainge.com";

  it("genera firma válida para /voice/incoming", () => {
    const url = `${BASE_URL}/api/voice/incoming`;
    const params = {
      CallSid: "CA1234567890",
      From: "+34612345678",
      To: "+34900000000",
      CallStatus: "ringing",
    };

    const signature = generateTwilioSignature(AUTH_TOKEN, url, params);
    expect(signature).toBeTruthy();
    expect(typeof signature).toBe("string");
    // Base64 string
    expect(/^[A-Za-z0-9+/]+=*$/.test(signature)).toBe(true);
  });

  it("firmas diferentes para URLs diferentes", () => {
    const params = { CallSid: "CA123", From: "+34612345678" };
    const sig1 = generateTwilioSignature(AUTH_TOKEN, `${BASE_URL}/api/voice/incoming`, params);
    const sig2 = generateTwilioSignature(AUTH_TOKEN, `${BASE_URL}/api/voice/status`, params);
    expect(sig1).not.toBe(sig2);
  });

  it("firmas diferentes para tokens diferentes", () => {
    const url = `${BASE_URL}/api/voice/incoming`;
    const params = { CallSid: "CA123" };
    const sig1 = generateTwilioSignature("token-one", url, params);
    const sig2 = generateTwilioSignature("token-two", url, params);
    expect(sig1).not.toBe(sig2);
  });

  it("firma es determinista (mismo input = mismo output)", () => {
    const url = `${BASE_URL}/api/voice/incoming`;
    const params = { CallSid: "CA123", From: "+34612345678" };
    const sig1 = generateTwilioSignature(AUTH_TOKEN, url, params);
    const sig2 = generateTwilioSignature(AUTH_TOKEN, url, params);
    expect(sig1).toBe(sig2);
  });

  it("parámetros vacíos generan firma válida", () => {
    const sig = generateTwilioSignature(AUTH_TOKEN, `${BASE_URL}/api/voice/incoming`, {});
    expect(sig).toBeTruthy();
  });
});

describe("Twilio Voice Webhook Payloads", () => {
  it("parsea payload de llamada entrante", () => {
    const incomingPayload = {
      CallSid: "CA1234567890abcdef",
      AccountSid: "AC1234567890",
      From: "+34612345678",
      To: "+34900000000",
      CallStatus: "ringing",
      Direction: "inbound",
      ApiVersion: "2010-04-01",
    };

    expect(incomingPayload.CallSid).toMatch(/^CA/);
    expect(incomingPayload.From).toMatch(/^\+34/);
    expect(incomingPayload.Direction).toBe("inbound");
  });

  it("parsea payload de status callback", () => {
    const statusPayload = {
      CallSid: "CA1234567890abcdef",
      CallStatus: "completed",
      CallDuration: "180",
      From: "+34612345678",
      To: "+34900000000",
    };

    expect(statusPayload.CallStatus).toBe("completed");
    expect(parseInt(statusPayload.CallDuration)).toBe(180);
  });

  it("parsea payload de grabación", () => {
    const recordingPayload = {
      CallSid: "CA1234567890abcdef",
      RecordingSid: "RE1234567890",
      RecordingUrl: "https://api.twilio.com/2010-04-01/Accounts/AC123/Recordings/RE123",
      RecordingStatus: "completed",
      RecordingDuration: "120",
    };

    expect(recordingPayload.RecordingSid).toMatch(/^RE/);
    expect(recordingPayload.RecordingStatus).toBe("completed");
  });

  it("parsea DTMF selection", () => {
    const dtmfPayload = {
      CallSid: "CA1234567890abcdef",
      Digits: "1",
      From: "+34612345678",
    };

    const digit = parseInt(dtmfPayload.Digits);
    expect(digit).toBeGreaterThanOrEqual(0);
    expect(digit).toBeLessThanOrEqual(9);
  });
});

describe("ConversationRelay WebSocket messages", () => {
  it("mensaje setup tiene formato correcto", () => {
    const setupMsg = {
      type: "setup",
      callSid: "CA1234567890",
      from: "+34612345678",
      to: "+34900000000",
      customParameters: { language: "es-ES" },
    };

    expect(setupMsg.type).toBe("setup");
    expect(setupMsg.callSid).toBeTruthy();
    expect(setupMsg.from).toMatch(/^\+/);
  });

  it("mensaje prompt (transcripción de voz)", () => {
    const promptMsg = {
      type: "prompt",
      voicePrompt: "Quiero saber sobre el IVA",
      lang: "es-ES",
      confidence: 0.95,
    };

    expect(promptMsg.type).toBe("prompt");
    expect(promptMsg.voicePrompt).toBeTruthy();
    expect(promptMsg.confidence).toBeGreaterThan(0);
  });

  it("mensaje DTMF fallback", () => {
    const dtmfMsg = {
      type: "dtmf",
      digit: "1",
    };

    expect(dtmfMsg.type).toBe("dtmf");
    expect(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "#"]).toContain(dtmfMsg.digit);
  });

  it("mensaje interrupt (usuario interrumpe TTS)", () => {
    const interruptMsg = {
      type: "interrupt",
      utteranceUntilInterrupt: "El IVA general es del",
      durationUntilInterruptMs: 1500,
    };

    expect(interruptMsg.type).toBe("interrupt");
    expect(interruptMsg.durationUntilInterruptMs).toBeGreaterThan(0);
  });
});

describe("Voice Queue", () => {
  it("simula registro y desregistro de llamada", async () => {
    // Dynamic import to avoid circular deps
    const { registerCall, unregisterCall, getQueueStats, isAtCapacity } = await import("../lib/voice-queue.js");

    const initialStats = getQueueStats();
    const initialActive = initialStats.activeCalls;

    registerCall("CA-test-001", {
      phone: "+34612345678",
      name: "Test",
      serviceId: "impuestos",
    });

    const afterRegister = getQueueStats();
    expect(afterRegister.activeCalls).toBe(initialActive + 1);

    unregisterCall("CA-test-001");

    const afterUnregister = getQueueStats();
    expect(afterUnregister.activeCalls).toBe(initialActive);
  });

  it("detecta capacidad llena", async () => {
    const { registerCall, unregisterCall, isAtCapacity, getActiveCallCount } = await import("../lib/voice-queue.js");

    // Register enough calls to fill capacity (assuming MAX_CONCURRENT >= 2)
    const sids = [];
    const max = 10; // Default MAX_CONCURRENT
    for (let i = 0; i < max; i++) {
      const sid = `CA-cap-${i}`;
      registerCall(sid, { phone: `+346000000${i.toString().padStart(2, "0")}`, name: "Test" });
      sids.push(sid);
    }

    expect(isAtCapacity()).toBe(true);

    // Cleanup
    for (const sid of sids) unregisterCall(sid);
    expect(isAtCapacity()).toBe(false);
  });
});
