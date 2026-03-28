import React, { useState, useEffect } from "react";
import { ServiceCard } from "./ServiceList.jsx";

// ═══════════════════════════════════════════════════════════════
// LandingPage.jsx — Premium landing page for RomainGE
// ═══════════════════════════════════════════════════════════════

function AnimatedCounter({ end, suffix = "", duration = 2000 }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (typeof end !== "number") return;
    let start = 0;
    const step = Math.max(1, Math.floor(end / (duration / 30)));
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(start);
    }, 30);
    return () => clearInterval(timer);
  }, [end, duration]);
  return <>{typeof end === "number" ? count : end}{suffix}</>;
}

function FeatureCard({ icon, title, desc, th, delay }) {
  return (
    <div style={{
      background: th.bgSecondary, borderRadius: 20, padding: "32px 24px",
      border: `1px solid ${th.border}`, transition: "all 0.3s",
      animation: `fadeIn 0.6s ease ${delay}s both`,
      cursor: "default",
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = th.accentBorder; e.currentTarget.style.transform = "translateY(-4px)"; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = th.border; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{
        width: 56, height: 56, borderRadius: 16, background: th.accentBg,
        border: `1px solid ${th.accentBorder}`, display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: 28, marginBottom: 20,
      }}>{icon}</div>
      <h3 style={{ fontFamily: "'DM Sans'", fontWeight: 600, fontSize: 17, color: th.text, marginBottom: 10, margin: "0 0 10px" }}>{title}</h3>
      <p style={{ fontFamily: "'DM Sans'", fontSize: 13.5, color: th.textSecondary, lineHeight: 1.7, margin: 0 }}>{desc}</p>
    </div>
  );
}

function TestimonialCard({ quote, name, role, th, delay }) {
  return (
    <div style={{
      background: th.bgSecondary, borderRadius: 16, padding: "24px",
      border: `1px solid ${th.border}`, animation: `fadeIn 0.6s ease ${delay}s both`,
    }}>
      <div style={{ fontSize: 32, color: th.accent, opacity: 0.3, fontFamily: "serif", lineHeight: 1, marginBottom: 8 }}>"</div>
      <p style={{ fontFamily: "'DM Sans'", fontSize: 14, color: th.textSecondary, lineHeight: 1.7, margin: "0 0 16px", fontStyle: "italic" }}>{quote}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", background: th.accentBg,
          border: `1px solid ${th.accentBorder}`, display: "flex", alignItems: "center",
          justifyContent: "center", fontFamily: "'DM Sans'", fontWeight: 600, fontSize: 14, color: th.accent,
        }}>{name[0]}</div>
        <div>
          <div style={{ fontFamily: "'DM Sans'", fontWeight: 600, fontSize: 13, color: th.text }}>{name}</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: th.textTertiary }}>{role}</div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage({ th, lang, t, services, setView, setSelectedService }) {
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActiveFeature(p => (p + 1) % 4), 5000);
    return () => clearInterval(timer);
  }, []);

  const stats = [
    { value: 36, suffix: "+", label: "Agentes IA especializados" },
    { value: "24/7", label: "Disponibilidad total" },
    { value: "<3", suffix: "s", label: "Tiempo de respuesta" },
    { value: "100", suffix: "%", label: "Seguro y privado" },
  ];

  const features = [
    { icon: "🤖", title: "IA Fiscal Especializada", desc: "36 agentes entrenados en legislacion tributaria espanola. Cada agente domina su area: IRPF, IVA, Aduanas, Sociedades, Autonomos y mas." },
    { icon: "📞", title: "Central Telefonica IA", desc: "Llama al 900 y resuelve tu consulta por voz. Reconocimiento de voz en espanol, catalan, euskera y gallego." },
    { icon: "🔒", title: "Seguridad Bancaria", desc: "Cifrado AES-256, autenticacion JWT, sesiones efimeras y CSRF protection. Tus datos fiscales protegidos como en un banco." },
    { icon: "📊", title: "Simulador de Renta", desc: "Calcula tu IRPF al instante con deducciones por comunidad autonoma, situacion familiar y tipo de rendimientos." },
    { icon: "📅", title: "Calendario Fiscal", desc: "Nunca pierdas un plazo. Alertas automaticas para tus obligaciones tributarias con la AEAT." },
    { icon: "📱", title: "WhatsApp + Web + Voz", desc: "Accede desde cualquier canal: WhatsApp, la web, o por telefono. Tu sesion se mantiene sincronizada." },
  ];

  const howItWorks = [
    { step: "01", icon: "📞", title: "Llama al 900", desc: "Nuestro agente IA atiende tu llamada, identifica tu consulta y te conecta con el especialista adecuado.", color: th.accent },
    { step: "02", icon: "🔑", title: "Recibe tu clave", desc: "Al finalizar, recibes una palabra clave unica (ej: 'aurora') para acceder a tu sesion web privada.", color: "#6c5ce7" },
    { step: "03", icon: "💬", title: "Continua online", desc: "Accede a romainge.com con tu clave y telefono. Chatea, sube documentos, descarga informes.", color: "#00b894" },
    { step: "04", icon: "✅", title: "Resuelve tu tramite", desc: "Completa tu gestion fiscal con asesoramiento IA disponible 24/7, sin esperas ni citas previas.", color: "#fdcb6e" },
  ];

  const testimonials = [
    { quote: "Resolvi mi declaracion de la Renta en 15 minutos. El agente me guio paso a paso y no tuve que esperar nada.", name: "Maria Garcia", role: "Autonoma, Madrid" },
    { quote: "Como asesoria fiscal, RomainGE nos ha permitido automatizar las consultas basicas y centrarnos en casos complejos.", name: "Carlos Lopez", role: "Asesor Fiscal, Barcelona" },
    { quote: "La central telefonica es increible. Llame por un tema de aduanas y me resolvieron todo sin tener que ir a Hacienda.", name: "Ana Martinez", role: "Importadora, Valencia" },
  ];

  return (
    <div style={{ animation: "fadeIn 0.6s ease" }}>

      {/* ─── HERO ─────────────────────────────────────────── */}
      <section style={{ textAlign: "center", padding: "80px 0 60px", position: "relative" }}>
        <div style={{
          position: "absolute", top: "10%", left: "50%", transform: "translateX(-50%)",
          width: 600, height: 600, borderRadius: "50%",
          background: `radial-gradient(circle, ${th.accentBg} 0%, transparent 70%)`,
          pointerEvents: "none", opacity: 0.5,
        }} />

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "8px 20px", borderRadius: 24,
          background: th.accentBg, border: `1px solid ${th.accentBorder}`,
          marginBottom: 32, animation: "fadeIn 0.6s ease 0.1s both",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: th.accent, animation: "pulse 2s infinite" }} />
          <span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: th.accent, fontWeight: 500 }}>
            Plataforma de Gestion Fiscal con IA
          </span>
        </div>

        <h1 style={{
          fontFamily: "'Playfair Display'", fontSize: "clamp(40px, 6vw, 72px)",
          fontWeight: 800, lineHeight: 1.05, marginBottom: 24,
          background: `linear-gradient(135deg, ${th.text} 0%, ${th.accent} 100%)`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          animation: "fadeIn 0.6s ease 0.2s both", position: "relative",
        }}>
          Tu asesor fiscal<br />inteligente, 24/7
        </h1>

        <p style={{
          fontFamily: "'DM Sans'", fontSize: 18, color: th.textSecondary,
          maxWidth: 620, margin: "0 auto 40px", lineHeight: 1.7,
          animation: "fadeIn 0.6s ease 0.3s both",
        }}>
          {services.length} agentes IA especializados en cada tramite de la AEAT y CNMC.
          Llama, pregunta, y resuelve tus gestiones tributarias sin esperas.
        </p>

        <div style={{
          display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap",
          animation: "fadeIn 0.6s ease 0.4s both",
        }}>
          <button onClick={() => setView("session-login")} style={{
            padding: "18px 40px", borderRadius: 14, border: "none",
            background: th.accentGradient, color: th.bg,
            fontFamily: "'DM Sans'", fontSize: 16, fontWeight: 600,
            cursor: "pointer", transition: "all 0.3s",
            boxShadow: `0 4px 24px rgba(0,206,201,0.3)`,
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >
            Acceder a mi sesion
          </button>
          <button onClick={() => setView("services")} style={{
            padding: "18px 40px", borderRadius: 14,
            border: `1px solid ${th.border}`, background: th.bgSecondary,
            color: th.text, fontFamily: "'DM Sans'", fontSize: 16, fontWeight: 500,
            cursor: "pointer", transition: "all 0.3s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = th.accentBorder; e.currentTarget.style.background = th.bgTertiary; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = th.border; e.currentTarget.style.background = th.bgSecondary; }}
          >
            Ver servicios
          </button>
          <button onClick={() => setView("renta")} style={{
            padding: "18px 40px", borderRadius: 14,
            border: `1px solid ${th.border}`, background: th.bgSecondary,
            color: th.text, fontFamily: "'DM Sans'", fontSize: 16, fontWeight: 500,
            cursor: "pointer", transition: "all 0.3s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = th.accentBorder; e.currentTarget.style.background = th.bgTertiary; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = th.border; e.currentTarget.style.background = th.bgSecondary; }}
          >
            Simulador Renta 2025
          </button>
        </div>
      </section>

      {/* ─── STATS BAR ────────────────────────────────────── */}
      <section style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 16, marginBottom: 80,
      }}>
        {stats.map((stat, i) => (
          <div key={i} style={{
            textAlign: "center", padding: "32px 20px",
            background: th.bgSecondary, borderRadius: 20,
            border: `1px solid ${th.border}`,
            animation: `fadeIn 0.5s ease ${0.1 * i}s both`,
          }}>
            <div style={{
              fontFamily: "'Playfair Display'", fontSize: 40, fontWeight: 800,
              color: th.accent, lineHeight: 1,
            }}>
              {typeof stat.value === "number" ? <AnimatedCounter end={stat.value} suffix={stat.suffix} /> : <>{stat.value}<span style={{ fontSize: 24 }}>{stat.suffix}</span></>}
            </div>
            <div style={{
              fontFamily: "'DM Sans'", fontSize: 13, color: th.textSecondary,
              marginTop: 8, letterSpacing: 0.3,
            }}>{stat.label}</div>
          </div>
        ))}
      </section>

      {/* ─── FEATURES ─────────────────────────────────────── */}
      <section style={{ marginBottom: 80 }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            fontFamily: "'DM Sans'", fontSize: 13, color: th.accent,
            textTransform: "uppercase", letterSpacing: 2, fontWeight: 600, marginBottom: 12,
          }}>Funcionalidades</div>
          <h2 style={{
            fontFamily: "'Playfair Display'", fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 700, color: th.text, margin: 0,
          }}>Todo lo que necesitas</h2>
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 20,
        }}>
          {features.map((f, i) => (
            <FeatureCard key={i} icon={f.icon} title={f.title} desc={f.desc} th={th} delay={0.1 * i} />
          ))}
        </div>
      </section>

      {/* ─── HOW IT WORKS ─────────────────────────────────── */}
      <section style={{
        marginBottom: 80, background: th.bgSecondary, borderRadius: 32,
        padding: "60px 40px", border: `1px solid ${th.border}`,
      }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{
            fontFamily: "'DM Sans'", fontSize: 13, color: th.accent,
            textTransform: "uppercase", letterSpacing: 2, fontWeight: 600, marginBottom: 12,
          }}>Proceso</div>
          <h2 style={{
            fontFamily: "'Playfair Display'", fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 700, color: th.text, margin: 0,
          }}>Como funciona</h2>
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 32, position: "relative",
        }}>
          {howItWorks.map((item, i) => (
            <div key={i} style={{ textAlign: "center", animation: `fadeIn 0.6s ease ${0.15 * i}s both` }}>
              <div style={{
                width: 72, height: 72, borderRadius: 20, margin: "0 auto 20px",
                background: `${item.color}15`, border: `1px solid ${item.color}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 36, position: "relative",
              }}>
                {item.icon}
                <div style={{
                  position: "absolute", top: -8, right: -8, width: 28, height: 28,
                  borderRadius: 8, background: item.color, color: th.bg,
                  fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{item.step}</div>
              </div>
              <h3 style={{
                fontFamily: "'DM Sans'", fontWeight: 600, fontSize: 18,
                color: th.text, marginBottom: 10, margin: "0 0 10px",
              }}>{item.title}</h3>
              <p style={{
                fontFamily: "'DM Sans'", fontSize: 13.5, color: th.textSecondary,
                lineHeight: 1.7, margin: 0,
              }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FEATURED SERVICES ────────────────────────────── */}
      <section style={{ marginBottom: 80 }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            fontFamily: "'DM Sans'", fontSize: 13, color: th.accent,
            textTransform: "uppercase", letterSpacing: 2, fontWeight: 600, marginBottom: 12,
          }}>Servicios</div>
          <h2 style={{
            fontFamily: "'Playfair Display'", fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 700, color: th.text, margin: 0,
          }}>Agentes especializados</h2>
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 14,
        }}>
          {services.slice(0, 9).map(svc => (
            <ServiceCard key={svc.id} service={svc} onClick={sv => { setSelectedService(sv); setView("services"); }} th={th} />
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <button onClick={() => setView("services")} style={{
            padding: "14px 32px", borderRadius: 12,
            border: `1px solid ${th.border}`, background: th.bgSecondary,
            color: th.textSecondary, fontFamily: "'DM Sans'", fontSize: 14,
            fontWeight: 500, cursor: "pointer", transition: "all 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = th.accent; e.currentTarget.style.color = th.accent; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = th.border; e.currentTarget.style.color = th.textSecondary; }}
          >
            Ver los {services.length} servicios →
          </button>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─────────────────────────────────── */}
      <section style={{ marginBottom: 80 }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            fontFamily: "'DM Sans'", fontSize: 13, color: th.accent,
            textTransform: "uppercase", letterSpacing: 2, fontWeight: 600, marginBottom: 12,
          }}>Testimonios</div>
          <h2 style={{
            fontFamily: "'Playfair Display'", fontSize: "clamp(28px, 4vw, 44px)",
            fontWeight: 700, color: th.text, margin: 0,
          }}>Lo que dicen nuestros usuarios</h2>
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
        }}>
          {testimonials.map((t, i) => (
            <TestimonialCard key={i} {...t} th={th} delay={0.1 * i} />
          ))}
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────── */}
      <section style={{
        textAlign: "center", padding: "64px 32px", borderRadius: 32,
        background: th.accentGradient, marginBottom: 40, position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -100, right: -100, width: 300, height: 300,
          borderRadius: "50%", background: "rgba(255,255,255,0.08)",
        }} />
        <div style={{
          position: "absolute", bottom: -60, left: -60, width: 200, height: 200,
          borderRadius: "50%", background: "rgba(255,255,255,0.05)",
        }} />
        <h2 style={{
          fontFamily: "'Playfair Display'", fontSize: "clamp(24px, 4vw, 40px)",
          fontWeight: 700, color: "#0a0f14", marginBottom: 16, position: "relative",
        }}>
          Resuelve tu consulta fiscal ahora
        </h2>
        <p style={{
          fontFamily: "'DM Sans'", fontSize: 16, color: "rgba(10,15,20,0.7)",
          maxWidth: 480, margin: "0 auto 32px", lineHeight: 1.6, position: "relative",
        }}>
          Sin esperas, sin citas previas. Nuestros agentes IA estan listos para ayudarte con cualquier tramite tributario.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", position: "relative" }}>
          <button onClick={() => setView("session-login")} style={{
            padding: "16px 36px", borderRadius: 12, border: "none",
            background: "#0a0f14", color: "#00cec9",
            fontFamily: "'DM Sans'", fontSize: 15, fontWeight: 600,
            cursor: "pointer", transition: "all 0.2s",
          }}>
            Acceder a mi sesion
          </button>
          <button onClick={() => setView("admin")} style={{
            padding: "16px 36px", borderRadius: 12,
            border: "2px solid rgba(10,15,20,0.3)", background: "transparent",
            color: "#0a0f14", fontFamily: "'DM Sans'", fontSize: 15, fontWeight: 600,
            cursor: "pointer", transition: "all 0.2s",
          }}>
            Panel de administracion
          </button>
        </div>
      </section>
    </div>
  );
}
