// ═══════════════════════════════════════════════════════════════
// widget.js — Embeddable chat widget loader
// ═══════════════════════════════════════════════════════════════
// Usage: <script src="https://romainge.com/widget.js" data-api="https://api.romainge.com"></script>

(function () {
  const script = document.currentScript;
  const api = script?.getAttribute("data-api") || "https://api.romainge.com";
  const position = script?.getAttribute("data-position") || "right";

  // Create container
  const container = document.createElement("div");
  container.id = "romainge-widget";
  document.body.appendChild(container);

  // State
  let open = false;
  let messages = [{ role: "agent", text: "¡Hola! Soy el asistente fiscal de RomainGE. ¿En qué puedo ayudarle?" }];
  let sessionId = null;
  let token = null;
  let loading = false;

  function render() {
    const pos = position === "left" ? "left:20px" : "right:20px";
    container.innerHTML = !open
      ? `<button id="rg-toggle" style="position:fixed;bottom:20px;${pos};z-index:10000;width:56px;height:56px;border-radius:50%;border:none;background:linear-gradient(135deg,#00b894,#00cec9);color:#0a0f14;font-size:24px;cursor:pointer;box-shadow:0 4px 20px rgba(0,206,201,0.3);display:flex;align-items:center;justify-content:center">💬</button>`
      : `<div style="position:fixed;bottom:20px;${pos};z-index:10000;width:360px;height:520px;border-radius:16px;background:#0a0f14;border:1px solid rgba(0,206,201,0.2);display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:-apple-system,sans-serif">
          <div style="padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;border-radius:16px 16px 0 0;background:linear-gradient(135deg,rgba(0,184,148,0.15),rgba(0,206,201,0.08))">
            <div><div style="font-weight:600;font-size:14px;color:#e8e6e3">RomainGE</div><div style="font-size:10px;color:rgba(0,206,201,0.7)">Asistente Fiscal IA</div></div>
            <button id="rg-close" style="background:none;border:none;color:rgba(232,230,227,0.4);font-size:20px;cursor:pointer">×</button>
          </div>
          <div style="flex:1;overflow-y:auto;padding:12px" id="rg-messages">
            ${messages.map((m) => `<div style="display:flex;justify-content:${m.role === "user" ? "flex-end" : "flex-start"};margin-bottom:8px"><div style="max-width:80%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.5;color:#e8e6e3;background:${m.role === "user" ? "rgba(0,206,201,0.15)" : "rgba(255,255,255,0.05)"};border:1px solid ${m.role === "user" ? "rgba(0,206,201,0.2)" : "rgba(255,255,255,0.06)"}">${m.text}</div></div>`).join("")}
            ${loading ? '<div style="display:flex;gap:4px;padding:8px"><div style="width:6px;height:6px;border-radius:50%;background:rgba(0,206,201,0.5);animation:wdot 1.2s ease-in-out infinite"></div><div style="width:6px;height:6px;border-radius:50%;background:rgba(0,206,201,0.5);animation:wdot 1.2s ease-in-out 0.2s infinite"></div><div style="width:6px;height:6px;border-radius:50%;background:rgba(0,206,201,0.5);animation:wdot 1.2s ease-in-out 0.4s infinite"></div></div>' : ""}
          </div>
          <div style="padding:8px 12px;border-top:1px solid rgba(255,255,255,0.06)">
            ${!sessionId
              ? `<div style="display:flex;flex-direction:column;gap:6px">
                  <input id="rg-key" placeholder="Clave de sesión" style="width:100%;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#e8e6e3;font-size:13px;outline:none" />
                  <input id="rg-phone" placeholder="Teléfono +34..." style="width:100%;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#e8e6e3;font-size:13px;outline:none" />
                  <button id="rg-login" style="padding:8px;border-radius:8px;border:none;background:rgba(0,206,201,0.15);color:#00cec9;font-size:13px;cursor:pointer">Acceder</button>
                </div>`
              : `<div style="display:flex;gap:6px">
                  <input id="rg-input" placeholder="Escriba su consulta..." style="flex:1;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#e8e6e3;font-size:13px;outline:none" />
                  <button id="rg-send" style="padding:8px 14px;border-radius:8px;border:none;background:rgba(0,206,201,0.15);color:#00cec9;font-size:13px;cursor:pointer">→</button>
                </div>`}
          </div>
        </div>
        <style>@keyframes wdot{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}</style>`;

    // Bind events
    document.getElementById("rg-toggle")?.addEventListener("click", () => { open = true; render(); });
    document.getElementById("rg-close")?.addEventListener("click", () => { open = false; render(); });
    document.getElementById("rg-login")?.addEventListener("click", doLogin);
    document.getElementById("rg-send")?.addEventListener("click", doSend);
    document.getElementById("rg-input")?.addEventListener("keydown", (e) => { if (e.key === "Enter") doSend(); });
    document.getElementById("rg-phone")?.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });

    // Scroll to bottom
    const msgEl = document.getElementById("rg-messages");
    if (msgEl) msgEl.scrollTop = msgEl.scrollHeight;
  }

  async function doLogin() {
    const key = document.getElementById("rg-key")?.value;
    const phone = document.getElementById("rg-phone")?.value;
    if (!key || !phone) return;
    loading = true; render();
    try {
      const res = await fetch(`${api}/api/sessions/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, phone }),
      });
      const data = await res.json();
      if (data.sessionId) {
        sessionId = data.sessionId; token = data.token;
        messages = [{ role: "agent", text: `¡Hola ${data.callerName}! ¿En qué puedo ayudarle?` }];
      } else {
        messages.push({ role: "agent", text: "Clave o teléfono incorrecto." });
      }
    } catch { messages.push({ role: "agent", text: "Error de conexión." }); }
    loading = false; render();
  }

  async function doSend() {
    const input = document.getElementById("rg-input");
    const text = input?.value?.trim();
    if (!text) return;
    input.value = "";
    messages.push({ role: "user", text }); loading = true; render();
    try {
      const res = await fetch(`${api}/api/sessions/${sessionId}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      messages.push({ role: "agent", text: data.response || "Error" });
    } catch { messages.push({ role: "agent", text: "Error de conexión." }); }
    loading = false; render();
  }

  render();
})();
