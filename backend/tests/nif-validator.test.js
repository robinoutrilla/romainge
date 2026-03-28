// ═══════════════════════════════════════════════════════════════
// tests/nif-validator.test.js — Tests para validación NIF/NIE/CIF
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  normalizeSpokenNIF,
  validateNIF,
  validateNIE,
  validateCIF,
  validateTaxId,
  formatNIFForVoice,
} from "../lib/nif-validator.js";

describe("normalizeSpokenNIF — conversión de voz a texto", () => {
  it("normaliza dígitos hablados", () => {
    expect(normalizeSpokenNIF("uno dos tres cuatro cinco seis siete ocho")).toBe("12345678");
  });

  it("normaliza letras habladas en español", () => {
    expect(normalizeSpokenNIF("equis uno dos tres cuatro cinco seis siete te")).toBe("X1234567T");
  });

  it("normaliza alfabeto fonético NATO", () => {
    expect(normalizeSpokenNIF("alfa uno dos tres")).toBe("A123");
  });

  it("elimina espacios y puntuación", () => {
    expect(normalizeSpokenNIF("1 2 3 4 5 6 7 8 T")).toBe("12345678T");
  });

  it("devuelve null para entrada vacía", () => {
    expect(normalizeSpokenNIF("")).toBeNull();
    expect(normalizeSpokenNIF(null)).toBeNull();
  });
});

describe("validateNIF — DNI español", () => {
  it("valida NIF correcto (12345678Z)", () => {
    const result = validateNIF("12345678Z");
    expect(result.valid).toBe(true);
    expect(result.type).toBe("NIF");
  });

  it("rechaza NIF con letra incorrecta", () => {
    const result = validateNIF("12345678A");
    expect(result.valid).toBe(false);
  });

  it("rechaza formato inválido", () => {
    expect(validateNIF("1234567").valid).toBe(false);
    expect(validateNIF("").valid).toBe(false);
    expect(validateNIF(null).valid).toBe(false);
  });

  it("valida NIF 00000000T", () => {
    const result = validateNIF("00000000T");
    expect(result.valid).toBe(true);
  });
});

describe("validateNIE — Extranjeros", () => {
  it("valida NIE correcto (X0000000T)", () => {
    const result = validateNIE("X0000000T");
    expect(result.valid).toBe(true);
    expect(result.type).toBe("NIE");
  });

  it("valida NIE con Y", () => {
    const result = validateNIE("Y0000000Z");
    expect(result.valid).toBe(true);
  });

  it("rechaza NIE con letra incorrecta", () => {
    const result = validateNIE("X0000000A");
    expect(result.valid).toBe(false);
  });

  it("rechaza formato inválido", () => {
    expect(validateNIE("A1234567B").valid).toBe(false);
  });
});

describe("validateCIF — Personas jurídicas", () => {
  it("valida formato CIF", () => {
    const result = validateCIF("A58818501");
    expect(result.type).toBe("CIF");
  });

  it("rechaza formato inválido", () => {
    expect(validateCIF("12345678").valid).toBe(false);
    expect(validateCIF("").valid).toBe(false);
  });
});

describe("validateTaxId — detección automática", () => {
  it("detecta NIF automáticamente", () => {
    const result = validateTaxId("12345678Z");
    expect(result.type).toBe("NIF");
    expect(result.valid).toBe(true);
  });

  it("detecta NIE automáticamente", () => {
    const result = validateTaxId("X0000000T");
    expect(result.type).toBe("NIE");
    expect(result.valid).toBe(true);
  });

  it("detecta CIF automáticamente", () => {
    const result = validateTaxId("A58818501");
    expect(result.type).toBe("CIF");
  });

  it("rechaza texto corto", () => {
    expect(validateTaxId("123").valid).toBe(false);
  });
});

describe("formatNIFForVoice — lectura por voz", () => {
  it("formatea NIF para lectura", () => {
    const result = formatNIFForVoice("12345678Z");
    expect(result).toBe("1, 2, 3, 4, 5, 6, 7, 8, letra Z");
  });

  it("formatea NIE para lectura", () => {
    const result = formatNIFForVoice("X1234567T");
    expect(result).toContain("X");
    expect(result).toContain("T");
  });

  it("maneja entrada vacía", () => {
    expect(formatNIFForVoice("")).toBe("");
    expect(formatNIFForVoice(null)).toBe("");
  });
});
