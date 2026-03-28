// ═══════════════════════════════════════════════════════════════
// lib/admin-auth.js — Admin authentication (separate from session JWT)
// ═══════════════════════════════════════════════════════════════

import jwt from "jsonwebtoken";
import crypto from "crypto";

const ADMIN_SECRET = () => process.env.ADMIN_JWT_SECRET || process.env.API_SECRET || "dev-admin-secret";
const TOKEN_EXPIRY = "8h";

// In-memory admin users (production: move to DB)
const ADMIN_USERS = new Map();

// Seed default admin from env
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD_HASH) {
  ADMIN_USERS.set(process.env.ADMIN_EMAIL, {
    id: "admin-1",
    email: process.env.ADMIN_EMAIL,
    name: process.env.ADMIN_NAME || "Admin",
    role: "superadmin",
    passwordHash: process.env.ADMIN_PASSWORD_HASH,
  });
}

// Always have a fallback dev admin
if (ADMIN_USERS.size === 0 && process.env.NODE_ENV !== "production") {
  const devHash = hashPassword("admin123");
  ADMIN_USERS.set("admin@romainge.com", {
    id: "admin-dev",
    email: "admin@romainge.com",
    name: "Dev Admin",
    role: "superadmin",
    passwordHash: devHash,
  });
}

export function hashPassword(password) {
  return crypto.createHash("sha256").update(password + ADMIN_SECRET()).digest("hex");
}

export function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

export function authenticateAdmin(email, password) {
  const user = ADMIN_USERS.get(email);
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;

  const token = jwt.sign(
    { adminId: user.id, email: user.email, role: user.role },
    ADMIN_SECRET(),
    { expiresIn: TOKEN_EXPIRY }
  );

  return {
    token,
    admin: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

export function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de administrador requerido" });
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), ADMIN_SECRET());
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

export function getAdminUsers() {
  return Array.from(ADMIN_USERS.values()).map(({ passwordHash, ...u }) => u);
}

export function createAdminUser(email, name, password, role = "admin") {
  if (ADMIN_USERS.has(email)) throw new Error("Email ya existe");
  const id = `admin-${crypto.randomUUID().slice(0, 8)}`;
  ADMIN_USERS.set(email, {
    id, email, name, role,
    passwordHash: hashPassword(password),
  });
  return { id, email, name, role };
}
