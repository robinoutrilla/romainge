// ═══════════════════════════════════════════════════════════════
// lib/voice-queue.js — Cola de llamadas y sistema de callbacks
// ═══════════════════════════════════════════════════════════════

import twilio from "twilio";
import { sendQueueAlert } from "./email-alerts.js";
import { trackTwilioUsage, trackCallByCCAA } from "./metrics.js";

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_CALLS) || 10;
const QUEUE_ALERT_THRESHOLD = parseInt(process.env.QUEUE_ALERT_THRESHOLD) || 50;

// Estado en memoria
const state = {
  activeCalls: new Map(),     // callSid → { phone, name, serviceId, startedAt }
  waitingQueue: [],           // [{ phone, name, serviceId, queuedAt }]
  callbackRequests: [],       // [{ phone, name, serviceId, requestedAt, status }]
};

// ─── Active calls management ──────────────────────────────────
export function registerCall(callSid, info) {
  state.activeCalls.set(callSid, { ...info, startedAt: Date.now() });
  if (info?.phone) trackCallByCCAA(info.phone);
}

export function unregisterCall(callSid) {
  const call = state.activeCalls.get(callSid);
  if (call) {
    const durationSec = Math.round((Date.now() - call.startedAt) / 1000);
    trackTwilioUsage({ callSid, durationSec, direction: "inbound" });
  }
  state.activeCalls.delete(callSid);
  processQueue(); // Try to connect next in queue
}

export function getActiveCallCount() {
  return state.activeCalls.size;
}

export function isAtCapacity() {
  return state.activeCalls.size >= MAX_CONCURRENT;
}

// ─── Waiting queue ────────────────────────────────────────────
export function addToQueue(phone, name, serviceId) {
  const entry = { phone, name, serviceId, queuedAt: Date.now() };
  state.waitingQueue.push(entry);

  // Check queue threshold for email alert
  if (state.waitingQueue.length >= QUEUE_ALERT_THRESHOLD) {
    sendQueueAlert(state.waitingQueue.length).catch(() => {});
  }

  return { position: state.waitingQueue.length, estimatedWait: state.waitingQueue.length * 120 };
}

export function getQueuePosition(phone) {
  const idx = state.waitingQueue.findIndex(e => e.phone === phone);
  return idx >= 0 ? idx + 1 : 0;
}

export function removeFromQueue(phone) {
  state.waitingQueue = state.waitingQueue.filter(e => e.phone !== phone);
}

// ─── Callback system ──────────────────────────────────────────
export function requestCallback(phone, name, serviceId) {
  // Remove from waiting queue if present
  removeFromQueue(phone);

  // Don't duplicate
  const existing = state.callbackRequests.find(
    r => r.phone === phone && r.status === "pending"
  );
  if (existing) return { alreadyRequested: true, position: getCallbackPosition(phone) };

  state.callbackRequests.push({
    phone, name, serviceId,
    requestedAt: Date.now(),
    status: "pending",
  });

  return { position: state.callbackRequests.filter(r => r.status === "pending").length };
}

function getCallbackPosition(phone) {
  const pending = state.callbackRequests.filter(r => r.status === "pending");
  const idx = pending.findIndex(r => r.phone === phone);
  return idx >= 0 ? idx + 1 : 0;
}

// Process the next callback in queue when capacity frees up
async function processQueue() {
  if (isAtCapacity()) return;

  // First try waiting queue, then callbacks
  if (state.waitingQueue.length > 0) {
    // Waiting queue callers are still on the line — handled by Twilio hold
    return;
  }

  const nextCallback = state.callbackRequests.find(r => r.status === "pending");
  if (!nextCallback) return;

  nextCallback.status = "calling";

  try {
    await initiateCallback(nextCallback);
    nextCallback.status = "completed";
  } catch (err) {
    console.error("Error en callback:", err);
    nextCallback.status = "failed";
  }
}

async function initiateCallback(request) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  const baseUrl = process.env.BASE_URL || "https://romainge.com";

  if (!accountSid || !authToken || !fromNumber) {
    console.warn("Twilio credentials not configured for callbacks");
    return;
  }

  const client = twilio(accountSid, authToken);

  await client.calls.create({
    to: request.phone,
    from: fromNumber,
    url: `${baseUrl}/api/voice/callback-connect?phone=${encodeURIComponent(request.phone)}&name=${encodeURIComponent(request.name)}&serviceId=${encodeURIComponent(request.serviceId)}`,
    statusCallback: `${baseUrl}/api/voice/status`,
    statusCallbackEvent: ["completed"],
  });
}

// ─── Stats ────────────────────────────────────────────────────
export function getQueueStats() {
  return {
    activeCalls: state.activeCalls.size,
    maxConcurrent: MAX_CONCURRENT,
    waitingInQueue: state.waitingQueue.length,
    pendingCallbacks: state.callbackRequests.filter(r => r.status === "pending").length,
  };
}

// Periodic cleanup of old callback requests (>24h)
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  state.callbackRequests = state.callbackRequests.filter(
    r => r.requestedAt > cutoff || r.status === "pending"
  );
}, 60 * 60 * 1000);
