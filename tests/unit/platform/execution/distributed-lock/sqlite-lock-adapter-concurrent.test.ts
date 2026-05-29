/**
 * [SYS-REL-2.2] SqliteLockAdapter Concurrency Tests
 *
 * Tests for concurrent extend and forceSteal operations
 * to verify that the SQLite lock adapter correctly handles race conditions.
 *
 * Bug: extend() and forceSteal() use non-atomic read-modify-write patterns.
 * Concurrent operations can result in unexpected behavior without proper locking.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteLockAdapter } from "../../../../../src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.js";
import { DatabaseSync } from "node:sqlite";
import { runConcurrentInvariant } from "../../../../helpers/concurrent-runner.js";

// =============================================================================
// Test database setup
// =============================================================================

function createTestDb(): DatabaseSync {
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
// Concurrent extend tests
// =============================================================================

test("[SYS-REL-2.2] concurrent extend on same lock - only owner can extend [sqlite-lock-adapter-concurrent]", async () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire initial lock
  adapter.acquire({ lockKey: "extend-lock", owner: "owner-1", ttlMs: 30000 });

  // Try to extend with same owner
  const result1 = adapter.extend("extend-lock", "owner-1", 60000);
  assert.ok(result1 !== null, "Same owner should be able to extend");

  // Try to extend with different owner
  const result2 = adapter.extend("extend-lock", "owner-2", 60000);
  assert.equal(result2, null, "Different owner should not be able to extend");

  db.close();
});

test("[SYS-REL-2.2] concurrent extend by multiple owners - only one succeeds [sqlite-lock-adapter-concurrent]", async () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire initial lock
  adapter.acquire({ lockKey: "multi-extend-lock", owner: "owner-1", ttlMs: 30000 });

  // Simulate concurrent extend attempts by different owners
  const owners = ["owner-1", "owner-2", "owner-3"];
  const results = await Promise.allSettled(
    owners.map((owner) => Promise.resolve(adapter.extend("multi-extend-lock", owner, 60000))),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled" && r.value !== null);
  const failed = results.filter((r) => r.status === "fulfilled" && r.value === null);

  // Only the actual owner should succeed
  assert.equal(succeeded.length, 1, "Only one extend should succeed");
  assert.equal(failed.length, 2, "Other extends should fail");
});

test("[SYS-REL-2.2] concurrent extend using runConcurrentInvariant [sqlite-lock-adapter-concurrent]", async () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire initial lock
  adapter.acquire({ lockKey: "invariant-extend-lock", owner: "owner-1", ttlMs: 30000 });

  const result = await runConcurrentInvariant(
    async (workerId: number) => {
      return adapter.extend("invariant-extend-lock", `worker-${workerId}`, 30000);
    },
    { concurrency: 5 },
  );

  const succeeded = result.values.filter((v) => v !== null);

  // CRITICAL: Only the actual owner (worker-0 if same owner) should succeed
  // Others should get null
  assert.ok(succeeded.length <= 1, `Expected at most 1 successful extend, got ${succeeded.length}`);
  assert.equal(result.errors.length, 0, "No errors should occur");

  db.close();
});

test("[SYS-REL-2.2] extend returns null for non-existent lock [sqlite-lock-adapter-concurrent]", async () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result = adapter.extend("non-existent", "any-owner", 30000);
  assert.equal(result, null, "Extend should return null for non-existent lock");

  db.close();
});

test("[SYS-REL-2.2] extend increments fencing token [sqlite-lock-adapter-concurrent]", async () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire and get initial fencing token
  const initial = adapter.acquire({ lockKey: "fencing-lock", owner: "owner-1", ttlMs: 30000 });
  const initialToken = initial.lock!.fencingToken;

  // Extend
  const extended = adapter.extend("fencing-lock", "owner-1", 30000);
  assert.ok(extended !== null, "Extend should succeed");

  // Inspect to verify new fencing token
  const inspected = adapter.inspect("fencing-lock");
  assert.ok(inspected !== null, "Inspect should return lock");
  assert.ok(inspected!.fencingToken > initialToken, "Fencing token should increment");

  db.close();
});

// =============================================================================
// Concurrent forceSteal tests
// =============================================================================

test("[SYS-REL-2.2] concurrent forceSteal on same lock - all steal attempts complete [sqlite-lock-adapter-concurrent]", async () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire initial lock
  adapter.acquire({ lockKey: "steal-lock", owner: "owner-1", ttlMs: 30000 });

  // Multiple concurrent steal attempts
  const thieves = ["thief-1", "thief-2", "thief-3"];
  const results = await Promise.allSettled(
    thieves.map((thief) => Promise.resolve(adapter.forceSteal("steal-lock", thief, "operator_override"))),
  );

  // All steals should complete (no throws)
  const succeeded = results.filter((r) => r.status === "fulfilled");
  assert.equal(succeeded.length, thieves.length, "All steal attempts should complete");

  // Verify final state - exactly one owner
  const finalLock = adapter.inspect("steal-lock");
  assert.ok(finalLock !== null, "Lock should still exist");
  assert.ok(thieves.includes(finalLock!.owner), `Final owner should be one of the thieves, got: ${finalLock!.owner}`);

  db.close();
});

test("[SYS-REL-2.2] concurrent forceSteal - final state has exactly one owner [sqlite-lock-adapter-concurrent]", async () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "contested-steal", owner: "initial-owner", ttlMs: 30000 });

  const concurrency = 5;
  const attackers = Array.from({ length: concurrency }, (_, i) => `attacker-${i}`);

  // Launch all steals concurrently
  await Promise.allSettled(
    attackers.map((attacker) => Promise.resolve(adapter.forceSteal("contested-steal", attacker, "operator_override"))),
  );

  // Verify invariant: exactly one owner
  const finalLock = adapter.inspect("contested-steal");
  assert.ok(finalLock !== null, "Lock should exist after concurrent steals");
  assert.ok(attackers.includes(finalLock!.owner), `Final owner should be one of the ${concurrency} attackers`);

  db.close();
});

test("[SYS-REL-2.2] concurrent forceSteal - fencing token is monotonically increasing [sqlite-lock-adapter-concurrent]", async () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "fencing-steal", owner: "initial-owner", ttlMs: 30000 });

  const initialFencing = adapter.inspect("fencing-steal")!.fencingToken;

  // Perform multiple concurrent steals
  await Promise.allSettled([
    adapter.forceSteal("fencing-steal", "stealer-1", "operator_override"),
    adapter.forceSteal("fencing-steal", "stealer-2", "operator_override"),
    adapter.forceSteal("fencing-steal", "stealer-3", "operator_override"),
  ]);

  const finalFencing = adapter.inspect("fencing-steal")!.fencingToken;

  // Fencing token should have increased from initial value
  assert.ok(finalFencing > initialFencing, `Fencing token should increase, was ${initialFencing}, now ${finalFencing}`);

  db.close();
});

test("[SYS-REL-2.2] concurrent forceSteal using runConcurrentInvariant [sqlite-lock-adapter-concurrent]", async () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "invariant-steal-lock", owner: "initial-owner", ttlMs: 30000 });

  const result = await runConcurrentInvariant(
    async (workerId: number) => {
      return adapter.forceSteal("invariant-steal-lock", `worker-${workerId}`, "operator_override");
    },
    { concurrency: 5 },
  );

  // All workers should complete without errors
  assert.equal(result.errors.length, 0, "No errors should occur during concurrent steals");
  assert.equal(result.values.length, 5, "All 5 workers should complete");

  // But only ONE owner should end up with the lock
  const finalLock = adapter.inspect("invariant-steal-lock");
  assert.ok(finalLock !== null, "Lock should exist");
  assert.ok(
    Array.from({ length: 5 }, (_, i) => `worker-${i}`).includes(finalLock!.owner),
    `Final owner should be one of the workers`,
  );

  db.close();
});

test("[SYS-REL-2.2] forceSteal can steal from any owner regardless of ownership [sqlite-lock-adapter-concurrent]", async () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Owner 1 acquires
  adapter.acquire({ lockKey: "stealable-lock", owner: "owner-1", ttlMs: 30000 });

  // Owner 2 steals
  const stealResult = adapter.forceSteal("stealable-lock", "owner-2", "operator_override");
  assert.ok(stealResult !== null, "Force steal should succeed");
  assert.equal(stealResult.owner, "owner-2", "New owner should be owner-2");

  // Verify inspect shows new owner
  const inspected = adapter.inspect("stealable-lock");
  assert.equal(inspected!.owner, "owner-2", "Inspect should show owner-2");

  db.close();
});

test("[SYS-REL-2.2] concurrent steals followed by inspect shows consistent state [sqlite-lock-adapter-concurrent]", async () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "consistent-state-lock", owner: "initial-owner", ttlMs: 30000 });

  // Do concurrent steals
  await Promise.allSettled([
    adapter.forceSteal("consistent-state-lock", "stealer-A", "operator_override"),
    adapter.forceSteal("consistent-state-lock", "stealer-B", "operator_override"),
    adapter.forceSteal("consistent-state-lock", "stealer-C", "operator_override"),
  ]);

  // Immediately inspect
  const inspected = adapter.inspect("consistent-state-lock");
  assert.ok(inspected !== null, "Lock should be inspectable after steals");
  assert.ok(["stealer-A", "stealer-B", "stealer-C"].includes(inspected!.owner), "Owner should be one of the stealers");

  db.close();
});

test("[SYS-REL-2.2] forceSteal on non-existent lock creates new lock [sqlite-lock-adapter-concurrent]", async () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Force steal on non-existent lock should create it
  const result = adapter.forceSteal("new-lock", "new-owner", "operator_override");
  assert.ok(result !== null, "Force steal should succeed on non-existent lock");
  assert.equal(result.owner, "new-owner", "Owner should be new-owner");
  assert.equal(result.status, "held", "Status should be held");

  // Verify it exists
  const inspected = adapter.inspect("new-lock");
  assert.ok(inspected !== null, "Lock should exist");
  assert.equal(inspected!.owner, "new-owner", "Owner should be new-owner");

  db.close();
});
