import React, { useState } from "react";
import { t } from "../i18n.js";
import { FISCAL_DEADLINES } from "../App.jsx";

export default function FiscalCalendar({ th, lang }) {
  const [profile, setProfile] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const now = new Date();

  const deadlines = FISCAL_DEADLINES
    .filter(d => new Date(d.date) >= now)
    .filter(d => profile === "all" || d.profiles.includes(profile))
    .map(d => {
      const date = new Date(d.date);
      const daysLeft = Math.ceil((date - now) / 86400000);
      return { ...d, dateObj: date, daysLeft, urgent: daysLeft <= 7 };
    });

  const months = [...new Set(deadlines.map(d => d.dateObj.getMonth()))];

  return (
    <div style={{ animation: "fadeIn 0.5s ease" }}>
      <h2 style={{ fontFamily: "'Playfair Display'", fontSize: 28, color: th.text, marginBottom: 20 }}>
        {t("calendarTitle", lang)}
      </h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {[["all", "Todos"], ["autonomo", "Autónomos"], ["empresa", "Empresas"], ["particular", "Particulares"]].map(([v, l]) => (
          <button key={v} onClick={() => setProfile(v)} style={{
            padding: "8px 16px", borderRadius: 20, border: "none",
            background: profile === v ? th.accentBg : th.bgTertiary,
            color: profile === v ? th.accent : th.textSecondary,
            fontFamily: "'DM Sans'", fontSize: 12, cursor: "pointer",
          }}>{l}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {deadlines.slice(0, 12).map((d, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 16, padding: "16px 20px",
            borderRadius: 14, background: d.urgent ? th.errorBg : th.bgSecondary,
            border: `1px solid ${d.urgent ? th.errorBorder : th.border}`,
          }}>
            <div style={{ textAlign: "center", minWidth: 48 }}>
              <div style={{ fontFamily: "'Playfair Display'", fontSize: 22, fontWeight: 700, color: d.urgent ? th.error : th.accent }}>
                {d.dateObj.getDate()}
              </div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: th.textTertiary, textTransform: "uppercase" }}>
                {d.dateObj.toLocaleDateString(lang === "ca" ? "ca-ES" : lang === "eu" ? "eu-ES" : lang === "gl" ? "gl-ES" : "es-ES", { month: "short" })}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'DM Sans'", fontWeight: 600, fontSize: 14, color: th.text }}>{d.desc}</div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: th.textTertiary, marginTop: 2 }}>Modelo {d.modelo}</div>
            </div>
            <div style={{
              padding: "4px 10px", borderRadius: 8, fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600,
              background: d.urgent ? th.errorBg : th.accentBg,
              color: d.urgent ? th.error : th.accent,
            }}>
              {d.daysLeft <= 0 ? t("today", lang) : d.urgent ? `${t("urgent", lang)}: ${d.daysLeft}d` : `${d.daysLeft} ${t("daysLeft", lang)}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
