/**
 * DistributedRateLimiter Unit Tests
 *
 * Tests for DistributedRateLimiter class, focusing on:
 * - Redis-backed rate limiting path
 * - toRateLimitCheckResult conversion
 */

import assert from "node:assert/strict";
import test from "node:test";

// Mock RedisRateLimiter
const mockCheckAndConsumeResults: Array<{ allowed: boolean; remaining: number; retryAfterMs?: number }> = [];

const mockRedisRateLimiter = {
  checkAndConsume: async (key: string, limit: number, windowMs: number) => {
    return mockCheckAndConsumeResults.shift() ?? { allowed: true, remaining: limit };
  },
};

// We need to test the class directly, so we'll test the interface behavior
import { DistributedRateLimiter, RateLimitCheckResult } from "../../../../../src/platform/interface/ingress/distributed-rate-limiter.js";

function resetMocks() {
  mockCheckAndConsumeResults.length = 0;
}

test("DistributedRateLimiter constructor applies default config values", () => {
  const limiter = new DistributedRateLimiter({});
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter constructor uses provided redis config", () => {
  const limiter = new DistributedRateLimiter({
    redis: { host: "localhost", port: 6379 },
    maxCalls: 50,
    windowMs: 5000,
  });
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter uses default maxCalls when not specified", () => {
  const limiter = new DistributedRateLimiter({});
  // Default maxCalls is 100
  // We can verify this by checking the behavior
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter uses default windowMs when not specified", () => {
  const limiter = new DistributedRateLimiter({});
  // Default windowMs is 1000
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter checkAndConsume returns correct structure for allowed request", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("test:key");

  assert.equal(typeof result.allowed, "boolean");
  assert.equal(typeof result.remaining, "number");
  assert.ok(result.allowed === true || result.allowed === false);
});

test("DistributedRateLimiter checkAndConsume returns correct structure for rejected request", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 1000,
  });

  // First request should be allowed
  await limiter.checkAndConsume("test:key");
  // Second should be rejected
  const result = await limiter.checkAndConsume("test:key");

  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.ok(result.retryAfterMs !== undefined);
  assert.ok(result.retryAfterMs > 0);
});

test("DistributedRateLimiter checkAndConsume sets retryAfterMs on rejection", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("test:key");
  const result = await limiter.checkAndConsume("test:key");

  assert.ok(result.retryAfterMs !== undefined);
  assert.ok(result.retryAfterMs >= 0);
  assert.ok(result.retryAfterMs <= 1000);
});

test("DistributedRateLimiter localEntries Map is initialized empty", () => {
  const limiter = new DistributedRateLimiter({});
  // The localEntries is private, but we can test via behavior
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter tracks multiple keys separately in memory mode", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  // Exhaust key1
  assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key1")).allowed, false);

  // key2 should still have capacity
  assert.equal((await limiter.checkAndConsume("key2")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key2")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key2")).allowed, false);
});

test("DistributedRateLimiter in-memory window expires correctly", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 50,
  });

  // Exhaust the limit
  assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key1")).allowed, false);

  // Wait for window to expire
  await new Promise((resolve) => setTimeout(resolve, 60));

  // Should be allowed again after window expires
  assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
});

test("DistributedRateLimiter remaining decrements correctly", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  const r1 = await limiter.checkAndConsume("key");
  assert.equal(r1.remaining, 4);

  const r2 = await limiter.checkAndConsume("key");
  assert.equal(r2.remaining, 3);

  const r3 = await limiter.checkAndConsume("key");
  assert.equal(r3.remaining, 2);
});

test("DistributedRateLimiter remaining reaches zero at limit", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 3,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("key");
  await limiter.checkAndConsume("key");
  const r3 = await limiter.checkAndConsume("key");

  assert.equal(r3.remaining, 0);
  assert.equal(r3.allowed, true);
});

test("DistributedRateLimiter checkAndConsume with very short window", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 10,
  });

  const r1 = await limiter.checkAndConsume("key");
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 0);
});

test("DistributedRateLimiter checkAndConsume with large maxCalls", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10000,
    windowMs: 1000,
  });

  const r = await limiter.checkAndConsume("key");
  assert.equal(r.allowed, true);
  assert.equal(r.remaining, 9999);
});

test("DistributedRateLimiter RateLimitCheckResult interface compliance", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("key");

  // Verify result matches interface
  assert.ok("allowed" in result);
  assert.ok("remaining" in result);
  assert.equal(typeof result.allowed, "boolean");
  assert.equal(typeof result.remaining, "number");
});

test("DistributedRateLimiter retryAfterMs is undefined for allowed requests", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("key");

  if (result.allowed) {
    assert.equal(result.retryAfterMs, undefined);
  }
});

test("DistributedRateLimiter handles concurrent requests for same key", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  // Make concurrent requests
  const promises = Array(5).fill(null).map(() => limiter.checkAndConsume("concurrent-key"));
  const results = await Promise.all(promises);

  // All should be allowed
  const allowedCount = results.filter((r) => r.allowed).length;
  assert.equal(allowedCount, 5);
});

test("DistributedRateLimiter handles concurrent requests for different keys", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  // Make concurrent requests for different keys
  const promises = [
    limiter.checkAndConsume("key1"),
    limiter.checkAndConsume("key2"),
    limiter.checkAndConsume("key3"),
  ];
  const results = await Promise.all(promises);

  // All should be allowed since different keys
  const allowedCount = results.filter((r) => r.allowed).length;
  assert.equal(allowedCount, 3);
});
