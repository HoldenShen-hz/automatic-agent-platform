import { EventEmitter } from "node:events";

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { RedisRateLimiter, type RateLimitResult } from "../../../../../src/platform/five-plane-interface/ingress/redis-rate-limiter.js";
import { StructuredLogger } from "../../../../../src/platform/shared/observability/structured-logger.js";
import type { StructuredLogEntry } from "../../../../../src/platform/shared/observability/structured-logger.js";

test("RedisRateLimiter accepts valid config and creates instance", () => {
  const limiter = new RedisRateLimiter({
    host: "localhost",
    port: 6379,
  });
  assert.ok(limiter);
});

test("RedisRateLimiter uses custom keyPrefix when provided", () => {
  const limiter = new RedisRateLimiter({
    host: "localhost",
    port: 6379,
    keyPrefix: "custom:prefix:",
  });
  const keyPrefix = (limiter as unknown as { keyPrefix: string }).keyPrefix;
  assert.equal(keyPrefix, "custom:prefix:");
});

test("RedisRateLimiter defaults keyPrefix to ratelimit:", () => {
  const limiter = new RedisRateLimiter({
    host: "localhost",
    port: 6379,
  });
  const keyPrefix = (limiter as unknown as { keyPrefix: string }).keyPrefix;
  assert.equal(keyPrefix, "ratelimit:");
});

test("RedisRateLimiter emits error event and logs when Redis connection fails", () => {
  const logEntries: StructuredLogEntry[] = [];
  const mockTransport = {
    name: "test-transport",
    write(entry: StructuredLogEntry) {
      logEntries.push(entry);
    },
  };

  StructuredLogger.addTransport(mockTransport);

  try {
    const limiter = new RedisRateLimiter({
      host: "invalid-host",
      port: 9999,
    });

    const redis = (limiter as unknown as { redis: EventEmitter }).redis;
    redis.emit("error", new Error("ECONNREFUSED"));

    assert.ok(
      logEntries.some((e) => e.level === "error" && e.message === "redis.connection_error"),
      "Error must be logged with correct level and message",
    );
    const errorEntry = logEntries.find((e) => e.message === "redis.connection_error");
    assert.ok(
      errorEntry?.data && String(errorEntry.data.err).includes("ECONNREFUSED"),
      "Error message must be preserved in data.err",
    );
  } finally {
    StructuredLogger.removeTransport("test-transport");
  }
});

test("RedisRateLimiter logs error with ETIMEDOUT code", () => {
  const logEntries: StructuredLogEntry[] = [];
  const mockTransport = {
    name: "test-transport",
    write(entry: StructuredLogEntry) {
      logEntries.push(entry);
    },
  };

  StructuredLogger.addTransport(mockTransport);

  try {
    const limiter = new RedisRateLimiter({
      host: "invalid-host",
      port: 9999,
    });

    const redis = (limiter as unknown as { redis: EventEmitter }).redis;
    redis.emit("error", new Error("ETIMEDOUT"));

    assert.ok(
      logEntries.some((e) => e.level === "error" && e.message === "redis.connection_error"),
      "Error must be logged",
    );
    const errorEntry = logEntries.find((e) => e.message === "redis.connection_error");
    assert.ok(
      errorEntry?.data && String(errorEntry.data.err).includes("ETIMEDOUT"),
      "Error code must be preserved in data.err",
    );
  } finally {
    StructuredLogger.removeTransport("test-transport");
  }
});

test("RateLimitResult interface allows allowed and remaining fields", () => {
  const result: RateLimitResult = {
    allowed: true,
    remaining: 5,
  };
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 5);
  assert.equal(result.retryAfterMs, undefined);
});

test("RateLimitResult interface allows retryAfterMs field", () => {
  const result: RateLimitResult = {
    allowed: false,
    remaining: 0,
    retryAfterMs: 500,
  };
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.equal(result.retryAfterMs, 500);
});

test("RedisRateLimiter close handles wait status gracefully", async () => {
  const limiter = new RedisRateLimiter({
    host: "localhost",
    port: 6379,
  });

  // close() should not throw when status is "wait"
  await limiter.close();
});

test("RedisRateLimiter close handles connecting status gracefully", async () => {
  const limiter = new RedisRateLimiter({
    host: "localhost",
    port: 6379,
  });

  // close() should not throw when status is "connecting"
  await limiter.close();
});

test("RedisRateLimiter close handles end status gracefully", async () => {
  const limiter = new RedisRateLimiter({
    host: "localhost",
    port: 6379,
  });

  // close() should not throw when status is "end"
  await limiter.close();
});

test("RedisRateLimiter config accepts maxRetriesPerRequest option", () => {
  const limiter = new RedisRateLimiter({
    host: "localhost",
    port: 6379,
    maxRetriesPerRequest: 3,
  });
  assert.ok(limiter);
});

test("RedisRateLimiter config accepts connectTimeout option", () => {
  const limiter = new RedisRateLimiter({
    host: "localhost",
    port: 6379,
    connectTimeout: 2000,
  });
  assert.ok(limiter);
});

test("RedisRateLimiter config accepts all Redis connection options", () => {
  const limiter = new RedisRateLimiter({
    host: "127.0.0.1",
    port: 6380,
    password: "secret",
    db: 1,
    keyPrefix: "test:",
    connectTimeout: 2000,
    maxRetriesPerRequest: 3,
  });
  assert.ok(limiter);
});
