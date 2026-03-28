import React, { useState } from "react";

// ═══════════════════════════════════════════════════════════════
// THEMED STYLES
// ═══════════════════════════════════════════════════════════════

export function getStyles(th) {
  return {
    input: { width: "100%", padding: "12px 16px", borderRadius: 12, background: th.inputBg, border: `1px solid ${th.inputBorder}`, color: th.text, fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: "none" },
    label: { fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 500, color: th.textSecondary, display: "block", marginBottom: 6 },
    primaryBtn: { padding: "10px 20px", borderRadius: 12, border: "none", background: th.accentBg, color: th.accent, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 0.2s" },
    backBtn: { padding: "8px 14px", borderRadius: 10, border: "none", background: th.bgTertiary, color: th.textSecondary, fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: "pointer" },
    sectionTitle: { fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 600, color: th.text, letterSpacing: -0.5 },
  };
}

// ═══════════════════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════════════════

export function FormRow({ label, value, onChange, type = "text", placeholder, suffix, styles }) {
  const s = styles || {};
  return (
    <div>
      <label style={s.label}>{label}</label>
      <div style={{ position: "relative" }}>
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} style={s.input} />
        {suffix && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontFamily: "'DM Sans'", fontSize: 14, color: "rgba(128,128,128,0.6)" }}>{suffix}</span>}
      </div>
    </div>
  );
}

export function CheckRow({ label, checked, onChange, th }) {
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
      padding: "12px 16px", borderRadius: 12,
      background: checked ? th.accentBg : th.bgSecondary,
      border: checked ? `1px solid ${th.accentBorder}` : `1px solid ${th.border}`,
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        border: checked ? `2px solid ${th.accent}` : `2px solid ${th.checkBorder}`,
        background: checked ? th.accent : th.checkBg,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {checked && <span style={{ color: th.bg, fontSize: 14, fontWeight: 700 }}>✓</span>}
      </div>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: "none" }} />
      <span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: th.text }}>{label}</span>
    </label>
  );
}

export function StatusBadge({ connected, th }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: connected ? th.success : th.error }} />
      <span style={{ fontFamily: "'DM Sans'", fontSize: 11, color: connected ? th.success : th.error }}>
        {connected ? "Online" : "Offline"}
      </span>
    </div>
  );
}
