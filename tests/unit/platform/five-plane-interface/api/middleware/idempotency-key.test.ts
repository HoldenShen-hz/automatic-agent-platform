import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  IdempotencyKeyMiddleware,
  WRITE_METHODS,
  extractIdempotencyKey,
  createIdempotencyKeyMiddleware,
  getGlobalIdempotencyKeyMiddleware,
  resetGlobalIdempotencyKeyMiddleware,
  buildIdempotencyErrorResponse,
  DEFAULT_IDEMPOTENCY_KEY_CONFIG,
  type IdempotencyKeyConfig,
} from "../../../../../../src/platform/five-plane-interface/api/middleware/idempotency-key.js";
import { InMemoryIdempotencyStorage } from "../../../../../../src/platform/five-plane-interface/api/middleware/idempotency-key-storage.js";

test("WRITE_METHODS contains correct methods", () => {
  assert.ok(WRITE_METHODS.has("POST"));
  assert.ok(WRITE_METHODS.has("PUT"));
  assert.ok(WRITE_METHODS.has("PATCH"));
  assert.ok(WRITE_METHODS.has("DELETE"));
  assert.ok(!WRITE_METHODS.has("GET"));
  assert.ok(!WRITE_METHODS.has("OPTIONS"));
});

test("IdempotencyKeyMiddleware.isWriteOperation returns true for write methods", () => {
  const middleware = new IdempotencyKeyMiddleware();
  assert.equal(middleware.isWriteOperation("POST"), true);
  assert.equal(middleware.isWriteOperation("PUT"), true);
  assert.equal(middleware.isWriteOperation("PATCH"), true);
  assert.equal(middleware.isWriteOperation("DELETE"), true);
});

test("IdempotencyKeyMiddleware.isWriteOperation returns false for read methods", () => {
  const middleware = new IdempotencyKeyMiddleware();
  assert.equal(middleware.isWriteOperation("GET"), false);
  assert.equal(middleware.isWriteOperation("HEAD"), false);
  assert.equal(middleware.isWriteOperation("OPTIONS"), false);
});

test("IdempotencyKeyMiddleware returns error when key required but missing for write", async () => {
  const middleware = new IdempotencyKeyMiddleware({ required: true });
  const result = await middleware.check({ method: "POST" });
  assert.equal(result.allowed, false);
  assert.equal(result.error?.statusCode, 400);
  assert.ok(result.error?.code.includes("idempotency_key_required"));
});

test("IdempotencyKeyMiddleware allows read operations without key", async () => {
  const middleware = new IdempotencyKeyMiddleware({ required: true });
  const result = await middleware.check({ method: "GET" });
  assert.equal(result.allowed, true);
  assert.equal(result.isDuplicate, false);
});

test("IdempotencyKeyMiddleware allows write when key not required", async () => {
  const middleware = new IdempotencyKeyMiddleware({ required: false });
  const result = await middleware.check({ method: "POST" });
  assert.equal(result.allowed, true);
  assert.equal(result.isDuplicate, false);
});

test("IdempotencyKeyMiddleware returns cached response for duplicate", async () => {
  const middleware = new IdempotencyKeyMiddleware();
  await middleware.check({ method: "POST", idempotencyKey: "key-123", tenantId: "tenant-1" });
  await middleware.record({ method: "POST", idempotencyKey: "key-123", tenantId: "tenant-1", statusCode: 201, responseBody: { id: 1 } });

  const result = await middleware.check({ method: "POST", idempotencyKey: "key-123", tenantId: "tenant-1" });
  assert.equal(result.allowed, true);
  assert.equal(result.isDuplicate, true);
  assert.deepEqual(result.cachedResponse?.body, { id: 1 });
});

test("IdempotencyKeyMiddleware blocks duplicate request while original request is in flight", async () => {
  const middleware = new IdempotencyKeyMiddleware();
  const first = await middleware.check({ method: "POST", idempotencyKey: "key-in-flight", tenantId: "tenant-1" });
  const second = await middleware.check({ method: "POST", idempotencyKey: "key-in-flight", tenantId: "tenant-1" });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
  assert.equal(second.isDuplicate, true);
  assert.equal(second.requestInFlight, true);
  assert.equal(second.error?.statusCode, 409);
});

test("IdempotencyKeyMiddleware detects method conflict with same key", async () => {
  const middleware = new IdempotencyKeyMiddleware();
  await middleware.check({ method: "POST", idempotencyKey: "key-123", tenantId: "tenant-1" });
  await middleware.record({ method: "POST", idempotencyKey: "key-123", tenantId: "tenant-1", statusCode: 201, responseBody: {} });

  const result = await middleware.check({ method: "PUT", idempotencyKey: "key-123", tenantId: "tenant-1" });
  assert.equal(result.allowed, false);
  assert.equal(result.error?.statusCode, 409);
  assert.equal(result.error?.message.includes("key-123"), false);
});

test("IdempotencyKeyMiddleware generates per-tenant storage key", async () => {
  const middleware = new IdempotencyKeyMiddleware({ perTenant: true });
  await middleware.check({ method: "POST", idempotencyKey: "key-123", tenantId: "tenant-1" });
  await middleware.record({ method: "POST", idempotencyKey: "key-123", tenantId: "tenant-1", statusCode: 201, responseBody: {} });

  // Same key with different tenant should be allowed
  const result = await middleware.check({ method: "POST", idempotencyKey: "key-123", tenantId: "tenant-2" });
  assert.equal(result.isDuplicate, false);
});

test("IdempotencyKeyMiddleware.cleanup removes expired entries", async () => {
  const middleware = new IdempotencyKeyMiddleware({ ttlMs: 1 }); // 1ms TTL
  await middleware.check({ method: "POST", idempotencyKey: "key-123" });
  await new Promise((resolve) => setTimeout(resolve, 10));
  await middleware.cleanup();
  assert.equal(middleware.size(), 0);
});

test("IdempotencyKeyMiddleware.clearAll removes all entries", async () => {
  const middleware = new IdempotencyKeyMiddleware();
  await middleware.check({ method: "POST", idempotencyKey: "key-1" });
  await middleware.check({ method: "POST", idempotencyKey: "key-2" });
  assert.equal(middleware.size(), 2);

  middleware.clearAll();
  assert.equal(middleware.size(), 0);
});

test("IdempotencyKeyMiddleware.size returns entry count", async () => {
  const middleware = new IdempotencyKeyMiddleware();
  assert.equal(middleware.size(), 0);

  await middleware.check({ method: "POST", idempotencyKey: "key-1" });
  assert.equal(middleware.size(), 1);

  await middleware.check({ method: "POST", idempotencyKey: "key-2" });
  assert.equal(middleware.size(), 2);
});

test("InMemoryIdempotencyStorage evicts oldest entry when maxEntries is reached", async () => {
  const storage = new InMemoryIdempotencyStorage({ maxEntries: 1 });
  await storage.set("old", { method: "POST", statusCode: 200, responseBody: "{}", requestHash: null }, 60_000);
  await storage.set("new", { method: "POST", statusCode: 201, responseBody: "{}", requestHash: null }, 60_000);

  assert.equal(await storage.get("old"), null);
  assert.equal((await storage.get("new"))?.statusCode, 201);
});

test("InMemoryIdempotencyStorage reserves a pending key atomically", async () => {
  const storage = new InMemoryIdempotencyStorage();
  const first = await storage.reservePending("pending", "POST", 60_000);
  const second = await storage.reservePending("pending", "POST", 60_000);

  assert.equal(first.acquired, true);
  assert.equal(second.acquired, false);
  assert.equal(second.entry?.statusCode, 0);
});

test("extractIdempotencyKey returns header value", () => {
  const headers = { "idempotency-key": "key-123" };
  const result = extractIdempotencyKey(headers);
  assert.equal(result, "key-123");
});

test("extractIdempotencyKey returns first value from array", () => {
  const headers = { "idempotency-key": ["key-123", "key-456"] };
  const result = extractIdempotencyKey(headers);
  assert.equal(result, "key-123");
});

test("extractIdempotencyKey returns undefined when missing", () => {
  const headers = {};
  const result = extractIdempotencyKey(headers);
  assert.equal(result, undefined);
});

test("extractIdempotencyKey uses custom header name", () => {
  const headers = { "x-idempotency": "key-123" };
  const result = extractIdempotencyKey(headers, "X-Idempotency");
  assert.equal(result, "key-123");
});

test("extractIdempotencyKey reads ContractEnvelope idempotency key when header is missing", () => {
  const result = extractIdempotencyKey(
    {},
    "Idempotency-Key",
    JSON.stringify({
      envelopeId: "env_1",
      schemaVersion: "v4.3",
      payload: { ok: true },
      idempotencyKey: "env-key-123",
    }),
  );
  assert.equal(result, "env-key-123");
});

test("buildIdempotencyErrorResponse creates AppError", () => {
  const error = buildIdempotencyErrorResponse("api.idempotency_key_required", "Missing key", 400);
  assert.equal(error.code, "api.idempotency_key_required");
  assert.equal(error.message, "Missing key");
});

test("createIdempotencyKeyMiddleware creates instance with config", () => {
  const middleware = createIdempotencyKeyMiddleware({ ttlMs: 3600000 });
  assert.ok(middleware instanceof IdempotencyKeyMiddleware);
});

test("getGlobalIdempotencyKeyMiddleware returns singleton", () => {
  resetGlobalIdempotencyKeyMiddleware();
  const instance1 = getGlobalIdempotencyKeyMiddleware();
  const instance2 = getGlobalIdempotencyKeyMiddleware();
  assert.equal(instance1, instance2);
});

test("resetGlobalIdempotencyKeyMiddleware clears singleton", () => {
  resetGlobalIdempotencyKeyMiddleware();
  const instance1 = getGlobalIdempotencyKeyMiddleware();
  resetGlobalIdempotencyKeyMiddleware();
  const instance2 = getGlobalIdempotencyKeyMiddleware();
  assert.notEqual(instance1, instance2);
});

test("DEFAULT_IDEMPOTENCY_KEY_CONFIG has correct values", () => {
  assert.equal(DEFAULT_IDEMPOTENCY_KEY_CONFIG.ttlMs, 24 * 60 * 60 * 1000);
  assert.equal(DEFAULT_IDEMPOTENCY_KEY_CONFIG.required, true);
  assert.equal(DEFAULT_IDEMPOTENCY_KEY_CONFIG.perTenant, true);
  assert.equal(DEFAULT_IDEMPOTENCY_KEY_CONFIG.headerName, "Idempotency-Key");
});
