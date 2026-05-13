import { createCipheriv, createDecipheriv, createHash, pbkdf2Sync, randomBytes } from "node:crypto";

import { ValidationError } from "../../contracts/errors.js";

const AES_256_GCM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

// R10-05: PBKDF2 parameters for proper key derivation (RFC 8018)
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_DIGEST = "sha256";
const SALT_LENGTH = 16;
const ENVELOPE_VERSION = "fe1";
const KEY_ID_HEX_LENGTH = 16;

/**
 * R10-05: Derives a cryptographic key from a password using PBKDF2 (RFC 8018).
 * Replaces custom SHA-256 hashing with Node.js crypto.pbkdf2Sync for
 * proper key derivation from arbitrary-length passwords.
 */
function deriveKeyWithPbkdf2(password: Buffer, salt: Buffer): Buffer {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST);
}

function normalizeKeyInput(key: Buffer | string): Buffer {
  const buffer = Buffer.isBuffer(key) ? key : Buffer.from(key, "utf8");
  if (Buffer.isBuffer(key) && buffer.length < 16) {
    throw new ValidationError("security.encryption_key_too_weak", "security.encryption_key_too_weak");
  }
  return buffer;
}

function buildKeyId(key: Buffer): string {
  return createHash("sha256").update(key).digest("hex").slice(0, KEY_ID_HEX_LENGTH);
}

function decodeBase64Payload(value: string): Buffer {
  try {
    return Buffer.from(value, "base64");
  } catch {
    throw new ValidationError("security.invalid_encrypted_payload", "security.invalid_encrypted_payload");
  }
}

function parseEnvelope(ciphertext: string): { salt: Buffer; iv: Buffer; tag: Buffer; encrypted: Buffer } {
  if (!ciphertext.includes(":")) {
    const legacyData = decodeBase64Payload(ciphertext);
    if (legacyData.length < IV_BYTES + AUTH_TAG_BYTES) {
      throw new ValidationError("security.invalid_encrypted_payload", "security.invalid_encrypted_payload");
    }
    return {
      salt: Buffer.alloc(0),
      iv: legacyData.subarray(0, IV_BYTES),
      tag: legacyData.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES),
      encrypted: legacyData.subarray(IV_BYTES + AUTH_TAG_BYTES),
    };
  }

  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new ValidationError("security.invalid_encrypted_payload", "security.invalid_encrypted_payload");
  }

  const [version, keyId, payload] = parts as [string, string, string];
  if (version !== ENVELOPE_VERSION || keyId.length === 0 || payload.length === 0) {
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
  if (salt.length === 0 && normalizedKey.length === PBKDF2_KEY_LENGTH) {
    return normalizedKey;
  }
  return deriveKeyWithPbkdf2(normalizedKey, salt);
}

export function encryptField(plaintext: string, key: Buffer | string): string {
  const normalizedKey = normalizeKeyInput(key);
  const salt = randomBytes(SALT_LENGTH);
  const encryptionKey = deriveKeyWithPbkdf2(normalizedKey, salt);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(AES_256_GCM, encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([salt, iv, tag, encrypted]).toString("base64");
  return `${ENVELOPE_VERSION}:${buildKeyId(normalizedKey)}:${payload}`;
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
