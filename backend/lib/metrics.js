// ═══════════════════════════════════════════════════════════════
// lib/metrics.js — Cost tracking, latency monitoring, satisfaction
// ═══════════════════════════════════════════════════════════════

// ─── Claude API Usage Tracking ──────────────────────────────
const usageLog = []; // { timestamp, inputTokens, outputTokens, model, durationMs, serviceId }
const MAX_LOG_SIZE = 10000;

// Pricing per 1M tokens (USD) — updated for current models
const PRICING = {
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
};

export function trackClaudeUsage({ inputTokens, outputTokens, model, durationMs, serviceId }) {
  if (usageLog.length >= MAX_LOG_SIZE) usageLog.splice(0, usageLog.length - MAX_LOG_SIZE + 1000);
  usageLog.push({ timestamp: Date.now(), inputTokens, outputTokens, model, durationMs, serviceId });
}

export function getClaudeUsageStats({ since, until } = {}) {
  const from = since ? new Date(since).getTime() : Date.now() - 24 * 60 * 60 * 1000;
  const to = until ? new Date(until).getTime() : Date.now();
  const filtered = usageLog.filter(e => e.timestamp >= from && e.timestamp <= to);

  let totalInput = 0, totalOutput = 0, totalCostUSD = 0, totalDuration = 0;
  const byModel = {};
  const byService = {};
  const byHour = {};

  for (const e of filtered) {
    totalInput += e.inputTokens;
    totalOutput += e.outputTokens;
    totalDuration += e.durationMs;

    const pricing = PRICING[e.model] || PRICING["claude-sonnet-4-20250514"];
    const cost = (e.inputTokens / 1e6) * pricing.input + (e.outputTokens / 1e6) * pricing.output;
    totalCostUSD += cost;

    byModel[e.model] = (byModel[e.model] || 0) + 1;

    if (e.serviceId) {
      if (!byService[e.serviceId]) byService[e.serviceId] = { calls: 0, tokens: 0, cost: 0 };
      byService[e.serviceId].calls++;
      byService[e.serviceId].tokens += e.inputTokens + e.outputTokens;
      byService[e.serviceId].cost += cost;
    }

    const hour = new Date(e.timestamp).toISOString().slice(0, 13);
    if (!byHour[hour]) byHour[hour] = { calls: 0, tokens: 0, cost: 0 };
    byHour[hour].calls++;
    byHour[hour].tokens += e.inputTokens + e.outputTokens;
    byHour[hour].cost += cost;
  }

  return {
    totalCalls: filtered.length,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    totalTokens: totalInput + totalOutput,
    totalCostUSD: Math.round(totalCostUSD * 10000) / 10000,
    avgDurationMs: filtered.length ? Math.round(totalDuration / filtered.length) : 0,
    byModel,
    byService,
    byHour: Object.entries(byHour).sort(([a], [b]) => a.localeCompare(b)).map(([hour, data]) => ({ hour, ...data })),
  };
}

// ─── Twilio Usage Tracking ──────────────────────────────────
const twilioLog = []; // { timestamp, callSid, durationSec, direction }
const TWILIO_RATE_PER_MIN = parseFloat(process.env.TWILIO_RATE_PER_MIN) || 0.015; // USD

export function trackTwilioUsage({ callSid, durationSec, direction = "inbound" }) {
  if (twilioLog.length >= MAX_LOG_SIZE) twilioLog.splice(0, twilioLog.length - MAX_LOG_SIZE + 1000);
  twilioLog.push({ timestamp: Date.now(), callSid, durationSec, direction });
}

export function getTwilioUsageStats({ since, until } = {}) {
  const from = since ? new Date(since).getTime() : Date.now() - 24 * 60 * 60 * 1000;
  const to = until ? new Date(until).getTime() : Date.now();
  const filtered = twilioLog.filter(e => e.timestamp >= from && e.timestamp <= to);

  const totalMinutes = filtered.reduce((sum, e) => sum + e.durationSec / 60, 0);
  return {
    totalCalls: filtered.length,
    totalMinutes: Math.round(totalMinutes * 100) / 100,
    totalCostUSD: Math.round(totalMinutes * TWILIO_RATE_PER_MIN * 10000) / 10000,
    ratePerMin: TWILIO_RATE_PER_MIN,
  };
}

// ─── API Latency Monitoring ──────────────────────────────────
const latencyLog = []; // { timestamp, durationMs, model, endpoint }
const LATENCY_WINDOW = 5 * 60 * 1000; // 5 min rolling window

export function trackLatency({ durationMs, model, endpoint = "chat" }) {
  latencyLog.push({ timestamp: Date.now(), durationMs, model, endpoint });
  // Prune old entries
  const cutoff = Date.now() - 60 * 60 * 1000; // keep 1h
  while (latencyLog.length > 0 && latencyLog[0].timestamp < cutoff) latencyLog.shift();
}

export function getLatencyStats() {
  const now = Date.now();
  const recent = latencyLog.filter(e => now - e.timestamp < LATENCY_WINDOW);
  const allHour = latencyLog;

  const calc = (entries) => {
    if (!entries.length) return { avg: 0, p50: 0, p95: 0, p99: 0, count: 0 };
    const sorted = entries.map(e => e.durationMs).sort((a, b) => a - b);
    return {
      avg: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      count: sorted.length,
    };
  };

  // Per-minute series for chart
  const byMinute = {};
  for (const e of allHour) {
    const min = new Date(e.timestamp).toISOString().slice(0, 16);
    if (!byMinute[min]) byMinute[min] = [];
    byMinute[min].push(e.durationMs);
  }

  return {
    last5min: calc(recent),
    lastHour: calc(allHour),
    series: Object.entries(byMinute).sort(([a], [b]) => a.localeCompare(b)).map(([time, vals]) => ({
      time,
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      count: vals.length,
    })),
  };
}

// ─── Satisfaction Surveys ──────────────────────────────────
const surveys = []; // { timestamp, callSid, sessionId, rating (1-5), comment, serviceId }

export function submitSurvey({ callSid, sessionId, rating, comment, serviceId }) {
  if (rating < 1 || rating > 5) throw new Error("Rating debe ser entre 1 y 5");
  surveys.push({ timestamp: Date.now(), callSid, sessionId, rating, comment, serviceId });
}

export function getSurveyStats({ since, until, serviceId } = {}) {
  const from = since ? new Date(since).getTime() : 0;
  const to = until ? new Date(until).getTime() : Date.now();
  let filtered = surveys.filter(s => s.timestamp >= from && s.timestamp <= to);
  if (serviceId) filtered = filtered.filter(s => s.serviceId === serviceId);

  if (!filtered.length) return { total: 0, avgRating: 0, distribution: {}, nps: 0 };

  const total = filtered.length;
  const avgRating = Math.round((filtered.reduce((s, e) => s + e.rating, 0) / total) * 100) / 100;
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const s of filtered) dist[s.rating]++;

  // NPS-like: promoters (4-5) - detractors (1-2)
  const promoters = (dist[4] + dist[5]) / total;
  const detractors = (dist[1] + dist[2]) / total;
  const nps = Math.round((promoters - detractors) * 100);

  return {
    total,
    avgRating,
    distribution: dist,
    nps,
    recent: filtered.slice(-10).reverse(),
  };
}

// ─── Call Tags ────────────────────────────────────────────────
const callTags = new Map(); // callSid → [{ tag, addedBy, addedAt }]

export function addCallTag(callSid, tag, addedBy = "admin") {
  if (!callTags.has(callSid)) callTags.set(callSid, []);
  const tags = callTags.get(callSid);
  if (tags.some(t => t.tag === tag)) return tags;
  tags.push({ tag, addedBy, addedAt: Date.now() });
  return tags;
}

export function removeCallTag(callSid, tag) {
  const tags = callTags.get(callSid);
  if (!tags) return [];
  const filtered = tags.filter(t => t.tag !== tag);
  callTags.set(callSid, filtered);
  return filtered;
}

export function getCallTags(callSid) {
  return callTags.get(callSid) || [];
}

export function getAllTagStats() {
  const tagCounts = {};
  for (const [, tags] of callTags) {
    for (const { tag } of tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  return { tagCounts, totalTaggedCalls: callTags.size };
}

// ─── Heatmap data (calls by CCAA) ──────────────────────────
// Phone prefix → CCAA mapping (simplified Spanish landline prefixes)
const PREFIX_TO_CCAA = {
  "91": "Madrid", "81": "Madrid",
  "93": "Cataluña", "83": "Cataluña", "97": "Cataluña",
  "96": "C. Valenciana", "86": "C. Valenciana",
  "95": "Andalucía", "85": "Andalucía",
  "94": "País Vasco", "84": "País Vasco",
  "98": "Asturias", "88": "Asturias",
  "92": "Andalucía (Málaga)",
  "82": "Murcia",
  "87": "Canarias",
  "71": "Baleares",
  "74": "Aragón", "76": "Aragón",
  "75": "Castilla y León",
  "80": "Castilla-La Mancha",
  "42": "Navarra", "48": "País Vasco",
  "22": "Aragón (Huesca)",
  "27": "Galicia", "82": "Galicia",
  "41": "Cantabria", "42": "La Rioja",
  "24": "Castilla y León (León)",
  "20": "País Vasco (Gipuzkoa)",
  "28": "Madrid",
  "34": "Cataluña (Tarragona)",
  "37": "Castilla y León (Salamanca)",
  "50": "Aragón (Zaragoza)",
  "11": "Andalucía (Cádiz)",
  "12": "C. Valenciana (Castellón)",
  "15": "Galicia (A Coruña)",
  "18": "Andalucía (Granada)",
  "23": "Andalucía (Jaén)",
  "25": "Cataluña (Lleida)",
  "26": "La Rioja",
  "29": "Andalucía (Málaga)",
  "30": "Murcia",
  "31": "Navarra",
  "32": "Galicia (Ourense)",
  "33": "Asturias",
  "35": "Canarias (Las Palmas)",
  "36": "Galicia (Pontevedra)",
  "38": "Canarias (S/C Tenerife)",
  "39": "Cantabria",
  "40": "Castilla y León (Segovia)",
  "43": "Cataluña (Tarragona)",
  "44": "Aragón (Teruel)",
  "45": "Castilla-La Mancha (Toledo)",
  "46": "C. Valenciana (Valencia)",
  "47": "Castilla y León (Valladolid)",
  "49": "Castilla y León (Zamora)",
  "51": "Ceuta",
  "52": "Melilla",
};

// Normalize CCAA names
function normalizeCCAA(ccaa) {
  if (ccaa?.includes("Andalucía")) return "Andalucía";
  if (ccaa?.includes("Cataluña")) return "Cataluña";
  if (ccaa?.includes("C. Valenciana")) return "C. Valenciana";
  if (ccaa?.includes("País Vasco")) return "País Vasco";
  if (ccaa?.includes("Galicia")) return "Galicia";
  if (ccaa?.includes("Castilla y León")) return "Castilla y León";
  if (ccaa?.includes("Castilla-La Mancha")) return "Castilla-La Mancha";
  if (ccaa?.includes("Aragón")) return "Aragón";
  if (ccaa?.includes("Canarias")) return "Canarias";
  return ccaa || "Desconocido";
}

export function phoneToCCAA(phone) {
  if (!phone) return "Desconocido";
  // Remove +34 prefix
  const clean = phone.replace(/\D/g, "").replace(/^34/, "");
  // Mobile phones (6xx, 7xx) — no geographic info
  if (clean.startsWith("6") || clean.startsWith("7")) return "Móvil (sin geoloc.)";
  // Landline: first 2 digits
  const prefix = clean.slice(0, 2);
  return normalizeCCAA(PREFIX_TO_CCAA[prefix]);
}

const heatmapData = new Map(); // CCAA → count

export function trackCallByCCAA(phone) {
  const ccaa = phoneToCCAA(phone);
  heatmapData.set(ccaa, (heatmapData.get(ccaa) || 0) + 1);
}

export function getHeatmapData() {
  const entries = Array.from(heatmapData.entries())
    .map(([ccaa, count]) => ({ ccaa, count }))
    .sort((a, b) => b.count - a.count);
  const total = entries.reduce((s, e) => s + e.count, 0);
  return {
    data: entries.map(e => ({ ...e, pct: total ? Math.round((e.count / total) * 1000) / 10 : 0 })),
    total,
  };
}
