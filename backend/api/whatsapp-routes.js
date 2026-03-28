// ═══════════════════════════════════════════════════════════════
// api/whatsapp-routes.js — WhatsApp webhook & stats endpoints
// ═══════════════════════════════════════════════════════════════

import { Router } from "express";
import twilio from "twilio";
import { handleIncomingWhatsApp, getWhatsAppStats } from "../lib/whatsapp.js";

const router = Router();

// ─── Twilio WhatsApp webhook (signature validation) ──────────
router.post(
  "/webhook",
  twilio.webhook({ validate: process.env.NODE_ENV === "production" }),
  handleIncomingWhatsApp
);

// ─── Stats endpoint (API_SECRET protected) ───────────────────
router.get("/stats", (req, res) => {
  const secret = req.headers["x-api-secret"] || req.query.secret;
  if (secret !== process.env.API_SECRET) {
    return res.status(401).json({ error: "API secret requerido" });
  }
  res.json(getWhatsAppStats());
});

export default router;
