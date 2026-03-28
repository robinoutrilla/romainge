import React, { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════
// AdminLogin.jsx — Dedicated admin login page
// ═══════════════════════════════════════════════════════════════

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function AdminLogin({ onLogin, onBack, th }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);

  // Check for existing valid token
  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (token) {
      fetch(`${API_BASE}/api/admin/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => { if (r.ok) return r.json(); throw new Error(); })
        .then(data => onLogin(data.admin || data))
        .catch(() => localStorage.removeItem("adminToken"));
    }
  }, [onLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
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
        setError(data.error || "Credenciales incorrectas");
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } catch {
      setError("Error de conexion con el servidor");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: th.bg, position: "relative", overflow: "hidden",
    }}>
      {/* Background decoration */}
      <div style={{
        position: "absolute", top: "-20%", right: "-10%", width: 500, height: 500,
        borderRadius: "50%", background: `radial-gradient(circle, ${th.accentBg} 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-15%", left: "-5%", width: 400, height: 400,
        borderRadius: "50%", background: `radial-gradient(circle, rgba(108,92,231,0.06) 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <div style={{
        width: "100%", maxWidth: 420, padding: "40px 24px",
        animation: shake ? "shake 0.5s ease" : "fadeIn 0.5s ease",
        position: "relative", zIndex: 1,
      }}>
        {/* Back button */}
        <button onClick={onBack} style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", color: th.textSecondary,
          fontFamily: "'DM Sans'", fontSize: 13, cursor: "pointer",
          marginBottom: 32, padding: 0,
        }}
        onMouseEnter={e => e.currentTarget.style.color = th.accent}
        onMouseLeave={e => e.currentTarget.style.color = th.textSecondary}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Volver a la pagina principal
        </button>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, margin: "0 auto 20px",
            background: th.accentGradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Playfair Display'", fontWeight: 800, fontSize: 28, color: th.bg,
            boxShadow: `0 8px 32px rgba(0,206,201,0.2)`,
          }}>R</div>
          <h1 style={{
            fontFamily: "'Playfair Display'", fontSize: 28, fontWeight: 700,
            color: th.text, margin: "0 0 8px",
          }}>Panel de Administracion</h1>
          <p style={{
            fontFamily: "'DM Sans'", fontSize: 14, color: th.textSecondary, margin: 0,
          }}>RomainGE — Gestion Fiscal con IA</p>
        </div>

        {/* Login Form */}
        <div style={{
          background: th.bgSecondary, borderRadius: 24, padding: 32,
          border: `1px solid ${th.border}`,
          boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
        }}>
          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500,
                color: th.textSecondary, display: "block", marginBottom: 8,
              }}>Email</label>
              <div style={{ position: "relative" }}>
                <div style={{
                  position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                  color: th.textTertiary, fontSize: 16, pointerEvents: "none",
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                </div>
                <input
                  type="email" value={email}
                  onChange={e => { setEmail(e.target.value); setError(""); }}
                  placeholder="admin@romainge.com"
                  required autoFocus
                  style={{
                    width: "100%", padding: "14px 16px 14px 42px", borderRadius: 14,
                    background: th.inputBg, border: `1px solid ${error ? th.error + "40" : th.inputBorder}`,
                    color: th.text, fontFamily: "'DM Sans'", fontSize: 14,
                    outline: "none", transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={e => e.target.style.borderColor = th.accent + "60"}
                  onBlur={e => e.target.style.borderColor = error ? th.error + "40" : th.inputBorder}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label style={{
                fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500,
                color: th.textSecondary, display: "block", marginBottom: 8,
              }}>Contrasena</label>
              <div style={{ position: "relative" }}>
                <div style={{
                  position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                  color: th.textTertiary, fontSize: 16, pointerEvents: "none",
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"} value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  placeholder="Tu contrasena"
                  required
                  style={{
                    width: "100%", padding: "14px 48px 14px 42px", borderRadius: 14,
                    background: th.inputBg, border: `1px solid ${error ? th.error + "40" : th.inputBorder}`,
                    color: th.text, fontFamily: "'DM Sans'", fontSize: 14,
                    outline: "none", transition: "border-color 0.2s",
                    boxSizing: "border-box",
                  }}
                  onFocus={e => e.target.style.borderColor = th.accent + "60"}
                  onBlur={e => e.target.style.borderColor = error ? th.error + "40" : th.inputBorder}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", padding: 4,
                  color: th.textTertiary, fontSize: 16,
                }}>
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: "12px 16px", borderRadius: 12, marginBottom: 20,
                background: th.errorBg, border: `1px solid ${th.errorBorder}`,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={th.error} strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: th.error }}>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading || !email || !password} style={{
              width: "100%", padding: 16, borderRadius: 14, border: "none",
              background: email && password && !loading ? th.accentGradient : th.bgTertiary,
              color: email && password && !loading ? th.bg : th.textTertiary,
              fontFamily: "'DM Sans'", fontSize: 15, fontWeight: 600,
              cursor: email && password && !loading ? "pointer" : "default",
              transition: "all 0.3s",
              boxShadow: email && password ? `0 4px 20px rgba(0,206,201,0.2)` : "none",
            }}>
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${th.bg}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                  Verificando...
                </span>
              ) : "Acceder al panel"}
            </button>
          </form>
        </div>

        {/* Security note */}
        <div style={{
          marginTop: 24, padding: "14px 18px", borderRadius: 14,
          background: th.bgSecondary, border: `1px solid ${th.border}`,
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={th.accent} strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span style={{
            fontFamily: "'DM Sans'", fontSize: 12, color: th.textTertiary, lineHeight: 1.6,
          }}>
            Acceso restringido a administradores autorizados. Las sesiones se registran en el log de auditoria.
          </span>
        </div>
      </div>

      {/* Shake + spin animations */}
      <style>{`
        @keyframes shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-8px); } 40%,80% { transform: translateX(8px); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
