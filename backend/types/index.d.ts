// ═══════════════════════════════════════════════════════════════
// types/index.d.ts — Type definitions for RomainGE backend
// ═══════════════════════════════════════════════════════════════
// Usage: reference these types via JSDoc annotations in .js files
// e.g. /** @type {import('../types/index.d.ts').Session} */

// ─── Sessions ─────────────────────────────────────────────────

export interface Session {
  id: string;
  key: string;
  callerName: string;
  callerLastName: string;
  callerPhone: string;
  serviceId: string;
  messages: Message[];
  active: boolean;
  keyUsed: boolean;
  createdAt: string;
  expiresAt: string;
  tenantId?: string;
  deletedAt?: string | null;
  retentionUntil?: string | null;
}

export interface Message {
  id: string;
  sessionId?: string;
  role: "user" | "agent" | "system";
  text: string;
  textPlain?: string;
  metadata: Record<string, unknown>;
  timestamp?: string;
  createdAt?: string;
}

export interface CreateSessionInput {
  callerName: string;
  callerLastName?: string;
  callerPhone: string;
  serviceId: string;
}

export interface CreateSessionResult {
  sessionId: string;
  key: string;
  session: Session;
}

// ─── Services ─────────────────────────────────────────────────

export interface Service {
  id: string;
  digit: string;
  name: string;
  shortName: string;
  agent: string;
  keywords: string[];
  icon?: string;
}

// ─── Caller Info ──────────────────────────────────────────────

export interface CallerInfo {
  name: string;
  lastName?: string;
  phone: string;
}

// ─── Chat / Agent Engine ──────────────────────────────────────

export interface ChatResponse {
  response: string;
  supervised?: boolean;
  review?: SupervisorReview;
}

export interface SupervisorReview {
  approved: boolean;
  confidence: number;
  issues: SupervisorIssue[];
  correctedResponse: string | null;
}

export interface SupervisorIssue {
  type: "error" | "warning" | "info";
  description: string;
}

export type StreamChunkCallback = (chunk: string) => void;

// ─── Renta (IRPF) Simulation ─────────────────────────────────

export interface RentaInput {
  ingresos: number;
  retencion: number;
  ccaa?: string;
  estadoCivil?: "soltero" | "casado" | "viudo" | "divorciado";
  hijos?: number;
  hipoteca?: number;
  alquiler?: number;
  discapacidad?: number;
  donaciones?: number;
  planPensiones?: number;
  ingresosAhorro?: number;
  gananciasPatrimoniales?: number;
}

export interface RentaDeduccion {
  concepto: string;
  casilla: string;
  importe: number;
}

export interface RentaDeduccionAutonomica {
  concepto: string;
  importe: number;
  ccaa: string;
}

export interface RentaCasillaRelevante {
  casilla: string;
  concepto: string;
  valor: number;
}

export interface RentaResult {
  baseImponibleGeneral: number;
  baseImponibleAhorro: number;
  reduccionesPersonales: number;
  cuotaIntegra: number;
  deducciones: RentaDeduccion[];
  deduccionesAutonomicas: RentaDeduccionAutonomica[];
  cuotaLiquida: number;
  retencionesIngresos: number;
  cuotaDiferencial: number;
  resultado: "a_devolver" | "a_ingresar";
  importeResultado: number;
  recomendaciones: string[];
  casillasRelevantes: RentaCasillaRelevante[];
}

// ─── Call History ─────────────────────────────────────────────

export interface CallHistory {
  id: string;
  tenantId?: string | null;
  callSid?: string | null;
  callerPhone: string;
  serviceId: string;
  status: "completed" | "missed" | "transferred" | "queued";
  duration: number;
  language: string;
  nifProvided?: string | null;
  sessionId?: string | null;
  recordingUrl?: string | null;
  transferredTo?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ─── Tenant (Multi-tenant) ───────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: "basic" | "pro" | "enterprise";
  maxAgents: number;
  settings: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface TenantAgent {
  id: string;
  tenantId: string;
  serviceId: string;
  customName?: string | null;
  customPrompt?: string | null;
  enabled: boolean;
}

// ─── Documents ────────────────────────────────────────────────

export interface Document {
  id: string;
  tenantId?: string | null;
  sessionId: string;
  filename: string;
  mimeType: string;
  size: number;
  storagePath: string;
  storageType?: "local" | "s3";
  uploadedBy: "user" | "agent";
  createdAt: string;
}

// ─── Admin ────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: "superadmin" | "admin" | "viewer";
  passwordHash: string;
}

// ─── API Keys ─────────────────────────────────────────────────

export interface ApiKey {
  key: string;
  appName: string;
  contactEmail: string;
  permissions: string[];
  plan: "free" | "basic" | "pro" | "enterprise";
  active: boolean;
  createdAt: string;
}

// ─── Invoicing (Facturacion) ──────────────────────────────────

export interface InvoiceLine {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  tipoIVA: number;
  importe: number;
}

export interface InvoiceTotals {
  baseImponible: number;
  totalIVA: number;
  totalFactura: number;
}

export interface Invoice {
  id: string;
  emisor: string;
  receptor: string;
  serie: string;
  numero: string;
  fecha: string;
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  paymentMethod: string;
}

// ─── SII (Suministro Inmediato de Informacion) ───────────────

export interface SIIRecord {
  type: "emitida" | "recibida";
  invoiceData: Invoice;
  nifEmisor: string;
  period: string;
  status: "pending" | "accepted" | "rejected" | "error";
}

// ─── FAQ ──────────────────────────────────────────────────────

export interface FAQEntry {
  id: string;
  serviceId: string;
  question: string;
  answer: string;
  askCount: number;
}

// ─── Feature Flags ────────────────────────────────────────────

export type FeatureFlag =
  | boolean
  | number
  | { enabled: boolean; percentage?: number };

// ─── Session Stats ────────────────────────────────────────────

export interface SessionStats {
  activeSessions: number;
  oldestSession: string | null;
}
