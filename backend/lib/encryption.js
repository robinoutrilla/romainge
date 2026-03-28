// ══════���══════���══════════════════════════════��══════════════════
// lib/encryption.js — AES-256-GCM encryption for session messages
// ══════���════════════════════��═══════════════════════════════════

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;   // 96 bits recommended for GCM
const TAG_LENGTH = 16;  // 128 bits auth tag
const ENCODING = "base64";

function getKey() {
  const raw = process.env.SESSION_ENCRYPTION_KEY;
  if (!raw) return null;
  // Derive a 32-byte key from whatever string the user provides
  return crypto.createHash("sha256").update(raw).digest();
}

export function encrypt(plaintext) {
  const key = getKey();
  if (!key) return plaintext; // No encryption key configured

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  let encrypted = cipher.update(plaintext, "utf8", ENCODING);
  encrypted += cipher.final(ENCODING);
  const tag = cipher.getAuthTag();

  // Format: iv:tag:ciphertext (all base64)
  return `enc:${iv.toString(ENCODING)}:${tag.toString(ENCODING)}:${encrypted}`;
}

export function decrypt(ciphertext) {
  const key = getKey();
  if (!key) return ciphertext;

  // Check if this is actually encrypted
  if (!ciphertext.startsWith("enc:")) return ciphertext;

  const parts = ciphertext.slice(4).split(":");
  if (parts.length !== 3) return ciphertext;

  const [ivB64, tagB64, encrypted] = parts;
  const iv = Buffer.from(ivB64, ENCODING);
  const tag = Buffer.from(tagB64, ENCODING);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, ENCODING, "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export function isEncryptionEnabled() {
  return !!getKey();
}
