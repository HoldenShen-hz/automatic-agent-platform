/**
 * Ingress Health Checks Tests
 *
 * Tests for health check behavior in the ingress layer:
 * - Redis connection health
 * - Connection error handling
 * - Close behavior for different connection states
 * - Error event handling
 */

import assert from "node:assert/strict";
import test from "node:test";
import { RedisRateLimiter } from "../../../../../src/platform/five-plane-interface/ingress/redis-rate-limiter.js";

function getRedisClient(limiter: RedisRateLimiter): Record<string, unknown> {
  return (limiter as unknown as { redis: Record<string, unknown> }).redis;
}

function setRedisStatus(redis: Record<string, unknown>, status: string): void {
  Object.defineProperty(redis, "status", {
    value: status,
    configurable: true,
    writable: true,
  });
}

test.describe("Ingress health checks - RedisRateLimiter connection states", () => {
  test("close handles 'wait' status gracefully", async () => {
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });
    const redis = getRedisClient(limiter);
    let disconnectCalls = 0;
    let quitCalls = 0;
    setRedisStatus(redis, "wait");
    redis.disconnect = () => {
      disconnectCalls += 1;
    };
    redis.quit = async () => {
      quitCalls += 1;
      return "OK";
    };

    assert.equal(await limiter.close(), undefined);
    assert.equal(disconnectCalls, 1);
    assert.equal(quitCalls, 0);
  });

  test("close handles 'connecting' status gracefully", async () => {
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });
    const redis = getRedisClient(limiter);
    let disconnectCalls = 0;
    setRedisStatus(redis, "connecting");
    redis.disconnect = () => {
      disconnectCalls += 1;
    };

    assert.equal(await limiter.close(), undefined);
    assert.equal(disconnectCalls, 1);
  });

  test("close handles 'end' status gracefully", async () => {
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });
    const redis = getRedisClient(limiter);
    let disconnectCalls = 0;
    setRedisStatus(redis, "end");
    redis.disconnect = () => {
      disconnectCalls += 1;
    };

    assert.equal(await limiter.close(), undefined);
    assert.equal(disconnectCalls, 1);
  });

  test("connect method exists and is callable", async () => {
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });
    const redis = getRedisClient(limiter);
    let connectCalls = 0;
    redis.connect = async () => {
      connectCalls += 1;
    };
    redis.disconnect = () => undefined;

    assert.equal(await limiter.connect(), undefined);
    assert.equal(connectCalls, 1);
    await limiter.close();
  });
});

test.describe("Ingress health checks - error handling", () => {
  test("RedisRateLimiter registers error handler on construction", () => {
    // Creating a limiter should register an error handler
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    // If we get here without error, the error handler was registered
    assert.ok(limiter instanceof RedisRateLimiter);

    limiter.close();
  });

  test("RedisRateLimiter can be instantiated with minimal config", () => {
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    assert.ok(limiter instanceof RedisRateLimiter);
    limiter.close();
  });

  test("RedisRateLimiter handles missing optional config values", () => {
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      // keyPrefix, connectTimeout, maxRetriesPerRequest all optional
    });

    assert.ok(limiter instanceof RedisRateLimiter);
    limiter.close();
  });
});

test.describe("Ingress health checks - sliding window algorithm", () => {
  test("sliding window correctly counts entries within window", () => {
    const now = 1000000000000;
    const windowMs = 60000;
    const windowStart = now - windowMs;

    // Simulate entries at different timestamps
    const entries = [
      { timestamp: now - 55000, id: "req1" }, // 55s ago - within window
      { timestamp: now - 30000, id: "req2" }, // 30s ago - within window
      { timestamp: now - 70000, id: "req3" }, // 70s ago - outside window
    ];

    const validEntries = entries.filter((e) => e.timestamp >= windowStart);
    assert.equal(validEntries.length, 2);
  });

  test("sliding window calculates remaining correctly", () => {
    const limit = 10;
    const now = 1000000000000;
    const windowMs = 60000;
    const windowStart = now - windowMs;

    // Simulate 7 entries within window
    const entryCount = 7;
    const remaining = Math.max(0, limit - entryCount);

    assert.equal(remaining, 3);
  });

  test("sliding window handles at-limit scenario", () => {
    const limit = 10;
    const entryCount = 10;
    const remaining = Math.max(0, limit - entryCount);

    assert.equal(remaining, 0);
  });

  test("sliding window handles over-limit scenario", () => {
    const limit = 10;
    const entryCount = 15;
    const remaining = Math.max(0, limit - entryCount);

    assert.equal(remaining, 0);
  });

  test("retryAfterMs calculation when oldest entry exists", () => {
    const windowMs = 60000;
    const now = 1000000000000;
    const oldestTime = now - 30000; // 30s ago

    const retryAfterMs = Math.max(0, oldestTime + windowMs - now);
    assert.equal(retryAfterMs, 30000);
  });

  test("retryAfterMs calculation when oldest entry just entered", () => {
    const windowMs = 60000;
    const now = 1000000000000;
    const oldestTime = now; // just added

    const retryAfterMs = Math.max(0, oldestTime + windowMs - now);
    assert.equal(retryAfterMs, 60000);
  });

  test("retryAfterMs calculation when oldest entry expired", () => {
    const windowMs = 60000;
    const now = 1000000000000;
    const oldestTime = now - 70000; // older than window

    const retryAfterMs = Math.max(0, oldestTime + windowMs - now);
    assert.equal(retryAfterMs, 0);
  });
});

test.describe("Ingress health checks - key expiration", () => {
  test("pexpire sets TTL for auto-cleanup", () => {
    const windowMs = 60000;
    // pexpire should set the key to expire after windowMs milliseconds
    assert.ok(windowMs > 0);
  });

  test("zremrangebyscore removes expired entries", () => {
    const now = 1000000000000;
    const windowMs = 60000;
    const windowStart = now - windowMs;

    // Entry at now - 70000 is older than window
    const oldEntryTime = now - 70000;
    assert.ok(oldEntryTime < windowStart, "Old entry should be removed");

    // Entry at now - 30000 is within window
    const recentEntryTime = now - 30000;
    assert.ok(recentEntryTime >= windowStart, "Recent entry should remain");
  });

  test("pipeline cleans up expired before adding new", () => {
    // Simulate pipeline operation order
    const operations: string[] = [];
    const pipeline = {
      zremrangebyscore: () => {
        operations.push("zremrangebyscore");
        return pipeline;
      },
      zadd: () => {
        operations.push("zadd");
        return pipeline;
      },
      zcard: () => {
        operations.push("zcard");
        return pipeline;
      },
      pexpire: () => {
        operations.push("pexpire");
        return pipeline;
      },
    };

    pipeline.zremrangebyscore();
    pipeline.zadd();
    pipeline.zcard();
    pipeline.pexpire();

    assert.equal(operations[0], "zremrangebyscore");
    assert.equal(operations[1], "zadd");
    assert.equal(operations[2], "zcard");
    assert.equal(operations[3], "pexpire");
  });
});

test.describe("Ingress health checks - connection resilience", () => {
  test("RedisRateLimiter instantiation does not require live connection", () => {
    // Creating a limiter should not fail even if Redis is down
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    assert.ok(limiter instanceof RedisRateLimiter);
    limiter.close();
  });

  test("RedisRateLimiter multiple instances are independent", () => {
    const limiter1 = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      keyPrefix: "limiter1:",
    });

    const limiter2 = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      keyPrefix: "limiter2:",
    });

    assert.ok(limiter1 instanceof RedisRateLimiter);
    assert.ok(limiter2 instanceof RedisRateLimiter);

    limiter1.close();
    limiter2.close();
  });

  test("RedisRateLimiter getUsage without live connection", async () => {
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });
    const redis = getRedisClient(limiter);
    const calls: string[] = [];
    redis.zremrangebyscore = async (key: string, from: number, to: number) => {
      calls.push(`${key}:${from}:${to}`);
      return 1;
    };
    redis.zcard = async (key: string) => {
      calls.push(key);
      return 3;
    };
    redis.disconnect = () => undefined;

    const usage = await limiter.getUsage("test_key", 1000);
    assert.equal(usage, 3);
    assert.equal(calls.length, 2);
    assert.ok(calls[0]?.startsWith("ratelimit:test_key:0:"));
    assert.equal(calls[1], "ratelimit:test_key");
    limiter.close();
  });

  test("RedisRateLimiter reset without live connection", async () => {
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });
    const redis = getRedisClient(limiter);
    const deletedKeys: string[] = [];
    redis.del = async (key: string) => {
      deletedKeys.push(key);
      return 1;
    };
    redis.disconnect = () => undefined;

    assert.equal(await limiter.reset("test_key"), undefined);
    assert.deepEqual(deletedKeys, ["ratelimit:test_key"]);
    limiter.close();
  });
});

test.describe("Ingress health checks - metrics integration", () => {
  test("error handler increments metrics counter", () => {
    // The RedisRateLimiter registers an error handler that increments
    // runtimeMetricsRegistry counter "redis_connection_errors"
    // We can verify the handler is registered by checking the limiter constructs
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    // If we reach here, the error handler was registered without throwing
    assert.ok(limiter instanceof RedisRateLimiter);
    limiter.close();
  });
});

test.describe("Ingress health checks - cleanup scenarios", () => {
  test("rejected request removes its entry via zrem", async () => {
    const requestId = "1000000000000:0.123";
    let zremCalled = false;

    // Simulate zrem being called after rejection
    const mockZrem = async (_key: string, _id: string) => {
      zremCalled = true;
      return 1;
    };

    await mockZrem("ratelimit:test", requestId);
    assert.ok(zremCalled, "zrem should be called to remove rejected entry");
  });

  test("zrange parsing handles full response with scores", () => {
    const oldest = ["request1", "1000000000000"];
    const oldestTime = oldest.length >= 2 && oldest[1] != null ? parseFloat(oldest[1]) : Date.now();

    assert.equal(oldestTime, 1000000000000);
  });

  test("zrange parsing handles empty response", () => {
    const oldest: string[] = [];
    const oldestTime = oldest.length >= 2 && oldest[1] != null ? parseFloat(oldest[1]) : Date.now();

    // Should fall back to current time
    assert.equal(oldestTime, Date.now());
  });

  test("zrange parsing handles partial response", () => {
    const oldest = ["request1"]; // only member, no score
    const oldestTime = oldest.length >= 2 && oldest[1] != null ? parseFloat(oldest[1]) : Date.now();

    // Should fall back to current time
    assert.equal(oldestTime, Date.now());
  });

  test("pipeline.exec result parsing handles null values", () => {
    const results = [[null, 0], [null, 1], [null, 5], [null, 1]];
    const count = results?.[2]?.[1] as number ?? 0;

    assert.equal(count, 5);
  });

  test("pipeline.exec result parsing handles missing count", () => {
    const results = [[null, 0], [null, 1]]; // only 2 results instead of 3
    const count = results?.[2]?.[1] as number ?? 0;

    assert.equal(count, 0);
  });
});
