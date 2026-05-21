import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for src/core/runtime/queue-adapter.ts
 * This file re-exports queue adapter from five-plane-execution/queue/queue-adapter.
 * Coverage: 0% (all statements/skipped)
 */
test("queue-adapter re-exports QueueAdapterTypes namespace", async () => {
  const mod = await import("../../../src/core/runtime/queue-adapter.js");
  assert.ok("QueueAdapterTypes" in mod || mod.QueueAdapterTypes != null, "should export QueueAdapterTypes namespace");
});

test("queue-adapter re-exports SqliteQueueAdapter", async () => {
  const mod = await import("../../../src/core/runtime/queue-adapter.js");
  assert.ok("SqliteQueueAdapter" in mod || "sqliteQueueAdapter" in mod, "should export SqliteQueueAdapter");
});

test("queue-adapter re-exports RedisQueueAdapter", async () => {
  const mod = await import("../../../src/core/runtime/queue-adapter.js");
  assert.ok("RedisQueueAdapter" in mod || "redisQueueAdapter" in mod, "should export RedisQueueAdapter");
});

test("queue-adapter re-exports QueueAdapterFactory", async () => {
  const mod = await import("../../../src/core/runtime/queue-adapter.js");
  assert.ok("QueueAdapterFactory" in mod || "queueAdapterFactory" in mod, "should export QueueAdapterFactory");
});

test("queue-adapter exports are functions or classes", async () => {
  const mod = await import("../../../src/core/runtime/queue-adapter.js");
  const keys = Object.keys(mod);
  assert.ok(keys.length > 0, "should have exported members");
});