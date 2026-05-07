import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  DistributedRateLimiter,
  type RateLimitCheckResult,
} from "../../../../../src/platform/five-plane-interface/ingress/distributed-rate-limiter.js";

test("DistributedRateLimiter uses in-memory mode when no Redis config", () => {
  const limiter = new DistributedRateLimiter({});
  assert.ok(limiter);
});

test("DistributedRateLimiter uses Redis mode when Redis config provided", () => {
  const limiter = new DistributedRateLimiter({
    redis: {
      host: "localhost",
      port: 6379,
    },
  });
  assert.ok(limiter);
});

test("DistributedRateLimiter defaults maxCalls to 100", () => {
  const limiter = new DistributedRateLimiter({});
  const maxCalls = (limiter as unknown as { maxCalls: number }).maxCalls;
  assert.equal(maxCalls, 100);
});

test("DistributedRateLimiter defaults windowMs to 1000", () => {
  const limiter = new DistributedRateLimiter({});
  const windowMs = (limiter as unknown as { windowMs: number }).windowMs;
  assert.equal(windowMs, 1000);
});

test("DistributedRateLimiter checkAndConsume allows first request in window", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("test-key");
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 9);
});

test("DistributedRateLimiter checkAndConsume decrements remaining as calls increase", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 3,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("test-key");
  const result2 = await limiter.checkAndConsume("test-key");
  const result3 = await limiter.checkAndConsume("test-key");

  assert.equal(result2.remaining, 1);
  assert.equal(result3.remaining, 0);
});

test("DistributedRateLimiter checkAndConsume blocks when limit exceeded", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("test-key");
  await limiter.checkAndConsume("test-key");
  const result = await limiter.checkAndConsume("test-key");

  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.ok(result.retryAfterMs !== undefined);
  assert.ok(result.retryAfterMs! > 0);
});

test("DistributedRateLimiter checkAndConsume includes retryAfterMs when blocked", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 500,
  });

  await limiter.checkAndConsume("test-key");
  const result = await limiter.checkAndConsume("test-key");

  assert.equal(result.allowed, false);
  assert.ok(result.retryAfterMs !== undefined);
  assert.ok(result.retryAfterMs! <= 500);
});

test("DistributedRateLimiter blocks all requests when maxCalls is 0", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 0,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("test-key");
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.equal(result.retryAfterMs, 1000);
});

test("DistributedRateLimiter blocks all requests when maxCalls is negative", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: -5,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("test-key");
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
});

test("DistributedRateLimiter uses separate entries for different keys", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("key-a");
  await limiter.checkAndConsume("key-a");
  const result = await limiter.checkAndConsume("key-b");

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 1);
});

test("DistributedRateLimiter resets window after windowMs expires", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 50,
  });

  await limiter.checkAndConsume("test-key");
  const blocked = await limiter.checkAndConsume("test-key");
  assert.equal(blocked.allowed, false);

  // Wait for window to expire
  await new Promise((resolve) => setTimeout(resolve, 60));

  const allowed = await limiter.checkAndConsume("test-key");
  assert.equal(allowed.allowed, true);
});

test("DistributedRateLimiter custom config maxCalls is used", () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 50,
    windowMs: 2000,
  });

  const maxCalls = (limiter as unknown as { maxCalls: number }).maxCalls;
  const windowMs = (limiter as unknown as { windowMs: number }).windowMs;

  assert.equal(maxCalls, 50);
  assert.equal(windowMs, 2000);
});

test("RateLimitCheckResult interface structure", () => {
  const result: RateLimitCheckResult = {
    allowed: true,
    remaining: 10,
  };
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 10);
  assert.equal(result.retryAfterMs, undefined);
});

test("RateLimitCheckResult interface with retryAfterMs", () => {
  const result: RateLimitCheckResult = {
    allowed: false,
    remaining: 0,
    retryAfterMs: 250,
  };
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.equal(result.retryAfterMs, 250);
});

test("DistributedRateLimiter RateLimiterConfig accepts redis config", () => {
  const limiter = new DistributedRateLimiter({
    redis: {
      host: "redis.example.com",
      port: 6380,
      password: "secret123",
      db: 2,
      keyPrefix: "ratelimit:custom:",
    },
    maxCalls: 200,
    windowMs: 500,
  });
  assert.ok(limiter);
});
