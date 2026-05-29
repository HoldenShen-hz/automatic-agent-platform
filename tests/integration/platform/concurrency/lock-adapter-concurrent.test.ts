/**
 * Concurrency Tests: SqliteLockAdapter Race Conditions
 *
 * Tests concurrent access patterns in the SQLite distributed lock adapter.
 * Uses node:test and the concurrent-runner helper.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { SqliteLockAdapter } from "../../../../src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.js";
import { runConcurrentInvariant } from "../../../helpers/concurrent-runner.js";

function createLockDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE IF NOT EXISTS distributed_locks (
      lock_key TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      fencing_token INTEGER NOT NULL,
      status TEXT NOT NULL,
      acquired_at TEXT NOT NULL,
      ttl_ms INTEGER NOT NULL,
      metadata TEXT
    );
  `);
  return db;
}

// =============================================================================
// Concurrent Lock Acquisition Tests
// =============================================================================

test("concurrent acquire: only one owner can acquire same lock", async () => {
  const db = createLockDb();
  const adapter = new SqliteLockAdapter(db);

  // Try to acquire the same lock from 10 concurrent workers
  const result = await runConcurrentInvariant(
    async (workerId: number) => {
      return adapter.acquire({ lockKey: "unique-lock", owner: `worker-${workerId}`, ttlMs: 30000 });
    },
    { concurrency: 10 },
  );

  // Exactly one acquisition should succeed
  const successes = result.values.filter((r) => r.acquired === true);
  assert.equal(successes.length, 1, `Expected 1 successful acquire, got ${successes.length}`);
  assert.equal(result.errors.length, 0, "No errors should occur");

  db.close();
});

test("concurrent acquire: same owner can re-acquire (idempotent)", async () => {
  const db = createLockDb();
  const adapter = new SqliteLockAdapter(db);

  const owner = "idempotent-owner";

  // First acquire
  const first = adapter.acquire({ lockKey: "idempotent-lock", owner, ttlMs: 30000 });
  assert.equal(first.acquired, true, "First acquire should succeed");

  // Concurrent re-acquires by same owner
  const result = await runConcurrentInvariant(
    async (_workerId: number) => {
      return adapter.acquire({ lockKey: "idempotent-lock", owner, ttlMs: 30000 });
    },
    { concurrency: 5 },
  );

  // All re-acquires by same owner should succeed (idempotent)
  const successes = result.values.filter((r) => r.acquired === true);
  assert.equal(successes.length, 5, "Same owner should be able to re-acquire");

  db.close();
});

test("concurrent acquire: different owners racing for lock", async () => {
  const db = createLockDb();
  const adapter = new SqliteLockAdapter(db);

  // 10 different owners racing for the same lock
  const result = await runConcurrentInvariant(
    async (workerId: number) => {
      return adapter.acquire({ lockKey: "contested-lock", owner: `owner-${workerId}`, ttlMs: 30000 });
    },
    { concurrency: 10 },
  );

  // Only one should succeed
  const successes = result.values.filter((r) => r.acquired === true);
  assert.equal(successes.length, 1, "Only one owner should acquire the lock");

  // Final state: lock should be held by one of the workers
  const finalLock = adapter.inspect("contested-lock");
  assert.ok(finalLock !== null, "Lock should exist");
  assert.ok(finalLock!.owner.startsWith("owner-"), "Owner should be one of the workers");

  db.close();
});

// =============================================================================
// Concurrent Release Tests
// =============================================================================

test("concurrent release: only owner can release", async () => {
  const db = createLockDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "release-lock", owner: "owner-1", ttlMs: 30000 });

  // Run concurrent releases: one is the actual owner, others are not
  // worker-0 = owner-1 (correct), worker-1 to worker-4 = wrong owners
  const result = await runConcurrentInvariant(
    async (workerId: number) => {
      const owner = workerId === 0 ? "owner-1" : `worker-${workerId}`;
      return adapter.release("release-lock", owner);
    },
    { concurrency: 5 },
  );

  // Only the actual owner (worker-0) should successfully release
  const successes = result.values.filter((v) => v === true);
  assert.equal(successes.length, 1, "Only the owner should be able to release");

  // Lock should be released (deleted) since owner was able to release
  const lock = adapter.inspect("release-lock");
  assert.equal(lock, null, "Lock should be released");

  db.close();
});

test("concurrent release: same owner can release (once)", async () => {
  const db = createLockDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "same-owner-release", owner: "owner-1", ttlMs: 30000 });

  // Same owner trying to release multiple times
  const result = await runConcurrentInvariant(
    async (_workerId: number) => {
      return adapter.release("same-owner-release", "owner-1");
    },
    { concurrency: 5 },
  );

  // Only one release should succeed
  const successes = result.values.filter((v) => v === true);
  assert.equal(successes.length, 1, "Only one release should succeed");

  db.close();
});

// =============================================================================
// Concurrent Extend Tests
// =============================================================================

test("concurrent extend: only owner can extend", async () => {
  const db = createLockDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "extend-lock", owner: "owner-1", ttlMs: 30000 });

  // Run concurrent extends: one is the actual owner, others are not
  // worker-0 = owner-1 (correct), worker-1 to worker-4 = wrong owners
  const result = await runConcurrentInvariant(
    async (workerId: number) => {
      const owner = workerId === 0 ? "owner-1" : `worker-${workerId}`;
      return adapter.extend("extend-lock", owner, 60000);
    },
    { concurrency: 5 },
  );

  // Only the actual owner (worker-0) should successfully extend
  const successes = result.values.filter((v) => v !== null);
  assert.equal(successes.length, 1, "Only the owner should be able to extend");

  db.close();
});

test("concurrent extend: same owner extending multiple times", async () => {
  const db = createLockDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "multi-extend", owner: "owner-1", ttlMs: 30000 });

  const result = await runConcurrentInvariant(
    async (_workerId: number) => {
      return adapter.extend("multi-extend", "owner-1", 30000);
    },
    { concurrency: 5 },
  );

  // All extends by owner should succeed
  const successes = result.values.filter((v) => v !== null);
  assert.equal(successes.length, 5, "Owner should be able to extend multiple times");

  db.close();
});

// =============================================================================
// Concurrent ForceSteal Tests
// =============================================================================

test("concurrent forceSteal: all steal attempts complete", async () => {
  const db = createLockDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "steal-lock", owner: "initial-owner", ttlMs: 30000 });

  const result = await runConcurrentInvariant(
    async (workerId: number) => {
      return adapter.forceSteal("steal-lock", `stealer-${workerId}`, "operator_override");
    },
    { concurrency: 5 },
  );

  // All steals should complete without errors
  assert.equal(result.errors.length, 0, "No errors during concurrent steals");
  assert.equal(result.values.length, 5, "All 5 steal attempts should complete");

  db.close();
});

test("concurrent forceSteal: final state has exactly one owner", async () => {
  const db = createLockDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "final-owner-lock", owner: "initial-owner", ttlMs: 30000 });

  await runConcurrentInvariant(
    async (workerId: number) => {
      return adapter.forceSteal("final-owner-lock", `stealer-${workerId}`, "operator_override");
    },
    { concurrency: 10 },
  );

  // Final owner should be one of the stealers
  const finalLock = adapter.inspect("final-owner-lock");
  assert.ok(finalLock !== null, "Lock should exist");
  assert.ok(finalLock!.owner.startsWith("stealer-"), "Final owner should be one of the stealers");

  db.close();
});

// =============================================================================
// Mixed Concurrent Operations Tests
// =============================================================================

test("mixed concurrent operations: acquire, extend, release, steal", async () => {
  const db = createLockDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "mixed-ops", owner: "initial-owner", ttlMs: 30000 });

  // Perform mixed operations concurrently
  const acquireResult = adapter.acquire({ lockKey: "mixed-ops", owner: "new-owner", ttlMs: 30000 });
  assert.equal(acquireResult.acquired, false, "Cannot acquire held lock");

  const extendResult = adapter.extend("mixed-ops", "initial-owner", 60000);
  assert.ok(extendResult !== null, "Owner can extend");

  const stealResult = adapter.forceSteal("mixed-ops", "thief", "operator_override");
  assert.ok(stealResult !== null, "Can force steal");

  // Now new owner can extend
  const extendAfterSteal = adapter.extend("mixed-ops", "thief", 30000);
  assert.ok(extendAfterSteal !== null, "New owner can extend after steal");

  db.close();
});

test("concurrent inspect: always returns consistent state", async () => {
  const db = createLockDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "inspect-lock", owner: "owner-1", ttlMs: 30000 });

  // Multiple concurrent inspects
  const result = await runConcurrentInvariant(
    async (_workerId: number) => {
      return adapter.inspect("inspect-lock");
    },
    { concurrency: 20 },
  );

  // All inspects should succeed without errors
  assert.equal(result.errors.length, 0, "No errors during inspect");

  // All inspects should return the same consistent state
  const owners = result.values.map((v) => v?.owner);
  const uniqueOwners = new Set(owners);
  assert.equal(uniqueOwners.size, 1, "All inspects should return same owner");
  assert.ok(owners[0] === "owner-1", "Owner should be 'owner-1'");

  db.close();
});
