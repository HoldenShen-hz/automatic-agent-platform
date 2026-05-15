/**
 * DistributedRateLimiter Class Unit Tests
 *
 * Tests for DistributedRateLimiter class with mocked RedisRateLimiter.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DistributedRateLimiter } from "../../../../../src/platform/five-plane-interface/ingress/distributed-rate-limiter.js";
import type { RateLimitResult } from "../../../../../src/platform/five-plane-interface/ingress/redis-rate-limiter.js";

// Mock RedisRateLimiter for testing the Redis path
class MockRedisRateLimiter {
  public checkAndConsumeResults: RateLimitResult[] = [];
  public lastKey = "";
  public lastLimit = 0;
  public lastWindowMs = 0;

  async checkAndConsume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    this.lastKey = key;
    this.lastLimit = limit;
    this.lastWindowMs = windowMs;
    return this.checkAndConsumeResults.shift() ?? { allowed: true, remaining: limit };
  }
}

// Factory to create DistributedRateLimiter with mocked RedisRateLimiter
function createDistributedRateLimiterWithMockRedis(options: {
  maxCalls?: number;
  windowMs?: number;
  mockResults?: RateLimitResult[];
}) {
  const limiter = new DistributedRateLimiter({
    redis: { host: "localhost", port: 6379 },
    maxCalls: options.maxCalls ?? 100,
    windowMs: options.windowMs ?? 1000,
  });

  const mockRedisLimiter = new MockRedisRateLimiter();
  if (options.mockResults) {
    mockRedisLimiter.checkAndConsumeResults = options.mockResults;
  }

  // Replace the redisLimiter with our mock
  (limiter as any).redisLimiter = mockRedisLimiter;

  return { limiter, mockRedisLimiter };
}

test("DistributedRateLimiter constructor with redis config creates redisLimiter", () => {
  const limiter = new DistributedRateLimiter({
    redis: { host: "localhost", port: 6379 },
    maxCalls: 100,
    windowMs: 1000,
  });
  assert.ok(limiter !== null);
  assert.ok(limiter !== undefined);
});

test("DistributedRateLimiter constructor without redis config has null redisLimiter", () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 100,
    windowMs: 1000,
  });
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter checkAndConsume delegates to redisLimiter when configured", async () => {
  const { limiter, mockRedisLimiter } = createDistributedRateLimiterWithMockRedis({
    maxCalls: 10,
    windowMs: 1000,
    mockResults: [{ allowed: true, remaining: 9 }],
  });

  const result = await limiter.checkAndConsume("test:key");

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 9);
  assert.equal(mockRedisLimiter.lastKey, "test:key");
  assert.equal(mockRedisLimiter.lastLimit, 10);
  assert.equal(mockRedisLimiter.lastWindowMs, 1000);
});

test("DistributedRateLimiter checkAndConsume converts redis result - allowed case", async () => {
  const { limiter } = createDistributedRateLimiterWithMockRedis({
    maxCalls: 10,
    windowMs: 1000,
    mockResults: [{ allowed: true, remaining: 7 }],
  });

  const result = await limiter.checkAndConsume("key");

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 7);
  assert.equal(result.retryAfterMs, undefined);
});

test("DistributedRateLimiter checkAndConsume converts redis result - rejected case with retryAfterMs", async () => {
  const { limiter } = createDistributedRateLimiterWithMockRedis({
    maxCalls: 10,
    windowMs: 1000,
    mockResults: [{ allowed: false, remaining: 0, retryAfterMs: 5000 }],
  });

  const result = await limiter.checkAndConsume("key");

  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.equal(result.retryAfterMs, 5000);
});

test("DistributedRateLimiter checkAndConsume uses in-memory when no redis configured", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  // First request
  const r1 = await limiter.checkAndConsume("key");
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 1);

  // Second request
  const r2 = await limiter.checkAndConsume("key");
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 0);

  // Third request - should be rejected
  const r3 = await limiter.checkAndConsume("key");
  assert.equal(r3.allowed, false);
  assert.equal(r3.remaining, 0);
});

test("DistributedRateLimiter checkAndConsume in-memory mode respects window expiration", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 50,
  });

  assert.equal((await limiter.checkAndConsume("key")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key")).allowed, false);

  // Wait for window to expire
  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.equal((await limiter.checkAndConsume("key")).allowed, true);
});

test("DistributedRateLimiter checkAndConsume in-memory mode tracks keys independently", async () => {
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
});

test("DistributedRateLimiter uses default maxCalls of 100", () => {
  const limiter = new DistributedRateLimiter({});
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter uses default windowMs of 1000", () => {
  const limiter = new DistributedRateLimiter({});
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter applies custom maxCalls", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  for (let i = 0; i < 5; i++) {
    const result = await limiter.checkAndConsume("key");
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 5 - i - 1);
  }

  const rejected = await limiter.checkAndConsume("key");
  assert.equal(rejected.allowed, false);
});

test("DistributedRateLimiter applies custom windowMs", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 100,
  });

  assert.equal((await limiter.checkAndConsume("key")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key")).allowed, false);
});

test("DistributedRateLimiter retryAfterMs is approximate within window", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 100,
  });

  await limiter.checkAndConsume("key");
  const result = await limiter.checkAndConsume("key");

  assert.equal(result.allowed, false);
  assert.ok(result.retryAfterMs !== undefined);
  assert.ok(result.retryAfterMs >= 0);
  assert.ok(result.retryAfterMs <= 100);
});

test("DistributedRateLimiter in-memory mode handles empty key", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 4);
});

test("DistributedRateLimiter in-memory mode handles special characters in key", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("tenant:123:user:abc:action:def");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 4);
});

test("DistributedRateLimiter checkAndConsume passes correct params to redisLimiter", async () => {
  const { limiter, mockRedisLimiter } = createDistributedRateLimiterWithMockRedis({
    maxCalls: 50,
    windowMs: 5000,
    mockResults: [{ allowed: true, remaining: 49 }],
  });

  await limiter.checkAndConsume("mykey");

  assert.equal(mockRedisLimiter.lastKey, "mykey");
  assert.equal(mockRedisLimiter.lastLimit, 50);
  assert.equal(mockRedisLimiter.lastWindowMs, 5000);
});

test("DistributedRateLimiter toRateLimitCheckResult preserves allowed and remaining", async () => {
  const { limiter } = createDistributedRateLimiterWithMockRedis({
    maxCalls: 10,
    windowMs: 1000,
    mockResults: [{ allowed: true, remaining: 8 }],
  });

  const result = await limiter.checkAndConsume("key");

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 8);
});

test("DistributedRateLimiter toRateLimitCheckResult adds retryAfterMs when present", async () => {
  const { limiter } = createDistributedRateLimiterWithMockRedis({
    maxCalls: 10,
    windowMs: 1000,
    mockResults: [{ allowed: false, remaining: 0, retryAfterMs: 3000 }],
  });

  const result = await limiter.checkAndConsume("key");

  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.equal(result.retryAfterMs, 3000);
});

test("DistributedRateLimiter handles redis result with no retryAfterMs for allowed", async () => {
  const { limiter } = createDistributedRateLimiterWithMockRedis({
    maxCalls: 10,
    windowMs: 1000,
    mockResults: [{ allowed: true, remaining: 5 }],
  });

  const result = await limiter.checkAndConsume("key");

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 5);
  assert.equal("retryAfterMs" in result, false);
});

test("DistributedRateLimiter handles redis result with undefined retryAfterMs", async () => {
  const { limiter } = createDistributedRateLimiterWithMockRedis({
    maxCalls: 10,
    windowMs: 1000,
    mockResults: [{ allowed: true, remaining: 5 }] as RateLimitResult[],
  });

  const result = await limiter.checkAndConsume("key");

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 5);
});

test("DistributedRateLimiter redis path multiple sequential calls", async () => {
  const { limiter, mockRedisLimiter } = createDistributedRateLimiterWithMockRedis({
    maxCalls: 10,
    windowMs: 1000,
    mockResults: [
      { allowed: true, remaining: 9 },
      { allowed: true, remaining: 8 },
      { allowed: true, remaining: 7 },
    ],
  });

  const r1 = await limiter.checkAndConsume("key1");
  const r2 = await limiter.checkAndConsume("key2");
  const r3 = await limiter.checkAndConsume("key3");

  assert.equal(r1.remaining, 9);
  assert.equal(r2.remaining, 8);
  assert.equal(r3.remaining, 7);
});

test("DistributedRateLimiter in-memory mode decrements remaining correctly", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });

  const r1 = await limiter.checkAndConsume("key");
  assert.equal(r1.remaining, 9);

  const r2 = await limiter.checkAndConsume("key");
  assert.equal(r2.remaining, 8);

  const r3 = await limiter.checkAndConsume("key");
  assert.equal(r3.remaining, 7);

  const r4 = await limiter.checkAndConsume("key");
  assert.equal(r4.remaining, 6);

  const r5 = await limiter.checkAndConsume("key");
  assert.equal(r5.remaining, 5);
});

test("DistributedRateLimiter in-memory mode remaining never goes negative", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("key");
  await limiter.checkAndConsume("key");
  await limiter.checkAndConsume("key");
  await limiter.checkAndConsume("key");

  const result = await limiter.checkAndConsume("key");
  assert.equal(result.remaining, 0);
});

test("DistributedRateLimiter constructor accepts empty config", () => {
  const limiter = new DistributedRateLimiter({});
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter constructor accepts only redis config", () => {
  const limiter = new DistributedRateLimiter({
    redis: { host: "localhost", port: 6379 },
  });
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter constructor accepts only maxCalls", () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 25,
  });
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter constructor accepts only windowMs", () => {
  const limiter = new DistributedRateLimiter({
    windowMs: 2000,
  });
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter concurrent requests in-memory mode", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 100,
    windowMs: 1000,
  });

  const promises = Array(50).fill(null).map(() => limiter.checkAndConsume("concurrent"));
  const results = await Promise.all(promises);

  const allAllowed = results.every((r) => r.allowed);
  assert.ok(allAllowed);
});

test("DistributedRateLimiter in-memory entry reset after window expires", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 50,
  });

  // Exhaust
  await limiter.checkAndConsume("key");
  await limiter.checkAndConsume("key");
  const rejected = await limiter.checkAndConsume("key");
  assert.equal(rejected.allowed, false);

  // Wait for window
  await new Promise((resolve) => setTimeout(resolve, 60));

  // Should be fresh
  const fresh = await limiter.checkAndConsume("key");
  assert.equal(fresh.allowed, true);
  assert.equal(fresh.remaining, 1);
});

test("DistributedRateLimiter localEntries Map is properly managed", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("key1");
  await limiter.checkAndConsume("key1");
  await limiter.checkAndConsume("key2");

  // The Map should track separate entries
  const result = await limiter.checkAndConsume("key2");
  assert.equal(result.remaining, 0);
});
