import React, { useState, useEffect, useRef } from "react";
import {
  fetchMessages,
  sendMessage,
  streamMessage,
  ChatSocket,
} from "../api.js";
import { t } from "../i18n.js";
import MarkdownRenderer from "../MarkdownRenderer.jsx";
import { getStyles } from "./shared.jsx";

// ═══════════════════════════════════════════════════════════════
// TYPING INDICATOR
// ═══════════════════════════════════════════════════════════════

function TypingIndicator({ th, lang }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px" }}>
      <div style={{ display: "flex", gap: 4 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: th.accent,
            animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite`, opacity: 0.6 }} />
        ))}
      </div>
      <span style={{ fontFamily: "'DM Sans'", fontSize: 11, color: th.textTertiary, fontStyle: "italic" }}>
        {t("agentTyping", lang)}...
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SESSION CHAT
// ═══════════════════════════════════════════════════════════════

export default function SessionChat({ session, service, th, lang }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const s = getStyles(th);

  useEffect(() => {
    if (!session?.sessionId) return;
    fetchMessages(session.sessionId).then(msgs => {
      if (msgs.length > 0) setMessages(msgs);
      else setMessages([{ role: "agent", text: `¡Hola ${session.callerName}! Soy el ${service.agent}, su asistente especializado en ${service.name}. ¿En qué puedo ayudarle?`, timestamp: new Date().toISOString() }]);
    }).catch(() => {
      setMessages([{ role: "agent", text: `¡Hola ${session.callerName}! Soy el ${service.agent}. Estoy listo para ayudarle con ${service.name}.`, timestamp: new Date().toISOString() }]);
    });

    try {
      const sock = new ChatSocket(session.sessionId);
      sock.on("chunk", (text) => setStreaming(prev => prev + text));
      sock.on("done", (text) => {
        setStreaming("");
        setMessages(prev => [...prev, { role: "agent", text, timestamp: new Date().toISOString() }]);
        setLoading(false);
        // Push notification if tab not focused
        if (document.hidden && "Notification" in window && Notification.permission === "granted") {
          new Notification("RomainGE", { body: text.slice(0, 100), icon: "/icon-192.png" });
        }
      });
      sock.on("typing", () => setLoading(true));
      sock.on("error", () => setLoading(false));
      sock.connect();
      socketRef.current = sock;
      setWsConnected(true);
    } catch { setWsConnected(false); }

    return () => socketRef.current?.close();
  }, [session, service]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streaming]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userText, timestamp: new Date().toISOString() }]);
    setLoading(true);

    if (wsConnected && socketRef.current) {
      socketRef.current.send(userText);
    } else {
      try {
        setStreaming("");
        streamMessage(session.sessionId, userText,
          (chunk) => setStreaming(prev => prev + chunk),
          (fullText) => {
            setStreaming("");
            setMessages(prev => [...prev, { role: "agent", text: fullText, timestamp: new Date().toISOString() }]);
            setLoading(false);
          },
          () => {
            sendMessage(session.sessionId, userText).then(data => {
              setStreaming("");
              setMessages(prev => [...prev, { role: "agent", text: data.response, timestamp: new Date().toISOString() }]);
              setLoading(false);
            }).catch(() => {
              setMessages(prev => [...prev, { role: "agent", text: t("connectionError", lang), timestamp: new Date().toISOString() }]);
              setLoading(false);
            });
          }
        );
      } catch {
        try {
          const data = await sendMessage(session.sessionId, userText);
          setMessages(prev => [...prev, { role: "agent", text: data.response, timestamp: new Date().toISOString() }]);
        } catch {
          setMessages(prev => [...prev, { role: "agent", text: t("connectionError", lang), timestamp: new Date().toISOString() }]);
        }
        setLoading(false);
      }
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const API_BASE = import.meta.env.VITE_API_URL || "";
      const token = (await import("../api.js")).getAuthToken();
      const res = await fetch(`${API_BASE}/api/sessions/${session.sessionId}/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.document) {
        setMessages(prev => [...prev, { role: "user", text: `📎 ${data.document.filename} (${(data.document.size / 1024).toFixed(1)} KB)`, timestamp: new Date().toISOString() }]);
      }
    } catch (err) {
      console.error("Upload error:", err);
    }
    e.target.value = "";
  };

  const formatTime = (ts) => {
    try { return new Date(ts).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            marginBottom: 12, animation: "fadeIn 0.3s ease",
          }}>
            <div style={{
              maxWidth: "80%", padding: "12px 16px", borderRadius: 16,
              background: msg.role === "user" ? th.chatUser : th.chatAgent,
              border: msg.role === "user" ? `1px solid ${th.chatUserBorder}` : `1px solid ${th.chatAgentBorder}`,
            }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 13.5, color: th.text, lineHeight: 1.6 }}>
                {msg.role === "agent" ? <MarkdownRenderer text={msg.text} theme={th} /> : <span style={{ whiteSpace: "pre-wrap" }}>{msg.text}</span>}
              </div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: th.textTertiary, marginTop: 6, textAlign: "right" }}>
                {formatTime(msg.timestamp)}
              </div>
            </div>
          </div>
        ))}
        {streaming && (
          <div style={{ display: "flex", marginBottom: 12 }}>
            <div style={{ maxWidth: "80%", padding: "12px 16px", borderRadius: 16, background: th.chatAgent, border: `1px solid ${th.chatAgentBorder}` }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 13.5, color: th.text, lineHeight: 1.6 }}>
                <MarkdownRenderer text={streaming} theme={th} /><span style={{ animation: "pulse 1s infinite" }}>▊</span>
              </div>
            </div>
          </div>
        )}
        {loading && !streaming && <TypingIndicator th={th} lang={lang} />}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: 8, padding: "12px 0 0", borderTop: `1px solid ${th.border}` }}>
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{ display: "none" }}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.xlsx" />
        <button onClick={() => fileInputRef.current?.click()} title={t("uploadFile", lang)} style={{
          ...s.backBtn, padding: "12px", fontSize: 16, flexShrink: 0 }}>📎</button>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder={t("typeQuery", lang)} disabled={loading}
          style={{ ...s.input, flex: 1 }} />
        <button onClick={send} disabled={loading || !input.trim()} style={{
          ...s.primaryBtn, padding: "12px 20px", flexShrink: 0,
          opacity: loading || !input.trim() ? 0.4 : 1,
        }}>{t("send", lang)}</button>
      </div>
    </div>
  );
}
