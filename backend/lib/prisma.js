// ═══════════════════════════════════════════════════════════════
// lib/prisma.js — Prisma client singleton
// ═══════════════════════════════════════════════════════════════

import { PrismaClient } from "./generated/prisma/client.js";

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  datasourceUrl: process.env.DATABASE_URL,
});

export default prisma;
