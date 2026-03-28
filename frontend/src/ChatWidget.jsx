// ═══════════════════════════════════════════════════════════════
// ChatWidget.jsx — Embeddable floating chat widget
// ═══════════════════════════════════════════════════════════════
// Usage: <script src="https://romainge.com/widget.js"></script>
// Or: import ChatWidget from './ChatWidget'; <ChatWidget />

import React, { useState, useEffect, useRef } from "react";

const WIDGET_API = window.ROMAINGE_API || "";

export default function ChatWidget({ apiBase = WIDGET_API, position = "right" }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "agent", text: "¡Hola! Soy el asistente fiscal de RomainGE. ¿En qué puedo ayudarle?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionKey, setSessionKey] = useState("");
  const [phone, setPhone] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [token, setToken] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const login = async () => {
    if (!sessionKey || !phone) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/sessions/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: sessionKey, phone }),
      });
      const data = await res.json();
      if (data.sessionId) {
        setSessionId(data.sessionId);
        setToken(data.token);
        setMessages([{ role: "agent", text: `¡Hola ${data.callerName}! Conectado con ${data.serviceName || "su agente"}. ¿En qué puedo ayudarle?` }]);
      } else {
        setMessages(prev => [...prev, { role: "agent", text: "Clave o teléfono incorrecto. Intente de nuevo." }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "agent", text: "Error de conexión." }]);
    }
    setLoading(false);
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/api/sessions/${sessionId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "agent", text: data.response || data.error || "Error" }]);
    } catch {
      setMessages(prev => [...prev, { role: "agent", text: "Error de conexión." }]);
    }
    setLoading(false);
  };

  const posStyle = position === "left" ? { left: 20 } : { right: 20 };

  return (
    <>
      {/* Toggle button */}
      {!open && (
        <button onClick={() => setOpen(true)} style={{
          position: "fixed", bottom: 20, ...posStyle, zIndex: 10000,
          width: 56, height: 56, borderRadius: "50%", border: "none",
          background: "linear-gradient(135deg, #00b894, #00cec9)",
          color: "#0a0f14", fontSize: 24, cursor: "pointer",
          boxShadow: "0 4px 20px rgba(0,206,201,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>💬</button>
      )}

      {/* Chat window */}
      {open && (
        <div style={{
          position: "fixed", bottom: 20, ...posStyle, zIndex: 10000,
          width: 360, height: 520, borderRadius: 16,
          background: "#0a0f14", border: "1px solid rgba(0,206,201,0.2)",
          display: "flex", flexDirection: "column",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          fontFamily: "'DM Sans', -apple-system, sans-serif",
        }}>
          {/* Header */}
          <div style={{
            padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderRadius: "16px 16px 0 0",
            background: "linear-gradient(135deg, rgba(0,184,148,0.15), rgba(0,206,201,0.08))",
          }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#e8e6e3" }}>RomainGE</div>
              <div style={{ fontSize: 10, color: "rgba(0,206,201,0.7)" }}>Asistente Fiscal IA</div>
            </div>
            <button onClick={() => setOpen(false)} style={{
              background: "none", border: "none", color: "rgba(232,230,227,0.4)",
              fontSize: 20, cursor: "pointer",
            }}>×</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 8,
              }}>
                <div style={{
                  maxWidth: "80%", padding: "8px 12px", borderRadius: 12, fontSize: 13,
                  lineHeight: 1.5, color: "#e8e6e3",
                  background: msg.role === "user" ? "rgba(0,206,201,0.15)" : "rgba(255,255,255,0.05)",
                  border: msg.role === "user" ? "1px solid rgba(0,206,201,0.2)" : "1px solid rgba(255,255,255,0.06)",
                }}>{msg.text}</div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: 4, padding: 8 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "rgba(0,206,201,0.5)",
                    animation: `widgetDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {!sessionId ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <input value={sessionKey} onChange={e => setSessionKey(e.target.value)}
                  placeholder="Clave de sesión" style={widgetInputStyle} />
                <input value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="Teléfono +34..." style={widgetInputStyle}
                  onKeyDown={e => e.key === "Enter" && login()} />
                <button onClick={login} disabled={loading} style={widgetBtnStyle}>
                  {loading ? "..." : "Acceder"}
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && send()}
                  placeholder="Escriba su consulta..." disabled={loading}
                  style={{ ...widgetInputStyle, flex: 1 }} />
                <button onClick={send} disabled={loading || !input.trim()} style={widgetBtnStyle}>
                  →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes widgetDot {
          0%,100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
    </>
  );
}

const widgetInputStyle = {
  width: "100%", padding: "8px 10px", borderRadius: 8,
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
  color: "#e8e6e3", fontSize: 13, outline: "none",
  fontFamily: "'DM Sans', sans-serif",
};

const widgetBtnStyle = {
  padding: "8px 14px", borderRadius: 8, border: "none",
  background: "rgba(0,206,201,0.15)", color: "#00cec9",
  fontSize: 13, fontWeight: 500, cursor: "pointer",
  fontFamily: "'DM Sans', sans-serif",
};
