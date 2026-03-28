import React from "react";
import { LANGUAGES } from "../i18n.js";
import { t } from "../i18n.js";
import { StatusBadge } from "./shared.jsx";

export default function Header({ th, lang, setLang, themeName, setThemeName, view, setView, setShowSearch, backendOnline, navItems, deferredInstall, installPwa, changeLang }) {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 100, background: th.headerBg,
      backdropFilter: "blur(20px)", borderBottom: `1px solid ${th.headerBorder}`, padding: "0 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        <div onClick={() => setView("home")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: th.accentGradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Playfair Display'", fontWeight: 700, fontSize: 18, color: th.bg }}>R</div>
          <div>
            <div style={{ fontFamily: "'Playfair Display'", fontWeight: 600, fontSize: 17, color: th.text }}>RomainGE</div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 9.5, color: th.accent, letterSpacing: 1.5, textTransform: "uppercase", opacity: 0.7 }}>romainge.com</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {backendOnline !== null && <StatusBadge connected={backendOnline} th={th} />}

          {/* Search trigger */}
          <button onClick={() => setShowSearch(true)} title="Ctrl+K" style={{
            background: th.bgTertiary, border: `1px solid ${th.border}`, borderRadius: 8,
            padding: "6px 12px", color: th.textTertiary, fontFamily: "'DM Sans'", fontSize: 12,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginLeft: 8,
          }}>🔍 <span style={{ fontSize: 10, opacity: 0.6 }}>Ctrl+K</span></button>

          {/* Language selector */}
          <select value={lang} onChange={e => changeLang(e.target.value)} style={{
            background: th.bgTertiary, border: `1px solid ${th.border}`, borderRadius: 8,
            padding: "6px 8px", color: th.text, fontSize: 12, cursor: "pointer", outline: "none",
            fontFamily: "'DM Sans'",
          }}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.code.toUpperCase()}</option>)}
          </select>

          {/* Theme toggle */}
          <button onClick={() => setThemeName(themeName === "dark" ? "light" : "dark")} title={themeName === "dark" ? t("lightMode", lang) : t("darkMode", lang)} style={{
            background: th.bgTertiary, border: `1px solid ${th.border}`, borderRadius: 8,
            padding: "6px 10px", cursor: "pointer", fontSize: 16, lineHeight: 1,
          }}>{themeName === "dark" ? "☀️" : "🌙"}</button>

          {/* PWA install */}
          {deferredInstall && (
            <button onClick={installPwa} style={{
              background: th.accentBg, border: `1px solid ${th.accentBorder}`, borderRadius: 8,
              padding: "6px 10px", cursor: "pointer", fontFamily: "'DM Sans'", fontSize: 11,
              color: th.accent, fontWeight: 500,
            }}>{t("installApp", lang)}</button>
          )}

          <nav style={{ display: "flex", gap: 2, marginLeft: 4 }}>
            {navItems.map(item => (
              <button key={item.key} onClick={() => setView(item.key)} style={{
                background: view === item.key ? th.accentBg : "transparent",
                border: "none", borderRadius: 10, padding: "8px 12px",
                color: view === item.key ? th.accent : th.textSecondary,
                fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
              }}>
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
