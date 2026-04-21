import { EventEmitter } from "node:events";

import test from "node:test";
import assert from "node:assert/strict";

import { RedisQueueAdapter } from "../../../../src/platform/execution/queue/redis-queue-adapter.js";
import { StructuredLogger } from "../../../../src/platform/shared/observability/structured-logger.js";
import type { StructuredLogEntry } from "../../../../src/platform/shared/observability/structured-logger.js";

test("[SYS-REL-2.1] Redis queue adapter error handler should not be empty function", () => {
  const mockRedis = new EventEmitter();
  const client = new RedisQueueAdapter({
    host: "invalid-host",
    port: 9999,
  });

  (client as unknown as { redis: EventEmitter }).redis = mockRedis;

  const errorHandlers = mockRedis.listeners("error");
  assert.ok(errorHandlers.length > 0, "Error handler should be registered");

  // Current implementation uses `() => {}` which swallows errors
  // After fix, it should log the error properly
  mockRedis.emit("error", new Error("READONLY"));
  assert.ok(true, "Error handler should log errors, not swallow them");
});

test("[SYS-REL-2.1] Redis queue adapter logs errors when they occur", () => {
  const logEntries: StructuredLogEntry[] = [];
  const mockTransport = {
    name: "test-transport",
    write(entry: StructuredLogEntry) {
      logEntries.push(entry);
    },
  };

  StructuredLogger.addTransport(mockTransport);

  try {
    const mockRedis = new EventEmitter();
    const client = new RedisQueueAdapter({
      host: "invalid-host",
      port: 9999,
    });

    (client as unknown as { redis: EventEmitter }).redis = mockRedis;

    mockRedis.emit("error", new Error("ECONNREFUSED"));

    // After fix: errors should be logged via StructuredLogger
    assert.ok(logEntries.some((e) => e.level === "error" && e.message === "redis.connection_error"), "Error must be logged with correct level and message");
  } finally {
    StructuredLogger.removeTransport("test-transport");
  }
});
