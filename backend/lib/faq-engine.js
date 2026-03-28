// FAQ Engine — Smart FAQ system with auto-learning from frequent questions
// No external dependencies. Pure in-memory store with TF-IDF similarity.

const STOPWORDS = new Set([
  'de', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'que', 'en',
  'por', 'para', 'con', 'del', 'al', 'es', 'son', 'se', 'su', 'sus', 'lo',
  'como', 'pero', 'si', 'no', 'ya', 'o', 'y', 'e', 'ni', 'a', 'ante', 'bajo',
  'desde', 'entre', 'hacia', 'hasta', 'sin', 'sobre', 'tras', 'mi', 'me', 'te',
  'le', 'nos', 'les', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos',
  'esas', 'aquel', 'aquella', 'ser', 'estar', 'haber', 'tener', 'hacer', 'poder',
  'deber', 'ir', 'hay', 'tiene', 'puede', 'donde', 'cuando', 'cual', 'quien',
  'muy', 'mas', 'menos', 'todo', 'toda', 'todos', 'todas', 'otro', 'otra',
]);

const ACCENT_MAP = { a: /[áà]/g, e: /[éè]/g, i: /[íì]/g, o: /[óò]/g, u: /[úùü]/g, n: /[ñ]/g };

function normalize(text) {
  let t = text.toLowerCase();
  for (const [plain, re] of Object.entries(ACCENT_MAP)) t = t.replace(re, plain);
  t = t.replace(/[^a-z0-9\s]/g, ' ');
  return t.split(/\s+/).filter(w => w.length > 1 && !STOPWORDS.has(w));
}

function termFrequency(tokens) {
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  const len = tokens.length || 1;
  for (const t in tf) tf[t] /= len;
  return tf;
}

function cosineSimilarity(tfA, tfB, idf) {
  const allTerms = new Set([...Object.keys(tfA), ...Object.keys(tfB)]);
  let dot = 0, magA = 0, magB = 0;
  for (const term of allTerms) {
    const w = idf[term] || 1;
    const a = (tfA[term] || 0) * w;
    const b = (tfB[term] || 0) * w;
    dot += a * b;
    magA += a * a;
    magB += b * b;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ── In-memory stores ──

const faqStore = [];          // { id, serviceId, question, answer, tokens, tf, askCount, createdAt }
const questionLog = [];       // { serviceId, question, answer, timestamp }
let faqIdCounter = 0;

function computeIDF(docs) {
  const idf = {};
  const N = docs.length || 1;
  for (const doc of docs) {
    const seen = new Set(doc.tokens);
    for (const t of seen) idf[t] = (idf[t] || 0) + 1;
  }
  for (const t in idf) idf[t] = Math.log(N / idf[t]) + 1;
  return idf;
}

// ── Public API ──

export function addFAQ(serviceId, question, answer) {
  const tokens = normalize(question);
  const entry = {
    id: ++faqIdCounter,
    serviceId,
    question,
    answer,
    tokens,
    tf: termFrequency(tokens),
    askCount: 0,
    createdAt: Date.now(),
  };
  faqStore.push(entry);
  return entry;
}

export function trackQuestion(serviceId, question, answer) {
  const now = Date.now();
  questionLog.push({ serviceId, question, answer, timestamp: now });

  // Try to match to existing FAQ and bump count
  const tokens = normalize(question);
  const tf = termFrequency(tokens);
  const idf = computeIDF(faqStore);
  let bestMatch = null;
  let bestScore = 0;
  for (const faq of faqStore) {
    if (serviceId && faq.serviceId !== serviceId) continue;
    const score = cosineSimilarity(tf, faq.tf, idf);
    if (score > bestScore) { bestScore = score; bestMatch = faq; }
  }

  if (bestMatch && bestScore >= 0.65) {
    bestMatch.askCount++;
    return { matched: true, faqId: bestMatch.id, score: bestScore };
  }

  // Auto-learn: if question appears 3+ times recently (last 24h), create FAQ
  const recentWindow = now - 24 * 60 * 60 * 1000;
  const similar = questionLog.filter(q => {
    if (q.timestamp < recentWindow) return false;
    if (serviceId && q.serviceId !== serviceId) return false;
    const qTokens = normalize(q.question);
    const qTf = termFrequency(qTokens);
    return cosineSimilarity(tf, qTf, idf) >= 0.7;
  });

  if (similar.length >= 3) {
    const newFaq = addFAQ(serviceId, question, answer);
    newFaq.askCount = similar.length;
    return { matched: false, autoCreated: true, faqId: newFaq.id };
  }

  return { matched: false, autoCreated: false };
}

export function findSimilar(question, serviceId = null) {
  const tokens = normalize(question);
  const tf = termFrequency(tokens);
  const candidates = serviceId ? faqStore.filter(f => f.serviceId === serviceId) : faqStore;
  if (candidates.length === 0) return [];

  const idf = computeIDF(candidates);
  const scored = candidates.map(faq => ({
    id: faq.id,
    serviceId: faq.serviceId,
    question: faq.question,
    answer: faq.answer,
    confidence: Math.round(cosineSimilarity(tf, faq.tf, idf) * 1000) / 1000,
    askCount: faq.askCount,
  }));

  return scored
    .filter(s => s.confidence > 0.1)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

export function getTrending(limit = 10) {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const recent = questionLog.filter(q => q.timestamp >= since);
  const counts = {};
  for (const q of recent) {
    const key = normalize(q.question).sort().join(' ');
    if (!counts[key]) counts[key] = { question: q.question, serviceId: q.serviceId, count: 0 };
    counts[key].count++;
  }
  return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, limit);
}

export function getFAQStats() {
  const byService = {};
  for (const faq of faqStore) {
    byService[faq.serviceId] = (byService[faq.serviceId] || 0) + 1;
  }
  const since24h = Date.now() - 24 * 60 * 60 * 1000;
  const recentQuestions = questionLog.filter(q => q.timestamp >= since24h);
  const uniqueRecent = new Set(recentQuestions.map(q => normalize(q.question).sort().join(' ')));

  return {
    totalFAQs: faqStore.length,
    totalQuestionsTracked: questionLog.length,
    questionsLast24h: recentQuestions.length,
    uniqueQuestionsLast24h: uniqueRecent.size,
    byService,
    top10: [...faqStore].sort((a, b) => b.askCount - a.askCount).slice(0, 10).map(f => ({
      id: f.id,
      serviceId: f.serviceId,
      question: f.question,
      askCount: f.askCount,
    })),
  };
}

export function getPreseededFAQs() {
  return faqStore.filter(f => f.askCount === 0 || f.id <= 30);
}

// ── Pre-seeded FAQs ──

const PRESEEDED = [
  // Renta / IRPF
  ['renta2025', 'Cuando empieza la campana de la renta 2025', 'La campana de la Renta 2025 se inicia el 2 de abril de 2026 y finaliza el 30 de junio de 2026. Por telefono e internet esta disponible desde el 2 de abril, y de forma presencial desde el 2 de mayo previa cita.'],
  ['renta2025', 'Quien esta obligado a presentar la declaracion de la renta', 'Estan obligados quienes hayan obtenido rendimientos del trabajo superiores a 22.000 euros anuales con un solo pagador, o mas de 15.876 euros con dos o mas pagadores si el segundo supera 1.500 euros. Tambien quienes tengan rendimientos del capital mobiliario o ganancias patrimoniales sujetas a retencion superiores a 1.600 euros.'],
  ['renta2025', 'Como puedo consultar mi borrador de la renta', 'Puede acceder a su borrador a traves de la Sede Electronica de la AEAT con certificado digital, Cl@ve PIN o numero de referencia (RENNO). Tambien puede solicitarlo por telefono llamando al 901 200 345 o al 91 535 68 13.'],
  ['renta2025', 'Que deducciones puedo aplicar en la renta', 'Las principales deducciones incluyen: inversion en vivienda habitual (adquirida antes de 2013), donativos a ONG, maternidad (1.200 euros/hijo menor de 3), familia numerosa, personas con discapacidad a cargo, y deducciones autonomicas que varian segun su comunidad.'],
  ['renta2025', 'Que pasa si no presento la declaracion de la renta a tiempo', 'Si presenta fuera de plazo sin requerimiento previo, el recargo es del 1% mas un 1% adicional por cada mes de retraso. Si la AEAT le requiere, la sancion va del 50% al 150% de la cuota no ingresada, segun la gravedad.'],

  // IVA / Modelo 303
  ['modelo303', 'Cuales son los plazos para presentar el modelo 303', 'El modelo 303 se presenta trimestralmente: del 1 al 20 de abril (1T), julio (2T) y octubre (3T), y del 1 al 30 de enero (4T). La domiciliacion bancaria cierra 5 dias antes del fin de plazo.'],
  ['modelo303', 'Cuales son los tipos de IVA vigentes en Espana', 'Los tipos de IVA en Espana son: tipo general 21%, tipo reducido 10% (alimentos, transporte, hosteleria) y tipo superreducido 4% (pan, leche, frutas, verduras, libros, medicamentos). Canarias tiene IGIC en lugar de IVA con tipo general del 7%.'],
  ['modelo303', 'Que operaciones estan exentas de IVA', 'Estan exentas: servicios sanitarios, ensenanza reglada, servicios sociales, operaciones financieras y de seguros, alquiler de vivienda habitual, y operaciones de Correos. Las exenciones se regulan en los articulos 20 a 25 de la Ley 37/1992 del IVA.'],
  ['modelo303', 'Que es el IVA soportado y el IVA repercutido', 'El IVA repercutido es el que cobra usted a sus clientes en sus facturas. El IVA soportado es el que paga usted en las compras y gastos de su actividad. En el modelo 303 declara la diferencia: si repercutido > soportado, paga; si es al reves, solicita devolucion o compensa.'],

  // Autonomos
  ['autonomos', 'Como me doy de alta como autonomo', 'Debe realizar dos tramites: alta en Hacienda (modelo 036/037 censal) y alta en la Seguridad Social (RETA). El alta censal puede hacerse online en la Sede Electronica de la AEAT. El alta en RETA se tramita en la Seguridad Social o a traves de un punto PAE.'],
  ['autonomos', 'Cuanto es la cuota de autonomos actual', 'Desde 2025 la cuota de autonomos se calcula por tramos de ingresos reales. La cuota minima para rendimientos netos hasta 670 euros es de 200 euros/mes. Para rendimientos superiores a 6.000 euros/mes la cuota maxima es de 590 euros/mes. Existe tarifa plana de 80 euros/mes durante los primeros 12 meses.'],
  ['autonomos', 'Que modelos fiscales debe presentar un autonomo', 'Los principales modelos son: modelo 130 (pago fraccionado IRPF trimestral), modelo 303 (IVA trimestral), modelo 390 (resumen anual IVA), modelo 100 (declaracion de la renta anual). Si tiene empleados: modelos 111 y 190 de retenciones. Si esta en modulos: modelo 131 en lugar del 130.'],
  ['autonomos', 'Que es la tarifa plana de autonomos', 'La tarifa plana permite pagar una cuota reducida de 80 euros/mes durante los primeros 12 meses de actividad. Se puede prorrogar otros 12 meses si los rendimientos netos no superan el SMI. Es compatible con la capitalizacion del desempleo.'],
  ['autonomos', 'Que bases de cotizacion tiene un autonomo', 'Las bases de cotizacion en 2025 se determinan por tramos de rendimientos netos reales, desde una base minima de 653,59 euros/mes (tramo inferior) hasta una base maxima de 4.720,50 euros/mes (tramo superior). El autonomo elige base provisional y se regulariza al ano siguiente.'],

  // Certificados
  ['certificados', 'Como obtengo un certificado de estar al corriente con Hacienda', 'Puede solicitarlo online en la Sede Electronica de la AEAT (apartado Certificados tributarios) con certificado digital o Cl@ve. Se genera al instante si no tiene deudas pendientes. Tambien puede solicitarlo presencialmente con cita previa en cualquier oficina de la AEAT.'],
  ['certificados', 'Que es el certificado digital y como lo obtengo', 'El certificado digital es una firma electronica que le identifica en internet. Se obtiene a traves de la FNMT (Fabrica Nacional de Moneda y Timbre): solicite el certificado en su web, acuda a una oficina de registro para acreditar su identidad, y luego descarguelo. Tiene validez de 4 anos.'],

  // Calendario fiscal
  ['calendario', 'Cuales son las fechas clave del calendario fiscal 2025', 'Fechas clave 2025: Enero 1-20 (4T modelos 111, 115, 303); Enero 1-30 (mod. 390, 180, 190); Abril 1-20 (1T modelos 130, 303); Abril 2 - Junio 30 (Renta 2024); Julio 1-20 (2T); Octubre 1-20 (3T); Diciembre 22 (modelo 179). La domiciliacion cierra 5 dias antes.'],
  ['calendario', 'Cuando hay que presentar el resumen anual de IVA', 'El resumen anual de IVA (modelo 390) se presenta del 1 al 30 de enero del ano siguiente. Es obligatorio para todos los sujetos pasivos del IVA, salvo quienes esten en el SII (Suministro Inmediato de Informacion) o tributen en regimen simplificado que presenten el modelo 303 del 4T.'],

  // NIF / CIF
  ['censos', 'Como obtengo el NIF para una empresa nueva', 'Para obtener el NIF de una sociedad debe presentar el modelo 036 en la AEAT con la escritura de constitucion. Se asigna un NIF provisional que se convierte en definitivo una vez inscrita la sociedad en el Registro Mercantil. El plazo para solicitar el NIF definitivo es de 6 meses.'],
  ['censos', 'Como cambio mi domicilio fiscal', 'Debe comunicar el cambio de domicilio fiscal mediante el modelo 030 (personas fisicas) o el modelo 036/037 (empresarios y profesionales). Puede hacerlo en la Sede Electronica de la AEAT con certificado digital o Cl@ve. El plazo para comunicar el cambio es de 3 meses.'],

  // SII
  ['colaboracion', 'Que es el SII y quien esta obligado', 'El SII (Suministro Inmediato de Informacion) es un sistema de llevanza de libros de registro del IVA a traves de la Sede Electronica de la AEAT. Estan obligados: grandes empresas (facturacion > 6 millones), grupos de IVA, e inscritos en REDEME. Los demas pueden acogerse voluntariamente.'],
  ['colaboracion', 'Cuales son los plazos del SII para comunicar facturas', 'Las facturas emitidas deben comunicarse en 4 dias naturales desde la expedicion (8 dias durante el primer semestre de aplicacion). Las facturas recibidas en 4 dias desde la fecha de registro contable. Las operaciones intracomunitarias en 4 dias desde el inicio de la expedicion.'],

  // Cita previa
  ['cita', 'Como pido cita previa en la AEAT', 'Puede solicitar cita previa a traves de la Sede Electronica de la AEAT, llamando al 901 200 345 o al 91 535 68 13, o mediante la app de la AEAT. Necesitara su NIF/NIE y seleccionar el tramite, oficina y fecha disponible. Se recomienda pedir cita con antelacion suficiente.'],

  // Cl@ve
  ['clave', 'Como me registro en Clave PIN', 'Puede registrarse en Cl@ve de dos formas: online con certificado digital o DNI electronico, o presencialmente en oficinas de la AEAT, Seguridad Social u otras entidades colaboradoras con su DNI/NIE y una carta de invitacion (solicitable online). Una vez registrado, activara Cl@ve PIN o Cl@ve Permanente.'],

  // Recaudacion
  ['recaudacion', 'Puedo aplazar el pago de mis impuestos', 'Si, puede solicitar aplazamiento o fraccionamiento de deudas tributarias. Para deudas hasta 50.000 euros no necesita aportar garantias. La solicitud se presenta en la Sede Electronica con modelo 036. El interes de demora aplicable en 2025 es del 4,0625%. Se puede fraccionar hasta en 36 plazos mensuales.'],

  // IBI
  ['ibi', 'Cuando se paga el IBI y como se calcula', 'El IBI se paga anualmente, con fechas que fija cada ayuntamiento (generalmente entre septiembre y noviembre). Se calcula aplicando el tipo impositivo municipal al valor catastral del inmueble. El tipo general oscila entre el 0,4% y el 1,1% para urbanos. Puede domiciliarlo o fraccionarlo segun el ayuntamiento.'],

  // CNMC
  ['cnmc', 'Que tramites puedo realizar ante la CNMC', 'Ante la CNMC puede: notificar concentraciones economicas, presentar denuncias por practicas anticompetitivas, consultar expedientes sancionadores, solicitar informes sobre mercados regulados, y realizar tramites relacionados con telecomunicaciones y energia. Todo se gestiona a traves de sede.cnmc.gob.es.'],

  // Pago
  ['pago', 'Que formas de pago de impuestos existen', 'Puede pagar impuestos mediante: domiciliacion bancaria (al presentar la declaracion), cargo en cuenta (NRC), pago con tarjeta de credito/debito en la Sede Electronica, ingreso en entidad bancaria colaboradora con la carta de pago, y transferencia bancaria. Para deudas en ejecutiva se admite pago en metalico en el Banco de Espana.'],

  // Notificaciones
  ['notificaciones', 'Como accedo a mis notificaciones electronicas de Hacienda', 'Acceda a la Direccion Electronica Habilitada (DEH) en notificaciones.060.es o desde la Sede Electronica de la AEAT con certificado digital o Cl@ve. Tiene 10 dias naturales para abrir cada notificacion; transcurrido ese plazo se entiende notificada automaticamente.'],

  // Aduanas
  ['aduanas', 'Que documentacion necesito para importar mercancias', 'Para importar necesita: DUA (Documento Unico Administrativo), factura comercial, documento de transporte (BL, AWB o CMR), certificado de origen si aplica, y licencias o permisos especificos segun el tipo de mercancia. El despacho se realiza a traves del sistema AEAT-Aduanas con representante aduanero o directamente.'],
];

// Seed on module load
for (const [serviceId, question, answer] of PRESEEDED) {
  addFAQ(serviceId, question, answer);
}
