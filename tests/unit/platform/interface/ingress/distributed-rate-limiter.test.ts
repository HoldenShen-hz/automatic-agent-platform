import assert from "node:assert/strict";
import test from "node:test";
import { DistributedRateLimiter } from "../../../../../src/platform/interface/ingress/distributed-rate-limiter.js";

test("DistributedRateLimiter uses in-memory fallback when no Redis configured", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 3,
    windowMs: 1000,
  });

  // First 3 calls should be allowed
  for (let i = 0; i < 3; i++) {
    const result = await limiter.checkAndConsume("tenant:abc");
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 3 - i - 1);
  }

  // 4th call should be rejected
  const rejected = await limiter.checkAndConsume("tenant:abc");
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.remaining, 0);
  assert.ok(rejected.retryAfterMs !== undefined);
});

test("DistributedRateLimiter resets after window expires", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 50,
  });

  assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key1")).allowed, false);

  // Wait for window to expire
  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
});

test("DistributedRateLimiter tracks separate keys independently", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  // Exhaust key1
  assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key1")).allowed, false);

  // key2 should still be allowed
  assert.equal((await limiter.checkAndConsume("key2")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key2")).allowed, true);
});

test("DistributedRateLimiter applies custom config defaults", async () => {
  const limiter = new DistributedRateLimiter({});

  assert.equal((await limiter.checkAndConsume("default_key")).allowed, true);
});

test("DistributedRateLimiter retryAfterMs is positive and within window bounds", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 500,
  });

  await limiter.checkAndConsume("key");
  const rejected = await limiter.checkAndConsume("key");

  assert.equal(rejected.allowed, false);
  assert.ok(rejected.retryAfterMs !== undefined);
  assert.ok(rejected.retryAfterMs > 0);
  assert.ok(rejected.retryAfterMs <= 500);
});

test("DistributedRateLimiter remaining is accurate at limit boundary", async () => {
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
  assert.equal(r3.allowed, true);
});

test("DistributedRateLimiter rejects at exact limit", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("key");
  await limiter.checkAndConsume("key");
  const rejected = await limiter.checkAndConsume("key");

  assert.equal(rejected.allowed, false);
  assert.equal(rejected.remaining, 0);
});

test("DistributedRateLimiter handles very short window duration", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 5,
  });

  const r1 = await limiter.checkAndConsume("key");
  assert.equal(r1.allowed, true);

  const r2 = await limiter.checkAndConsume("key");
  assert.equal(r2.allowed, false);
});

test("DistributedRateLimiter handles large maxCalls", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1000,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("key");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 999);
});

test("DistributedRateLimiter window expiration resets count correctly", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 50,
  });

  assert.equal((await limiter.checkAndConsume("key")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key")).allowed, false);

  await new Promise((resolve) => setTimeout(resolve, 60));

  const afterExpiry = await limiter.checkAndConsume("key");
  assert.equal(afterExpiry.allowed, true);
  assert.equal(afterExpiry.remaining, 1);
});

test("DistributedRateLimiter multiple keys independent expiration", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 50,
  });

  await limiter.checkAndConsume("key1");
  assert.equal((await limiter.checkAndConsume("key1")).allowed, false);

  await new Promise((resolve) => setTimeout(resolve, 30));
  await limiter.checkAndConsume("key2");
  assert.equal((await limiter.checkAndConsume("key2")).allowed, false);

  await new Promise((resolve) => setTimeout(resolve, 30));
  const key1After = await limiter.checkAndConsume("key1");
  assert.equal(key1After.allowed, true);
});

test("DistributedRateLimiter allowed requests do not have retryAfterMs", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("key");
  assert.equal(result.allowed, true);
  assert.equal(result.retryAfterMs, undefined);
});

test("DistributedRateLimiter rejected requests have retryAfterMs", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("key");
  const rejected = await limiter.checkAndConsume("key");

  assert.equal(rejected.allowed, false);
  assert.ok(rejected.retryAfterMs !== undefined);
  assert.ok(rejected.retryAfterMs >= 0);
});

test("DistributedRateLimiter handles empty string key", async () => {
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

test("DistributedRateLimiter handles special characters in key", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 3,
    windowMs: 1000,
  });

  const keys = [
    "tenant:123:user:abc",
    "endpoint:/api/v1/tasks",
    "ip:192.168.1.1",
  ];

  for (const key of keys) {
    const result = await limiter.checkAndConsume(key);
    assert.equal(result.allowed, true);
  }
});

test("DistributedRateLimiter rapid sequential requests", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });

  for (let i = 0; i < 10; i++) {
    const result = await limiter.checkAndConsume("rapid");
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 10 - i - 1);
  }

  const rejected = await limiter.checkAndConsume("rapid");
  assert.equal(rejected.allowed, false);
});
