// ═══════════════════════════════════════════════════════════════
// lib/documents.js — Store de documentos para sesiones
// ═══════════════════════════════════════════════════════════════
// Los agentes o usuarios pueden adjuntar PDFs u otros archivos.
// Almacenamiento local (dev) o S3 (prod).

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import prisma from "./prisma.js";

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB) || 10; // MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
];

// ─── Ensure upload directory exists ─────────────────────────
async function ensureUploadDir(subDir = "") {
  const dir = path.join(UPLOAD_DIR, subDir);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

// ─── Upload document ────────────────────────────────────────
export async function uploadDocument({
  sessionId,
  filename,
  mimeType,
  buffer,
  uploadedBy,
  tenantId,
}) {
  // Validate
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new Error(`Tipo de archivo no permitido: ${mimeType}`);
  }

  if (buffer.length > MAX_FILE_SIZE * 1024 * 1024) {
    throw new Error(`Archivo demasiado grande. Máximo: ${MAX_FILE_SIZE}MB`);
  }

  // Generate safe storage path
  const ext = path.extname(filename) || ".bin";
  const safeName = `${crypto.randomBytes(16).toString("hex")}${ext}`;
  const subDir = sessionId.slice(0, 8);

  if (process.env.S3_BUCKET) {
    // S3 upload
    const s3Key = `documents/${subDir}/${safeName}`;
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({ region: process.env.AWS_REGION || "eu-west-1" });
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key,
      Body: buffer,
      ContentType: mimeType,
    }));

    return prisma.document.create({
      data: {
        sessionId,
        filename,
        mimeType,
        size: buffer.length,
        storagePath: s3Key,
        storageType: "s3",
        uploadedBy,
        tenantId: tenantId || null,
      },
    });
  }

  // Local storage
  const dir = await ensureUploadDir(subDir);
  const filePath = path.join(dir, safeName);
  await fs.writeFile(filePath, buffer);

  return prisma.document.create({
    data: {
      sessionId,
      filename,
      mimeType,
      size: buffer.length,
      storagePath: path.join(subDir, safeName),
      storageType: "local",
      uploadedBy,
      tenantId: tenantId || null,
    },
  });
}

// ─── Get document metadata ──────────────────────────────────
export async function getDocument(documentId) {
  return prisma.document.findUnique({ where: { id: documentId } });
}

// ─── Get document content ───────────────────────────────────
export async function getDocumentContent(documentId) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return null;

  if (doc.storageType === "s3") {
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({ region: process.env.AWS_REGION || "eu-west-1" });
    const result = await s3.send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: doc.storagePath,
    }));
    const chunks = [];
    for await (const chunk of result.Body) chunks.push(chunk);
    return { doc, buffer: Buffer.concat(chunks) };
  }

  // Local
  const filePath = path.join(UPLOAD_DIR, doc.storagePath);
  const buffer = await fs.readFile(filePath);
  return { doc, buffer };
}

// ─── List documents for session ─────────────────────────────
export async function listDocuments(sessionId) {
  return prisma.document.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      size: true,
      uploadedBy: true,
      createdAt: true,
    },
  });
}

// ─── Delete document ────────────────────────────────────────
export async function deleteDocument(documentId) {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return false;

  // Delete physical file
  if (doc.storageType === "local") {
    const filePath = path.join(UPLOAD_DIR, doc.storagePath);
    await fs.unlink(filePath).catch(() => {});
  } else if (doc.storageType === "s3") {
    const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({ region: process.env.AWS_REGION || "eu-west-1" });
    await s3.send(new DeleteObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: doc.storagePath,
    })).catch(() => {});
  }

  await prisma.document.delete({ where: { id: documentId } });
  return true;
}
