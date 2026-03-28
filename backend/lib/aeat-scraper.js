// AEAT Calendar Scraper — scrapes sede.agenciatributaria.gob.es for fiscal deadlines
// No external dependencies — uses native fetch + regex parsing

const CALENDAR_URL = 'https://sede.agenciatributaria.gob.es/Sede/ayuda/calendario-contribuyente.html';
const MODEL_URL_BASE = 'https://sede.agenciatributaria.gob.es/Sede/procedimientosservicios/';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------
const cache = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry.data;
}

function cacheSet(key, data, ttlMs = DEFAULT_TTL_MS) {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateCache() {
  cache.clear();
}

// ---------------------------------------------------------------------------
// Scrape AEAT calendar
// ---------------------------------------------------------------------------
export async function scrapeAEATCalendar(year, month) {
  const url = month
    ? `${CALENDAR_URL}?year=${year}&month=${month}`
    : `${CALENDAR_URL}?year=${year}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'RomainGE/1.0 (fiscal-calendar-sync)',
        'Accept': 'text/html',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return parseCalendarHTML(html, year);
  } catch (err) {
    console.warn(`[aeat-scraper] Scrape failed (${err.message}), using fallback data`);
    const fallback = getFallbackCalendar(year);
    if (month) return fallback.filter(d => d.month === month);
    return fallback;
  }
}

function parseCalendarHTML(html, year) {
  const deadlines = [];

  // Pattern: calendar entries typically contain modelo number, description, and date
  // <td ...>Modelo XXX</td> ... <td ...>description</td> ... <td ...>dd/mm</td>
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const tagStripRe = /<[^>]+>/g;

  let rowMatch;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const rowContent = rowMatch[1];
    const cells = [];
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowContent)) !== null) {
      cells.push(cellMatch[1].replace(tagStripRe, '').trim());
    }
    if (cells.length < 2) continue;

    const modeloMatch = cells.join(' ').match(/[Mm]odelo\s+(\d{3})/);
    const dateMatch = cells.join(' ').match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{4}))?/);

    if (modeloMatch && dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10);
      deadlines.push({
        modelo: modeloMatch[1],
        description: cells.find(c => c.length > 20) || cells[1] || '',
        deadline: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        month,
        day,
        who: extractWho(cells.join(' ')),
        periodicity: extractPeriodicity(cells.join(' ')),
      });
    }
  }

  // Also try list/paragraph based layouts
  const listRe = /[Mm]odelo\s+(\d{3})[^.]*?(?:hasta|antes del?|plazo[^.]*?)\s+(\d{1,2})\s+de\s+(\w+)/gi;
  let listMatch;
  while ((listMatch = listRe.exec(html)) !== null) {
    const modelo = listMatch[1];
    if (deadlines.some(d => d.modelo === modelo)) continue;
    const day = parseInt(listMatch[2], 10);
    const month = monthNameToNumber(listMatch[3]);
    if (!month) continue;
    deadlines.push({
      modelo,
      description: listMatch[0].replace(tagStripRe, '').trim(),
      deadline: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      month, day,
      who: '', periodicity: '',
    });
  }

  return deadlines.length > 0 ? deadlines : getFallbackCalendar(year);
}

function extractWho(text) {
  const t = text.toLowerCase();
  if (t.includes('autónomo') || t.includes('autonomo')) return 'autónomos';
  if (t.includes('sociedad') || t.includes('empresa')) return 'sociedades';
  if (t.includes('retenedor')) return 'retenedores';
  if (t.includes('todos') || t.includes('contribuyente')) return 'todos los contribuyentes';
  return '';
}

function extractPeriodicity(text) {
  const t = text.toLowerCase();
  if (t.includes('trimestral')) return 'trimestral';
  if (t.includes('mensual')) return 'mensual';
  if (t.includes('anual')) return 'anual';
  return '';
}

function monthNameToNumber(name) {
  const map = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  };
  return map[(name || '').toLowerCase()] || null;
}

// ---------------------------------------------------------------------------
// Scrape model info
// ---------------------------------------------------------------------------
export async function scrapeModelInfo(modelNumber) {
  const num = String(modelNumber).padStart(3, '0');
  const cacheKey = `model:${num}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url = `${MODEL_URL_BASE}modelo${num}.html`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'RomainGE/1.0 (model-info)',
        'Accept': 'text/html',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const tagStrip = /<[^>]+>/g;

    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
      || html.match(/<p[^>]*class="[^"]*descripcion[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
    const whoMatch = html.match(/[Oo]bligados[^<]*<[^>]*>([\s\S]*?)<\/(?:p|div|ul)>/i);
    const deadlineMatch = html.match(/[Pp]lazo[^<]*<[^>]*>([\s\S]*?)<\/(?:p|div)>/i);
    const relatedRe = /[Mm]odelo\s+(\d{3})/g;
    const related = new Set();
    let m;
    while ((m = relatedRe.exec(html)) !== null) {
      if (m[1] !== num) related.add(m[1]);
    }

    const info = {
      modelo: num,
      name: titleMatch ? titleMatch[1].replace(tagStrip, '').trim() : `Modelo ${num}`,
      description: descMatch ? (descMatch[1] || descMatch[2] || '').replace(tagStrip, '').trim() : '',
      who: whoMatch ? whoMatch[1].replace(tagStrip, '').trim() : '',
      deadline: deadlineMatch ? deadlineMatch[1].replace(tagStrip, '').trim() : '',
      filingMethod: html.includes('electrónica') ? 'electrónica' : 'presencial/electrónica',
      relatedModels: [...related],
    };

    cacheSet(cacheKey, info);
    return info;
  } catch (err) {
    console.warn(`[aeat-scraper] Model ${num} scrape failed: ${err.message}`);
    return {
      modelo: num,
      name: `Modelo ${num}`,
      description: '',
      who: '',
      deadline: '',
      filingMethod: '',
      relatedModels: [],
      error: err.message,
    };
  }
}

// ---------------------------------------------------------------------------
// Cached calendar accessor
// ---------------------------------------------------------------------------
export async function getCachedCalendar(year) {
  const key = `calendar:${year}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const data = await scrapeAEATCalendar(year);
  cacheSet(key, data);
  return data;
}

// ---------------------------------------------------------------------------
// Diff detection
// ---------------------------------------------------------------------------
export function detectChanges(oldCalendar, newCalendar) {
  const oldMap = new Map(oldCalendar.map(d => [`${d.modelo}:${d.deadline}`, d]));
  const newMap = new Map(newCalendar.map(d => [`${d.modelo}:${d.deadline}`, d]));

  const added = [];
  const removed = [];
  const modified = [];

  for (const [key, entry] of newMap) {
    if (!oldMap.has(key)) {
      added.push(entry);
    } else {
      const old = oldMap.get(key);
      if (old.description !== entry.description || old.who !== entry.who) {
        modified.push({ before: old, after: entry });
      }
    }
  }

  for (const [key, entry] of oldMap) {
    if (!newMap.has(key)) removed.push(entry);
  }

  return { added, removed, modified, hasChanges: added.length + removed.length + modified.length > 0 };
}

// ---------------------------------------------------------------------------
// Auto-update scheduler
// ---------------------------------------------------------------------------
let autoUpdateTimer = null;

export function startAutoUpdate(intervalHours = 24) {
  stopAutoUpdate();
  const ms = intervalHours * 60 * 60 * 1000;
  const currentYear = new Date().getFullYear();

  const run = async () => {
    try {
      const oldData = cacheGet(`calendar:${currentYear}`) || [];
      invalidateCache();
      const newData = await getCachedCalendar(currentYear);
      const diff = detectChanges(oldData, newData);
      if (diff.hasChanges) {
        console.log(`[aeat-scraper] Calendar changes detected:`,
          `+${diff.added.length} -${diff.removed.length} ~${diff.modified.length}`);
      } else {
        console.log(`[aeat-scraper] Calendar up to date (${newData.length} deadlines)`);
      }
    } catch (err) {
      console.error(`[aeat-scraper] Auto-update error:`, err.message);
    }
  };

  run();
  autoUpdateTimer = setInterval(run, ms);
  console.log(`[aeat-scraper] Auto-update started every ${intervalHours}h`);
}

function stopAutoUpdate() {
  if (autoUpdateTimer) { clearInterval(autoUpdateTimer); autoUpdateTimer = null; }
}

// ---------------------------------------------------------------------------
// Fallback hardcoded calendar (2025)
// ---------------------------------------------------------------------------
export function getFallbackCalendar(year) {
  const y = year || 2025;
  return [
    // Enero — 4T + resúmenes anuales
    { modelo: '303', description: 'IVA autoliquidación 4T', deadline: `${y}-01-20`, month: 1, day: 20, who: 'autónomos y sociedades', periodicity: 'trimestral' },
    { modelo: '111', description: 'Retenciones trabajo/profesionales 4T', deadline: `${y}-01-20`, month: 1, day: 20, who: 'retenedores', periodicity: 'trimestral' },
    { modelo: '115', description: 'Retenciones alquileres 4T', deadline: `${y}-01-20`, month: 1, day: 20, who: 'retenedores', periodicity: 'trimestral' },
    { modelo: '130', description: 'Pago fraccionado IRPF 4T', deadline: `${y}-01-20`, month: 1, day: 20, who: 'autónomos', periodicity: 'trimestral' },
    { modelo: '349', description: 'Operaciones intracomunitarias 4T', deadline: `${y}-01-20`, month: 1, day: 20, who: 'operadores intracomunitarios', periodicity: 'trimestral' },
    { modelo: '390', description: 'Resumen anual IVA', deadline: `${y}-01-30`, month: 1, day: 30, who: 'sujetos pasivos IVA', periodicity: 'anual' },
    { modelo: '180', description: 'Resumen anual retenciones alquileres', deadline: `${y}-01-31`, month: 1, day: 31, who: 'retenedores', periodicity: 'anual' },
    { modelo: '190', description: 'Resumen anual retenciones trabajo', deadline: `${y}-01-31`, month: 1, day: 31, who: 'retenedores', periodicity: 'anual' },
    { modelo: '193', description: 'Resumen anual retenciones capital mobiliario', deadline: `${y}-01-31`, month: 1, day: 31, who: 'retenedores', periodicity: 'anual' },
    { modelo: '184', description: 'Declaración informativa entidades régimen atribución', deadline: `${y}-01-31`, month: 1, day: 31, who: 'entidades en atribución de rentas', periodicity: 'anual' },
    { modelo: '233', description: 'SII — Suministro Inmediato Información', deadline: `${y}-01-31`, month: 1, day: 31, who: 'grandes empresas / SII', periodicity: 'anual' },

    // Febrero
    { modelo: '347', description: 'Declaración operaciones con terceros', deadline: `${y}-02-28`, month: 2, day: 28, who: 'empresarios y profesionales', periodicity: 'anual' },
    { modelo: '036', description: 'Declaración censal — altas y modificaciones', deadline: `${y}-02-28`, month: 2, day: 28, who: 'nuevas altas censales', periodicity: 'anual' },

    // Abril — 1T + inicio Renta
    { modelo: '303', description: 'IVA autoliquidación 1T', deadline: `${y}-04-20`, month: 4, day: 20, who: 'autónomos y sociedades', periodicity: 'trimestral' },
    { modelo: '111', description: 'Retenciones trabajo/profesionales 1T', deadline: `${y}-04-20`, month: 4, day: 20, who: 'retenedores', periodicity: 'trimestral' },
    { modelo: '115', description: 'Retenciones alquileres 1T', deadline: `${y}-04-20`, month: 4, day: 20, who: 'retenedores', periodicity: 'trimestral' },
    { modelo: '130', description: 'Pago fraccionado IRPF 1T', deadline: `${y}-04-20`, month: 4, day: 20, who: 'autónomos', periodicity: 'trimestral' },
    { modelo: '349', description: 'Operaciones intracomunitarias 1T', deadline: `${y}-04-20`, month: 4, day: 20, who: 'operadores intracomunitarios', periodicity: 'trimestral' },
    { modelo: '100', description: 'Renta 2024 — inicio campaña', deadline: `${y}-04-02`, month: 4, day: 2, who: 'todos los contribuyentes', periodicity: 'anual' },

    // Junio — fin Renta
    { modelo: '100', description: 'Renta 2024 — fin plazo presentación', deadline: `${y}-06-30`, month: 6, day: 30, who: 'todos los contribuyentes', periodicity: 'anual' },

    // Julio — 2T + Sociedades
    { modelo: '303', description: 'IVA autoliquidación 2T', deadline: `${y}-07-20`, month: 7, day: 20, who: 'autónomos y sociedades', periodicity: 'trimestral' },
    { modelo: '111', description: 'Retenciones trabajo/profesionales 2T', deadline: `${y}-07-20`, month: 7, day: 20, who: 'retenedores', periodicity: 'trimestral' },
    { modelo: '115', description: 'Retenciones alquileres 2T', deadline: `${y}-07-20`, month: 7, day: 20, who: 'retenedores', periodicity: 'trimestral' },
    { modelo: '130', description: 'Pago fraccionado IRPF 2T', deadline: `${y}-07-20`, month: 7, day: 20, who: 'autónomos', periodicity: 'trimestral' },
    { modelo: '349', description: 'Operaciones intracomunitarias 2T', deadline: `${y}-07-20`, month: 7, day: 20, who: 'operadores intracomunitarios', periodicity: 'trimestral' },
    { modelo: '200', description: 'Impuesto sobre Sociedades', deadline: `${y}-07-25`, month: 7, day: 25, who: 'sociedades', periodicity: 'anual' },

    // Octubre — 3T
    { modelo: '303', description: 'IVA autoliquidación 3T', deadline: `${y}-10-20`, month: 10, day: 20, who: 'autónomos y sociedades', periodicity: 'trimestral' },
    { modelo: '111', description: 'Retenciones trabajo/profesionales 3T', deadline: `${y}-10-20`, month: 10, day: 20, who: 'retenedores', periodicity: 'trimestral' },
    { modelo: '115', description: 'Retenciones alquileres 3T', deadline: `${y}-10-20`, month: 10, day: 20, who: 'retenedores', periodicity: 'trimestral' },
    { modelo: '130', description: 'Pago fraccionado IRPF 3T', deadline: `${y}-10-20`, month: 10, day: 20, who: 'autónomos', periodicity: 'trimestral' },
    { modelo: '349', description: 'Operaciones intracomunitarias 3T', deadline: `${y}-10-20`, month: 10, day: 20, who: 'operadores intracomunitarios', periodicity: 'trimestral' },

    // Noviembre
    { modelo: '202', description: 'Pago fraccionado Impuesto Sociedades', deadline: `${y}-11-20`, month: 11, day: 20, who: 'sociedades', periodicity: 'anual' },

    // Diciembre
    { modelo: '036', description: 'Declaración censal — modificaciones fin de año', deadline: `${y}-12-31`, month: 12, day: 31, who: 'empresarios y profesionales', periodicity: 'anual' },
  ];
}
