import assert from "node:assert/strict";
import test from "node:test";

import { ApiKeyService } from "../../../../src/org-governance/sso-scim/api-key-service.js";

test("ApiKeyService.generateApiKey creates valid API key", () => {
  const service = new ApiKeyService();

  const { record, rawKey } = service.generateApiKey({
    name: "Test Key",
    ownerId: "owner-123",
    scopes: ["read", "write"],
    createdBy: "admin",
  });

  assert.ok(record.keyId.startsWith("apikey_"));
  assert.ok(rawKey.startsWith("aa_"));
  assert.equal(record.keyPrefix, rawKey.substring(0, 8));
  assert.equal(record.name, "Test Key");
  assert.equal(record.ownerId, "owner-123");
  assert.deepEqual(record.scopes, ["read", "write"]);
  assert.equal(record.status, "active");
  assert.ok(record.createdAt);
  assert.ok(record.expiresAt === null);
  assert.ok(record.lastUsedAt === null);
});

test("ApiKeyService.generateApiKey with expiration", () => {
  const service = new ApiKeyService();
  const expiresAt = new Date(Date.now() + 86400000).toISOString();

  const { record } = service.generateApiKey({
    name: "Expiring Key",
    ownerId: "owner-123",
    expiresAt,
    createdBy: "admin",
  });

  assert.equal(record.expiresAt, expiresAt);
});

test("ApiKeyService.validateApiKey returns valid for legitimate key", () => {
  const service = new ApiKeyService();

  const { rawKey } = service.generateApiKey({
    name: "Test Key",
    ownerId: "owner-123",
    scopes: ["read"],
    createdBy: "admin",
  });

  const result = service.validateApiKey(rawKey);

  assert.equal(result.valid, true);
  assert.ok(result.keyId);
  assert.equal(result.ownerId, "owner-123");
  assert.deepEqual(result.scopes, ["read"]);
});

test("ApiKeyService.validateApiKey updates lastUsedAt", () => {
  const service = new ApiKeyService();

  const { record, rawKey } = service.generateApiKey({
    name: "Test Key",
    ownerId: "owner-123",
    scopes: ["read"],
    createdBy: "admin",
  });

  assert.equal(record.lastUsedAt, null);

  service.validateApiKey(rawKey);
  const updatedRecord = service.getApiKey(record.keyId);

  assert.ok(updatedRecord?.lastUsedAt !== null);
});

test("ApiKeyService.validateApiKey returns invalid for unknown key", () => {
  const service = new ApiKeyService();

  const result = service.validateApiKey("aa_invalidkey123");

  assert.equal(result.valid, false);
  assert.equal(result.reason, "invalid_key");
});

test("ApiKeyService.validateApiKey returns invalid for revoked key", () => {
  const service = new ApiKeyService();

  const { record, rawKey } = service.generateApiKey({
    name: "Test Key",
    ownerId: "owner-123",
    createdBy: "admin",
  });

  service.revokeApiKey(record.keyId, "admin");
  const result = service.validateApiKey(rawKey);

  assert.equal(result.valid, false);
  assert.equal(result.reason, "key_revoked");
});

test("ApiKeyService.validateApiKey returns invalid for expired key", () => {
  const service = new ApiKeyService();

  const { record, rawKey } = service.generateApiKey({
    name: "Expired Key",
    ownerId: "owner-123",
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    createdBy: "admin",
  });

  const result = service.validateApiKey(rawKey);

  assert.equal(result.valid, false);
  assert.equal(result.reason, "key_expired");
  assert.equal(service.getApiKey(record.keyId)?.status, "expired");
});

test("ApiKeyService.revokeApiKey revokes active key", () => {
  const service = new ApiKeyService();

  const { record } = service.generateApiKey({
    name: "Test Key",
    ownerId: "owner-123",
    createdBy: "admin",
  });

  const result = service.revokeApiKey(record.keyId, "admin");

  assert.equal(result, true);
  assert.equal(service.getApiKey(record.keyId)?.status, "revoked");
});

test("ApiKeyService.revokeApiKey returns false for unknown key", () => {
  const service = new ApiKeyService();

  const result = service.revokeApiKey("unknown-key-id", "admin");

  assert.equal(result, false);
});

test("ApiKeyService.listApiKeysForOwner returns owner keys", () => {
  const service = new ApiKeyService();

  service.generateApiKey({ name: "Key 1", ownerId: "owner-a", createdBy: "admin" });
  service.generateApiKey({ name: "Key 2", ownerId: "owner-a", createdBy: "admin" });
  service.generateApiKey({ name: "Key 3", ownerId: "owner-b", createdBy: "admin" });

  const ownerAKeys = service.listApiKeysForOwner("owner-a");
  const ownerBKeys = service.listApiKeysForOwner("owner-b");

  assert.equal(ownerAKeys.length, 2);
  assert.equal(ownerBKeys.length, 1);
});

test("ApiKeyService.getApiKey returns key by ID", () => {
  const service = new ApiKeyService();

  const { record } = service.generateApiKey({
    name: "Test Key",
    ownerId: "owner-123",
    createdBy: "admin",
  });

  const result = service.getApiKey(record.keyId);

  assert.ok(result);
  assert.equal(result.keyId, record.keyId);
});

test("ApiKeyService.getApiKey returns null for unknown ID", () => {
  const service = new ApiKeyService();

  const result = service.getApiKey("unknown-key-id");

  assert.equal(result, null);
});

test("ApiKeyService.rotateApiKey creates new key and revokes old", () => {
  const service = new ApiKeyService();

  const { record: oldRecord, rawKey: oldRawKey } = service.generateApiKey({
    name: "Rotating Key",
    ownerId: "owner-123",
    scopes: ["read", "write"],
    createdBy: "admin",
  });

  const rotationResult = service.rotateApiKey(oldRecord.keyId, "admin");

  assert.ok(rotationResult);
  assert.notEqual(rotationResult.rawKey, oldRawKey);
  assert.equal(oldRecord.status, "revoked");
  assert.equal(rotationResult.record.status, "active");
});

test("ApiKeyService.rotateApiKey returns null for unknown key", () => {
  const service = new ApiKeyService();

  const result = service.rotateApiKey("unknown-key-id", "admin");

  assert.equal(result, null);
});
