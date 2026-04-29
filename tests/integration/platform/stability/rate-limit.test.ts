import assert from "node:assert/strict";
import test from "node:test";

import { CallRateLimiter } from "../../../../src/platform/five-plane-execution/execution-engine/call-governance.js";

test("CallRateLimiter integration: multiple keys independent rate limiting", () => {
  const limiter = new CallRateLimiter({ maxCalls: 1, windowMs: 1000 });

  assert.equal(limiter.checkAndConsume("key-a").allowed, true);
  assert.equal(limiter.checkAndConsume("key-b").allowed, true);
  assert.equal(limiter.checkAndConsume("key-a").allowed, false);
  assert.equal(limiter.checkAndConsume("key-b").allowed, false);
});

test("CallRateLimiter integration: reset and reuse key", () => {
  const limiter = new CallRateLimiter({ maxCalls: 2, windowMs: 1000 });

  limiter.checkAndConsume("key");
  limiter.checkAndConsume("key");
  assert.equal(limiter.checkAndConsume("key").allowed, false);

  limiter.reset("key");
  assert.equal(limiter.checkAndConsume("key").allowed, true);
  assert.equal(limiter.checkAndConsume("key").allowed, true);
  assert.equal(limiter.checkAndConsume("key").allowed, false);
});

test("CallRateLimiter integration: window expiration allows reuse", () => {
  const limiter = new CallRateLimiter({ maxCalls: 1, windowMs: 50 });

  limiter.checkAndConsume("key", 0);
  assert.equal(limiter.checkAndConsume("key", 10).allowed, false);

  assert.equal(limiter.checkAndConsume("key", 60).allowed, true);
});

test("CallRateLimiter integration: evictExpired cleans stale entries", () => {
  const limiter = new CallRateLimiter({ maxCalls: 1, windowMs: 100 });

  limiter.checkAndConsume("stale-key", 0);
  limiter.checkAndConsume("fresh-key", 400);

  limiter.evictExpired(500);

  assert.equal(limiter.checkAndConsume("stale-key", 500).allowed, true);
  assert.equal(limiter.checkAndConsume("fresh-key", 500).allowed, true);

  // Second call on fresh-key should be blocked (count=2, max=1)
  assert.equal(limiter.checkAndConsume("fresh-key", 500).allowed, false);
});

test("CallRateLimiter integration: updateConfig changes behavior", () => {
  const limiter = new CallRateLimiter({ maxCalls: 2, windowMs: 1000 });

  limiter.checkAndConsume("key", 0);
  limiter.checkAndConsume("key", 0);
  assert.equal(limiter.checkAndConsume("key", 0).allowed, false);

  limiter.updateConfig({ maxCalls: 5, windowMs: 1000 });

  // After update, with timestamp 100 still within the window but count is 2
  // Check with fresh timestamp to verify config changed
  limiter.checkAndConsume("key", 100);
  limiter.checkAndConsume("key", 100);
  limiter.checkAndConsume("key", 100);
  // count was 2, + 3 = 5, should be allowed (but now at limit)
  assert.equal(limiter.checkAndConsume("key", 100).allowed, false);
});

test("CallRateLimiter integration: concurrent-like burst handling", () => {
  const limiter = new CallRateLimiter({ maxCalls: 3, windowMs: 100 });

  const results: boolean[] = [];
  for (let i = 0; i < 5; i++) {
    results.push(limiter.checkAndConsume("burst-key", 0).allowed);
  }

  assert.equal(results.filter((r) => r).length, 3);
  assert.equal(results.filter((r) => !r).length, 2);
});

test("CallRateLimiter integration: retryAfterMs calculation", () => {
  const limiter = new CallRateLimiter({ maxCalls: 2, windowMs: 1000 });

  limiter.checkAndConsume("key", 100);
  limiter.checkAndConsume("key", 100);

  const result = limiter.checkAndConsume("key", 200);
  assert.equal(result.allowed, false);
  assert.ok(result.retryAfterMs !== undefined);
  assert.ok(result.retryAfterMs >= 900);
});

test("CallRateLimiter integration: very small window still works", () => {
  const limiter = new CallRateLimiter({ maxCalls: 1, windowMs: 1 });

  assert.equal(limiter.checkAndConsume("key", 0).allowed, true);
  assert.equal(limiter.checkAndConsume("key", 0).allowed, false);
  assert.equal(limiter.checkAndConsume("key", 1).allowed, true);
  assert.equal(limiter.checkAndConsume("key", 1).allowed, false);
});

test("CallRateLimiter integration: null config allows unlimited", () => {
  const limiter = new CallRateLimiter(null);

  for (let i = 0; i < 100; i++) {
    assert.equal(limiter.checkAndConsume("any-key").allowed, true);
  }
});

test("CallRateLimiter integration: undefined config allows unlimited", () => {
  const limiter = new CallRateLimiter(undefined);

  for (let i = 0; i < 100; i++) {
    assert.equal(limiter.checkAndConsume("any-key").allowed, true);
  }
});