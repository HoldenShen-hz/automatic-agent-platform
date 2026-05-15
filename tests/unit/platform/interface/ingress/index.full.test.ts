/**
 * Ingress Module Full Coverage Unit Tests
 *
 * Tests for the barrel export index.ts ensuring all exports are available.
 * Uses flat test() structure without describe nesting.
 */

import assert from "node:assert/strict";
import test from "node:test";
import * as ingress from "../../../../../src/platform/five-plane-interface/ingress/index.js";

test("index exports DistributedRateLimiter", () => {
  assert.ok(ingress.DistributedRateLimiter !== undefined);
  assert.equal(typeof ingress.DistributedRateLimiter, "function");
});

test("index exports RedisRateLimiter", () => {
  assert.ok(ingress.RedisRateLimiter !== undefined);
  assert.equal(typeof ingress.RedisRateLimiter, "function");
});

test("index exports DistributedRateLimiter and RedisRateLimiter classes", () => {
  // These are the main exports from the barrel
  assert.ok(ingress.DistributedRateLimiter !== undefined);
  assert.ok(ingress.RedisRateLimiter !== undefined);
});

test("DistributedRateLimiter can be instantiated", () => {
  const limiter = new ingress.DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });
  assert.ok(limiter !== null);
  assert.ok(limiter !== undefined);
});

test("DistributedRateLimiter checkAndConsume returns expected structure", async () => {
  const limiter = new ingress.DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("test-key");

  assert.equal(typeof result.allowed, "boolean");
  assert.equal(typeof result.remaining, "number");
  assert.ok(result.allowed === true || result.allowed === false);
});

test("DistributedRateLimiter in-memory mode works", async () => {
  const limiter = new ingress.DistributedRateLimiter({
    maxCalls: 1,
    windowMs: 1000,
  });

  const r1 = await limiter.checkAndConsume("key");
  assert.equal(r1.allowed, true);

  const r2 = await limiter.checkAndConsume("key");
  assert.equal(r2.allowed, false);
});
