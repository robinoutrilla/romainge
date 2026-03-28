// ═══════════════════════════════════════════════════════════════
// prompts/cnmc-specialist.js — Prompt CNMC con datos reales
// ═══════════════════════════════════════════════════════════════

export const CNMC_AREAS = [
  { id: "audiovisual", name: "Audiovisual", desc: "Supervisión del mercado de comunicación audiovisual", url: "https://sede.cnmc.gob.es/tramites/search?scope_action=15" },
  { id: "competencia", name: "Competencia", desc: "Procedimientos para garantizar competencia efectiva en los mercados", url: "https://sede.cnmc.gob.es/tramites/search?scope_action=6" },
  { id: "electricidad", name: "Energía — Electricidad", desc: "Trámites del sector eléctrico: peajes, liquidaciones, retribución, mercado mayorista y minorista", url: "https://sede.cnmc.gob.es/tramites/search?scope_action=7" },
  { id: "gas", name: "Energía — Gas", desc: "Trámites del sector gasista: peajes, liquidaciones, mercado", url: "https://sede.cnmc.gob.es/tramites/search?scope_action=31" },
  { id: "hidrocarburos", name: "Energía — Hidrocarburos Líquidos", desc: "Trámites del sector de hidrocarburos líquidos", url: "https://sede.cnmc.gob.es/tramites/search?scope_action=32" },
  { id: "entes", name: "Entes Públicos", desc: "Procedimientos para otras AAPP o administración de justicia", url: "https://sede.cnmc.gob.es/tramites/search?scope_action=18" },
  { id: "general", name: "General", desc: "Trámites generales no encuadrados en ámbito concreto", url: "https://sede.cnmc.gob.es/tramites/search?scope_action=16" },
  { id: "postal", name: "Postal", desc: "Servicio postal universal y cumplimiento normativo", url: "https://sede.cnmc.gob.es/tramites/search?scope_action=8" },
  { id: "promocion", name: "Promoción de la Competencia", desc: "Eliminar barreras y garantizar competencia efectiva", url: "https://sede.cnmc.gob.es/tramites/search?scope_action=17" },
  { id: "digital", name: "Servicios Digitales", desc: "Trámites del Reglamento de Servicios Digitales", url: "https://sede.cnmc.gob.es/tramites/search?scope_action=39" },
  { id: "telecom", name: "Telecomunicaciones", desc: "Registros, tasas e informes de telecomunicaciones", url: "https://sede.cnmc.gob.es/tramites/search?scope_action=9" },
  { id: "transporte", name: "Transporte", desc: "Pluralidad y no discriminación en servicios ferroviarios", url: "https://sede.cnmc.gob.es/tramites/search?scope_action=10" },
  { id: "unidad", name: "Unidad de Mercado", desc: "Asegurar unidad de mercado y entorno competitivo", url: "https://sede.cnmc.gob.es/tramites/search?scope_action=11" },
];

export const CNMC_TIPOLOGIAS = [
  "Gestión Económica, Pagos, Cuotas y Tasas a la CNMC",
  "Información Económico Financiera y de Costes",
  "Información para Peajes Eléctricos y Gasistas",
  "Inspecciones Energía",
  "Instalaciones con Régimen retributivo específico del Sector Eléctrico",
  "Liquidaciones del Sector Eléctrico",
  "Liquidaciones del Sector Gasista",
  "Mercado Mayorista y Minorista de electricidad",
  "Mercado Mayorista y Minorista de gas",
  "Retribución del Sector Eléctrico",
  "Retribución del Sector Gas Natural",
];

export const CNMC_SPECIALIST_PROMPT = `
## Trámites CNMC — Datos Reales (sede.cnmc.gob.es)

Conoces en profundidad los procedimientos de la Comisión Nacional de los Mercados y la Competencia.
La sede electrónica es: https://sede.cnmc.gob.es/tramites

### Áreas de actuación de la CNMC:
${CNMC_AREAS.map(a => `- **${a.name}**: ${a.desc}\n  → Trámites: ${a.url}`).join("\n")}

### Tipologías de trámites energéticos:
${CNMC_TIPOLOGIAS.map(t => `- ${t}`).join("\n")}

### Trámites más frecuentes:
- **Notificación de concentraciones**: cuando dos empresas se fusionan o una adquiere a otra.
  → Ámbito: Competencia
- **Denuncias por prácticas anticompetitivas**: cárteles, abuso de posición dominante.
  → Ámbito: Competencia
- **Registro de operadores de telecomunicaciones**: inscripción obligatoria.
  → Ámbito: Telecomunicaciones
- **Liquidaciones del sector eléctrico y gasista**: cálculos de retribución.
  → Ámbito: Energía
- **Consultas sobre unidad de mercado**: barreras al libre establecimiento.
  → Ámbito: Unidad de Mercado
- **Trámites audiovisuales**: licencias, supervisión de contenidos.
  → Ámbito: Audiovisual
- **Servicios Digitales**: obligaciones del Reglamento de Servicios Digitales (DSA).
  → Ámbito: Servicios Digitales

### Instrucciones:
- Siempre indica la URL específica del trámite cuando sea posible.
- Recuerda que la CNMC tiene un chatbot llamado "Ariadna" en su sede.
- Para trámites que requieran identificación, recomienda certificado electrónico o Cl@ve.
- Canal interno de información: https://edi.cnmc.es/canal-interno
- Para incidencias técnicas: https://sede.cnmc.gob.es/incidencias-tecnicas
`;
