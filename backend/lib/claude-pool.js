// ═══════════════════════════════════════════════════════════════
// lib/claude-pool.js — Connection pool for Anthropic Claude API
// ═══════════════════════════════════════════════════════════════

import Anthropic from "@anthropic-ai/sdk";

const POOL_SIZE = parseInt(process.env.CLAUDE_POOL_SIZE || "3", 10);
const MAX_CONCURRENT = parseInt(process.env.CLAUDE_MAX_CONCURRENT || "5", 10);
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

// ─── Pool state ──────────────────────────────────────────────
const clients = [];
const clientStats = []; // { active, totalRequests }
const queue = [];       // { resolve }
let totalRequestsServed = 0;

function ensurePool() {
  if (clients.length > 0) return;
  for (let i = 0; i < POOL_SIZE; i++) {
    clients.push(new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
    clientStats.push({ active: 0, totalRequests: 0 });
  }
}

// ─── Select least-busy client under capacity ────────────────
function selectClient() {
  ensurePool();
  let bestIdx = -1;
  let bestActive = Infinity;
  for (let i = 0; i < clients.length; i++) {
    if (clientStats[i].active < MAX_CONCURRENT && clientStats[i].active < bestActive) {
      bestActive = clientStats[i].active;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// ─── Get a client (may queue if all at capacity) ────────────
export function getClient() {
  const idx = selectClient();
  if (idx !== -1) {
    clientStats[idx].active++;
    clientStats[idx].totalRequests++;
    totalRequestsServed++;
    return { client: clients[idx], id: idx };
  }
  // All clients at capacity — queue the request
  return new Promise((resolve) => {
    queue.push({ resolve });
  });
}

// ─── Release a client slot ──────────────────────────────────
export function releaseClient(clientId) {
  if (clientId < 0 || clientId >= clientStats.length) return;
  clientStats[clientId].active = Math.max(0, clientStats[clientId].active - 1);

  // Drain queue if a slot opened up
  if (queue.length > 0) {
    const idx = selectClient();
    if (idx !== -1) {
      const waiting = queue.shift();
      clientStats[idx].active++;
      clientStats[idx].totalRequests++;
      totalRequestsServed++;
      waiting.resolve({ client: clients[idx], id: idx });
    }
  }
}

// ─── Pool health metrics ────────────────────────────────────
export function getPoolStats() {
  ensurePool();
  let activeTotal = 0;
  let idleTotal = 0;
  const perClient = clientStats.map((s, i) => {
    activeTotal += s.active;
    const idle = MAX_CONCURRENT - s.active;
    idleTotal += idle;
    return { id: i, active: s.active, idle, totalRequests: s.totalRequests };
  });
  return {
    poolSize: POOL_SIZE,
    maxConcurrentPerClient: MAX_CONCURRENT,
    active: activeTotal,
    idle: idleTotal,
    queued: queue.length,
    totalRequests: totalRequestsServed,
    clients: perClient,
  };
}

// ─── Retry helper for rate-limit (429) ──────────────────────
async function withRetry(fn) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.status || err?.statusCode || err?.error?.status;
      if (status === 429 && attempt < MAX_RETRIES) {
        const delay = BASE_BACKOFF_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

// ─── Acquire client, run fn, release on completion ──────────
export async function withClient(fn) {
  const handle = await getClient();
  try {
    return await withRetry(() => fn(handle.client));
  } finally {
    releaseClient(handle.id);
  }
}
