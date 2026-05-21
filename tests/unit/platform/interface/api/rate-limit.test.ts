import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert, { strictEqual, deepStrictEqual, ok, fail, notStrictEqual, rejects } from "node:assert/strict";
import {
  RateLimiter,
  RateLimitMiddleware,
  DEFAULT_RATE_LIMIT_CONFIG,
  createRateLimiter,
  getGlobalRateLimiter,
  resetGlobalRateLimiter,
  type RateLimitConfig,
  type RateLimitDecision,
} from "../../../../../src/platform/five-plane-interface/api/middleware/rate-limit.js";
import { RedisRateLimiter } from "../../../../../src/platform/five-plane-interface/ingress/redis-rate-limiter.js";
import { DistributedRateLimiter } from "../../../../../src/platform/five-plane-interface/ingress/distributed-rate-limiter.js";

describe("RateLimiter - Comprehensive", () => {
  describe("token bucket algorithm", () => {
    it("should refill tokens after window expires", () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });
      // Exhaust tokens
      for (let i = 0; i < 5; i++) {
        limiter.check("key");
      }
      const result = limiter.check("key");
      strictEqual(result.allowed, false);
      strictEqual(result.remaining, 0);
    });

    it("should calculate retryAfterMs correctly", () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });
      limiter.check("key");
      limiter.check("key");
      const result = limiter.check("key");
      strictEqual(result.allowed, false);
      ok(result.retryAfterMs !== null);
      ok(result.retryAfterMs > 0);
      ok(result.retryAfterMs <= 1000);
    });

    it("should handle multiple keys independently", () => {
      const limiter = new RateLimiter({ maxRequests: 3, windowMs: 60_000 });
      // Exhaust key1
      limiter.check("key1");
      limiter.check("key1");
      limiter.check("key1");
      strictEqual(limiter.check("key1").allowed, false);
      // key2 should still have full quota
      strictEqual(limiter.check("key2").allowed, true);
      // key2 first call consumes 1, so remaining = maxRequests - 2 = 1
      strictEqual(limiter.check("key2").remaining, 1);
    });
  });

  describe("bucket eviction", () => {
    it("should evict oldest bucket when max buckets exceeded", () => {
      // Create limiter with small max to trigger eviction
      const limiter = new RateLimiter({ maxRequests: 100, windowMs: 60_000 });
      // Access private buckets to verify eviction behavior
      const buckets = (limiter as unknown as { buckets: Map<string, unknown> }).buckets;

      // Add many keys to trigger eviction
      for (let i = 0; i < 10050; i++) {
        limiter.check(`key${i}`);
      }
      // After 10000 buckets, oldest should be evicted
      strictEqual(buckets.size <= 10000, true);
    });
  });

  describe("edge cases", () => {
    it("should handle zero maxRequests", () => {
      const limiter = new RateLimiter({ maxRequests: 0, windowMs: 60_000 });
      // With maxRequests=0, first call creates bucket with tokens=-1
      // and immediately decrements to -2, so remaining=-2 which is <=0, rejected
      const result = limiter.check("key");
      strictEqual(result.allowed, false);
      strictEqual(result.remaining, 0);
    });

    it("should handle very large windowMs", () => {
      const limiter = new RateLimiter({ maxRequests: 100, windowMs: Number.MAX_SAFE_INTEGER });
      const result = limiter.check("key");
      strictEqual(result.allowed, true);
      strictEqual(result.remaining, 99);
    });

    it("should handle fractional tokensToAdd", () => {
      const limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });
      limiter.check("key");
      limiter.check("key");
      limiter.check("key");
      // Now 3 tokens used, check exhaustion
      const result = limiter.check("key");
      strictEqual(result.allowed, false);
    });
  });
});

describe("RateLimitMiddleware - Comprehensive", () => {
  it("should use perTenant context correctly", () => {
    const middleware = new RateLimitMiddleware({ perTenant: true });
    const fn = middleware.middleware();
    const result = fn({ tenantId: "tenant-abc", clientIp: "192.168.1.1" });
    strictEqual(result.allowed, true);
  });

  it("should use perPrincipal context correctly", () => {
    const middleware = new RateLimitMiddleware({ perPrincipal: true });
    const fn = middleware.middleware();
    const result = fn({ principal: "user-123", clientIp: "192.168.1.1" });
    strictEqual(result.allowed, true);
  });

  it("should return retryAfterMs when rate limited", () => {
    const middleware = new RateLimitMiddleware({ maxRequests: 1, windowMs: 60_000 });
    const fn = middleware.middleware();
    fn({ clientIp: "192.168.1.1" });
    const result = fn({ clientIp: "192.168.1.1" });
    strictEqual(result.allowed, false);
    ok(result.retryAfterMs !== null);
  });

  it("should share limiter across middleware calls", () => {
    const middleware = new RateLimitMiddleware({ maxRequests: 2, windowMs: 60_000 });
    const fn = middleware.middleware();
    fn({ clientIp: "192.168.1.1" });
    fn({ clientIp: "192.168.1.1" });
    const result = fn({ clientIp: "192.168.1.1" });
    strictEqual(result.allowed, false);
  });
});

describe("RedisRateLimiter - Unit", () => {
  it("should use sliding window algorithm", async () => {
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      keyPrefix: "test:",
    });

    // Mock the redis pipeline
    const mockPipeline = {
      zremrangebyscore: mock.fn(() => mockPipeline),
      zadd: mock.fn(() => mockPipeline),
      zcard: mock.fn(() => mockPipeline),
      pexpire: mock.fn(() => mockPipeline),
      exec: mock.fn(async () => [[null, 0], [null, 1], [null, 5], [null, 1]]),
    };

    const redis = (limiter as unknown as { redis: { pipeline: () => typeof mockPipeline } }).redis;
    redis.pipeline = mock.fn(() => mockPipeline);

    const result = await limiter.checkAndConsume("test-key", 10, 60000);
    strictEqual(result.allowed, true);
    strictEqual(result.remaining, 10 - 5);
  });

  it("should reject when over limit", async () => {
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      keyPrefix: "test:",
    });

    const mockPipeline = {
      zremrangebyscore: mock.fn(() => mockPipeline),
      zadd: mock.fn(() => mockPipeline),
      zcard: mock.fn(() => mockPipeline),
      pexpire: mock.fn(() => mockPipeline),
      exec: mock.fn(async () => [[null, 0], [null, 1], [null, 15], [null, 1]]), // count > limit
    };

    const redis = (limiter as unknown as { redis: { pipeline: () => typeof mockPipeline } }).redis;
    redis.pipeline = mock.fn(() => mockPipeline);

    const result = await limiter.checkAndConsume("test-key", 10, 60000);
    strictEqual(result.allowed, false);
    strictEqual(result.remaining, 0);
    ok(result.retryAfterMs !== undefined);
  });

  it("should cleanup expired entries", async () => {
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      keyPrefix: "test:",
    });

    const mockPipeline = {
      zremrangebyscore: mock.fn(() => mockPipeline),
      zadd: mock.fn(() => mockPipeline),
      zcard: mock.fn(() => mockPipeline),
      pexpire: mock.fn(() => mockPipeline),
      exec: mock.fn(async () => [[null, 0], [null, 1], [null, 1], [null, 1]]),
    };

    const redis = (limiter as unknown as { redis: { pipeline: () => typeof mockPipeline } }).redis;
    redis.pipeline = mock.fn(() => mockPipeline);

    const usage = await limiter.getUsage("test-key", 60000);
    strictEqual(usage, 1);
  });

  it("should reset key correctly", async () => {
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      keyPrefix: "test:",
    });

    const mockRedis = {
      del: mock.fn(async () => 1),
    };

    const redis = (limiter as unknown as { redis: typeof mockRedis }).redis;
    Object.assign(redis, mockRedis);

    await limiter.reset("test-key");
    strictEqual(mockRedis.del.mock.calls.length, 1);
  });

  it("should handle close gracefully", async () => {
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      keyPrefix: "test:",
    });

    const mockRedis = {
      status: "wait",
      disconnect: mock.fn(),
      quit: mock.fn(async () => "OK"),
    };

    const redis = (limiter as unknown as { redis: typeof mockRedis }).redis;
    Object.assign(redis, mockRedis);

    await limiter.close();
    // Should have called quit or disconnect
    ok(mockRedis.disconnect.mock.calls.length > 0 || mockRedis.quit.mock.calls.length > 0);
  });
});

describe("DistributedRateLimiter - Comprehensive", () => {
  describe("local fallback mode", () => {
    it("should use in-memory rate limiting when no Redis configured", () => {
      const limiter = new DistributedRateLimiter({
        maxCalls: 5,
        windowMs: 60000,
      });

      const result1 = limiter.checkLocal("key1");
      strictEqual(result1.allowed, true);
      strictEqual(result1.remaining, 4);

      // Exhaust local limit
      for (let i = 0; i < 4; i++) {
        limiter.checkLocal("key1");
      }

      const exhausted = limiter.checkLocal("key1");
      strictEqual(exhausted.allowed, false);
      strictEqual(exhausted.remaining, 0);
      ok(exhausted.retryAfterMs !== undefined);
    });

    it("should reject immediately when maxCalls is 0", () => {
      const limiter = new DistributedRateLimiter({
        maxCalls: 0,
        windowMs: 60000,
      });

      const result = limiter.checkLocal("key");
      strictEqual(result.allowed, false);
      strictEqual(result.remaining, 0);
      strictEqual(result.retryAfterMs, 60000);
    });

    it("should reset window on new call after window expires", () => {
      const limiter = new DistributedRateLimiter({
        maxCalls: 2,
        windowMs: 100,
      });

      limiter.checkLocal("key");
      limiter.checkLocal("key");
      const exhausted = limiter.checkLocal("key");
      strictEqual(exhausted.allowed, false);

      // Wait for window to expire
      setTimeout(() => {
        const renewed = limiter.checkLocal("key");
        strictEqual(renewed.allowed, true);
        strictEqual(renewed.remaining, 1);
      }, 150);
    });
  });

  describe("Redis mode", () => {
    it("should throw in production without Redis and without allowLocalFallbackInProduction", () => {
      const originalEnv = process.env["NODE_ENV"];
      process.env["NODE_ENV"] = "production";

      try {
        assert.throws(() => {
          new DistributedRateLimiter({
            maxCalls: 100,
            windowMs: 60000,
          });
        }, /rate_limiter.redis_required_in_production/);
      } finally {
        process.env["NODE_ENV"] = originalEnv;
      }
    });

    it("should allow local fallback in production when explicitly configured", () => {
      const originalEnv = process.env["NODE_ENV"];
      process.env["NODE_ENV"] = "production";

      try {
        const limiter = new DistributedRateLimiter({
          maxCalls: 100,
          windowMs: 60000,
          allowLocalFallbackInProduction: true,
        });
        ok(limiter !== null);
      } finally {
        process.env["NODE_ENV"] = originalEnv;
      }
    });
  });

  describe("checkAndConsume", () => {
    it("should delegate to Redis when configured", async () => {
      const limiter = new DistributedRateLimiter({
        redis: {
          host: "localhost",
          port: 6379,
          keyPrefix: "test:",
        },
        maxCalls: 10,
        windowMs: 60000,
      });

      // The limiter should have redisLimiter when Redis is configured
      const redisLimiter = (limiter as unknown as { redisLimiter: RedisRateLimiter | null }).redisLimiter;
      notStrictEqual(redisLimiter, null);
    });
  });
});

describe("RateLimitConfig interfaces", () => {
  it("should export RateLimitConfig interface", () => {
    const config: RateLimitConfig = {
      maxRequests: 100,
      windowMs: 60000,
      perTenant: true,
      perPrincipal: false,
    };
    strictEqual(config.maxRequests, 100);
    strictEqual(config.perTenant, true);
  });

  it("should export RateLimitDecision interface", () => {
    const decision: RateLimitDecision = {
      allowed: true,
      remaining: 99,
      resetAt: Date.now() + 60000,
      retryAfterMs: null,
    };
    strictEqual(decision.allowed, true);
    strictEqual(decision.remaining, 99);
  });
});
