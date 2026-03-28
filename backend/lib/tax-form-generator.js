// ═══════════════════════════════════════════════════════════════
// lib/tax-form-generator.js — Generador de modelos tributarios
// Pre-relleno automático de formularios AEAT (036, 303, 390)
// ═══════════════════════════════════════════════════════════════

const NIF_REGEX = /^[0-9]{8}[A-Z]$/;
const NIE_REGEX = /^[XYZ][0-9]{7}[A-Z]$/;
const CIF_REGEX = /^[ABCDEFGHJKLMNPQRSUVW][0-9]{7}[0-9A-J]$/;
const PERIOD_REGEX = /^[1-4]T$/;
const NIF_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

const IVA_RATES = {
  general: 0.21,
  reducido: 0.10,
  superreducido: 0.04,
};

// ───────────────────────────────────────────────────────────────
// Validación NIF/NIE/CIF
// ───────────────────────────────────────────────────────────────

function isValidNIF(nif) {
  if (!nif || typeof nif !== "string") return false;
  const clean = nif.toUpperCase().trim();
  if (NIF_REGEX.test(clean)) {
    const num = parseInt(clean.slice(0, 8), 10);
    return clean[8] === NIF_LETTERS[num % 23];
  }
  if (NIE_REGEX.test(clean)) {
    const prefix = { X: "0", Y: "1", Z: "2" }[clean[0]];
    const num = parseInt(prefix + clean.slice(1, 8), 10);
    return clean[8] === NIF_LETTERS[num % 23];
  }
  if (CIF_REGEX.test(clean)) return true;
  return false;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ───────────────────────────────────────────────────────────────
// Form metadata
// ───────────────────────────────────────────────────────────────

const FORM_INFO = {
  "036": {
    name: "Modelo 036",
    description: "Declaración censal de alta, modificación y baja en el Censo de Empresarios, Profesionales y Retenedores",
    deadline: "Antes del inicio de la actividad, o 1 mes desde la modificación/baja",
    who: "Empresarios, profesionales y retenedores obligados a estar en el censo",
    frequency: "Puntual (alta/modificación/baja)",
    pages: 8,
  },
  "303": {
    name: "Modelo 303",
    description: "Autoliquidación trimestral del Impuesto sobre el Valor Añadido (IVA)",
    deadline: "1-20 del mes siguiente al trimestre (1T: abril, 2T: julio, 3T: octubre, 4T: enero)",
    who: "Sujetos pasivos del IVA con obligación de autoliquidar trimestralmente",
    frequency: "Trimestral",
    casillas: "01-71",
  },
  "390": {
    name: "Modelo 390",
    description: "Declaración-resumen anual del Impuesto sobre el Valor Añadido (IVA)",
    deadline: "1-30 de enero del año siguiente",
    who: "Sujetos pasivos del IVA obligados a presentar autoliquidaciones periódicas",
    frequency: "Anual",
    casillas: "Identificación + resumen operaciones + resultado",
  },
};

export function getFormInfo(modelo) {
  const key = String(modelo);
  if (!FORM_INFO[key]) {
    throw new Error(`Modelo ${modelo} no soportado. Modelos disponibles: ${Object.keys(FORM_INFO).join(", ")}`);
  }
  return { ...FORM_INFO[key] };
}

export function getSupportedModels() {
  return Object.entries(FORM_INFO).map(([code, info]) => ({
    codigo: code,
    ...info,
  }));
}

// ───────────────────────────────────────────────────────────────
// Validation
// ───────────────────────────────────────────────────────────────

export function validateFormData(modelo, data) {
  const errors = [];
  const key = String(modelo);

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["data es requerido y debe ser un objeto"] };
  }

  // Common NIF validation
  if (!data.nif) {
    errors.push("NIF/NIE/CIF es obligatorio");
  } else if (!isValidNIF(data.nif)) {
    errors.push(`NIF/NIE/CIF inválido: ${data.nif}`);
  }

  if (!data.nombre || typeof data.nombre !== "string" || !data.nombre.trim()) {
    errors.push("Nombre o razón social es obligatorio");
  }

  if (key === "036") {
    if (!data.tipoDeclaracion || !["alta", "modificacion", "baja"].includes(data.tipoDeclaracion)) {
      errors.push("tipoDeclaracion debe ser 'alta', 'modificacion' o 'baja'");
    }
    if (!data.domicilioFiscal || typeof data.domicilioFiscal !== "object") {
      errors.push("domicilioFiscal es obligatorio (objeto con calle, municipio, provincia, cp)");
    } else {
      if (!data.domicilioFiscal.calle) errors.push("domicilioFiscal.calle es obligatorio");
      if (!data.domicilioFiscal.municipio) errors.push("domicilioFiscal.municipio es obligatorio");
      if (!data.domicilioFiscal.provincia) errors.push("domicilioFiscal.provincia es obligatorio");
      if (!data.domicilioFiscal.cp || !/^\d{5}$/.test(data.domicilioFiscal.cp)) {
        errors.push("domicilioFiscal.cp debe tener 5 dígitos");
      }
    }
  }

  if (key === "303") {
    if (!data.ejercicio || !/^\d{4}$/.test(String(data.ejercicio))) {
      errors.push("ejercicio debe ser un año de 4 dígitos");
    }
    if (!data.periodo || !PERIOD_REGEX.test(data.periodo)) {
      errors.push("periodo debe ser '1T', '2T', '3T' o '4T'");
    }
    if (data.operaciones && Array.isArray(data.operaciones)) {
      data.operaciones.forEach((op, i) => {
        if (typeof op.base !== "number" || op.base < 0) {
          errors.push(`operaciones[${i}].base debe ser un número no negativo`);
        }
        if (op.tipo && !IVA_RATES[op.tipo]) {
          errors.push(`operaciones[${i}].tipo debe ser 'general', 'reducido' o 'superreducido'`);
        }
      });
    }
  }

  if (key === "390") {
    if (!data.ejercicio || !/^\d{4}$/.test(String(data.ejercicio))) {
      errors.push("ejercicio debe ser un año de 4 dígitos");
    }
    if (!data.trimestres || !Array.isArray(data.trimestres) || data.trimestres.length !== 4) {
      errors.push("trimestres debe ser un array con los datos de los 4 trimestres");
    }
  }

  return { valid: errors.length === 0, errors };
}

// ───────────────────────────────────────────────────────────────
// Modelo 036 — Declaración censal
// ───────────────────────────────────────────────────────────────

export function generateModelo036(data) {
  const validation = validateFormData("036", data);
  if (!validation.valid) {
    throw new Error(`Datos inválidos para Modelo 036: ${validation.errors.join("; ")}`);
  }

  const nif = data.nif.toUpperCase().trim();
  const tipo = data.tipoDeclaracion;
  const dom = data.domicilioFiscal;

  // Página 1 — Identificación
  const pagina1 = {
    casilla_101: nif,
    casilla_102: data.nombre.trim(),
    casilla_103: data.apellido1 || "",
    casilla_104: data.apellido2 || "",
    casilla_105: tipo === "alta" ? "X" : "",
    casilla_106: tipo === "modificacion" ? "X" : "",
    casilla_107: tipo === "baja" ? "X" : "",
    casilla_108: data.fechaEfecto || new Date().toISOString().slice(0, 10),
    casilla_109: dom.calle,
    casilla_110: dom.numero || "",
    casilla_111: dom.piso || "",
    casilla_112: dom.puerta || "",
    casilla_113: dom.municipio,
    casilla_114: dom.provincia,
    casilla_115: dom.cp,
    casilla_116: data.telefono || "",
    casilla_117: data.email || "",
  };

  // Página 2 — Representantes
  const pagina2 = {
    casilla_201: data.representante?.nif || "",
    casilla_202: data.representante?.nombre || "",
    casilla_203: data.representante?.apellido1 || "",
    casilla_204: data.representante?.apellido2 || "",
    casilla_205: data.representante?.cargo || "",
    casilla_206: data.representante?.tipoRepresentacion || "",
  };

  // Página 3 — IRPF / Impuesto sobre Sociedades
  const pagina3 = {
    casilla_301: data.personaFisica ? "X" : "",
    casilla_302: data.personaJuridica ? "X" : "",
    casilla_310: data.metodoEstimacion || "",
    casilla_311: data.estimacionDirectaNormal ? "X" : "",
    casilla_312: data.estimacionDirectaSimplificada ? "X" : "",
    casilla_313: data.estimacionObjetiva ? "X" : "",
    casilla_320: data.sociedadTipo || "",
    casilla_321: data.ejercicioFiscalInicio || "",
    casilla_322: data.ejercicioFiscalFin || "",
  };

  // Página 4 — IVA
  const regimenIVA = data.regimenIVA || "general";
  const pagina4 = {
    casilla_401: data.sujetoIVA ? "X" : "",
    casilla_402: regimenIVA === "general" ? "X" : "",
    casilla_403: regimenIVA === "simplificado" ? "X" : "",
    casilla_404: regimenIVA === "recargoEquivalencia" ? "X" : "",
    casilla_405: regimenIVA === "agriculturaGanaderia" ? "X" : "",
    casilla_406: data.prorataSectoresDiferenciados ? "X" : "",
    casilla_410: data.inicioActividadIVA || "",
    casilla_411: data.epigrafeIAE || "",
  };

  // Página 5 — Retenciones e ingresos a cuenta
  const pagina5 = {
    casilla_501: data.obligadoRetener ? "X" : "",
    casilla_502: data.retencionesTrabajoPersonal ? "X" : "",
    casilla_503: data.retencionesCapitalMobiliario ? "X" : "",
    casilla_504: data.retencionesCapitalInmobiliario ? "X" : "",
    casilla_505: data.retencionesActividadesEconomicas ? "X" : "",
    casilla_506: data.retencionesGananciasPatrimoniales ? "X" : "",
    casilla_510: data.periodicidadRetenciones || "trimestral",
  };

  // Página 6 — Regímenes especiales
  const pagina6 = {
    casilla_601: data.regimenCriteriosCaja ? "X" : "",
    casilla_602: data.regimenGrupoEntidades ? "X" : "",
    casilla_603: data.regimenBienesUsados ? "X" : "",
    casilla_604: data.regimenAgenciasViajes ? "X" : "",
    casilla_605: data.regimenOro ? "X" : "",
    casilla_606: data.regimenSuministroInformacionInmediato ? "X" : "",
  };

  // Página 7 — Relaciones intracomunitarias
  const pagina7 = {
    casilla_701: data.operadorIntracomunitario ? "X" : "",
    casilla_702: data.adquisicionesIntracomunitarias ? "X" : "",
    casilla_703: data.entregasIntracomunitarias ? "X" : "",
    casilla_704: data.prestacionesServiciosIntracomunitarias ? "X" : "",
  };

  // Página 8 — Otros
  const epigrafes = Array.isArray(data.epigrafesIAE) ? data.epigrafesIAE : [];
  const pagina8 = {
    casilla_801: epigrafes[0] || "",
    casilla_802: epigrafes[1] || "",
    casilla_803: epigrafes[2] || "",
    casilla_804: data.actividadDescripcion || "",
    casilla_805: data.fechaInicioActividad || "",
    casilla_806: data.fechaCeseActividad || "",
    casilla_807: data.localAfecto ? "X" : "",
  };

  return {
    modelo: "036",
    tipoDeclaracion: tipo,
    fechaGeneracion: new Date().toISOString(),
    pagina1,
    pagina2,
    pagina3,
    pagina4,
    pagina5,
    pagina6,
    pagina7,
    pagina8,
  };
}

// ───────────────────────────────────────────────────────────────
// Modelo 303 — IVA trimestral
// ───────────────────────────────────────────────────────────────

export function generateModelo303(data) {
  const validation = validateFormData("303", data);
  if (!validation.valid) {
    throw new Error(`Datos inválidos para Modelo 303: ${validation.errors.join("; ")}`);
  }

  const operaciones = data.operaciones || [];

  // Agrupar operaciones por tipo de IVA
  const porTipo = { general: [], reducido: [], superreducido: [] };
  const intracomunitarias = [];
  const otrasDevengadas = [];
  const soportadas = [];

  for (const op of operaciones) {
    const cat = op.categoria || "devengado";
    if (cat === "intracomunitaria") {
      intracomunitarias.push(op);
    } else if (cat === "otroDevengado") {
      otrasDevengadas.push(op);
    } else if (cat === "soportado") {
      soportadas.push(op);
    } else {
      const tipo = op.tipo || "general";
      if (porTipo[tipo]) porTipo[tipo].push(op);
    }
  }

  const sumaBase = (arr) => round2(arr.reduce((s, o) => s + (o.base || 0), 0));
  const sumaCuota = (arr, rate) => round2(arr.reduce((s, o) => s + (o.base || 0) * rate, 0));

  // Casillas 01-03: Régimen general (21%)
  const base01 = sumaBase(porTipo.general);
  const tipo02 = 21;
  const cuota03 = round2(base01 * IVA_RATES.general);

  // Casillas 04-06: Adquisiciones intracomunitarias
  const base04 = sumaBase(intracomunitarias);
  const tipo05 = 21;
  const cuota06 = round2(base04 * IVA_RATES.general);

  // Casillas 07-09: IVA devengado otros
  const base07 = sumaBase(otrasDevengadas);
  const tipo08 = data.tipoOtrasDevengadas || 21;
  const cuota09 = round2(base07 * (tipo08 / 100));

  // Casillas 10-12: Régimen reducido (10%)
  const base10 = sumaBase(porTipo.reducido);
  const tipo11 = 10;
  const cuota12 = round2(base10 * IVA_RATES.reducido);

  // Casillas 13-15: Régimen superreducido (4%)
  const base13 = sumaBase(porTipo.superreducido);
  const tipo14 = 4;
  const cuota15 = round2(base13 * IVA_RATES.superreducido);

  // Total IVA devengado
  const totalDevengado = round2(cuota03 + cuota06 + cuota09 + cuota12 + cuota15);

  // Casillas 21-24: Recargo de equivalencia
  const recargoBase21 = data.recargoEquivalencia?.base || 0;
  const recargoTipo22 = data.recargoEquivalencia?.tipo || 5.2;
  const recargoCuota23 = round2(recargoBase21 * (recargoTipo22 / 100));
  const totalRecargo24 = recargoCuota23;

  // Casilla 27: Cuotas soportadas deducibles
  const baseSoportada = sumaBase(soportadas);
  const cuota27 = data.cuotasSoportadasDeducibles != null
    ? round2(data.cuotasSoportadasDeducibles)
    : round2(soportadas.reduce((s, o) => {
        const rate = IVA_RATES[o.tipo || "general"] || IVA_RATES.general;
        return s + (o.base || 0) * rate;
      }, 0));

  // Casillas 28-40: Compensaciones, regularización
  const compensacionPeriodosAnteriores28 = round2(data.compensacionAnteriores || 0);
  const regularizacion29 = round2(data.regularizacion || 0);
  const entregasInterioresBienesInversion30 = round2(data.entregasBienesInversion || 0);
  const importaciones31 = round2(data.importaciones || 0);
  const adquisicionesIntracomBienes32 = round2(data.adquisicionesIntracomBienes || 0);
  const totalDeducir40 = round2(cuota27 + compensacionPeriodosAnteriores28 + regularizacion29);

  // Casilla 46: Resultado
  const resultado46 = round2(totalDevengado + totalRecargo24 - totalDeducir40);

  // Casillas 64-66: Informativo — operaciones intracomunitarias
  const opsIntracomBienes64 = round2(data.entregasIntracomBienes || 0);
  const opsIntracomServicios65 = round2(data.prestacionesIntracomServicios || 0);
  const totalIntracom66 = round2(opsIntracomBienes64 + opsIntracomServicios65);

  // Casilla 71: Resultado declaración
  const aDeducirPeriodosAnt = round2(data.resultadoAnteriores || 0);
  const resultado71 = round2(resultado46 - aDeducirPeriodosAnt);

  return {
    modelo: "303",
    fechaGeneracion: new Date().toISOString(),
    identificacion: {
      nif: data.nif.toUpperCase().trim(),
      nombre: data.nombre.trim(),
      ejercicio: String(data.ejercicio),
      periodo: data.periodo,
    },
    devengado: {
      casilla_01: base01,
      casilla_02: tipo02,
      casilla_03: cuota03,
      casilla_04: base04,
      casilla_05: tipo05,
      casilla_06: cuota06,
      casilla_07: base07,
      casilla_08: tipo08,
      casilla_09: cuota09,
      casilla_10: base10,
      casilla_11: tipo11,
      casilla_12: cuota12,
      casilla_13: base13,
      casilla_14: tipo14,
      casilla_15: cuota15,
      total_devengado: totalDevengado,
    },
    recargoEquivalencia: {
      casilla_21: recargoBase21,
      casilla_22: recargoTipo22,
      casilla_23: recargoCuota23,
      casilla_24: totalRecargo24,
    },
    deducible: {
      casilla_27: cuota27,
      casilla_28: compensacionPeriodosAnteriores28,
      casilla_29: regularizacion29,
      casilla_30: entregasInterioresBienesInversion30,
      casilla_31: importaciones31,
      casilla_32: adquisicionesIntracomBienes32,
      casilla_40: totalDeducir40,
    },
    resultado: {
      casilla_46: resultado46,
    },
    informativo: {
      casilla_64: opsIntracomBienes64,
      casilla_65: opsIntracomServicios65,
      casilla_66: totalIntracom66,
    },
    declaracion: {
      casilla_71: resultado71,
      tipo: resultado71 > 0 ? "ingreso" : resultado71 < 0 ? "compensar" : "sinActividad",
    },
  };
}

// ───────────────────────────────────────────────────────────────
// Modelo 390 — Resumen anual IVA
// ───────────────────────────────────────────────────────────────

export function generateModelo390(data) {
  const validation = validateFormData("390", data);
  if (!validation.valid) {
    throw new Error(`Datos inválidos para Modelo 390: ${validation.errors.join("; ")}`);
  }

  // Generar cada trimestre como Modelo 303 para extraer datos
  const trimestresData = data.trimestres.map((t, i) => {
    const periodo = `${i + 1}T`;
    const merged = { ...data, ...t, periodo, ejercicio: data.ejercicio };
    // If trimestre already has 303 structure, use it; otherwise generate
    if (t.devengado && t.deducible) return t;
    try {
      return generateModelo303(merged);
    } catch {
      return t;
    }
  });

  const sumField = (field) =>
    round2(trimestresData.reduce((s, t) => {
      const parts = field.split(".");
      let val = t;
      for (const p of parts) val = val?.[p];
      return s + (Number(val) || 0);
    }, 0));

  // Aggregate across 4 quarters
  const totalBaseGeneral = sumField("devengado.casilla_01");
  const totalCuotaGeneral = sumField("devengado.casilla_03");
  const totalBaseReducido = sumField("devengado.casilla_10");
  const totalCuotaReducido = sumField("devengado.casilla_12");
  const totalBaseSuperreducido = sumField("devengado.casilla_13");
  const totalCuotaSuperreducido = sumField("devengado.casilla_15");
  const totalBaseIntracom = sumField("devengado.casilla_04");
  const totalCuotaIntracom = sumField("devengado.casilla_06");
  const totalDevengado = round2(totalCuotaGeneral + totalCuotaReducido + totalCuotaSuperreducido + totalCuotaIntracom);

  const totalDeducible = sumField("deducible.casilla_27");
  const totalCompensaciones = sumField("deducible.casilla_28");
  const totalRegularizaciones = sumField("deducible.casilla_29");
  const totalTotalDeducir = sumField("deducible.casilla_40");

  const resultadoAnual = round2(totalDevengado - totalTotalDeducir);

  // Validate consistency: sum of quarterly results should equal annual
  const sumaResultados71 = sumField("declaracion.casilla_71");
  const consistente = Math.abs(resultadoAnual - sumaResultados71) < 0.02;

  const resultadosTrim = trimestresData.map((t) => t.declaracion?.casilla_71 || 0);

  return {
    modelo: "390",
    fechaGeneracion: new Date().toISOString(),
    identificacion: {
      nif: data.nif.toUpperCase().trim(),
      nombre: data.nombre.trim(),
      ejercicio: String(data.ejercicio),
    },
    resumenOperaciones: {
      regimenGeneral: {
        totalBase: totalBaseGeneral,
        tipo: 21,
        totalCuota: totalCuotaGeneral,
      },
      regimenReducido: {
        totalBase: totalBaseReducido,
        tipo: 10,
        totalCuota: totalCuotaReducido,
      },
      regimenSuperreducido: {
        totalBase: totalBaseSuperreducido,
        tipo: 4,
        totalCuota: totalCuotaSuperreducido,
      },
      adquisicionesIntracomunitarias: {
        totalBase: totalBaseIntracom,
        totalCuota: totalCuotaIntracom,
      },
      totalCuotasDevengadas: totalDevengado,
    },
    deducciones: {
      totalCuotasDeducibles: totalDeducible,
      totalCompensaciones,
      totalRegularizaciones,
      totalADeducir: totalTotalDeducir,
    },
    resultado: {
      resultadoAnual,
      tipo: resultadoAnual > 0 ? "ingreso" : resultadoAnual < 0 ? "devolucion" : "cero",
    },
    desgloseTrimestral: {
      "1T": resultadosTrim[0],
      "2T": resultadosTrim[1],
      "3T": resultadosTrim[2],
      "4T": resultadosTrim[3],
    },
    validacion: {
      consistente,
      sumaTrimestresCasilla71: sumaResultados71,
      resultadoCalculado: resultadoAnual,
      diferencia: round2(Math.abs(resultadoAnual - sumaResultados71)),
    },
    datosEstadisticos: {
      totalOperacionesInteriores: round2(totalBaseGeneral + totalBaseReducido + totalBaseSuperreducido),
      totalOperacionesIntracomunitarias: totalBaseIntracom,
      volumenOperaciones: round2(totalBaseGeneral + totalBaseReducido + totalBaseSuperreducido + totalBaseIntracom),
    },
  };
}

// ───────────────────────────────────────────────────────────────
// calculateTotals — Recalcular campos derivados
// ───────────────────────────────────────────────────────────────

export function calculateTotals(modelo, data) {
  const key = String(modelo);

  if (key === "303") {
    const ops = data.operaciones || [];
    let totalDevengado = 0;
    let totalDeducible = 0;

    for (const op of ops) {
      const rate = IVA_RATES[op.tipo || "general"] || IVA_RATES.general;
      const cuota = round2((op.base || 0) * rate);
      const cat = op.categoria || "devengado";
      if (cat === "soportado") {
        totalDeducible += cuota;
      } else {
        totalDevengado += cuota;
      }
    }

    return {
      totalDevengado: round2(totalDevengado),
      totalDeducible: round2(totalDeducible),
      diferencia: round2(totalDevengado - totalDeducible),
      resultado: round2(totalDevengado - totalDeducible - (data.compensacionAnteriores || 0)),
    };
  }

  if (key === "390") {
    const trimestres = data.trimestres || [];
    const totals = trimestres.map((t) => calculateTotals("303", t));
    return {
      totalDevengadoAnual: round2(totals.reduce((s, t) => s + t.totalDevengado, 0)),
      totalDeducibleAnual: round2(totals.reduce((s, t) => s + t.totalDeducible, 0)),
      resultadoAnual: round2(totals.reduce((s, t) => s + t.resultado, 0)),
      porTrimestre: totals.map((t, i) => ({ periodo: `${i + 1}T`, ...t })),
    };
  }

  if (key === "036") {
    return { mensaje: "El Modelo 036 no tiene campos calculables automáticamente" };
  }

  throw new Error(`Modelo ${modelo} no soportado`);
}

// ───────────────────────────────────────────────────────────────
// Export formats
// ───────────────────────────────────────────────────────────────

export function exportFormJSON(modelo, data) {
  const key = String(modelo);
  let form;

  if (key === "036") form = generateModelo036(data);
  else if (key === "303") form = generateModelo303(data);
  else if (key === "390") form = generateModelo390(data);
  else throw new Error(`Modelo ${modelo} no soportado`);

  return {
    version: "1.0",
    formato: "AEAT-JSON",
    modelo: key,
    fechaExportacion: new Date().toISOString(),
    datos: form,
  };
}

export function exportFormTXT(modelo, data) {
  const key = String(modelo);
  let form;

  if (key === "036") form = generateModelo036(data);
  else if (key === "303") form = generateModelo303(data);
  else if (key === "390") form = generateModelo390(data);
  else throw new Error(`Modelo ${modelo} no soportado`);

  const lines = [];
  lines.push(`═══════════════════════════════════════════════════`);
  lines.push(`  MODELO ${key} — ${FORM_INFO[key].name}`);
  lines.push(`  ${FORM_INFO[key].description}`);
  lines.push(`═══════════════════════════════════════════════════`);
  lines.push(``);

  if (key === "036") {
    lines.push(`Tipo: ${form.tipoDeclaracion.toUpperCase()}`);
    lines.push(`NIF: ${form.pagina1.casilla_101}`);
    lines.push(`Nombre: ${form.pagina1.casilla_102} ${form.pagina1.casilla_103} ${form.pagina1.casilla_104}`.trim());
    lines.push(`Domicilio: ${form.pagina1.casilla_109}, ${form.pagina1.casilla_113} (${form.pagina1.casilla_114}) ${form.pagina1.casilla_115}`);
    lines.push(`Fecha efecto: ${form.pagina1.casilla_108}`);
    if (form.pagina4.casilla_401 === "X") lines.push(`Sujeto pasivo IVA: Sí`);
    if (form.pagina5.casilla_501 === "X") lines.push(`Obligado a retener: Sí`);
    if (form.pagina7.casilla_701 === "X") lines.push(`Operador intracomunitario: Sí`);
  }

  if (key === "303") {
    const id = form.identificacion;
    lines.push(`NIF: ${id.nif}  |  Nombre: ${id.nombre}`);
    lines.push(`Ejercicio: ${id.ejercicio}  |  Periodo: ${id.periodo}`);
    lines.push(``);
    lines.push(`── IVA DEVENGADO ──────────────────────────────────`);
    lines.push(`  Régimen general (21%):    Base ${form.devengado.casilla_01.toFixed(2)} EUR  →  Cuota ${form.devengado.casilla_03.toFixed(2)} EUR`);
    lines.push(`  Reducido (10%):           Base ${form.devengado.casilla_10.toFixed(2)} EUR  →  Cuota ${form.devengado.casilla_12.toFixed(2)} EUR`);
    lines.push(`  Superreducido (4%):       Base ${form.devengado.casilla_13.toFixed(2)} EUR  →  Cuota ${form.devengado.casilla_15.toFixed(2)} EUR`);
    lines.push(`  Adq. intracomunitarias:   Base ${form.devengado.casilla_04.toFixed(2)} EUR  →  Cuota ${form.devengado.casilla_06.toFixed(2)} EUR`);
    lines.push(`  TOTAL DEVENGADO:          ${form.devengado.total_devengado.toFixed(2)} EUR`);
    lines.push(``);
    lines.push(`── IVA DEDUCIBLE ──────────────────────────────────`);
    lines.push(`  Cuotas soportadas:        ${form.deducible.casilla_27.toFixed(2)} EUR`);
    lines.push(`  Compensación anterior:    ${form.deducible.casilla_28.toFixed(2)} EUR`);
    lines.push(`  TOTAL A DEDUCIR:          ${form.deducible.casilla_40.toFixed(2)} EUR`);
    lines.push(``);
    lines.push(`── RESULTADO ──────────────────────────────────────`);
    lines.push(`  Diferencia (cas. 46):     ${form.resultado.casilla_46.toFixed(2)} EUR`);
    lines.push(`  RESULTADO (cas. 71):      ${form.declaracion.casilla_71.toFixed(2)} EUR  (${form.declaracion.tipo})`);
  }

  if (key === "390") {
    const id = form.identificacion;
    lines.push(`NIF: ${id.nif}  |  Nombre: ${id.nombre}`);
    lines.push(`Ejercicio: ${id.ejercicio}`);
    lines.push(``);
    lines.push(`── RESUMEN ANUAL ──────────────────────────────────`);
    const r = form.resumenOperaciones;
    lines.push(`  General (21%):            Base ${r.regimenGeneral.totalBase.toFixed(2)}  →  Cuota ${r.regimenGeneral.totalCuota.toFixed(2)}`);
    lines.push(`  Reducido (10%):           Base ${r.regimenReducido.totalBase.toFixed(2)}  →  Cuota ${r.regimenReducido.totalCuota.toFixed(2)}`);
    lines.push(`  Superreducido (4%):       Base ${r.regimenSuperreducido.totalBase.toFixed(2)}  →  Cuota ${r.regimenSuperreducido.totalCuota.toFixed(2)}`);
    lines.push(`  Intracomunitarias:        Base ${r.adquisicionesIntracomunitarias.totalBase.toFixed(2)}  →  Cuota ${r.adquisicionesIntracomunitarias.totalCuota.toFixed(2)}`);
    lines.push(`  TOTAL DEVENGADO:          ${r.totalCuotasDevengadas.toFixed(2)} EUR`);
    lines.push(``);
    lines.push(`── DEDUCCIONES ────────────────────────────────────`);
    lines.push(`  Total deducible:          ${form.deducciones.totalCuotasDeducibles.toFixed(2)} EUR`);
    lines.push(`  Total a deducir:          ${form.deducciones.totalADeducir.toFixed(2)} EUR`);
    lines.push(``);
    lines.push(`── RESULTADO ANUAL ────────────────────────────────`);
    lines.push(`  Resultado:                ${form.resultado.resultadoAnual.toFixed(2)} EUR  (${form.resultado.tipo})`);
    lines.push(``);
    lines.push(`── DESGLOSE TRIMESTRAL ────────────────────────────`);
    for (const [p, v] of Object.entries(form.desgloseTrimestral)) {
      lines.push(`  ${p}:  ${Number(v).toFixed(2)} EUR`);
    }
    lines.push(``);
    lines.push(`── VALIDACIÓN ─────────────────────────────────────`);
    lines.push(`  Consistente: ${form.validacion.consistente ? "SÍ" : "NO (diferencia: " + form.validacion.diferencia.toFixed(2) + " EUR)"}`);
    lines.push(``);
    lines.push(`── DATOS ESTADÍSTICOS ─────────────────────────────`);
    lines.push(`  Operaciones interiores:   ${form.datosEstadisticos.totalOperacionesInteriores.toFixed(2)} EUR`);
    lines.push(`  Operaciones intracom.:    ${form.datosEstadisticos.totalOperacionesIntracomunitarias.toFixed(2)} EUR`);
    lines.push(`  Volumen de operaciones:   ${form.datosEstadisticos.volumenOperaciones.toFixed(2)} EUR`);
  }

  lines.push(``);
  lines.push(`───────────────────────────────────────────────────`);
  lines.push(`Generado por RomainGE — ${new Date().toISOString()}`);
  lines.push(`Este documento es informativo. La presentación oficial`);
  lines.push(`debe realizarse a través de la Sede Electrónica AEAT.`);
  lines.push(`───────────────────────────────────────────────────`);

  return lines.join("\n");
}
