import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { ValidationError } from "../../contracts/errors.js";

export interface FieldProtectionRule {
  fieldPath: string;
  classification: "internal" | "confidential" | "restricted";
}

export interface ProtectedField {
  fieldPath: string;
  ciphertext: string;
  keyRef: string;
  classification: FieldProtectionRule["classification"];
}

export interface FieldProtectionResult {
  protectedRecord: Record<string, unknown>;
  protectedFields: ProtectedField[];
}

export class FieldEncryptionService {
  public protectRecord(input: {
    record: Record<string, unknown>;
    rules: FieldProtectionRule[];
    keyRef: string;
  }): FieldProtectionResult {
    if (input.keyRef.trim().length === 0) {
      throw new ValidationError("field_encryption.missing_key_ref", "Field encryption requires a non-empty key reference.");
    }
    const protectedRecord = structuredClone(input.record) as Record<string, unknown>;
    const protectedFields: ProtectedField[] = [];

    for (const rule of input.rules) {
      const value = readField(input.record, rule.fieldPath);
      if (typeof value !== "string" || value.length === 0) {
        continue;
      }
      const ciphertext = protectValue(value, input.keyRef);
      writeField(protectedRecord, rule.fieldPath, ciphertext);
      protectedFields.push({
        fieldPath: rule.fieldPath,
        ciphertext,
        keyRef: input.keyRef,
        classification: rule.classification,
      });
    }

    return { protectedRecord, protectedFields };
  }

  public revealField(input: { ciphertext: string; keyRef: string }): string {
    const parts = input.ciphertext.split(":");
    if (parts.length !== 5 || parts[0] !== "enc") {
      throw new ValidationError("field_encryption.invalid_ciphertext", "Ciphertext is not in enc:fingerprint:iv:authTag:ciphertext format.");
    }
    const [, fingerprint, ivHex, authTagHex, ciphertextHex] = parts;
    if (fingerprint !== fingerprintKey(input.keyRef)) {
      throw new ValidationError("field_encryption.key_mismatch", "Ciphertext does not match the provided key reference.");
    }
    if (!isHex(ivHex, 24) || !isHex(authTagHex, 32) || !isHex(ciphertextHex)) {
      throw new ValidationError("field_encryption.invalid_ciphertext", "Ciphertext contains malformed AES-GCM components.");
    }

    try {
      const decipher = createDecipheriv("aes-256-gcm", deriveEncryptionKey(input.keyRef), Buffer.from(ivHex, "hex"));
      decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(ciphertextHex, "hex")),
        decipher.final(),
      ]);
      return plaintext.toString("utf8");
    } catch {
      throw new ValidationError("field_encryption.decrypt_failed", "Ciphertext authentication failed or key reference is invalid.");
    }
  }
}

function protectValue(value: string, keyRef: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveEncryptionKey(keyRef), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:${fingerprintKey(keyRef)}:${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

function fingerprintKey(keyRef: string): string {
  return createHash("sha256").update(keyRef).digest("hex").slice(0, 12);
}

function deriveEncryptionKey(keyRef: string): Buffer {
  return createHash("sha256").update(`field-encryption:${keyRef}`).digest();
}

function isHex(value: string | undefined, expectedLength?: number): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  if (expectedLength !== undefined && value.length !== expectedLength) {
    return false;
  }
  return /^[0-9a-f]+$/i.test(value);
}

function readField(record: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((cursor, segment) => {
    if (cursor == null || typeof cursor !== "object") {
      return undefined;
    }
    return (cursor as Record<string, unknown>)[segment];
  }, record);
}

function writeField(record: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split(".");
  let cursor: Record<string, unknown> = record;
  for (const segment of segments.slice(0, -1)) {
    const next = cursor[segment];
    if (next == null || typeof next !== "object" || Array.isArray(next)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[segments.at(-1)!] = value;
}
