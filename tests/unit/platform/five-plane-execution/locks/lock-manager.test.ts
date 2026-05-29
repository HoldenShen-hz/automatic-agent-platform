/**
 * Unit tests for distributed lock manager (SqliteLockAdapter).
 *
 * Tests:
 * 1. acquireLock returns lock handle when successful
 * 2. acquireLock returns null when lock held by another
 * 3. releaseLock releases the lock correctly
 * 4. Lock auto-expires after ttlMs
 * 5. Same owner can re-acquire released lock
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteLockAdapter } from "../../../../../src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.js";
import { DISTRIBUTED_LOCKS_DDL } from "../../../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-types.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createLockTestHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "lock-test.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(DISTRIBUTED_LOCKS_DDL);
  const adapter = new SqliteLockAdapter(db.connection);

  return {
    workspace,
    db,
    adapter,
    cleanup() {
      db.close();
      cleanupPath(workspace);
    },
  };
}

test("acquireLock returns lock handle when successful", () => {
  const h = createLockTestHarness("lock-acquire-success-");

  try {
    const result = h.adapter.acquire({ lockKey: "test-lock", owner: "worker-1" });

    assert.equal(result.acquired, true, "Lock should be acquired");
    assert.ok(result.lock, "Should have lock record");
    assert.equal(result.lock!.lockKey, "test-lock", "Lock key should match");
    assert.equal(result.lock!.owner, "worker-1", "Owner should match");
    assert.equal(result.lock!.status, "held", "Status should be held");
    assert.ok(result.lock!.fencingToken > 0, "Should have fencing token");
    assert.ok(result.lock!.acquiredAt, "Should have acquired timestamp");
    assert.ok(result.lock!.ttlMs > 0, "Should have TTL set");
  } finally {
    h.cleanup();
  }
});

test("acquireLock returns null when lock held by another", () => {
  const h = createLockTestHarness("lock-acquire-blocked-");

  try {
    // Worker 1 acquires the lock
    const result1 = h.adapter.acquire({ lockKey: "exclusive-lock", owner: "worker-1" });
    assert.equal(result1.acquired, true, "Worker 1 should acquire lock");
    assert.ok(result1.lock, "Worker 1 should have lock record");

    // Worker 2 tries to acquire the same lock
    const result2 = h.adapter.acquire({ lockKey: "exclusive-lock", owner: "worker-2" });

    assert.equal(result2.acquired, false, "Worker 2 should be blocked");
    assert.strictEqual(result2.lock, undefined, "Should not have lock record");
  } finally {
    h.cleanup();
  }
});

test("releaseLock releases the lock correctly", () => {
  const h = createLockTestHarness("lock-release-");

  try {
    // Acquire the lock
    const acquireResult = h.adapter.acquire({ lockKey: "release-test", owner: "worker-1" });
    assert.equal(acquireResult.acquired, true, "Lock should be acquired");

    // Release the lock
    const released = h.adapter.release("release-test", "worker-1");
    assert.equal(released, true, "releaseLock should return true for valid owner");

    // Verify lock is gone
    const inspected = h.adapter.inspect("release-test");
    assert.equal(inspected, null, "Lock should no longer exist after release");
  } finally {
    h.cleanup();
  }
});

test("releaseLock returns false when releasing lock owned by another", () => {
  const h = createLockTestHarness("lock-release-other-");

  try {
    // Worker 1 acquires the lock
    h.adapter.acquire({ lockKey: "exclusive-lock", owner: "worker-1" });

    // Worker 2 tries to release
    const released = h.adapter.release("exclusive-lock", "worker-2");
    assert.equal(released, false, "Should not release lock owned by another");

    // Lock should still exist
    const inspected = h.adapter.inspect("exclusive-lock");
    assert.ok(inspected, "Lock should still exist");
    assert.equal(inspected!.owner, "worker-1", "Lock should still be owned by worker-1");
  } finally {
    h.cleanup();
  }
});

test("Lock auto-expires after ttlMs", () => {
  const h = createLockTestHarness("lock-expire-");

  try {
    const result1 = h.adapter.acquire({ lockKey: "expiring-lock", owner: "worker-1", ttlMs: 1_000 });
    assert.equal(result1.acquired, true, "Lock should be acquired with valid TTL");
    h.db.connection.prepare(
      `UPDATE distributed_locks
       SET acquired_at = ?
       WHERE lock_key = ?`,
    ).run(new Date(Date.now() - 120_000).toISOString(), "expiring-lock");

    // Another worker should be able to acquire after expiration
    const result2 = h.adapter.acquire({ lockKey: "expiring-lock", owner: "worker-2" });
    assert.equal(result2.acquired, true, "Lock should be available after TTL expires");
    assert.equal(result2.lock!.owner, "worker-2", "New owner should be worker-2");
  } finally {
    h.cleanup();
  }
});

test("Same owner can re-acquire released lock", () => {
  const h = createLockTestHarness("lock-reacquire-");

  try {
    // First acquisition
    const result1 = h.adapter.acquire({ lockKey: "reentrant-lock", owner: "worker-1" });
    assert.equal(result1.acquired, true, "First acquire should succeed");
    const token1 = result1.lock!.fencingToken;

    // Release the lock
    const released = h.adapter.release("reentrant-lock", "worker-1");
    assert.equal(released, true, "Release should succeed");

    // Same owner re-acquires
    const result2 = h.adapter.acquire({ lockKey: "reentrant-lock", owner: "worker-1" });
    assert.equal(result2.acquired, true, "Re-acquire by same owner should succeed");
    assert.ok(result2.lock!.fencingToken > token1, "Should get new fencing token on re-acquire");
  } finally {
    h.cleanup();
  }
});

test("Same owner can re-acquire without releasing (extends lock)", () => {
  const h = createLockTestHarness("lock-extend-");

  try {
    // First acquisition
    const result1 = h.adapter.acquire({ lockKey: "extendable-lock", owner: "worker-1", ttlMs: 1000 });
    assert.equal(result1.acquired, true, "First acquire should succeed");
    const token1 = result1.lock!.fencingToken;

    // Same owner re-acquires without releasing (extends)
    const result2 = h.adapter.acquire({ lockKey: "extendable-lock", owner: "worker-1" });
    assert.equal(result2.acquired, true, "Re-acquire by same owner should succeed");
    // Extending refreshes the fencing token so downstream consumers can reject
    // stale holders even when the owner string is unchanged.
    assert.ok(result2.lock!.fencingToken > token1, "Same owner should get a newer token on extend");
  } finally {
    h.cleanup();
  }
});

test("Different owners can hold different locks simultaneously", () => {
  const h = createLockTestHarness("lock-multi-");

  try {
    const result1 = h.adapter.acquire({ lockKey: "resource-a", owner: "worker-1" });
    const result2 = h.adapter.acquire({ lockKey: "resource-b", owner: "worker-2" });

    assert.equal(result1.acquired, true, "Worker 1 should acquire lock A");
    assert.equal(result2.acquired, true, "Worker 2 should acquire lock B");

    const inspect1 = h.adapter.inspect("resource-a");
    const inspect2 = h.adapter.inspect("resource-b");

    assert.equal(inspect1!.owner, "worker-1", "Worker 1 should own lock A");
    assert.equal(inspect2!.owner, "worker-2", "Worker 2 should own lock B");
  } finally {
    h.cleanup();
  }
});

test("forceSteal allows taking over an existing lock", () => {
  const h = createLockTestHarness("lock-steal-");

  try {
    // Worker 1 acquires lock
    const result1 = h.adapter.acquire({ lockKey: "contested-lock", owner: "worker-1" });
    const token1 = result1.lock!.fencingToken;

    // Worker 2 steals the lock
    const stolen = h.adapter.forceSteal("contested-lock", "worker-2", "stale_owner_recovery");

    assert.equal(stolen.owner, "worker-2", "New owner should be worker-2");
    assert.ok(stolen.fencingToken > token1, "Stolen lock should have higher fencing token");
  } finally {
    h.cleanup();
  }
});

test("extend increases TTL for owned lock", () => {
  const h = createLockTestHarness("lock-extend-");

  try {
    // Acquire with short TTL
    h.adapter.acquire({ lockKey: "extend-test", owner: "worker-1", ttlMs: 1000 });

    // Extend
    const extended = h.adapter.extend("extend-test", "worker-1", 5000);

    assert.ok(extended, "Should return extended lock record");
    assert.ok(extended!.ttlMs > 1000, "TTL should be increased");
  } finally {
    h.cleanup();
  }
});

test("inspect returns null for non-existent lock", () => {
  const h = createLockTestHarness("lock-inspect-none-");

  try {
    const inspected = h.adapter.inspect("nonexistent-lock");
    assert.equal(inspected, null, "Should return null for non-existent lock");
  } finally {
    h.cleanup();
  }
});

test("backend kind is sqlite", () => {
  const h = createLockTestHarness("lock-backend-");

  try {
    assert.equal(h.adapter.backendKind, "sqlite", "Backend should be sqlite");
  } finally {
    h.cleanup();
  }
});
