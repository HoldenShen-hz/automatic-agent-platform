import assert from "node:assert/strict";
import test from "node:test";

import { DistributedRateLimiter } from "../../../../../src/platform/five-plane-interface/ingress/distributed-rate-limiter.js";
import { waitForCondition } from "../../../../helpers/wait.js";

test("DistributedRateLimiter uses in-memory mode when no Redis configured", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  // First 5 should be allowed
  for (let i = 0; i < 5; i++) {
    const result = await limiter.checkAndConsume("test-key");
    assert.equal(result.allowed, true, `request ${i + 1} should be allowed`);
    assert.equal(result.remaining, 5 - i - 1);
  }

  // 6th should be denied
  const denied = await limiter.checkAndConsume("test-key");
  assert.equal(denied.allowed, false);
  assert.equal(denied.remaining, 0);
  assert.ok(denied.retryAfterMs != null);
  assert.ok(denied.retryAfterMs > 0);
});

test("DistributedRateLimiter resets window after time expires", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 100, // Short window for testing
  });

  await limiter.checkAndConsume("time-test");
  await limiter.checkAndConsume("time-test");

  const denied = await limiter.checkAndConsume("time-test");
  assert.equal(denied.allowed, false);

  let allowed = await limiter.checkAndConsume("time-test");
  await waitForCondition(async () => {
    if (allowed.allowed) {
      return true;
    }
    allowed = await limiter.checkAndConsume("time-test");
    return allowed.allowed;
  }, {
    timeoutMs: 1_000,
    intervalMs: 20,
    description: "rate limiter window reset",
  });

  assert.equal(allowed.allowed, true);
  assert.equal(allowed.remaining, 1);
});

test("DistributedRateLimiter tracks separate keys independently", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("key-a");
  await limiter.checkAndConsume("key-a");
  await limiter.checkAndConsume("key-b"); // Different key, should be allowed

  const keyAResult = await limiter.checkAndConsume("key-a");
  assert.equal(keyAResult.allowed, false);

  const keyBResult = await limiter.checkAndConsume("key-b");
  assert.equal(keyBResult.allowed, true);
});

test("DistributedRateLimiter uses default config values", async () => {
  const limiter = new DistributedRateLimiter({});

  // Should use defaults: maxCalls=100, windowMs=1000
  // Use the SAME key to test per-key limits
  for (let i = 0; i < 100; i++) {
    const result = await limiter.checkAndConsume("default-test-same-key");
    assert.equal(result.allowed, true, `request ${i + 1} should be allowed`);
  }

  const denied = await limiter.checkAndConsume("default-test-same-key");
  assert.equal(denied.allowed, false);
});

test("DistributedRateLimiter applies config overrides correctly", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 3,
    windowMs: 5000,
  });

  // Exhaust the limit
  await limiter.checkAndConsume("override-test");
  await limiter.checkAndConsume("override-test");
  await limiter.checkAndConsume("override-test");

  const result = await limiter.checkAndConsume("override-test");
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
});
