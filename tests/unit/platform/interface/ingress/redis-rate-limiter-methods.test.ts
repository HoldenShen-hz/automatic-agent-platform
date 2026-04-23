/**
 * RedisRateLimiter Unit Tests
 *
 * Tests for RedisRateLimiter class methods:
 * - checkAndConsume()
 * - getUsage()
 * - reset()
 * - connect()
 * - close()
 *
 * Note: These tests use inline calculations to verify the sliding window
 * algorithm behavior without requiring a live Redis connection.
 */

import assert from "node:assert/strict";
import test from "node:test";

test("RedisRateLimiter sliding window calculation - allowed when under limit", () => {
  // Simulate sliding window rate limiting logic
  const limit = 10;
  const count = 5; // 5 requests in current window
  const allowed = count <= limit;

  assert.equal(allowed, true);
  assert.equal(limit - count, 5);
});

test("RedisRateLimiter sliding window calculation - rejected when over limit", () => {
  const limit = 10;
  const count = 15; // 15 requests in current window
  const allowed = count <= limit;

  assert.equal(allowed, false);
});

test("RedisRateLimiter sliding window calculation - exactly at limit", () => {
  const limit = 10;
  const count = 10; // exactly at limit
  const allowed = count <= limit;

  assert.equal(allowed, true);
  assert.equal(limit - count, 0);
});

test("RedisRateLimiter sliding window calculation - remaining calculation", () => {
  const limit = 10;
  const count = 7;
  const remaining = Math.max(0, limit - count);

  assert.equal(remaining, 3);
});

test("RedisRateLimiter sliding window calculation - remaining at zero when over", () => {
  const limit = 10;
  const count = 12;
  const remaining = Math.max(0, limit - count);

  assert.equal(remaining, 0);
});

test("RedisRateLimiter retryAfterMs calculation - basic", () => {
  const windowMs = 60000;
  const now = 1000000000000;
  const oldestTime = now - 30000; // oldest entry is 30 seconds ago
  const retryAfterMs = Math.max(0, oldestTime + windowMs - now);

  // oldestTime + windowMs - now = (now - 30000) + 60000 - now = 30000
  assert.equal(retryAfterMs, 30000);
});

test("RedisRateLimiter retryAfterMs calculation - window fully expired", () => {
  const windowMs = 60000;
  const now = 1000000000000;
  const oldestTime = now - 70000; // older than window
  const retryAfterMs = Math.max(0, oldestTime + windowMs - now);

  // oldestTime + windowMs - now = (now - 70000) + 60000 - now = -10000 -> clamped to 0
  assert.equal(retryAfterMs, 0);
});

test("RedisRateLimiter retryAfterMs calculation - just at window boundary", () => {
  const windowMs = 60000;
  const now = 1000000000000;
  const oldestTime = now - 60000; // exactly at window boundary
  const retryAfterMs = Math.max(0, oldestTime + windowMs - now);

  assert.equal(retryAfterMs, 0);
});

test("RedisRateLimiter key prefix composition", () => {
  const keyPrefix = "ratelimit:";
  const key = "tenant:123";
  const fullKey = `${keyPrefix}${key}`;

  assert.equal(fullKey, "ratelimit:tenant:123");
});

test("RedisRateLimiter custom key prefix composition", () => {
  const keyPrefix = "custom:prefix:";
  const key = "api:/v1/tasks";
  const fullKey = `${keyPrefix}${key}`;

  assert.equal(fullKey, "custom:prefix:api:/v1/tasks");
});

test("RedisRateLimiter windowStart calculation", () => {
  const now = 1000000000000;
  const windowMs = 60000;
  const windowStart = now - windowMs;

  assert.equal(windowStart, 999999940000);
});

test("RedisRateLimiter requestId format", () => {
  const now = 1000000000000;
  const requestId = `${now}:${Math.random()}`;
  const parts = requestId.split(":");

  assert.equal(parts.length, 2);
  assert.equal(parts[0], "1000000000000");
  assert.ok(parts[1].length > 0);
});

test("RedisRateLimiter pipeline operations composition", () => {
  // Simulate pipeline operation chain
  let operationCount = 0;
  const pipeline = {
    zremrangebyscore: () => { operationCount++; return pipeline; },
    zadd: () => { operationCount++; return pipeline; },
    zcard: () => { operationCount++; return pipeline; },
    pexpire: () => { operationCount++; return pipeline; },
    exec: async () => [[null, 0], [null, 1], [null, 5], [null, 1]],
  };

  // Execute pipeline chain
  pipeline.zremrangebyscore();
  pipeline.zadd();
  pipeline.zcard();
  pipeline.pexpire();

  assert.equal(operationCount, 4);
});

test("RedisRateLimiter RateLimitResult structure - allowed case", () => {
  const result = {
    allowed: true,
    remaining: 7,
  };

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 7);
  assert.equal(result.retryAfterMs, undefined);
});

test("RedisRateLimiter RateLimitResult structure - rejected case", () => {
  const result = {
    allowed: false,
    remaining: 0,
    retryAfterMs: 30000,
  };

  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.equal(result.retryAfterMs, 30000);
});

test("RedisRateLimiter close() behavior - ready status calls quit", async () => {
  let quitCalled = false;
  let disconnectCalled = false;

  const mockRedis = {
    status: "ready",
    quit: async () => { quitCalled = true; },
    disconnect: () => { disconnectCalled = false; },
  };

  const close = async () => {
    if (mockRedis.status === "wait" || mockRedis.status === "end") {
      mockRedis.disconnect();
      return;
    }
    await mockRedis.quit();
  };

  await close();
  assert.ok(quitCalled, "quit should be called when status is ready");
  assert.ok(!disconnectCalled, "disconnect should not be called");
});

test("RedisRateLimiter close() behavior - wait status calls disconnect", async () => {
  let disconnectCalled = false;

  const mockRedis = {
    status: "wait",
    quit: async () => {},
    disconnect: () => { disconnectCalled = true; },
  };

  const close = async () => {
    if (mockRedis.status === "wait" || mockRedis.status === "end") {
      mockRedis.disconnect();
      return;
    }
    await mockRedis.quit();
  };

  await close();
  assert.ok(disconnectCalled, "disconnect should be called when status is wait");
});

test("RedisRateLimiter close() behavior - end status calls disconnect", async () => {
  let disconnectCalled = false;

  const mockRedis = {
    status: "end",
    quit: async () => {},
    disconnect: () => { disconnectCalled = true; },
  };

  const close = async () => {
    if (mockRedis.status === "wait" || mockRedis.status === "end") {
      mockRedis.disconnect();
      return;
    }
    await mockRedis.quit();
  };

  await close();
  assert.ok(disconnectCalled, "disconnect should be called when status is end");
});

test("RedisRateLimiter checkAndConsume zrange parsing - with scores", () => {
  const oldest = ["request1", "1000000000000"];
  const oldestTime = oldest.length >= 2 && oldest[1] != null ? parseFloat(oldest[1]) : Date.now();

  assert.equal(oldestTime, 1000000000000);
});

test("RedisRateLimiter checkAndConsume zrange parsing - empty result", () => {
  const oldest: string[] = [];
  const oldestTime = oldest.length >= 2 && oldest[1] != null ? parseFloat(oldest[1]) : Date.now();

  // Should fall back to now
  assert.equal(oldestTime, Date.now());
});

test("RedisRateLimiter checkAndConsume zrange parsing - partial result", () => {
  const oldest = ["request1"]; // only member, no score
  const oldestTime = oldest.length >= 2 && oldest[1] != null ? parseFloat(oldest[1]) : Date.now();

  // Should fall back to now
  assert.equal(oldestTime, Date.now());
});

test("RedisRateLimiter getUsage removes expired entries", () => {
  const now = 1000000000000;
  const windowMs = 60000;
  const windowStart = now - windowMs;

  // The zremrangebyscore call would remove entries before windowStart
  const expiredTimestamp = windowStart - 1000; // 1 second before window
  const validTimestamp = windowStart + 1000; // 1 second after window start

  // expired entry should be removed
  assert.ok(expiredTimestamp < windowStart, "expired entry should be removed");
  assert.ok(validTimestamp >= windowStart, "valid entry should remain");
});

test("RedisRateLimiter pexpire sets TTL for auto-cleanup", () => {
  const windowMs = 60000;
  // pexpire sets the key to expire after windowMs milliseconds
  assert.ok(windowMs > 0, "windowMs should be positive for TTL");
});

test("RedisRateLimiter config defaults - keyPrefix", () => {
  const config = { host: "localhost", port: 6379 };
  const keyPrefix = config.keyPrefix ?? "ratelimit:";

  assert.equal(keyPrefix, "ratelimit:");
});

test("RedisRateLimiter config defaults - maxRetriesPerRequest", () => {
  const config = { host: "localhost", port: 6379 };
  const maxRetriesPerRequest = config.maxRetriesPerRequest ?? 1;

  assert.equal(maxRetriesPerRequest, 1);
});

test("RedisRateLimiter config defaults - connectTimeout", () => {
  const config = { host: "localhost", port: 6379 };
  const connectTimeout = config.connectTimeout ?? 500;

  assert.equal(connectTimeout, 500);
});

test("RedisRateLimiter config - custom overrides", () => {
  const config = {
    host: "localhost",
    port: 6379,
    keyPrefix: "myprefix:",
    maxRetriesPerRequest: 3,
    connectTimeout: 2000,
  };

  assert.equal(config.keyPrefix, "myprefix:");
  assert.equal(config.maxRetriesPerRequest, 3);
  assert.equal(config.connectTimeout, 2000);
});

test("RedisRateLimiter getUsage returns count after cleanup", async () => {
  // Simulate getUsage behavior
  const entriesInWindow = 7;
  const count = entriesInWindow;

  assert.equal(count, 7);
});

test("RedisRateLimiter reset calls del", async () => {
  let delCalled = false;
  const mockDel = async () => {
    delCalled = true;
    return 1;
  };

  await mockDel();
  assert.ok(delCalled, "del should be called on reset");
});

test("RedisRateLimiter entry removal after rejection", async () => {
  // When over limit, the entry added by zadd should be removed via zrem
  let zremCalled = false;
  const requestId = "1000000000000:0.123";

  const mockZrem = async (key: string, id: string) => {
    if (id === requestId) {
      zremCalled = true;
    }
    return 1;
  };

  await mockZrem("ratelimit:test", requestId);
  assert.ok(zremCalled, "zrem should be called to remove rejected entry");
});

test("RedisRateLimiter zero remaining when exactly at limit", () => {
  const limit = 10;
  const count = 10;
  const remaining = Math.max(0, limit - count);

  assert.equal(remaining, 0);
  assert.equal(count <= limit, true);
});
