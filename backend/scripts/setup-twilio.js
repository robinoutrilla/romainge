#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// scripts/setup-twilio.js — Configuración automática de Twilio
// ═══════════════════════════════════════════════════════════════
// Uso: node scripts/setup-twilio.js
// Requiere: TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en .env

import "dotenv/config";
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const BASE_URL = process.env.BASE_URL || "https://romainge.com";

async function setup() {
  console.log("\n🏛️  RomainGE — Configuración Twilio\n");
  console.log("═".repeat(50));

  // ─── 1. Verificar cuenta ────────────────────────────────
  try {
    const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    console.log(`\n✅ Cuenta: ${account.friendlyName}`);
    console.log(`   Status: ${account.status}`);
  } catch (err) {
    console.error("❌ Error de autenticación. Verifica TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN");
    process.exit(1);
  }

  // ─── 2. Listar números disponibles en España ────────────
  console.log("\n📞 Buscando números españoles disponibles...\n");

  // Opción A: Número 900 (gratuito) — más caro pero profesional
  try {
    const tollFree = await client.availablePhoneNumbers("ES")
      .tollFree
      .list({ limit: 5 });

    if (tollFree.length > 0) {
      console.log("   Números gratuitos (900) disponibles:");
      tollFree.forEach(n => {
        console.log(`   📱 ${n.phoneNumber} — ${n.friendlyName}`);
      });
    } else {
      console.log("   ⚠️  No hay números 900 disponibles. Alternativas:");
    }
  } catch {
    console.log("   ⚠️  Números 900 no disponibles en este momento.");
  }

  // Opción B: Número local — mucho más barato
  try {
    const local = await client.availablePhoneNumbers("ES")
      .local
      .list({ limit: 5 });

    if (local.length > 0) {
      console.log("\n   Números locales (más económicos):");
      local.forEach(n => {
        console.log(`   📱 ${n.phoneNumber} — ${n.friendlyName}`);
      });
    }
  } catch {
    console.log("   ⚠️  No hay números locales disponibles.");
  }

  // ─── 3. Configurar número existente ─────────────────────
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  if (phoneNumber) {
    console.log(`\n🔧 Configurando número ${phoneNumber}...`);

    try {
      // Buscar el SID del número
      const numbers = await client.incomingPhoneNumbers.list({
        phoneNumber: phoneNumber,
      });

      if (numbers.length === 0) {
        console.log("   ⚠️  Número no encontrado en tu cuenta. Cómpralo primero:");
        console.log(`   → twilio phone-numbers:buy:local --country-code ES`);
        console.log(`   → O desde: https://console.twilio.com/us1/develop/phone-numbers`);
      } else {
        const num = numbers[0];

        // Configurar webhooks
        await client.incomingPhoneNumbers(num.sid).update({
          voiceUrl: `${BASE_URL}/api/voice/incoming`,
          voiceMethod: "POST",
          statusCallback: `${BASE_URL}/api/voice/status`,
          statusCallbackMethod: "POST",
          statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
          friendlyName: "RomainGE - Central Fiscal IA",
        });

        console.log("   ✅ Webhooks configurados:");
        console.log(`      Voice URL: ${BASE_URL}/api/voice/incoming`);
        console.log(`      Status:    ${BASE_URL}/api/voice/status`);
      }
    } catch (err) {
      console.error(`   ❌ Error configurando número: ${err.message}`);
    }
  }

  // ─── 4. Configurar TwiML App (para escalabilidad) ──────
  console.log("\n🔧 Creando TwiML Application...");
  try {
    const app = await client.applications.create({
      friendlyName: "RomainGE Voice App",
      voiceUrl: `${BASE_URL}/api/voice/incoming`,
      voiceMethod: "POST",
      statusCallback: `${BASE_URL}/api/voice/status`,
    });
    console.log(`   ✅ TwiML App creada: ${app.sid}`);
  } catch (err) {
    console.log(`   ⚠️  ${err.message}`);
  }

  // ─── Resumen ───────────────────────────────────────────
  console.log("\n" + "═".repeat(50));
  console.log("\n📋 PRÓXIMOS PASOS:");
  console.log("   1. Si no tienes número, cómpralo desde la consola Twilio");
  console.log("   2. Verifica que BASE_URL apunta a tu dominio desplegado");
  console.log("   3. Configura las variables de entorno en Vercel");
  console.log("   4. Haz una llamada de prueba al número");
  console.log("\n💰 COSTES ESTIMADOS (Twilio España):");
  console.log("   Número local:    ~1€/mes");
  console.log("   Número 900:      ~15-30€/mes");
  console.log("   Llamada entrante: ~0.005€/min");
  console.log("   STT (voz→texto):  ~0.02€/15s");
  console.log("   TTS (texto→voz):  ~0.004€/100 chars");
  console.log("\n   Para miles de llamadas simultáneas:");
  console.log("   → Twilio escala automáticamente");
  console.log("   → CPS (Calls Per Second) por defecto: 1-100");
  console.log("   → Solicitar aumento de CPS a Twilio si necesitas más");
  console.log("   → Coste Claude API: ~0.003€ por respuesta (Sonnet)");
  console.log("");
}

setup().catch(console.error);
