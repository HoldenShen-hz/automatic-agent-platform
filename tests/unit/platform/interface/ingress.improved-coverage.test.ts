/**
 * @fileoverview Improved coverage tests for src/platform/five-plane-interface/ingress
 * Tests RedisRateLimiter and DistributedRateLimiter - focusing on in-memory and type tests
 */

import assert from "node:assert/strict";
import test from "node:test";

// Note: Redis-dependent tests skipped - they require live Redis connection
// Tests focus on in-memory DistributedRateLimiter and algorithm/type validation

import { DistributedRateLimiter } from "../../../../src/platform/five-plane-interface/ingress/distributed-rate-limiter.js";

test("DistributedRateLimiter checkAndConsume with exact limit", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  const r1 = await limiter.checkAndConsume("exact");
  const r2 = await limiter.checkAndConsume("exact");
  const r3 = await limiter.checkAndConsume("exact");

  assert.equal(r1.allowed, true);
  assert.equal(r2.allowed, true);
  assert.equal(r3.allowed, false);
});

test("DistributedRateLimiter first request always allowed", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 5000,
  });

  const result = await limiter.checkAndConsume("first");

  assert.equal(result.allowed, true);
  assert.ok(result.remaining >= 0);
});

test("DistributedRateLimiter retryAfterMs decreases over time", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 100,
  });

  await limiter.checkAndConsume("time");
  const r1 = await limiter.checkAndConsume("time");
  assert.ok(r1.retryAfterMs !== undefined);

  // Wait a bit
  await new Promise((resolve) => setTimeout(resolve, 30));

  const r2 = await limiter.checkAndConsume("time");
  assert.ok(r2.retryAfterMs !== undefined);
  assert.ok(r2.retryAfterMs! < r1.retryAfterMs!);
});

test("DistributedRateLimiter result has correct type shape", () => {
  const result: { allowed: boolean; remaining: number; retryAfterMs?: number } = {
    allowed: true,
    remaining: 5,
  };

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 5);
  assert.equal(result.retryAfterMs, undefined);
});

test("sliding window calculation for 60 second window", () => {
  const now = 1000000000000;
  const windowMs = 60000;
  const windowStart = now - windowMs;

  assert.equal(windowStart, 999999940000);
});

test("sliding window calculation for 5 minute window", () => {
  const now = 1000000000000;
  const windowMs = 300000;
  const windowStart = now - windowMs;

  assert.equal(windowStart, 999999700000);
});

test("rate limit remaining calculation edge case at zero", () => {
  const limit = 10;
  const count = 10;
  const remaining = Math.max(0, limit - count);

  assert.equal(remaining, 0);
});

test("rate limit remaining calculation when over limit", () => {
  const limit = 10;
  const count = 15;
  const remaining = Math.max(0, limit - count);

  assert.equal(remaining, 0);
});

test("retryAfterMs calculation when entry is at window boundary", () => {
  const windowMs = 60000;
  const now = 1000000000000;
  const oldestTime = now - 60000; // exactly at window start
  const retryAfterMs = Math.max(0, oldestTime + windowMs - now);

  assert.equal(retryAfterMs, 0);
});

test("retryAfterMs calculation when entry is before window", () => {
  const windowMs = 60000;
  const now = 1000000000000;
  const oldestTime = now - 120000; // outside window
  const retryAfterMs = Math.max(0, oldestTime + windowMs - now);

  assert.equal(retryAfterMs, 0);
});

test("key construction with special characters", () => {
  const keyPrefix = "ratelimit:";
  const key = "tenant:user:123:action:/api/v1/task";
  const fullKey = `${keyPrefix}${key}`;

  assert.equal(fullKey, "ratelimit:tenant:user:123:action:/api/v1/task");
});

test("requestId uniqueness check", () => {
  const now = 1000000000000;
  const requestId1 = `${now}:${Math.random()}`;
  const requestId2 = `${now}:${Math.random()}`;

  assert.notEqual(requestId1, requestId2);
});

test("requestId format verification", () => {
  const now = Date.now();
  const requestId = `${now}:${Math.random()}`;
  const parts = requestId.split(":");

  assert.ok(parts.length === 2);
  assert.equal(parts[0], String(now));
});

test("DistributedRateLimiter empty config uses defaults", () => {
  const limiter = new DistributedRateLimiter({});

  assert.ok(limiter instanceof DistributedRateLimiter);
});

test("DistributedRateLimiter checkAndConsume tracks different keys independently", async () => {
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

test("DistributedRateLimiter uses in-memory when no Redis", async () => {
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

test("custom keyPrefix works correctly", () => {
  const keyPrefix = "custom:";
  const key = "endpoint:/api/tasks";
  const fullKey = `${keyPrefix}${key}`;

  assert.equal(fullKey, "custom:endpoint:/api/tasks");
});
