// ═══════════════════════════════════════════════════════════════
// lib/sentry.js — Sentry error tracking (backend)
// ═══════════════════════════════════════════════════════════════

let Sentry = null;
let initialized = false;

/**
 * Initialize Sentry for backend error tracking.
 * Only activates if SENTRY_DSN_BACKEND env var is set.
 */
export async function initSentry(app) {
  const dsn = process.env.SENTRY_DSN_BACKEND;
  if (!dsn) {
    console.log("[SENTRY] No SENTRY_DSN_BACKEND configured — error tracking disabled");
    return;
  }

  try {
    Sentry = (await import("@sentry/node")).default || await import("@sentry/node");

    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || "development",
      release: `romainge-backend@${process.env.npm_package_version || "1.0.0"}`,
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || "0.1"),
      profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || "0.1"),

      // Filter sensitive data
      beforeSend(event) {
        // Remove PII from breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map((b) => {
            if (b.data?.url) {
              // Mask session IDs in URLs
              b.data.url = b.data.url.replace(
                /\/sessions\/[a-f0-9-]+/g,
                "/sessions/[REDACTED]"
              );
            }
            return b;
          });
        }
        // Remove sensitive headers
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        return event;
      },

      // Ignore expected errors
      ignoreErrors: [
        "Sesión no encontrada",
        "Token inválido",
        "Rate limit exceeded",
        "Sesión expirada",
      ],
    });

    // Express integration
    if (app && Sentry.setupExpressErrorHandler) {
      Sentry.setupExpressErrorHandler(app);
    }

    initialized = true;
    console.log("[SENTRY] ✓ Error tracking initialized");
  } catch (err) {
    console.warn("[SENTRY] Failed to initialize:", err.message);
  }
}

/**
 * Capture an exception with optional context
 */
export function captureException(error, context = {}) {
  if (!initialized || !Sentry) {
    console.error("[ERROR]", error.message, context);
    return;
  }

  Sentry.withScope((scope) => {
    if (context.user) scope.setUser(context.user);
    if (context.tags) {
      Object.entries(context.tags).forEach(([k, v]) => scope.setTag(k, v));
    }
    if (context.extra) {
      Object.entries(context.extra).forEach(([k, v]) => scope.setExtra(k, v));
    }
    if (context.level) scope.setLevel(context.level);
    Sentry.captureException(error);
  });
}

/**
 * Capture a message with severity level
 */
export function captureMessage(message, level = "info", context = {}) {
  if (!initialized || !Sentry) {
    console.log(`[${level.toUpperCase()}]`, message);
    return;
  }

  Sentry.withScope((scope) => {
    if (context.tags) {
      Object.entries(context.tags).forEach(([k, v]) => scope.setTag(k, v));
    }
    if (context.extra) {
      Object.entries(context.extra).forEach(([k, v]) => scope.setExtra(k, v));
    }
    Sentry.captureMessage(message, level);
  });
}

/**
 * Express error handler middleware for Sentry
 */
export function sentryErrorHandler() {
  return (err, req, res, next) => {
    captureException(err, {
      tags: {
        path: req.path,
        method: req.method,
      },
      extra: {
        query: req.query,
        ip: req.ip,
      },
    });
    next(err);
  };
}

/**
 * Get Sentry status
 */
export function getSentryStatus() {
  return {
    enabled: initialized,
    dsn: process.env.SENTRY_DSN_BACKEND ? "configured" : "not_configured",
  };
}
