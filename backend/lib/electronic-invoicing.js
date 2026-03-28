// ═══════════════════════════════════════════════════════════════
// lib/electronic-invoicing.js — Facturación electrónica
// Compatible con TicketBAI (País Vasco) y Verifactu (AEAT nacional)
// ═══════════════════════════════════════════════════════════════
import { createHash } from "crypto";

// ── Constantes fiscales ──────────────────────────────────────
const IVA_RATES = { general: 21, reducido: 10, superreducido: 4, exento: 0 };
const RECARGO_RATES = { general: 5.2, reducido: 1.4, superreducido: 0.5 };
const IRPF_RATES = { autonomos: 15, nuevos: 7, profesionales: 19 };
const VALID_OPERATION_TYPES = ["F1", "F2", "F3", "R1", "R2", "R3", "R4", "R5"];
const VALID_PAYMENT_METHODS = ["transferencia", "tarjeta", "efectivo", "domiciliacion", "otros"];
const TICKETBAI_TERRITORIES = ["araba", "bizkaia", "gipuzkoa"];

// ── Almacén en memoria ───────────────────────────────────────
const invoiceStore = new Map();
const invoiceCounters = new Map();
const chainStore = new Map();
let invoiceIdSeq = 1;

// ── Utilidades ───────────────────────────────────────────────
function roundTwo(n) { return Math.round(n * 100) / 100; }

function escapeXml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function detectTerritory(postalCode) {
  if (!postalCode) return null;
  const p = postalCode.substring(0, 2);
  if (p === "01") return "araba";
  if (p === "48") return "bizkaia";
  if (p === "20") return "gipuzkoa";
  return null;
}

function computeInvoiceHash(inv) {
  const payload = [inv.emisor.nif, inv.numero, inv.fecha, inv.totals.totalFactura.toFixed(2)].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

function getPreviousHash(nif) { return chainStore.get(nif) || "0".repeat(64); }

// ── Cálculos fiscales ────────────────────────────────────────
function calculateLineTotals(line) {
  const base = roundTwo(line.quantity * line.unitPrice * (1 - (line.discount || 0) / 100));
  const taxAmount = roundTwo(base * line.taxRate / 100);
  const total = line.taxType === "IRPF" ? roundTwo(base - taxAmount) : roundTwo(base + taxAmount);
  return { ...line, baseImponible: base, taxAmount, total };
}

function calculateTotals(lines) {
  let baseImponible = 0, totalIVA = 0, totalIRPF = 0, totalRecargo = 0;
  for (const l of lines) {
    baseImponible += l.baseImponible;
    if (l.taxType === "IVA") totalIVA += l.taxAmount;
    else if (l.taxType === "IRPF") totalIRPF += l.taxAmount;
    else if (l.taxType === "RE") totalRecargo += l.taxAmount;
  }
  return {
    baseImponible: roundTwo(baseImponible), totalIVA: roundTwo(totalIVA),
    totalIRPF: roundTwo(totalIRPF), totalRecargo: roundTwo(totalRecargo),
    totalFactura: roundTwo(baseImponible + totalIVA + totalRecargo - totalIRPF)
  };
}

// ── Numeración secuencial ────────────────────────────────────
export function getNextInvoiceNumber(serie, year) {
  const key = `${serie}-${year}`;
  const next = (invoiceCounters.get(key) || 0) + 1;
  invoiceCounters.set(key, next);
  return `${serie}-${year}-${String(next).padStart(6, "0")}`;
}

// ── Creación de factura ──────────────────────────────────────
export function createInvoice(data) {
  if (!data.emisor?.nif || !data.emisor?.name) throw new Error("Emisor: nif y name son obligatorios");
  if (!data.receptor?.nif || !data.receptor?.name) throw new Error("Receptor: nif y name son obligatorios");
  if (!data.lines || data.lines.length === 0) throw new Error("La factura debe tener al menos una línea");
  if (!VALID_OPERATION_TYPES.includes(data.operationType)) throw new Error(`Tipo de operación inválido: ${data.operationType}`);
  if (data.paymentMethod && !VALID_PAYMENT_METHODS.includes(data.paymentMethod)) throw new Error(`Método de pago inválido: ${data.paymentMethod}`);

  const year = new Date(data.fecha).getFullYear();
  const serie = data.serie || "A";
  const numero = data.numero || getNextInvoiceNumber(serie, year);
  const lines = data.lines.map(calculateLineTotals);
  const totals = calculateTotals(lines);

  const invoice = {
    id: `INV-${invoiceIdSeq++}`, emisor: data.emisor, receptor: data.receptor,
    serie, numero, fecha: data.fecha, operationType: data.operationType,
    lines, totals, paymentMethod: data.paymentMethod || "transferencia",
    createdAt: new Date().toISOString(), ticketbai: null, verifactu: null
  };

  if (!invoiceStore.has(data.emisor.nif)) invoiceStore.set(data.emisor.nif, []);
  invoiceStore.get(data.emisor.nif).push(invoice);
  return invoice;
}

// ── Consultas ────────────────────────────────────────────────
export function getInvoices(emisorNif) { return invoiceStore.get(emisorNif) || []; }

export function getInvoice(id) {
  for (const invoices of invoiceStore.values()) {
    const found = invoices.find(inv => inv.id === id);
    if (found) return found;
  }
  return null;
}

export function getInvoiceStats(emisorNif) {
  const invoices = getInvoices(emisorNif);
  if (invoices.length === 0) return { total: 0, totalBase: 0, totalIVA: 0, totalFacturado: 0, byType: {} };
  const byType = {};
  let totalBase = 0, totalIVA = 0, totalFacturado = 0;
  for (const inv of invoices) {
    byType[inv.operationType] = (byType[inv.operationType] || 0) + 1;
    totalBase += inv.totals.baseImponible;
    totalIVA += inv.totals.totalIVA;
    totalFacturado += inv.totals.totalFactura;
  }
  return { total: invoices.length, totalBase: roundTwo(totalBase), totalIVA: roundTwo(totalIVA), totalFacturado: roundTwo(totalFacturado), byType };
}

// ── TicketBAI (País Vasco) ───────────────────────────────────
export function validateTicketBAI(invoice) {
  const errors = [];
  if (!invoice.emisor?.nif) errors.push("Emisor NIF obligatorio");
  if (!invoice.emisor?.name) errors.push("Emisor nombre obligatorio");
  if (!invoice.emisor?.address) errors.push("Emisor dirección obligatoria");
  if (!invoice.emisor?.postalCode) errors.push("Emisor código postal obligatorio");
  if (!invoice.receptor?.nif) errors.push("Receptor NIF obligatorio");
  if (!invoice.receptor?.name) errors.push("Receptor nombre obligatorio");
  if (!invoice.numero) errors.push("Número de factura obligatorio");
  if (!invoice.fecha) errors.push("Fecha de factura obligatoria");
  if (!invoice.lines || invoice.lines.length === 0) errors.push("Debe haber al menos una línea");
  if (!invoice.totals) errors.push("Totales obligatorios");
  if (invoice.numero && !/^[A-Z]+-\d{4}-\d{6}$/.test(invoice.numero)) {
    errors.push("Formato de número inválido (esperado: SERIE-YYYY-NNNNNN)");
  }
  return { valid: errors.length === 0, errors };
}

export function generateTicketBAI(invoice) {
  const v = validateTicketBAI(invoice);
  if (!v.valid) throw new Error(`Validación TicketBAI fallida: ${v.errors.join(", ")}`);

  const hash = computeInvoiceHash(invoice);
  const prevHash = getPreviousHash(invoice.emisor.nif);
  const tbaiCode = `TBAI-${invoice.emisor.nif}-${invoice.fecha.replace(/-/g, "")}-${hash.substring(0, 13)}`;
  chainStore.set(invoice.emisor.nif, hash);
  invoice.ticketbai = { code: tbaiCode, hash, previousHash: prevHash };

  const linesXml = invoice.lines.map((l, i) =>
    `<DetalleFactura><NumeroLinea>${i + 1}</NumeroLinea>` +
    `<DescripcionDetalle>${escapeXml(l.description)}</DescripcionDetalle>` +
    `<Cantidad>${l.quantity}</Cantidad><ImporteUnitario>${l.unitPrice.toFixed(2)}</ImporteUnitario>` +
    (l.discount ? `<Descuento>${l.discount.toFixed(2)}</Descuento>` : "") +
    `<BaseImponible>${l.baseImponible.toFixed(2)}</BaseImponible>` +
    `<TipoImpositivo>${l.taxRate.toFixed(2)}</TipoImpositivo>` +
    `<CuotaImpuesto>${l.taxAmount.toFixed(2)}</CuotaImpuesto>` +
    `<ImporteTotal>${l.total.toFixed(2)}</ImporteTotal></DetalleFactura>`
  ).join("\n    ");

  const e = invoice.emisor, r = invoice.receptor;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<T:TicketBai xmlns:T="urn:ticketbai:emision">
  <Cabecera><IDVersionTBAI>1.2</IDVersionTBAI></Cabecera>
  <Sujetos>
    <Emisor>
      <NIF>${escapeXml(e.nif)}</NIF>
      <ApellidosNombreRazonSocial>${escapeXml(e.name)}</ApellidosNombreRazonSocial>
      <DireccionEmisor>${escapeXml(e.address)}</DireccionEmisor>
      <CodigoPostal>${escapeXml(e.postalCode)}</CodigoPostal>
      <Municipio>${escapeXml(e.city || "")}</Municipio>
    </Emisor>
    <Destinatarios><IDDestinatario>
      <NIF>${escapeXml(r.nif)}</NIF>
      <ApellidosNombreRazonSocial>${escapeXml(r.name)}</ApellidosNombreRazonSocial>
    </IDDestinatario></Destinatarios>
  </Sujetos>
  <Factura>
    <CabeceraFactura>
      <SerieFactura>${escapeXml(invoice.serie)}</SerieFactura>
      <NumFactura>${escapeXml(invoice.numero)}</NumFactura>
      <FechaExpedicionFactura>${invoice.fecha}</FechaExpedicionFactura>
      <TipoFactura>${invoice.operationType}</TipoFactura>
    </CabeceraFactura>
    <DatosFactura>
      <DesgloseTipoOperacion><ClaveRegimenIVA>01</ClaveRegimenIVA></DesgloseTipoOperacion>
      <ImporteTotalFactura>${invoice.totals.totalFactura.toFixed(2)}</ImporteTotalFactura>
    </DatosFactura>
    <DetallesFactura>
    ${linesXml}
    </DetallesFactura>
  </Factura>
  <HuellaTBAI>
    <EncadenamientoFacturaAnterior>
      <SerieFacturaAnterior>${prevHash === "0".repeat(64) ? "" : "PREV"}</SerieFacturaAnterior>
      <SignatureValueFirmaFacturaAnterior>${prevHash}</SignatureValueFirmaFacturaAnterior>
    </EncadenamientoFacturaAnterior>
    <Software>
      <NombreSoftware>RomainGE</NombreSoftware>
      <VersionSoftware>1.0</VersionSoftware>
      <NumeroInstalacion>ROMAINGE-001</NumeroInstalacion>
    </Software>
    <CodigoTBAI>${tbaiCode}</CodigoTBAI>
    <HuellaFactura>${hash}</HuellaFactura>
  </HuellaTBAI>
</T:TicketBai>`;

  return { xml, tbaiCode, hash, previousHash: prevHash };
}

// ── Verifactu (AEAT nacional — RD 1007/2023) ────────────────
export function validateVerifactu(invoice) {
  const errors = [];
  if (!invoice.emisor?.nif) errors.push("Emisor NIF obligatorio");
  if (!invoice.emisor?.name) errors.push("Emisor nombre obligatorio");
  if (!invoice.receptor?.nif) errors.push("Receptor NIF obligatorio");
  if (!invoice.receptor?.name) errors.push("Receptor nombre obligatorio");
  if (!invoice.numero) errors.push("Número de factura obligatorio");
  if (!invoice.fecha) errors.push("Fecha obligatoria");
  if (!invoice.operationType) errors.push("Tipo de operación obligatorio");
  if (!invoice.lines || invoice.lines.length === 0) errors.push("Al menos una línea requerida");
  if (!invoice.totals) errors.push("Totales obligatorios");
  if (invoice.receptor?.pais && invoice.receptor.pais !== "ES" && !invoice.receptor.address) {
    errors.push("Dirección receptor obligatoria para operaciones intracomunitarias");
  }
  if (invoice.totals && invoice.lines?.length > 0) {
    const recalc = calculateTotals(invoice.lines);
    if (Math.abs(recalc.totalFactura - invoice.totals.totalFactura) > 0.02) {
      errors.push("Los totales no cuadran con las líneas de detalle");
    }
  }
  return { valid: errors.length === 0, errors };
}

export function generateVerifactu(invoice) {
  const v = validateVerifactu(invoice);
  if (!v.valid) throw new Error(`Validación Verifactu fallida: ${v.errors.join(", ")}`);

  const hash = computeInvoiceHash(invoice);
  const prevHash = getPreviousHash(invoice.emisor.nif);
  const fingerprint = createHash("sha256").update(`${hash}|${prevHash}|RomainGE`).digest("hex");
  chainStore.set(invoice.emisor.nif, hash);
  invoice.verifactu = { hash, previousHash: prevHash, fingerprint };
  const ts = new Date().toISOString();
  const e = invoice.emisor, r = invoice.receptor;

  const desgloseXml = invoice.lines.map(l =>
    `<DetalleDesglose><ClaveRegimen>01</ClaveRegimen>` +
    `<CalificacionOperacion>${invoice.operationType}</CalificacionOperacion>` +
    `<TipoImpositivo>${l.taxRate.toFixed(2)}</TipoImpositivo>` +
    `<BaseImponible>${l.baseImponible.toFixed(2)}</BaseImponible>` +
    `<CuotaRepercutida>${l.taxAmount.toFixed(2)}</CuotaRepercutida></DetalleDesglose>`
  ).join("\n      ");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sf:RegistroFacturacion xmlns:sf="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroFactEmitV1.xsd">
  <Cabecera>
    <ObligadoEmision>
      <NombreRazon>${escapeXml(e.name)}</NombreRazon>
      <NIF>${escapeXml(e.nif)}</NIF>
    </ObligadoEmision>
    <TipoRegistro>F</TipoRegistro>
    <VersionRegistro>1.0</VersionRegistro>
  </Cabecera>
  <RegistroAlta>
    <IDFactura>
      <IDEmisorFactura>${escapeXml(e.nif)}</IDEmisorFactura>
      <NumSerieFactura>${escapeXml(invoice.numero)}</NumSerieFactura>
      <FechaExpedicionFactura>${invoice.fecha}</FechaExpedicionFactura>
    </IDFactura>
    <NombreRazonEmisor>${escapeXml(e.name)}</NombreRazonEmisor>
    <TipoFactura>${invoice.operationType}</TipoFactura>
    <DescripcionOperacion>Factura generada por RomainGE</DescripcionOperacion>
    <Destinatario>
      <NombreRazon>${escapeXml(r.name)}</NombreRazon>
      <NIF>${escapeXml(r.nif)}</NIF>${r.pais && r.pais !== "ES" ? `\n      <CodigoPais>${escapeXml(r.pais)}</CodigoPais>` : ""}
    </Destinatario>
    <Desglose>
      ${desgloseXml}
    </Desglose>
    <ImporteTotal>${invoice.totals.totalFactura.toFixed(2)}</ImporteTotal>
    <Encadenamiento>
      <HuellaAnterior>${prevHash}</HuellaAnterior>
      <FechaHoraHuellaAnterior>${ts}</FechaHoraHuellaAnterior>
    </Encadenamiento>
    <Huella>
      <Fingerprint>${fingerprint}</Fingerprint>
      <Hash>${hash}</Hash>
    </Huella>
    <SistemaInformatico>
      <NombreSistema>RomainGE</NombreSistema><Version>1.0</Version>
      <NumeroInstalacion>ROMAINGE-001</NumeroInstalacion>
      <TipoUsoPosible>V</TipoUsoPosible>
    </SistemaInformatico>
    <FechaHoraRegistro>${ts}</FechaHoraRegistro>
  </RegistroAlta>
</sf:RegistroFacturacion>`;

  return { xml, hash, previousHash: prevHash, fingerprint };
}

// ── QR para verificación ─────────────────────────────────────
export function generateQRData(invoice) {
  if (invoice.ticketbai?.code) {
    const territory = detectTerritory(invoice.emisor.postalCode);
    const bases = { araba: "https://batuz.eus/QRTBAI/", bizkaia: "https://batuz.eus/QRTBAI/", gipuzkoa: "https://tbai.egoitza.gipuzkoa.eus/qr/" };
    const base = bases[territory] || bases.bizkaia;
    return { type: "ticketbai", url: `${base}?id=${encodeURIComponent(invoice.ticketbai.code)}&s=${invoice.serie}&nf=${invoice.numero}&i=${invoice.totals.totalFactura.toFixed(2)}`, code: invoice.ticketbai.code };
  }
  if (invoice.verifactu?.fingerprint) {
    return { type: "verifactu", url: `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=${encodeURIComponent(invoice.emisor.nif)}&numserie=${encodeURIComponent(invoice.numero)}&fecha=${invoice.fecha}&importe=${invoice.totals.totalFactura.toFixed(2)}`, fingerprint: invoice.verifactu.fingerprint };
  }
  return { type: "none", url: null };
}

// ── Exportaciones de constantes ──────────────────────────────
export { IVA_RATES, RECARGO_RATES, IRPF_RATES, VALID_OPERATION_TYPES, VALID_PAYMENT_METHODS, TICKETBAI_TERRITORIES };
