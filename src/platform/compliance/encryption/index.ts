import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

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

interface EncryptionEnvelope {
  readonly v: 1;
  readonly kf: string;
  readonly s: string;
  readonly i: string;
  readonly t: string;
  readonly c: string;
}

const ENCRYPTION_ENVELOPE_PREFIX = "encv1.";
const FIELD_PATH_FORBIDDEN_TOKENS = new Set(["__proto__", "prototype", "constructor"]);

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
    const envelope = parseEncryptionEnvelope(input.ciphertext);
    const salt = decodeBase64UrlStrict(envelope.s, "salt");
    const key = deriveEncryptionKey(input.keyRef, salt);
    if (envelope.kf !== fingerprintKey(key)) {
      throw new ValidationError("field_encryption.key_mismatch", "Ciphertext does not match the provided key reference.");
    }

    const iv = decodeBase64UrlStrict(envelope.i, "iv");
    const authTag = decodeBase64UrlStrict(envelope.t, "auth_tag");
    const ciphertext = decodeBase64UrlStrict(envelope.c, "ciphertext");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }
}

function protectValue(value: string, keyRef: string): string {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveEncryptionKey(keyRef, salt);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return serializeEncryptionEnvelope({
    v: 1,
    kf: fingerprintKey(key),
    s: encodeBase64Url(salt),
    i: encodeBase64Url(iv),
    t: encodeBase64Url(authTag),
    c: encodeBase64Url(ciphertext),
  });
}

function fingerprintKey(key: Buffer): string {
  return createHmac("sha256", key).update("field-encryption:fingerprint:v1", "utf8").digest("hex");
}

function deriveEncryptionKey(keyRef: string, salt: Buffer): Buffer {
  return createHmac("sha256", salt)
    .update("field-encryption:key:v1", "utf8")
    .update("\0", "utf8")
    .update(keyRef, "utf8")
    .digest();
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
  if (path.trim().length === 0) {
    throw new ValidationError("field_encryption.invalid_field_path", "Field path must be non-empty.");
  }
  const tokens: Array<string | number> = [];
  for (const segment of path.split(".")) {
    for (const match of segment.matchAll(/([^[\]]+)|\[(\d+)\]/g)) {
      if (match[1] != null) {
        if (FIELD_PATH_FORBIDDEN_TOKENS.has(match[1])) {
          throw new ValidationError("field_encryption.invalid_field_path", `Forbidden field path token: ${match[1]}`);
        }
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

function serializeEncryptionEnvelope(envelope: EncryptionEnvelope): string {
  return `${ENCRYPTION_ENVELOPE_PREFIX}${encodeBase64Url(Buffer.from(JSON.stringify(envelope), "utf8"))}`;
}

function parseEncryptionEnvelope(ciphertext: string): EncryptionEnvelope {
  if (!ciphertext.startsWith(ENCRYPTION_ENVELOPE_PREFIX)) {
    throw new ValidationError("field_encryption.invalid_ciphertext", "Ciphertext must use the encv1 envelope format.");
  }
  const encoded = ciphertext.slice(ENCRYPTION_ENVELOPE_PREFIX.length);

  let rawJson: string;
  try {
    rawJson = decodeBase64UrlStrict(encoded, "envelope").toString("utf8");
  } catch {
    throw new ValidationError("field_encryption.invalid_ciphertext", "Ciphertext must use the encv1 envelope format.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new ValidationError("field_encryption.invalid_ciphertext", "Ciphertext must use the encv1 envelope format.");
  }

  if (
    typeof parsed !== "object"
    || parsed == null
    || (parsed as Partial<EncryptionEnvelope>).v !== 1
    || typeof (parsed as Partial<EncryptionEnvelope>).kf !== "string"
    || typeof (parsed as Partial<EncryptionEnvelope>).s !== "string"
    || typeof (parsed as Partial<EncryptionEnvelope>).i !== "string"
    || typeof (parsed as Partial<EncryptionEnvelope>).t !== "string"
    || typeof (parsed as Partial<EncryptionEnvelope>).c !== "string"
  ) {
    throw new ValidationError("field_encryption.invalid_ciphertext", "Ciphertext must use the encv1 envelope format.");
  }

  return parsed as EncryptionEnvelope;
}

function encodeBase64Url(value: Buffer): string {
  return value.toString("base64url");
}

function decodeBase64UrlStrict(value: string, label: string): Buffer {
  if (!/^[A-Za-z0-9\-_]+$/.test(value)) {
    throw new ValidationError("field_encryption.invalid_ciphertext", `Ciphertext ${label} must be base64url encoded.`);
  }
  return Buffer.from(value, "base64url");
}
