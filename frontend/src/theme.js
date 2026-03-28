// ═══════════════════════════════════════════════════════════════
// theme.js — Dark/Light theme system
// ═══════════════════════════════════════════════════════════════

export const themes = {
  dark: {
    bg: "#0a0f14",
    bgSecondary: "rgba(255,255,255,0.03)",
    bgTertiary: "rgba(255,255,255,0.05)",
    bgHover: "rgba(255,255,255,0.08)",
    text: "#e8e6e3",
    textSecondary: "rgba(232,230,227,0.5)",
    textTertiary: "rgba(232,230,227,0.3)",
    textMuted: "rgba(232,230,227,0.15)",
    border: "rgba(255,255,255,0.06)",
    borderHover: "rgba(0,206,201,0.4)",
    accent: "#00cec9",
    accentBg: "rgba(0,206,201,0.15)",
    accentBorder: "rgba(0,206,201,0.2)",
    accentGradient: "linear-gradient(135deg, #00b894, #00cec9)",
    success: "#00b894",
    error: "#d63031",
    errorBg: "rgba(214,48,49,0.1)",
    errorBorder: "rgba(214,48,49,0.2)",
    warning: "#ff9800",
    purple: "#6c5ce7",
    purpleBg: "rgba(108,92,231,0.08)",
    headerBg: "rgba(10,15,20,0.85)",
    headerBorder: "rgba(255,255,255,0.04)",
    inputBg: "rgba(255,255,255,0.04)",
    inputBorder: "rgba(255,255,255,0.08)",
    chatUser: "rgba(0,206,201,0.15)",
    chatUserBorder: "rgba(0,206,201,0.2)",
    chatAgent: "rgba(255,255,255,0.05)",
    chatAgentBorder: "rgba(255,255,255,0.06)",
    scrollThumb: "rgba(0,206,201,0.2)",
    radialGradient: "radial-gradient(ellipse at 20% 0%, rgba(0,206,201,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(0,184,148,0.04) 0%, transparent 50%)",
    checkBg: "transparent",
    checkBorder: "rgba(255,255,255,0.15)",
  },
  light: {
    bg: "#f5f7fa",
    bgSecondary: "rgba(0,0,0,0.02)",
    bgTertiary: "rgba(0,0,0,0.04)",
    bgHover: "rgba(0,0,0,0.06)",
    text: "#1a1a2e",
    textSecondary: "rgba(26,26,46,0.55)",
    textTertiary: "rgba(26,26,46,0.35)",
    textMuted: "rgba(26,26,46,0.15)",
    border: "rgba(0,0,0,0.08)",
    borderHover: "rgba(0,128,128,0.5)",
    accent: "#008080",
    accentBg: "rgba(0,128,128,0.1)",
    accentBorder: "rgba(0,128,128,0.2)",
    accentGradient: "linear-gradient(135deg, #00796b, #008080)",
    success: "#00796b",
    error: "#c0392b",
    errorBg: "rgba(192,57,43,0.08)",
    errorBorder: "rgba(192,57,43,0.15)",
    warning: "#e65100",
    purple: "#5e35b1",
    purpleBg: "rgba(94,53,177,0.06)",
    headerBg: "rgba(245,247,250,0.92)",
    headerBorder: "rgba(0,0,0,0.06)",
    inputBg: "rgba(0,0,0,0.03)",
    inputBorder: "rgba(0,0,0,0.1)",
    chatUser: "rgba(0,128,128,0.1)",
    chatUserBorder: "rgba(0,128,128,0.15)",
    chatAgent: "rgba(0,0,0,0.03)",
    chatAgentBorder: "rgba(0,0,0,0.06)",
    scrollThumb: "rgba(0,128,128,0.2)",
    radialGradient: "radial-gradient(ellipse at 20% 0%, rgba(0,128,128,0.04) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(0,121,107,0.03) 0%, transparent 50%)",
    checkBg: "#ffffff",
    checkBorder: "rgba(0,0,0,0.2)",
  },
};

export function getStoredTheme() {
  return localStorage.getItem("romainge-theme") || "dark";
}

export function setStoredTheme(theme) {
  localStorage.setItem("romainge-theme", theme);
}

/**
 * Apply theme to document root so CSS custom properties switch automatically.
 * Sets data-theme attribute on <html> — :root matches dark (default),
 * [data-theme="light"] overrides for light theme.
 * @param {"dark"|"light"} themeName
 */
export function applyTheme(themeName) {
  const name = themeName === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = name;
  setStoredTheme(name);
}
