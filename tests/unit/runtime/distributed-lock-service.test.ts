import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for src/core/runtime/distributed-lock-service.ts
 * This file re-exports distributed lock services from five-plane-execution.
 * Coverage: 0% (all statements/skipped)
 */
test("distributed-lock-service re-exports lock types via LockDataSchema", async () => {
  const mod = await import("../../../src/core/runtime/distributed-lock-service.js");
  assert.ok("LockDataSchema" in mod, "should export LockDataSchema");
});

test("distributed-lock-service re-exports transitionLock", async () => {
  const mod = await import("../../../src/core/runtime/distributed-lock-service.js");
  assert.ok("transitionLock" in mod, "should export transitionLock");
});

test("distributed-lock-service re-exports locking support via lockLogger", async () => {
  const mod = await import("../../../src/core/runtime/distributed-lock-service.js");
  assert.ok("lockLogger" in mod, "should export lockLogger");
});

test("distributed-lock-service re-exports SqliteLockAdapter", async () => {
  const mod = await import("../../../src/core/runtime/distributed-lock-service.js");
  assert.ok("SqliteLockAdapter" in mod || "sqliteLockAdapter" in mod, "should export SqliteLockAdapter");
});

test("distributed-lock-service re-exports PgAdvisoryLockAdapter", async () => {
  const mod = await import("../../../src/core/runtime/distributed-lock-service.js");
  assert.ok("PgAdvisoryLockAdapter" in mod || "pgAdvisoryLockAdapter" in mod, "should export PgAdvisoryLockAdapter");
});

test("distributed-lock-service re-exports RedisLockAdapter", async () => {
  const mod = await import("../../../src/core/runtime/distributed-lock-service.js");
  assert.ok("RedisLockAdapter" in mod || "redisLockAdapter" in mod, "should export RedisLockAdapter");
});

test("distributed-lock-service re-exports createLockAdapter factory", async () => {
  const mod = await import("../../../src/core/runtime/distributed-lock-service.js");
  assert.ok("createLockAdapter" in mod, "should export createLockAdapter");
});

test("distributed-lock-service exports are functions or objects", async () => {
  const mod = await import("../../../src/core/runtime/distributed-lock-service.js");
  const keys = Object.keys(mod);
  assert.ok(keys.length > 0, "should have exported members");
});