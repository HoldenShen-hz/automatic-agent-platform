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
      throw new ValidationError("field_encryption.invalid_ciphertext", "Ciphertext must use enc:fingerprint:iv:authTag:ciphertext format.");
    }
    const [, fingerprint, ivHex, authTagHex, ciphertextHex] = parts;
    if (fingerprint == null || ivHex == null || authTagHex == null || ciphertextHex == null) {
      throw new ValidationError("field_encryption.invalid_ciphertext", "Ciphertext must use enc:fingerprint:iv:authTag:ciphertext format.");
    }
    if (fingerprint !== fingerprintKey(input.keyRef, fingerprint.length)) {
      throw new ValidationError("field_encryption.key_mismatch", "Ciphertext does not match the provided key reference.");
    }

    const decipher = createDecipheriv("aes-256-gcm", deriveEncryptionKey(input.keyRef), Buffer.from(ivHex!, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex!, "hex"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex!, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }
}

function protectValue(value: string, keyRef: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveEncryptionKey(keyRef), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `enc:${fingerprintKey(keyRef)}:${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

function fingerprintKey(keyRef: string, length = 32): string {
  return createHash("sha256").update(keyRef).digest("hex").slice(0, length);
}

function deriveEncryptionKey(keyRef: string): Buffer {
  return createHash("sha256").update(keyRef).digest();
}

function readField(record: Record<string, unknown>, path: string): unknown {
  let cursor: unknown = record;
  for (const token of tokenizeFieldPath(path)) {
    if (typeof token === "number") {
      if (!Array.isArray(cursor)) {
        return undefined;
      }
      cursor = cursor[token];
      continue;
    }
    if (cursor == null || typeof cursor !== "object") {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[token];
  }
  return cursor;
}

function writeField(record: Record<string, unknown>, path: string, value: unknown): void {
  const tokens = tokenizeFieldPath(path);
  let cursor: unknown = record;
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index]!;
    const nextToken = tokens[index + 1]!;
    if (typeof token === "number") {
      if (!Array.isArray(cursor)) {
        return;
      }
      const nextValue = cursor[token];
      if (nextValue == null || typeof nextValue !== "object") {
        cursor[token] = typeof nextToken === "number" ? [] : {};
      }
      cursor = cursor[token];
      continue;
    }

    if (cursor == null || typeof cursor !== "object") {
      return;
    }
    const objectCursor = cursor as Record<string, unknown>;
    const nextValue = objectCursor[token];
    if (nextValue == null || typeof nextValue !== "object") {
      objectCursor[token] = typeof nextToken === "number" ? [] : {};
    }
    cursor = objectCursor[token];
  }

  const lastToken = tokens.at(-1);
  if (lastToken == null) {
    return;
  }
  if (typeof lastToken === "number") {
    if (!Array.isArray(cursor)) {
      return;
    }
    cursor[lastToken] = value;
    return;
  }
  if (cursor == null || typeof cursor !== "object") {
    return;
  }
  (cursor as Record<string, unknown>)[lastToken] = value;
}

function tokenizeFieldPath(path: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  for (const segment of path.split(".")) {
    for (const match of segment.matchAll(/([^[\]]+)|\[(\d+)\]/g)) {
      if (match[1] != null) {
        tokens.push(match[1]);
        continue;
      }
      if (match[2] != null) {
        tokens.push(Number.parseInt(match[2], 10));
      }
    }
  }
  return tokens;
}
