// ═══════════════════════════════════════════════════════════════
// lib/prisma.js — Prisma client singleton (graceful when no DB)
// ═══════════════════════════════════════════════════════════════

let prisma = null;

if (process.env.DATABASE_URL) {
  try {
    const { PrismaClient } = await import("./generated/prisma/client.js");
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      datasourceUrl: process.env.DATABASE_URL,
    });
  } catch (err) {
    console.warn("⚠️  Prisma client failed to initialize:", err.message);
    prisma = null;
  }
} else {
  console.log("📦 Database: No DATABASE_URL — Prisma disabled, using in-memory fallback");
}

export default prisma;
