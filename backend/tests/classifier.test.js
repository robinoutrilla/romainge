// ═══════════════════════════════════════════════════════════════
// tests/classifier.test.js — Tests unitarios para el clasificador de intención
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { classifyIntent, SERVICES, SERVICES_MAP } from "../config/services.js";

describe("classifyIntent — clasificación por keywords", () => {
  // ─── Coincidencias directas por keyword ─────────────────────

  it("clasifica 'iva' como impuestos", () => {
    const result = classifyIntent("Tengo una duda sobre el IVA");
    expect(result).not.toBeNull();
    expect(result.id).toBe("impuestos");
  });

  it("clasifica 'irpf' como impuestos", () => {
    const result = classifyIntent("¿Cuánto pago de IRPF?");
    expect(result).not.toBeNull();
    expect(result.id).toBe("impuestos");
  });

  it("clasifica 'importación' como aduanas", () => {
    const result = classifyIntent("Quiero hacer una importación de China");
    expect(result).not.toBeNull();
    expect(result.id).toBe("aduanas");
  });

  it("clasifica 'nif' como censos", () => {
    const result = classifyIntent("Necesito solicitar el NIF provisional");
    expect(result).not.toBeNull();
    expect(result.id).toBe("censos");
  });

  it("clasifica 'certificado' como certificados", () => {
    const result = classifyIntent("Necesito un certificado de estar al corriente");
    expect(result).not.toBeNull();
    expect(result.id).toBe("certificados");
  });

  it("clasifica 'aplazamiento' como recaudación", () => {
    const result = classifyIntent("Quiero un aplazamiento de deuda");
    expect(result).not.toBeNull();
    expect(result.id).toBe("recaudacion");
  });

  it("clasifica 'renta' como renta2025", () => {
    const result = classifyIntent("¿Cuándo es la declaración de la renta?");
    expect(result).not.toBeNull();
    expect(result.id).toBe("renta2025");
  });

  it("clasifica 'borrador' como renta2025", () => {
    const result = classifyIntent("Quiero consultar mi borrador");
    expect(result).not.toBeNull();
    expect(result.id).toBe("renta2025");
  });

  it("clasifica 'cnmc' como cnmc", () => {
    const result = classifyIntent("Tengo una consulta sobre la CNMC");
    expect(result).not.toBeNull();
    expect(result.id).toBe("cnmc");
  });

  it("clasifica 'cita previa' como cita", () => {
    const result = classifyIntent("Necesito pedir cita previa");
    expect(result).not.toBeNull();
    expect(result.id).toBe("cita");
  });

  it("clasifica 'recurso de reposición' como recursos", () => {
    const result = classifyIntent("Quiero presentar un recurso de reposición");
    expect(result).not.toBeNull();
    expect(result.id).toBe("recursos");
  });

  it("clasifica 'ibi' como ibi", () => {
    const result = classifyIntent("¿Cómo puedo reclamar el IBI?");
    expect(result).not.toBeNull();
    expect(result.id).toBe("ibi");
  });

  it("clasifica 'valor catastral' como ibi", () => {
    const result = classifyIntent("Necesito saber mi valor catastral");
    expect(result).not.toBeNull();
    expect(result.id).toBe("ibi");
  });

  it("clasifica 'catastro' como ibi", () => {
    const result = classifyIntent("Consulta en el catastro de mi vivienda");
    expect(result).not.toBeNull();
    expect(result.id).toBe("ibi");
  });

  // ─── Normalización de acentos ───────────────────────────────

  it("funciona sin acentos (recaudacion → recaudación)", () => {
    const result = classifyIntent("Tema de recaudacion");
    expect(result).not.toBeNull();
    expect(result.id).toBe("recaudacion");
  });

  it("funciona con mayúsculas", () => {
    const result = classifyIntent("QUIERO SABER SOBRE EL IVA");
    expect(result).not.toBeNull();
    expect(result.id).toBe("impuestos");
  });

  // ─── Keywords más específicos ganan ─────────────────────────

  it("elige el match más específico (keyword más largo)", () => {
    // "certificado electrónico" (23 chars) vs "certificado" (11 chars)
    const result = classifyIntent("Necesito un certificado electrónico de representante");
    expect(result).not.toBeNull();
    expect(result.id).toBe("cert-electronico");
  });

  it("elige 'denuncia tributaria' sobre 'denuncia'", () => {
    const result = classifyIntent("Quiero poner una denuncia tributaria por fraude fiscal");
    expect(result).not.toBeNull();
    expect(result.id).toBe("denuncia-tributaria");
  });

  // ─── Sin match ──────────────────────────────────────────────

  it("devuelve null para texto sin keywords relevantes", () => {
    const result = classifyIntent("Hola buenas tardes");
    expect(result).toBeNull();
  });

  it("devuelve null para texto vacío", () => {
    const result = classifyIntent("");
    expect(result).toBeNull();
  });

  // ─── Frases naturales complejas ─────────────────────────────

  it("clasifica frases largas correctamente", () => {
    const result = classifyIntent(
      "Buenos días, me gustaría saber cómo puedo solicitar un aplazamiento de la deuda que tengo con Hacienda"
    );
    expect(result).not.toBeNull();
    expect(result.id).toBe("recaudacion");
  });

  it("clasifica con múltiples keywords, prioriza el más fuerte", () => {
    const result = classifyIntent("Quiero pagar el impuesto de sociedades");
    expect(result).not.toBeNull();
    // "impuesto" + "sociedades" → impuestos has stronger combined score
    expect(result.id).toBe("impuestos");
  });

  // ─── Nuevos servicios ─────────────────────────────────────────

  it("clasifica 'modelo 303' como modelo303", () => {
    const result = classifyIntent("Tengo que presentar el modelo 303 del trimestre");
    expect(result).not.toBeNull();
    expect(result.id).toBe("modelo303");
  });

  it("clasifica 'iva trimestral' como modelo303", () => {
    const result = classifyIntent("¿Cómo presento el IVA trimestral?");
    expect(result).not.toBeNull();
    expect(result.id).toBe("modelo303");
  });

  it("clasifica 'autónomo' como autonomos", () => {
    const result = classifyIntent("Soy autónomo y quiero saber mis obligaciones");
    expect(result).not.toBeNull();
    expect(result.id).toBe("autonomos");
  });

  it("clasifica 'modelo 130' como autonomos", () => {
    const result = classifyIntent("¿Cómo relleno el modelo 130?");
    expect(result).not.toBeNull();
    expect(result.id).toBe("autonomos");
  });

  it("clasifica 'tarifa plana' como autonomos", () => {
    const result = classifyIntent("Quiero solicitar la tarifa plana de autónomos");
    expect(result).not.toBeNull();
    expect(result.id).toBe("autonomos");
  });

  it("clasifica 'cuota autónomos' como autonomos", () => {
    const result = classifyIntent("¿Cuánto es la cuota de autónomos este año?");
    expect(result).not.toBeNull();
    expect(result.id).toBe("autonomos");
  });

  // ─── IVA intracomunitario vs nacional ─────────────────────────

  it("clasifica 'iva intracomunitario' como VIES, no impuestos", () => {
    const result = classifyIntent("Tengo una consulta sobre IVA intracomunitario");
    expect(result).not.toBeNull();
    expect(result.id).toBe("vies");
  });

  it("clasifica 'operación intracomunitaria' como VIES", () => {
    const result = classifyIntent("He realizado una operación intracomunitaria con Francia");
    expect(result).not.toBeNull();
    expect(result.id).toBe("vies");
  });

  it("clasifica 'modelo 349' como VIES", () => {
    const result = classifyIntent("¿Cómo presento el modelo 349?");
    expect(result).not.toBeNull();
    expect(result.id).toBe("vies");
  });

  it("clasifica 'adquisición intracomunitaria' como VIES", () => {
    const result = classifyIntent("He hecho una adquisición intracomunitaria de bienes");
    expect(result).not.toBeNull();
    expect(result.id).toBe("vies");
  });
});

describe("SERVICES — integridad del catálogo", () => {
  it("tiene al menos 39 servicios (36 originales + IBI + modelo303 + autonomos)", () => {
    expect(SERVICES.length).toBeGreaterThanOrEqual(39);
  });

  it("todos los servicios tienen campos requeridos", () => {
    for (const svc of SERVICES) {
      expect(svc.id).toBeTruthy();
      expect(svc.digit).toBeTruthy();
      expect(svc.name).toBeTruthy();
      expect(svc.shortName).toBeTruthy();
      expect(svc.agent).toBeTruthy();
      expect(svc.keywords).toBeInstanceOf(Array);
      expect(svc.keywords.length).toBeGreaterThan(0);
    }
  });

  it("no hay IDs duplicados", () => {
    const ids = SERVICES.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("no hay dígitos duplicados", () => {
    const digits = SERVICES.map(s => s.digit);
    expect(new Set(digits).size).toBe(digits.length);
  });

  it("SERVICES_MAP contiene todos los servicios", () => {
    for (const svc of SERVICES) {
      expect(SERVICES_MAP[svc.id]).toBe(svc);
    }
  });

  it("incluye el servicio IBI", () => {
    expect(SERVICES_MAP["ibi"]).toBeDefined();
    expect(SERVICES_MAP["ibi"].agent).toBe("Agente IBI Municipal");
  });

  it("incluye el servicio Modelo 303", () => {
    expect(SERVICES_MAP["modelo303"]).toBeDefined();
    expect(SERVICES_MAP["modelo303"].agent).toBe("Agente IVA 303");
  });

  it("incluye el servicio Autónomos", () => {
    expect(SERVICES_MAP["autonomos"]).toBeDefined();
    expect(SERVICES_MAP["autonomos"].agent).toBe("Agente Autónomos");
  });

  it("VIES tiene keywords de IVA intracomunitario", () => {
    const vies = SERVICES_MAP["vies"];
    expect(vies.keywords).toContain("iva intracomunitario");
    expect(vies.keywords).toContain("operación intracomunitaria");
    expect(vies.keywords).toContain("modelo 349");
  });
});
