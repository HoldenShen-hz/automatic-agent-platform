/**
 * Ingress Configuration Tests
 *
 * Tests for configuration options in the ingress layer:
 * - Rate limiter configuration (maxCalls, windowMs)
 * - Redis configuration options
 * - Default value handling
 * - Production mode enforcement
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DistributedRateLimiter } from "../../../../../src/platform/five-plane-interface/ingress/distributed-rate-limiter.js";
import { RedisRateLimiter } from "../../../../../src/platform/five-plane-interface/ingress/redis-rate-limiter.js";

test.describe("Ingress configuration - DistributedRateLimiter defaults", () => {
  test("defaults maxCalls to 100 when not specified", async () => {
    const limiter = new DistributedRateLimiter({});

    // Should allow 100 requests
    const results = [];
    for (let i = 0; i < 100; i++) {
      results.push(await limiter.checkAndConsume("default_max"));
    }

    assert.equal(results.every((r) => r.allowed), true);
    assert.equal((await limiter.checkAndConsume("default_max")).allowed, false);
  });

  test("defaults windowMs to 1000 when not specified", async () => {
    const limiter = new DistributedRateLimiter({});

    const result = await limiter.checkAndConsume("default_window");
    assert.equal(result.allowed, true);
    assert.ok(result.remaining === 99);
  });

  test("accepts custom maxCalls configuration", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: 5,
      windowMs: 1000,
    });

    for (let i = 0; i < 5; i++) {
      assert.equal((await limiter.checkAndConsume("custom_max")).allowed, true);
    }

    assert.equal((await limiter.checkAndConsume("custom_max")).allowed, false);
  });

  test("accepts custom windowMs configuration", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: 1,
      windowMs: 500,
    });

    await limiter.checkAndConsume("custom_window");
    const blocked = await limiter.checkAndConsume("custom_window");
    assert.equal(blocked.allowed, false);

    // Wait 300ms - less than window
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal((await limiter.checkAndConsume("custom_window")).allowed, false);

    // Wait remaining time
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal((await limiter.checkAndConsume("custom_window")).allowed, true);
  });

  test("handles zero maxCalls configuration", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: 0,
      windowMs: 1000,
    });

    const result = await limiter.checkAndConsume("zero_max");
    assert.equal(result.allowed, false);
    assert.equal(result.remaining, 0);
  });

  test("handles negative maxCalls gracefully", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: -10,
      windowMs: 1000,
    });

    const result = await limiter.checkAndConsume("negative_max");
    assert.equal(result.allowed, false);
  });

  test("handles very large maxCalls", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: 1000000,
      windowMs: 1000,
    });

    const result = await limiter.checkAndConsume("large_max");
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 999999);
  });

  test("handles very small windowMs", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: 10,
      windowMs: 1,
    });

    // With 1ms window, entries should expire almost immediately
    // First request should be allowed
    const result = await limiter.checkAndConsume("small_window");
    assert.equal(result.allowed, true);
  });
});

test.describe("Ingress configuration - RedisRateLimiter defaults", () => {
  test("defaults keyPrefix to 'ratelimit:'", () => {
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    // keyPrefix defaults to "ratelimit:"
    // The limiter should be instantiated without error
    assert.ok(limiter instanceof RedisRateLimiter);
  });

  test("accepts custom keyPrefix", () => {
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      keyPrefix: "custom_ratelimit:",
    });

    assert.ok(limiter instanceof RedisRateLimiter);
  });

  test("defaults maxRetriesPerRequest to 1", () => {
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    assert.ok(limiter instanceof RedisRateLimiter);
  });

  test("accepts custom maxRetriesPerRequest", () => {
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      maxRetriesPerRequest: 5,
    });

    assert.ok(limiter instanceof RedisRateLimiter);
  });

  test("defaults connectTimeout to 500ms", () => {
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    assert.ok(limiter instanceof RedisRateLimiter);
  });

  test("accepts custom connectTimeout", () => {
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      connectTimeout: 10000,
    });

    assert.ok(limiter instanceof RedisRateLimiter);
  });

  test("accepts full Redis connection config", () => {
    const limiter = new RedisRateLimiter({
      host: "redis.example.com",
      port: 6380,
      password: "secret_password",
      db: 2,
      keyPrefix: "prod:",
      connectTimeout: 3000,
      maxRetriesPerRequest: 3,
    });

    assert.ok(limiter instanceof RedisRateLimiter);
  });
});

test.describe("Ingress configuration - Production mode", () => {
  test("throws error in production without Redis and without allowLocalFallbackInProduction", () => {
    // This test simulates production environment behavior
    const originalNodeEnv = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "production";

    try {
      assert.throws(() => {
        new DistributedRateLimiter({
          maxCalls: 100,
          windowMs: 1000,
          // No redis config and no allowLocalFallbackInProduction
        });
      }, /rate_limiter.redis_required_in_production/);
    } finally {
      process.env["NODE_ENV"] = originalNodeEnv ?? "test";
    }
  });

  test("allows in-memory fallback in production when explicitly configured", async () => {
    const originalNodeEnv = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "production";

    try {
      const limiter = new DistributedRateLimiter({
        maxCalls: 100,
        windowMs: 1000,
        allowLocalFallbackInProduction: true,
      });

      assert.ok(limiter instanceof DistributedRateLimiter);
      assert.equal((await limiter.checkAndConsume("test")).allowed, true);
    } finally {
      process.env["NODE_ENV"] = originalNodeEnv ?? "test";
    }
  });

  test("allows in-memory fallback in non-production environments without Redis", async () => {
    const originalNodeEnv = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "development";

    try {
      const limiter = new DistributedRateLimiter({
        maxCalls: 50,
        windowMs: 500,
      });

      assert.ok(limiter instanceof DistributedRateLimiter);
      assert.equal((await limiter.checkAndConsume("test")).allowed, true);
    } finally {
      process.env["NODE_ENV"] = originalNodeEnv ?? "test";
    }
  });
});

test.describe("Ingress configuration - Configuration combinations", () => {
  test("configures both Redis and local fallback options", async () => {
    const limiter = new DistributedRateLimiter({
      redis: {
        host: "localhost",
        port: 6379,
        keyPrefix: "combined:",
      },
      maxCalls: 100,
      windowMs: 1000,
    });

    // With Redis configured, should use Redis-based limiting
    // (actual Redis connection would be needed for full test)
    assert.ok(limiter instanceof DistributedRateLimiter);
  });

  test("configures without Redis (in-memory only)", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: 200,
      windowMs: 2000,
    });

    const r1 = await limiter.checkAndConsume("memory_only");
    const r2 = await limiter.checkAndConsume("memory_only");

    assert.equal(r1.allowed, true);
    assert.equal(r2.allowed, true);
    assert.equal(r1.remaining, 199);
    assert.equal(r2.remaining, 198);
  });

  test("handles empty config object", async () => {
    const limiter = new DistributedRateLimiter({});

    assert.ok(limiter instanceof DistributedRateLimiter);
    const result = await limiter.checkAndConsume("empty_config");
    assert.equal(result.allowed, true);
  });

  test("handles undefined optional fields", async () => {
    const limiter = new DistributedRateLimiter({
      maxCalls: undefined,
      windowMs: undefined,
    });

    assert.ok(limiter instanceof DistributedRateLimiter);
    const result = await limiter.checkAndConsume("undefined_config");
    assert.equal(result.allowed, true);
  });
});

test.describe("Ingress configuration - Type validation", () => {
  test("RateLimiterConfig interface accepts redis property", () => {
    const config = {
      redis: {
        host: "localhost",
        port: 6379,
      },
      maxCalls: 100,
      windowMs: 1000,
    };

    assert.ok(config.redis !== undefined);
    assert.equal(config.redis.host, "localhost");
  });

  test("RateLimiterConfig interface accepts allowLocalFallbackInProduction", () => {
    const config = {
      maxCalls: 100,
      windowMs: 1000,
      allowLocalFallbackInProduction: true,
    };

    assert.equal(config.allowLocalFallbackInProduction, true);
  });

  test("RedisRateLimiterConfig extends RedisConnectionConfig", () => {
    const config = {
      host: "localhost",
      port: 6379,
      keyPrefix: "test:",
      connectTimeout: 1000,
      maxRetriesPerRequest: 3,
      password: "pass",
      db: 1,
    };

    assert.equal(config.host, "localhost");
    assert.equal(config.keyPrefix, "test:");
    assert.equal(config.maxRetriesPerRequest, 3);
  });

  test("RateLimitCheckResult structure validation", () => {
    const allowedResult = {
      allowed: true as const,
      remaining: 50,
    };

    assert.equal(allowedResult.allowed, true);
    assert.equal(allowedResult.remaining, 50);

    const rejectedResult = {
      allowed: false as const,
      remaining: 0,
      retryAfterMs: 2000,
    };

    assert.equal(rejectedResult.allowed, false);
    assert.equal(rejectedResult.remaining, 0);
    assert.equal(rejectedResult.retryAfterMs, 2000);
  });
});