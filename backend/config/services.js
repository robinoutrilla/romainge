// ═══════════════════════════════════════════════════════════════
// config/services.js — Catálogo completo de servicios RomainGE
// ═══════════════════════════════════════════════════════════════

export const SERVICES = [
  { id: "impuestos",          digit: "1",  name: "Impuestos, Tasas y Prestaciones Patrimoniales", shortName: "Impuestos",        agent: "Agente Fiscal",           keywords: ["impuesto", "iva", "irpf", "sociedades", "tasa", "patrimonio", "sucesiones", "donaciones", "itp", "iva nacional", "iva general", "tipo impositivo"] },
  { id: "aduanas",            digit: "2",  name: "Aduanas",                                      shortName: "Aduanas",           agent: "Agente Aduanero",         keywords: ["aduana", "importación", "exportación", "arancel", "despacho", "tránsito"] },
  { id: "censos",             digit: "3",  name: "Censos, NIF y Domicilio Fiscal",                shortName: "Censos y NIF",      agent: "Agente Censal",           keywords: ["censo", "nif", "nie", "domicilio fiscal", "036", "037", "alta censal"] },
  { id: "certificados",       digit: "4",  name: "Certificados",                                  shortName: "Certificados",      agent: "Agente Certificados",     keywords: ["certificado", "estar al corriente", "contratista", "residencia fiscal"] },
  { id: "recaudacion",        digit: "5",  name: "Recaudación",                                   shortName: "Recaudación",       agent: "Agente Recaudación",      keywords: ["recaudación", "aplazamiento", "fraccionamiento", "embargo", "deuda", "apremio"] },
  { id: "beneficios",         digit: "6",  name: "Beneficios Fiscales y Autorizaciones",           shortName: "Beneficios",        agent: "Agente Beneficios",       keywords: ["beneficio", "deducción", "bonificación", "exención", "régimen especial"] },
  { id: "comprobaciones",     digit: "7",  name: "Comprobaciones Fiscales y Sancionador",          shortName: "Comprobaciones",    agent: "Agente Inspector",        keywords: ["inspección", "comprobación", "acta", "liquidación paralela", "sanción"] },
  { id: "requerimientos",     digit: "8",  name: "Requerimientos y Comunicaciones",                shortName: "Requerimientos",    agent: "Agente Comunicaciones",   keywords: ["requerimiento", "diligencia", "comunicación", "notificación aeat"] },
  { id: "recursos",           digit: "9",  name: "Recursos, Reclamaciones y Revisión",             shortName: "Recursos",          agent: "Agente Recursos",         keywords: ["recurso", "reposición", "reclamación", "teac", "suspensión", "revisión"] },
  { id: "otros-tributarios",  digit: "10", name: "Otros Procedimientos Tributarios",                shortName: "Otros Tributarios", agent: "Agente Tributario",       keywords: ["consulta vinculante", "acuerdo previo", "tasación pericial"] },
  { id: "no-tributarios",     digit: "11", name: "Procedimientos No Tributarios",                   shortName: "No Tributarios",    agent: "Agente Administrativo",   keywords: ["no tributario", "administrativo", "procedimiento no fiscal"] },
  { id: "aapp",               digit: "12", name: "Administraciones Públicas",                      shortName: "AAPP",              agent: "Agente AAPP",             keywords: ["administración pública", "ccaa", "ayuntamiento", "interadministrativo"] },
  { id: "colaboracion",       digit: "13", name: "Colaboración Social",                            shortName: "Colaboración",      agent: "Agente Colaboración",     keywords: ["colaboración social", "convenio", "sii", "terceros"] },
  { id: "apoderamiento",      digit: "14", name: "Apoderamiento",                                  shortName: "Apoderamiento",     agent: "Agente Poderes",          keywords: ["apoderamiento", "poder", "representación", "representante"] },
  { id: "sucesion",           digit: "15", name: "Sucesión",                                       shortName: "Sucesión",          agent: "Agente Sucesiones",       keywords: ["sucesión", "herencia", "heredero", "fallecido", "causante"] },
  { id: "calendario",         digit: "16", name: "Calendario del Contribuyente",                   shortName: "Calendario",        agent: "Agente Calendario",       keywords: ["calendario", "plazo", "vencimiento", "fecha", "trimestre"] },
  { id: "cotejo",             digit: "17", name: "Cotejo de Documentos",                           shortName: "Cotejo",            agent: "Agente Verificación",     keywords: ["cotejo", "verificación", "autenticidad", "código seguro"] },
  { id: "denuncia-tributaria", digit: "18", name: "Denuncia Tributaria",                           shortName: "Denuncia Trib.",    agent: "Agente Denuncias",        keywords: ["denuncia tributaria", "fraude fiscal", "infracción tributaria"] },
  { id: "denuncia-efectivo",  digit: "19", name: "Denuncia Pagos en Efectivo",                     shortName: "Pagos Efectivo",    agent: "Agente Efectivo",         keywords: ["pago efectivo", "límite efectivo", "denuncia efectivo"] },
  { id: "ley2023",            digit: "20", name: "Canal Externo Ley 2/2023 (Informante)",           shortName: "Canal Externo",     agent: "Agente Protección",       keywords: ["informante", "canal externo", "ley 2/2023", "whistleblower"] },
  { id: "canal-interno",      digit: "21", name: "Canal Interno Ley 2/2023 (AEAT)",                shortName: "Canal Interno",     agent: "Agente Canal Interno",    keywords: ["canal interno", "infracción aeat", "personal aeat"] },
  { id: "etiquetas",          digit: "22", name: "Etiquetas",                                      shortName: "Etiquetas",         agent: "Agente Etiquetas",        keywords: ["etiqueta", "identificativa", "pegatina"] },
  { id: "notificaciones",     digit: "23", name: "Notificaciones",                                 shortName: "Notificaciones",    agent: "Agente Notificaciones",   keywords: ["notificación electrónica", "deh", "buzón", "comparecencia"] },
  { id: "pago",               digit: "24", name: "Pago de Impuestos",                              shortName: "Pago",              agent: "Agente Pagos",            keywords: ["pago", "nrc", "domiciliación", "carta de pago", "ingreso"] },
  { id: "simuladores",        digit: "25", name: "Simuladores",                                    shortName: "Simuladores",       agent: "Agente Simulador",        keywords: ["simulador", "cálculo", "simulación", "retención"] },
  { id: "vies",               digit: "26", name: "VIES — IVA Intracomunitario",                     shortName: "VIES",              agent: "Agente VIES",             keywords: ["vies", "nif-iva", "intracomunitario", "vat", "iva intracomunitario", "operación intracomunitaria", "adquisición intracomunitaria", "entrega intracomunitaria", "roi", "registro operadores intracomunitarios", "modelo 349", "iva europeo", "iva ue", "iva comunitario"] },
  { id: "concursos",          digit: "27", name: "Acuerdos Extrajudiciales y Concursos",            shortName: "Concursos",         agent: "Agente Concursal",        keywords: ["concurso", "extrajudicial", "mediación concursal", "insolvencia"] },
  { id: "clave",              digit: "28", name: "Registro Cl@ve",                                 shortName: "Cl@ve",             agent: "Agente Cl@ve",            keywords: ["clave", "cl@ve", "pin", "permanente", "identificación"] },
  { id: "cita",               digit: "29", name: "Asistencia y Cita",                              shortName: "Cita Previa",       agent: "Agente Cita",             keywords: ["cita previa", "asistencia", "presencial", "oficina"] },
  { id: "firma",              digit: "30", name: "Documentos Pendientes de Firma",                  shortName: "Firma",             agent: "Agente Firma",            keywords: ["firma", "pendiente firma", "firma electrónica"] },
  { id: "cert-electronico",   digit: "31", name: "Certificados Electrónicos Representante",         shortName: "Cert. Electrónico", agent: "Agente Cert. Electrónico", keywords: ["certificado electrónico", "representante", "persona jurídica"] },
  { id: "autorizacion-cert",  digit: "32", name: "Autorización Certificados Electrónicos",          shortName: "Autoriz. Cert.",    agent: "Agente Autorización",     keywords: ["autorización certificado", "acceso servicios", "autorización electrónica"] },
  { id: "token",              digit: "33", name: "Obtención de TOKEN",                              shortName: "TOKEN",             agent: "Agente Token",            keywords: ["token", "identificación electrónica", "acceso electrónico"] },
  { id: "financiacion",       digit: "34", name: "Financiación Autonómica y Local",                 shortName: "Financiación",      agent: "Agente Financiación",     keywords: ["financiación autonómica", "financiación local", "transferencia", "liquidación"] },
  { id: "cnmc",               digit: "35", name: "Trámites CNMC",                                   shortName: "CNMC",              agent: "Agente CNMC",             keywords: ["cnmc", "competencia", "mercado", "regulación", "telecomunicaciones", "energía"] },
  { id: "renta2025",          digit: "36", name: "Campaña Renta 2025",                              shortName: "Renta 2025",        agent: "Agente Renta 2025",       keywords: ["renta", "declaración", "borrador", "campaña renta", "irpf 2025", "renta 2025"] },
  { id: "ibi",                digit: "37", name: "IBI — Impuesto sobre Bienes Inmuebles",            shortName: "IBI Municipal",     agent: "Agente IBI Municipal",    keywords: ["ibi", "bienes inmuebles", "catastro", "valor catastral", "recibo ibi", "bonificación ibi", "exención ibi", "plusvalía", "referencia catastral", "ponencia de valores"] },
  { id: "modelo303",          digit: "38", name: "Modelo 303 — IVA Trimestral",                     shortName: "Modelo 303",        agent: "Agente IVA 303",          keywords: ["modelo 303", "iva trimestral", "autoliquidación iva", "iva soportado", "iva repercutido", "declaración trimestral iva", "303", "prorrata", "régimen simplificado iva"] },
  { id: "autonomos",          digit: "39", name: "Gestión Integral del Autónomo",                    shortName: "Autónomos",         agent: "Agente Autónomos",        keywords: ["autónomo", "autónomos", "modelo 130", "modelo 390", "cuota autónomos", "reta", "tarifa plana", "estimación directa", "módulos", "alta autónomo", "baja autónomo", "epígrafe iae"] },
];

// Mapa rápido por ID
export const SERVICES_MAP = Object.fromEntries(SERVICES.map(s => [s.id, s]));

// Clasificador de intención por keywords
export function classifyIntent(userText) {
  const text = userText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let bestMatch = null;
  let bestScore = 0;

  for (const service of SERVICES) {
    let score = 0;
    for (const kw of service.keywords) {
      const normalizedKw = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (text.includes(normalizedKw)) {
        // Multi-word keywords get a specificity bonus (1.5x) to prioritize
        // compound matches like "iva intracomunitario" over single "iva"
        const wordCount = normalizedKw.split(" ").length;
        const bonus = wordCount > 1 ? 1.5 : 1.0;
        score += normalizedKw.length * bonus;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = service;
    }
  }

  return bestMatch;
}
