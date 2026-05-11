import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from "node:crypto";

import { ValidationError } from "../../contracts/errors.js";

const AES_256_GCM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

// R10-05: PBKDF2 parameters for proper key derivation (RFC 8018)
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_DIGEST = "sha256";
const SALT_LENGTH = 16;

/**
 * R10-05: Derives a cryptographic key from a password using PBKDF2 (RFC 8018).
 * Replaces custom SHA-256 hashing with Node.js crypto.pbkdf2Sync for
 * proper key derivation from arbitrary-length passwords.
 */
function deriveKeyWithPbkdf2(password: Buffer | string, salt: Buffer): Buffer {
  const buffer = Buffer.isBuffer(password) ? password : Buffer.from(password, "utf8");
  // Use Node.js crypto.pbkdf2Sync with RFC 8018 recommended parameters
  return pbkdf2Sync(buffer, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST);
}

function normalizeKey(key: Buffer | string): Buffer {
  const buffer = Buffer.isBuffer(key) ? key : Buffer.from(key, "utf8");
  // R10-05: Require minimum key strength of 128 bits (16 bytes) for encryption
  // Keys shorter than 16 bytes have insufficient entropy and must be rejected
  if (buffer.length < 16) {
    throw new ValidationError("security.encryption_key_too_weak", "security.encryption_key_too_weak");
  }
  if (buffer.length === 32) {
    return buffer;
  }
  // R10-05: Use PBKDF2 for key derivation from passwords/passphrases
  const salt = randomBytes(SALT_LENGTH);
  return deriveKeyWithPbkdf2(buffer, salt);
}

export function encryptField(plaintext: string, key: Buffer | string): string {
  const encryptionKey = normalizeKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(AES_256_GCM, encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptField(ciphertext: string, key: Buffer | string): string {
  const encryptionKey = normalizeKey(key);
  const data = Buffer.from(ciphertext, "base64");
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
