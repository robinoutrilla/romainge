// ═══════════════════════════════════════════════════════════════
// tests/metrics.test.js — Tests para métricas, tags, heatmap y satisfacción
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  trackClaudeUsage,
  getClaudeUsageStats,
  trackTwilioUsage,
  getTwilioUsageStats,
  trackLatency,
  getLatencyStats,
  submitSurvey,
  getSurveyStats,
  addCallTag,
  removeCallTag,
  getCallTags,
  getAllTagStats,
  phoneToCCAA,
  trackCallByCCAA,
  getHeatmapData,
} from "../lib/metrics.js";

describe("Claude Usage Tracking", () => {
  it("tracks a Claude API call", () => {
    trackClaudeUsage({
      inputTokens: 500,
      outputTokens: 200,
      model: "claude-sonnet-4-20250514",
      durationMs: 1200,
      serviceId: "impuestos",
    });

    const stats = getClaudeUsageStats();
    expect(stats.totalCalls).toBeGreaterThanOrEqual(1);
    expect(stats.totalInputTokens).toBeGreaterThanOrEqual(500);
    expect(stats.totalOutputTokens).toBeGreaterThanOrEqual(200);
  });

  it("calculates cost correctly", () => {
    // Track a known amount
    trackClaudeUsage({
      inputTokens: 1000000, // 1M tokens
      outputTokens: 0,
      model: "claude-sonnet-4-20250514",
      durationMs: 500,
      serviceId: "test",
    });

    const stats = getClaudeUsageStats();
    // 1M input tokens at $3/1M = $3.00
    expect(stats.totalCostUSD).toBeGreaterThanOrEqual(3.0);
  });

  it("groups by hour", () => {
    trackClaudeUsage({
      inputTokens: 100,
      outputTokens: 50,
      model: "claude-sonnet-4-20250514",
      durationMs: 300,
      serviceId: "censos",
    });

    const stats = getClaudeUsageStats();
    expect(stats.byHour).toBeInstanceOf(Array);
    if (stats.byHour.length > 0) {
      expect(stats.byHour[0]).toHaveProperty("hour");
      expect(stats.byHour[0]).toHaveProperty("calls");
      expect(stats.byHour[0]).toHaveProperty("tokens");
    }
  });

  it("groups by model", () => {
    trackClaudeUsage({
      inputTokens: 50,
      outputTokens: 25,
      model: "claude-haiku-4-5-20251001",
      durationMs: 100,
      serviceId: "test",
    });

    const stats = getClaudeUsageStats();
    expect(stats.byModel).toHaveProperty("claude-haiku-4-5-20251001");
  });
});

describe("Twilio Usage Tracking", () => {
  it("tracks a Twilio call", () => {
    trackTwilioUsage({ callSid: "CA-twilio-test-1", durationSec: 120, direction: "inbound" });

    const stats = getTwilioUsageStats();
    expect(stats.totalCalls).toBeGreaterThanOrEqual(1);
    expect(stats.totalMinutes).toBeGreaterThanOrEqual(2);
  });

  it("calculates cost with rate", () => {
    trackTwilioUsage({ callSid: "CA-twilio-test-2", durationSec: 60, direction: "inbound" });

    const stats = getTwilioUsageStats();
    expect(stats.totalCostUSD).toBeGreaterThan(0);
    expect(stats.ratePerMin).toBeTruthy();
  });
});

describe("Latency Monitoring", () => {
  it("tracks and reports latency", () => {
    trackLatency({ durationMs: 800, model: "claude-sonnet-4-20250514", endpoint: "chat" });
    trackLatency({ durationMs: 1200, model: "claude-sonnet-4-20250514", endpoint: "chat" });
    trackLatency({ durationMs: 600, model: "claude-sonnet-4-20250514", endpoint: "chat" });

    const stats = getLatencyStats();
    expect(stats.last5min).toBeDefined();
    expect(stats.last5min.avg).toBeGreaterThan(0);
    expect(stats.last5min.p50).toBeGreaterThan(0);
    expect(stats.last5min.count).toBeGreaterThanOrEqual(3);
  });

  it("provides time series data", () => {
    const stats = getLatencyStats();
    expect(stats.series).toBeInstanceOf(Array);
    if (stats.series.length > 0) {
      expect(stats.series[0]).toHaveProperty("time");
      expect(stats.series[0]).toHaveProperty("avg");
    }
  });
});

describe("Satisfaction Surveys", () => {
  it("submits survey with valid rating", () => {
    submitSurvey({ callSid: "CA-survey-1", rating: 5, comment: "Excelente", serviceId: "impuestos" });
    submitSurvey({ callSid: "CA-survey-2", rating: 4, serviceId: "aduanas" });
    submitSurvey({ callSid: "CA-survey-3", rating: 2, serviceId: "impuestos" });

    const stats = getSurveyStats();
    expect(stats.total).toBeGreaterThanOrEqual(3);
    expect(stats.avgRating).toBeGreaterThan(0);
    expect(stats.avgRating).toBeLessThanOrEqual(5);
  });

  it("rejects invalid rating", () => {
    expect(() => submitSurvey({ rating: 0 })).toThrow();
    expect(() => submitSurvey({ rating: 6 })).toThrow();
  });

  it("calculates NPS", () => {
    const stats = getSurveyStats();
    expect(stats.nps).toBeDefined();
    expect(typeof stats.nps).toBe("number");
    expect(stats.nps).toBeGreaterThanOrEqual(-100);
    expect(stats.nps).toBeLessThanOrEqual(100);
  });

  it("has distribution object", () => {
    const stats = getSurveyStats();
    expect(stats.distribution).toBeDefined();
    for (let i = 1; i <= 5; i++) {
      expect(stats.distribution[i]).toBeDefined();
    }
  });

  it("filters by serviceId", () => {
    const stats = getSurveyStats({ serviceId: "impuestos" });
    expect(stats.total).toBeGreaterThanOrEqual(1);
  });
});

describe("Call Tags", () => {
  it("adds tag to call", () => {
    const tags = addCallTag("CA-tag-test-1", "urgente", "admin@test.com");
    expect(tags).toHaveLength(1);
    expect(tags[0].tag).toBe("urgente");
    expect(tags[0].addedBy).toBe("admin@test.com");
  });

  it("does not duplicate tags", () => {
    addCallTag("CA-tag-test-2", "revisado");
    addCallTag("CA-tag-test-2", "revisado");
    const tags = getCallTags("CA-tag-test-2");
    expect(tags.filter(t => t.tag === "revisado")).toHaveLength(1);
  });

  it("removes tag", () => {
    addCallTag("CA-tag-test-3", "spam");
    addCallTag("CA-tag-test-3", "duplicado");

    removeCallTag("CA-tag-test-3", "spam");
    const tags = getCallTags("CA-tag-test-3");
    expect(tags.some(t => t.tag === "spam")).toBe(false);
    expect(tags.some(t => t.tag === "duplicado")).toBe(true);
  });

  it("returns empty array for untagged call", () => {
    expect(getCallTags("CA-no-tags")).toEqual([]);
  });

  it("getAllTagStats counts correctly", () => {
    const stats = getAllTagStats();
    expect(stats.tagCounts).toBeDefined();
    expect(stats.totalTaggedCalls).toBeGreaterThanOrEqual(1);
  });
});

describe("CCAA Heatmap", () => {
  it("maps Madrid landline prefix", () => {
    expect(phoneToCCAA("+34912345678")).toBe("Madrid");
    expect(phoneToCCAA("+34912345678")).toBe("Madrid");
  });

  it("maps Barcelona landline prefix", () => {
    expect(phoneToCCAA("+34931234567")).toBe("Cataluña");
  });

  it("maps Valencia landline prefix", () => {
    expect(phoneToCCAA("+34961234567")).toBe("C. Valenciana");
  });

  it("maps Sevilla landline prefix", () => {
    expect(phoneToCCAA("+34951234567")).toBe("Andalucía");
  });

  it("maps mobile phones as unlocatable", () => {
    expect(phoneToCCAA("+34612345678")).toBe("Móvil (sin geoloc.)");
    expect(phoneToCCAA("+34712345678")).toBe("Móvil (sin geoloc.)");
  });

  it("handles null/empty phone", () => {
    expect(phoneToCCAA(null)).toBe("Desconocido");
    expect(phoneToCCAA("")).toBe("Desconocido");
  });

  it("tracks calls and returns heatmap data", () => {
    trackCallByCCAA("+34912345678"); // Madrid
    trackCallByCCAA("+34931234567"); // Cataluña
    trackCallByCCAA("+34912345679"); // Madrid

    const heatmap = getHeatmapData();
    expect(heatmap.total).toBeGreaterThanOrEqual(3);
    expect(heatmap.data).toBeInstanceOf(Array);
    expect(heatmap.data[0]).toHaveProperty("ccaa");
    expect(heatmap.data[0]).toHaveProperty("count");
    expect(heatmap.data[0]).toHaveProperty("pct");
  });
});

describe("Admin Auth", () => {
  it("authenticates dev admin in non-production", async () => {
    const { authenticateAdmin } = await import("../lib/admin-auth.js");
    const result = authenticateAdmin("admin@romainge.com", "admin123");

    expect(result).not.toBeNull();
    expect(result.token).toBeTruthy();
    expect(result.admin.email).toBe("admin@romainge.com");
    expect(result.admin.role).toBe("superadmin");
  });

  it("rejects wrong password", async () => {
    const { authenticateAdmin } = await import("../lib/admin-auth.js");
    const result = authenticateAdmin("admin@romainge.com", "wrongpass");
    expect(result).toBeNull();
  });

  it("rejects unknown email", async () => {
    const { authenticateAdmin } = await import("../lib/admin-auth.js");
    const result = authenticateAdmin("unknown@test.com", "admin123");
    expect(result).toBeNull();
  });
});
