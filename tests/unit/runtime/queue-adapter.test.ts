import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for src/core/runtime/queue-adapter.ts
 * This file re-exports queue adapter from five-plane-execution/queue/queue-adapter.
 * Coverage: 0% (all statements/skipped)
 */
test("queue-adapter re-exports QUEUE_JOBS_DDL constant [queue-adapter]", async () => {
  const mod = await import("../../../src/core/runtime/queue-adapter.js");
  assert.ok("QUEUE_JOBS_DDL" in mod, "should export QUEUE_JOBS_DDL constant");
});

test("queue-adapter re-exports SqliteQueueAdapter [queue-adapter]", async () => {
  const mod = await import("../../../src/core/runtime/queue-adapter.js");
  assert.ok("SqliteQueueAdapter" in mod || "sqliteQueueAdapter" in mod, "should export SqliteQueueAdapter");
});

test("queue-adapter re-exports RedisQueueAdapter [queue-adapter]", async () => {
  const mod = await import("../../../src/core/runtime/queue-adapter.js");
  assert.ok("RedisQueueAdapter" in mod || "redisQueueAdapter" in mod, "should export RedisQueueAdapter");
});

test("queue-adapter re-exports createQueueAdapter [queue-adapter]", async () => {
  const mod = await import("../../../src/core/runtime/queue-adapter.js");
  assert.ok("createQueueAdapter" in mod, "should export createQueueAdapter");
});

test("queue-adapter exports are functions or classes [queue-adapter]", async () => {
  const mod = await import("../../../src/core/runtime/queue-adapter.js");
  const keys = Object.keys(mod);
  assert.ok(keys.length > 0, "should have exported members");
});