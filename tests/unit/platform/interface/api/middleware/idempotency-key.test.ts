import { describe, it, beforeEach, afterEach } from "node:test";
import assert, { strictEqual, deepStrictEqual, ok, fail, notStrictEqual } from "node:assert";
import {
  IdempotencyKeyMiddleware,
  WRITE_METHODS,
  extractIdempotencyKey,
  buildIdempotencyErrorResponse,
  createIdempotencyKeyMiddleware,
  getGlobalIdempotencyKeyMiddleware,
  resetGlobalIdempotencyKeyMiddleware,
  type IdempotencyKeyConfig,
} from "../../../../../../src/platform/five-plane-interface/api/middleware/idempotency-key.js";

describe("IdempotencyKeyMiddleware", () => {
  let middleware: IdempotencyKeyMiddleware;

  beforeEach(() => {
    middleware = new IdempotencyKeyMiddleware({ ttlMs: 60_000 });
  });

  describe("isWriteOperation", () => {
    it("should return true for POST", () => {
      strictEqual(middleware.isWriteOperation("POST"), true);
    });

    it("should return true for PUT", () => {
      strictEqual(middleware.isWriteOperation("PUT"), true);
    });

    it("should return true for PATCH", () => {
      strictEqual(middleware.isWriteOperation("PATCH"), true);
    });

    it("should return true for DELETE", () => {
      strictEqual(middleware.isWriteOperation("DELETE"), true);
    });

    it("should return false for GET", () => {
      strictEqual(middleware.isWriteOperation("GET"), false);
    });

    it("should be case insensitive", () => {
      strictEqual(middleware.isWriteOperation("post"), true);
      strictEqual(middleware.isWriteOperation("Post"), true);
    });
  });

  describe("check", () => {
    it("should allow read operations without idempotency key", async () => {
      const result = await middleware.check({ method: "GET" });
      strictEqual(result.allowed, true);
      strictEqual(result.isDuplicate, false);
    });

    it("should allow write operations without idempotency key when not required", async () => {
      const middlewareNoRequired = new IdempotencyKeyMiddleware({ required: false });
      const result = await middlewareNoRequired.check({ method: "POST" });
      strictEqual(result.allowed, true);
      strictEqual(result.isDuplicate, false);
    });

    it("should reject write operations without idempotency key when required", async () => {
      const result = await middleware.check({ method: "POST" });
      strictEqual(result.allowed, false);
      strictEqual(result.error?.statusCode, 400);
      strictEqual(result.error?.code, "api.idempotency_key_required");
    });

    it("should allow first write with idempotency key", async () => {
      const result = await middleware.check({
        method: "POST",
        idempotencyKey: "key-123",
      });
      strictEqual(result.allowed, true);
      strictEqual(result.isDuplicate, false);
    });

    it("should detect duplicate with same idempotency key", async () => {
      await middleware.check({
        method: "POST",
        idempotencyKey: "key-123",
      });

      const result = await middleware.check({
        method: "POST",
        idempotencyKey: "key-123",
      });
      strictEqual(result.allowed, true);
      strictEqual(result.isDuplicate, true);
    });

    it("should return cached response for duplicate", async () => {
      await middleware.check({
        method: "POST",
        idempotencyKey: "key-123",
      });

      await middleware.record({
        idempotencyKey: "key-123",
        statusCode: 201,
        responseBody: { id: "123" },
      });

      const result = await middleware.check({
        method: "POST",
        idempotencyKey: "key-123",
      });
      strictEqual(result.cachedResponse?.statusCode, 201);
      deepStrictEqual(result.cachedResponse?.body, { id: "123" });
    });

    it("should reject duplicate with different method", async () => {
      await middleware.check({
        method: "POST",
        idempotencyKey: "key-123",
      });

      const result = await middleware.check({
        method: "PUT",
        idempotencyKey: "key-123",
      });
      strictEqual(result.allowed, false);
      strictEqual(result.error?.statusCode, 409);
      strictEqual(result.error?.code, "api.idempotency_key_conflict");
    });

    it("should isolate per tenant when perTenant enabled", async () => {
      await middleware.check({
        method: "POST",
        idempotencyKey: "key-123",
        tenantId: "tenant-a",
      });

      const result = await middleware.check({
        method: "POST",
        idempotencyKey: "key-123",
        tenantId: "tenant-b",
      });
      strictEqual(result.isDuplicate, false);
    });

    it("should not isolate per tenant when perTenant disabled", async () => {
      const middlewareNoTenant = new IdempotencyKeyMiddleware({ perTenant: false });

      await middlewareNoTenant.check({
        method: "POST",
        idempotencyKey: "key-123",
        tenantId: "tenant-a",
      });

      const result = await middlewareNoTenant.check({
        method: "POST",
        idempotencyKey: "key-123",
        tenantId: "tenant-b",
      });
      strictEqual(result.isDuplicate, true);
    });
  });

  describe("record", () => {
    it("should update entry with response", async () => {
      await middleware.check({
        method: "POST",
        idempotencyKey: "key-123",
      });

      await middleware.record({
        idempotencyKey: "key-123",
        statusCode: 201,
        responseBody: { created: true },
      });

      const result = await middleware.check({
        method: "POST",
        idempotencyKey: "key-123",
      });
      strictEqual(result.cachedResponse?.statusCode, 201);
    });
  });

  describe("clear", () => {
    it("should remove entry", async () => {
      await middleware.check({
        method: "POST",
        idempotencyKey: "key-123",
      });

      await middleware.clear("key-123");

      const result = await middleware.check({
        method: "POST",
        idempotencyKey: "key-123",
      });
      strictEqual(result.isDuplicate, false);
    });
  });

  describe("cleanup", () => {
    it("should remove expired entries", async () => {
      const shortTtlMiddleware = new IdempotencyKeyMiddleware({ ttlMs: 1 });
      await shortTtlMiddleware.check({
        method: "POST",
        idempotencyKey: "key-short",
      });

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      await shortTtlMiddleware.cleanup();

      const result = await shortTtlMiddleware.check({
        method: "POST",
        idempotencyKey: "key-short",
      });
      strictEqual(result.isDuplicate, false);
    });
  });

  describe("clearAll", () => {
    it("should remove all entries", async () => {
      await middleware.check({ method: "POST", idempotencyKey: "key-1" });
      await middleware.check({ method: "PUT", idempotencyKey: "key-2" });

      strictEqual(middleware.size(), 2);

      middleware.clearAll();

      strictEqual(middleware.size(), 0);
    });
  });

  describe("size", () => {
    it("should return entry count", async () => {
      strictEqual(middleware.size(), 0);
      await middleware.check({ method: "POST", idempotencyKey: "key-1" });
      strictEqual(middleware.size(), 1);
      await middleware.check({ method: "PUT", idempotencyKey: "key-2" });
      strictEqual(middleware.size(), 2);
    });
  });
});

describe("WRITE_METHODS", () => {
  it("should contain POST, PUT, PATCH, DELETE", () => {
    ok(WRITE_METHODS.has("POST"));
    ok(WRITE_METHODS.has("PUT"));
    ok(WRITE_METHODS.has("PATCH"));
    ok(WRITE_METHODS.has("DELETE"));
    strictEqual(WRITE_METHODS.has("GET"), false);
  });
});

describe("extractIdempotencyKey", () => {
  it("should extract key from headers", () => {
    const headers = { "idempotency-key": "abc123" };
    strictEqual(extractIdempotencyKey(headers), "abc123");
  });

  it("should handle case-insensitive header lookup", () => {
    const headers = { "Idempotency-Key": "abc123" };
    strictEqual(extractIdempotencyKey(headers), "abc123");
  });

  it("should return first value for array", () => {
    const headers = { "idempotency-key": ["abc123", "def456"] };
    strictEqual(extractIdempotencyKey(headers), "abc123");
  });

  it("should return undefined when not present", () => {
    const headers = {};
    strictEqual(extractIdempotencyKey(headers), undefined);
  });

  it("should use custom header name", () => {
    const headers = { "x-custom-key": "custom123" };
    strictEqual(extractIdempotencyKey(headers, "X-Custom-Key"), "custom123");
  });
});

describe("buildIdempotencyErrorResponse", () => {
  it("should create AppError with correct properties", () => {
    const error = buildIdempotencyErrorResponse(
      "api.idempotency_key_required",
      "Idempotency key is required",
      400,
    );
    strictEqual(error.code, "api.idempotency_key_required");
    strictEqual(error.statusCode, 400);
    strictEqual(error.category, "validation");
    strictEqual(error.retryable, false);
  });
});

describe("createIdempotencyKeyMiddleware", () => {
  it("should create middleware with custom config", async () => {
    const middleware = createIdempotencyKeyMiddleware({ ttlMs: 30_000 });
    strictEqual(middleware.isWriteOperation("POST"), true);
    const result = await middleware.check({ method: "POST" });
    strictEqual(result.allowed, false);
  });
});

describe("globalIdempotencyKeyMiddleware", () => {
  afterEach(() => {
    resetGlobalIdempotencyKeyMiddleware();
  });

  it("should return singleton instance", () => {
    const instance1 = getGlobalIdempotencyKeyMiddleware();
    const instance2 = getGlobalIdempotencyKeyMiddleware();
    strictEqual(instance1, instance2);
  });

  it("should reset singleton", () => {
    const instance1 = getGlobalIdempotencyKeyMiddleware();
    resetGlobalIdempotencyKeyMiddleware();
    const instance2 = getGlobalIdempotencyKeyMiddleware();
    notStrictEqual(instance1, instance2);
  });
});
