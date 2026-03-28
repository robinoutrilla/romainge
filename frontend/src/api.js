// ═══════════════════════════════════════════════════════════════
// src/api.js — Cliente API para comunicación con el backend
// ═══════════════════════════════════════════════════════════════

const API_BASE = import.meta.env.VITE_API_URL || "";

// ─── JWT Token storage ───────────────────────────────────────
let authToken = null;
let refreshToken = null;
let isRefreshing = false;
let refreshQueue = [];

export function setAuthToken(token) {
  authToken = token;
}

export function setRefreshToken(token) {
  refreshToken = token;
}

export function getAuthToken() {
  return authToken;
}

export function getRefreshToken() {
  return refreshToken;
}

export function clearTokens() {
  authToken = null;
  refreshToken = null;
}

// ─── Token refresh logic ─────────────────────────────────────
async function doRefresh() {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/api/sessions/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    authToken = data.accessToken;
    refreshToken = data.refreshToken;
    return true;
  } catch {
    return false;
  }
}

// ─── Fetch wrapper with auto-refresh ─────────────────────────
async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  let res = await fetch(url, { headers, ...options });

  // Auto-refresh on 401 with TOKEN_EXPIRED code
  if (res.status === 401 && refreshToken) {
    const body = await res.json().catch(() => ({}));
    if (body.code === "TOKEN_EXPIRED" || body.code === "INACTIVE") {
      if (!isRefreshing) {
        isRefreshing = true;
        const success = await doRefresh();
        isRefreshing = false;
        refreshQueue.forEach(cb => cb(success));
        refreshQueue = [];
        if (success) {
          headers["Authorization"] = `Bearer ${authToken}`;
          res = await fetch(url, { headers, ...options });
        } else {
          clearTokens();
          throw new Error("Sesión expirada. Inicie sesión de nuevo.");
        }
      } else {
        // Wait for ongoing refresh
        const success = await new Promise(resolve => refreshQueue.push(resolve));
        if (success) {
          headers["Authorization"] = `Bearer ${authToken}`;
          res = await fetch(url, { headers, ...options });
        } else {
          throw new Error("Sesión expirada. Inicie sesión de nuevo.");
        }
      }
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Services ───────────────────────────────────────────────
export async function fetchServices() {
  const data = await request("/api/services");
  return data.services;
}

export async function fetchService(id) {
  return request(`/api/services/${id}`);
}

// ─── Sessions ───────────────────────────────────────────────
export async function loginSession(key, phone) {
  return request("/api/sessions/login", {
    method: "POST",
    body: JSON.stringify({ key, phone }),
  });
}

export async function fetchMessages(sessionId) {
  const data = await request(`/api/sessions/${sessionId}/messages`);
  return data.messages;
}

export async function sendMessage(sessionId, message) {
  return request(`/api/sessions/${sessionId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

// ─── Streaming chat via SSE ─────────────────────────────────
export function streamMessage(sessionId, message, onChunk, onDone, onError) {
  let url = `${API_BASE}/api/sessions/${sessionId}/chat-stream?message=${encodeURIComponent(message)}`;
  if (authToken) url += `&token=${encodeURIComponent(authToken)}`;
  const evtSource = new EventSource(url);

  evtSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "chunk") onChunk(data.text);
      if (data.type === "done") { onDone(data.text); evtSource.close(); }
      if (data.type === "error") { onError(data.message); evtSource.close(); }
    } catch (e) {
      console.error("SSE parse error:", e);
    }
  };

  evtSource.onerror = () => {
    onError("Error de conexión");
    evtSource.close();
  };

  return () => evtSource.close();
}

// ─── WebSocket chat ─────────────────────────────────────────
export class ChatSocket {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.ws = null;
    this.handlers = { chunk: null, done: null, error: null, typing: null };
  }

  connect() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = API_BASE ? new URL(API_BASE).host : window.location.host;
    this.ws = new WebSocket(`${protocol}//${host}/ws`);

    this.ws.onopen = () => {
      this.ws.send(JSON.stringify({ type: "auth", sessionId: this.sessionId, token: authToken }));
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "chunk" && this.handlers.chunk) this.handlers.chunk(data.text);
        if (data.type === "done" && this.handlers.done) this.handlers.done(data.text);
        if (data.type === "typing" && this.handlers.typing) this.handlers.typing(data.active);
        if (data.type === "error" && this.handlers.error) this.handlers.error(data.message);
      } catch (e) {
        console.error("WS parse error:", e);
      }
    };

    this.ws.onerror = () => {
      if (this.handlers.error) this.handlers.error("Error de conexión WebSocket");
    };

    return this;
  }

  send(text) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "chat", text }));
    }
  }

  on(event, handler) {
    this.handlers[event] = handler;
    return this;
  }

  close() {
    this.ws?.close();
  }
}

// ─── Renta Simulator ───────────────────────────────────────
export async function simulateRenta(data) {
  return request("/api/renta/simulate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function simulateRentaAI(data) {
  return request("/api/renta/simulate-ai", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function compararDeclaraciones(declarante, conyuge) {
  return request("/api/renta/comparar", {
    method: "POST",
    body: JSON.stringify({ declarante, conyuge }),
  });
}

export function downloadBorradorPdf(data) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = `${API_BASE}/api/renta/borrador-pdf`;
  form.target = "_blank";
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "data";
  input.value = JSON.stringify(data);
  form.appendChild(input);
  // Use fetch + blob instead for proper JSON body
  fetch(`${API_BASE}/api/renta/borrador-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
    .then(r => r.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    })
    .catch(err => console.error("Error descargando borrador:", err));
}

// ─── Export PDF ──────────────────────────────────────────────
export function exportSessionPdf(sessionId) {
  let url = `${API_BASE}/api/sessions/${sessionId}/export-pdf`;
  if (authToken) url += `?token=${encodeURIComponent(authToken)}`;
  window.open(url, "_blank");
}

// ─── Session management ──────────────────────────────────────
export async function logoutSession(sessionId) {
  try {
    await request(`/api/sessions/${sessionId}/logout`, { method: "POST" });
  } finally {
    clearTokens();
  }
}

// ─── Health ─────────────────────────────────────────────────
export async function checkHealth() {
  return request("/api/health");
}
