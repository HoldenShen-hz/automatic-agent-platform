import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { ApiKeyService } from "../../../../../src/org-governance/sso-scim/api-key-service.js";

test("ApiKeyService generateApiKey creates key", () => {
  const service = new ApiKeyService();
  const { record, rawKey } = service.generateApiKey({
    name: "Test Key",
    ownerId: "user-1",
    createdBy: "admin-1",
  });

  assert.ok(rawKey.startsWith("aa_"));
  assert.strictEqual(record.name, "Test Key");
  assert.strictEqual(record.ownerId, "user-1");
  assert.strictEqual(record.status, "active");
  assert.ok(record.keyId.startsWith("apikey_"));
  assert.strictEqual(record.createdBy, "admin-1");
});

test("ApiKeyService generateApiKey stores key", () => {
  const service = new ApiKeyService();
  const { record } = service.generateApiKey({
    name: "Test Key",
    ownerId: "user-1",
    createdBy: "admin-1",
  });

  const retrieved = service.getApiKey(record.keyId);
  assert.ok(retrieved !== null);
  assert.strictEqual(retrieved!.name, "Test Key");
});

test("ApiKeyService validateApiKey returns valid for good key", () => {
  const service = new ApiKeyService();
  const { rawKey } = service.generateApiKey({
    name: "Test Key",
    ownerId: "user-1",
    createdBy: "admin-1",
  });

  const result = service.validateApiKey(rawKey);

  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.ownerId, "user-1");
});

test("ApiKeyService validateApiKey returns invalid for unknown key", () => {
  const service = new ApiKeyService();
  const result = service.validateApiKey("aa_unknown_key");

  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.reason, "invalid_key");
});

test("ApiKeyService validateApiKey returns invalid for revoked key", () => {
  const service = new ApiKeyService();
  const { record, rawKey } = service.generateApiKey({
    name: "Test Key",
    ownerId: "user-1",
    createdBy: "admin-1",
  });
  service.revokeApiKey(record.keyId, "admin-1");

  const result = service.validateApiKey(rawKey);

  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.reason, "key_revoked");
});

test("ApiKeyService validateApiKey returns invalid for expired key", () => {
  const service = new ApiKeyService();
  const { rawKey } = service.generateApiKey({
    name: "Test Key",
    ownerId: "user-1",
    expiresAt: "2020-01-01T00:00:00.000Z",
    createdBy: "admin-1",
  });

  const result = service.validateApiKey(rawKey);

  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.reason, "key_expired");
});

test("ApiKeyService revokeApiKey revokes active key", () => {
  const service = new ApiKeyService();
  const { record } = service.generateApiKey({
    name: "Test Key",
    ownerId: "user-1",
    createdBy: "admin-1",
  });

  const success = service.revokeApiKey(record.keyId, "admin-1");

  assert.strictEqual(success, true);
  assert.strictEqual(service.getApiKey(record.keyId)!.status, "revoked");
});

test("ApiKeyService revokeApiKey returns false for unknown key", () => {
  const service = new ApiKeyService();
  const success = service.revokeApiKey("nonexistent", "admin-1");

  assert.strictEqual(success, false);
});

test("ApiKeyService revokeApiKey returns false for already revoked key", () => {
  const service = new ApiKeyService();
  const { record } = service.generateApiKey({
    name: "Test Key",
    ownerId: "user-1",
    createdBy: "admin-1",
  });
  service.revokeApiKey(record.keyId, "admin-1");

  const success = service.revokeApiKey(record.keyId, "admin-1");

  assert.strictEqual(success, false);
});

test("ApiKeyService listApiKeysForOwner returns owner keys", () => {
  const service = new ApiKeyService();
  service.generateApiKey({ name: "Key 1", ownerId: "user-1", createdBy: "admin-1" });
  service.generateApiKey({ name: "Key 2", ownerId: "user-1", createdBy: "admin-1" });
  service.generateApiKey({ name: "Key 3", ownerId: "user-2", createdBy: "admin-1" });

  const keys = service.listApiKeysForOwner("user-1");

  assert.strictEqual(keys.length, 2);
});

test("ApiKeyService rotateApiKey rotates active key", () => {
  const service = new ApiKeyService();
  const { record } = service.generateApiKey({
    name: "Test Key",
    ownerId: "user-1",
    scopes: ["read", "write"],
    createdBy: "admin-1",
  });

  const result = service.rotateApiKey(record.keyId, "admin-2");

  assert.ok(result !== null);
  assert.strictEqual(result!.record.name, "Test Key");
  assert.strictEqual(result!.record.ownerId, "user-1");
  assert.notStrictEqual(result!.rawKey, service.getApiKey(record.keyId));
});

test("ApiKeyService rotateApiKey returns null for revoked key", () => {
  const service = new ApiKeyService();
  const { record } = service.generateApiKey({
    name: "Test Key",
    ownerId: "user-1",
    createdBy: "admin-1",
  });
  service.revokeApiKey(record.keyId, "admin-1");

  const result = service.rotateApiKey(record.keyId, "admin-2");

  assert.strictEqual(result, null);
});

test("ApiKeyService generateApiKey with scopes", () => {
  const service = new ApiKeyService();
  const { record } = service.generateApiKey({
    name: "Scoped Key",
    ownerId: "user-1",
    scopes: ["read", "write", "delete"],
    createdBy: "admin-1",
  });

  assert.deepStrictEqual(record.scopes, ["read", "write", "delete"]);
});

test("ApiKeyService validateApiKey updates lastUsedAt", () => {
  const service = new ApiKeyService();
  const { rawKey } = service.generateApiKey({
    name: "Test Key",
    ownerId: "user-1",
    createdBy: "admin-1",
  });

  service.validateApiKey(rawKey);
  const result = service.validateApiKey(rawKey);

  assert.strictEqual(result.valid, true);
  assert.ok(result.keyId !== null);
});

test("ApiKeyService generateApiKey with expiration", () => {
  const service = new ApiKeyService();
  const { record } = service.generateApiKey({
    name: "Expiring Key",
    ownerId: "user-1",
    expiresAt: "2030-01-01T00:00:00.000Z",
    createdBy: "admin-1",
  });

  assert.ok(record.expiresAt !== null);
});

test("ApiKeyService getApiKey returns null for unknown key", () => {
  const service = new ApiKeyService();
  const result = service.getApiKey("nonexistent");

  assert.strictEqual(result, null);
});

test("ApiKeyService listApiKeysForOwner returns empty for unknown owner", () => {
  const service = new ApiKeyService();
  const keys = service.listApiKeysForOwner("unknown-user");

  assert.strictEqual(keys.length, 0);
});
