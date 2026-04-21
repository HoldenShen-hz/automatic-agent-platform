/**
 * @fileoverview API Key Management Service
 *
 * Provides:
 * - API Key CRUD operations
 * - Key validation and lookup
 * - Usage tracking and expiration
 * - Owner-based key management
 *
 * §58 认证体系 - API Key 管理界面
 */
import { createHash, randomBytes } from "node:crypto";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
const KEY_PREFIX_LENGTH = 8;
export class ApiKeyService {
    keys = new Map();
    keyHashIndex = new Map();
    generateApiKey(input) {
        const rawKey = this.generateRawKey();
        const keyHash = this.hashKey(rawKey);
        const keyPrefix = rawKey.substring(0, KEY_PREFIX_LENGTH);
        const record = {
            keyId: newId("apikey"),
            keyHash,
            keyPrefix,
            name: input.name,
            ownerId: input.ownerId,
            scopes: input.scopes ?? [],
            expiresAt: input.expiresAt ?? null,
            lastUsedAt: null,
            createdAt: nowIso(),
            status: "active",
            createdBy: input.createdBy,
        };
        this.keys.set(record.keyId, record);
        this.keyHashIndex.set(keyHash, record.keyId);
        return { record, rawKey };
    }
    validateApiKey(rawKey) {
        const keyHash = this.hashKey(rawKey);
        const keyId = this.keyHashIndex.get(keyHash);
        if (!keyId) {
            return { valid: false, keyId: null, ownerId: null, scopes: [], reason: "invalid_key" };
        }
        const record = this.keys.get(keyId);
        if (!record) {
            return { valid: false, keyId: null, ownerId: null, scopes: [], reason: "key_not_found" };
        }
        if (record.status !== "active") {
            return { valid: false, keyId: record.keyId, ownerId: null, scopes: [], reason: `key_${record.status}` };
        }
        if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
            return { valid: false, keyId: record.keyId, ownerId: null, scopes: [], reason: "key_expired" };
        }
        record.lastUsedAt = nowIso();
        return { valid: true, keyId: record.keyId, ownerId: record.ownerId, scopes: record.scopes };
    }
    revokeApiKey(keyId, revokedBy) {
        const record = this.keys.get(keyId);
        if (!record || record.status !== "active") {
            return false;
        }
        record.status = "revoked";
        this.keyHashIndex.delete(record.keyHash);
        return true;
    }
    listApiKeysForOwner(ownerId) {
        return [...this.keys.values()].filter((k) => k.ownerId === ownerId);
    }
    getApiKey(keyId) {
        return this.keys.get(keyId) ?? null;
    }
    rotateApiKey(keyId, rotatedBy) {
        const existing = this.keys.get(keyId);
        if (!existing || existing.status !== "active") {
            return null;
        }
        existing.status = "revoked";
        this.keyHashIndex.delete(existing.keyHash);
        return this.generateApiKey({
            name: existing.name,
            ownerId: existing.ownerId,
            scopes: existing.scopes,
            expiresAt: existing.expiresAt,
            createdBy: rotatedBy,
        });
    }
    generateRawKey() {
        return `aa_${randomBytes(32).toString("hex")}`;
    }
    hashKey(rawKey) {
        return createHash("sha256").update(rawKey).digest("hex");
    }
}
//# sourceMappingURL=api-key-service.js.map