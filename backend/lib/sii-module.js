// ═══════════════════════════════════════════════════════════════
// lib/sii-module.js — SII (Suministro Inmediato de Información)
// Sistema de reporte en tiempo real del IVA ante la AEAT
// ═══════════════════════════════════════════════════════════════

// ─── In-memory store ───────────────────────────────────────────
const siiRecords = new Map();
let recordCounter = 0;

// ─── Constantes SII ───────────────────────────────────────────
const SII_BOOK_TYPES = [
  "facturas_emitidas",
  "facturas_recibidas",
  "bienes_inversion",
  "intracomunitarias",
];

const INVOICE_TYPE_CODES = {
  F1: "Factura (art. 6, 7.2 y 7.3 del RD 1619/2012)",
  F2: "Factura simplificada (art. 6.1.d del RD 1619/2012)",
  F3: "Factura emitida en sustitución de factura simplificada",
  F4: "Asiento resumen de facturas",
  F5: "Importaciones (DUA)",
  R1: "Factura rectificativa (art. 80.1, 80.2 y error fundado)",
  R2: "Factura rectificativa (art. 80.3)",
  R3: "Factura rectificativa (art. 80.4)",
  R4: "Factura rectificativa (resto)",
  R5: "Factura rectificativa en facturas simplificadas",
};

const CLAVE_REGIMEN = {
  "01": "Operación en régimen general",
  "02": "Exportación de bienes",
  "03": "Operaciones a las que se aplique el régimen especial de bienes usados",
  "04": "Régimen especial de oro de inversión",
  "05": "Régimen especial de agencias de viaje",
  "06": "Régimen especial de grupos de entidades en IVA (nivel avanzado)",
  "07": "Régimen especial del criterio de caja (RECC)",
  "08": "Operaciones sujetas a IPSI/IGIC",
  "09": "Adquisiciones intracomunitarias de bienes",
  "10": "Adquisiciones a través de agencias de viaje (DA 4ª RD 1619/2012)",
  "11": "Arrendamientos de locales de negocio sujetos a retención",
  "12": "Operaciones de seguros no identificadas con factura",
  "13": "Facturas de prestaciones de servicios de agencias de viaje pendientes",
  "14": "Cobros por cuenta de terceros – primer semestre 2017",
  "15": "Operaciones en régimen de cobros en metálico superiores a 6.000€",
};

const IVA_RATES = [0, 4, 10, 21];

// ─── Festivos nacionales España 2025 ─────────────────────────
const HOLIDAYS_2025 = [
  "2025-01-01", // Año Nuevo
  "2025-01-06", // Epifanía del Señor
  "2025-04-17", // Jueves Santo
  "2025-04-18", // Viernes Santo
  "2025-05-01", // Fiesta del Trabajo
  "2025-08-15", // Asunción de la Virgen
  "2025-10-12", // Fiesta Nacional de España
  "2025-11-01", // Todos los Santos
  "2025-12-06", // Día de la Constitución
  "2025-12-08", // Inmaculada Concepción
  "2025-12-25", // Navidad
];

const holidaySet = new Set(HOLIDAYS_2025);

// ─── Utilidades de fecha ──────────────────────────────────────
function isBusinessDay(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  const iso = date.toISOString().slice(0, 10);
  return !holidaySet.has(iso);
}

function addBusinessDays(startDate, days) {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) added++;
  }
  return result;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

// ─── Validación NIF básica ────────────────────────────────────
function isValidNIF(nif) {
  if (!nif || typeof nif !== "string") return false;
  return /^[A-Z0-9]{8,9}[A-Z0-9]$/.test(nif.toUpperCase().replace(/[\s-]/g, ""));
}

// ─── Crear registro SII ──────────────────────────────────────
export function createSIIRecord(type, invoiceData) {
  if (!SII_BOOK_TYPES.includes(type)) {
    return { ok: false, error: `Tipo inválido. Valores permitidos: ${SII_BOOK_TYPES.join(", ")}` };
  }

  const required = ["nifEmisor", "nifReceptor", "tipoFactura", "claveRegimen",
    "baseImponible", "tipoIVA", "cuotaIVA", "fechaOperacion", "numeroFactura"];
  const missing = required.filter(f => invoiceData[f] === undefined && invoiceData[f] !== 0);
  if (missing.length > 0) {
    return { ok: false, error: `Campos obligatorios ausentes: ${missing.join(", ")}` };
  }

  const {
    nifEmisor, nifReceptor, tipoFactura, claveRegimen,
    baseImponible, tipoIVA, cuotaIVA, fechaOperacion,
    fechaRegistro, numeroFactura, descripcion,
  } = invoiceData;

  if (!INVOICE_TYPE_CODES[tipoFactura]) {
    return { ok: false, error: `Tipo factura inválido: ${tipoFactura}. Válidos: ${Object.keys(INVOICE_TYPE_CODES).join(", ")}` };
  }
  if (!CLAVE_REGIMEN[claveRegimen]) {
    return { ok: false, error: `Clave régimen inválida: ${claveRegimen}. Válidos: ${Object.keys(CLAVE_REGIMEN).join(", ")}` };
  }
  if (!IVA_RATES.includes(Number(tipoIVA))) {
    return { ok: false, error: `Tipo IVA inválido: ${tipoIVA}. Válidos: ${IVA_RATES.join(", ")}%` };
  }
  if (!isValidNIF(nifEmisor)) {
    return { ok: false, error: `NIF emisor inválido: ${nifEmisor}` };
  }
  if (!isValidNIF(nifReceptor)) {
    return { ok: false, error: `NIF receptor inválido: ${nifReceptor}` };
  }

  const opDate = new Date(fechaOperacion);
  if (isNaN(opDate.getTime())) {
    return { ok: false, error: `Fecha operación inválida: ${fechaOperacion}` };
  }

  const id = `SII-${String(++recordCounter).padStart(6, "0")}`;
  const deadline = getSIIDeadlines(fechaOperacion);

  const record = {
    id,
    type,
    nifEmisor: nifEmisor.toUpperCase().replace(/[\s-]/g, ""),
    nifReceptor: nifReceptor.toUpperCase().replace(/[\s-]/g, ""),
    tipoFactura,
    tipoFacturaDesc: INVOICE_TYPE_CODES[tipoFactura],
    claveRegimen,
    claveRegimenDesc: CLAVE_REGIMEN[claveRegimen],
    baseImponible: Number(baseImponible),
    tipoIVA: Number(tipoIVA),
    cuotaIVA: Number(cuotaIVA),
    total: Number(baseImponible) + Number(cuotaIVA),
    fechaOperacion: formatDate(opDate),
    fechaRegistro: fechaRegistro || formatDate(new Date()),
    numeroFactura,
    descripcion: descripcion || "",
    deadline: deadline.deadline,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    xml: generateSIIXml(id, type, { ...invoiceData, nifEmisor, nifReceptor }),
  };

  siiRecords.set(id, record);
  return { ok: true, record };
}

// ─── Generar XML SII ──────────────────────────────────────────
function generateSIIXml(id, type, data) {
  const bookTag = {
    facturas_emitidas: "RegistroLRFacturasEmitidas",
    facturas_recibidas: "RegistroLRFacturasRecibidas",
    bienes_inversion: "RegistroLRBienesInversion",
    intracomunitarias: "RegistroLROperacionesIntracomunitarias",
  }[type];

  return `<?xml version="1.0" encoding="UTF-8"?>
<siiLR:SuministroLR${type === "facturas_emitidas" ? "FacturasEmitidas" : type === "facturas_recibidas" ? "FacturasRecibidas" : type === "bienes_inversion" ? "BienesInversion" : "OperacionesIntracomunitarias"}
  xmlns:sii="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/ssii/fact/ws/SusIniInfo.xsd"
  xmlns:siiLR="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/ssii/fact/ws/SuministroLR.xsd">
  <sii:Cabecera>
    <sii:IDVersionSii>1.1</sii:IDVersionSii>
    <sii:Titular>
      <sii:NombreRazon>Titular</sii:NombreRazon>
      <sii:NIF>${data.nifEmisor}</sii:NIF>
    </sii:Titular>
    <sii:TipoComunicacion>A0</sii:TipoComunicacion>
  </sii:Cabecera>
  <siiLR:${bookTag}>
    <siiLR:PeriodoLiquidacion>
      <sii:Ejercicio>${new Date(data.fechaOperacion).getFullYear()}</sii:Ejercicio>
      <sii:Periodo>${String(new Date(data.fechaOperacion).getMonth() + 1).padStart(2, "0")}</sii:Periodo>
    </siiLR:PeriodoLiquidacion>
    <siiLR:IDFactura>
      <sii:IDEmisorFactura><sii:NIF>${data.nifEmisor}</sii:NIF></sii:IDEmisorFactura>
      <sii:NumSerieFacturaEmisor>${data.numeroFactura}</sii:NumSerieFacturaEmisor>
      <sii:FechaExpedicionFacturaEmisor>${data.fechaOperacion}</sii:FechaExpedicionFacturaEmisor>
    </siiLR:IDFactura>
    <siiLR:FacturaExpedida>
      <sii:TipoFactura>${data.tipoFactura}</sii:TipoFactura>
      <sii:ClaveRegimenEspecialOTrascendencia>${data.claveRegimen}</sii:ClaveRegimenEspecialOTrascendencia>
      <sii:ImporteTotal>${Number(data.baseImponible) + Number(data.cuotaIVA)}</sii:ImporteTotal>
      <sii:DescripcionOperacion>${data.descripcion || "Operación sujeta a IVA"}</sii:DescripcionOperacion>
      <sii:Contraparte>
        <sii:NombreRazon>Contraparte</sii:NombreRazon>
        <sii:NIF>${data.nifReceptor}</sii:NIF>
      </sii:Contraparte>
      <sii:TipoDesglose>
        <sii:DesgloseFactura>
          <sii:Sujeta>
            <sii:NoExenta>
              <sii:TipoNoExenta>S1</sii:TipoNoExenta>
              <sii:DesgloseIVA>
                <sii:DetalleIVA>
                  <sii:TipoImpositivo>${data.tipoIVA}</sii:TipoImpositivo>
                  <sii:BaseImponible>${data.baseImponible}</sii:BaseImponible>
                  <sii:CuotaRepercutida>${data.cuotaIVA}</sii:CuotaRepercutida>
                </sii:DetalleIVA>
              </sii:DesgloseIVA>
            </sii:NoExenta>
          </sii:Sujeta>
        </sii:DesgloseFactura>
      </sii:TipoDesglose>
    </siiLR:FacturaExpedida>
  </siiLR:${bookTag}>
</siiLR:SuministroLR${type === "facturas_emitidas" ? "FacturasEmitidas" : type === "facturas_recibidas" ? "FacturasRecibidas" : type === "bienes_inversion" ? "BienesInversion" : "OperacionesIntracomunitarias"}>`;
}

// ─── Validar registro SII ─────────────────────────────────────
export function validateSIIRecord(record) {
  const errors = [];

  if (!record) {
    return { valid: false, errors: ["Registro vacío"] };
  }
  if (!SII_BOOK_TYPES.includes(record.type)) {
    errors.push(`Tipo de libro inválido: ${record.type}`);
  }
  if (!isValidNIF(record.nifEmisor)) {
    errors.push(`NIF emisor inválido: ${record.nifEmisor}`);
  }
  if (!isValidNIF(record.nifReceptor)) {
    errors.push(`NIF receptor inválido: ${record.nifReceptor}`);
  }
  if (!INVOICE_TYPE_CODES[record.tipoFactura]) {
    errors.push(`Tipo factura desconocido: ${record.tipoFactura}`);
  }
  if (!CLAVE_REGIMEN[record.claveRegimen]) {
    errors.push(`Clave régimen desconocida: ${record.claveRegimen}`);
  }
  if (typeof record.baseImponible !== "number" || record.baseImponible < 0) {
    errors.push("Base imponible debe ser un número positivo");
  }
  if (!IVA_RATES.includes(record.tipoIVA)) {
    errors.push(`Tipo IVA inválido: ${record.tipoIVA}. Permitidos: ${IVA_RATES.join(", ")}%`);
  }
  if (typeof record.cuotaIVA !== "number" || record.cuotaIVA < 0) {
    errors.push("Cuota IVA debe ser un número positivo");
  }
  const expectedCuota = +(record.baseImponible * record.tipoIVA / 100).toFixed(2);
  if (Math.abs(record.cuotaIVA - expectedCuota) > 0.02) {
    errors.push(`Cuota IVA (${record.cuotaIVA}) no coincide con base * tipo (${expectedCuota})`);
  }
  if (!record.fechaOperacion || isNaN(new Date(record.fechaOperacion).getTime())) {
    errors.push("Fecha de operación inválida");
  }
  if (!record.numeroFactura) {
    errors.push("Número de factura obligatorio");
  }

  return { valid: errors.length === 0, errors };
}

// ─── Tracking de envíos SII ──────────────────────────────────
export function trackSIISubmission(recordId, newStatus) {
  const validStatuses = ["pending", "accepted", "rejected", "partially_accepted"];
  if (!validStatuses.includes(newStatus)) {
    return { ok: false, error: `Estado inválido. Permitidos: ${validStatuses.join(", ")}` };
  }

  const record = siiRecords.get(recordId);
  if (!record) {
    return { ok: false, error: `Registro no encontrado: ${recordId}` };
  }

  record.status = newStatus;
  record.updatedAt = new Date().toISOString();
  return { ok: true, record };
}

export function getSIIStatus(nif, period) {
  const normalizedNif = nif?.toUpperCase().replace(/[\s-]/g, "");
  const results = [];
  for (const record of siiRecords.values()) {
    const matchNif = record.nifEmisor === normalizedNif || record.nifReceptor === normalizedNif;
    const recordPeriod = record.fechaOperacion?.slice(0, 7); // YYYY-MM
    const matchPeriod = !period || recordPeriod === period;
    if (matchNif && matchPeriod) results.push(record);
  }
  return results;
}

export function getSIIPendingRecords(nif) {
  const normalizedNif = nif?.toUpperCase().replace(/[\s-]/g, "");
  const results = [];
  for (const record of siiRecords.values()) {
    const matchNif = !normalizedNif ||
      record.nifEmisor === normalizedNif || record.nifReceptor === normalizedNif;
    if (matchNif && record.status === "pending") results.push(record);
  }
  return results;
}

// ─── Plazos SII ──────────────────────────────────────────────
export function getSIIDeadlines(invoiceDate) {
  const date = new Date(invoiceDate);
  if (isNaN(date.getTime())) {
    return { error: "Fecha inválida" };
  }

  const deadline = addBusinessDays(date, 4);
  const daysRemaining = Math.max(0, Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24)));
  const isOverdue = deadline < new Date();

  return {
    invoiceDate: formatDate(date),
    deadline: formatDate(deadline),
    daysRemaining,
    isOverdue,
    note: "Plazo de 4 días naturales hábiles desde la fecha de expedición (excluidos sábados, domingos y festivos nacionales).",
  };
}

// ─── Estadísticas SII ─────────────────────────────────────────
export function getSIIStats(nif) {
  const normalizedNif = nif?.toUpperCase().replace(/[\s-]/g, "");
  const stats = {
    total: 0,
    byType: { facturas_emitidas: 0, facturas_recibidas: 0, bienes_inversion: 0, intracomunitarias: 0 },
    byStatus: { pending: 0, accepted: 0, rejected: 0, partially_accepted: 0 },
    byPeriod: {},
    totalBase: 0,
    totalIVA: 0,
    totalAmount: 0,
  };

  for (const record of siiRecords.values()) {
    const matchNif = !normalizedNif ||
      record.nifEmisor === normalizedNif || record.nifReceptor === normalizedNif;
    if (!matchNif) continue;

    stats.total++;
    stats.byType[record.type]++;
    stats.byStatus[record.status]++;
    stats.totalBase += record.baseImponible;
    stats.totalIVA += record.cuotaIVA;
    stats.totalAmount += record.total;

    const period = record.fechaOperacion?.slice(0, 7) || "unknown";
    stats.byPeriod[period] = (stats.byPeriod[period] || 0) + 1;
  }

  stats.totalBase = +stats.totalBase.toFixed(2);
  stats.totalIVA = +stats.totalIVA.toFixed(2);
  stats.totalAmount = +stats.totalAmount.toFixed(2);

  return stats;
}

// ─── Base de conocimiento SII ─────────────────────────────────
export function getSIIInfo() {
  return {
    nombre: "SII — Suministro Inmediato de Información",
    descripcion:
      "Sistema de llevanza de los libros registro del IVA a través de la Sede Electrónica de la AEAT " +
      "mediante el suministro cuasi inmediato de los registros de facturación. " +
      "Regulado por el Real Decreto 596/2016, de 2 de diciembre.",
    url: "https://www.agenciatributaria.es/AEAT.internet/SII.html",

    obligados: [
      "Empresas inscritas en el REDEME (Registro de Devolución Mensual del IVA)",
      "Grandes empresas (facturación > 6.010.121,04 €/año)",
      "Grupos de entidades a efectos del IVA (art. 163 quinquies LIVA)",
      "Sujetos pasivos que liquiden el IVA mensualmente",
    ],
    voluntario:
      "Cualquier sujeto pasivo del IVA puede optar voluntariamente por el SII " +
      "presentando el modelo 036 en noviembre del año anterior. " +
      "La opción vincula al menos durante el año natural completo.",

    plazos: {
      facturas_emitidas: "4 días naturales hábiles desde la expedición de la factura",
      facturas_recibidas: "4 días naturales hábiles desde el registro contable",
      bienes_inversion: "Dentro del plazo de presentación del último periodo de liquidación del año (30 de enero)",
      intracomunitarias: "4 días naturales hábiles desde el momento de inicio de la expedición o transporte",
      nota: "Los sábados, domingos y festivos nacionales no computan. Hasta el 1 de julio de 2017 el plazo era de 8 días.",
    },

    libros: [
      { nombre: "Libro de Facturas Expedidas", tipo: "facturas_emitidas", descripcion: "Todas las facturas emitidas por el sujeto pasivo" },
      { nombre: "Libro de Facturas Recibidas", tipo: "facturas_recibidas", descripcion: "Todas las facturas recibidas de proveedores" },
      { nombre: "Libro de Bienes de Inversión", tipo: "bienes_inversion", descripcion: "Bienes de inversión con regularización de deducciones" },
      { nombre: "Libro de Operaciones Intracomunitarias", tipo: "intracomunitarias", descripcion: "Entregas y adquisiciones intracomunitarias de bienes" },
    ],

    tiposFactura: INVOICE_TYPE_CODES,
    clavesRegimen: CLAVE_REGIMEN,
    tiposIVA: IVA_RATES,

    ventajas: [
      "Reducción de obligaciones formales: se eliminan los modelos 347, 340 y 390",
      "Ampliación del plazo de presentación de autoliquidaciones periódicas en 10 días",
      "Obtención de datos fiscales (borrador de libros) por contraste con la información de clientes y proveedores",
      "Reducción de los plazos de devolución del IVA",
      "Disminución de requerimientos de información por parte de la AEAT",
    ],

    festivos2025: HOLIDAYS_2025.map(d => ({
      fecha: d,
      descripcion: [
        "Año Nuevo", "Epifanía del Señor", "Jueves Santo", "Viernes Santo",
        "Fiesta del Trabajo", "Asunción de la Virgen", "Fiesta Nacional de España",
        "Todos los Santos", "Día de la Constitución", "Inmaculada Concepción", "Navidad",
      ][HOLIDAYS_2025.indexOf(d)],
    })),
  };
}
