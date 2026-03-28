import React, { useState, useRef, useEffect } from "react";
import { t } from "../i18n.js";
import { FAQ_ITEMS } from "../App.jsx";

export default function GlobalSearch({ services, onSelect, onClose, th, lang }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const q = query.toLowerCase().trim();
  const results = [];
  if (q.length >= 2) {
    services.filter(s => s.name.toLowerCase().includes(q) || (s.desc || "").toLowerCase().includes(q))
      .slice(0, 5).forEach(s => results.push({ type: "service", item: s }));
    FAQ_ITEMS.filter(f => f.q.toLowerCase().includes(q) || f.tags.includes(q))
      .slice(0, 3).forEach(f => results.push({ type: "faq", item: f }));
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9998, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      display: "flex", justifyContent: "center", paddingTop: 120 }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 560, height: "fit-content" }} onClick={e => e.stopPropagation()}>
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
          placeholder={t("globalSearch", lang)} style={{
            width: "100%", padding: "16px 20px", borderRadius: 16, fontSize: 16,
            background: th.bg, border: `1px solid ${th.borderHover}`, color: th.text,
            fontFamily: "'DM Sans'", outline: "none", boxShadow: `0 8px 32px rgba(0,0,0,0.4)`,
          }} />
        {results.length > 0 && (
          <div style={{ marginTop: 8, background: th.bg, borderRadius: 16, border: `1px solid ${th.border}`,
            overflow: "hidden", boxShadow: `0 8px 32px rgba(0,0,0,0.3)` }}>
            {results.map((r, i) => (
              <div key={i} onClick={() => { onSelect(r); onClose(); }} style={{
                padding: "12px 20px", cursor: "pointer", borderBottom: `1px solid ${th.border}`,
                transition: "background 0.2s",
              }} onMouseEnter={e => e.currentTarget.style.background = th.bgHover}
                 onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 500, color: th.text }}>
                  {r.type === "service" ? `${r.item.icon || "📋"} ${r.item.name}` : `❓ ${r.item.q}`}
                </div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: th.textTertiary, marginTop: 2 }}>
                  {r.type === "service" ? r.item.desc : r.item.a}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
