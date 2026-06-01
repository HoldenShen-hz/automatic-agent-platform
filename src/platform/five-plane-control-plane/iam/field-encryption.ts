import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

import { ValidationError } from "../../contracts/errors.js";

const AES_256_GCM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

const DERIVED_KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MIN_KEY_BYTES = 32;
const ENVELOPE_VERSION = "fe1";
const FIELD_ENCRYPTION_KEY_ENV = "AA_FIELD_ENCRYPTION_KEY";
const BASE64_PAYLOAD_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function normalizeKeyInput(key: Buffer | string): Buffer {
  const buffer = Buffer.isBuffer(key) ? key : Buffer.from(key, "utf8");
  if (buffer.length < MIN_KEY_BYTES) {
    throw new ValidationError("security.encryption_key_too_weak", "security.encryption_key_too_weak");
  }
  return buffer;
}

export function loadFieldEncryptionKeyFromEnv(env: NodeJS.ProcessEnv = process.env): Buffer {
  const value = env[FIELD_ENCRYPTION_KEY_ENV];
  if (!value?.trim()) {
    throw new ValidationError("security.field_encryption_key_required", "security.field_encryption_key_required");
  }
  return normalizeKeyInput(value.trim());
}

function decodeBase64Payload(value: string): Buffer {
  const trimmed = value.trim();
  if (trimmed.length === 0 || !BASE64_PAYLOAD_PATTERN.test(trimmed)) {
    throw new ValidationError("security.invalid_encrypted_payload", "security.invalid_encrypted_payload");
  }
  const normalized = trimmed.padEnd(trimmed.length + ((4 - trimmed.length % 4) % 4), "=");
  const decoded = Buffer.from(normalized, "base64");
  if (decoded.length === 0 || decoded.toString("base64") !== normalized) {
    throw new ValidationError("security.invalid_encrypted_payload", "security.invalid_encrypted_payload");
  }
  return decoded;
}

function parseEnvelope(ciphertext: string): { salt: Buffer; iv: Buffer; tag: Buffer; encrypted: Buffer } {
  if (!ciphertext.includes(":")) {
    throw new ValidationError("security.invalid_encrypted_payload", "security.invalid_encrypted_payload");
  }

  const parts = ciphertext.split(":");
  if (parts.length !== 2 && parts.length !== 3) {
    throw new ValidationError("security.invalid_encrypted_payload", "security.invalid_encrypted_payload");
  }

  const [version, middle, last] = parts;
  const payload = parts.length === 2 ? middle : last;
  const legacyKeyId = parts.length === 3 ? (middle ?? "") : "";
  if (
    version !== ENVELOPE_VERSION ||
    payload == null ||
    payload.length === 0 ||
    (parts.length === 3 && legacyKeyId.length > 0)
  ) {
    throw new ValidationError("security.invalid_encrypted_payload", "security.invalid_encrypted_payload");
  }

  const data = decodeBase64Payload(payload);
  if (data.length < SALT_LENGTH + IV_BYTES + AUTH_TAG_BYTES) {
    throw new ValidationError("security.invalid_encrypted_payload", "security.invalid_encrypted_payload");
  }

  return {
    salt: data.subarray(0, SALT_LENGTH),
    iv: data.subarray(SALT_LENGTH, SALT_LENGTH + IV_BYTES),
    tag: data.subarray(SALT_LENGTH + IV_BYTES, SALT_LENGTH + IV_BYTES + AUTH_TAG_BYTES),
    encrypted: data.subarray(SALT_LENGTH + IV_BYTES + AUTH_TAG_BYTES),
  };
}

function deriveEncryptionKey(key: Buffer | string, salt: Buffer): Buffer {
  const normalizedKey = normalizeKeyInput(key);
  return scryptSync(
    normalizedKey,
    Buffer.concat([Buffer.from("automatic-agent.field-encryption.v2", "utf8"), salt]),
    DERIVED_KEY_LENGTH,
    {
      N: 1 << 15,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    },
  );
}

export function encryptField(plaintext: string, key: Buffer | string): string {
  const salt = randomBytes(SALT_LENGTH);
  const encryptionKey = deriveEncryptionKey(key, salt);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(AES_256_GCM, encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([salt, iv, tag, encrypted]).toString("base64");
  return `${ENVELOPE_VERSION}:${payload}`;
}

export function decryptField(ciphertext: string, key: Buffer | string): string {
  const { salt, iv, tag, encrypted } = parseEnvelope(ciphertext);
  const encryptionKey = deriveEncryptionKey(key, salt);

  try {
    const decipher = createDecipheriv(AES_256_GCM, encryptionKey, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
  } catch {
    throw new ValidationError("security.invalid_encrypted_payload", "security.invalid_encrypted_payload");
  }
}
