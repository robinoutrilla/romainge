// ═══════════════════════════════════════════════════════════════
// sentry.js — Sentry error tracking (frontend React)
// ═══════════════════════════════════════════════════════════════

let Sentry = null;
let initialized = false;

/**
 * Initialize Sentry for frontend error tracking.
 * Only activates if VITE_SENTRY_DSN is set.
 */
export async function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.log("[Sentry] No VITE_SENTRY_DSN — error tracking disabled");
    return;
  }

  try {
    Sentry = await import("@sentry/react");

    Sentry.init({
      dsn,
      environment: import.meta.env.MODE || "development",
      release: `romainge-frontend@1.0.0`,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.0,
      replaysOnErrorSampleRate: 1.0,

      // Filter sensitive data
      beforeSend(event) {
        // Remove session tokens from URLs
        if (event.request?.url) {
          event.request.url = event.request.url.replace(
            /\/sessions\/[a-f0-9-]+/g,
            "/sessions/[REDACTED]"
          );
        }
        return event;
      },

      ignoreErrors: [
        "ResizeObserver loop",
        "Network request failed",
        "Load failed",
        "ChunkLoadError",
        "Loading chunk",
      ],
    });

    initialized = true;
    console.log("[Sentry] ✓ Frontend error tracking initialized");
  } catch (err) {
    console.warn("[Sentry] Failed to initialize:", err.message);
  }
}

/**
 * Capture a frontend error with context
 */
export function captureError(error, context = {}) {
  if (!initialized || !Sentry) {
    console.error("[Error]", error);
    return;
  }
  Sentry.captureException(error, { extra: context });
}

/**
 * React Error Boundary wrapper (lazy)
 */
export function getErrorBoundary() {
  if (!initialized || !Sentry) return null;
  return Sentry.ErrorBoundary;
}

/**
 * Set user context for Sentry
 */
export function setUser(user) {
  if (!initialized || !Sentry) return;
  Sentry.setUser(user);
}
