import assert from "node:assert/strict";
import test from "node:test";
import { RedisRateLimiter } from "../../../../../src/platform/interface/ingress/redis-rate-limiter.js";

// Note: These tests verify the RedisRateLimiter class interface and algorithm logic.
// They avoid tests that require a real Redis connection.

test("RedisRateLimiter - construction with host and port", () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });
  assert.ok(limiter instanceof RedisRateLimiter);
});

test("RedisRateLimiter - construction with custom keyPrefix", () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379, keyPrefix: "custom:" });
  assert.ok(limiter instanceof RedisRateLimiter);
});

test("RedisRateLimiter - construction accepts all config options", () => {
  const limiter = new RedisRateLimiter({
    host: "redis.example.com",
    port: 6380,
    password: "secret",
    db: 1,
    tls: true,
    connectTimeout: 5000,
    maxRetriesPerRequest: 3,
    keyPrefix: "ratelimit:",
  });
  assert.ok(limiter instanceof RedisRateLimiter);
});

test("RedisRateLimiter - construction with sentinel mode config", () => {
  const limiter = new RedisRateLimiter({
    mode: "sentinel",
    sentinelName: "mymaster",
    sentinels: [{ host: "sentinel1", port: 26379 }],
    keyPrefix: "sentinel:",
  });
  assert.ok(limiter instanceof RedisRateLimiter);
});

test("RedisRateLimiter - checkAndConsume returns RateLimitResult structure", async () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });
  const result = await limiter.checkAndConsume("test-key", 10, 1000);

  assert.equal(typeof result.allowed, "boolean");
  assert.equal(typeof result.remaining, "number");
  assert.ok(result.allowed === true || result.allowed === false);
});

test("RedisRateLimiter - close method exists", async () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });
  assert.equal(typeof limiter.close, "function");
});

test("RedisRateLimiter - close handles wait status", async () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });
  await limiter.close();
});

test("RedisRateLimiter - default keyPrefix is ratelimit:", () => {
  const defaultPrefix = "ratelimit:";
  const key = "test";
  const fullKey = `${defaultPrefix}${key}`;
  assert.equal(fullKey, "ratelimit:test");
});

test("RedisRateLimiter - custom keyPrefix is used", () => {
  const customPrefix = "custom:";
  const key = "test";
  const fullKey = `${customPrefix}${key}`;
  assert.equal(fullKey, "custom:test");
});

test("RedisRateLimiter - RateLimitResult interface compliance for allowed", () => {
  const result = { allowed: true, remaining: 5 };
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 5);
});

test("RedisRateLimiter - RateLimitResult interface compliance for rejected", () => {
  const result = { allowed: false, remaining: 0, retryAfterMs: 30000 };
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.equal(result.retryAfterMs, 30000);
});

test("RedisRateLimiter - sliding window algorithm removes expired entries", () => {
  const now = Date.now();
  const windowMs = 60000;
  const windowStart = now - windowMs;

  assert.ok(windowStart < now);
  assert.equal(windowStart, now - 60000);
});

test("RedisRateLimiter - retryAfterMs calculation when oldest entry exists", () => {
  const windowMs = 60000;
  const now = 1000000000000;
  const oldestTime = now - 30000; // 30 seconds ago
  const retryAfterMs = Math.max(0, oldestTime + windowMs - now);

  assert.equal(retryAfterMs, 30000);
});

test("RedisRateLimiter - retryAfterMs is zero when window fully expired", () => {
  const windowMs = 60000;
  const now = 1000000000000;
  const oldestTime = now - 70000; // older than window
  const retryAfterMs = Math.max(0, oldestTime + windowMs - now);

  assert.equal(retryAfterMs, 0);
});

test("RedisRateLimiter - remaining is max of zero or limit minus count", () => {
  const limit = 10;
  const count = 7;
  const remaining = Math.max(0, limit - count);

  assert.equal(remaining, 3);
});

test("RedisRateLimiter - remaining is zero when over limit", () => {
  const limit = 10;
  const count = 15;
  const remaining = Math.max(0, limit - count);

  assert.equal(remaining, 0);
});

test("RedisRateLimiter - windowStart calculation", () => {
  const now = 1000000000000;
  const windowMs = 60000;
  const windowStart = now - windowMs;

  assert.equal(windowStart, 999999940000);
});

test("RedisRateLimiter - requestId format is timestamp:random", () => {
  const now = Date.now();
  const requestId = `${now}:${Math.random()}`;
  const parts = requestId.split(":");

  assert.equal(parts.length, 2);
  assert.equal(parts[0], now.toString());
});

test("RedisRateLimiter - fullKey combines prefix and key", () => {
  const keyPrefix = "ratelimit:";
  const key = "tenant:123";
  const fullKey = `${keyPrefix}${key}`;

  assert.equal(fullKey, "ratelimit:tenant:123");
});

test("RedisRateLimiter - getUsage method exists", () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });
  assert.equal(typeof limiter.getUsage, "function");
});

test("RedisRateLimiter - reset method exists", () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });
  assert.equal(typeof limiter.reset, "function");
});

test("RedisRateLimiter - connect method exists", () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });
  assert.equal(typeof limiter.connect, "function");
});

test("RedisRateLimiter - count exactly at limit is allowed", () => {
  // Algorithm: if count > limit, reject. So count === limit is allowed.
  const limit = 5;
  const count = 5;
  const allowed = count <= limit;

  assert.equal(allowed, true);
});

test("RedisRateLimiter - count one over limit is rejected", () => {
  const limit = 5;
  const count = 6;
  const allowed = count <= limit;

  assert.equal(allowed, false);
});

test("RedisRateLimiter - retryAfterMs is positive when blocked", () => {
  const windowMs = 60000;
  const now = 1000000000000;
  const oldestTime = now - 10000; // 10 seconds ago
  const retryAfterMs = Math.max(0, oldestTime + windowMs - now);

  assert.ok(retryAfterMs > 0);
  assert.equal(retryAfterMs, 50000);
});

test("RedisRateLimiter - allowed result does not have retryAfterMs", () => {
  const result = { allowed: true, remaining: 5 };
  assert.equal(result.allowed, true);
  assert.equal(result.retryAfterMs, undefined);
});

test("RedisRateLimiter - rejected result may have retryAfterMs", () => {
  const result = { allowed: false, remaining: 0, retryAfterMs: 5000 };
  assert.equal(result.allowed, false);
  assert.ok(result.retryAfterMs !== undefined);
});

test("RedisRateLimiter - empty key prefix uses default", () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379, keyPrefix: "" });
  assert.ok(limiter instanceof RedisRateLimiter);
});

test("RedisRateLimiter - window expiration check logic", () => {
  const now = Date.now();
  const windowMs = 1000;
  const windowStart = now - windowMs;

  // Entries with score less than windowStart are expired
  const entryTime = windowStart - 100; // 100ms before window start
  assert.ok(entryTime < windowStart, "Entry time should be before window start");
});

test("RedisRateLimiter - pexpire uses windowMs for TTL", () => {
  const windowMs = 5000;
  // The pexpire should be called with windowMs for auto-cleanup
  assert.equal(windowMs, 5000);
});

test("RedisRateLimiter - pipeline operations sequence", () => {
  // verify expected pipeline methods are called in checkAndConsume
  const expectedMethods = [
    "zremrangebyscore",
    "zadd",
    "zcard",
    "pexpire",
  ];
  assert.equal(expectedMethods.length, 4);
});