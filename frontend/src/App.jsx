import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  fetchServices,
  loginSession,
  setAuthToken,
  setRefreshToken,
  exportSessionPdf,
} from "./api.js";
import { themes, getStoredTheme, setStoredTheme } from "./theme.js";
import translations, { LANGUAGES, getStoredLang, setStoredLang, t } from "./i18n.js";
import AdminDashboard from "./AdminDashboard.jsx";

// Components
import Header from "./components/Header.jsx";
import ServiceList, { ServiceCard } from "./components/ServiceList.jsx";
import SessionChat from "./components/SessionChat.jsx";
import RentaSimulator from "./components/RentaSimulator.jsx";
import FiscalCalendar from "./components/FiscalCalendar.jsx";
import GlobalSearch from "./components/GlobalSearch.jsx";
import Onboarding from "./components/Onboarding.jsx";
import { getStyles, FormRow } from "./components/shared.jsx";

// ═══════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════

export const FALLBACK_SERVICES = [
  { id: "impuestos", icon: "💶", name: "Impuestos, Tasas y Prestaciones Patrimoniales", shortName: "Impuestos", desc: "IVA, IRPF, Impuesto de Sociedades, Sucesiones y Donaciones.", agent: "Agente Fiscal", keywords: [] },
  { id: "aduanas", icon: "🚢", name: "Aduanas", shortName: "Aduanas", desc: "Despacho aduanero, aranceles, importación/exportación.", agent: "Agente Aduanero", keywords: [] },
  { id: "censos", icon: "🏛️", name: "Censos, NIF y Domicilio Fiscal", shortName: "Censos y NIF", desc: "Alta censal, NIF provisional, modelos 036/037.", agent: "Agente Censal", keywords: [] },
  { id: "certificados", icon: "📜", name: "Certificados", shortName: "Certificados", desc: "Certificados de estar al corriente, IRPF, residencia fiscal.", agent: "Agente Certificados", keywords: [] },
  { id: "recaudacion", icon: "🏦", name: "Recaudación", shortName: "Recaudación", desc: "Aplazamientos, fraccionamientos, embargos, deudas.", agent: "Agente Recaudación", keywords: [] },
  { id: "beneficios", icon: "✅", name: "Beneficios Fiscales y Autorizaciones", shortName: "Beneficios", desc: "Deducciones, bonificaciones, exenciones.", agent: "Agente Beneficios", keywords: [] },
  { id: "comprobaciones", icon: "🔍", name: "Comprobaciones Fiscales y Sancionador", shortName: "Comprobaciones", desc: "Inspecciones, actas, procedimiento sancionador.", agent: "Agente Inspector", keywords: [] },
  { id: "requerimientos", icon: "📩", name: "Requerimientos y Comunicaciones", shortName: "Requerimientos", desc: "Contestación a requerimientos AEAT.", agent: "Agente Comunicaciones", keywords: [] },
  { id: "recursos", icon: "⚖️", name: "Recursos, Reclamaciones y Revisión", shortName: "Recursos", desc: "Recurso de reposición, TEAC, suspensiones.", agent: "Agente Recursos", keywords: [] },
  { id: "otros-tributarios", icon: "📋", name: "Otros Procedimientos Tributarios", shortName: "Otros Trib.", desc: "Consultas vinculantes, acuerdos previos.", agent: "Agente Tributario", keywords: [] },
  { id: "no-tributarios", icon: "📑", name: "Procedimientos No Tributarios", shortName: "No Tributarios", desc: "Procedimientos administrativos no fiscales.", agent: "Agente Administrativo", keywords: [] },
  { id: "aapp", icon: "🏢", name: "Administraciones Públicas", shortName: "AAPP", desc: "Coordinación con CCAA, EELL, SS.", agent: "Agente AAPP", keywords: [] },
  { id: "colaboracion", icon: "🤝", name: "Colaboración Social", shortName: "Colaboración", desc: "Convenios de colaboración, SII.", agent: "Agente Colaboración", keywords: [] },
  { id: "apoderamiento", icon: "📝", name: "Apoderamiento", shortName: "Apoderamiento", desc: "Registro de apoderamientos.", agent: "Agente Poderes", keywords: [] },
  { id: "sucesion", icon: "👥", name: "Sucesión", shortName: "Sucesión", desc: "Herencias, obligaciones del heredero.", agent: "Agente Sucesiones", keywords: [] },
  { id: "calendario", icon: "📅", name: "Calendario del Contribuyente", shortName: "Calendario", desc: "Fechas clave, plazos, vencimientos.", agent: "Agente Calendario", keywords: [] },
  { id: "cotejo", icon: "🔐", name: "Cotejo de Documentos", shortName: "Cotejo", desc: "Verificación de autenticidad.", agent: "Agente Verificación", keywords: [] },
  { id: "denuncia-tributaria", icon: "🚨", name: "Denuncia Tributaria", shortName: "Denuncia Trib.", desc: "Denuncias por infracciones tributarias.", agent: "Agente Denuncias", keywords: [] },
  { id: "denuncia-efectivo", icon: "💵", name: "Denuncia Pagos en Efectivo", shortName: "Pagos Efectivo", desc: "Denuncias por pagos en efectivo.", agent: "Agente Efectivo", keywords: [] },
  { id: "ley2023", icon: "🛡️", name: "Canal Externo Ley 2/2023", shortName: "Canal Externo", desc: "Protección al informante.", agent: "Agente Protección", keywords: [] },
  { id: "canal-interno", icon: "🔔", name: "Canal Interno Ley 2/2023", shortName: "Canal Interno", desc: "Infracciones personal AEAT.", agent: "Agente Canal Interno", keywords: [] },
  { id: "etiquetas", icon: "🏷️", name: "Etiquetas", shortName: "Etiquetas", desc: "Etiquetas identificativas.", agent: "Agente Etiquetas", keywords: [] },
  { id: "notificaciones", icon: "📬", name: "Notificaciones", shortName: "Notificaciones", desc: "DEH, notificaciones electrónicas.", agent: "Agente Notificaciones", keywords: [] },
  { id: "pago", icon: "💳", name: "Pago de Impuestos", shortName: "Pago", desc: "Pago telemático, NRC, domiciliación.", agent: "Agente Pagos", keywords: [] },
  { id: "simuladores", icon: "🧮", name: "Simuladores", shortName: "Simuladores", desc: "Simuladores de Renta, IVA, retenciones.", agent: "Agente Simulador", keywords: [] },
  { id: "vies", icon: "🇪🇺", name: "VIES", shortName: "VIES", desc: "Validación NIF-IVA intracomunitarios.", agent: "Agente VIES", keywords: [] },
  { id: "concursos", icon: "📊", name: "Acuerdos Extrajudiciales y Concursos", shortName: "Concursos", desc: "Mediación concursal.", agent: "Agente Concursal", keywords: [] },
  { id: "clave", icon: "🔑", name: "Registro Cl@ve", shortName: "Cl@ve", desc: "Alta en Cl@ve PIN y permanente.", agent: "Agente Cl@ve", keywords: [] },
  { id: "cita", icon: "📞", name: "Asistencia y Cita", shortName: "Cita Previa", desc: "Cita previa, asistencia.", agent: "Agente Cita", keywords: [] },
  { id: "firma", icon: "✍️", name: "Documentos Pendientes de Firma", shortName: "Firma", desc: "Firma electrónica.", agent: "Agente Firma", keywords: [] },
  { id: "cert-electronico", icon: "🔏", name: "Certificados Electrónicos Representante", shortName: "Cert. Electrónico", desc: "Certificados de representante.", agent: "Agente Cert. Electrónico", keywords: [] },
  { id: "autorizacion-cert", icon: "🛂", name: "Autorización Certificados Electrónicos", shortName: "Autoriz. Cert.", desc: "Autorización de certificados.", agent: "Agente Autorización", keywords: [] },
  { id: "token", icon: "🎫", name: "Obtención de TOKEN", shortName: "TOKEN", desc: "Token de identificación.", agent: "Agente Token", keywords: [] },
  { id: "financiacion", icon: "🗺️", name: "Financiación Autonómica y Local", shortName: "Financiación", desc: "Transferencias, liquidaciones.", agent: "Agente Financiación", keywords: [] },
  { id: "cnmc", icon: "⚡", name: "Trámites CNMC", shortName: "CNMC", desc: "Comisión Nacional de los Mercados.", agent: "Agente CNMC", keywords: [] },
  { id: "renta2025", icon: "📊", name: "Campaña Renta 2025", shortName: "Renta 2025", desc: "Declaración de la Renta 2025.", agent: "Agente Renta 2025", keywords: [] },
  { id: "ibi", icon: "🏠", name: "IBI — Impuesto sobre Bienes Inmuebles", shortName: "IBI Municipal", desc: "Valor catastral, bonificaciones, exenciones, recibos IBI.", agent: "Agente IBI Municipal", keywords: [] },
  { id: "modelo303", icon: "📑", name: "Modelo 303 — IVA Trimestral", shortName: "Modelo 303", desc: "Autoliquidación trimestral IVA, prorrata, casillas.", agent: "Agente IVA 303", keywords: [] },
  { id: "autonomos", icon: "💼", name: "Gestión Integral del Autónomo", shortName: "Autónomos", desc: "Modelos 130, 303, 390, cuota de autónomos, tarifa plana.", agent: "Agente Autónomos", keywords: [] },
];

export const ICONS_MAP = {
  impuestos: "💶", aduanas: "🚢", censos: "🏛️", certificados: "📜",
  recaudacion: "🏦", beneficios: "✅", comprobaciones: "🔍", requerimientos: "📩",
  recursos: "⚖️", "otros-tributarios": "📋", "no-tributarios": "📑", aapp: "🏢",
  colaboracion: "🤝", apoderamiento: "📝", sucesion: "👥", calendario: "📅",
  cotejo: "🔐", "denuncia-tributaria": "🚨", "denuncia-efectivo": "💵",
  ley2023: "🛡️", "canal-interno": "🔔", etiquetas: "🏷️", notificaciones: "📬",
  pago: "💳", simuladores: "🧮", vies: "🇪🇺", concursos: "📊", clave: "🔑",
  cita: "📞", firma: "✍️", "cert-electronico": "🔏", "autorizacion-cert": "🛂",
  token: "🎫", financiacion: "🗺️", cnmc: "⚡", renta2025: "📊", ibi: "🏠",
  modelo303: "📑", autonomos: "💼",
};

export const FISCAL_DEADLINES = [
  { date: "2026-04-20", modelo: "303", desc: "IVA 1T 2026", profiles: ["autonomo", "empresa"] },
  { date: "2026-04-20", modelo: "111", desc: "Retenciones 1T 2026", profiles: ["autonomo", "empresa"] },
  { date: "2026-04-20", modelo: "130", desc: "Pago fraccionado IRPF 1T 2026", profiles: ["autonomo"] },
  { date: "2026-06-25", modelo: "100", desc: "Renta 2025 — último día domiciliación", profiles: ["autonomo", "particular"] },
  { date: "2026-06-30", modelo: "100", desc: "Renta 2025 — fin campaña", profiles: ["autonomo", "particular"] },
  { date: "2026-07-20", modelo: "303", desc: "IVA 2T 2026", profiles: ["autonomo", "empresa"] },
  { date: "2026-07-20", modelo: "111", desc: "Retenciones 2T 2026", profiles: ["autonomo", "empresa"] },
  { date: "2026-07-20", modelo: "130", desc: "Pago fraccionado IRPF 2T 2026", profiles: ["autonomo"] },
  { date: "2026-07-25", modelo: "200", desc: "Impuesto de Sociedades 2025", profiles: ["empresa"] },
  { date: "2026-10-20", modelo: "303", desc: "IVA 3T 2026", profiles: ["autonomo", "empresa"] },
  { date: "2026-10-20", modelo: "111", desc: "Retenciones 3T 2026", profiles: ["autonomo", "empresa"] },
  { date: "2026-10-20", modelo: "130", desc: "Pago fraccionado IRPF 3T 2026", profiles: ["autonomo"] },
  { date: "2026-12-20", modelo: "202", desc: "Pago fraccionado Sociedades 3P", profiles: ["empresa"] },
];

export const FAQ_ITEMS = [
  { q: "¿Cómo presento la declaración de la renta?", a: "Puede usar nuestro simulador de Renta 2025 o hablar con nuestro agente especializado.", tags: "renta irpf declaracion" },
  { q: "¿Cuándo vence el plazo del IVA trimestral?", a: "El modelo 303 se presenta los primeros 20 días del mes siguiente al trimestre.", tags: "iva 303 plazo trimestral" },
  { q: "¿Cómo obtengo un certificado de estar al corriente?", a: "Puede solicitarlo a través de la sede electrónica de la AEAT o llamándonos.", tags: "certificado corriente aeat" },
  { q: "¿Qué es el modelo 130?", a: "Es la declaración trimestral de pago fraccionado del IRPF para autónomos.", tags: "modelo 130 autonomo pago fraccionado" },
  { q: "¿Cómo darme de alta como autónomo?", a: "Necesita el modelo 036/037 de alta censal y darse de alta en la Seguridad Social.", tags: "autonomo alta censal 036 037" },
];

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════

export default function App() {
  const [view, setView] = useState("home");
  const [services, setServices] = useState(FALLBACK_SERVICES);
  const [selectedService, setSelectedService] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [session, setSession] = useState(null);
  const [loginKey, setLoginKey] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(null);
  const [themeName, setThemeName] = useState(getStoredTheme());
  const [lang, setLang] = useState(getStoredLang());
  const [showSearch, setShowSearch] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(!localStorage.getItem("romainge-onboarded"));
  const [deferredInstall, setDeferredInstall] = useState(null);

  const th = themes[themeName] || themes.dark;
  const s = getStyles(th);

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setDeferredInstall(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Keyboard shortcut: Ctrl+K for search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setShowSearch(true); }
      if (e.key === "Escape") setShowSearch(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Load services
  useEffect(() => {
    fetchServices()
      .then(svcs => { setServices(svcs.map(s => ({ ...s, icon: ICONS_MAP[s.id] || "📋" }))); setBackendOnline(true); })
      .catch(() => setBackendOnline(false));
  }, []);

  const toggleTheme = () => {
    const next = themeName === "dark" ? "light" : "dark";
    setThemeName(next);
    setStoredTheme(next);
  };

  const changeLang = (code) => { setLang(code); setStoredLang(code); };

  const handleLogin = async () => {
    if (!loginKey || !loginPhone) return;
    setLoginLoading(true);
    setLoginError("");
    try {
      const sessionData = await loginSession(loginKey, loginPhone);
      if (sessionData.token) setAuthToken(sessionData.token);
      if (sessionData.refreshToken) setRefreshToken(sessionData.refreshToken);
      setSession(sessionData);
      setSelectedService(services.find(sv => sv.id === sessionData.serviceId));
      setView("session");
    } catch (err) {
      setLoginError(err.message || "Clave o teléfono incorrecto");
    }
    setLoginLoading(false);
  };

  const handleSearchSelect = (result) => {
    if (result.type === "service") {
      setSelectedService(result.item);
      setView("services");
    }
  };

  const installPwa = async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    setDeferredInstall(null);
  };

  const completeOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem("romainge-onboarded", "1");
  };

  const navItems = [
    { key: "home", label: t("home", lang), icon: "🏠" },
    { key: "services", label: t("services", lang), icon: "📋" },
    { key: "calendario", label: "📅", icon: "" },
    { key: "session-login", label: t("mySession", lang), icon: "🔑" },
    { key: "renta", label: t("renta", lang), icon: "🧮" },
    { key: "admin", label: "Admin", icon: "🛡️" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: th.bg, color: th.text, position: "relative" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 20px ${th.accentBg}; } 50% { box-shadow: 0 0 40px ${th.accentBg}; } }
        @keyframes typingDot { 0%,100% { opacity: 0.3; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-4px); } }
        input::placeholder { color: ${th.textTertiary}; }
        ::-webkit-scrollbar-thumb { background: ${th.scrollThumb}; }
        body { background: ${th.bg}; }
      `}</style>

      {showOnboarding && <Onboarding onComplete={completeOnboarding} th={th} lang={lang} />}
      {showSearch && <GlobalSearch services={services} onSelect={handleSearchSelect} onClose={() => setShowSearch(false)} th={th} lang={lang} />}

      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", background: th.radialGradient }} />

      <Header
        th={th} lang={lang} setLang={setLang} themeName={themeName} setThemeName={(name) => { setThemeName(name); setStoredTheme(name); }}
        view={view} setView={setView} setShowSearch={setShowSearch} backendOnline={backendOnline}
        navItems={navItems} deferredInstall={deferredInstall} installPwa={installPwa} changeLang={changeLang}
      />

      {/* CONTENT */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", position: "relative", zIndex: 1 }}>

        {/* HOME / LANDING */}
        {view === "home" && (
          <div style={{ animation: "fadeIn 0.6s ease" }}>
            <div style={{ textAlign: "center", padding: "60px 0 48px" }}>
              <div style={{ display: "inline-block", padding: "6px 16px", borderRadius: 20,
                background: th.accentBg, border: `1px solid ${th.accentBorder}`,
                fontFamily: "'DM Sans'", fontSize: 12, color: th.accent, marginBottom: 24 }}>
                {t("heroTag", lang)}
              </div>
              <h1 style={{ fontFamily: "'Playfair Display'", fontSize: "clamp(36px, 5vw, 60px)",
                fontWeight: 700, lineHeight: 1.1, marginBottom: 20,
                background: `linear-gradient(135deg, ${th.text} 30%, ${th.accent} 100%)`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", whiteSpace: "pre-line" }}>
                {t("heroTitle", lang)}
              </h1>
              <p style={{ fontFamily: "'DM Sans'", fontSize: 17, color: th.textSecondary,
                maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.7 }}>
                {typeof t("heroDesc", lang) === "function" ? t("heroDesc", lang)(services.length) : `${services.length} agentes IA especializados.`}
              </p>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <button onClick={() => setView("session-login")} style={{
                  ...s.primaryBtn, fontSize: 15, padding: "16px 32px",
                  background: th.accentGradient, color: th.bg, fontWeight: 600, animation: "glow 3s infinite",
                }}>{t("accessSession", lang)}</button>
                <button onClick={() => setView("services")} style={{
                  ...s.primaryBtn, fontSize: 15, padding: "16px 32px", background: th.bgTertiary, color: th.text,
                }}>{t("viewServices", lang)}</button>
                <button onClick={() => setView("renta")} style={{
                  ...s.primaryBtn, fontSize: 15, padding: "16px 32px", background: th.bgTertiary, color: th.text,
                }}>{t("renta", lang)}</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 48 }}>
              {[["36+", t("agents", lang)], ["24/7", t("availability", lang)], ["∞", t("simultaneousCalls", lang)], ["< 3s", t("aiResponse", lang)]].map(([val, label]) => (
                <div key={label} style={{ textAlign: "center", padding: "28px 16px", background: th.bgSecondary, borderRadius: 16, border: `1px solid ${th.border}` }}>
                  <div style={{ fontFamily: "'Playfair Display'", fontSize: 32, fontWeight: 700, color: th.accent }}>{val}</div>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: th.textSecondary, marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* SEO content section */}
            <div style={{ maxWidth: 800, margin: "0 auto 48px", padding: "32px 0" }}>
              <h2 style={{ ...s.sectionTitle, textAlign: "center", marginBottom: 24 }}>{t("featuredServices", lang)}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {services.slice(0, 8).map(svc => (
                  <ServiceCard key={svc.id} service={svc} onClick={sv => { setSelectedService(sv); setView("services"); }} th={th} />
                ))}
              </div>
              <div style={{ textAlign: "center", marginTop: 20 }}>
                <button onClick={() => setView("services")} style={{ ...s.primaryBtn, background: th.bgTertiary, color: th.textSecondary }}>
                  {typeof t("viewAllServices", lang) === "function" ? t("viewAllServices", lang)(services.length) : `Ver los ${services.length} servicios →`}
                </button>
              </div>
            </div>

            {/* SEO: How it works */}
            <div style={{ background: th.bgSecondary, borderRadius: 24, padding: "40px 32px", border: `1px solid ${th.border}`, marginBottom: 48 }}>
              <h2 style={{ ...s.sectionTitle, textAlign: "center", marginBottom: 32 }}>¿Cómo funciona?</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24 }}>
                {[
                  { icon: "📞", title: "1. Llama al 900", desc: "Nuestro agente IA atiende tu llamada y clasifica tu consulta fiscal en segundos." },
                  { icon: "🔑", title: "2. Recibe tu clave", desc: "Al finalizar, recibes una palabra clave única para acceder a tu sesión web privada." },
                  { icon: "💬", title: "3. Chatea online", desc: "Continúa la conversación con tu agente especializado, sube documentos y descarga informes." },
                  { icon: "✅", title: "4. Resuelve tu trámite", desc: "Completa tu gestión fiscal con asesoramiento IA disponible 24/7, sin esperas." },
                ].map((item, i) => (
                  <div key={i} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>{item.icon}</div>
                    <div style={{ fontFamily: "'DM Sans'", fontWeight: 600, fontSize: 15, color: th.text, marginBottom: 8 }}>{item.title}</div>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: th.textSecondary, lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SERVICES */}
        {view === "services" && (
          <ServiceList
            th={th} services={services} searchTerm={searchTerm} setSearchTerm={setSearchTerm}
            selectedService={selectedService} setSelectedService={setSelectedService}
            setView={setView} setSession={setSession} lang={lang}
          />
        )}

        {/* CALENDAR */}
        {view === "calendario" && <FiscalCalendar th={th} lang={lang} />}

        {/* SESSION LOGIN */}
        {view === "session-login" && (
          <div style={{ maxWidth: 440, margin: "0 auto", animation: "fadeIn 0.5s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", margin: "0 auto 16px",
                background: th.accentBg, border: `1px solid ${th.accentBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🔑</div>
              <h2 style={s.sectionTitle}>{t("accessMySession", lang)}</h2>
              <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: th.textTertiary, marginTop: 8 }}>
                {t("loginInstructions", lang)}
              </p>
            </div>
            <div style={{ background: th.bgSecondary, borderRadius: 20, padding: "28px", border: `1px solid ${th.border}` }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <FormRow label={t("sessionKey", lang)} value={loginKey} onChange={v => { setLoginKey(v); setLoginError(""); }} placeholder="ej: aurora" styles={s} />
                <FormRow label={t("phoneNumber", lang)} value={loginPhone} onChange={v => { setLoginPhone(v); setLoginError(""); }} placeholder="+34 6XX XXX XXX" styles={s} />
              </div>
              {loginError && (
                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: th.errorBg, border: `1px solid ${th.errorBorder}`, fontFamily: "'DM Sans'", fontSize: 12, color: th.error }}>
                  {loginError}
                </div>
              )}
              <button onClick={handleLogin} disabled={!loginKey || !loginPhone || loginLoading} style={{
                ...s.primaryBtn, width: "100%", marginTop: 20, padding: "16px",
                background: loginKey && loginPhone && !loginLoading ? th.accentGradient : th.bgTertiary,
                color: loginKey && loginPhone ? th.bg : th.textTertiary, fontWeight: 600, fontSize: 15,
              }}>
                {loginLoading ? t("verifying", lang) : t("accessBtn", lang)}
              </button>
            </div>
            <div style={{ marginTop: 20, padding: "16px 20px", borderRadius: 12, background: th.errorBg, border: `1px solid ${th.errorBorder}` }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: th.error, lineHeight: 1.6, opacity: 0.8 }}>
                🔒 <strong>Seguridad:</strong> {t("securityNote", lang)}
              </div>
            </div>
          </div>
        )}

        {/* SESSION CHAT */}
        {view === "session" && session && selectedService && (
          <div style={{ animation: "fadeIn 0.5s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <button onClick={() => { setView("home"); setSession(null); }} style={s.backBtn}>← {t("exit", lang)}</button>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'DM Sans'", fontWeight: 600, fontSize: 16, color: th.text }}>
                  {ICONS_MAP[selectedService.id]} {session.agentName || selectedService.agent}
                </div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: th.accent, opacity: 0.7 }}>
                  {t("secureSession", lang)} · {session.callerName}
                </div>
              </div>
              <button onClick={() => exportSessionPdf(session.sessionId)} style={{ ...s.primaryBtn, background: th.bgTertiary, color: th.textSecondary, fontSize: 12, padding: "8px 16px" }}>PDF</button>
              {selectedService.id === "renta2025" && (
                <button onClick={() => setView("renta")} style={{ ...s.primaryBtn, background: th.accentGradient, color: th.bg, fontSize: 12, padding: "8px 16px" }}>{t("simulator", lang)}</button>
              )}
            </div>
            <div style={{ background: th.bgSecondary, borderRadius: 20, border: `1px solid ${th.border}`,
              height: "calc(100vh - 220px)", padding: "0 20px 20px", display: "flex", flexDirection: "column" }}>
              <SessionChat session={session} service={selectedService} th={th} lang={lang} />
            </div>
          </div>
        )}

        {/* RENTA SIMULATOR */}
        {view === "renta" && (
          <RentaSimulator
            session={session || { callerName: "Contribuyente", callerLastName: "" }}
            onBack={() => setView(session ? "session" : "home")}
            th={th} lang={lang}
          />
        )}

        {/* ADMIN DASHBOARD */}
        {view === "admin" && (
          <AdminDashboard th={th} onBack={() => setView("home")} />
        )}
      </main>

      <footer style={{ borderTop: `1px solid ${th.border}`, padding: "32px 24px", marginTop: 40, textAlign: "center" }}>
        <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: th.textTertiary, lineHeight: 2 }}>
          © 2025 RomainGE — romainge.com · {t("footer", lang)}<br />
          <span style={{ fontSize: 10, color: th.textMuted }}>{t("disclaimer", lang)}</span>
        </div>
      </footer>
    </div>
  );
}
