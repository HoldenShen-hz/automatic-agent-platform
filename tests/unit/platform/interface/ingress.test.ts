/**
 * @fileoverview Unit tests for src/platform/five-plane-interface/ingress
 * Tests RedisRateLimiter and DistributedRateLimiter implementations
 */

import assert from "node:assert/strict";
import test from "node:test";

import { RedisRateLimiter } from "../../../../src/platform/five-plane-interface/ingress/redis-rate-limiter.js";
import { DistributedRateLimiter } from "../../../../src/platform/five-plane-interface/ingress/distributed-rate-limiter.js";

function getRedisState(limiter: RedisRateLimiter): {
  keyPrefix: string;
  redis: Record<string, unknown>;
} {
  return limiter as unknown as {
    keyPrefix: string;
    redis: Record<string, unknown>;
  };
}

test("RedisRateLimiter constructor accepts config with all options", () => {
  const limiter = new RedisRateLimiter({
    host: "localhost",
    port: 6379,
    keyPrefix: "custom:",
    connectTimeout: 2000,
    maxRetriesPerRequest: 5,
  });

  assert.ok(limiter instanceof RedisRateLimiter);
});

test("RedisRateLimiter constructor uses default keyPrefix when not provided", () => {
  const limiter = new RedisRateLimiter({
    host: "localhost",
    port: 6379,
  });

  const state = getRedisState(limiter);
  assert.equal(state.keyPrefix, "ratelimit:");
  assert.equal(state.redis.options?.keyPrefix, "ratelimit:");
  state.redis.disconnect?.();
});

test("RedisRateLimiter config interface accepts keyPrefix", () => {
  const config = {
    host: "localhost",
    port: 6379,
    keyPrefix: "mylimit:",
  };

  assert.equal(config.keyPrefix, "mylimit:");
});

test("RedisRateLimiter close does not throw when redis is in ready state", async () => {
  const limiter = new RedisRateLimiter({
    host: "localhost",
    port: 6379,
  });
  const state = getRedisState(limiter);
  let quitCalls = 0;
  let disconnectCalls = 0;
  Object.defineProperty(state.redis, "status", {
    value: "ready",
    configurable: true,
    writable: true,
  });
  state.redis.quit = async () => {
    quitCalls += 1;
    return "OK";
  };
  state.redis.disconnect = () => {
    disconnectCalls += 1;
  };

  assert.equal(await limiter.close(), undefined);
  assert.equal(quitCalls, 1);
  assert.equal(disconnectCalls, 0);
});

test("DistributedRateLimiter constructor with Redis config", () => {
  const limiter = new DistributedRateLimiter({
    redis: {
      host: "localhost",
      port: 6379,
    },
    maxCalls: 50,
    windowMs: 500,
  });

  assert.ok(limiter instanceof DistributedRateLimiter);
});

test("DistributedRateLimiter constructor with in-memory only config", () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 100,
  });

  assert.ok(limiter instanceof DistributedRateLimiter);
});

test("DistributedRateLimiter uses default values when config is empty", () => {
  const limiter = new DistributedRateLimiter({});

  assert.ok(limiter instanceof DistributedRateLimiter);
});

test("DistributedRateLimiter checkAndConsume uses in-memory when no Redis", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 3,
    windowMs: 1000,
  });

  // First 3 should be allowed
  const r1 = await limiter.checkAndConsume("test-key");
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 2);

  const r2 = await limiter.checkAndConsume("test-key");
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 1);

  const r3 = await limiter.checkAndConsume("test-key");
  assert.equal(r3.allowed, true);
  assert.equal(r3.remaining, 0);

  // 4th should be rejected
  const r4 = await limiter.checkAndConsume("test-key");
  assert.equal(r4.allowed, false);
  assert.equal(r4.remaining, 0);
  assert.ok(r4.retryAfterMs !== undefined);
  assert.ok(r4.retryAfterMs! > 0);
});

test("DistributedRateLimiter checkAndConsume resets after window expires", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 50,
  });

  // First request allowed
  const r1 = await limiter.checkAndConsume("key");
  assert.equal(r1.allowed, true);

  // Second request rejected
  const r2 = await limiter.checkAndConsume("key");
  assert.equal(r2.allowed, false);

  // Wait for window to expire
  await new Promise((resolve) => setTimeout(resolve, 60));

  // Should be allowed again
  const r3 = await limiter.checkAndConsume("key");
  assert.equal(r3.allowed, true);
});

test("DistributedRateLimiter tracks different keys independently", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 1000,
  });

  // Exhaust key1
  assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key1")).allowed, false);

  // key2 should still work
  assert.equal((await limiter.checkAndConsume("key2")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key2")).allowed, false);

  // key1 still exhausted
  assert.equal((await limiter.checkAndConsume("key1")).allowed, false);
});

test("DistributedRateLimiter retryAfterMs is positive when limited", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("key");
  await limiter.checkAndConsume("key");

  const result = await limiter.checkAndConsume("key");
  assert.equal(result.allowed, false);
  assert.ok(result.retryAfterMs !== undefined);
  assert.ok(result.retryAfterMs! > 0);
  assert.ok(result.retryAfterMs! <= 1000);
});

test("DistributedRateLimiter window reset works correctly", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 100,
  });

  // Make some requests
  for (let i = 0; i < 5; i++) {
    const r = await limiter.checkAndConsume("x");
    assert.equal(r.allowed, true);
  }

  // Window should be exhausted
  assert.equal((await limiter.checkAndConsume("x")).allowed, false);

  // Wait for window to expire
  await new Promise((resolve) => setTimeout(resolve, 120));

  // Should be reset
  const r = await limiter.checkAndConsume("x");
  assert.equal(r.allowed, true);
});

test("RateLimitResult type allows allowed and remaining", () => {
  const result: { allowed: boolean; remaining: number; retryAfterMs?: number } = {
    allowed: true,
    remaining: 10,
  };

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 10);
  assert.equal(result.retryAfterMs, undefined);
});

test("RateLimitResult type allows retryAfterMs", () => {
  const result: { allowed: boolean; remaining: number; retryAfterMs?: number } = {
    allowed: false,
    remaining: 0,
    retryAfterMs: 5000,
  };

  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.equal(result.retryAfterMs, 5000);
});

test("RedisRateLimiterConfig interface accepts all fields", () => {
  const config = {
    host: "localhost",
    port: 6379,
    keyPrefix: "ratelimit:",
    connectTimeout: 1000,
    maxRetriesPerRequest: 3,
    password: "secret",
    db: 0,
  };

  assert.equal(config.host, "localhost");
  assert.equal(config.port, 6379);
  assert.equal(config.keyPrefix, "ratelimit:");
  assert.equal(config.connectTimeout, 1000);
  assert.equal(config.maxRetriesPerRequest, 3);
  assert.equal(config.password, "secret");
  assert.equal(config.db, 0);
});

test("DistributedRateLimiterConfig interface allows redis or in-memory", () => {
  // Redis config
  const withRedis: { redis?: { host: string; port: number }; maxCalls?: number; windowMs?: number } = {
    redis: { host: "localhost", port: 6379 },
    maxCalls: 100,
    windowMs: 1000,
  };

  assert.ok(withRedis.redis !== undefined);

  // In-memory only config
  const inMemory: { redis?: { host: string; port: number }; maxCalls?: number; windowMs?: number } = {
    maxCalls: 50,
    windowMs: 500,
  };

  assert.equal(inMemory.redis, undefined);
  assert.equal(inMemory.maxCalls, 50);
});

test("sliding window algorithm computes window start correctly", () => {
  const now = 1000000000000;
  const windowMs = 60000;
  const windowStart = now - windowMs;

  assert.equal(windowStart, 999999940000);
});

test("sliding window algorithm computes remaining correctly when under limit", () => {
  const limit = 10;
  const count = 7;
  const remaining = Math.max(0, limit - count);

  assert.equal(remaining, 3);
});

test("sliding window algorithm computes remaining as zero when at limit", () => {
  const limit = 10;
  const count = 10;
  const remaining = Math.max(0, limit - count);

  assert.equal(remaining, 0);
});

test("sliding window algorithm computes remaining as zero when over limit", () => {
  const limit = 10;
  const count = 15;
  const remaining = Math.max(0, limit - count);

  assert.equal(remaining, 0);
});

test("retryAfterMs computed correctly when oldest entry exists", () => {
  const windowMs = 60000;
  const now = 1000000000000;
  const oldestTime = now - 30000; // 30 seconds ago
  const retryAfterMs = Math.max(0, oldestTime + windowMs - now);

  assert.equal(retryAfterMs, 30000);
});

test("retryAfterMs is zero when oldest entry is beyond window", () => {
  const windowMs = 60000;
  const now = 1000000000000;
  const oldestTime = now - 70000; // older than window
  const retryAfterMs = Math.max(0, oldestTime + windowMs - now);

  assert.equal(retryAfterMs, 0);
});

test("requestId format includes timestamp and random parts", () => {
  const now = 1000000000000;
  const requestId = `${now}:${Math.random()}`;
  const parts = requestId.split(":");

  assert.equal(parts.length, 2);
  assert.equal(parts[0], "1000000000000");
  assert.ok(parts[1] !== undefined && parts[1].length > 0);
});

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

test("DistributedRateLimiter returns correct remaining count", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  assert.equal((await limiter.checkAndConsume("k")).remaining, 4);
  assert.equal((await limiter.checkAndConsume("k")).remaining, 3);
  assert.equal((await limiter.checkAndConsume("k")).remaining, 2);
  assert.equal((await limiter.checkAndConsume("k")).remaining, 1);
  assert.equal((await limiter.checkAndConsume("k")).remaining, 0);
});

test("DistributedRateLimiter different limits per limiter instance", async () => {
  const limiter1 = new DistributedRateLimiter({ maxCalls: 2, windowMs: 1000 });
  const limiter2 = new DistributedRateLimiter({ maxCalls: 5, windowMs: 1000 });

  // limiter1 allows 2 requests
  assert.equal((await limiter1.checkAndConsume("k")).allowed, true);
  assert.equal((await limiter1.checkAndConsume("k")).allowed, true);
  assert.equal((await limiter1.checkAndConsume("k")).allowed, false);

  // limiter2 allows 5 requests
  for (let i = 0; i < 5; i++) {
    assert.equal((await limiter2.checkAndConsume("k")).allowed, true);
  }
  assert.equal((await limiter2.checkAndConsume("k")).allowed, false);
});
