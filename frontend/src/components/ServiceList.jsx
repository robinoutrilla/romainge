import React, { useState } from "react";
import { t } from "../i18n.js";
import { ICONS_MAP } from "../App.jsx";
import { getStyles } from "./shared.jsx";

// ═══════════════════════════════════════════════════════════════
// SERVICE CARD
// ═══════════════════════════════════════════════════════════════

export function ServiceCard({ service, onClick, compact, th }) {
  const [hovered, setHovered] = useState(false);
  const icon = service.icon || ICONS_MAP[service.id] || "📋";
  return (
    <div onClick={() => onClick(service)} onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)} style={{
        background: hovered ? th.bgHover : th.bgSecondary,
        border: hovered ? `1px solid ${th.borderHover}` : `1px solid ${th.border}`,
        borderRadius: 16, padding: compact ? "14px 16px" : "20px 24px",
        cursor: "pointer", transition: "all 0.3s ease",
        transform: hovered ? "translateY(-2px)" : "none",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ fontSize: compact ? 20 : 28, lineHeight: 1 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'DM Sans'", fontWeight: 600, fontSize: compact ? 13 : 15, color: th.text, lineHeight: 1.3, marginBottom: compact ? 4 : 8 }}>
            {service.name}
          </div>
          {!compact && service.desc && (
            <div style={{ fontFamily: "'DM Sans'", fontSize: 12.5, color: th.textSecondary, lineHeight: 1.5 }}>
              {service.desc}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SERVICE LIST VIEW
// ═══════════════════════════════════════════════════════════════

export default function ServiceList({ th, services, searchTerm, setSearchTerm, selectedService, setSelectedService, setView, setSession, lang }) {
  const s = getStyles(th);
  const filteredServices = services.filter(sv =>
    sv.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sv.desc || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ animation: "fadeIn 0.5s ease" }}>
      <h2 style={{ ...s.sectionTitle, marginBottom: 20 }}>{typeof t("allServices", lang) === "function" ? t("allServices", lang)(services.length) : `Servicios (${services.length})`}</h2>
      <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
        placeholder={t("searchService", lang)}
        style={{ ...s.input, marginBottom: 24, maxWidth: 480 }} />
      {selectedService && (
        <div style={{ background: th.accentBg, borderRadius: 16, padding: "24px 28px", marginBottom: 24, border: `1px solid ${th.accentBorder}`, animation: "fadeIn 0.4s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: 32 }}>{selectedService.icon || ICONS_MAP[selectedService.id]}</span>
              <h3 style={{ fontFamily: "'Playfair Display'", fontSize: 22, color: th.text, margin: "8px 0 6px" }}>{selectedService.name}</h3>
              <p style={{ fontFamily: "'DM Sans'", fontSize: 13.5, color: th.textSecondary, lineHeight: 1.6 }}>{selectedService.desc}</p>
              <div style={{ marginTop: 12, fontFamily: "'DM Sans'", fontSize: 12, color: th.accent }}>🤖 {selectedService.agent}</div>
            </div>
            <button onClick={() => setSelectedService(null)} style={{ background: "none", border: "none", color: th.textTertiary, fontSize: 24, cursor: "pointer" }}>×</button>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
        {filteredServices.map(svc => <ServiceCard key={svc.id} service={svc} onClick={setSelectedService} compact th={th} />)}
      </div>
      {filteredServices.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 0", fontFamily: "'DM Sans'", color: th.textTertiary }}>
          {typeof t("noResults", lang) === "function" ? t("noResults", lang)(searchTerm) : `No results for "${searchTerm}"`}
        </div>
      )}
    </div>
  );
}
