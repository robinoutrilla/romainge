// ═══════════════════════════════════════════════════════════════
// api/admin-routes.js — Admin dashboard API endpoints
// ═══════════════════════════════════════════════════════════════

import { Router } from "express";
import { authenticateAdmin, requireAdmin, getAdminUsers, createAdminUser } from "../lib/admin-auth.js";
import { getCallHistory, getCallStatsByService, getCallStatsGlobal } from "../lib/call-history.js";
import {
  getClaudeUsageStats,
  getTwilioUsageStats,
  getLatencyStats,
  getSurveyStats,
  submitSurvey,
  addCallTag,
  removeCallTag,
  getCallTags,
  getAllTagStats,
  getHeatmapData,
} from "../lib/metrics.js";
import { getQueueStats } from "../lib/voice-queue.js";
import { getAuditLog } from "../lib/audit-log.js";
import { getCacheStats } from "../lib/response-cache.js";
import { SERVICES, SERVICES_MAP } from "../config/services.js";

const router = Router();

// ─── Auth ────────────────────────────────────────────────────
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email y contraseña requeridos" });

  const result = authenticateAdmin(email, password);
  if (!result) return res.status(401).json({ error: "Credenciales incorrectas" });

  res.json(result);
});

router.get("/me", requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

// ─── Dashboard overview ──────────────────────────────────────
router.get("/dashboard", requireAdmin, async (req, res) => {
  const { since, until } = req.query;
  try {
    const [callStats, claudeUsage, twilioUsage, latency, satisfaction, queue, heatmap, tagStats] = await Promise.all([
      getCallStatsGlobal({ since, until }),
      getClaudeUsageStats({ since, until }),
      getTwilioUsageStats({ since, until }),
      getLatencyStats(),
      getSurveyStats({ since, until }),
      getQueueStats(),
      getHeatmapData(),
      getAllTagStats(),
    ]);

    const totalCostUSD = claudeUsage.totalCostUSD + twilioUsage.totalCostUSD;

    res.json({
      calls: callStats,
      claude: claudeUsage,
      twilio: twilioUsage,
      latency,
      satisfaction,
      queue,
      heatmap,
      tags: tagStats,
      totalCostUSD: Math.round(totalCostUSD * 10000) / 10000,
    });
  } catch (err) {
    console.error("Error dashboard:", err);
    res.status(500).json({ error: "Error al obtener datos del dashboard" });
  }
});

// ─── Call history (paginated) ────────────────────────────────
router.get("/calls", requireAdmin, async (req, res) => {
  const { serviceId, callerPhone, status, since, until, limit, offset } = req.query;
  try {
    const result = await getCallHistory({
      serviceId, callerPhone, status, since, until,
      limit: parseInt(limit) || 50,
      offset: parseInt(offset) || 0,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener historial" });
  }
});

// ─── Call stats by service ───────────────────────────────────
router.get("/calls/by-service", requireAdmin, async (req, res) => {
  const { since, until } = req.query;
  try {
    const stats = await getCallStatsByService({ since, until });
    res.json({ byService: stats });
  } catch (err) {
    res.status(500).json({ error: "Error stats por servicio" });
  }
});

// ─── Charts data: calls by hour/day/week ─────────────────────
router.get("/calls/chart", requireAdmin, async (req, res) => {
  const { period = "day", since, until } = req.query;
  try {
    const result = await getCallHistory({ since, until, limit: 10000 });
    const buckets = {};

    for (const call of result.calls) {
      const d = new Date(call.createdAt);
      let key;
      if (period === "hour") {
        key = d.toISOString().slice(0, 13) + ":00";
      } else if (period === "week") {
        const day = new Date(d);
        day.setDate(day.getDate() - day.getDay());
        key = day.toISOString().slice(0, 10);
      } else {
        key = d.toISOString().slice(0, 10);
      }
      if (!buckets[key]) buckets[key] = { total: 0, completed: 0, failed: 0, transferred: 0 };
      buckets[key].total++;
      buckets[key][call.status] = (buckets[key][call.status] || 0) + 1;
    }

    const chart = Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, data]) => ({ time, ...data }));

    res.json({ period, chart });
  } catch (err) {
    res.status(500).json({ error: "Error datos gráfica" });
  }
});

// ─── Cost monitoring ─────────────────────────────────────────
router.get("/costs", requireAdmin, (req, res) => {
  const { since, until } = req.query;
  const claude = getClaudeUsageStats({ since, until });
  const twilio = getTwilioUsageStats({ since, until });

  res.json({
    claude: {
      ...claude,
      costEUR: Math.round(claude.totalCostUSD * 0.92 * 100) / 100, // Approx EUR
    },
    twilio: {
      ...twilio,
      costEUR: Math.round(twilio.totalCostUSD * 0.92 * 100) / 100,
    },
    total: {
      costUSD: Math.round((claude.totalCostUSD + twilio.totalCostUSD) * 100) / 100,
      costEUR: Math.round((claude.totalCostUSD + twilio.totalCostUSD) * 0.92 * 100) / 100,
    },
  });
});

// ─── Latency monitoring ──────────────────────────────────────
router.get("/latency", requireAdmin, (req, res) => {
  res.json(getLatencyStats());
});

// ─── Satisfaction surveys ────────────────────────────────────
router.get("/satisfaction", requireAdmin, (req, res) => {
  const { since, until, serviceId } = req.query;
  res.json(getSurveyStats({ since, until, serviceId }));
});

router.post("/satisfaction", async (req, res) => {
  // Public endpoint — users submit after call
  const { callSid, sessionId, rating, comment, serviceId } = req.body;
  if (!rating) return res.status(400).json({ error: "Rating requerido (1-5)" });
  try {
    submitSurvey({ callSid, sessionId, rating: parseInt(rating), comment, serviceId });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Call tags ───────────────────────────────────────────────
router.post("/calls/:callSid/tags", requireAdmin, (req, res) => {
  const { tag } = req.body;
  if (!tag) return res.status(400).json({ error: "Tag requerido" });
  const tags = addCallTag(req.params.callSid, tag, req.admin.email);
  res.json({ tags });
});

router.delete("/calls/:callSid/tags/:tag", requireAdmin, (req, res) => {
  const tags = removeCallTag(req.params.callSid, req.params.tag);
  res.json({ tags });
});

router.get("/calls/:callSid/tags", requireAdmin, (req, res) => {
  res.json({ tags: getCallTags(req.params.callSid) });
});

router.get("/tags/stats", requireAdmin, (req, res) => {
  res.json(getAllTagStats());
});

// ─── Heatmap by CCAA ─────────────────────────────────────────
router.get("/heatmap", requireAdmin, (req, res) => {
  res.json(getHeatmapData());
});

// ─── Transcription viewer ────────────────────────────────────
router.get("/calls/:callSid/transcription", requireAdmin, async (req, res) => {
  // Try to fetch from Twilio recording transcription
  const { callSid } = req.params;
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      return res.status(501).json({ error: "Twilio no configurado" });
    }

    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);

    // Get recordings for this call
    const recordings = await client.recordings.list({ callSid, limit: 5 });
    if (!recordings.length) {
      return res.json({ callSid, transcription: null, message: "No hay grabación para esta llamada" });
    }

    // Get transcriptions if available
    const transcriptions = [];
    for (const rec of recordings) {
      try {
        const transList = await client.recordings(rec.sid).transcriptions.list();
        for (const t of transList) {
          transcriptions.push({
            recordingSid: rec.sid,
            transcriptionSid: t.sid,
            text: t.transcriptionText,
            status: t.status,
            duration: rec.duration,
          });
        }
      } catch {
        // No transcription for this recording
      }
    }

    res.json({
      callSid,
      recordings: recordings.map(r => ({
        sid: r.sid,
        duration: r.duration,
        url: `https://api.twilio.com${r.uri.replace(".json", ".mp3")}`,
      })),
      transcriptions,
    });
  } catch (err) {
    console.error("Error transcripción:", err);
    res.status(500).json({ error: "Error al obtener transcripción" });
  }
});

// ─── Export (CSV/Excel) ──────────────────────────────────────
router.get("/export/calls", requireAdmin, async (req, res) => {
  const { format = "csv", since, until, serviceId } = req.query;
  try {
    const result = await getCallHistory({ since, until, serviceId, limit: 50000 });

    if (format === "csv") {
      const headers = ["ID", "CallSID", "Teléfono", "Servicio", "Estado", "Duración(s)", "Idioma", "Fecha"];
      const rows = result.calls.map(c => [
        c.id, c.callSid, c.callerPhone, c.serviceId, c.status,
        c.duration, c.language, new Date(c.createdAt).toISOString(),
      ]);
      const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v || ""}"`).join(","))].join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="romainge-calls-${Date.now()}.csv"`);
      res.send("\uFEFF" + csv); // BOM for Excel
    } else {
      // Simple XLSX-compatible XML (Excel 2003 XML Spreadsheet)
      const headers = ["ID", "CallSID", "Teléfono", "Servicio", "Estado", "Duración(s)", "Idioma", "Fecha"];
      const xmlRows = result.calls.map(c =>
        `<Row>${[c.id, c.callSid, c.callerPhone, c.serviceId, c.status, c.duration, c.language, new Date(c.createdAt).toISOString()].map(v => `<Cell><Data ss:Type="String">${v || ""}</Data></Cell>`).join("")}</Row>`
      );

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Llamadas">
<Table>
<Row>${headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join("")}</Row>
${xmlRows.join("\n")}
</Table>
</Worksheet>
</Workbook>`;

      res.setHeader("Content-Type", "application/vnd.ms-excel");
      res.setHeader("Content-Disposition", `attachment; filename="romainge-calls-${Date.now()}.xls"`);
      res.send(xml);
    }
  } catch (err) {
    console.error("Error exportación:", err);
    res.status(500).json({ error: "Error al exportar" });
  }
});

router.get("/export/costs", requireAdmin, (req, res) => {
  const { since, until } = req.query;
  const claude = getClaudeUsageStats({ since, until });
  const twilio = getTwilioUsageStats({ since, until });

  const headers = ["Hora", "Llamadas Claude", "Tokens", "Coste USD"];
  const rows = claude.byHour.map(h => [h.hour, h.calls, h.tokens, h.cost.toFixed(4)]);
  const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="romainge-costs-${Date.now()}.csv"`);
  res.send("\uFEFF" + csv);
});

// ─── Audit log ───────────────────────────────────────────────
router.get("/audit-log", requireAdmin, (req, res) => {
  const { sessionId, event, ip, since, limit } = req.query;
  const log = getAuditLog({ sessionId, event, ip, since, limit: parseInt(limit) || 100 });
  res.json({ log });
});

// ─── Queue stats ─────────────────────────────────────────────
router.get("/queue", requireAdmin, (req, res) => {
  res.json(getQueueStats());
});

// ─── Services list ───────────────────────────────────────────
router.get("/services", requireAdmin, (req, res) => {
  res.json({ services: SERVICES });
});

// ─── Cache stats ─────────────────────────────────────────────
router.get("/cache", requireAdmin, async (req, res) => {
  try {
    const stats = await getCacheStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Error cache stats" });
  }
});

// ─── Admin users management ──────────────────────────────────
router.get("/users", requireAdmin, (req, res) => {
  if (req.admin.role !== "superadmin") return res.status(403).json({ error: "Solo superadmin" });
  res.json({ users: getAdminUsers() });
});

router.post("/users", requireAdmin, (req, res) => {
  if (req.admin.role !== "superadmin") return res.status(403).json({ error: "Solo superadmin" });
  const { email, name, password, role } = req.body;
  if (!email || !name || !password) return res.status(400).json({ error: "email, name, password requeridos" });
  try {
    const user = createAdminUser(email, name, password, role);
    res.status(201).json({ user });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

export default router;
