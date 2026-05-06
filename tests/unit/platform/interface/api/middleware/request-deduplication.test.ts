import { describe, it, beforeEach } from "node:test";
import assert, { strictEqual, deepStrictEqual, ok, fail, notStrictEqual } from "node:assert";
import {
  DeduplicationMiddleware,
  DEFAULT_DEDUPLICATION_CONFIG,
  createDeduplicationMiddleware,
  getGlobalDeduplicationMiddleware,
  resetGlobalDeduplicationMiddleware,
  type DeduplicationConfig,
  type RequestFingerprint,
} from "../../../../../../src/platform/interface/api/middleware/request-deduplication.js";

describe("DeduplicationMiddleware", () => {
  let middleware: DeduplicationMiddleware;

  beforeEach(() => {
    middleware = new DeduplicationMiddleware({
      windowMs: 60_000,
      maxFingerprints: 100,
      includeBody: true,
      perTenant: true,
    });
  });

  describe("generateFingerprint", () => {
    it("should generate fingerprint with method and path", () => {
      const fp = middleware.generateFingerprint({
        method: "POST",
        path: "/api/tasks",
      });
      strictEqual(fp.method, "POST");
      strictEqual(fp.path, "/api/tasks");
    });

    it("should normalize method to uppercase", () => {
      const fp = middleware.generateFingerprint({
        method: "post",
        path: "/api/tasks",
      });
      strictEqual(fp.method, "POST");
    });

    it("should include body hash when includeBody enabled", () => {
      const fp = middleware.generateFingerprint({
        method: "POST",
        path: "/api/tasks",
        body: '{"name":"test"}',
      });
      ok(fp.bodyHash !== null);
    });

    it("should not include body hash when body not provided", () => {
      const fp = middleware.generateFingerprint({
        method: "POST",
        path: "/api/tasks",
      });
      strictEqual(fp.bodyHash, null);
    });

    it("should include timestamp", () => {
      const fp = middleware.generateFingerprint({
        method: "POST",
        path: "/api/tasks",
      });
      ok(fp.timestamp > 0);
    });

    it("should generate different hashes for different bodies", () => {
      const fp1 = middleware.generateFingerprint({
        method: "POST",
        path: "/api/tasks",
        body: '{"a":1}',
      });
      const fp2 = middleware.generateFingerprint({
        method: "POST",
        path: "/api/tasks",
        body: '{"b":2}',
      });
      notStrictEqual(fp1.bodyHash, fp2.bodyHash);
    });
  });

  describe("generateKey", () => {
    it("should generate tenant key when perTenant enabled", () => {
      const key = middleware.generateKey({ tenantId: "tenant-123" });
      strictEqual(key, "tenant:tenant-123");
    });

    it("should generate global key when perTenant disabled", () => {
      const middlewareNoTenant = new DeduplicationMiddleware({
        windowMs: 60_000,
        maxFingerprints: 100,
        perTenant: false,
      });
      const key = middlewareNoTenant.generateKey({ tenantId: "tenant-123" });
      strictEqual(key, "global");
    });
  });

  describe("check", () => {
    it("should allow first request", () => {
      const fp = middleware.generateFingerprint({ method: "POST", path: "/api/tasks" });
      const result = middleware.check("tenant:tenant-1", fp);
      strictEqual(result.allowed, true);
      strictEqual(result.isDuplicate, false);
    });

    it("should detect duplicate request", () => {
      const fp = middleware.generateFingerprint({ method: "POST", path: "/api/tasks" });
      middleware.check("tenant:tenant-1", fp);

      const result = middleware.check("tenant:tenant-1", fp);
      strictEqual(result.allowed, false);
      strictEqual(result.isDuplicate, true);
    });

    it("should return original request id for duplicate", () => {
      const fp = middleware.generateFingerprint({ method: "POST", path: "/api/tasks" });
      const first = middleware.check("tenant:tenant-1", fp);
      const second = middleware.check("tenant:tenant-1", fp);

      strictEqual(first.originalRequestId, null);
      ok(second.originalRequestId !== null);
    });

    it("should calculate retryAfterMs", () => {
      const fp = middleware.generateFingerprint({ method: "POST", path: "/api/tasks" });
      middleware.check("tenant:tenant-1", fp);

      const result = middleware.check("tenant:tenant-1", fp);
      ok(result.retryAfterMs !== null);
      ok(result.retryAfterMs > 0);
    });

    it("should track separate entries per key", () => {
      const fp = middleware.generateFingerprint({ method: "POST", path: "/api/tasks" });
      middleware.check("tenant:tenant-1", fp);

      const result = middleware.check("tenant:tenant-2", fp);
      strictEqual(result.isDuplicate, false);
    });

    it("should not detect duplicate when method differs", () => {
      const fp1 = middleware.generateFingerprint({ method: "POST", path: "/api/tasks" });
      const fp2 = middleware.generateFingerprint({ method: "PUT", path: "/api/tasks" });
      middleware.check("tenant:tenant-1", fp1);

      const result = middleware.check("tenant:tenant-1", fp2);
      strictEqual(result.isDuplicate, false);
    });

    it("should not detect duplicate when path differs", () => {
      const fp1 = middleware.generateFingerprint({ method: "POST", path: "/api/tasks" });
      const fp2 = middleware.generateFingerprint({ method: "POST", path: "/api/other" });
      middleware.check("tenant:tenant-1", fp1);

      const result = middleware.check("tenant:tenant-1", fp2);
      strictEqual(result.isDuplicate, false);
    });

    it("should clean expired entries", async () => {
      const shortWindowMiddleware = new DeduplicationMiddleware({
        windowMs: 1,
        maxFingerprints: 100,
      });
      const fp = shortWindowMiddleware.generateFingerprint({ method: "POST", path: "/api/tasks" });
      shortWindowMiddleware.check("tenant:tenant-1", fp);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = shortWindowMiddleware.check("tenant:tenant-1", fp);
      strictEqual(result.isDuplicate, false);
    });
  });

  describe("maxFingerprints limit", () => {
    it("should trim old entries when exceeding limit", () => {
      const limitedMiddleware = new DeduplicationMiddleware({
        windowMs: 60_000,
        maxFingerprints: 2,
      });

      for (let i = 0; i < 5; i++) {
        const fp = limitedMiddleware.generateFingerprint({
          method: "POST",
          path: `/api/task${i}`,
        });
        limitedMiddleware.check("tenant:tenant-1", fp);
      }

      const fpFirst = limitedMiddleware.generateFingerprint({
        method: "POST",
        path: "/api/task0",
      });
      const result = limitedMiddleware.check("tenant:tenant-1", fpFirst);
      strictEqual(result.isDuplicate, false);
    });
  });

  describe("clear", () => {
    it("should remove all entries for key", () => {
      const fp = middleware.generateFingerprint({ method: "POST", path: "/api/tasks" });
      middleware.check("tenant:tenant-1", fp);

      middleware.clear("tenant:tenant-1");

      const result = middleware.check("tenant:tenant-1", fp);
      strictEqual(result.isDuplicate, false);
    });
  });

  describe("reset", () => {
    it("should remove entries for specific key", () => {
      const fp = middleware.generateFingerprint({ method: "POST", path: "/api/tasks" });
      middleware.check("tenant:tenant-1", fp);
      middleware.check("tenant:tenant-2", fp);

      middleware.reset("tenant:tenant-1");

      const result1 = middleware.check("tenant:tenant-1", fp);
      strictEqual(result1.isDuplicate, false);
      const result2 = middleware.check("tenant:tenant-2", fp);
      strictEqual(result2.isDuplicate, true);
    });
  });
});

describe("DEFAULT_DEDUPLICATION_CONFIG", () => {
  it("should have standard values", () => {
    strictEqual(DEFAULT_DEDUPLICATION_CONFIG.windowMs, 60_000);
    strictEqual(DEFAULT_DEDUPLICATION_CONFIG.maxFingerprints, 10_000);
    strictEqual(DEFAULT_DEDUPLICATION_CONFIG.includeBody, true);
    strictEqual(DEFAULT_DEDUPLICATION_CONFIG.perTenant, true);
  });
});

describe("createDeduplicationMiddleware", () => {
  it("should create middleware with defaults", () => {
    const middleware = createDeduplicationMiddleware();
    const fp = middleware.generateFingerprint({ method: "GET", path: "/health" });
    const result = middleware.check("global", fp);
    strictEqual(result.allowed, true);
  });

  it("should create middleware with custom config", () => {
    const middleware = createDeduplicationMiddleware({
      windowMs: 30_000,
      maxFingerprints: 500,
    });
    strictEqual(middleware.generateFingerprint({ method: "GET", path: "/health" }).method, "GET");
  });
});

describe("globalDeduplicationMiddleware", () => {
  it("should return singleton instance", () => {
    resetGlobalDeduplicationMiddleware();
    const instance1 = getGlobalDeduplicationMiddleware();
    const instance2 = getGlobalDeduplicationMiddleware();
    strictEqual(instance1, instance2);
  });

  it("should reset singleton", () => {
    const instance1 = getGlobalDeduplicationMiddleware();
    resetGlobalDeduplicationMiddleware();
    const instance2 = getGlobalDeduplicationMiddleware();
    notStrictEqual(instance1, instance2);
  });
});
