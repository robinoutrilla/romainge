// ═══════════════════════════════════════════════════════════════
// lib/nif-validator.js — Validación de NIF/NIE/CIF por voz
// ═══════════════════════════════════════════════════════════════

const NIF_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

// Normalizar texto dictado por voz a formato NIF/NIE/CIF
export function normalizeSpokenNIF(spoken) {
  if (!spoken) return null;

  let text = spoken
    .toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    // Palabras habladas → letras/números
    .replace(/\bCERO\b/g, "0")
    .replace(/\bUNO\b/g, "1")
    .replace(/\bDOS\b/g, "2")
    .replace(/\bTRES\b/g, "3")
    .replace(/\bCUATRO\b/g, "4")
    .replace(/\bCINCO\b/g, "5")
    .replace(/\bSEIS\b/g, "6")
    .replace(/\bSIETE\b/g, "7")
    .replace(/\bOCHO\b/g, "8")
    .replace(/\bNUEVE\b/g, "9")
    .replace(/\bDIEZ\b/g, "10")
    // NATO phonetic alphabet and Spanish equivalents
    .replace(/\bALFA\b/g, "A").replace(/\bBRAVO\b/g, "B")
    .replace(/\bCHARLIE\b/g, "C").replace(/\bDELTA\b/g, "D")
    .replace(/\bECO\b/g, "E").replace(/\bFOXTROT\b/g, "F")
    .replace(/\bGOLF\b/g, "G").replace(/\bHOTEL\b/g, "H")
    .replace(/\bINDIA\b/g, "I").replace(/\bJULIET\b/g, "J")
    .replace(/\bKILO\b/g, "K").replace(/\bLIMA\b/g, "L")
    .replace(/\bMIKE\b/g, "M").replace(/\bNOVEMBER\b/g, "N")
    .replace(/\bOSCAR\b/g, "O").replace(/\bPAPA\b/g, "P")
    .replace(/\bQUEBEC\b/g, "Q").replace(/\bROMEO\b/g, "R")
    .replace(/\bSIERRA\b/g, "S").replace(/\bTANGO\b/g, "T")
    .replace(/\bUNIFORM\b/g, "U").replace(/\bVICTOR\b/g, "V")
    .replace(/\bWHISKEY\b/g, "W").replace(/\bRAYOS\b/g, "X")
    .replace(/\bYANKEE\b/g, "Y").replace(/\bZULU\b/g, "Z")
    // Spanish letter names
    .replace(/\bDE ([A-Z])\b/g, "$1")
    .replace(/\bLA ([A-Z])\b/g, "$1")
    .replace(/\bEQUIS\b/g, "X")
    .replace(/\bIGRIEGA\b/g, "Y")
    .replace(/\bZETA\b/g, "Z")
    .replace(/\bENE\b/g, "N")
    .replace(/\bEFE\b/g, "F")
    .replace(/\bJOTA\b/g, "J")
    .replace(/\bKA\b/g, "K")
    .replace(/\bELE\b/g, "L")
    .replace(/\bEME\b/g, "M")
    .replace(/\bPE\b/g, "P")
    .replace(/\bCU\b/g, "Q")
    .replace(/\bERRE\b/g, "R")
    .replace(/\bESE\b/g, "S")
    .replace(/\bTE\b/g, "T")
    .replace(/\bUVE\b/g, "V")
    .replace(/\bUVE DOBLE\b/g, "W")
    .replace(/\bCE\b/g, "C")
    .replace(/\bBE\b/g, "B")
    .replace(/\bGE\b/g, "G")
    .replace(/\bACHE\b/g, "H")
    // "guión" or "guion" → remove
    .replace(/\bGUIOR?N\b/g, "")
    // Remove spaces, punctuation
    .replace(/[^A-Z0-9]/g, "");

  return text || null;
}

// Validate NIF (DNI español): 8 digits + letter
export function validateNIF(nif) {
  if (!nif || !/^\d{8}[A-Z]$/.test(nif)) return { valid: false, type: null };
  const num = parseInt(nif.slice(0, 8), 10);
  const expectedLetter = NIF_LETTERS[num % 23];
  const actualLetter = nif[8];
  return {
    valid: actualLetter === expectedLetter,
    type: "NIF",
    formatted: nif,
    expectedLetter,
  };
}

// Validate NIE (Número Identidad Extranjero): X/Y/Z + 7 digits + letter
export function validateNIE(nie) {
  if (!nie || !/^[XYZ]\d{7}[A-Z]$/.test(nie)) return { valid: false, type: null };
  const prefix = { X: "0", Y: "1", Z: "2" }[nie[0]];
  const num = parseInt(prefix + nie.slice(1, 8), 10);
  const expectedLetter = NIF_LETTERS[num % 23];
  return {
    valid: nie[8] === expectedLetter,
    type: "NIE",
    formatted: nie,
    expectedLetter,
  };
}

// Validate CIF (Código Identificación Fiscal): letter + 7 digits + control
export function validateCIF(cif) {
  if (!cif || !/^[ABCDEFGHJKLMNPQRSUVW]\d{7}[A-J0-9]$/.test(cif)) {
    return { valid: false, type: null };
  }

  const digits = cif.slice(1, 8);
  let sumA = 0;
  let sumB = 0;

  for (let i = 0; i < 7; i++) {
    const d = parseInt(digits[i], 10);
    if (i % 2 === 0) {
      // Odd positions (1-indexed): multiply by 2
      const doubled = d * 2;
      sumB += doubled > 9 ? doubled - 9 : doubled;
    } else {
      sumA += d;
    }
  }

  const total = sumA + sumB;
  const controlDigit = (10 - (total % 10)) % 10;
  const controlLetter = String.fromCharCode(64 + controlDigit); // A=1, B=2...

  const control = cif[8];
  const letterType = "KPQS".includes(cif[0]); // These always use letter control
  const digitType = "ABEH".includes(cif[0]);   // These always use digit control

  let valid;
  if (letterType) {
    valid = control === controlLetter;
  } else if (digitType) {
    valid = control === String(controlDigit);
  } else {
    valid = control === String(controlDigit) || control === controlLetter;
  }

  return { valid, type: "CIF", formatted: cif };
}

// Auto-detect and validate any Spanish tax ID
export function validateTaxId(input) {
  if (!input || input.length < 8) return { valid: false, type: null, error: "Demasiado corto" };

  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // Try NIE first (starts with X, Y, Z)
  if (/^[XYZ]/.test(clean)) return validateNIE(clean);

  // Try CIF (starts with certain letters)
  if (/^[ABCDEFGHJKLMNPQRSUVW]/.test(clean)) return validateCIF(clean);

  // Try NIF (starts with digit)
  if (/^\d/.test(clean)) return validateNIF(clean);

  return { valid: false, type: null, error: "Formato no reconocido" };
}

// Format spoken NIF for voice readback: "1 2 3 4 5 6 7 8, letra T"
export function formatNIFForVoice(nif) {
  if (!nif) return "";
  const chars = nif.split("");
  const digits = chars.filter(c => /\d/.test(c)).join(", ");
  const letters = chars.filter(c => /[A-Z]/.test(c));
  if (letters.length === 1 && digits) {
    return `${digits}, letra ${letters[0]}`;
  }
  return chars.join(", ");
}
