// ═══════════════════════════════════════════════════════════════
// tests/renta-simulator.test.js — Tests del simulador IRPF 2025
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { simularRenta, compararIndividualVsConjunta } from "../lib/renta-simulator.js";

describe("simularRenta — cálculo básico", () => {
  it("calcula un asalariado simple correctamente", () => {
    const result = simularRenta({
      rendimientosTrabajo: 28000,
      retencionesIRPF: 4200,
      seguridadSocial: 1800,
      hijos: 0,
      comunidadAutonoma: "madrid",
    });

    expect(result.tipo).toBe("residente");
    expect(result.baseImponibleGeneral).toBeGreaterThan(0);
    expect(result.cuotaIntegra).toBeGreaterThan(0);
    expect(result.cuotaLiquida).toBeGreaterThan(0);
    expect(result.resultado).toMatch(/a_devolver|a_ingresar/);
    expect(result.importeResultado).toBeGreaterThanOrEqual(0);
    expect(result.casillasRelevantes.length).toBeGreaterThan(0);
  });

  it("aplica mínimo personal de 5.550€", () => {
    const result = simularRenta({ rendimientosTrabajo: 15000, retencionesIRPF: 1000 });
    expect(result.minimosPersonalesFamiliares).toBeGreaterThanOrEqual(5550);
  });

  it("aplica mínimo por descendientes", () => {
    const sinHijos = simularRenta({ rendimientosTrabajo: 30000, retencionesIRPF: 4000, hijos: 0 });
    const conHijos = simularRenta({ rendimientosTrabajo: 30000, retencionesIRPF: 4000, hijos: 2 });
    expect(conHijos.minimosPersonalesFamiliares).toBeGreaterThan(sinHijos.minimosPersonalesFamiliares);
    expect(conHijos.cuotaLiquida).toBeLessThan(sinHijos.cuotaLiquida);
  });

  it("aplica deducción por donativos (80% primeros 150€)", () => {
    const result = simularRenta({
      rendimientosTrabajo: 30000,
      retencionesIRPF: 4000,
      donativos: 200,
    });
    const donativoDed = result.deducciones.find(d => d.concepto.includes("Donativo"));
    expect(donativoDed).toBeDefined();
    // 150 * 0.80 + 50 * 0.40 = 120 + 20 = 140
    expect(donativoDed.importe).toBeCloseTo(140, 0);
  });

  it("limita plan de pensiones a 1.500€", () => {
    const result = simularRenta({
      rendimientosTrabajo: 40000,
      retencionesIRPF: 6000,
      planPensiones: 5000,
    });
    expect(result.reduccionesPersonales).toBe(1500);
  });
});

describe("simularRenta — capital mobiliario", () => {
  it("integra dividendos en base del ahorro", () => {
    const result = simularRenta({
      rendimientosTrabajo: 25000,
      retencionesIRPF: 3500,
      dividendos: 5000,
      intereses: 1000,
    });
    expect(result.baseImponibleAhorro).toBe(6000);
    expect(result.detalleCapitalMobiliario.rendimiento).toBe(6000);
  });

  it("resta gastos de custodia", () => {
    const result = simularRenta({
      rendimientosTrabajo: 20000,
      retencionesIRPF: 2000,
      dividendos: 3000,
      gastosAdminCustodia: 50,
    });
    expect(result.detalleCapitalMobiliario.rendimiento).toBe(2950);
  });
});

describe("simularRenta — ganancias patrimoniales", () => {
  it("calcula ganancia por venta de acciones", () => {
    const result = simularRenta({
      rendimientosTrabajo: 25000,
      retencionesIRPF: 3000,
      gananciaPatrimonial: [{
        tipo: "acciones",
        valorVenta: 15000,
        valorAdquisicion: 10000,
        gastosVenta: 50,
        gastosAdquisicion: 50,
      }],
    });
    expect(result.detalleGanancias.gananciaAhorro).toBe(4900);
    expect(result.baseImponibleAhorro).toBeGreaterThan(0);
  });

  it("integra pérdidas patrimoniales", () => {
    const result = simularRenta({
      rendimientosTrabajo: 25000,
      retencionesIRPF: 3000,
      gananciaPatrimonial: [
        { tipo: "acciones", valorVenta: 5000, valorAdquisicion: 10000 },
        { tipo: "acciones", valorVenta: 8000, valorAdquisicion: 3000 },
      ],
    });
    // -5000 + 5000 = 0 neto
    expect(result.detalleGanancias.gananciaAhorro).toBe(0);
  });
});

describe("simularRenta — imputación rentas inmobiliarias", () => {
  it("calcula imputación al 2% del valor catastral", () => {
    const result = simularRenta({
      rendimientosTrabajo: 30000,
      retencionesIRPF: 4000,
      inmueblesNoHabituales: [{
        valorCatastral: 100000,
        catastroRevisado: false,
        diasNoAlquilado: 365,
      }],
    });
    expect(result.detalleImputacion.totalImputacion).toBe(2000); // 100000 * 0.02
  });

  it("aplica 1.1% si catastro revisado", () => {
    const result = simularRenta({
      rendimientosTrabajo: 30000,
      retencionesIRPF: 4000,
      inmueblesNoHabituales: [{
        valorCatastral: 100000,
        catastroRevisado: true,
        diasNoAlquilado: 365,
      }],
    });
    expect(result.detalleImputacion.totalImputacion).toBe(1100); // 100000 * 0.011
  });

  it("prorratea por días no alquilado", () => {
    const result = simularRenta({
      rendimientosTrabajo: 30000,
      retencionesIRPF: 4000,
      inmueblesNoHabituales: [{
        valorCatastral: 100000,
        catastroRevisado: false,
        diasNoAlquilado: 182,
      }],
    });
    expect(result.detalleImputacion.totalImputacion).toBeCloseTo(997.26, 0);
  });
});

describe("simularRenta — autónomos (estimación directa simplificada)", () => {
  it("calcula rendimiento neto con 7% difícil justificación", () => {
    const result = simularRenta({
      autonomo: true,
      ingresoActividad: 50000,
      gastosActividad: 15000,
    });
    // 50000 - 15000 = 35000 neto previo
    // 35000 * 0.07 = 2000 (tope), queda 33000
    expect(result.detalleActividad.dificilJustificacion).toBe(2000);
    expect(result.detalleActividad.rendimientoFinal).toBeGreaterThan(0);
  });

  it("aplica reducción inicio actividad 20%", () => {
    const result = simularRenta({
      autonomo: true,
      ingresoActividad: 30000,
      gastosActividad: 10000,
      inicioActividad: true,
    });
    expect(result.detalleActividad.reduccion).toBeGreaterThan(0);
  });
});

describe("simularRenta — deducciones autonómicas", () => {
  it("aplica deducciones de Madrid (nacimiento)", () => {
    const result = simularRenta({
      rendimientosTrabajo: 30000,
      retencionesIRPF: 4000,
      comunidadAutonoma: "madrid",
      hijos: 1,
    });
    const madridDeds = result.deduccionesAutonomicas.filter(d => d.ccaa === "madrid");
    expect(madridDeds.length).toBeGreaterThan(0);
    expect(madridDeds.some(d => d.concepto.includes("Nacimiento"))).toBe(true);
  });

  it("aplica deducciones de Cataluña (alquiler)", () => {
    const result = simularRenta({
      rendimientosTrabajo: 25000,
      retencionesIRPF: 3000,
      comunidadAutonoma: "cataluna",
      alquiler: true,
      importeAlquiler: 9000,
    });
    const catDeds = result.deduccionesAutonomicas.filter(d => d.ccaa === "cataluna");
    expect(catDeds.some(d => d.concepto.includes("Alquiler"))).toBe(true);
  });

  it("aplica deducciones de Valencia (familia numerosa + hijos)", () => {
    const result = simularRenta({
      rendimientosTrabajo: 35000,
      retencionesIRPF: 5000,
      comunidadAutonoma: "valencia",
      hijos: 3,
      familiaNumerosa: true,
    });
    const valDeds = result.deduccionesAutonomicas.filter(d => d.ccaa === "valencia");
    expect(valDeds.length).toBeGreaterThanOrEqual(2);
  });

  it("aplica tramos autonómicos de Madrid (más bajos)", () => {
    const madridResult = simularRenta({
      rendimientosTrabajo: 50000,
      retencionesIRPF: 7000,
      comunidadAutonoma: "madrid",
    });
    const defaultResult = simularRenta({
      rendimientosTrabajo: 50000,
      retencionesIRPF: 7000,
      comunidadAutonoma: "",
    });
    // Madrid tiene tramos más bajos
    expect(madridResult.cuotaIntegra).toBeLessThan(defaultResult.cuotaIntegra);
  });
});

describe("simularRenta — no residentes", () => {
  it("calcula IRNR para residente UE al 19%", () => {
    const result = simularRenta({
      noResidente: true,
      paisResidencia: "Francia",
      rendimientosTrabajo: 30000,
      retencionesIRPF: 5000,
      dividendos: 2000,
    });
    expect(result.tipo).toBe("no_residente");
    expect(result.esUE).toBe(true);
    expect(result.tipoGeneral).toBe(19);
  });

  it("calcula IRNR para no-UE al 24%", () => {
    const result = simularRenta({
      noResidente: true,
      paisResidencia: "Brasil",
      rendimientosTrabajo: 30000,
      retencionesIRPF: 5000,
    });
    expect(result.tipo).toBe("no_residente");
    expect(result.esUE).toBe(false);
    expect(result.tipoGeneral).toBe(24);
  });
});

describe("compararIndividualVsConjunta — declaración conjunta matrimonios", () => {
  it("compara individual vs conjunta", () => {
    const d1 = { rendimientosTrabajo: 40000, retencionesIRPF: 6000, seguridadSocial: 2500 };
    const d2 = { rendimientosTrabajo: 15000, retencionesIRPF: 1500, seguridadSocial: 1000 };
    const result = compararIndividualVsConjunta(d1, d2);

    expect(result.individual).toBeDefined();
    expect(result.conjunta).toBeDefined();
    expect(result.recomendacion).toBeTruthy();
    expect(result.masConveniente).toMatch(/individual|conjunta|igual/);
    expect(result.diferencia).toBeGreaterThanOrEqual(0);
  });

  it("conjunta incluye reducción de 3.400€", () => {
    const d1 = { rendimientosTrabajo: 30000, retencionesIRPF: 4000 };
    const d2 = { rendimientosTrabajo: 0, retencionesIRPF: 0 };
    const result = compararIndividualVsConjunta(d1, d2);
    expect(result.conjunta.reduccionConjunta).toBe(3400);
  });
});
