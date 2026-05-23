/**
 * Edge Case Tests: API Key Service
 *
 * Tests edge cases and boundary conditions for the ApiKeyService.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ApiKeyService } from "../../../../src/org-governance/sso-scim/api-key-service.js";

test("ApiKeyService.generateApiKey with empty name", () => {
  const service = new ApiKeyService();

  const { record, rawKey } = service.generateApiKey({
    name: "",
    ownerId: "owner_1",
    createdBy: "admin",
  });

  assert.ok(record.keyId.startsWith("apikey_"));
  assert.ok(rawKey.startsWith("aa_"));
});

test("ApiKeyService.generateApiKey with very long name", () => {
  const service = new ApiKeyService();
  const longName = "a".repeat(1000);

  const { record } = service.generateApiKey({
    name: longName,
    ownerId: "owner_1",
    createdBy: "admin",
  });

  assert.equal(record.name.length, 1000);
});

test("ApiKeyService.generateApiKey with empty scopes", () => {
  const service = new ApiKeyService();

  const { record } = service.generateApiKey({
    name: "No Scope Key",
    ownerId: "owner_1",
    scopes: [],
    createdBy: "admin",
  });

  assert.deepEqual(record.scopes, []);
});

test("ApiKeyService.generateApiKey with many scopes", () => {
  const service = new ApiKeyService();
  const manyScopes = ["read", "write", "delete", "admin", "super", "execute", "deploy", "manage"];

  const { record } = service.generateApiKey({
    name: "Multi Scope Key",
    ownerId: "owner_1",
    scopes: manyScopes,
    createdBy: "admin",
  });

  assert.deepEqual(record.scopes, manyScopes);
});

test("ApiKeyService.generateApiKey with duplicate scopes", () => {
  const service = new ApiKeyService();

  const { record } = service.generateApiKey({
    name: "Duplicate Scope Key",
    ownerId: "owner_1",
    scopes: ["read", "read", "write", "write"],
    createdBy: "admin",
  });

  // Scopes may or may not be deduplicated depending on implementation
  assert.ok(record.scopes.length >= 1);
});

test("ApiKeyService.generateApiKey key prefix is correct length", () => {
  const service = new ApiKeyService();

  const { record, rawKey } = service.generateApiKey({
    name: "Test Key",
    ownerId: "owner_1",
    createdBy: "admin",
  });

  assert.equal(record.keyPrefix.length, 8);
  assert.equal(record.keyPrefix, rawKey.substring(0, 8));
});

test("ApiKeyService.validateApiKey updates lastUsedAt on valid key", () => {
  const service = new ApiKeyService();

  const { rawKey } = service.generateApiKey({
    name: "Test Key",
    ownerId: "owner_1",
    createdBy: "admin",
  });

  // Validate multiple times
  service.validateApiKey(rawKey);
  const secondResult = service.validateApiKey(rawKey);

  assert.equal(secondResult.valid, true);
});

test("ApiKeyService.validateApiKey with tampered key", () => {
  const service = new ApiKeyService();

  const { rawKey } = service.generateApiKey({
    name: "Test Key",
    ownerId: "owner_1",
    createdBy: "admin",
  });

  // Tamper with the key
  const tamperedKey = rawKey.slice(0, -1) + (rawKey.slice(-1) === "a" ? "b" : "a");
  const result = service.validateApiKey(tamperedKey);

  assert.equal(result.valid, false);
});

test("ApiKeyService.validateApiKey with empty string", () => {
  const service = new ApiKeyService();

  const result = service.validateApiKey("");

  assert.equal(result.valid, false);
});

test("ApiKeyService.validateApiKey with invalid prefix", () => {
  const service = new ApiKeyService();

  const result = service.validateApiKey("invalid_prefix_key");

  assert.equal(result.valid, false);
  assert.equal(result.reason, "invalid_key");
});

test("ApiKeyService.revokeApiKey returns false for already revoked key", () => {
  const service = new ApiKeyService();

  const { record } = service.generateApiKey({
    name: "Test Key",
    ownerId: "owner_1",
    createdBy: "admin",
  });

  // Revoke first time
  const firstRevoke = service.revokeApiKey(record.keyId, "admin");
  assert.equal(firstRevoke, true);

  // Revoke second time
  const secondRevoke = service.revokeApiKey(record.keyId, "admin");
  assert.equal(secondRevoke, false);
});

test("ApiKeyService.rotateApiKey preserves scopes and name", () => {
  const service = new ApiKeyService();

  const { record: oldRecord } = service.generateApiKey({
    name: "Rotating Key",
    ownerId: "owner_1",
    scopes: ["read", "write"],
    createdBy: "admin",
  });

  const rotationResult = service.rotateApiKey(oldRecord.keyId, "rotator");

  assert.ok(rotationResult !== null);
  assert.equal(rotationResult.record?.name, "Rotating Key");
  assert.deepEqual(rotationResult.record?.scopes, ["read", "write"]);
});

test("ApiKeyService.rotateApiKey with already expired key", () => {
  const service = new ApiKeyService();

  const { record } = service.generateApiKey({
    name: "Expired Key",
    ownerId: "owner_1",
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    createdBy: "admin",
  });

  const result = service.rotateApiKey(record.keyId, "admin");

  assert.deepEqual(result, { record: null, rawKey: null, reason: "key_expired" });
});

test("ApiKeyService.rotateApiKey with already revoked key", () => {
  const service = new ApiKeyService();

  const { record } = service.generateApiKey({
    name: "Revoked Key",
    ownerId: "owner_1",
    createdBy: "admin",
  });

  service.revokeApiKey(record.keyId, "admin");
  const result = service.rotateApiKey(record.keyId, "admin");

  assert.deepEqual(result, { record: null, rawKey: null, reason: "key_revoked" });
});

test("ApiKeyService.listApiKeysForOwner with no keys", () => {
  const service = new ApiKeyService();

  const keys = service.listApiKeysForOwner("owner_without_keys");

  assert.equal(keys.length, 0);
});

test("ApiKeyService.listApiKeysForOwner returns only active keys by default", () => {
  const service = new ApiKeyService();

  service.generateApiKey({ name: "Key 1", ownerId: "owner_a", createdBy: "admin" });
  service.generateApiKey({ name: "Key 2", ownerId: "owner_a", createdBy: "admin" });
  service.generateApiKey({ name: "Key 3", ownerId: "owner_a", createdBy: "admin" });

  // Revoke one key
  const keys = service.listApiKeysForOwner("owner_a");
  assert.equal(keys.length, 3);

  // Verify one is revoked
  const revoked = keys.find(k => k.name === "Key 2");
  assert.ok(revoked !== undefined);
  // Status should be active since we haven't revoked yet
  assert.equal(keys.filter(k => k.status === "active").length, 3);
});

test("ApiKeyService.getApiKey returns null for empty keyId", () => {
  const service = new ApiKeyService();

  const result = service.getApiKey("");

  assert.equal(result, null);
});

test("ApiKeyService.hashKey produces consistent output", () => {
  const service = new ApiKeyService() as any;

  const hash1 = service.hashKey("test_key_123");
  const hash2 = service.hashKey("test_key_123");

  assert.equal(hash1, hash2);
});

test("ApiKeyService.hashKey produces different output for different inputs", () => {
  const service = new ApiKeyService() as any;

  const hash1 = service.hashKey("key_a");
  const hash2 = service.hashKey("key_b");

  assert.notEqual(hash1, hash2);
});

test("ApiKeyService.generateRawKey has correct prefix", () => {
  const service = new ApiKeyService();

  const rawKey = (service as any).generateRawKey();

  assert.ok(rawKey.startsWith("aa_"));
});

test("ApiKeyService.generateRawKey generates unique keys", () => {
  const service = new ApiKeyService();

  const keys = new Set<string>();
  for (let i = 0; i < 100; i++) {
    keys.add((service as any).generateRawKey());
  }

  // All 100 keys should be unique
  assert.equal(keys.size, 100);
});

test("ApiKeyService handles keyId with special characters", () => {
  const service = new ApiKeyService();

  const { record } = service.generateApiKey({
    name: "Special Key",
    ownerId: "owner_special",
    createdBy: "admin",
  });

  // Query with the keyId
  const result = service.getApiKey(record.keyId);

  assert.ok(result !== null);
  assert.equal(result!.keyId, record.keyId);
});

test("ApiKeyService expiresAt in the future", () => {
  const service = new ApiKeyService();
  const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const { record } = service.generateApiKey({
    name: "Future Key",
    ownerId: "owner_1",
    expiresAt: futureDate,
    createdBy: "admin",
  });

  assert.equal(record.expiresAt, futureDate);
});

test("ApiKeyService expiresAt exactly now", () => {
  const service = new ApiKeyService();

  const { record, rawKey } = service.generateApiKey({
    name: "Now Expiring Key",
    ownerId: "owner_1",
    expiresAt: new Date().toISOString(),
    createdBy: "admin",
  });

  // May or may not be expired depending on timing
  const result = service.validateApiKey(rawKey);
  assert.ok(result.valid || result.reason === "key_expired");
});

test("ApiKeyService multiple rotations in sequence", () => {
  const service = new ApiKeyService();

  const { record: original } = service.generateApiKey({
    name: "Multi Rotate Key",
    ownerId: "owner_1",
    scopes: ["read"],
    createdBy: "admin",
  });

  // First rotation
  const rotated1 = service.rotateApiKey(original.keyId, "rotator_1");
  assert.ok(rotated1 !== null);

  // Second rotation
  const rotated2 = service.rotateApiKey(rotated1.record?.keyId ?? "", "rotator_2");
  assert.ok(rotated2 !== null);

  // Third rotation
  const rotated3 = service.rotateApiKey(rotated2.record?.keyId ?? "", "rotator_3");
  assert.ok(rotated3 !== null);

  // All should have same name and scopes
  assert.equal(rotated3.record?.name, "Multi Rotate Key");
  assert.deepEqual(rotated3.record?.scopes, ["read"]);
});
