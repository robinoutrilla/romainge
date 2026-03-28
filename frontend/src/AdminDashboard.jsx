// ═══════���═══════════════════════════════════════════════════════
// AdminDashboard.jsx — Full admin dashboard with charts & metrics
// ════���════════════════════════���════════════════════════���════════

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const API_BASE = import.meta.env.VITE_API_URL || "";

// ─── Admin API helper ────────────────────────────────────────
function adminFetch(path, opts = {}) {
  const token = localStorage.getItem("adminToken");
  return fetch(`${API_BASE}/api/admin${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...opts.headers,
    },
  });
}

// ─── Color palette ────────────────────────────────────────────
const COLORS = ["#00cec9", "#00b894", "#fdcb6e", "#e17055", "#6c5ce7", "#74b9ff", "#55efc4", "#fab1a0"];
const STATUS_COLORS = { completed: "#00b894", failed: "#e17055", transferred: "#fdcb6e", queued: "#74b9ff" };

// ═══════════════════════════════════════════════════════════════
// ADMIN LOGIN
// ═══════════════════════���═══════════════════════════════════════

function AdminLogin({ onLogin, th }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem("adminToken", data.token);
        onLogin(data.admin);
      } else {
        setError(data.error || "Error de autenticación");
      }
    } catch {
      setError("Error de conexión");
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 380, margin: "80px auto", padding: 24 }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🛡️</div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", color: th.text, fontSize: 24, margin: 0 }}>
          Panel de Administración
        </h2>
        <p style={{ color: th.textSecondary, fontSize: 13, marginTop: 6 }}>RomainGE — Gestión Fiscal con IA</p>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
            style={inputStyle(th)} type="email" required />
        </div>
        <div style={{ marginBottom: 16 }}>
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña"
            style={inputStyle(th)} type="password" required />
        </div>
        {error && <div style={{ color: "#e17055", fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={loading} style={{
          width: "100%", padding: 12, borderRadius: 10, border: "none",
          background: "linear-gradient(135deg, #00b894, #00cec9)", color: "#0a0f14",
          fontWeight: 600, fontSize: 14, cursor: "pointer",
        }}>{loading ? "..." : "Acceder"}</button>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STAT CARD
// ═════════════════════════════════════════════════���═════════════

function StatCard({ icon, label, value, sub, th, color }) {
  return (
    <div style={{
      background: th.bgSecondary, borderRadius: 12, padding: 16,
      border: `1px solid ${th.border}`, flex: "1 1 180px", minWidth: 160,
    }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 11, color: th.textSecondary, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || th.accent, fontFamily: "'DM Sans'" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: th.textTertiary, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ══════════════════════════════════��════════════════════════════
// CALL CHARTS
// ════════════��════════════���═════════════════════════════════════

function CallCharts({ th }) {
  const [period, setPeriod] = useState("day");
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const since = new Date();
    if (period === "hour") since.setDate(since.getDate() - 1);
    else if (period === "day") since.setDate(since.getDate() - 30);
    else since.setDate(since.getDate() - 90);

    adminFetch(`/calls/chart?period=${period}&since=${since.toISOString()}`)
      .then(r => r.json()).then(d => { setChartData(d.chart || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period]);

  return (
    <div style={{ background: th.bgSecondary, borderRadius: 12, padding: 20, border: `1px solid ${th.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: th.text, fontSize: 16 }}>Llamadas</h3>
        <div style={{ display: "flex", gap: 4 }}>
          {["hour", "day", "week"].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: "4px 10px", borderRadius: 6, border: "none", fontSize: 11, cursor: "pointer",
              background: period === p ? th.accentBg : th.bgTertiary,
              color: period === p ? th.accent : th.textSecondary,
            }}>{p === "hour" ? "Hora" : p === "day" ? "Día" : "Semana"}</button>
          ))}
        </div>
      </div>
      {loading ? <div style={{ color: th.textSecondary, padding: 40, textAlign: "center" }}>Cargando...</div> : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={th.border} />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: th.textSecondary }} tickFormatter={v => {
              if (period === "hour") return v.slice(11, 16);
              return v.slice(5, 10);
            }} />
            <YAxis tick={{ fontSize: 10, fill: th.textSecondary }} />
            <Tooltip contentStyle={{ background: th.bg, border: `1px solid ${th.border}`, borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="completed" stackId="a" fill="#00b894" name="Completadas" />
            <Bar dataKey="failed" stackId="a" fill="#e17055" name="Fallidas" />
            <Bar dataKey="transferred" stackId="a" fill="#fdcb6e" name="Transferidas" />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ═══════════════════════��═══════════════════════════════════════
// COST PANEL
// ══════════════════════���════════════════════════════���═══════════

function CostPanel({ dashboard, th }) {
  const claude = dashboard?.claude || {};
  const twilio = dashboard?.twilio || {};

  const pieData = [
    { name: "Claude API", value: claude.totalCostUSD || 0 },
    { name: "Twilio Voice", value: twilio.totalCostUSD || 0 },
  ].filter(d => d.value > 0);

  return (
    <div style={{ background: th.bgSecondary, borderRadius: 12, padding: 20, border: `1px solid ${th.border}` }}>
      <h3 style={{ margin: "0 0 16px", color: th.text, fontSize: 16 }}>Costes (últimas 24h)</h3>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 180px" }}>
          <div style={{ fontSize: 11, color: th.textSecondary, marginBottom: 4 }}>Claude API</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#6c5ce7" }}>${(claude.totalCostUSD || 0).toFixed(4)}</div>
          <div style={{ fontSize: 11, color: th.textTertiary }}>{claude.totalCalls || 0} llamadas · {((claude.totalTokens || 0) / 1000).toFixed(1)}K tokens</div>
        </div>
        <div style={{ flex: "1 1 180px" }}>
          <div style={{ fontSize: 11, color: th.textSecondary, marginBottom: 4 }}>Twilio Voice</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#00cec9" }}>${(twilio.totalCostUSD || 0).toFixed(4)}</div>
          <div style={{ fontSize: 11, color: th.textTertiary }}>{twilio.totalCalls || 0} llamadas · {(twilio.totalMinutes || 0).toFixed(1)} min</div>
        </div>
        {pieData.length > 0 && (
          <div style={{ flex: "0 0 140px" }}>
            <ResponsiveContainer width={140} height={120}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={v => `$${v.toFixed(4)}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      {claude.byHour?.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, color: th.textSecondary, marginBottom: 8 }}>Tokens por hora</div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={claude.byHour}>
              <CartesianGrid strokeDasharray="3 3" stroke={th.border} />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: th.textSecondary }} tickFormatter={v => v.slice(11)} />
              <YAxis tick={{ fontSize: 9, fill: th.textSecondary }} />
              <Tooltip contentStyle={{ background: th.bg, border: `1px solid ${th.border}`, borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="tokens" stroke="#6c5ce7" fill="rgba(108,92,231,0.15)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ═══════���═══════════════════════════════════════════════════════
// LATENCY MONITOR
// ��══════════════════════════════════════════════════════════════

function LatencyMonitor({ th }) {
  const [latency, setLatency] = useState(null);

  useEffect(() => {
    const load = () => adminFetch("/latency").then(r => r.json()).then(setLatency).catch(() => {});
    load();
    const iv = setInterval(load, 10000); // Refresh every 10s
    return () => clearInterval(iv);
  }, []);

  if (!latency) return null;
  const { last5min, lastHour, series } = latency;

  return (
    <div style={{ background: th.bgSecondary, borderRadius: 12, padding: 20, border: `1px solid ${th.border}` }}>
      <h3 style={{ margin: "0 0 12px", color: th.text, fontSize: 16 }}>Latencia Claude API (en vivo)</h3>
      <div style={{ display: "flex", gap: 20, marginBottom: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, color: th.textSecondary }}>Últ. 5 min (avg)</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: last5min.avg > 3000 ? "#e17055" : last5min.avg > 1500 ? "#fdcb6e" : "#00b894" }}>
            {last5min.avg}ms
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: th.textSecondary }}>P95</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: th.text }}>{last5min.p95}ms</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: th.textSecondary }}>P99</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: th.text }}>{last5min.p99}ms</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: th.textSecondary }}>Últ. hora (avg)</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: th.text }}>{lastHour.avg}ms</div>
        </div>
      </div>
      {series?.length > 0 && (
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke={th.border} />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: th.textSecondary }} tickFormatter={v => v.slice(11)} />
            <YAxis tick={{ fontSize: 9, fill: th.textSecondary }} unit="ms" />
            <Tooltip contentStyle={{ background: th.bg, border: `1px solid ${th.border}`, borderRadius: 8, fontSize: 11 }} />
            <Line type="monotone" dataKey="avg" stroke="#00cec9" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ══════���════════════════════════════════════════════════════════
// SATISFACTION PANEL
// ═══���═══════════════════════════════════════════════════════════

function SatisfactionPanel({ data, th }) {
  if (!data || data.total === 0) {
    return (
      <div style={{ background: th.bgSecondary, borderRadius: 12, padding: 20, border: `1px solid ${th.border}` }}>
        <h3 style={{ margin: 0, color: th.text, fontSize: 16 }}>Satisfacción</h3>
        <p style={{ color: th.textSecondary, fontSize: 13, marginTop: 8 }}>Sin encuestas aún</p>
      </div>
    );
  }

  const dist = data.distribution || {};
  const chartData = [1, 2, 3, 4, 5].map(r => ({ rating: `${r}★`, count: dist[r] || 0 }));

  return (
    <div style={{ background: th.bgSecondary, borderRadius: 12, padding: 20, border: `1px solid ${th.border}` }}>
      <h3 style={{ margin: "0 0 12px", color: th.text, fontSize: 16 }}>Satisfacción</h3>
      <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: th.textSecondary }}>Media</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#fdcb6e" }}>{data.avgRating}★</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: th.textSecondary }}>NPS</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: data.nps > 0 ? "#00b894" : "#e17055" }}>{data.nps}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: th.textSecondary }}>Total</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: th.text }}>{data.total}</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={chartData}>
          <XAxis dataKey="rating" tick={{ fontSize: 11, fill: th.textSecondary }} />
          <YAxis hide />
          <Bar dataKey="count" fill="#fdcb6e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ═════���═════════��═══════════════════════════���═══════════════════
// HEATMAP (CCAA)
// ═══════════════════════════════════════════════════════════════

function CCAAHeatmap({ data, th }) {
  if (!data?.data?.length) {
    return (
      <div style={{ background: th.bgSecondary, borderRadius: 12, padding: 20, border: `1px solid ${th.border}` }}>
        <h3 style={{ margin: 0, color: th.text, fontSize: 16 }}>Mapa de Calor por CCAA</h3>
        <p style={{ color: th.textSecondary, fontSize: 13, marginTop: 8 }}>Sin datos geográficos</p>
      </div>
    );
  }

  const max = Math.max(...data.data.map(d => d.count));

  return (
    <div style={{ background: th.bgSecondary, borderRadius: 12, padding: 20, border: `1px solid ${th.border}` }}>
      <h3 style={{ margin: "0 0 12px", color: th.text, fontSize: 16 }}>Llamadas por Comunidad Autónoma</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {data.data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 130, fontSize: 11, color: th.textSecondary, textAlign: "right", flexShrink: 0 }}>
              {d.ccaa}
            </div>
            <div style={{ flex: 1, height: 18, background: th.bgTertiary, borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 4,
                width: `${max ? (d.count / max) * 100 : 0}%`,
                background: `linear-gradient(90deg, #00b894, #00cec9)`,
                transition: "width 0.3s",
              }} />
            </div>
            <div style={{ width: 60, fontSize: 11, color: th.text }}>
              {d.count} ({d.pct}%)
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: th.textTertiary, marginTop: 8 }}>Total: {data.total} llamadas</div>
    </div>
  );
}

// ═══════════════════��═══════════════════════════════════════════
// CALL TAGGING
// ═══════════════════════════════════════════════════════════════

function CallTagEditor({ callSid, th }) {
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    adminFetch(`/calls/${callSid}/tags`).then(r => r.json()).then(d => setTags(d.tags || [])).catch(() => {});
  }, [callSid]);

  const addTag = () => {
    if (!newTag.trim()) return;
    adminFetch(`/calls/${callSid}/tags`, {
      method: "POST", body: JSON.stringify({ tag: newTag.trim() }),
    }).then(r => r.json()).then(d => { setTags(d.tags || []); setNewTag(""); }).catch(() => {});
  };

  const removeTag = (tag) => {
    adminFetch(`/calls/${callSid}/tags/${encodeURIComponent(tag)}`, { method: "DELETE" })
      .then(r => r.json()).then(d => setTags(d.tags || [])).catch(() => {});
  };

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
      {tags.map((t, i) => (
        <span key={i} style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          background: th.accentBg, color: th.accent, padding: "2px 8px",
          borderRadius: 10, fontSize: 10,
        }}>
          {t.tag}
          <span onClick={() => removeTag(t.tag)} style={{ cursor: "pointer", opacity: 0.6 }}>×</span>
        </span>
      ))}
      <input value={newTag} onChange={e => setNewTag(e.target.value)}
        onKeyDown={e => e.key === "Enter" && addTag()}
        placeholder="+ etiqueta" style={{
          width: 80, padding: "2px 6px", fontSize: 10, borderRadius: 6,
          border: `1px solid ${th.border}`, background: th.inputBg, color: th.text, outline: "none",
        }} />
    </div>
  );
}

// ═��═══════════════════════════════════════════════���═════════════
// CALL LIST + TRANSCRIPTION VIEWER
// ═══════════════════���═══════════════════════════════════════════

function CallList({ th }) {
  const [calls, setCalls] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [selectedCall, setSelectedCall] = useState(null);
  const [transcription, setTranscription] = useState(null);
  const [loadingTx, setLoadingTx] = useState(false);

  useEffect(() => {
    adminFetch(`/calls?limit=20&offset=${page * 20}`)
      .then(r => r.json()).then(d => { setCalls(d.calls || []); setTotal(d.total || 0); })
      .catch(() => {});
  }, [page]);

  const downloadExport = async (format) => {
    const res = await adminFetch(`/export/calls?format=${format}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `romainge-calls.${format === "excel" ? "xls" : "csv"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const viewTranscription = (callSid) => {
    setSelectedCall(callSid);
    setLoadingTx(true);
    adminFetch(`/calls/${callSid}/transcription`)
      .then(r => r.json()).then(d => { setTranscription(d); setLoadingTx(false); })
      .catch(() => setLoadingTx(false));
  };

  return (
    <div style={{ background: th.bgSecondary, borderRadius: 12, padding: 20, border: `1px solid ${th.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: th.text, fontSize: 16 }}>Historial de Llamadas ({total})</h3>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => downloadExport("csv")} style={{ background: "none", border: "none", fontSize: 11, color: th.accent, cursor: "pointer" }}>CSV</button>
          <button onClick={() => downloadExport("excel")} style={{ background: "none", border: "none", fontSize: 11, color: th.accent, cursor: "pointer" }}>Excel</button>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${th.border}` }}>
              {["Fecha", "Teléfono", "Servicio", "Estado", "Duración", "Etiquetas", ""].map(h => (
                <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: th.textSecondary, fontWeight: 500, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calls.map(call => (
              <tr key={call.id} style={{ borderBottom: `1px solid ${th.border}` }}>
                <td style={{ padding: "6px 8px", color: th.text }}>{new Date(call.createdAt).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                <td style={{ padding: "6px 8px", color: th.text }}>{call.callerPhone?.slice(-4) ? `***${call.callerPhone.slice(-4)}` : "—"}</td>
                <td style={{ padding: "6px 8px", color: th.text }}>{call.serviceId || "—"}</td>
                <td style={{ padding: "6px 8px" }}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 8, fontSize: 10, fontWeight: 500,
                    background: STATUS_COLORS[call.status] ? `${STATUS_COLORS[call.status]}22` : th.bgTertiary,
                    color: STATUS_COLORS[call.status] || th.textSecondary,
                  }}>{call.status}</span>
                </td>
                <td style={{ padding: "6px 8px", color: th.textSecondary }}>{call.duration}s</td>
                <td style={{ padding: "6px 8px" }}><CallTagEditor callSid={call.callSid} th={th} /></td>
                <td style={{ padding: "6px 8px" }}>
                  <button onClick={() => viewTranscription(call.callSid)} style={{
                    background: "none", border: "none", color: th.accent, fontSize: 11, cursor: "pointer",
                  }}>Ver</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 12 }}>
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={pageBtnStyle(th)}>← Anterior</button>
          <span style={{ fontSize: 11, color: th.textSecondary, padding: "6px 0" }}>
            {page * 20 + 1}-{Math.min((page + 1) * 20, total)} de {total}
          </span>
          <button disabled={(page + 1) * 20 >= total} onClick={() => setPage(p => p + 1)} style={pageBtnStyle(th)}>Siguiente →</button>
        </div>
      )}

      {/* Transcription viewer modal */}
      {selectedCall && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 10001,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => { setSelectedCall(null); setTranscription(null); }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: th.bg, borderRadius: 16, padding: 24, maxWidth: 600, width: "90%",
            maxHeight: "80vh", overflowY: "auto", border: `1px solid ${th.border}`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ margin: 0, color: th.text, fontSize: 16 }}>Transcripción — {selectedCall}</h3>
              <button onClick={() => { setSelectedCall(null); setTranscription(null); }} style={{
                background: "none", border: "none", color: th.textSecondary, fontSize: 18, cursor: "pointer",
              }}>×</button>
            </div>
            {loadingTx ? (
              <p style={{ color: th.textSecondary }}>Cargando...</p>
            ) : transcription ? (
              <>
                {transcription.recordings?.map((r, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: th.textSecondary }}>Grabación: {r.sid} ({r.duration}s)</div>
                    <audio controls src={r.url} style={{ width: "100%", marginTop: 4 }} />
                  </div>
                ))}
                {transcription.transcriptions?.length > 0 ? (
                  transcription.transcriptions.map((t, i) => (
                    <div key={i} style={{
                      background: th.bgSecondary, borderRadius: 8, padding: 12, marginBottom: 8,
                      fontSize: 13, color: th.text, lineHeight: 1.6,
                    }}>{t.text}</div>
                  ))
                ) : (
                  <p style={{ color: th.textSecondary, fontSize: 13 }}>
                    {transcription.message || "No hay transcripción disponible para esta llamada."}
                  </p>
                )}
              </>
            ) : (
              <p style={{ color: th.textSecondary }}>Error al cargar</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN ADMIN DASHBOARD
// ══��════════════════════════════════════════════════════════════

export default function AdminDashboard({ th, onBack }) {
  const [admin, setAdmin] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  // Check existing token
  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (token) {
      adminFetch("/me").then(r => {
        if (r.ok) return r.json();
        localStorage.removeItem("adminToken");
        throw new Error();
      }).then(d => setAdmin(d.admin)).catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Load dashboard data
  useEffect(() => {
    if (!admin) return;
    adminFetch("/dashboard")
      .then(r => r.json()).then(d => { setDashboard(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [admin]);

  const logout = () => {
    localStorage.removeItem("adminToken");
    setAdmin(null);
    setDashboard(null);
  };

  if (!admin && !loading) return <AdminLogin onLogin={setAdmin} th={th} />;
  if (!admin) return <div style={{ padding: 40, textAlign: "center", color: th.textSecondary }}>Cargando...</div>;

  const tabs = [
    { key: "overview", label: "General", icon: "📊" },
    { key: "calls", label: "Llamadas", icon: "📞" },
    { key: "costs", label: "Costes", icon: "💰" },
    { key: "latency", label: "Latencia", icon: "⚡" },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {onBack && <button onClick={onBack} style={{
            background: th.bgTertiary, border: "none", borderRadius: 8,
            padding: "6px 12px", color: th.textSecondary, fontSize: 13, cursor: "pointer",
          }}>← Volver</button>}
          <h2 style={{ margin: 0, fontFamily: "'Playfair Display', serif", color: th.text, fontSize: 22 }}>
            Panel Admin
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: th.textSecondary }}>{admin.email}</span>
          <button onClick={logout} style={{
            background: "none", border: `1px solid ${th.border}`, borderRadius: 8,
            padding: "4px 10px", color: th.textSecondary, fontSize: 11, cursor: "pointer",
          }}>Salir</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "8px 14px", borderRadius: 8, border: "none", fontSize: 12, cursor: "pointer",
            background: tab === t.key ? th.accentBg : th.bgTertiary,
            color: tab === t.key ? th.accent : th.textSecondary,
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && (
        <>
          {/* Stat cards */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            <StatCard icon="📞" label="Llamadas (24h)" value={dashboard?.calls?.totalCalls || 0} th={th} />
            <StatCard icon="⏱️" label="Duración media" value={`${dashboard?.calls?.avgDuration || 0}s`} th={th} />
            <StatCard icon="💰" label="Coste total (24h)" value={`$${(dashboard?.totalCostUSD || 0).toFixed(2)}`} th={th} color="#fdcb6e" />
            <StatCard icon="📊" label="Cola actual" value={dashboard?.queue?.waitingInQueue || 0}
              sub={`${dashboard?.queue?.activeCalls || 0}/${dashboard?.queue?.maxConcurrent || 10} activas`} th={th} />
            <StatCard icon="⭐" label="Satisfacción" value={dashboard?.satisfaction?.avgRating ? `${dashboard.satisfaction.avgRating}★` : "—"}
              sub={`NPS: ${dashboard?.satisfaction?.nps || "—"}`} th={th} color="#fdcb6e" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <CallCharts th={th} />
            <SatisfactionPanel data={dashboard?.satisfaction} th={th} />
            <CostPanel dashboard={dashboard} th={th} />
            <CCAAHeatmap data={dashboard?.heatmap} th={th} />
          </div>
        </>
      )}

      {/* Calls tab */}
      {tab === "calls" && <CallList th={th} />}

      {/* Costs tab */}
      {tab === "costs" && <CostPanel dashboard={dashboard} th={th} />}

      {/* Latency tab */}
      {tab === "latency" && <LatencyMonitor th={th} />}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────
function inputStyle(th) {
  return {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    background: th.inputBg, border: `1px solid ${th.inputBorder}`,
    color: th.text, fontSize: 14, outline: "none",
    fontFamily: "'DM Sans', sans-serif",
  };
}

function pageBtnStyle(th) {
  return {
    padding: "4px 12px", borderRadius: 6, border: `1px solid ${th.border}`,
    background: th.bgTertiary, color: th.textSecondary, fontSize: 11, cursor: "pointer",
  };
}
