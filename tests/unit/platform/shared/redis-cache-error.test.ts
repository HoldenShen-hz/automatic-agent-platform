import { EventEmitter } from "node:events";

import test from "node:test";
import assert from "node:assert/strict";

import { RedisCacheStore } from "../../../../../src/platform/shared/cache/stores/redis-cache-store.js";

test("[SYS-REL-2.1] Redis cache store logs error on connection failure", () => {
  const logs: string[] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };

  try {
    const store = new RedisCacheStore({
      host: "invalid-host",
      port: 9999,
    });

    const redis = (store as unknown as { redis: EventEmitter }).redis;
    redis.emit("error", new Error("ECONNREFUSED"));

    assert.ok(logs.length > 0, "Error must be logged to console.error");
    assert.ok(logs[0]?.includes("ECONNREFUSED"), "Error message must be preserved");
  } finally {
    console.error = originalConsoleError;
  }
});

test("[SYS-REL-2.1] Redis cache store logs connection errors with error code", () => {
  const logs: string[] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };

  try {
    const store = new RedisCacheStore({
      host: "invalid-host",
      port: 9999,
    });

    const redis = (store as unknown as { redis: EventEmitter }).redis;
    redis.emit("error", new Error("ETIMEDOUT"));

    assert.ok(logs.length > 0, "Timeout error must be logged");
    assert.ok(logs[0]?.includes("ETIMEDOUT"), "Timeout message must be preserved");
  } finally {
    console.error = originalConsoleError;
  }
});
