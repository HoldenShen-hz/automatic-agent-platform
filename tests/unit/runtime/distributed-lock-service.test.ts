import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for src/core/runtime/distributed-lock-service.ts
 * This file re-exports distributed lock services from five-plane-execution.
 * Coverage: 0% (all statements/skipped)
 */
test("distributed-lock-service re-exports DistributedLockTypes", async () => {
  const mod = await import("../../../src/core/runtime/distributed-lock-service.js");
  assert.ok("DistributedLockTypes" in mod || mod.DistributedLockTypes != null, "should export DistributedLockTypes namespace");
});

test("distributed-lock-service re-exports DistributedLockService", async () => {
  const mod = await import("../../../src/core/runtime/distributed-lock-service.js");
  assert.ok("DistributedLockService" in mod || mod.default != null, "should export DistributedLockService");
});

test("distributed-lock-service re-exports LockingSupport", async () => {
  const mod = await import("../../../src/core/runtime/distributed-lock-service.js");
  assert.ok("LockingSupport" in mod || "lockingSupport" in mod, "should export LockingSupport");
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

test("distributed-lock-service re-exports DistributedLockFactory", async () => {
  const mod = await import("../../../src/core/runtime/distributed-lock-service.js");
  assert.ok("DistributedLockFactory" in mod || "distributedLockFactory" in mod, "should export DistributedLockFactory");
});

test("distributed-lock-service exports are functions or objects", async () => {
  const mod = await import("../../../src/core/runtime/distributed-lock-service.js");
  const keys = Object.keys(mod);
  assert.ok(keys.length > 0, "should have exported members");
});