import assert from "node:assert/strict";
import test from "node:test";

/**
 * @fileoverview Unit tests for src/platform/five-plane-interface/ingress/index.ts
 * Tests barrel exports and type definitions
 */

import {
  DistributedRateLimiter,
  RedisRateLimiter,
  type RedisRateLimiterConfig,
  type RateLimitResult,
  type RateLimiterConfig,
  type RateLimitCheckResult,
} from "../../../../../src/platform/five-plane-interface/ingress/index.js";

test("index exports DistributedRateLimiter as a constructor", () => {
  assert.equal(typeof DistributedRateLimiter, "function");
});

test("index exports RedisRateLimiter as a constructor", () => {
  assert.equal(typeof RedisRateLimiter, "function");
});

test("DistributedRateLimiter can be instantiated with empty config", () => {
  const limiter = new DistributedRateLimiter({});
  assert.ok(limiter instanceof DistributedRateLimiter);
});

test("DistributedRateLimiter can be instantiated with in-memory config", () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 100,
    windowMs: 1000,
  });
  assert.ok(limiter instanceof DistributedRateLimiter);
});

test("DistributedRateLimiter can be instantiated with Redis config", () => {
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

test("RedisRateLimiterConfig type is exported and usable", () => {
  const config: RedisRateLimiterConfig = {
    host: "localhost",
    port: 6379,
    keyPrefix: "test:",
  };
  assert.equal(config.host, "localhost");
  assert.equal(config.port, 6379);
  assert.equal(config.keyPrefix, "test:");
});

test("RedisRateLimiterConfig type allows optional keyPrefix", () => {
  const config: RedisRateLimiterConfig = {
    host: "localhost",
    port: 6379,
  };
  assert.equal(config.keyPrefix, undefined);
});

test("RateLimitResult type is exported and usable", () => {
  const result: RateLimitResult = {
    allowed: true,
    remaining: 10,
  };
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 10);
});

test("RateLimitResult type allows retryAfterMs", () => {
  const result: RateLimitResult = {
    allowed: false,
    remaining: 0,
    retryAfterMs: 5000,
  };
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.equal(result.retryAfterMs, 5000);
});

test("RateLimiterConfig type is exported and usable", () => {
  const config: RateLimiterConfig = {
    maxCalls: 50,
    windowMs: 500,
  };
  assert.equal(config.maxCalls, 50);
  assert.equal(config.windowMs, 500);
});

test("RateLimiterConfig type allows Redis config", () => {
  const config: RateLimiterConfig = {
    redis: {
      host: "localhost",
      port: 6379,
      keyPrefix: "ratelimit:",
    },
    maxCalls: 100,
    windowMs: 1000,
  };
  assert.ok(config.redis !== undefined);
  assert.equal(config.redis.host, "localhost");
});

test("RateLimitCheckResult type is exported and usable", () => {
  const result: RateLimitCheckResult = {
    allowed: true,
    remaining: 5,
  };
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 5);
});

test("RateLimitCheckResult type allows retryAfterMs", () => {
  const result: RateLimitCheckResult = {
    allowed: false,
    remaining: 0,
    retryAfterMs: 3000,
  };
  assert.equal(result.allowed, false);
  assert.equal(result.retryAfterMs, 3000);
});

test("RedisRateLimiter can be instantiated with full config", () => {
  const limiter = new RedisRateLimiter({
    host: "localhost",
    port: 6379,
    keyPrefix: "custom:",
    connectTimeout: 5000,
    maxRetriesPerRequest: 3,
    password: "secret",
    db: 1,
  });
  assert.ok(limiter instanceof RedisRateLimiter);
});

test("RedisRateLimiter uses default keyPrefix when not provided", () => {
  const limiter = new RedisRateLimiter({
    host: "localhost",
    port: 6379,
  });
  assert.ok(limiter instanceof RedisRateLimiter);
});

test("DistributedRateLimiter checkAndConsume returns RateLimitCheckResult", async () => {
  const limiter = new DistributedRateLimiter({
    maxCalls: 10,
    windowMs: 1000,
  });

  const result = await limiter.checkAndConsume("test-key");
  assert.equal(typeof result.allowed, "boolean");
  assert.equal(typeof result.remaining, "number");
});
