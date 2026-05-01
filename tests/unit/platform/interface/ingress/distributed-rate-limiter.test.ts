import assert from "node:assert/strict";
import test from "node:test";
import { DistributedRateLimiter, type RateLimiterConfig } from "../../../../../src/platform/interface/ingress/distributed-rate-limiter.js";

test("DistributedRateLimiter - construction with minimal config", () => {
  const limiter = new DistributedRateLimiter({});
  assert.ok(limiter instanceof DistributedRateLimiter);
});

test("DistributedRateLimiter - construction with full config", () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 50,
    windowMs: 2000,
    redis: { host: "localhost", port: 6379 },
  });
  assert.ok(limiter instanceof DistributedRateLimiter);
});

test("DistributedRateLimiter - default maxCalls is 100", async () => {
  const limiter = new DistributedRateLimiter({ windowMs: 1000 });

  // Should allow 100 requests
  for (let i = 0; i < 100; i++) {
    const result = await limiter.checkAndConsume("key");
    assert.equal(result.allowed, true, `Request ${i + 1} should be allowed`);
  }

  // 101st should be rejected
  const rejected = await limiter.checkAndConsume("key");
  assert.equal(rejected.allowed, false);
});

test("DistributedRateLimiter - default windowMs is 1000", async () => {
  const limiter = new DistributedRateLimiter({ maxCalls: 5 });

  // Exhaust limit
  for (let i = 0; i < 5; i++) {
    await limiter.checkAndConsume("key");
  }

  const rejected = await limiter.checkAndConsume("key");
  assert.equal(rejected.allowed, false);
  assert.ok(rejected.retryAfterMs !== undefined);
  assert.ok(rejected.retryAfterMs <= 1000 && rejected.retryAfterMs >= 0);
});

test("DistributedRateLimiter - checkAndConsume returns correct remaining count", async () => {
  const limiter = new DistributedRateLimiter({ maxCalls: 3, windowMs: 1000 });

  const r1 = await limiter.checkAndConsume("key");
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 2);

  const r2 = await limiter.checkAndConsume("key");
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 1);

  const r3 = await limiter.checkAndConsume("key");
  assert.equal(r3.allowed, true);
  assert.equal(r3.remaining, 0);
});

test("DistributedRateLimiter - rejects when limit exceeded", async () => {
  const limiter = new DistributedRateLimiter({ maxCalls: 2, windowMs: 1000 });

  await limiter.checkAndConsume("key");
  await limiter.checkAndConsume("key");

  const rejected = await limiter.checkAndConsume("key");
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.remaining, 0);
  assert.ok(rejected.retryAfterMs !== undefined);
  assert.ok(rejected.retryAfterMs > 0);
});

test("DistributedRateLimiter - maxCalls of zero rejects all requests", async () => {
  const limiter = new DistributedRateLimiter({ maxCalls: 0, windowMs: 1000 });

  const result = await limiter.checkAndConsume("key");
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.ok(result.retryAfterMs !== undefined);
});

test("DistributedRateLimiter - negative maxCalls rejects all requests", async () => {
  const limiter = new DistributedRateLimiter({ maxCalls: -1, windowMs: 1000 });

  const result = await limiter.checkAndConsume("key");
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
});

test("DistributedRateLimiter - different keys have independent limits", async () => {
  const limiter = new DistributedRateLimiter({ maxCalls: 2, windowMs: 1000 });

  // Exhaust key1
  assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key1")).allowed, false);

  // key2 should still work
  assert.equal((await limiter.checkAndConsume("key2")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key2")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key2")).allowed, false);
});

test("DistributedRateLimiter - window expiration resets counter", async () => {
  const limiter = new DistributedRateLimiter({ maxCalls: 1, windowMs: 50 });

  assert.equal((await limiter.checkAndConsume("key")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key")).allowed, false);

  // Wait for window to expire
  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.equal((await limiter.checkAndConsume("key")).allowed, true);
});

test("DistributedRateLimiter - allowed result does not have retryAfterMs", async () => {
  const limiter = new DistributedRateLimiter({ maxCalls: 10, windowMs: 1000 });

  const result = await limiter.checkAndConsume("key");
  assert.equal(result.allowed, true);
  assert.equal(result.retryAfterMs, undefined);
});

test("DistributedRateLimiter - rejected result has retryAfterMs", async () => {
  const limiter = new DistributedRateLimiter({ maxCalls: 1, windowMs: 1000 });

  await limiter.checkAndConsume("key");
  const rejected = await limiter.checkAndConsume("key");

  assert.equal(rejected.allowed, false);
  assert.ok(rejected.retryAfterMs !== undefined);
  assert.ok(rejected.retryAfterMs >= 0);
  assert.ok(rejected.retryAfterMs <= 1000);
});

test("DistributedRateLimiter - handles empty string key", async () => {
  const limiter = new DistributedRateLimiter({ maxCalls: 2, windowMs: 1000 });

  const r1 = await limiter.checkAndConsume("");
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 1);

  const r2 = await limiter.checkAndConsume("");
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 0);

  const r3 = await limiter.checkAndConsume("");
  assert.equal(r3.allowed, false);
});

test("DistributedRateLimiter - handles special characters in key", async () => {
  const limiter = new DistributedRateLimiter({ maxCalls: 3, windowMs: 1000 });

  const keys = [
    "tenant:123:user:456",
    "endpoint:/api/v1/tasks",
    "ip:192.168.1.1",
    "user@domain.com",
    "path/with/slashes",
  ];

  for (const key of keys) {
    const result = await limiter.checkAndConsume(key);
    assert.equal(result.allowed, true, `Key "${key}" should be allowed`);
  }
});

test("DistributedRateLimiter - rapid sequential requests respected", async () => {
  const limiter = new DistributedRateLimiter({ maxCalls: 5, windowMs: 1000 });

  for (let i = 0; i < 5; i++) {
    const result = await limiter.checkAndConsume("rapid");
    assert.equal(result.allowed, true, `Request ${i + 1} should be allowed`);
    assert.equal(result.remaining, 5 - i - 1);
  }

  const rejected = await limiter.checkAndConsume("rapid");
  assert.equal(rejected.allowed, false);
});

test("DistributedRateLimiter - multiple independent windows", async () => {
  const limiter = new DistributedRateLimiter({ maxCalls: 2, windowMs: 100 });

  // Exhaust first window for key1
  await limiter.checkAndConsume("key1");
  await limiter.checkAndConsume("key1");
  assert.equal((await limiter.checkAndConsume("key1")).allowed, false);

  // Wait 50ms - window still active
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal((await limiter.checkAndConsume("key1")).allowed, false);

  // Wait another 60ms - window expired
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal((await limiter.checkAndConsume("key1")).allowed, true);
});

test("DistributedRateLimiter - retryAfterMs decreases as time passes", async () => {
  const limiter = new DistributedRateLimiter({ maxCalls: 1, windowMs: 500 });

  await limiter.checkAndConsume("key");
  const first = await limiter.checkAndConsume("key");
  assert.ok(first.retryAfterMs !== undefined);

  await new Promise((resolve) => setTimeout(resolve, 200));
  const second = await limiter.checkAndConsume("key");
  assert.ok(second.retryAfterMs !== undefined);
  assert.ok(second.retryAfterMs < first.retryAfterMs!);
});

test("DistributedRateLimiter - large maxCalls value works", async () => {
  const limiter = new DistributedRateLimiter({ maxCalls: 10000, windowMs: 1000 });

  const result = await limiter.checkAndConsume("key");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 9999);
});

test("DistributedRateLimiter - very short window works", async () => {
  const limiter = new DistributedRateLimiter({ maxCalls: 1, windowMs: 1 });

  assert.equal((await limiter.checkAndConsume("key")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key")).allowed, false);
});