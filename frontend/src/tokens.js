// ═══════════════════════════════════════════════════════════════
// tokens.js — CSS custom property references for inline styles
// Usage: import { tokens } from "./tokens.js";
//        style={{ background: tokens.bg, color: tokens.text }}
// ═══════════════════════════════════════════════════════════════

export const tokens = {
  // Background
  bg: "var(--color-bg)",
  bgSecondary: "var(--color-bg-secondary)",
  bgTertiary: "var(--color-bg-tertiary)",
  bgHover: "var(--color-bg-hover)",

  // Text
  text: "var(--color-text)",
  textSecondary: "var(--color-text-secondary)",
  textTertiary: "var(--color-text-tertiary)",
  textMuted: "var(--color-text-muted)",

  // Border
  border: "var(--color-border)",
  borderHover: "var(--color-border-hover)",

  // Accent
  accent: "var(--color-accent)",
  accentBg: "var(--color-accent-bg)",
  accentBorder: "var(--color-accent-border)",
  accentGradient: "var(--color-accent-gradient)",

  // Semantic
  success: "var(--color-success)",
  error: "var(--color-error)",
  errorBg: "var(--color-error-bg)",
  errorBorder: "var(--color-error-border)",
  warning: "var(--color-warning)",
  purple: "var(--color-purple)",
  purpleBg: "var(--color-purple-bg)",

  // Header
  headerBg: "var(--color-header-bg)",
  headerBorder: "var(--color-header-border)",

  // Input
  inputBg: "var(--color-input-bg)",
  inputBorder: "var(--color-input-border)",

  // Chat
  chatUser: "var(--color-chat-user)",
  chatUserBorder: "var(--color-chat-user-border)",
  chatAgent: "var(--color-chat-agent)",
  chatAgentBorder: "var(--color-chat-agent-border)",

  // Misc
  scrollThumb: "var(--color-scroll-thumb)",
  radialGradient: "var(--color-radial-gradient)",
  checkBg: "var(--color-check-bg)",
  checkBorder: "var(--color-check-border)",

  // Typography
  fontPrimary: "var(--font-primary)",
  fontDisplay: "var(--font-display)",

  // Spacing
  spaceXs: "var(--space-xs)",
  spaceSm: "var(--space-sm)",
  spaceMd: "var(--space-md)",
  spaceLg: "var(--space-lg)",
  spaceXl: "var(--space-xl)",

  // Border Radius
  radiusSm: "var(--radius-sm)",
  radiusMd: "var(--radius-md)",
  radiusLg: "var(--radius-lg)",
  radiusXl: "var(--radius-xl)",

  // Transitions
  transitionFast: "var(--transition-fast)",
  transitionNormal: "var(--transition-normal)",

  // Shadows
  shadowSm: "var(--shadow-sm)",
  shadowMd: "var(--shadow-md)",
  shadowLg: "var(--shadow-lg)",
  shadowCard: "var(--shadow-card)",
  shadowModal: "var(--shadow-modal)",
  shadowButton: "var(--shadow-button)",
  shadowGlow: "var(--shadow-glow)",
};
