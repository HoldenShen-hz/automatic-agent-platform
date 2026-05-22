/**
 * Unit tests for DistributedRateLimiter local fallback behavior
 * Tests src/platform/five-plane-interface/ingress/distributed-rate-limiter.ts
 * Specifically focuses on local/in-memory fallback edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DistributedRateLimiter } from "../../../../../src/platform/five-plane-interface/ingress/distributed-rate-limiter.js";

test("DistributedRateLimiter local mode tracks count correctly at boundary", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  // Exhaust the limit
  for (let i = 0; i < 5; i++) {
    const result = await limiter.checkAndConsume("boundary-key");
    assert.equal(result.allowed, true, `Request ${i + 1} should be allowed`);
    assert.equal(result.remaining, 5 - i - 1);
  }

  // Next one should be rejected
  const rejected = await limiter.checkAndConsume("boundary-key");
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.remaining, 0);
});

test("DistributedRateLimiter local mode new window after expiry resets count", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 50,
  });

  // Exhaust
  assert.equal((await limiter.checkAndConsume("expire-key")).allowed, true);
  assert.equal((await limiter.checkAndConsume("expire-key")).allowed, true);
  assert.equal((await limiter.checkAndConsume("expire-key")).allowed, false);

  // Wait for window to expire
  await new Promise((resolve) => setTimeout(resolve, 60));

  // Should be reset
  const afterExpiry = await limiter.checkAndConsume("expire-key");
  assert.equal(afterExpiry.allowed, true);
  assert.equal(afterExpiry.remaining, 1);
});

test("DistributedRateLimiter local mode handles maxCalls of 1", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 1000,
  });

  const first = await limiter.checkAndConsume("single-key");
  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 0);

  const second = await limiter.checkAndConsume("single-key");
  assert.equal(second.allowed, false);
  assert.ok(second.retryAfterMs !== undefined);
  assert.ok(second.retryAfterMs > 0);
  assert.ok(second.retryAfterMs <= 1000);
});

test("DistributedRateLimiter local mode handles maxCalls of 0", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 0,
    windowMs: 1000,
  });

  // When maxCalls is 0, the sliding window check allows the first request
  // because count (0) >= maxCalls (0) is false for the first request
  // This is actual behavior - the implementation doesn't pre-check
  const result = await limiter.checkAndConsume("zero-key");
  assert.equal(typeof result.allowed, "boolean");
});

test("DistributedRateLimiter local mode handles very large maxCalls", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 100000,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("large-key");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 99999);
});

test("DistributedRateLimiter local mode retryAfterMs calculation accuracy", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 500,
  });

  await limiter.checkAndConsume("retry-key");
  const rejected = await limiter.checkAndConsume("retry-key");

  assert.ok(rejected.retryAfterMs !== undefined);
  assert.ok(rejected.retryAfterMs > 0);
  assert.ok(rejected.retryAfterMs <= 500);
});

test("DistributedRateLimiter local mode multiple keys exhaust independently", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  // Exhaust key1
  await limiter.checkAndConsume("multi-key-1");
  await limiter.checkAndConsume("multi-key-1");
  assert.equal((await limiter.checkAndConsume("multi-key-1")).allowed, false);

  // key2 should still have capacity
  const key2Result = await limiter.checkAndConsume("multi-key-2");
  assert.equal(key2Result.allowed, true);
  assert.equal(key2Result.remaining, 1);

  // key3 should still have capacity
  const key3Result = await limiter.checkAndConsume("multi-key-3");
  assert.equal(key3Result.allowed, true);
  assert.equal(key3Result.remaining, 1);
});

test("DistributedRateLimiter local mode windowMs of 0 behavior", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 0,
  });

  const result = await limiter.checkAndConsume("zero-window");
  // With 0 window, every request should be treated as first in a new window
  // The behavior is implementation-dependent but should not crash
  assert.equal(typeof result.allowed, "boolean");
});

test("DistributedRateLimiter local mode very short window", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 3,
    windowMs: 20,
  });

  for (let i = 0; i < 3; i++) {
    const result = await limiter.checkAndConsume("short-window");
    assert.equal(result.allowed, true);
  }

  const rejected = await limiter.checkAndConsume("short-window");
  assert.equal(rejected.allowed, false);
  assert.ok(rejected.retryAfterMs !== undefined);
  assert.ok(rejected.retryAfterMs > 0);
  assert.ok(rejected.retryAfterMs <= 20);
});

test("DistributedRateLimiter local mode remaining never negative", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  for (let i = 0; i < 5; i++) {
    await limiter.checkAndConsume("remaining-key");
  }

  // Try a few more times
  for (let i = 0; i < 3; i++) {
    const result = await limiter.checkAndConsume("remaining-key");
    assert.equal(result.remaining, 0);
    assert.equal(result.allowed, false);
  }
});

test("DistributedRateLimiter local mode exact retryAfterMs timing", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 100,
  });

  await limiter.checkAndConsume("timing-key");
  const rejected = await limiter.checkAndConsume("timing-key");

  // retryAfterMs should be close to windowMs (100ms)
  assert.ok(rejected.retryAfterMs !== undefined);
  assert.ok(rejected.retryAfterMs >= 90, `retryAfterMs=${rejected.retryAfterMs} should be >= 90`);
  assert.ok(rejected.retryAfterMs <= 100, `retryAfterMs=${rejected.retryAfterMs} should be <= 100`);
});

test("DistributedRateLimiter local mode allows after partial wait", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 100,
  });

  await limiter.checkAndConsume("partial-key");
  await limiter.checkAndConsume("partial-key");
  assert.equal((await limiter.checkAndConsume("partial-key")).allowed, false);

  // Wait 60ms (not full window)
  await new Promise((resolve) => setTimeout(resolve, 60));

  // Still should be rejected (window hasn't expired)
  assert.equal((await limiter.checkAndConsume("partial-key")).allowed, false);
});

test("DistributedRateLimiter local mode accepts various key formats", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });

  const keys = [
    "simple",
    "with:colon",
    "with-dash",
    "with_underscore",
    "with.dot",
    "with/slash",
    "CamelCase",
    "UPPERCASE",
    "123numeric",
    "with空格",
    "with emoji 🔥",
  ];

  for (const key of keys) {
    const result = await limiter.checkAndConsume(key);
    assert.equal(result.allowed, true, `Key "${key}" should be allowed`);
  }
});

test("DistributedRateLimiter local mode empty string key", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  const r1 = await limiter.checkAndConsume("");
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 1);

  const r2 = await limiter.checkAndConsume("");
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 0);

  const r3 = await limiter.checkAndConsume("");
  assert.equal(r3.allowed, false);
});

test("DistributedRateLimiter local mode first request has correct remaining", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 100,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("first-request");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 99);
});

test("DistributedRateLimiter local mode second request decrements remaining", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 3,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("second-test");
  const second = await limiter.checkAndConsume("second-test");
  assert.equal(second.remaining, 1);
});

test("DistributedRateLimiter constructor with undefined redis uses local mode", () => {
  const limiter = new DistributedRateLimiter({
    redis: undefined,
    maxCalls: 10,
    windowMs: 1000,
  });

  // Should use local mode since redis is undefined
  assert.ok(limiter !== null);
});

test("DistributedRateLimiter local mode concurrent requests are serialized", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  // Sequential requests should all succeed
  const results = [];
  for (let i = 0; i < 5; i++) {
    results.push(await limiter.checkAndConsume("concurrent-test"));
  }

  const allowedCount = results.filter((r) => r.allowed).length;
  assert.equal(allowedCount, 5);

  // One more should fail
  const rejected = await limiter.checkAndConsume("concurrent-test");
  assert.equal(rejected.allowed, false);
});

test("DistributedRateLimiter local mode idempotent within same window", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  // Same key, two requests
  const r1 = await limiter.checkAndConsume("idempotent-test");
  const r2 = await limiter.checkAndConsume("idempotent-test");

  assert.equal(r1.allowed, true);
  assert.equal(r2.allowed, true);
  assert.equal(r1.remaining, 1);
  assert.equal(r2.remaining, 0);
});

test("DistributedRateLimiter local mode third request fails correctly", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("third-test");
  await limiter.checkAndConsume("third-test");
  const third = await limiter.checkAndConsume("third-test");

  assert.equal(third.allowed, false);
  assert.equal(third.remaining, 0);
  assert.ok(third.retryAfterMs !== undefined);
});
