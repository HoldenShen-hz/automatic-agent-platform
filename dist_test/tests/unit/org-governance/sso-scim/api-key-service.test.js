import assert from "node:assert/strict";
import test from "node:test";
import { ApiKeyService } from "../../../../src/org-governance/sso-scim/api-key-service.js";
test("ApiKeyService.generateApiKey creates a new API key", () => {
    const service = new ApiKeyService();
    const result = service.generateApiKey({
        name: "Test Key",
        ownerId: "user_123",
        scopes: ["read", "write"],
        createdBy: "admin",
    });
    assert.ok(result.rawKey.startsWith("aa_"), "Raw key should start with aa_");
    assert.equal(result.record.name, "Test Key");
    assert.equal(result.record.ownerId, "user_123");
    assert.deepEqual(result.record.scopes, ["read", "write"]);
    assert.equal(result.record.status, "active");
    assert.ok(result.record.keyId.startsWith("apikey_"));
    assert.equal(result.record.keyPrefix.length, 8);
});
test("ApiKeyService.validateApiKey validates a correct key", () => {
    const service = new ApiKeyService();
    const { record, rawKey } = service.generateApiKey({
        name: "Test Key",
        ownerId: "user_123",
        scopes: ["read"],
        createdBy: "admin",
    });
    const result = service.validateApiKey(rawKey);
    assert.equal(result.valid, true);
    assert.equal(result.keyId, record.keyId);
    assert.equal(result.ownerId, "user_123");
    assert.deepEqual(result.scopes, ["read"]);
});
test("ApiKeyService.validateApiKey rejects an invalid key", () => {
    const service = new ApiKeyService();
    const result = service.validateApiKey("aa_invalid_key");
    assert.equal(result.valid, false);
    assert.equal(result.keyId, null);
    assert.equal(result.reason, "invalid_key");
});
test("ApiKeyService.validateApiKey rejects a revoked key", () => {
    const service = new ApiKeyService();
    const { record, rawKey } = service.generateApiKey({
        name: "Test Key",
        ownerId: "user_123",
        createdBy: "admin",
    });
    service.revokeApiKey(record.keyId, "admin");
    const result = service.validateApiKey(rawKey);
    assert.equal(result.valid, false);
    assert.equal(result.reason, "key_revoked");
});
test("ApiKeyService.validateApiKey rejects an expired key", () => {
    const service = new ApiKeyService();
    const pastDate = "2020-01-01T00:00:00.000Z";
    const { rawKey } = service.generateApiKey({
        name: "Expired Key",
        ownerId: "user_123",
        expiresAt: pastDate,
        createdBy: "admin",
    });
    const result = service.validateApiKey(rawKey);
    assert.equal(result.valid, false);
    assert.equal(result.reason, "key_expired");
});
test("ApiKeyService.revokeApiKey revokes an active key", () => {
    const service = new ApiKeyService();
    const { record } = service.generateApiKey({
        name: "Test Key",
        ownerId: "user_123",
        createdBy: "admin",
    });
    const result = service.revokeApiKey(record.keyId, "admin");
    assert.equal(result, true);
    assert.equal(service.getApiKey(record.keyId)?.status, "revoked");
});
test("ApiKeyService.revokeApiKey returns false for non-existent key", () => {
    const service = new ApiKeyService();
    const result = service.revokeApiKey("non_existent_key", "admin");
    assert.equal(result, false);
});
test("ApiKeyService.listApiKeysForOwner lists keys for owner", () => {
    const service = new ApiKeyService();
    service.generateApiKey({ name: "Key 1", ownerId: "user_123", createdBy: "admin" });
    service.generateApiKey({ name: "Key 2", ownerId: "user_123", createdBy: "admin" });
    service.generateApiKey({ name: "Key 3", ownerId: "other_user", createdBy: "admin" });
    const userKeys = service.listApiKeysForOwner("user_123");
    assert.equal(userKeys.length, 2);
    assert.ok(userKeys.every((k) => k.ownerId === "user_123"));
});
test("ApiKeyService.getApiKey returns key by ID", () => {
    const service = new ApiKeyService();
    const { record } = service.generateApiKey({
        name: "Test Key",
        ownerId: "user_123",
        createdBy: "admin",
    });
    const result = service.getApiKey(record.keyId);
    assert.equal(result?.keyId, record.keyId);
    assert.equal(result?.name, "Test Key");
});
test("ApiKeyService.getApiKey returns null for non-existent key", () => {
    const service = new ApiKeyService();
    const result = service.getApiKey("non_existent_key");
    assert.equal(result, null);
});
test("ApiKeyService.rotateApiKey rotates an active key", () => {
    const service = new ApiKeyService();
    const { record: oldRecord, rawKey: oldRawKey } = service.generateApiKey({
        name: "Test Key",
        ownerId: "user_123",
        scopes: ["read"],
        createdBy: "admin",
    });
    const rotateResult = service.rotateApiKey(oldRecord.keyId, "admin");
    assert.ok(rotateResult !== null);
    assert.notEqual(rotateResult.rawKey, oldRawKey);
    assert.equal(rotateResult.record.name, "Test Key");
    assert.equal(rotateResult.record.status, "active");
    // Old key should be revoked
    const oldKeyValidation = service.validateApiKey(oldRawKey);
    assert.equal(oldKeyValidation.valid, false);
    assert.equal(oldKeyValidation.reason, "key_revoked");
    // New key should be valid
    const newKeyValidation = service.validateApiKey(rotateResult.rawKey);
    assert.equal(newKeyValidation.valid, true);
});
test("ApiKeyService.rotateApiKey returns null for non-existent key", () => {
    const service = new ApiKeyService();
    const result = service.rotateApiKey("non_existent_key", "admin");
    assert.equal(result, null);
});
test("ApiKeyService.rotateApiKey returns null for already revoked key", () => {
    const service = new ApiKeyService();
    const { record } = service.generateApiKey({
        name: "Test Key",
        ownerId: "user_123",
        createdBy: "admin",
    });
    service.revokeApiKey(record.keyId, "admin");
    const result = service.rotateApiKey(record.keyId, "admin");
    assert.equal(result, null);
});
test("ApiKeyService.validateApiKey updates lastUsedAt", () => {
    const service = new ApiKeyService();
    const { record, rawKey } = service.generateApiKey({
        name: "Test Key",
        ownerId: "user_123",
        createdBy: "admin",
    });
    assert.equal(record.lastUsedAt, null);
    service.validateApiKey(rawKey);
    const updated = service.getApiKey(record.keyId);
    assert.ok(updated?.lastUsedAt !== null);
});
test("ApiKeyService.generateApiKey with no scopes defaults to empty array", () => {
    const service = new ApiKeyService();
    const { record } = service.generateApiKey({
        name: "Test Key",
        ownerId: "user_123",
        createdBy: "admin",
    });
    assert.deepEqual(record.scopes, []);
});
test("ApiKeyService.generateApiKey with no expiration defaults to null", () => {
    const service = new ApiKeyService();
    const { record } = service.generateApiKey({
        name: "Test Key",
        ownerId: "user_123",
        createdBy: "admin",
    });
    assert.equal(record.expiresAt, null);
});
//# sourceMappingURL=api-key-service.test.js.map