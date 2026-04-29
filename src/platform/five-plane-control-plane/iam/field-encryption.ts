import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";

import { ValidationError } from "../../contracts/errors.js";

const AES_256_GCM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_LENGTH = 32;
const MIN_PASSPHRASE_BYTES = 16;
const SCRYPT_PARAMS = { N: 2 ** 16, r: 8, p: 1 };
const SCRYPT_MAX_MEMORY_BYTES = 128 * 1024 * 1024;
const ENVELOPE_VERSION = "fe1";

function normalizeKey(key: Buffer | string): Buffer {
  const buffer = Buffer.isBuffer(key) ? key : Buffer.from(key, "utf8");
  if (buffer.length === KEY_LENGTH) {
    return buffer;
  }
  if (buffer.length === 0) {
    throw new ValidationError("security.encryption_key_required", "security.encryption_key_required");
  }
  if (buffer.length < MIN_PASSPHRASE_BYTES) {
    throw new ValidationError("security.encryption_key_too_short", "security.encryption_key_too_short");
  }
  // Use scrypt as a proper KDF (not SHA-256) to derive a key from arbitrary-length input
  // SHA-256 is not a KDF - it lacks salt, cost factors, and memory hardness
  return scryptSync(buffer, "field-encryption-salt", KEY_LENGTH, {
    ...SCRYPT_PARAMS,
    maxmem: SCRYPT_MAX_MEMORY_BYTES,
  });
}

function buildKeyId(encryptionKey: Buffer): string {
  return createHash("sha256").update(encryptionKey).digest("hex").slice(0, 16);
}

function encodeCiphertextPayload(encryptionKey: Buffer, payload: Buffer): string {
  return `${ENVELOPE_VERSION}:${buildKeyId(encryptionKey)}:${payload.toString("base64")}`;
}

function decodeCiphertextPayload(ciphertext: string, encryptionKey: Buffer): Buffer {
  if (!ciphertext.startsWith(`${ENVELOPE_VERSION}:`)) {
    return Buffer.from(ciphertext, "base64");
  }

  const [version, keyId, encodedPayload, ...remainder] = ciphertext.split(":");
  if (version !== ENVELOPE_VERSION || remainder.length > 0 || !keyId || !encodedPayload) {
    throw new ValidationError("security.invalid_encrypted_payload", "security.invalid_encrypted_payload");
  }

  if (keyId !== buildKeyId(encryptionKey)) {
    throw new ValidationError("security.encryption_key_mismatch", "security.encryption_key_mismatch");
  }

  return Buffer.from(encodedPayload, "base64");
}

export function encryptField(plaintext: string, key: Buffer | string): string {
  const encryptionKey = normalizeKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(AES_256_GCM, encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return encodeCiphertextPayload(encryptionKey, Buffer.concat([iv, tag, encrypted]));
}

export function decryptField(ciphertext: string, key: Buffer | string): string {
  const encryptionKey = normalizeKey(key);
  const data = decodeCiphertextPayload(ciphertext, encryptionKey);
  if (data.length < IV_BYTES + AUTH_TAG_BYTES) {
    throw new ValidationError("security.invalid_encrypted_payload", "security.invalid_encrypted_payload");
  }
  const iv = data.subarray(0, IV_BYTES);
  const tag = data.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const encrypted = data.subarray(IV_BYTES + AUTH_TAG_BYTES);
  const decipher = createDecipheriv(AES_256_GCM, encryptionKey, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
}
