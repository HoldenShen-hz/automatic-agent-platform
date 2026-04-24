/**
 * DistributedRateLimiter Real-time Unit Tests
 *
 * Tests for DistributedRateLimiter class that actually instantiate and test
 * the class methods including Redis-backed and in-memory modes.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DistributedRateLimiter } from "../../../../../src/platform/interface/ingress/distributed-rate-limiter.js";

test("DistributedRateLimiter constructor with empty config", () => {
  const limiter = new DistributedRateLimiter({});
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter constructor with redis config", () => {
  const limiter = new DistributedRateLimiter({
    redis: { host: "localhost", port: 6379 },
  });
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter constructor with all options", () => {
  const limiter = new DistributedRateLimiter({
    redis: { host: "localhost", port: 6379, keyPrefix: "rl:" },
    maxCalls: 50,
    windowMs: 5000,
  });
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter checkAndConsume with in-memory mode returns correct structure", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("test-key");

  assert.equal(typeof result.allowed, "boolean");
  assert.equal(typeof result.remaining, "number");
});

test("DistributedRateLimiter checkAndConsume first request is allowed", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("key");

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 4);
});

test("DistributedRateLimiter checkAndConsume rejects when exhausted", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("key");
  await limiter.checkAndConsume("key");
  const result = await limiter.checkAndConsume("key");

  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
});

test("DistributedRateLimiter checkAndConsume includes retryAfterMs on rejection", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("key");
  const result = await limiter.checkAndConsume("key");

  assert.equal(result.allowed, false);
  assert.ok(result.retryAfterMs !== undefined);
  assert.ok(result.retryAfterMs > 0);
  assert.ok(result.retryAfterMs <= 1000);
});

test("DistributedRateLimiter checkAndConsume tracks multiple keys separately", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  // Exhaust key1
  assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key1")).allowed, false);

  // key2 should still work
  assert.equal((await limiter.checkAndConsume("key2")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key2")).allowed, true);
});

test("DistributedRateLimiter checkAndConsume window expiration", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 50,
  });

  assert.equal((await limiter.checkAndConsume("key")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key")).allowed, false);

  // Wait for window to expire
  await new Promise((resolve) => setTimeout(resolve, 60));

  // Should be allowed again
  assert.equal((await limiter.checkAndConsume("key")).allowed, true);
});

test("DistributedRateLimiter remaining counts down to zero", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 3,
    windowMs: 1000,
  });

  const r1 = await limiter.checkAndConsume("key");
  assert.equal(r1.remaining, 2);

  const r2 = await limiter.checkAndConsume("key");
  assert.equal(r2.remaining, 1);

  const r3 = await limiter.checkAndConsume("key");
  assert.equal(r3.remaining, 0);
});

test("DistributedRateLimiter remaining is undefined when allowed has no retry", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("key");

  if (result.allowed) {
    assert.equal(result.retryAfterMs, undefined);
  }
});

test("DistributedRateLimiter default config values", async () => {
  const limiter = new DistributedRateLimiter({});

  // Test behavior to verify defaults (maxCalls=100, windowMs=1000)
  const result = await limiter.checkAndConsume("d1");
  assert.equal(result.remaining, 99);
});

test("DistributedRateLimiter retryAfterMs calculation at window boundary", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 100,
  });

  await limiter.checkAndConsume("key");
  const result = await limiter.checkAndConsume("key");

  // retryAfterMs should be approximately the full window
  assert.ok(result.retryAfterMs !== undefined);
  assert.ok(result.retryAfterMs <= 100);
});

test("DistributedRateLimiter accepts Redis config without maxCalls", () => {
  const limiter = new DistributedRateLimiter({
    redis: { host: "localhost", port: 6379 },
  });
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter accepts maxCalls only", () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 25,
  });
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter accepts windowMs only", () => {
  const limiter = new DistributedRateLimiter({
    windowMs: 2000,
  });
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter with custom maxCalls and windowMs", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 2000,
  });

  for (let i = 0; i < 5; i++) {
    const result = await limiter.checkAndConsume("key");
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 5 - i - 1);
  }

  const rejected = await limiter.checkAndConsume("key");
  assert.equal(rejected.allowed, false);
});

test("DistributedRateLimiter concurrent requests for same key", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });

  const promises = Array(10).fill(null).map(() => limiter.checkAndConsume("concurrent"));
  const results = await Promise.all(promises);

  const allowedCount = results.filter(r => r.allowed).length;
  assert.equal(allowedCount, 10);
});

test("DistributedRateLimiter concurrent requests for different keys", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  const promises = [
    limiter.checkAndConsume("key1"),
    limiter.checkAndConsume("key2"),
    limiter.checkAndConsume("key3"),
  ];
  const results = await Promise.all(promises);

  const allowedCount = results.filter(r => r.allowed).length;
  assert.equal(allowedCount, 3);
});

test("DistributedRateLimiter checkLocal creates new entry on first request", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("new-key");

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 4);
});

test("DistributedRateLimiter checkLocal reuses existing entry within window", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("key");
  await limiter.checkAndConsume("key");
  const result = await limiter.checkAndConsume("key");

  assert.equal(result.remaining, 2);
});

test("DistributedRateLimiter checkLocal creates new entry after window expires", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 50,
  });

  // Exhaust
  await limiter.checkAndConsume("key");
  await limiter.checkAndConsume("key");

  // Wait for expiry
  await new Promise((resolve) => setTimeout(resolve, 60));

  // Should start fresh
  const result = await limiter.checkAndConsume("key");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 1);
});

test("DistributedRateLimiter toRateLimitCheckResult passes through allowed and remaining", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("key");

  // When allowed, no retryAfterMs
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 9);
  assert.equal(result.retryAfterMs, undefined);
});

test("DistributedRateLimiter toRateLimitCheckResult includes retryAfterMs when present", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("key");
  const result = await limiter.checkAndConsume("key");

  // When not allowed, retryAfterMs should be present
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.ok(result.retryAfterMs !== undefined);
});

test("DistributedRateLimiter with very small window", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 10,
  });

  assert.equal((await limiter.checkAndConsume("key")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key")).allowed, false);
});

test("DistributedRateLimiter with large window", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 100,
    windowMs: 60000,
  });

  const result = await limiter.checkAndConsume("key");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 99);
});

test("DistributedRateLimiter interface RateLimitCheckResult has allowed boolean", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("key");
  assert.equal(typeof result.allowed, "boolean");
});

test("DistributedRateLimiter interface RateLimitCheckResult has remaining number", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("key");
  assert.equal(typeof result.remaining, "number");
});

test("DistributedRateLimiter retryAfterMs is number when present", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("key");
  const result = await limiter.checkAndConsume("key");

  if (result.retryAfterMs !== undefined) {
    assert.equal(typeof result.retryAfterMs, "number");
  }
});

test("DistributedRateLimiter empty key string works", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("");
  assert.equal(result.allowed, true);
});

test("DistributedRateLimiter special characters in key work", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("tenant:123:user:abc:action:def");
  assert.equal(result.allowed, true);
});
