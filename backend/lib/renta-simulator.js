// ═══════════════════════════════════════════════════════════════
// lib/renta-simulator.js — Motor de cálculo IRPF 2025 completo
// ═══════════════════════════════════════════════════════════════
// Cálculos determinísticos (sin IA) para simulación de Renta.
// La IA se usa solo como complemento para recomendaciones.
// ═══════════════════════════════════════════════════════════════

// ─── Tramos IRPF 2025 (estatal + autonómico general) ─────────
const TRAMOS_GENERAL_ESTATAL = [
  { hasta: 12450, tipo: 0.095 },
  { hasta: 20200, tipo: 0.12 },
  { hasta: 35200, tipo: 0.15 },
  { hasta: 60000, tipo: 0.185 },
  { hasta: 300000, tipo: 0.225 },
  { hasta: Infinity, tipo: 0.245 },
];

const TRAMOS_GENERAL_AUTONOMICO = [
  { hasta: 12450, tipo: 0.095 },
  { hasta: 20200, tipo: 0.12 },
  { hasta: 35200, tipo: 0.15 },
  { hasta: 60000, tipo: 0.185 },
  { hasta: 300000, tipo: 0.225 },
  { hasta: Infinity, tipo: 0.225 },
];

// Tramos autonómicos especiales por CCAA (sustituyen TRAMOS_GENERAL_AUTONOMICO)
const TRAMOS_CCAA = {
  "andalucia": [
    { hasta: 13000, tipo: 0.095 }, { hasta: 21000, tipo: 0.12 },
    { hasta: 36200, tipo: 0.15 }, { hasta: 60000, tipo: 0.187 },
    { hasta: 120000, tipo: 0.235 }, { hasta: 300000, tipo: 0.245 },
    { hasta: Infinity, tipo: 0.26 },
  ],
  "cataluna": [
    { hasta: 12450, tipo: 0.105 }, { hasta: 17707, tipo: 0.12 },
    { hasta: 33007, tipo: 0.15 }, { hasta: 53407, tipo: 0.185 },
    { hasta: 90000, tipo: 0.213 }, { hasta: 120000, tipo: 0.235 },
    { hasta: 175000, tipo: 0.245 }, { hasta: Infinity, tipo: 0.255 },
  ],
  "madrid": [
    { hasta: 12960, tipo: 0.085 }, { hasta: 18432, tipo: 0.107 },
    { hasta: 34432, tipo: 0.137 }, { hasta: 55232, tipo: 0.177 },
    { hasta: 300000, tipo: 0.207 }, { hasta: Infinity, tipo: 0.215 },
  ],
  "valencia": [
    { hasta: 12450, tipo: 0.10 }, { hasta: 17707, tipo: 0.12 },
    { hasta: 33007, tipo: 0.15 }, { hasta: 53407, tipo: 0.185 },
    { hasta: 80000, tipo: 0.235 }, { hasta: 120000, tipo: 0.245 },
    { hasta: 175000, tipo: 0.255 }, { hasta: Infinity, tipo: 0.295 },
  ],
};

// Tramos ahorro (estatal + autonómico)
const TRAMOS_AHORRO = [
  { hasta: 6000, tipo: 0.19 },
  { hasta: 50000, tipo: 0.21 },
  { hasta: 200000, tipo: 0.23 },
  { hasta: 300000, tipo: 0.27 },
  { hasta: Infinity, tipo: 0.28 },
];

// ─── Mínimo personal y familiar ──────────────────────────────
function calcularMinimos(data) {
  let minimo = 5550; // Mínimo personal

  // Edad > 65
  if (data.edad > 65) minimo += 1150;
  if (data.edad > 75) minimo += 1400;

  // Mínimo por descendientes
  const hijos = parseInt(data.hijos) || 0;
  const minimoHijos = [0, 2400, 2700, 4000, 4500];
  for (let i = 0; i < hijos; i++) {
    minimo += minimoHijos[Math.min(i, 4)] || 4500;
    // Menores de 3 años: +2800 adicional
    if (data.hijosMenuores3 && i < (parseInt(data.hijosMenuores3) || 0)) {
      minimo += 2800;
    }
  }

  // Discapacidad
  if (data.discapacidad >= 33 && data.discapacidad < 65) minimo += 3000;
  if (data.discapacidad >= 65) minimo += 12000;

  // Ascendientes > 65 que conviven
  if (data.ascendientes > 0) {
    for (let i = 0; i < data.ascendientes; i++) {
      minimo += 1150;
    }
  }

  return minimo;
}

// ─── Cálculo por tramos ──────────────────────────────────────
function calcularPorTramos(base, tramos) {
  let cuota = 0;
  let restante = Math.max(base, 0);
  let prev = 0;

  const detalle = [];
  for (const t of tramos) {
    const enTramo = Math.min(restante, t.hasta - prev);
    if (enTramo <= 0) break;
    const cuotaTramo = enTramo * t.tipo;
    cuota += cuotaTramo;
    detalle.push({
      desde: prev,
      hasta: Math.min(t.hasta, prev + enTramo),
      tipo: t.tipo * 100,
      cuota: cuotaTramo,
    });
    restante -= enTramo;
    prev = t.hasta;
    if (restante <= 0) break;
  }

  return { cuota, detalle };
}

// ─── Rendimientos del capital mobiliario ──────────────────────
function calcularCapitalMobiliario(data) {
  const dividendos = parseFloat(data.dividendos) || 0;
  const intereses = parseFloat(data.intereses) || 0;
  const otrosCapitalMob = parseFloat(data.otrosCapitalMobiliario) || 0;
  const gastosDeducibles = parseFloat(data.gastosAdminCustodia) || 0;

  const rendimientoNeto = dividendos + intereses + otrosCapitalMob - gastosDeducibles;

  const casillas = [
    { casilla: "0029", concepto: "Dividendos y participaciones", valor: dividendos },
    { casilla: "0023", concepto: "Intereses cuentas y depósitos", valor: intereses },
    { casilla: "0032", concepto: "Otros rendimientos capital mobiliario", valor: otrosCapitalMob },
    { casilla: "0040", concepto: "Gastos deducibles capital mobiliario", valor: gastosDeducibles },
    { casilla: "0041", concepto: "Rendimiento neto capital mobiliario", valor: rendimientoNeto },
  ].filter(c => c.valor !== 0);

  return { rendimiento: rendimientoNeto, casillas };
}

// ─── Ganancias y pérdidas patrimoniales ──────────────────────
function calcularGananciasPatrimoniales(data) {
  const operaciones = data.gananciaPatrimonial || [];
  let totalGananciaAhorro = 0;
  let totalPerdidaAhorro = 0;
  let totalGananciaGeneral = 0;
  let totalPerdidaGeneral = 0;
  const detalle = [];

  for (const op of operaciones) {
    const tipo = op.tipo; // "acciones", "inmueble", "fondos", "criptomonedas", "otros"
    const valorVenta = parseFloat(op.valorVenta) || 0;
    const valorAdquisicion = parseFloat(op.valorAdquisicion) || 0;
    const gastosVenta = parseFloat(op.gastosVenta) || 0;
    const gastosAdquisicion = parseFloat(op.gastosAdquisicion) || 0;

    let ganancia = valorVenta - valorAdquisicion - gastosVenta - gastosAdquisicion;

    // Coeficientes de actualización para inmuebles adquiridos antes de 1995
    if (tipo === "inmueble" && op.fechaAdquisicion) {
      const year = parseInt(op.fechaAdquisicion.slice(0, 4));
      if (year < 2015) {
        // Aplicar reducción transitoria por antigüedad (simplificado)
        const anosTranscurridos = Math.min(2015 - year, 20);
        const reduccion = Math.min(ganancia * 0.1142 * anosTranscurridos, ganancia);
        ganancia -= reduccion;
      }
    }

    // Acciones, fondos, cripto → base del ahorro
    // Inmueble con más de 1 año → base del ahorro
    const periodoTenencia = op.periodoTenenciaMeses || 13; // >12 meses → ahorro
    const esAhorro = ["acciones", "fondos", "criptomonedas"].includes(tipo) ||
      (tipo === "inmueble" && periodoTenencia > 12);

    if (ganancia >= 0) {
      if (esAhorro) totalGananciaAhorro += ganancia;
      else totalGananciaGeneral += ganancia;
    } else {
      if (esAhorro) totalPerdidaAhorro += Math.abs(ganancia);
      else totalPerdidaGeneral += Math.abs(ganancia);
    }

    detalle.push({
      tipo,
      descripcion: op.descripcion || tipo,
      valorVenta,
      valorAdquisicion,
      ganancia,
      baseIntegracion: esAhorro ? "ahorro" : "general",
    });
  }

  // Compensación pérdidas con ganancias (base ahorro)
  let saldoAhorro = totalGananciaAhorro - totalPerdidaAhorro;
  // Compensación pérdidas con rendimientos capital mobiliario (hasta 25%)
  let compensacionConRendimientos = 0;
  if (saldoAhorro < 0 && data._rendimientoCapitalMob > 0) {
    compensacionConRendimientos = Math.min(Math.abs(saldoAhorro), data._rendimientoCapitalMob * 0.25);
    saldoAhorro += compensacionConRendimientos;
  }

  const casillas = [
    { casilla: "0420", concepto: "Ganancias patrimoniales (ahorro)", valor: totalGananciaAhorro },
    { casilla: "0424", concepto: "Pérdidas patrimoniales (ahorro)", valor: -totalPerdidaAhorro },
    { casilla: "0428", concepto: "Saldo neto ganancias/pérdidas ahorro", valor: saldoAhorro },
    { casilla: "0300", concepto: "Ganancias patrimoniales (general)", valor: totalGananciaGeneral },
    { casilla: "0304", concepto: "Pérdidas patrimoniales (general)", valor: -totalPerdidaGeneral },
  ].filter(c => c.valor !== 0);

  return {
    gananciaAhorro: Math.max(saldoAhorro, 0),
    perdidaAhorroPendiente: saldoAhorro < 0 ? Math.abs(saldoAhorro) : 0,
    gananciaGeneral: Math.max(totalGananciaGeneral - totalPerdidaGeneral, 0),
    compensacionConRendimientos,
    detalle,
    casillas,
  };
}

// ─── Imputación de rentas inmobiliarias ──────────────────────
function calcularImputacionInmobiliaria(data) {
  const inmuebles = data.inmueblesNoHabituales || [];
  let totalImputacion = 0;
  const detalle = [];

  for (const inm of inmuebles) {
    const valorCatastral = parseFloat(inm.valorCatastral) || 0;
    // 2% del valor catastral (1.1% si fue revisado después de 1994)
    const porcentaje = inm.catastroRevisado ? 0.011 : 0.02;
    // Proporcional a los días no alquilado
    const diasNoAlquilado = parseInt(inm.diasNoAlquilado) || 365;
    const imputacion = valorCatastral * porcentaje * (diasNoAlquilado / 365);

    totalImputacion += imputacion;
    detalle.push({
      referenciaCatastral: inm.referenciaCatastral || "Sin ref.",
      valorCatastral,
      porcentaje: porcentaje * 100,
      diasNoAlquilado,
      imputacion,
    });
  }

  return {
    totalImputacion,
    detalle,
    casillas: totalImputacion > 0 ? [
      { casilla: "0090", concepto: "Imputación rentas inmobiliarias", valor: totalImputacion },
    ] : [],
  };
}

// ─── Estimación directa simplificada (autónomos) ─────────────
function calcularEstimacionDirectaSimplificada(data) {
  if (!data.autonomo) return { rendimiento: 0, casillas: [] };

  const ingresos = parseFloat(data.ingresoActividad) || 0;
  const gastos = parseFloat(data.gastosActividad) || 0;
  const amortizacion = parseFloat(data.amortizacion) || 0;
  const segurosActividad = parseFloat(data.segurosActividad) || 0;
  const suministros = parseFloat(data.suministros) || 0; // % deducible si trabaja en casa

  // Gastos de difícil justificación: 7% del rendimiento neto (máx 2.000€)
  const rendimientoPrevio = ingresos - gastos - amortizacion - segurosActividad - suministros;
  const dificilJustificacion = Math.min(rendimientoPrevio * 0.07, 2000);

  const rendimientoNeto = rendimientoPrevio - dificilJustificacion;

  // Reducciones
  let reduccion = 0;
  let conceptoReduccion = null;

  // Reducción por inicio de actividad (primer año + siguiente): 20% del rendimiento neto
  if (data.inicioActividad) {
    reduccion = rendimientoNeto * 0.20;
    conceptoReduccion = "Reducción inicio actividad económica (20%)";
  }

  // Reducción rendimientos <14.450€ si cumple requisitos
  if (rendimientoNeto < 14450 && !data.otrasFuentesRenta) {
    const reduccion2 = rendimientoNeto < 11250 ? 3700 :
      3700 - (rendimientoNeto - 11250) * 1.15625;
    if (reduccion2 > reduccion) {
      reduccion = Math.max(reduccion2, 0);
      conceptoReduccion = "Reducción rendimientos actividades económicas";
    }
  }

  const rendimientoFinal = Math.max(rendimientoNeto - reduccion, 0);

  const casillas = [
    { casilla: "0109", concepto: "Ingresos íntegros actividad económica", valor: ingresos },
    { casilla: "0110", concepto: "Gastos deducibles", valor: gastos },
    { casilla: "0111", concepto: "Amortizaciones", valor: amortizacion },
    { casilla: "0112", concepto: "Provisiones y gastos difícil justificación (7%)", valor: dificilJustificacion },
    { casilla: "0133", concepto: "Rendimiento neto actividad económica", valor: rendimientoFinal },
  ].filter(c => c.valor !== 0);

  if (reduccion > 0) {
    casillas.push({ casilla: "0134", concepto: conceptoReduccion, valor: reduccion });
  }

  return {
    rendimiento: rendimientoFinal,
    dificilJustificacion,
    reduccion,
    conceptoReduccion,
    casillas,
    detalle: {
      ingresos, gastos, amortizacion, segurosActividad, suministros,
      rendimientoPrevio, dificilJustificacion, rendimientoNeto, reduccion, rendimientoFinal,
    },
  };
}

// ─── No residentes (IRNR simplificado) ───────────────────────
function calcularNoResidente(data) {
  // Tipo fijo para no residentes UE/EEE: 19%
  // No residentes fuera UE: 24%
  const esUE = data.paisResidencia && [
    "alemania", "francia", "italia", "portugal", "belgica", "holanda", "austria",
    "irlanda", "luxemburgo", "finlandia", "grecia", "suecia", "dinamarca",
    "polonia", "republica checa", "eslovaquia", "hungria", "rumania", "bulgaria",
    "croacia", "eslovenia", "estonia", "letonia", "lituania", "chipre", "malta",
    "islandia", "noruega", "liechtenstein",
  ].includes(data.paisResidencia.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

  const tipoGeneral = esUE ? 0.19 : 0.24;

  const salario = parseFloat(data.rendimientosTrabajo) || 0;
  const dividendos = parseFloat(data.dividendos) || 0;
  const intereses = parseFloat(data.intereses) || 0;
  const alquileres = parseFloat(data.rendimientosInmuebles) || 0;
  const ganancias = parseFloat(data.gananciasBruta) || 0;

  // Tipos específicos
  const cuotaTrabajo = salario * tipoGeneral;
  const cuotaDividendos = dividendos * 0.19; // Siempre 19% (convenio)
  const cuotaIntereses = intereses * 0.19;
  const cuotaAlquileres = alquileres * (esUE ? 0.19 : 0.24);
  const cuotaGanancias = ganancias * 0.19; // Ganancias: tramos ahorro para UE, 19% simplificado

  const cuotaTotal = cuotaTrabajo + cuotaDividendos + cuotaIntereses + cuotaAlquileres + cuotaGanancias;
  const retenciones = parseFloat(data.retencionesIRPF) || 0;

  return {
    esUE,
    tipoGeneral: tipoGeneral * 100,
    rentas: [
      { concepto: "Rendimientos del trabajo", base: salario, tipo: tipoGeneral * 100, cuota: cuotaTrabajo },
      { concepto: "Dividendos", base: dividendos, tipo: 19, cuota: cuotaDividendos },
      { concepto: "Intereses", base: intereses, tipo: 19, cuota: cuotaIntereses },
      { concepto: "Rendimientos inmobiliarios", base: alquileres, tipo: (esUE ? 19 : 24), cuota: cuotaAlquileres },
      { concepto: "Ganancias patrimoniales", base: ganancias, tipo: 19, cuota: cuotaGanancias },
    ].filter(r => r.base > 0),
    cuotaTotal,
    retenciones,
    resultado: retenciones >= cuotaTotal ? "a_devolver" : "a_ingresar",
    importeResultado: Math.abs(retenciones - cuotaTotal),
    modelo: "Modelo 210 (IRNR)",
    casillas: [
      { casilla: "210-01", concepto: "Base imponible", valor: salario + dividendos + intereses + alquileres + ganancias },
      { casilla: "210-02", concepto: "Cuota íntegra", valor: cuotaTotal },
      { casilla: "210-03", concepto: "Retenciones", valor: retenciones },
    ],
  };
}

// ─── Deducciones autonómicas completas ────────────────────────
const DEDUCCIONES_CCAA = {
  "andalucia": (data) => {
    const deds = [];
    if (data.alquiler) deds.push({ concepto: "Alquiler vivienda habitual", importe: Math.min(parseFloat(data.importeAlquiler) || 500, 500) });
    if (data.hijos > 0) deds.push({ concepto: "Nacimiento/adopción", importe: 200 * data.hijos });
    if (data.familiaNumerosa) deds.push({ concepto: "Familia numerosa", importe: data.familiaNumCategoria === "especial" ? 400 : 200 });
    if (data.discapacidad >= 33) deds.push({ concepto: "Discapacidad", importe: data.discapacidad >= 65 ? 300 : 100 });
    if (data.viviendaProtegida) deds.push({ concepto: "Inversión vivienda protegida", importe: Math.min((parseFloat(data.inversionVivienda) || 0) * 0.02, 9040 * 0.02) });
    if (data.donativos > 0) deds.push({ concepto: "Donativos a fundaciones andaluzas", importe: Math.min(parseFloat(data.donativos) * 0.25, 150) });
    return deds;
  },
  "aragon": (data) => {
    const deds = [];
    if (data.hijos > 0) {
      const importes = [500, 600, 700];
      for (let i = 0; i < Math.min(data.hijos, 3); i++) deds.push({ concepto: `Nacimiento/adopción (hijo ${i + 1})`, importe: importes[Math.min(i, 2)] });
    }
    if (data.alquiler && data.edad < 35) deds.push({ concepto: "Alquiler jóvenes (<35)", importe: Math.min((parseFloat(data.importeAlquiler) || 0) * 0.10, 300) });
    if (data.gastosGuarderia > 0) deds.push({ concepto: "Gastos guardería", importe: Math.min(parseFloat(data.gastosGuarderia) * 0.15, 250) });
    if (data.librosTexto > 0) deds.push({ concepto: "Libros de texto", importe: Math.min(parseFloat(data.librosTexto), 100) });
    return deds;
  },
  "asturias": (data) => {
    const deds = [];
    if (data.alquiler) deds.push({ concepto: "Alquiler vivienda habitual", importe: Math.min((parseFloat(data.importeAlquiler) || 0) * 0.10, 455) });
    if (data.acogimientoFamiliar) deds.push({ concepto: "Acogimiento familiar no remunerado", importe: 253 });
    if (data.partoMultiple) deds.push({ concepto: "Parto múltiple", importe: 505 });
    if (data.familiaMonoparental) deds.push({ concepto: "Familia monoparental", importe: 303 });
    return deds;
  },
  "baleares": (data) => {
    const deds = [];
    if (data.librosTexto > 0) deds.push({ concepto: "Libros de texto", importe: Math.min(200 * (data.hijos || 1), 400) });
    if (data.alquiler && data.edad < 36) deds.push({ concepto: "Alquiler jóvenes", importe: Math.min((parseFloat(data.importeAlquiler) || 0) * 0.15, 400) });
    if (data.mejoraSostenibilidad > 0) deds.push({ concepto: "Mejora sostenibilidad vivienda", importe: Math.min(parseFloat(data.mejoraSostenibilidad), 10000) });
    return deds;
  },
  "canarias": (data) => {
    const deds = [];
    if (data.hijos > 0) deds.push({ concepto: "Nacimiento/adopción", importe: 200 * data.hijos });
    if (data.gastosEstudios > 0) deds.push({ concepto: "Gastos estudios", importe: Math.min(parseFloat(data.gastosEstudios), 1500) });
    if (data.alquiler) deds.push({ concepto: "Alquiler vivienda", importe: Math.min((parseFloat(data.importeAlquiler) || 0) * 0.15, 500) });
    if (data.familiaNumerosa) deds.push({ concepto: "Familia numerosa", importe: data.familiaNumCategoria === "especial" ? 500 : 200 });
    if (data.donativosCultura > 0) deds.push({ concepto: "Donaciones culturales", importe: Math.min(parseFloat(data.donativosCultura) * 0.20, 150) });
    return deds;
  },
  "cantabria": (data) => {
    const deds = [];
    if (data.alquiler && data.edad < 35) deds.push({ concepto: "Alquiler jóvenes (<35)", importe: Math.min((parseFloat(data.importeAlquiler) || 0) * 0.10, 300) });
    if (data.gastosGuarderia > 0) deds.push({ concepto: "Guardería", importe: Math.min(parseFloat(data.gastosGuarderia) * 0.15, 300) });
    if (data.gastosEnfermedad > 0) deds.push({ concepto: "Gastos enfermedad", importe: Math.min(parseFloat(data.gastosEnfermedad) * 0.10, 500) });
    if (data.familiaNumerosa) deds.push({ concepto: "Familia numerosa", importe: data.familiaNumCategoria === "especial" ? 600 : 300 });
    return deds;
  },
  "castilla-mancha": (data) => {
    const deds = [];
    if (data.hijos > 0) {
      const importes = [100, 500, 900];
      deds.push({ concepto: "Nacimiento/adopción", importe: importes[Math.min(data.hijos - 1, 2)] });
    }
    if (data.discapacidad >= 33) deds.push({ concepto: "Discapacidad", importe: 300 });
    if (data.alquiler && data.edad < 36) deds.push({ concepto: "Alquiler jóvenes", importe: Math.min((parseFloat(data.importeAlquiler) || 0) * 0.15, 450) });
    return deds;
  },
  "castilla-leon": (data) => {
    const deds = [];
    if (data.familiaNumerosa) deds.push({ concepto: "Familia numerosa", importe: data.familiaNumCategoria === "especial" ? 610 : 246 });
    if (data.hijos > 0) {
      const importes = [710, 1065, 1775];
      deds.push({ concepto: "Nacimiento/adopción", importe: importes[Math.min(data.hijos - 1, 2)] });
    }
    if (data.hijosMenuores3 > 0) deds.push({ concepto: "Cuidado hijos <4 años", importe: Math.min(1320, 440 * data.hijosMenuores3) });
    if (data.alquiler && data.edad < 36) deds.push({ concepto: "Alquiler jóvenes", importe: Math.min((parseFloat(data.importeAlquiler) || 0) * 0.20, 459) });
    return deds;
  },
  "cataluna": (data) => {
    const deds = [];
    if (data.hijos > 0) deds.push({ concepto: "Nacimiento/adopción", importe: 150 * data.hijos });
    if (data.alquiler) deds.push({ concepto: "Alquiler vivienda habitual", importe: Math.min((parseFloat(data.importeAlquiler) || 0) * 0.10, 300) });
    if (data.inversionEmpresa > 0) deds.push({ concepto: "Inversión empresa nueva", importe: Math.min(parseFloat(data.inversionEmpresa) * 0.30, 6000) });
    if (data.donativos > 0) deds.push({ concepto: "Donativos entidades catalanas", importe: Math.min(parseFloat(data.donativos) * 0.15, 500) });
    return deds;
  },
  "extremadura": (data) => {
    const deds = [];
    if (data.viviendaJoven && data.edad < 36) deds.push({ concepto: "Adquisición vivienda jóvenes", importe: Math.min((parseFloat(data.inversionVivienda) || 0) * 0.03, 1000) });
    if (data.alquiler && data.edad < 36) deds.push({ concepto: "Alquiler jóvenes", importe: Math.min((parseFloat(data.importeAlquiler) || 0) * 0.10, 300) });
    if (data.rendimientosTrabajo > 0) deds.push({ concepto: "Trabajo dependiente", importe: 75 });
    if (data.partoMultiple) deds.push({ concepto: "Parto múltiple", importe: 300 * (data.hijos || 1) });
    return deds;
  },
  "galicia": (data) => {
    const deds = [];
    if (data.hijos > 0) {
      const importes = [300, 360, 1200];
      deds.push({ concepto: "Nacimiento/adopción", importe: importes[Math.min(data.hijos - 1, 2)] });
    }
    if (data.familiaNumerosa) deds.push({ concepto: "Familia numerosa", importe: data.familiaNumCategoria === "especial" ? 400 : 250 });
    if (data.alquiler && data.edad < 36) deds.push({ concepto: "Alquiler jóvenes", importe: Math.min((parseFloat(data.importeAlquiler) || 0) * 0.10, 300) });
    if (data.gastosGuarderia > 0) deds.push({ concepto: "Gastos guardería", importe: Math.min(parseFloat(data.gastosGuarderia) * 0.30, 400) });
    return deds;
  },
  "madrid": (data) => {
    const deds = [];
    if (data.hijos > 0) {
      const importes = [600, 750, 900];
      for (let i = 0; i < Math.min(data.hijos, 3); i++) deds.push({ concepto: `Nacimiento/adopción (hijo ${i + 1})`, importe: importes[Math.min(i, 2)] });
    }
    if (data.acogimientoFamiliar) deds.push({ concepto: "Acogimiento familiar", importe: 600 });
    if (data.gastosEducativos > 0) {
      const escolaridad = (parseFloat(data.gastosEscolaridad) || 0) * 0.05;
      const idiomas = (parseFloat(data.gastosIdiomas) || 0) * 0.10;
      const uniformes = (parseFloat(data.gastosUniformes) || 0) * 0.15;
      deds.push({ concepto: "Gastos educativos", importe: Math.min(escolaridad + idiomas + uniformes, 1000) });
    }
    if (data.alquiler && data.edad < 35) deds.push({ concepto: "Alquiler (<35 años)", importe: Math.min((parseFloat(data.importeAlquiler) || 0) * 0.30, 1000) });
    return deds;
  },
  "murcia": (data) => {
    const deds = [];
    if (data.gastosGuarderia > 0) deds.push({ concepto: "Gastos guardería", importe: Math.min(parseFloat(data.gastosGuarderia) * 0.15, 330) });
    if (data.viviendaJoven && data.edad < 35) deds.push({ concepto: "Inversión vivienda jóvenes", importe: Math.min((parseFloat(data.inversionVivienda) || 0) * 0.05, 300) });
    if (data.familiaNumerosa) deds.push({ concepto: "Familia numerosa", importe: data.familiaNumCategoria === "especial" ? 400 : 200 });
    return deds;
  },
  "rioja": (data) => {
    const deds = [];
    if (data.hijos > 0) {
      const importes = [150, 175, 200];
      deds.push({ concepto: "Nacimiento/adopción", importe: importes[Math.min(data.hijos - 1, 2)] * data.hijos });
    }
    if (data.gastosGuarderia > 0) deds.push({ concepto: "Escuela infantil 0-3", importe: Math.min(parseFloat(data.gastosGuarderia) * 0.30, 600) });
    if (data.viviendaJoven && data.edad < 36) deds.push({ concepto: "Inversión vivienda nueva jóvenes", importe: Math.min((parseFloat(data.inversionVivienda) || 0) * 0.05, 450) });
    return deds;
  },
  "valencia": (data) => {
    const deds = [];
    if (data.hijos > 0) {
      const importes = [270, 550, 800];
      for (let i = 0; i < Math.min(data.hijos, 3); i++) deds.push({ concepto: `Nacimiento/adopción (hijo ${i + 1})`, importe: importes[Math.min(i, 2)] });
    }
    if (data.familiaNumerosa) deds.push({ concepto: "Familia numerosa", importe: data.familiaNumCategoria === "especial" ? 600 : 300 });
    if (data.alquiler) deds.push({ concepto: "Alquiler vivienda", importe: Math.min((parseFloat(data.importeAlquiler) || 0) * 0.15, 550) });
    if (data.gastosGuarderia > 0) deds.push({ concepto: "Gastos guardería", importe: Math.min(parseFloat(data.gastosGuarderia) * 0.15, 270) });
    if (data.discapacidad >= 33) deds.push({ concepto: "Discapacidad", importe: data.discapacidad >= 65 ? 418 : 179 });
    if (data.materialEscolar) deds.push({ concepto: "Material escolar", importe: 100 * (data.hijos || 1) });
    return deds;
  },
  "pais-vasco": (data) => {
    const deds = [];
    // Régimen foral — deducciones simplificadas
    if (data.alquiler) deds.push({ concepto: "Alquiler vivienda habitual (foral)", importe: Math.min((parseFloat(data.importeAlquiler) || 0) * 0.20, 1600) });
    if (data.hijos > 0) deds.push({ concepto: "Descendientes (foral)", importe: 600 * data.hijos });
    if (data.planPensiones > 0) deds.push({ concepto: "Aportaciones planes pensiones (foral)", importe: Math.min(parseFloat(data.planPensiones) * 0.20, 1200) });
    return deds;
  },
  "navarra": (data) => {
    const deds = [];
    // Régimen foral
    if (data.alquiler) deds.push({ concepto: "Alquiler vivienda (foral)", importe: Math.min((parseFloat(data.importeAlquiler) || 0) * 0.15, 1200) });
    if (data.hijos > 0) deds.push({ concepto: "Hijos (foral)", importe: 500 * data.hijos });
    if (data.actividadesCulturales > 0) deds.push({ concepto: "Actividades culturales (foral)", importe: Math.min(parseFloat(data.actividadesCulturales) * 0.15, 200) });
    return deds;
  },
  "ceuta": (data) => {
    const deds = [];
    // Deducción especial Ceuta: 60% de la parte de cuota proporcional a rentas en Ceuta
    deds.push({ concepto: "Bonificación residentes Ceuta (60%)", importe: 0 }); // Calculada sobre cuota
    return deds;
  },
  "melilla": (data) => {
    const deds = [];
    deds.push({ concepto: "Bonificación residentes Melilla (60%)", importe: 0 });
    return deds;
  },
};

// ═══════════════════════════════════════════════════════════════
// SIMULACIÓN PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export function simularRenta(data) {
  // Normalizar datos
  const d = {
    ...data,
    hijos: parseInt(data.hijos) || 0,
    hijosMenuores3: parseInt(data.hijosMenuores3) || 0,
    edad: parseInt(data.edad) || 35,
    discapacidad: parseInt(data.discapacidad) || 0,
    ascendientes: parseInt(data.ascendientes) || 0,
    familiaNumerosa: data.familiaNumerosa || false,
    familiaNumCategoria: data.familiaNumCategoria || "general",
  };

  // ─── No residentes: cálculo especial ────────────────────────
  if (d.noResidente) {
    return {
      tipo: "no_residente",
      ...calcularNoResidente(d),
    };
  }

  // ─── 1. Rendimientos del trabajo ────────────────────────────
  const salario = parseFloat(d.rendimientosTrabajo) || 0;
  const ss = parseFloat(d.seguridadSocial) || 0;
  const otrosRendTrabajo = parseFloat(d.otrosRendimientos) || 0;
  const gastosTrabajo = 2000; // Gasto deducible fijo
  const rendimientoTrabajo = Math.max(salario + otrosRendTrabajo - ss - gastosTrabajo, 0);

  // Reducción por rendimientos del trabajo (< 21.000€ brutos)
  let reduccionTrabajo = 0;
  if (salario <= 14852) reduccionTrabajo = 6498;
  else if (salario <= 17673.52) reduccionTrabajo = 6498 - 1.14 * (salario - 14852);
  else reduccionTrabajo = 0;
  reduccionTrabajo = Math.max(reduccionTrabajo, 0);

  // ─── 2. Capital mobiliario ──────────────────────────────────
  const capitalMob = calcularCapitalMobiliario(d);

  // ─── 3. Ganancias patrimoniales ─────────────────────────────
  d._rendimientoCapitalMob = capitalMob.rendimiento;
  const ganancias = calcularGananciasPatrimoniales(d);

  // ─── 4. Imputación inmobiliaria ─────────────────────────────
  const imputacion = calcularImputacionInmobiliaria(d);

  // ─── 5. Actividades económicas (autónomos) ──────────────────
  const actividad = calcularEstimacionDirectaSimplificada(d);

  // ─── 6. Base Imponible General ──────────────────────────────
  const baseGeneral = rendimientoTrabajo - reduccionTrabajo +
    imputacion.totalImputacion +
    actividad.rendimiento +
    ganancias.gananciaGeneral;

  // ─── 7. Base Imponible del Ahorro ───────────────────────────
  const baseAhorro = Math.max(capitalMob.rendimiento, 0) + ganancias.gananciaAhorro;

  // ─── 8. Reducciones ─────────────────────────────────────────
  const pensiones = Math.min(parseFloat(d.planPensiones) || 0, 1500);
  const totalReducciones = pensiones;

  // ─── 9. Base liquidable ─────────────────────────────────────
  const baseLiquidableGeneral = Math.max(baseGeneral - totalReducciones, 0);
  const baseLiquidableAhorro = Math.max(baseAhorro, 0);

  // ─── 10. Mínimo personal y familiar ─────────────────────────
  const minimos = calcularMinimos(d);

  // ─── 11. Cuota estatal ──────────────────────────────────────
  const cuotaEstatalGeneral = calcularPorTramos(baseLiquidableGeneral, TRAMOS_GENERAL_ESTATAL);
  const cuotaEstatalMinimos = calcularPorTramos(minimos, TRAMOS_GENERAL_ESTATAL);
  const cuotaEstatalAhorro = calcularPorTramos(baseLiquidableAhorro, TRAMOS_AHORRO);

  // ─── 12. Cuota autonómica ──────────────────────────────────
  const tramosAut = TRAMOS_CCAA[d.comunidadAutonoma] || TRAMOS_GENERAL_AUTONOMICO;
  const cuotaAutGeneral = calcularPorTramos(baseLiquidableGeneral, tramosAut);
  const cuotaAutMinimos = calcularPorTramos(minimos, tramosAut);
  const cuotaAutAhorro = calcularPorTramos(baseLiquidableAhorro, TRAMOS_AHORRO);

  // ─── 13. Cuota íntegra ─────────────────────────────────────
  const cuotaIntegra =
    Math.max(cuotaEstatalGeneral.cuota - cuotaEstatalMinimos.cuota, 0) +
    cuotaEstatalAhorro.cuota / 2 +
    Math.max(cuotaAutGeneral.cuota - cuotaAutMinimos.cuota, 0) +
    cuotaAutAhorro.cuota / 2;

  // ─── 14. Deducciones estatales ──────────────────────────────
  const deducciones = [];
  const donativos = parseFloat(d.donativos) || 0;
  if (donativos > 0) {
    const primeros150 = Math.min(donativos, 150) * 0.80;
    const resto = Math.max(donativos - 150, 0) * 0.40;
    deducciones.push({ concepto: "Donativos y liberalidades", casilla: "0723", importe: primeros150 + resto });
  }
  if (d.hipoteca) {
    const hipotecaImporte = Math.min(parseFloat(d.importeHipoteca) || 9040, 9040) * 0.15;
    deducciones.push({ concepto: "Deducción vivienda habitual (transitoria)", casilla: "0547", importe: hipotecaImporte });
  }
  if (d.maternidad) {
    deducciones.push({ concepto: "Deducción por maternidad", casilla: "0611", importe: 1200 });
  }
  if (d.familiaNumerosa) {
    deducciones.push({ concepto: "Familia numerosa", casilla: "0660", importe: d.familiaNumCategoria === "especial" ? 2400 : 1200 });
  }

  const totalDeducciones = deducciones.reduce((sum, d) => sum + d.importe, 0);

  // ─── 15. Deducciones autonómicas ────────────────────────────
  let deduccionesAutonomicas = [];
  if (d.comunidadAutonoma && DEDUCCIONES_CCAA[d.comunidadAutonoma]) {
    deduccionesAutonomicas = DEDUCCIONES_CCAA[d.comunidadAutonoma](d)
      .filter(dd => dd.importe > 0)
      .map(dd => ({ ...dd, ccaa: d.comunidadAutonoma }));
  }
  const totalDedsAutonomicas = deduccionesAutonomicas.reduce((sum, dd) => sum + dd.importe, 0);

  // ─── 16. Cuota líquida ──────────────────────────────────────
  const cuotaLiquida = Math.max(cuotaIntegra - totalDeducciones - totalDedsAutonomicas, 0);

  // ─── 17. Retenciones ────────────────────────────────────────
  const retenciones = (parseFloat(d.retencionesIRPF) || 0) +
    (parseFloat(d.retencionesCapital) || 0) +
    (parseFloat(d.pagosACuenta) || 0);

  // ─── 18. Cuota diferencial ──────────────────────────────────
  const cuotaDiferencial = cuotaLiquida - retenciones;

  // ─── 19. Resultado ──────────────────────────────────────────
  const resultado = cuotaDiferencial <= 0 ? "a_devolver" : "a_ingresar";

  // ─── Casillas relevantes ────────────────────────────────────
  const casillasRelevantes = [
    { casilla: "0001", concepto: "Rendimientos íntegros del trabajo", valor: salario },
    { casilla: "0012", concepto: "Cotizaciones Seguridad Social", valor: ss },
    { casilla: "0020", concepto: "Rendimiento neto del trabajo", valor: rendimientoTrabajo },
    ...capitalMob.casillas,
    ...ganancias.casillas,
    ...imputacion.casillas,
    ...actividad.casillas,
    { casilla: "0435", concepto: "Base imponible general", valor: baseGeneral },
    { casilla: "0460", concepto: "Base imponible del ahorro", valor: baseAhorro },
    { casilla: "0500", concepto: "Reducciones (plan pensiones)", valor: pensiones },
    { casilla: "0505", concepto: "Base liquidable general", valor: baseLiquidableGeneral },
    { casilla: "0510", concepto: "Base liquidable del ahorro", valor: baseLiquidableAhorro },
    { casilla: "0520", concepto: "Mínimo personal y familiar", valor: minimos },
    { casilla: "0560", concepto: "Cuota íntegra", valor: cuotaIntegra },
    { casilla: "0570", concepto: "Deducciones estatales", valor: totalDeducciones },
    { casilla: "0575", concepto: "Deducciones autonómicas", valor: totalDedsAutonomicas },
    { casilla: "0595", concepto: "Cuota líquida total", valor: cuotaLiquida },
    { casilla: "0596", concepto: "Retenciones e ingresos a cuenta", valor: retenciones },
    { casilla: "0610", concepto: "Cuota diferencial", valor: cuotaDiferencial },
  ].filter(c => c.valor !== 0);

  // ─── Recomendaciones ────────────────────────────────────────
  const recomendaciones = [];
  if (donativos === 0) recomendaciones.push("Considere donativos a ONGs: primeros 150€ deducen al 80%, el resto al 40%.");
  if (!d.planPensiones) recomendaciones.push("Aportaciones a planes de pensiones reducen la base imponible hasta 1.500€/año.");
  if (!d.comunidadAutonoma) recomendaciones.push("Seleccione su Comunidad Autónoma para aplicar deducciones autonómicas y tramos específicos.");
  if (d.comunidadAutonoma && totalDedsAutonomicas > 0) recomendaciones.push(`Deducciones autonómicas aplicadas: ${totalDedsAutonomicas.toFixed(2)}€.`);
  if (actividad.reduccion > 0) recomendaciones.push(`Reducción autónomo aplicada: ${actividad.conceptoReduccion} (${actividad.reduccion.toFixed(2)}€).`);
  if (ganancias.perdidaAhorroPendiente > 0) recomendaciones.push(`Pérdidas patrimoniales pendientes de compensar: ${ganancias.perdidaAhorroPendiente.toFixed(2)}€ (compensable en 4 años).`);
  if (imputacion.totalImputacion > 0) recomendaciones.push(`Imputación rentas inmobiliarias: ${imputacion.totalImputacion.toFixed(2)}€ (inmuebles no alquilados ni vivienda habitual).`);
  if (d.estadoCivil === "casado" && !d._esComparativa) recomendaciones.push("Compare declaración individual vs conjunta para ver cuál es más favorable.");
  recomendaciones.push("Esta es una simulación orientativa. Verifique con el borrador oficial de la AEAT.");

  return {
    tipo: "residente",
    baseImponibleGeneral: baseGeneral,
    baseImponibleAhorro: baseAhorro,
    baseLiquidableGeneral,
    baseLiquidableAhorro,
    reduccionesPersonales: totalReducciones,
    minimosPersonalesFamiliares: minimos,
    cuotaIntegra,
    deducciones,
    deduccionesAutonomicas,
    cuotaLiquida,
    retencionesIngresos: retenciones,
    cuotaDiferencial,
    resultado,
    importeResultado: Math.abs(cuotaDiferencial),
    recomendaciones,
    casillasRelevantes,
    tramosAplicados: {
      estatal: cuotaEstatalGeneral.detalle,
      autonomico: cuotaAutGeneral.detalle,
      ahorro: cuotaEstatalAhorro.detalle,
    },
    detalleCapitalMobiliario: capitalMob,
    detalleGanancias: ganancias,
    detalleImputacion: imputacion,
    detalleActividad: actividad.detalle,
  };
}

// ═══════════════════════════════════════════════════════════════
// COMPARATIVA INDIVIDUAL vs CONJUNTA
// ═══════════════════════════════════════════════════════════════

export function compararIndividualVsConjunta(declarante, conyuge) {
  // 1. Declaración individual de cada cónyuge
  const ind1 = simularRenta({ ...declarante, _esComparativa: true });
  const ind2 = simularRenta({ ...conyuge, _esComparativa: true });

  // 2. Declaración conjunta
  const conjunta = simularRentaConjunta(declarante, conyuge);

  // 3. Comparar
  const totalIndividual = (ind1.cuotaDiferencial || 0) + (ind2.cuotaDiferencial || 0);
  const totalConjunta = conjunta.cuotaDiferencial || 0;
  const diferencia = totalConjunta - totalIndividual;

  return {
    individual: {
      declarante1: ind1,
      declarante2: ind2,
      cuotaDiferencialTotal: totalIndividual,
      importeResultadoTotal: Math.abs(totalIndividual),
      resultado: totalIndividual <= 0 ? "a_devolver" : "a_ingresar",
    },
    conjunta: {
      ...conjunta,
    },
    recomendacion: diferencia < 0
      ? `La declaración CONJUNTA es más favorable: ahorra ${Math.abs(diferencia).toFixed(2)}€`
      : diferencia > 0
        ? `La declaración INDIVIDUAL es más favorable: ahorra ${Math.abs(diferencia).toFixed(2)}€`
        : "Ambas opciones dan el mismo resultado.",
    diferencia: Math.abs(diferencia),
    masConveniente: diferencia < 0 ? "conjunta" : diferencia > 0 ? "individual" : "igual",
  };
}

function simularRentaConjunta(d1, d2) {
  // Sumar rentas de ambos cónyuges
  const dataConjunta = {
    ...d1,
    _esComparativa: true,
    // Sumar rendimientos
    rendimientosTrabajo: (parseFloat(d1.rendimientosTrabajo) || 0) + (parseFloat(d2.rendimientosTrabajo) || 0),
    otrosRendimientos: (parseFloat(d1.otrosRendimientos) || 0) + (parseFloat(d2.otrosRendimientos) || 0),
    retencionesIRPF: (parseFloat(d1.retencionesIRPF) || 0) + (parseFloat(d2.retencionesIRPF) || 0),
    seguridadSocial: (parseFloat(d1.seguridadSocial) || 0) + (parseFloat(d2.seguridadSocial) || 0),
    dividendos: (parseFloat(d1.dividendos) || 0) + (parseFloat(d2.dividendos) || 0),
    intereses: (parseFloat(d1.intereses) || 0) + (parseFloat(d2.intereses) || 0),
    planPensiones: (parseFloat(d1.planPensiones) || 0) + (parseFloat(d2.planPensiones) || 0),
    donativos: (parseFloat(d1.donativos) || 0) + (parseFloat(d2.donativos) || 0),
    // Actividades económicas
    autonomo: d1.autonomo || d2.autonomo,
    ingresoActividad: (parseFloat(d1.ingresoActividad) || 0) + (parseFloat(d2.ingresoActividad) || 0),
    gastosActividad: (parseFloat(d1.gastosActividad) || 0) + (parseFloat(d2.gastosActividad) || 0),
    // Capital
    gananciaPatrimonial: [...(d1.gananciaPatrimonial || []), ...(d2.gananciaPatrimonial || [])],
    inmueblesNoHabituales: [...(d1.inmueblesNoHabituales || []), ...(d2.inmueblesNoHabituales || [])],
  };

  const resultado = simularRenta(dataConjunta);

  // Reducción por tributación conjunta: 3.400€ (matrimonios)
  const reduccionConjunta = 3400;
  const baseLiquidableAjustada = Math.max(resultado.baseLiquidableGeneral - reduccionConjunta, 0);

  // Recalcular cuota con la reducción
  const cuotaEstatal = calcularPorTramos(baseLiquidableAjustada, TRAMOS_GENERAL_ESTATAL);
  const minimoCuota = calcularPorTramos(resultado.minimosPersonalesFamiliares, TRAMOS_GENERAL_ESTATAL);

  const tramosAut = TRAMOS_CCAA[d1.comunidadAutonoma] || TRAMOS_GENERAL_AUTONOMICO;
  const cuotaAut = calcularPorTramos(baseLiquidableAjustada, tramosAut);
  const minimoAut = calcularPorTramos(resultado.minimosPersonalesFamiliares, tramosAut);

  const cuotaAhorro = calcularPorTramos(resultado.baseLiquidableAhorro, TRAMOS_AHORRO);

  const cuotaIntegra =
    Math.max(cuotaEstatal.cuota - minimoCuota.cuota, 0) +
    cuotaAhorro.cuota / 2 +
    Math.max(cuotaAut.cuota - minimoAut.cuota, 0) +
    cuotaAhorro.cuota / 2;

  const totalDeds = resultado.deducciones.reduce((s, d) => s + d.importe, 0);
  const totalDedsAut = resultado.deduccionesAutonomicas.reduce((s, d) => s + d.importe, 0);
  const cuotaLiquida = Math.max(cuotaIntegra - totalDeds - totalDedsAut, 0);
  const cuotaDiferencial = cuotaLiquida - resultado.retencionesIngresos;

  return {
    ...resultado,
    tipoDeclaracion: "conjunta",
    reduccionConjunta,
    cuotaIntegra,
    cuotaLiquida,
    cuotaDiferencial,
    resultado: cuotaDiferencial <= 0 ? "a_devolver" : "a_ingresar",
    importeResultado: Math.abs(cuotaDiferencial),
  };
}

// ═══════════════════════════════════════════════════════════════
// GENERACIÓN PDF BORRADOR
// ═══════════════════════════════════════════════════════════════

export async function generarBorradorPDF(data, resultado, res) {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ margin: 40, size: "A4" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition",
    `attachment; filename="borrador-renta-2025-${data.nif || 'simulacion'}.pdf"`);

  doc.pipe(res);

  // ─── Header ─────────────────────────────────────────────────
  doc.fontSize(20).font("Helvetica-Bold")
    .text("SIMULACIÓN DECLARACIÓN IRPF 2025", { align: "center" });
  doc.fontSize(10).font("Helvetica")
    .fillColor("#666").text("Modelo 100 — Ejercicio fiscal 2025", { align: "center" });
  doc.fontSize(8).text("Generado por RomainGE — romainge.com", { align: "center" });
  doc.moveDown(0.5);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#999").stroke();
  doc.moveDown(0.5);

  // ─── Datos personales ───────────────────────────────────────
  doc.fontSize(13).font("Helvetica-Bold").fillColor("#333").text("1. DATOS DEL CONTRIBUYENTE");
  doc.moveDown(0.3);
  doc.fontSize(10).font("Helvetica").fillColor("#444");
  doc.text(`Nombre: ${data.nombre || ""} ${data.apellido || ""}`);
  doc.text(`NIF/NIE: ${data.nif || "No indicado"}`);
  doc.text(`Estado civil: ${data.estadoCivil || "Soltero/a"}`);
  doc.text(`Comunidad Autónoma: ${data.comunidadAutonoma || "No indicada"}`);
  if (data.hijos > 0) doc.text(`Hijos: ${data.hijos}`);
  doc.moveDown(0.8);

  // ─── Resultado principal ────────────────────────────────────
  const aDevolver = resultado.resultado === "a_devolver";
  doc.fontSize(14).font("Helvetica-Bold")
    .fillColor(aDevolver ? "#00796b" : "#c62828")
    .text(`RESULTADO: ${aDevolver ? "A DEVOLVER" : "A INGRESAR"} ${resultado.importeResultado.toFixed(2)} €`, { align: "center" });
  doc.moveDown(0.8);

  // ─── Casillas relevantes ────────────────────────────────────
  doc.fontSize(13).font("Helvetica-Bold").fillColor("#333").text("2. CASILLAS RELEVANTES DEL MODELO 100");
  doc.moveDown(0.3);

  // Table header
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#555");
  doc.text("Casilla", 40, doc.y, { width: 60, continued: true });
  doc.text("Concepto", 100, doc.y, { width: 320, continued: true });
  doc.text("Importe (€)", 420, doc.y, { width: 100, align: "right" });
  doc.moveDown(0.2);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#ddd").stroke();
  doc.moveDown(0.2);

  doc.font("Helvetica").fontSize(9).fillColor("#444");
  for (const c of (resultado.casillasRelevantes || [])) {
    if (doc.y > 720) doc.addPage();
    const y = doc.y;
    doc.text(c.casilla, 40, y, { width: 60 });
    doc.text(c.concepto, 100, y, { width: 320 });
    doc.text(c.valor.toFixed(2), 420, y, { width: 100, align: "right" });
    doc.moveDown(0.2);
  }

  doc.moveDown(0.5);

  // ─── Deducciones ────────────────────────────────────────────
  if (resultado.deducciones?.length > 0) {
    if (doc.y > 680) doc.addPage();
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#333").text("3. DEDUCCIONES ESTATALES");
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica").fillColor("#444");
    for (const d of resultado.deducciones) {
      doc.text(`[${d.casilla || "—"}] ${d.concepto}: -${d.importe.toFixed(2)} €`);
    }
    doc.moveDown(0.5);
  }

  // ─── Deducciones autonómicas ────────────────────────────────
  if (resultado.deduccionesAutonomicas?.length > 0) {
    if (doc.y > 680) doc.addPage();
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#333")
      .text(`4. DEDUCCIONES AUTONÓMICAS (${data.comunidadAutonoma})`);
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica").fillColor("#444");
    for (const d of resultado.deduccionesAutonomicas) {
      doc.text(`${d.concepto}: -${d.importe.toFixed(2)} €`);
    }
    doc.moveDown(0.5);
  }

  // ─── Recomendaciones ────────────────────────────────────────
  if (resultado.recomendaciones?.length > 0) {
    if (doc.y > 680) doc.addPage();
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#333").text("5. RECOMENDACIONES");
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica").fillColor("#555");
    for (const r of resultado.recomendaciones) {
      doc.text(`• ${r}`, { lineGap: 2 });
    }
    doc.moveDown(0.5);
  }

  // ─── Resumen desglose ───────────────────────────────────────
  if (doc.y > 640) doc.addPage();
  doc.fontSize(13).font("Helvetica-Bold").fillColor("#333").text("6. RESUMEN DE LA LIQUIDACIÓN");
  doc.moveDown(0.3);
  doc.fontSize(10).font("Helvetica").fillColor("#444");
  const resumen = [
    ["Base imponible general", resultado.baseImponibleGeneral],
    ["Base imponible del ahorro", resultado.baseImponibleAhorro],
    ["Reducciones", resultado.reduccionesPersonales],
    ["Mínimo personal y familiar", resultado.minimosPersonalesFamiliares],
    ["Cuota íntegra", resultado.cuotaIntegra],
    ["Total deducciones", (resultado.deducciones || []).reduce((s, d) => s + d.importe, 0) +
      (resultado.deduccionesAutonomicas || []).reduce((s, d) => s + d.importe, 0)],
    ["Cuota líquida", resultado.cuotaLiquida],
    ["Retenciones e ingresos a cuenta", resultado.retencionesIngresos],
    ["CUOTA DIFERENCIAL", resultado.cuotaDiferencial],
  ];
  for (const [concepto, valor] of resumen) {
    if (valor == null) continue;
    const y = doc.y;
    doc.text(concepto, 40, y, { width: 350 });
    doc.font("Helvetica-Bold").text((valor || 0).toFixed(2) + " €", 400, y, { width: 155, align: "right" });
    doc.font("Helvetica");
    doc.moveDown(0.15);
  }

  // ─── Footer ─────────────────────────────────────────────────
  doc.moveDown(1);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#ccc").stroke();
  doc.moveDown(0.3);
  doc.fontSize(7).font("Helvetica").fillColor("#999")
    .text("AVISO: Este documento es una simulación orientativa generada automáticamente. " +
      "No tiene validez legal ni sustituye la declaración oficial ante la AEAT. " +
      "Consulte con un asesor fiscal cualificado antes de tomar decisiones tributarias.", { align: "center" })
    .text(`Generado el ${new Date().toLocaleString("es-ES")} — romainge.com`, { align: "center" });

  doc.end();
}
