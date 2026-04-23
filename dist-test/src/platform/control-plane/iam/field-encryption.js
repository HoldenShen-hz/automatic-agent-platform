import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ValidationError } from "../../contracts/errors.js";
const AES_256_GCM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
function normalizeKey(key) {
    const buffer = Buffer.isBuffer(key) ? key : Buffer.from(key, "utf8");
    if (buffer.length === 32) {
        return buffer;
    }
    if (buffer.length > 0) {
        return createHash("sha256").update(buffer).digest();
    }
    throw new ValidationError("security.encryption_key_required", "security.encryption_key_required");
}
export function encryptField(plaintext, key) {
    const encryptionKey = normalizeKey(key);
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(AES_256_GCM, encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
}
export function decryptField(ciphertext, key) {
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
//# sourceMappingURL=field-encryption.js.map