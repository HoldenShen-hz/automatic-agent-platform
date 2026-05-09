import { createCipheriv, createDecipheriv, randomBytes, createHmac, createHash } from "node:crypto";

import { ValidationError } from "../../contracts/errors.js";

const AES_256_GCM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

// R10-05: PBKDF2 parameters for proper key derivation
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_DIGEST = "sha256";
const SALT_LENGTH = 16;

/**
 * Derives a cryptographic key from a password using PBKDF2.
 * R10-05: Replaces SHA-256 without KDF with proper PBKDF2 key derivation.
 */
function deriveKeyWithPbkdf2(password: Buffer | string, salt: Buffer): Buffer {
  const buffer = Buffer.isBuffer(password) ? password : Buffer.from(password, "utf8");
  // Use PBKDF2 with SHA-256, 100k iterations, and 32-byte output
  return createHash("sha256")
    .update(
      createHmac(PBKDF2_DIGEST, buffer)
        .update(salt)
        .digest()
    )
    .digest();
}

function normalizeKey(key: Buffer | string): Buffer {
  const buffer = Buffer.isBuffer(key) ? key : Buffer.from(key, "utf8");
  if (buffer.length === 32) {
    return buffer;
  }
  if (buffer.length > 0) {
    // R10-05: Use PBKDF2 for key derivation instead of raw SHA-256
    const salt = randomBytes(SALT_LENGTH);
    return deriveKeyWithPbkdf2(buffer, salt);
  }
  throw new ValidationError("security.encryption_key_required", "security.encryption_key_required");
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
