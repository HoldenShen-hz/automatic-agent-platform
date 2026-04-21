import { EventEmitter } from "node:events";

import test from "node:test";
import assert from "node:assert/strict";

import { RedisRateLimiter } from "../../../../src/platform/interface/ingress/redis-rate-limiter.js";

test("[SYS-REL-2.1] Redis rate limiter logs error on connection failure", () => {
  const logs: string[] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };

  try {
    const limiter = new RedisRateLimiter({
      host: "invalid-host",
      port: 9999,
    });

    const redis = (limiter as unknown as { redis: EventEmitter }).redis;
    redis.emit("error", new Error("ECONNREFUSED"));

    assert.ok(logs.length > 0, "Error must be logged to console.error");
    assert.ok(logs[0]?.includes("ECONNREFUSED"), "Error message must be preserved");
  } finally {
    console.error = originalConsoleError;
  }
});

test("[SYS-REL-2.1] Redis rate limiter error handler logs with error code", () => {
  const logs: string[] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };

  try {
    const limiter = new RedisRateLimiter({
      host: "invalid-host",
      port: 9999,
    });

    const redis = (limiter as unknown as { redis: EventEmitter }).redis;
    redis.emit("error", new Error("ETIMEDOUT"));

    assert.ok(logs.length > 0, "Error must be logged");
    assert.ok(logs[0]?.includes("redis.connection_error"), "Error code must be in log message");
  } finally {
    console.error = originalConsoleError;
  }
});
