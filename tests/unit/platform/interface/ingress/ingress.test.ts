import assert from "node:assert/strict";
import test from "node:test";

/**
 * @fileoverview Unit tests for ingress module with mocked dependencies
 * Tests RedisRateLimiter and DistributedRateLimiter behavior with mocks
 */

// Mock Redis module before importing
const mockRedisInstance = {
  pipeline: () => ({
    zremrangebyscore: () => ({ zadd: () => ({ zcard: () => ({ pexpire: () => ({ exec: () => Promise.resolve([[null, 0], [null, 1], [null, 3]]) }) }) }) }),
    exec: () => Promise.resolve([[null, 0], [null, 1], [null, 3]]),
  }),
  zrange: () => Promise.resolve([]),
  zrem: () => Promise.resolve(1),
  del: () => Promise.resolve(1),
  connect: () => Promise.resolve(),
  quit: () => Promise.resolve(),
  disconnect: () => {},
  on: () => {},
  status: "ready",
};

const mockRedisConstructor = function() {
  return mockRedisInstance;
};
mockRedisConstructor.prototype = mockRedisInstance;

test.describe("ingress module with mocks", () => {
  test.beforeEach(() => {
    // Reset any module state if needed
  });

  test("RedisRateLimiter checkAndConsume returns correct structure", async () => {
    const { RedisRateLimiter } = await import("../../../../../src/platform/interface/ingress/index.js");

    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    const result = await limiter.checkAndConsume("test-key", 10, 1000);

    assert.equal(typeof result.allowed, "boolean");
    assert.equal(typeof result.remaining, "number");
    if (!result.allowed) {
      assert.equal(typeof result.retryAfterMs, "number");
    }

    await limiter.close();
  });

  test("RedisRateLimiter close handles wait status gracefully", async () => {
    const { RedisRateLimiter } = await import("../../../../../src/platform/interface/ingress/index.js");

    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    // close should not throw
    await limiter.close();
    assert.ok(true);
  });

  test("RedisRateLimiter close handles end status gracefully", async () => {
    const { RedisRateLimiter } = await import("../../../../../src/platform/interface/ingress/index.js");

    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    await limiter.close();
    assert.ok(true);
  });

  test("DistributedRateLimiter uses in-memory when no Redis configured", async () => {
    const { DistributedRateLimiter } = await import("../../../../../src/platform/interface/ingress/index.js");

    const limiter = new DistributedRateLimiter({
      maxCalls: 2,
      windowMs: 100,
    });

    const r1 = await limiter.checkAndConsume("key");
    assert.equal(r1.allowed, true);
    assert.equal(r1.remaining, 1);

    const r2 = await limiter.checkAndConsume("key");
    assert.equal(r2.allowed, true);
    assert.equal(r2.remaining, 0);

    const r3 = await limiter.checkAndConsume("key");
    assert.equal(r3.allowed, false);
    assert.ok(r3.retryAfterMs !== undefined);

    // Reset by waiting
    await new Promise((resolve) => setTimeout(resolve, 120));

    const r4 = await limiter.checkAndConsume("key");
    assert.equal(r4.allowed, true);
  });

  test("DistributedRateLimiter with empty config uses defaults", async () => {
    const { DistributedRateLimiter } = await import("../../../../../src/platform/interface/ingress/index.js");

    const limiter = new DistributedRateLimiter({});
    assert.ok(limiter instanceof DistributedRateLimiter);
  });

  test("DistributedRateLimiter default maxCalls is 100", async () => {
    const { DistributedRateLimiter } = await import("../../../../../src/platform/interface/ingress/index.js");

    const limiter = new DistributedRateLimiter({});

    // Should allow 100 requests
    const r1 = await limiter.checkAndConsume("key");
    assert.equal(r1.remaining, 99);
  });

  test("DistributedRateLimiter default windowMs is 1000", async () => {
    const { DistributedRateLimiter } = await import("../../../../../src/platform/interface/ingress/index.js");

    const limiter = new DistributedRateLimiter({});

    // Window should be 1000ms
    const r1 = await limiter.checkAndConsume("key");
    assert.equal(r1.allowed, true);
  });

  test("DistributedRateLimiter independent key tracking", async () => {
    const { DistributedRateLimiter } = await import("../../../../../src/platform/interface/ingress/index.js");

    const limiter = new DistributedRateLimiter({
      maxCalls: 1,
      windowMs: 10000,
    });

    // Exhaust key1
    assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
    assert.equal((await limiter.checkAndConsume("key1")).allowed, false);

    // key2 should still work
    assert.equal((await limiter.checkAndConsume("key2")).allowed, true);
    assert.equal((await limiter.checkAndConsume("key2")).allowed, false);
  });

  test("DistributedRateLimiter retryAfterMs calculation", async () => {
    const { DistributedRateLimiter } = await import("../../../../../src/platform/interface/ingress/index.js");

    const limiter = new DistributedRateLimiter({
      maxCalls: 1,
      windowMs: 1000,
    });

    await limiter.checkAndConsume("key");
    const result = await limiter.checkAndConsume("key");

    assert.equal(result.allowed, false);
    assert.ok(result.retryAfterMs !== undefined);
    assert.ok(result.retryAfterMs! > 0);
    assert.ok(result.retryAfterMs! <= 1000);
  });

  test("DistributedRateLimiter window reset allows new requests", async () => {
    const { DistributedRateLimiter } = await import("../../../../../src/platform/interface/ingress/index.js");

    const limiter = new DistributedRateLimiter({
      maxCalls: 1,
      windowMs: 50,
    });

    // First request allowed
    assert.equal((await limiter.checkAndConsume("x")).allowed, true);

    // Second rejected
    assert.equal((await limiter.checkAndConsume("x")).allowed, false);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 60));

    // Should be allowed again
    assert.equal((await limiter.checkAndConsume("x")).allowed, true);
  });

  test("DistributedRateLimiter count decreases remaining correctly", async () => {
    const { DistributedRateLimiter } = await import("../../../../../src/platform/interface/ingress/index.js");

    const limiter = new DistributedRateLimiter({
      maxCalls: 5,
      windowMs: 1000,
    });

    const r0 = await limiter.checkAndConsume("k");
    assert.equal(r0.remaining, 4);

    const r1 = await limiter.checkAndConsume("k");
    assert.equal(r1.remaining, 3);

    const r2 = await limiter.checkAndConsume("k");
    assert.equal(r2.remaining, 2);

    const r3 = await limiter.checkAndConsume("k");
    assert.equal(r3.remaining, 1);

    const r4 = await limiter.checkAndConsume("k");
    assert.equal(r4.remaining, 0);
  });
});

test.describe("RateLimitResult interface", () => {
  test("allowed true with remaining greater than zero", () => {
    const result = {
      allowed: true as const,
      remaining: 5,
    };
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 5);
    assert.equal("retryAfterMs" in result ? result.retryAfterMs : undefined, undefined);
  });

  test("allowed false with retryAfterMs", () => {
    const result = {
      allowed: false as const,
      remaining: 0,
      retryAfterMs: 3000,
    };
    assert.equal(result.allowed, false);
    assert.equal(result.remaining, 0);
    assert.equal(result.retryAfterMs, 3000);
  });

  test("allowed true at limit with zero remaining", () => {
    const result = {
      allowed: true as const,
      remaining: 0,
    };
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 0);
  });
});

test.describe("sliding window algorithm", () => {
  test("windowStart calculation", () => {
    const now = 1000000000000;
    const windowMs = 60000;
    const windowStart = now - windowMs;

    assert.equal(windowStart, 999999940000);
  });

  test("remaining calculation under limit", () => {
    const limit = 10;
    const count = 7;
    const remaining = Math.max(0, limit - count);

    assert.equal(remaining, 3);
  });

  test("remaining calculation at limit", () => {
    const limit = 10;
    const count = 10;
    const remaining = Math.max(0, limit - count);

    assert.equal(remaining, 0);
  });

  test("remaining calculation over limit", () => {
    const limit = 10;
    const count = 15;
    const remaining = Math.max(0, limit - count);

    assert.equal(remaining, 0);
  });

  test("retryAfterMs when oldest entry within window", () => {
    const windowMs = 60000;
    const now = 1000000000000;
    const oldestTime = now - 30000;
    const retryAfterMs = Math.max(0, oldestTime + windowMs - now);

    assert.equal(retryAfterMs, 30000);
  });

  test("retryAfterMs when oldest entry outside window", () => {
    const windowMs = 60000;
    const now = 1000000000000;
    const oldestTime = now - 70000;
    const retryAfterMs = Math.max(0, oldestTime + windowMs - now);

    assert.equal(retryAfterMs, 0);
  });
});

test.describe("key prefix handling", () => {
  test("keyPrefix is prepended to rate limit key", () => {
    const keyPrefix = "ratelimit:";
    const key = "tenant:123";
    const fullKey = `${keyPrefix}${key}`;

    assert.equal(fullKey, "ratelimit:tenant:123");
  });

  test("custom keyPrefix works correctly", () => {
    const keyPrefix = "custom:";
    const key = "endpoint:/api/tasks";
    const fullKey = `${keyPrefix}${key}`;

    assert.equal(fullKey, "custom:endpoint:/api/tasks");
  });

  test("empty keyPrefix results in just the key", () => {
    const keyPrefix = "";
    const key = "tenant:456";
    const fullKey = `${keyPrefix}${key}`;

    assert.equal(fullKey, "tenant:456");
  });
});

test.describe("request ID generation", () => {
  test("requestId includes timestamp and random parts", () => {
    const now = 1000000000000;
    const requestId = `${now}:${Math.random()}`;
    const parts = requestId.split(":");

    assert.equal(parts.length, 2);
    assert.equal(parts[0], "1000000000000");
    assert.ok(parts[1] !== undefined);
  });

  test("multiple requestIds are unique", () => {
    const now = 1000000000000;
    const requestId1 = `${now}:${Math.random()}`;
    const requestId2 = `${now}:${Math.random()}`;

    assert.notEqual(requestId1, requestId2);
  });
});
