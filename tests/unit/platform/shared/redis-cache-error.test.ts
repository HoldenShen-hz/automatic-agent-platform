import { EventEmitter } from "node:events";

import test from "node:test";
import assert from "node:assert/strict";

import { RedisCacheStore } from "../../../../src/platform/shared/cache/stores/redis-cache-store.js";
import { StructuredLogger } from "../../../../src/platform/shared/observability/structured-logger.js";
import type { StructuredLogEntry } from "../../../../src/platform/shared/observability/structured-logger.js";

test("[SYS-REL-2.1] Redis cache store logs error on connection failure", () => {
  const logEntries: StructuredLogEntry[] = [];
  const mockTransport = {
    name: "test-transport",
    write(entry: StructuredLogEntry) {
      logEntries.push(entry);
    },
  };

  StructuredLogger.addTransport(mockTransport);

  try {
    const store = new RedisCacheStore({
      host: "invalid-host",
      port: 9999,
    });

    const redis = (store as unknown as { redis: EventEmitter }).redis;
    redis.emit("error", new Error("ECONNREFUSED"));

    assert.ok(logEntries.some((e) => e.level === "error" && e.message === "redis.connection_error"), "Error must be logged with correct level and message");
    const errorEntry = logEntries.find((e) => e.message === "redis.connection_error");
    assert.ok(errorEntry?.data && String(errorEntry.data.err).includes("ECONNREFUSED"), "Error message must be preserved in data.err");
  } finally {
    StructuredLogger.removeTransport("test-transport");
  }
});

test("[SYS-REL-2.1] Redis cache store logs connection errors with error code", () => {
  const logEntries: StructuredLogEntry[] = [];
  const mockTransport = {
    name: "test-transport",
    write(entry: StructuredLogEntry) {
      logEntries.push(entry);
    },
  };

  StructuredLogger.addTransport(mockTransport);

  try {
    const store = new RedisCacheStore({
      host: "invalid-host",
      port: 9999,
    });

    const redis = (store as unknown as { redis: EventEmitter }).redis;
    redis.emit("error", new Error("ETIMEDOUT"));

    assert.ok(logEntries.some((e) => e.level === "error" && e.message === "redis.connection_error"), "Timeout error must be logged");
    const errorEntry = logEntries.find((e) => e.message === "redis.connection_error");
    assert.ok(errorEntry?.data && String(errorEntry.data.err).includes("ETIMEDOUT"), "Timeout message must be preserved in data.err");
  } finally {
    StructuredLogger.removeTransport("test-transport");
  }
});
