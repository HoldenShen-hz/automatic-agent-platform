/**
 * Unit tests for Ingress Controller
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DistributedRateLimiter } from "../../../../../src/platform/five-plane-interface/ingress/distributed-rate-limiter.js";
import type { RateLimitCheckResult } from "../../../../../src/platform/five-plane-interface/ingress/distributed-rate-limiter.js";

test("DistributedRateLimiter in-memory mode enforces maxCalls limit", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  const r1 = await limiter.checkAndConsume("test-key");
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 1);

  const r2 = await limiter.checkAndConsume("test-key");
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 0);

  const r3 = await limiter.checkAndConsume("test-key");
  assert.equal(r3.allowed, false);
  assert.equal(r3.remaining, 0);
});

test("DistributedRateLimiter in-memory mode resets after window expires", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 50,
  });

  const r1 = await limiter.checkAndConsume("reset-key");
  assert.equal(r1.allowed, true);

  const r2 = await limiter.checkAndConsume("reset-key");
  assert.equal(r2.allowed, false);

  await new Promise((resolve) => setTimeout(resolve, 60));

  const r3 = await limiter.checkAndConsume("reset-key");
  assert.equal(r3.allowed, true);
});

test("DistributedRateLimiter tracks different keys independently", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 10000,
  });

  assert.equal((await limiter.checkAndConsume("key-a")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key-a")).allowed, false);

  assert.equal((await limiter.checkAndConsume("key-b")).allowed, true);
  assert.equal((await limiter.checkAndConsume("key-b")).allowed, false);
});

test("DistributedRateLimiter retryAfterMs is calculated correctly", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 2,
    windowMs: 1000,
  });

  await limiter.checkAndConsume("retry-key");
  await limiter.checkAndConsume("retry-key");

  const result = await limiter.checkAndConsume("retry-key");
  assert.equal(result.allowed, false);
  assert.ok(result.retryAfterMs !== undefined);
  assert.ok(result.retryAfterMs! > 0);
  assert.ok(result.retryAfterMs! <= 1000);
});

test("DistributedRateLimiter with zero maxCalls denies all requests", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 0,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("zero-limit");
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
});

test("DistributedRateLimiter with negative maxCalls denies all requests", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: -5,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("negative-limit");
  assert.equal(result.allowed, false);
});

test("DistributedRateLimiter default values are applied", () => {
  const limiter = new DistributedRateLimiter({});

  assert.ok(limiter instanceof DistributedRateLimiter);
});

test("DistributedRateLimiter checkAndConsume returns RateLimitCheckResult shape", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("shape-check");
  assert.equal(typeof result.allowed, "boolean");
  assert.equal(typeof result.remaining, "number");
  if (!result.allowed) {
    assert.ok(result.retryAfterMs !== undefined);
  }
});

test("DistributedRateLimiter allows requests up to limit", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 3,
    windowMs: 1000,
  });

  const results: RateLimitCheckResult[] = [];
  for (let i = 0; i < 5; i++) {
    results.push(await limiter.checkAndConsume("multi-check"));
  }

  assert.equal(results[0]!.allowed, true);
  assert.equal(results[1]!.allowed, true);
  assert.equal(results[2]!.allowed, true);
  assert.equal(results[3]!.allowed, false);
  assert.equal(results[4]!.allowed, false);
});

test("DistributedRateLimiter remaining decrements correctly", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 5,
    windowMs: 1000,
  });

  assert.equal((await limiter.checkAndConsume("remaining")).remaining, 4);
  assert.equal((await limiter.checkAndConsume("remaining")).remaining, 3);
  assert.equal((await limiter.checkAndConsume("remaining")).remaining, 2);
  assert.equal((await limiter.checkAndConsume("remaining")).remaining, 1);
  assert.equal((await limiter.checkAndConsume("remaining")).remaining, 0);
});
