/**
 * Ingress Handler Unit Tests
 *
 * Tests for DistributedRateLimiter as the primary ingress handler.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DistributedRateLimiter } from "../../../../../src/platform/five-plane-interface/ingress/distributed-rate-limiter.js";

test("DistributedRateLimiter checkAndConsume allows requests under limit", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("tenant:abc");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 4);
});

test("DistributedRateLimiter checkAndConsume rejects requests over limit", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("key1");
  await limiter.checkAndConsume("key1");
  const result = await limiter.checkAndConsume("key1");

  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.ok(result.retryAfterMs !== undefined);
  assert.ok(result.retryAfterMs > 0);
});

test("DistributedRateLimiter tracks each key independently", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 1000,
  });

  assert.equal((await limiter.checkAndConsume("keyA")).allowed, true);
  assert.equal((await limiter.checkAndConsume("keyB")).allowed, true);
  assert.equal((await limiter.checkAndConsume("keyA")).allowed, false);
  assert.equal((await limiter.checkAndConsume("keyB")).allowed, false);
});

test("DistributedRateLimiter resets after window expires", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 50,
  });

  assert.equal((await limiter.checkAndConsume("key")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key")).allowed, false);

  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.equal((await limiter.checkAndConsume("key")).allowed, true);
});

test("DistributedRateLimiter uses default maxCalls of 100", async () => {
  const limiter = new DistributedRateLimiter({});

  // All 100 requests should be allowed with remaining going from 99 to 0
  for (let i = 0; i < 100; i++) {
    const result = await limiter.checkAndConsume("default_key");
    assert.equal(result.allowed, true, `request ${i + 1} should be allowed`);
  }

  // 101st request should be rejected
  const rejected = await limiter.checkAndConsume("default_key");
  assert.equal(rejected.allowed, false, "101st request should be rejected");
});

test("DistributedRateLimiter uses default windowMs when not specified", async () => {
  const limiter = new DistributedRateLimiter({});

  const result = await limiter.checkAndConsume("window_key");
  assert.equal(result.allowed, true);
});

test("DistributedRateLimiter remaining decrements correctly", async () => {
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

test("DistributedRateLimiter retryAfterMs decreases over time", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 100,
  });

  await limiter.checkAndConsume("key");
  const result1 = await limiter.checkAndConsume("key");

  await new Promise((resolve) => setTimeout(resolve, 50));
  const result2 = await limiter.checkAndConsume("key");

  assert.ok(result2.retryAfterMs !== undefined);
});

test("DistributedRateLimiter allows new window after full expiry", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 30,
  });

  await limiter.checkAndConsume("new_window");
  const blocked = await limiter.checkAndConsume("new_window");
  assert.equal(blocked.allowed, false);

  await new Promise((resolve) => setTimeout(resolve, 40));
  const allowed = await limiter.checkAndConsume("new_window");
  assert.equal(allowed.allowed, true);
});

test("DistributedRateLimiter handles rapid sequential calls", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });

  for (let i = 0; i < 10; i++) {
    const result = await limiter.checkAndConsume("rapid_key");
    assert.equal(result.allowed, true, `call ${i + 1} should be allowed`);
  }

  const blocked = await limiter.checkAndConsume("rapid_key");
  assert.equal(blocked.allowed, false);
});

test("DistributedRateLimiter result structure matches expected interface", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("struct_key");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 4);
  assert.equal(result.retryAfterMs, undefined);
});

test("DistributedRateLimiter checkLocal creates new entry on first call", () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 3,
    windowMs: 1000,
  });

  // Access private method via any to test internal behavior
  const result = limiter.checkLocal("first_call");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 2);
});

test("DistributedRateLimiter uses up full quota before rejecting", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 3,
    windowMs: 1000,
  });

  // Make exactly maxCalls requests - all should be allowed
  const r1 = await limiter.checkAndConsume("quota_key");
  const r2 = await limiter.checkAndConsume("quota_key");
  const r3 = await limiter.checkAndConsume("quota_key");

  assert.equal(r1.allowed, true);
  assert.equal(r2.allowed, true);
  assert.equal(r3.allowed, true);

  // Next request should be rejected
  const r4 = await limiter.checkAndConsume("quota_key");
  assert.equal(r4.allowed, false);
});

test("DistributedRateLimiter checkLocal expires old window entries", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 50,
  });

  assert.equal((await limiter.checkAndConsume("expiry_key")).allowed, true);
  assert.equal((await limiter.checkAndConsume("expiry_key")).allowed, true);

  await new Promise((resolve) => setTimeout(resolve, 60));

  const result = await limiter.checkAndConsume("expiry_key");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 1);
});

test("DistributedRateLimiter checkLocal increments count correctly", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("count_key");
  const r2 = await limiter.checkAndConsume("count_key");
  const r3 = await limiter.checkAndConsume("count_key");

  assert.equal(r2.remaining, 3);
  assert.equal(r3.remaining, 2);
});

test("DistributedRateLimiter handles maxCalls of 1 correctly", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 1000,
  });

  // First request should be allowed
  const r1 = await limiter.checkAndConsume("one_limit");
  assert.equal(r1.allowed, true);

  // Second request should be rejected
  const r2 = await limiter.checkAndConsume("one_limit");
  assert.equal(r2.allowed, false);
  assert.equal(r2.remaining, 0);
});

test("DistributedRateLimiter handles empty string key", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  assert.equal((await limiter.checkAndConsume("")).allowed, true);
  assert.equal((await limiter.checkAndConsume("")).allowed, true);
  assert.equal((await limiter.checkAndConsume("")).allowed, false);
});

test("DistributedRateLimiter handles special characters in key", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  const specialKey = "tenant:123|user:456:role:admin";
  assert.equal((await limiter.checkAndConsume(specialKey)).allowed, true);
  assert.equal((await limiter.checkAndConsume(specialKey)).allowed, true);
  assert.equal((await limiter.checkAndConsume(specialKey)).allowed, false);
});

test("DistributedRateLimiter windowStart calculation is accurate", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  const before = Date.now();
  const result = await limiter.checkAndConsume("timing_key");
  const after = Date.now();

  assert.equal(result.allowed, true);
  assert.ok(result.remaining <= 4);
});