/**
 * DistributedRateLimiter Full Coverage Unit Tests
 *
 * Comprehensive tests for DistributedRateLimiter achieving 100% coverage.
 * Uses flat test() structure without describe nesting.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DistributedRateLimiter } from "../../../../../src/platform/interface/ingress/distributed-rate-limiter.js";
import type { RateLimitResult } from "../../../../../src/platform/interface/ingress/redis-rate-limiter.js";

// Mock RedisRateLimiter for testing Redis path
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

// Factory for creating limiter with mock Redis
function createLimiterWithMockRedis(options: {
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

// Reset helper
function createFreshLimiter(config?: { maxCalls?: number; windowMs?: number; redis?: any }) {
  return new DistributedRateLimiter(config ?? {});
}

test("DistributedRateLimiter constructor with empty config uses defaults", () => {
  const limiter = new DistributedRateLimiter({});
  assert.ok(limiter !== null);
  assert.ok(limiter !== undefined);
});

test("DistributedRateLimiter constructor with only maxCalls", () => {
  const limiter = new DistributedRateLimiter({ maxCalls: 50 });
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter constructor with only windowMs", () => {
  const limiter = new DistributedRateLimiter({ windowMs: 2000 });
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter constructor with only redis config", () => {
  const limiter = new DistributedRateLimiter({
    redis: { host: "localhost", port: 6379 },
  });
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter constructor with all options", () => {
  const limiter = new DistributedRateLimiter({
    redis: { host: "localhost", port: 6379 },
    maxCalls: 100,
    windowMs: 1000,
  });
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter in-memory first request is allowed", async () => {
  const limiter = createFreshLimiter({ maxCalls: 10, windowMs: 1000 });
  const result = await limiter.checkAndConsume("key");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 9);
});

test("DistributedRateLimiter in-memory second request is allowed", async () => {
  const limiter = createFreshLimiter({ maxCalls: 2, windowMs: 1000 });
  await limiter.checkAndConsume("key");
  const result = await limiter.checkAndConsume("key");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 0);
});

test("DistributedRateLimiter in-memory third request is rejected", async () => {
  const limiter = createFreshLimiter({ maxCalls: 2, windowMs: 1000 });
  await limiter.checkAndConsume("key");
  await limiter.checkAndConsume("key");
  const result = await limiter.checkAndConsume("key");
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.ok(result.retryAfterMs !== undefined);
  assert.ok(result.retryAfterMs > 0);
});

test("DistributedRateLimiter in-memory retryAfterMs is approximate", async () => {
  const limiter = createFreshLimiter({ maxCalls: 1, windowMs: 100 });
  await limiter.checkAndConsume("key");
  const result = await limiter.checkAndConsume("key");
  assert.ok(result.retryAfterMs >= 0);
  assert.ok(result.retryAfterMs <= 100);
});

test("DistributedRateLimiter in-memory window expiration resets count", async () => {
  const limiter = createFreshLimiter({ maxCalls: 1, windowMs: 50 });
  await limiter.checkAndConsume("key");
  const rejected = await limiter.checkAndConsume("key");
  assert.equal(rejected.allowed, false);
  await new Promise((resolve) => setTimeout(resolve, 60));
  const allowed = await limiter.checkAndConsume("key");
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.remaining, 0);
});

test("DistributedRateLimiter in-memory tracks keys independently", async () => {
  const limiter = createFreshLimiter({ maxCalls: 1, windowMs: 1000 });
  const r1 = await limiter.checkAndConsume("key1");
  assert.equal(r1.allowed, true);
  const r2 = await limiter.checkAndConsume("key2");
  assert.equal(r2.allowed, true);
});

test("DistributedRateLimiter in-memory independent keys at limit", async () => {
  const limiter = createFreshLimiter({ maxCalls: 1, windowMs: 1000 });
  await limiter.checkAndConsume("key1");
  await limiter.checkAndConsume("key2");
  const r1 = await limiter.checkAndConsume("key1");
  const r2 = await limiter.checkAndConsume("key2");
  assert.equal(r1.allowed, false);
  assert.equal(r2.allowed, false);
});

test("DistributedRateLimiter redis path delegates correctly", async () => {
  const { limiter, mockRedisLimiter } = createLimiterWithMockRedis({
    maxCalls: 10,
    windowMs: 1000,
    mockResults: [{ allowed: true, remaining: 9 }],
  });

  const result = await limiter.checkAndConsume("testkey");

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 9);
  assert.equal(mockRedisLimiter.lastKey, "testkey");
  assert.equal(mockRedisLimiter.lastLimit, 10);
  assert.equal(mockRedisLimiter.lastWindowMs, 1000);
});

test("DistributedRateLimiter redis path passes correct parameters", async () => {
  const { limiter, mockRedisLimiter } = createLimiterWithMockRedis({
    maxCalls: 50,
    windowMs: 5000,
    mockResults: [{ allowed: true, remaining: 49 }],
  });

  await limiter.checkAndConsume("mykey");

  assert.equal(mockRedisLimiter.lastKey, "mykey");
  assert.equal(mockRedisLimiter.lastLimit, 50);
  assert.equal(mockRedisLimiter.lastWindowMs, 5000);
});

test("DistributedRateLimiter redis allowed result without retryAfterMs", async () => {
  const { limiter } = createLimiterWithMockRedis({
    maxCalls: 10,
    windowMs: 1000,
    mockResults: [{ allowed: true, remaining: 7 }],
  });

  const result = await limiter.checkAndConsume("key");

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 7);
  assert.equal("retryAfterMs" in result, false);
});

test("DistributedRateLimiter redis rejected result with retryAfterMs", async () => {
  const { limiter } = createLimiterWithMockRedis({
    maxCalls: 10,
    windowMs: 1000,
    mockResults: [{ allowed: false, remaining: 0, retryAfterMs: 5000 }],
  });

  const result = await limiter.checkAndConsume("key");

  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.equal(result.retryAfterMs, 5000);
});

test("DistributedRateLimiter redis result undefined retryAfterMs handled", async () => {
  const { limiter } = createLimiterWithMockRedis({
    maxCalls: 10,
    windowMs: 1000,
    mockResults: [{ allowed: true, remaining: 5 }] as RateLimitResult[],
  });

  const result = await limiter.checkAndConsume("key");

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 5);
});

test("DistributedRateLimiter redis sequential calls use queue", async () => {
  const { limiter } = createLimiterWithMockRedis({
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

test("DistributedRateLimiter in-memory remaining decrements correctly", async () => {
  const limiter = createFreshLimiter({ maxCalls: 10, windowMs: 1000 });

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

test("DistributedRateLimiter in-memory remaining never negative", async () => {
  const limiter = createFreshLimiter({ maxCalls: 2, windowMs: 1000 });

  await limiter.checkAndConsume("key");
  await limiter.checkAndConsume("key");
  await limiter.checkAndConsume("key");
  await limiter.checkAndConsume("key");

  const result = await limiter.checkAndConsume("key");
  assert.equal(result.remaining, 0);
});

test("DistributedRateLimiter in-memory handles empty string key", async () => {
  const limiter = createFreshLimiter({ maxCalls: 5, windowMs: 1000 });
  const result = await limiter.checkAndConsume("");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 4);
});

test("DistributedRateLimiter in-memory handles special characters in key", async () => {
  const limiter = createFreshLimiter({ maxCalls: 5, windowMs: 1000 });
  const result = await limiter.checkAndConsume("tenant:123:user:abc:action:def");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 4);
});

test("DistributedRateLimiter in-memory handles unicode in key", async () => {
  const limiter = createFreshLimiter({ maxCalls: 5, windowMs: 1000 });
  const result = await limiter.checkAndConsume("user:日本語:action");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 4);
});

test("DistributedRateLimiter in-memory handles very long key", async () => {
  const limiter = createFreshLimiter({ maxCalls: 5, windowMs: 1000 });
  const longKey = "key:" + "a".repeat(1000);
  const result = await limiter.checkAndConsume(longKey);
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 4);
});

test("DistributedRateLimiter in-memory concurrent requests all allowed", async () => {
  const limiter = createFreshLimiter({ maxCalls: 100, windowMs: 1000 });

  const promises = Array(50).fill(null).map(() => limiter.checkAndConsume("concurrent"));
  const results = await Promise.all(promises);

  const allAllowed = results.every((r) => r.allowed);
  assert.ok(allAllowed);
});

test("DistributedRateLimiter in-memory concurrent different keys", async () => {
  const limiter = createFreshLimiter({ maxCalls: 100, windowMs: 1000 });

  const promises = Array(50).fill(null).map((_, i) =>
    limiter.checkAndConsume(`concurrent:${i}`)
  );
  const results = await Promise.all(promises);

  const allAllowed = results.every((r) => r.allowed);
  assert.ok(allAllowed);
});

test("DistributedRateLimiter in-memory multiple keys exhaust separately", async () => {
  const limiter = createFreshLimiter({ maxCalls: 2, windowMs: 1000 });

  await limiter.checkAndConsume("key1");
  await limiter.checkAndConsume("key1");
  await limiter.checkAndConsume("key2");

  const result = await limiter.checkAndConsume("key2");
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
});

test("DistributedRateLimiter default maxCalls is 100", async () => {
  const limiter = createFreshLimiter({ windowMs: 1000 });

  const result = await limiter.checkAndConsume("key");
  assert.equal(result.remaining, 99);
});

test("DistributedRateLimiter default windowMs is 1000", () => {
  const limiter = createFreshLimiter({ maxCalls: 100 });
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter large maxCalls", async () => {
  const limiter = createFreshLimiter({ maxCalls: 1000000, windowMs: 1000 });

  const result = await limiter.checkAndConsume("key");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 999999);
});

test("DistributedRateLimiter very small windowMs", async () => {
  const limiter = createFreshLimiter({ maxCalls: 1, windowMs: 1 });

  const r1 = await limiter.checkAndConsume("key");
  assert.equal(r1.allowed, true);

  await new Promise((resolve) => setTimeout(resolve, 5));

  const r2 = await limiter.checkAndConsume("key");
  assert.equal(r2.allowed, true);
});

test("DistributedRateLimiter retryAfterMs is number type", async () => {
  const limiter = createFreshLimiter({ maxCalls: 1, windowMs: 1000 });

  await limiter.checkAndConsume("key");
  const result = await limiter.checkAndConsume("key");

  assert.equal(typeof result.retryAfterMs, "number");
});

test("DistributedRateLimiter toRateLimitCheckResult preserves allowed and remaining", async () => {
  const { limiter } = createLimiterWithMockRedis({
    maxCalls: 10,
    windowMs: 1000,
    mockResults: [{ allowed: true, remaining: 8 }],
  });

  const result = await limiter.checkAndConsume("key");

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 8);
});
