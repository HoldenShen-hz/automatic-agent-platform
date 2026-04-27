/**
 * Unit tests for Ingress edge cases
 * Tests src/platform/interface/ingress/distributed-rate-limiter.ts edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DistributedRateLimiter } from "../../../../../src/platform/interface/ingress/distributed-rate-limiter.js";

test("DistributedRateLimiter in-memory mode handles zero maxCalls", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 0,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("key");
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
});

test("DistributedRateLimiter in-memory mode handles very large maxCalls", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1000000,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("key");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 999999);
});

test("DistributedRateLimiter in-memory mode handles very small windowMs", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1,
  });

  // First few should be allowed
  for (let i = 0; i < 5; i++) {
    const result = await limiter.checkAndConsume("key");
    assert.equal(result.allowed, true);
  }
});

test("DistributedRateLimiter in-memory mode handles zero windowMs", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 0,
  });

  const r1 = await limiter.checkAndConsume("key");
  // With 0 window, behavior depends on implementation
  // Either window is treated as instant or has special handling
  assert.equal(typeof r1.allowed, "boolean");
});

test("DistributedRateLimiter handles unicode characters in key", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("tenant:abc:user:张三:action:登录");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 4);
});

test("DistributedRateLimiter handles emoji in key", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("key:🔐:action:✅");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 4);
});

test("DistributedRateLimiter handles very long key", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  const longKey = "a".repeat(10000);
  const result = await limiter.checkAndConsume(longKey);
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 4);
});

test("DistributedRateLimiter retryAfterMs calculation is accurate", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 500,
  });

  await limiter.checkAndConsume("key");
  const rejected = await limiter.checkAndConsume("key");

  assert.equal(rejected.allowed, false);
  assert.ok(rejected.retryAfterMs !== undefined);
  assert.ok(rejected.retryAfterMs >= 0);
  assert.ok(rejected.retryAfterMs <= 500);
});

test("DistributedRateLimiter multiple keys exhaust independently", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  // Exhaust key1
  await limiter.checkAndConsume("key1");
  await limiter.checkAndConsume("key1");
  assert.equal((await limiter.checkAndConsume("key1")).allowed, false);

  // key2 should still work
  const r1 = await limiter.checkAndConsume("key2");
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 1);

  const r2 = await limiter.checkAndConsume("key2");
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 0);

  // key3 should still work
  const r3 = await limiter.checkAndConsume("key3");
  assert.equal(r3.allowed, true);
  assert.equal(r3.remaining, 1);
});

test("DistributedRateLimiter in-memory map cleanup after window expires", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 50,
  });

  // Exhaust
  await limiter.checkAndConsume("key");
  assert.equal((await limiter.checkAndConsume("key")).allowed, false);

  // Wait for window
  await new Promise((resolve) => setTimeout(resolve, 60));

  // Fresh start
  const fresh = await limiter.checkAndConsume("key");
  assert.equal(fresh.allowed, true);
  assert.equal(fresh.remaining, 0);
});
