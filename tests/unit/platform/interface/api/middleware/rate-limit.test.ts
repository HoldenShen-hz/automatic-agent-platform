import { describe, it, beforeEach } from "node:test";
import assert, { strictEqual, deepStrictEqual, ok, fail, notStrictEqual } from "node:assert";
import {
  RateLimiter,
  RateLimitMiddleware,
  DEFAULT_RATE_LIMIT_CONFIG,
  createRateLimiter,
  getGlobalRateLimiter,
  resetGlobalRateLimiter,
  type RateLimitConfig,
  type RateLimitDecision,
} from "../../../../../../src/platform/five-plane-interface/api/middleware/rate-limit.js";

describe("RateLimiter", () => {
  describe("constructor", () => {
    it("should use config values", () => {
      const limiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });
      const result = limiter.check("test");
      strictEqual(result.remaining, 9);
    });
  });

  describe("generateKey", () => {
    it("should generate ip key by default", () => {
      const limiter = new RateLimiter({ maxRequests: 100, windowMs: 60_000 });
      const key = limiter.generateKey({ clientIp: "192.168.1.1" });
      strictEqual(key, "ip:192.168.1.1");
    });

    it("should generate tenant key when perTenant enabled", () => {
      const limiter = new RateLimiter({ maxRequests: 100, windowMs: 60_000, perTenant: true });
      const key = limiter.generateKey({ tenantId: "tenant-abc" });
      strictEqual(key, "tenant:tenant-abc");
    });

    it("should generate principal key when perPrincipal enabled", () => {
      const limiter = new RateLimiter({
        maxRequests: 100,
        windowMs: 60_000,
        perTenant: true,
        perPrincipal: true,
      });
      const key = limiter.generateKey({ principal: "user-123", tenantId: "tenant-abc" });
      strictEqual(key, "principal:user-123");
    });

    it("should fall back to tenant when principal not provided", () => {
      const limiter = new RateLimiter({
        maxRequests: 100,
        windowMs: 60_000,
        perTenant: true,
        perPrincipal: true,
      });
      const key = limiter.generateKey({ tenantId: "tenant-abc" });
      strictEqual(key, "tenant:tenant-abc");
    });

    it("should return global when no context", () => {
      const limiter = new RateLimiter({ maxRequests: 100, windowMs: 60_000 });
      const key = limiter.generateKey({});
      strictEqual(key, "global");
    });
  });

  describe("check", () => {
    it("should allow first request and consume token", () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
      const result = limiter.check("test");
      strictEqual(result.allowed, true);
      strictEqual(result.remaining, 4);
    });

    it("should decrement remaining tokens", () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
      limiter.check("test");
      const result = limiter.check("test");
      strictEqual(result.remaining, 3);
    });

    it("should allow request when tokens available", () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
      const result = limiter.check("test");
      strictEqual(result.allowed, true);
      ok(result.retryAfterMs === null);
    });

    it("should reject when no tokens", () => {
      const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60_000 });
      limiter.check("test");
      const result = limiter.check("test");
      strictEqual(result.allowed, false);
      strictEqual(result.remaining, 0);
      ok(result.retryAfterMs !== null);
    });

    it("should have resetAt in future", () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
      const result = limiter.check("test");
      ok(result.resetAt > Date.now());
    });

    it("should track separate buckets per key", () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 60_000 });
      limiter.check("key1");
      limiter.check("key2");
      const result1 = limiter.check("key1");
      strictEqual(result1.remaining, 0);
    });
  });

  describe("reset", () => {
    it("should clear bucket for key", () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
      limiter.check("test");
      limiter.reset("test");
      const result = limiter.check("test");
      strictEqual(result.remaining, 4);
    });
  });

  describe("resetAll", () => {
    it("should clear all buckets", () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
      limiter.check("key1");
      limiter.check("key2");
      limiter.resetAll();
      const result = limiter.check("key1");
      strictEqual(result.remaining, 4);
    });
  });

  describe("status", () => {
    it("should return null for unknown key", () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
      const result = limiter.status("unknown");
      strictEqual(result, null);
    });

    it("should return tokens and resetAt for known key", () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000 });
      limiter.check("test");
      const result = limiter.status("test");
      ok(result !== null);
      strictEqual(result.tokens, 4);
      ok(result.resetAt > Date.now());
    });
  });
});

describe("RateLimitMiddleware", () => {
  describe("constructor", () => {
    it("should create with default config", () => {
      const middleware = new RateLimitMiddleware();
      const result = middleware.getLimiter().check("test");
      strictEqual(result.allowed, true);
    });

    it("should create with custom config", () => {
      const middleware = new RateLimitMiddleware({ maxRequests: 10, windowMs: 60_000 });
      const result = middleware.getLimiter().check("test");
      strictEqual(result.remaining, 9);
    });
  });

  describe("middleware", () => {
    it("should return middleware function", () => {
      const middleware = new RateLimitMiddleware();
      const fn = middleware.middleware();
      strictEqual(typeof fn, "function");
    });

    it("should check rate limit with context", () => {
      const middleware = new RateLimitMiddleware({ perTenant: true });
      const fn = middleware.middleware();
      const result = fn({ tenantId: "tenant-1" });
      strictEqual(result.allowed, true);
    });
  });
});

describe("DEFAULT_RATE_LIMIT_CONFIG", () => {
  it("should have standard values", () => {
    strictEqual(DEFAULT_RATE_LIMIT_CONFIG.maxRequests, 100);
    strictEqual(DEFAULT_RATE_LIMIT_CONFIG.windowMs, 60_000);
    strictEqual(DEFAULT_RATE_LIMIT_CONFIG.perTenant, true);
    strictEqual(DEFAULT_RATE_LIMIT_CONFIG.perPrincipal, false);
  });
});

describe("createRateLimiter", () => {
  it("should create limiter with defaults", () => {
    const limiter = createRateLimiter();
    const result = limiter.check("test");
    strictEqual(result.remaining, 99);
  });

  it("should create limiter with custom config", () => {
    const limiter = createRateLimiter({ maxRequests: 50, windowMs: 30_000 });
    const result = limiter.check("test");
    strictEqual(result.remaining, 49);
  });
});

describe("globalRateLimiter", () => {
  it("should return singleton instance", () => {
    resetGlobalRateLimiter();
    const instance1 = getGlobalRateLimiter();
    const instance2 = getGlobalRateLimiter();
    strictEqual(instance1, instance2);
  });

  it("should reset singleton", () => {
    const instance1 = getGlobalRateLimiter();
    resetGlobalRateLimiter();
    const instance2 = getGlobalRateLimiter();
    notStrictEqual(instance1, instance2);
  });
});
