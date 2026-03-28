// ═══════════════════════════════════════════════════════════════
// lib/electronic-signature.js — Firma electrónica de documentos
// ═══════════════════════════════════════════════════════════════
// Módulo de firma digital compatible con estándares españoles
// (FNMT, XAdES-BES). Usa crypto nativo de Node.js para hash
// SHA-256 y firma RSA. Sin dependencias externas.

import crypto from "crypto";
import fs from "fs/promises";

// ─── Constantes ─────────────────────────────────────────────

const FNMT_URLS = {
  root: "https://www.sede.fnmt.gob.es/certificados",
  personaFisica: "https://www.sede.fnmt.gob.es/certificados/persona-fisica",
  representante: "https://www.sede.fnmt.gob.es/certificados/certificado-de-representante",
  sedeElectronica: "https://www.sede.fnmt.gob.es/certificados/sede-electronica",
  selloElectronico: "https://www.sede.fnmt.gob.es/certificados/sello-electronico",
  solicitud: "https://www.sede.fnmt.gob.es/certificados/persona-fisica/obtener-certificado-software/solicitar-certificado",
  renovacion: "https://www.sede.fnmt.gob.es/certificados/persona-fisica/renovar",
  revocacion: "https://www.sede.fnmt.gob.es/certificados/persona-fisica/revocar",
  verificar: "https://valide.redsara.es/valide/",
};

const CERTIFICATE_OIDS = {
  nif: "2.16.724.1.3.5.3.1.1",           // NIF del titular
  nie: "2.16.724.1.3.5.3.1.2",           // NIE del titular
  cif: "2.16.724.1.3.5.3.2.1",           // CIF de la entidad
  nombre: "2.5.4.42",                     // Given name
  apellidos: "2.5.4.4",                   // Surname
  organizacion: "2.5.4.10",              // Organization
  serialNumber: "2.5.4.5",               // Serial number (NIF/NIE)
  commonName: "2.5.4.3",                 // Common name
  emailAddress: "1.2.840.113549.1.9.1",  // Email
  fnmtPolicy: "1.3.6.1.4.1.5734.3.5",   // FNMT policy OID
};

const SUPPORTED_ALGORITHMS = {
  hash: ["SHA-256", "SHA-384", "SHA-512"],
  signature: ["RSA-SHA256", "RSA-SHA384", "RSA-SHA512"],
  default: { hash: "SHA-256", signature: "RSA-SHA256" },
};

// ─── In-memory signature store ──────────────────────────────

const signatureStore = new Map();

// ─── Document signing ───────────────────────────────────────

/**
 * Firma un documento PDF con metadatos del certificado.
 * Genera hash SHA-256 del contenido y firma RSA (o simulada).
 *
 * @param {string} documentPath — ruta al archivo a firmar
 * @param {object} certificateInfo — { nif, name, org, privateKeyPem? }
 * @returns {object} signatureEnvelope
 */
export async function signDocument(documentPath, certificateInfo) {
  if (!documentPath) throw new Error("documentPath es obligatorio");
  if (!certificateInfo?.nif || !certificateInfo?.name) {
    throw new Error("certificateInfo requiere al menos nif y name");
  }

  const fileBuffer = await fs.readFile(documentPath);
  const documentHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  const signatureId = `SIG-${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();

  let signature;
  if (certificateInfo.privateKeyPem) {
    // Firma RSA real si se proporciona clave privada
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(fileBuffer);
    signer.end();
    signature = signer.sign(certificateInfo.privateKeyPem, "base64");
  } else {
    // Firma simulada (hash HMAC con NIF como clave para determinismo en tests)
    const hmac = crypto.createHmac("sha256", certificateInfo.nif);
    hmac.update(fileBuffer);
    hmac.update(timestamp);
    signature = hmac.digest("base64");
  }

  return {
    signatureId,
    documentHash,
    signature,
    timestamp,
    signerNIF: certificateInfo.nif,
    signerName: certificateInfo.name,
    signerOrg: certificateInfo.org || null,
    algorithm: SUPPORTED_ALGORITHMS.default.signature,
  };
}

// ─── Signature verification ─────────────────────────────────

/**
 * Verifica la firma de un documento previamente firmado.
 *
 * @param {string} documentPath — ruta al archivo firmado
 * @param {object} signatureEnvelope — resultado de signDocument
 * @returns {object} { valid, documentHash, details }
 */
export async function verifySignature(documentPath, signatureEnvelope) {
  if (!documentPath || !signatureEnvelope) {
    throw new Error("documentPath y signatureEnvelope son obligatorios");
  }

  const fileBuffer = await fs.readFile(documentPath);
  const currentHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  const hashMatch = currentHash === signatureEnvelope.documentHash;

  // Si hay clave pública, verificar firma RSA real
  if (signatureEnvelope.publicKeyPem) {
    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(fileBuffer);
    verifier.end();
    const signatureValid = verifier.verify(
      signatureEnvelope.publicKeyPem,
      signatureEnvelope.signature,
      "base64"
    );
    return {
      valid: hashMatch && signatureValid,
      documentHash: currentHash,
      details: {
        hashMatch,
        signatureValid,
        signerNIF: signatureEnvelope.signerNIF,
        timestamp: signatureEnvelope.timestamp,
      },
    };
  }

  // Sin clave pública: solo verificamos integridad del hash
  return {
    valid: hashMatch,
    documentHash: currentHash,
    details: {
      hashMatch,
      signatureValid: null,
      signerNIF: signatureEnvelope.signerNIF,
      timestamp: signatureEnvelope.timestamp,
      note: "Verificación criptográfica requiere clave pública del firmante",
    },
  };
}

// ─── Certificate parsing ────────────────────────────────────

/**
 * Extrae NIF, nombre y organización de un certificado X.509 PEM.
 *
 * @param {string} pemContent — certificado en formato PEM
 * @returns {object} { nif, name, org, email, serialNumber, validFrom, validTo }
 */
export function parseCertificate(pemContent) {
  if (!pemContent || !pemContent.includes("BEGIN CERTIFICATE")) {
    throw new Error("Contenido PEM de certificado no válido");
  }

  try {
    const cert = new crypto.X509Certificate(pemContent);
    const subject = cert.subject;

    // Parsear campos del subject (formato: key=value\n)
    const fields = {};
    for (const line of subject.split("\n")) {
      const [key, ...rest] = line.split("=");
      if (key && rest.length) fields[key.trim()] = rest.join("=").trim();
    }

    // Extraer NIF del serialNumber (formato español: IDCES-12345678A, o directo)
    let nif = null;
    const serial = fields.serialNumber || fields["2.5.4.5"] || "";
    const nifMatch = serial.match(/(?:IDCES-?)?([0-9XYZKLM]\d{7}[A-Z])/i);
    if (nifMatch) nif = nifMatch[1].toUpperCase();

    return {
      nif,
      name: [fields.GN || fields.givenName, fields.SN || fields.surname]
        .filter(Boolean)
        .join(" ") || fields.CN || null,
      org: fields.O || null,
      email: fields.emailAddress || null,
      serialNumber: serial || null,
      commonName: fields.CN || null,
      validFrom: cert.validFrom,
      validTo: cert.validTo,
      issuer: cert.issuer,
      fingerprint: cert.fingerprint256,
    };
  } catch (err) {
    throw new Error(`Error al parsear certificado: ${err.message}`);
  }
}

// ─── FNMT integration helpers ───────────────────────────────

export function getFNMTRegistrationUrl() {
  return {
    url: FNMT_URLS.solicitud,
    steps: [
      "1. Acceder a la sede electrónica de la FNMT",
      "2. Solicitar certificado de persona física",
      "3. Introducir NIF/NIE y datos personales",
      "4. Acudir a una oficina de registro (Hacienda, Seguridad Social, Ayuntamiento)",
      "5. Descargar el certificado una vez acreditada la identidad",
    ],
    requisitos: [
      "DNI/NIE vigente",
      "Navegador compatible (Firefox recomendado)",
      "No es necesario software adicional en sistemas modernos",
    ],
    oficinas: "https://mapaoficinascert.appspot.com/",
  };
}

export function getFNMTRenewalInfo() {
  return {
    url: FNMT_URLS.renovacion,
    validez: "4 años desde la fecha de emisión",
    plazo: "Se puede renovar en los 60 días anteriores a la caducidad",
    steps: [
      "1. Acceder con el certificado actual (aún vigente) a la sede FNMT",
      "2. Solicitar renovación en línea",
      "3. Confirmar datos personales",
      "4. Descargar el nuevo certificado (no requiere acudir presencialmente)",
    ],
    notas: [
      "Si el certificado ya ha caducado, hay que repetir el proceso completo de solicitud",
      "El certificado renovado tiene un nuevo periodo de validez de 4 años",
    ],
  };
}

export function getCertificateTypes() {
  return [
    {
      tipo: "Persona Física",
      descripcion: "Para ciudadanos. Permite firmar, autenticarse en sedes electrónicas y cifrar comunicaciones.",
      url: FNMT_URLS.personaFisica,
      validez: "4 años",
      coste: "Gratuito",
    },
    {
      tipo: "Representante",
      descripcion: "Para administradores o representantes legales de empresas y entidades.",
      url: FNMT_URLS.representante,
      validez: "4 años",
      coste: "14 EUR (IVA incluido)",
    },
    {
      tipo: "Sede Electrónica",
      descripcion: "Para identificar la sede electrónica de una Administración Pública.",
      url: FNMT_URLS.sedeElectronica,
      validez: "4 años",
      coste: "Varía según tipo",
    },
    {
      tipo: "Sello Electrónico",
      descripcion: "Para actuación administrativa automatizada de órganos de la Administración.",
      url: FNMT_URLS.selloElectronico,
      validez: "4 años",
      coste: "Varía según tipo",
    },
  ];
}

// ─── XAdES-BES signature (simplified) ───────────────────────

/**
 * Genera una firma XAdES-BES simplificada (XML).
 * Estándar de firma avanzada para eAdministración española.
 *
 * @param {string} documentHash — hash SHA-256 del documento
 * @param {object} certInfo — { nif, name, org }
 * @returns {string} XML de firma XAdES-BES
 */
export function createXAdESSignature(documentHash, certInfo) {
  if (!documentHash || !certInfo?.nif) {
    throw new Error("documentHash y certInfo.nif son obligatorios");
  }

  const signatureId = `xmldsig-${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();
  const signatureValue = crypto
    .createHmac("sha256", certInfo.nif)
    .update(documentHash + timestamp)
    .digest("base64");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
              xmlns:xades="http://uri.etsi.org/01903/v1.3.2#"
              Id="${signatureId}">
  <ds:SignedInfo>
    <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
    <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
    <ds:Reference URI="">
      <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
      <ds:DigestValue>${documentHash}</ds:DigestValue>
    </ds:Reference>
  </ds:SignedInfo>
  <ds:SignatureValue>${signatureValue}</ds:SignatureValue>
  <ds:KeyInfo>
    <ds:KeyValue>
      <ds:RSAKeyValue>
        <ds:Modulus><!-- Requiere clave real del certificado --></ds:Modulus>
        <ds:Exponent>AQAB</ds:Exponent>
      </ds:RSAKeyValue>
    </ds:KeyValue>
  </ds:KeyInfo>
  <ds:Object>
    <xades:QualifyingProperties Target="#${signatureId}">
      <xades:SignedProperties>
        <xades:SignedSignatureProperties>
          <xades:SigningTime>${timestamp}</xades:SigningTime>
          <xades:SigningCertificate>
            <xades:Cert>
              <xades:IssuerSerial>
                <ds:X509IssuerName>CN=AC FNMT Usuarios, OU=Ceres, O=FNMT-RCM, C=ES</ds:X509IssuerName>
              </xades:IssuerSerial>
            </xades:Cert>
          </xades:SigningCertificate>
          <xades:SignerRole>
            <xades:ClaimedRoles>
              <xades:ClaimedRole>${certInfo.org ? "Representante" : "Persona Física"}</xades:ClaimedRole>
            </xades:ClaimedRoles>
          </xades:SignerRole>
        </xades:SignedSignatureProperties>
        <xades:SignedDataObjectProperties>
          <xades:DataObjectFormat ObjectReference="#${signatureId}-ref">
            <xades:MimeType>application/pdf</xades:MimeType>
          </xades:DataObjectFormat>
        </xades:SignedDataObjectProperties>
      </xades:SignedProperties>
    </xades:QualifyingProperties>
  </ds:Object>
</ds:Signature>`;
}

// ─── Timestamp authority (RFC 3161 mock) ────────────────────

/**
 * Simula una solicitud a una TSA (Timestamp Authority) RFC 3161.
 *
 * @param {string} hash — hash del documento a sellar
 * @returns {object} estructura de timestamp token
 */
export function requestTimestamp(hash) {
  if (!hash) throw new Error("hash es obligatorio");

  const now = new Date();
  const serialNumber = crypto.randomBytes(16).toString("hex");
  const nonce = crypto.randomBytes(8).toString("hex");

  return {
    version: 1,
    status: { status: 0, statusString: "granted" },
    timeStampToken: {
      contentType: "1.2.840.113549.1.7.2", // signedData OID
      content: {
        version: 3,
        digestAlgorithm: "2.16.840.1.101.3.4.2.1", // SHA-256 OID
        messageImprint: hash,
        serialNumber,
        genTime: now.toISOString(),
        nonce,
        tsa: {
          directoryName: "CN=TSA FNMT, OU=Ceres, O=FNMT-RCM, C=ES",
        },
        accuracy: {
          seconds: 1,
          millis: 0,
          micros: 0,
        },
      },
    },
    raw: crypto
      .createHmac("sha256", "tsa-mock-key")
      .update(hash + now.toISOString())
      .digest("base64"),
  };
}

// ─── Signature store (in-memory) ────────────────────────────

/**
 * Obtiene todos los documentos firmados de una sesión.
 *
 * @param {string} sessionId
 * @returns {Array} lista de firmas
 */
export function getSignedDocuments(sessionId) {
  return signatureStore.get(sessionId) || [];
}

/**
 * Registra un documento firmado en la sesión.
 *
 * @param {string} sessionId
 * @param {object} signatureInfo — resultado de signDocument
 * @returns {object} signatureInfo con id de registro
 */
export function addSignedDocument(sessionId, signatureInfo) {
  if (!sessionId || !signatureInfo) {
    throw new Error("sessionId y signatureInfo son obligatorios");
  }

  const entry = {
    ...signatureInfo,
    registeredAt: new Date().toISOString(),
  };

  if (!signatureStore.has(sessionId)) {
    signatureStore.set(sessionId, []);
  }
  signatureStore.get(sessionId).push(entry);

  return entry;
}

/**
 * Limpia las firmas de una sesión (para cleanup/TTL).
 *
 * @param {string} sessionId
 */
export function clearSignedDocuments(sessionId) {
  signatureStore.delete(sessionId);
}

// ─── Exports de constantes ──────────────────────────────────

export { FNMT_URLS, CERTIFICATE_OIDS, SUPPORTED_ALGORITHMS };
