// ═══════════════════════════════════════════════════════════════
// lib/email-alerts.js — Email alerts for queue and system events
// ═══════════════════════════════════════════════════════════════

import nodemailer from "nodemailer";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: (process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

const ALERT_RECIPIENTS = () =>
  (process.env.ALERT_EMAILS || "admin@romainge.com").split(",").map(e => e.trim());

// Cooldown: don't send same alert type more than once per 15 min
const alertCooldowns = new Map();
const COOLDOWN_MS = 15 * 60 * 1000;

function canSendAlert(type) {
  const last = alertCooldowns.get(type);
  if (last && Date.now() - last < COOLDOWN_MS) return false;
  alertCooldowns.set(type, Date.now());
  return true;
}

export async function sendQueueAlert(queueSize) {
  if (!canSendAlert("queue_overflow")) return;
  const mail = getTransporter();
  if (!mail) {
    console.warn(`[ALERT] Cola excede límite: ${queueSize} llamadas (email no configurado)`);
    return;
  }

  await mail.sendMail({
    from: process.env.SMTP_FROM || "alertas@romainge.com",
    to: ALERT_RECIPIENTS().join(", "),
    subject: `⚠️ RomainGE — Cola de llamadas alta: ${queueSize} en espera`,
    html: `
      <h2>Alerta de Cola de Llamadas</h2>
      <p>La cola de llamadas ha alcanzado <strong>${queueSize}</strong> llamadas en espera.</p>
      <p>Umbral configurado: ${process.env.QUEUE_ALERT_THRESHOLD || 50}</p>
      <p>Hora: ${new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}</p>
      <p>Accede al <a href="${process.env.FRONTEND_URL || "https://romainge.com"}/admin">panel de administración</a> para más detalles.</p>
    `,
  });
  console.log(`[ALERT] Email enviado: cola ${queueSize} llamadas`);
}

export async function sendLatencyAlert(avgMs, threshold) {
  if (!canSendAlert("high_latency")) return;
  const mail = getTransporter();
  if (!mail) {
    console.warn(`[ALERT] Latencia alta: ${avgMs}ms (email no configurado)`);
    return;
  }

  await mail.sendMail({
    from: process.env.SMTP_FROM || "alertas@romainge.com",
    to: ALERT_RECIPIENTS().join(", "),
    subject: `⚠️ RomainGE — Latencia Claude API alta: ${avgMs}ms`,
    html: `
      <h2>Alerta de Latencia</h2>
      <p>La latencia media de Claude API es <strong>${avgMs}ms</strong> (umbral: ${threshold}ms).</p>
      <p>Hora: ${new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}</p>
    `,
  });
}

export async function sendCostAlert(dailyCost, threshold) {
  if (!canSendAlert("high_cost")) return;
  const mail = getTransporter();
  if (!mail) {
    console.warn(`[ALERT] Coste diario alto: €${dailyCost} (email no configurado)`);
    return;
  }

  await mail.sendMail({
    from: process.env.SMTP_FROM || "alertas@romainge.com",
    to: ALERT_RECIPIENTS().join(", "),
    subject: `⚠️ RomainGE — Coste diario elevado: €${dailyCost.toFixed(2)}`,
    html: `
      <h2>Alerta de Costes</h2>
      <p>El coste estimado del día actual es <strong>€${dailyCost.toFixed(2)}</strong> (umbral: €${threshold}).</p>
      <p>Hora: ${new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}</p>
    `,
  });
}
