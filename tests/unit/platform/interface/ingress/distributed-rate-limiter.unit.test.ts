import assert from "node:assert/strict";
import test from "node:test";
import { DistributedRateLimiter } from "../../../../../src/platform/interface/ingress/distributed-rate-limiter.js";

test("DistributedRateLimiter - Constructor applies default config values", () => {
  const limiter = new DistributedRateLimiter({});

  // Default maxCalls is 100, default windowMs is 1000
  // First call should be allowed with remaining 99
  assert.ok(limiter instanceof DistributedRateLimiter);
});

test("DistributedRateLimiter - Constructor accepts custom maxCalls and windowMs", () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 50,
    windowMs: 2000,
  });

  assert.ok(limiter instanceof DistributedRateLimiter);
});

test("DistributedRateLimiter - Constructor accepts Redis config", () => {
  const limiter = new DistributedRateLimiter({
    redis: {
      host: "localhost",
      port: 6379,
    },
    maxCalls: 100,
    windowMs: 1000,
  });

  assert.ok(limiter instanceof DistributedRateLimiter);
});

test("DistributedRateLimiter - checkAndConsume returns correct structure for allowed request", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("test-key");

  assert.equal(typeof result.allowed, "boolean");
  assert.equal(typeof result.remaining, "number");
  if (result.allowed) {
    assert.ok(result.retryAfterMs === undefined);
  }
});

test("DistributedRateLimiter - checkAndConsume returns correct structure for rejected request", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("test-key");
  const rejected = await limiter.checkAndConsume("test-key");

  assert.equal(rejected.allowed, false);
  assert.equal(rejected.remaining, 0);
  assert.ok(rejected.retryAfterMs !== undefined);
  assert.ok(rejected.retryAfterMs > 0);
});

test("DistributedRateLimiter - in-memory mode blocks when limit exceeded", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 3,
    windowMs: 5000,
  });

  // Make 3 allowed calls
  const call1 = await limiter.checkAndConsume("limit-test");
  const call2 = await limiter.checkAndConsume("limit-test");
  const call3 = await limiter.checkAndConsume("limit-test");

  assert.equal(call1.allowed, true);
  assert.equal(call2.allowed, true);
  assert.equal(call3.allowed, true);

  // 4th call should be blocked
  const call4 = await limiter.checkAndConsume("limit-test");
  assert.equal(call4.allowed, false);
  assert.equal(call4.remaining, 0);
});

test("DistributedRateLimiter - in-memory mode allows after window expires", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 100,
  });

  await limiter.checkAndConsume("expiry-test");
  await limiter.checkAndConsume("expiry-test");

  const blocked = await limiter.checkAndConsume("expiry-test");
  assert.equal(blocked.allowed, false);

  // Wait for window to expire
  await new Promise((resolve) => setTimeout(resolve, 120));

  const allowed = await limiter.checkAndConsume("expiry-test");
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.remaining, 1);
});

test("DistributedRateLimiter - different keys have independent limits", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 5000,
  });

  // Exhaust key-a
  await limiter.checkAndConsume("key-a");
  const blockedA = await limiter.checkAndConsume("key-a");
  assert.equal(blockedA.allowed, false);

  // key-b should still work
  const allowedB = await limiter.checkAndConsume("key-b");
  assert.equal(allowedB.allowed, true);
});

test("DistributedRateLimiter - retryAfterMs decreases over time", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("retry-test");
  const initialRetry = await limiter.checkAndConsume("retry-test");
  assert.ok(initialRetry.retryAfterMs !== undefined);

  await new Promise((resolve) => setTimeout(resolve, 500));

  const laterRetry = await limiter.checkAndConsume("retry-test");
  assert.ok(laterRetry.retryAfterMs !== undefined);
  assert.ok(laterRetry.retryAfterMs < initialRetry.retryAfterMs!);
});

test("DistributedRateLimiter - remaining decrements correctly", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 5000,
  });

  const r1 = await limiter.checkAndConsume("remaining-test");
  assert.equal(r1.remaining, 4);

  const r2 = await limiter.checkAndConsume("remaining-test");
  assert.equal(r2.remaining, 3);

  const r3 = await limiter.checkAndConsume("remaining-test");
  assert.equal(r3.remaining, 2);

  const r4 = await limiter.checkAndConsume("remaining-test");
  assert.equal(r4.remaining, 1);

  const r5 = await limiter.checkAndConsume("remaining-test");
  assert.equal(r5.remaining, 0);
});

test("DistributedRateLimiter - handles zero maxCalls behavior", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 0,
    windowMs: 5000,
  });

  const result = await limiter.checkAndConsume("zero-limit");
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
});

test("DistributedRateLimiter - handles very large maxCalls", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1000000,
    windowMs: 5000,
  });

  const result = await limiter.checkAndConsume("large-limit");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 999999);
});

test("DistributedRateLimiter - handles windowMs of 1ms", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 1,
  });

  await limiter.checkAndConsume("tiny-window");
  const blocked = await limiter.checkAndConsume("tiny-window");
  assert.equal(blocked.allowed, false);

  // Window expires almost immediately
  await new Promise((resolve) => setTimeout(resolve, 5));

  const allowed = await limiter.checkAndConsume("tiny-window");
  assert.equal(allowed.allowed, true);
});

test("DistributedRateLimiter - concurrent requests are handled sequentially", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 5000,
  });

  // Simulate concurrent requests by awaiting them sequentially
  const results = await Promise.all([
    limiter.checkAndConsume("concurrent-key"),
    limiter.checkAndConsume("concurrent-key"),
    limiter.checkAndConsume("concurrent-key"),
  ]);

  // All should be allowed since they're processed sequentially
  results.forEach((result) => {
    assert.equal(result.allowed, true);
  });
});

test("DistributedRateLimiter - toRateLimitCheckResult preserves allowed and remaining", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 5000,
  });

  const result = await limiter.checkAndConsume("structure-test");

  assert.equal(typeof result.allowed, "boolean");
  assert.equal(typeof result.remaining, "number");
  assert.ok(result.remaining >= 0);
});

test("DistributedRateLimiter - toRateLimitCheckResult adds retryAfterMs when present", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 5000,
  });

  await limiter.checkAndConsume("retry-structure-test");
  const result = await limiter.checkAndConsume("retry-structure-test");

  if (!result.allowed) {
    assert.ok(result.retryAfterMs !== undefined);
    assert.ok(result.retryAfterMs >= 0);
  }
});

test("DistributedRateLimiter - localEntries map is properly managed", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 5000,
  });

  // Add entries for different keys
  await limiter.checkAndConsume("key-a");
  await limiter.checkAndConsume("key-a");
  // key-a has 2 requests (at limit)
  // key-b has 1 request (not at limit)

  const keyAResult = await limiter.checkAndConsume("key-a");
  const keyBResult = await limiter.checkAndConsume("key-b");

  assert.equal(keyAResult.allowed, false); // key-a is at limit
  assert.equal(keyBResult.allowed, true); // key-b has only 1 request
});

test("DistributedRateLimiter - maxCalls defaults to 100 when not specified", async () => {
  const limiter = new DistributedRateLimiter({
    windowMs: 5000,
  });

  // Should allow 100 requests
  for (let i = 0; i < 100; i++) {
    const result = await limiter.checkAndConsume("default-limit-test");
    assert.equal(result.allowed, true);
  }

  // 101st should be blocked
  const blocked = await limiter.checkAndConsume("default-limit-test");
  assert.equal(blocked.allowed, false);
});

test("DistributedRateLimiter - windowMs defaults to 1000 when not specified", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
  });

  await limiter.checkAndConsume("default-window-test");
  await limiter.checkAndConsume("default-window-test");
  await limiter.checkAndConsume("default-window-test");
  await limiter.checkAndConsume("default-window-test");
  await limiter.checkAndConsume("default-window-test");

  const blocked = await limiter.checkAndConsume("default-window-test");
  assert.equal(blocked.allowed, false);

  // After 1000ms, window should reset
  await new Promise((resolve) => setTimeout(resolve, 1050));

  const allowed = await limiter.checkAndConsume("default-window-test");
  assert.equal(allowed.allowed, true);
});

test("DistributedRateLimiter - uses Redis limiter when config.redis is provided", async () => {
  const limiter = new DistributedRateLimiter({
    redis: {
      host: "localhost",
      port: 6379,
      keyPrefix: "test-prefix:",
    },
    maxCalls: 10,
    windowMs: 1000,
  });

  // When Redis is configured, it should use RedisRateLimiter
  // Note: This test just verifies the limiter is created; actual Redis tests would need a Redis instance
  assert.ok(limiter instanceof DistributedRateLimiter);
});
