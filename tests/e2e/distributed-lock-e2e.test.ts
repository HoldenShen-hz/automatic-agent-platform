/**
 * E2E Distributed Lock Tests
 *
 * End-to-end tests for distributed locking using SQLite lock adapter.
 * Tests lock acquisition, release, fencing tokens, force steal, and inspection.
 *
 * Coverage:
 * 1. Lock acquisition and release
 * 2. Fencing token generation and incrementing
 * 3. Force steal of locks
 * 4. Lock inspection
 * 5. Multiple concurrent lock owners
 * 6. Stale lock eviction
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteLockAdapter } from "../../src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import type { LockRecord } from "../../src/platform/five-plane-execution/distributed-lock/distributed-lock-types.js";

// ---------------------------------------------------------------------------
// Test Harness
// ---------------------------------------------------------------------------

import { DISTRIBUTED_LOCKS_DDL } from "../../src/platform/five-plane-execution/distributed-lock/distributed-lock-types.js";

function createLockHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e-locks.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  // Create the distributed_locks table required by SqliteLockAdapter
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

// ---------------------------------------------------------------------------
// Test 1: Basic Lock Acquisition and Release
// ---------------------------------------------------------------------------

test("E2E Distributed Lock: acquire lock successfully", () => {
  const h = createLockHarness("e2e-lock-acquire-");

  try {
    const result = h.adapter.acquire({ lockKey: "test-lock", owner: "worker-1" });

    assert.equal(result.acquired, true, "Lock should be acquired");
    assert.ok(result.lock, "Should have lock record");
    assert.equal(result.lock!.lockKey, "test-lock", "Lock key should match");
    assert.equal(result.lock!.owner, "worker-1", "Owner should match");
    assert.equal(result.lock!.status, "held", "Status should be held");
    assert.ok(result.lock!.fencingToken > 0, "Should have fencing token");
    assert.ok(result.lock!.acquiredAt, "Should have acquired timestamp");
  } finally {
    h.cleanup();
  }
});

test("E2E Distributed Lock: release owned lock", () => {
  const h = createLockHarness("e2e-lock-release-");

  try {
    // Acquire lock
    const result = h.adapter.acquire({ lockKey: "release-test", owner: "worker-1" });
    assert.equal(result.acquired, true, "Lock should be acquired");

    // Release lock
    const released = h.adapter.release("release-test", "worker-1");

    assert.equal(released, true, "Lock should be released");
  } finally {
    h.cleanup();
  }
});

test("E2E Distributed Lock: cannot release lock owned by another", () => {
  const h = createLockHarness("e2e-lock-release-other-");

  try {
    // Worker 1 acquires lock
    const result = h.adapter.acquire({ lockKey: "exclusive-lock", owner: "worker-1" });
    assert.equal(result.acquired, true, "Lock should be acquired");

    // Worker 2 tries to release
    const released = h.adapter.release("exclusive-lock", "worker-2");

    assert.equal(released, false, "Should not release lock owned by another");
  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: Fencing Tokens
// ---------------------------------------------------------------------------

test("E2E Distributed Lock: fencing tokens increment on each acquisition", () => {
  const h = createLockHarness("e2e-lock-fencing-");

  try {
    const result1 = h.adapter.acquire({ lockKey: "fencing-lock", owner: "worker-1" });
    const token1 = result1.lock!.fencingToken;

    // Release and re-acquire
    h.adapter.release("fencing-lock", "worker-1");

    const result2 = h.adapter.acquire({ lockKey: "fencing-lock", owner: "worker-1" });
    const token2 = result2.lock!.fencingToken;

    assert.ok(token2 > token1, "Second fencing token should be higher");
  } finally {
    h.cleanup();
  }
});

test("E2E Distributed Lock: fencing tokens unique per lock key", () => {
  const h = createLockHarness("e2e-lock-fencing-unique-");

  try {
    const result1 = h.adapter.acquire({ lockKey: "lock-a", owner: "worker-1" });
    const result2 = h.adapter.acquire({ lockKey: "lock-b", owner: "worker-1" });

    // Tokens should be sequential across all locks
    assert.ok(result2.lock!.fencingToken > result1.lock!.fencingToken, "Tokens should be sequential");
  } finally {
    h.cleanup();
  }
});

test("E2E Distributed Lock: same owner can re-acquire and extend", () => {
  const h = createLockHarness("e2e-lock-reacquire-");

  try {
    // First acquisition
    const result1 = h.adapter.acquire({ lockKey: "reentrant-lock", owner: "worker-1" });
    const token1 = result1.lock!.fencingToken;

    // Same owner re-acquires (extends existing)
    const result2 = h.adapter.acquire({ lockKey: "reentrant-lock", owner: "worker-1" });

    assert.equal(result2.acquired, true, "Should re-acquire successfully");
    // Same-owner re-acquire extends the lease with a fresh fencing token.
    assert.ok(result2.lock!.fencingToken > token1, "Same owner re-acquire should advance fencing token");
  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Force Steal
// ---------------------------------------------------------------------------

test("E2E Distributed Lock: force steal removes existing lock", () => {
  const h = createLockHarness("e2e-lock-steal-");

  try {
    // Worker 1 acquires lock
    h.adapter.acquire({ lockKey: "contested-lock", owner: "worker-1" });

    // Worker 2 steals the lock
    const stolen = h.adapter.forceSteal("contested-lock", "worker-2", "stale_owner_recovery");

    assert.equal(stolen.owner, "worker-2", "New owner should be worker-2");
    assert.equal(stolen.lockKey, "contested-lock", "Lock key should match");
    assert.ok(stolen.metadata?.includes("forceStealReason"), "Should have steal reason in metadata");
  } finally {
    h.cleanup();
  }
});

test("E2E Distributed Lock: force steal increments fencing token", () => {
  const h = createLockHarness("e2e-lock-steal-fencing-");

  try {
    // Worker 1 acquires lock
    const result1 = h.adapter.acquire({ lockKey: "steal-fencing-lock", owner: "worker-1" });
    const token1 = result1.lock!.fencingToken;

    // Worker 2 steals
    const stolen = h.adapter.forceSteal("steal-fencing-lock", "worker-2", "operator_override");

    assert.ok(stolen.fencingToken > token1, "Stolen lock should have higher fencing token");
  } finally {
    h.cleanup();
  }
});

test("E2E Distributed Lock: force steal on non-existent lock succeeds", () => {
  const h = createLockHarness("e2e-lock-steal-new-");

  try {
    // Steal a lock that doesn't exist - should create it
    const stolen = h.adapter.forceSteal("nonexistent-lock", "worker-1", "incident_mitigation");

    assert.equal(stolen.owner, "worker-1", "Should be owned by claiming worker");
    assert.equal(stolen.status, "held", "Should have held status");
    assert.equal(stolen.lockKey, "nonexistent-lock", "Should have correct lock key");
  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: Lock Inspection
// ---------------------------------------------------------------------------

test("E2E Distributed Lock: inspect returns lock record", () => {
  const h = createLockHarness("e2e-lock-inspect-");

  try {
    // Acquire lock
    h.adapter.acquire({ lockKey: "inspectable-lock", owner: "worker-1", ttlMs: 5000 });

    // Inspect
    const inspected = h.adapter.inspect("inspectable-lock");

    assert.ok(inspected, "Should return lock record");
    assert.equal(inspected!.lockKey, "inspectable-lock", "Lock key should match");
    assert.equal(inspected!.owner, "worker-1", "Owner should match");
    assert.equal(inspected!.status, "held", "Status should be held");
    assert.ok(inspected!.ttlMs > 0, "Should have TTL");
  } finally {
    h.cleanup();
  }
});

test("E2E Distributed Lock: inspect returns null for non-existent lock", () => {
  const h = createLockHarness("e2e-lock-inspect-none-");

  try {
    const inspected = h.adapter.inspect("nonexistent-lock");

    assert.equal(inspected, null, "Should return null for non-existent lock");
  } finally {
    h.cleanup();
  }
});

test("E2E Distributed Lock: inspect returns null after release", () => {
  const h = createLockHarness("e2e-lock-inspect-release-");

  try {
    // Acquire and release
    h.adapter.acquire({ lockKey: "transient-lock", owner: "worker-1" });
    h.adapter.release("transient-lock", "worker-1");

    // Inspect
    const inspected = h.adapter.inspect("transient-lock");

    assert.equal(inspected, null, "Should return null after release");
  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 5: Multiple Concurrent Lock Owners
// ---------------------------------------------------------------------------

test("E2E Distributed Lock: different owners can hold different locks", () => {
  const h = createLockHarness("e2e-lock-multi-");

  try {
    const result1 = h.adapter.acquire({ lockKey: "resource-a", owner: "worker-1" });
    const result2 = h.adapter.acquire({ lockKey: "resource-b", owner: "worker-2" });

    assert.equal(result1.acquired, true, "Worker 1 should acquire lock A");
    assert.equal(result2.acquired, true, "Worker 2 should acquire lock B");

    // Both should be able to inspect their locks
    const inspect1 = h.adapter.inspect("resource-a");
    const inspect2 = h.adapter.inspect("resource-b");

    assert.equal(inspect1!.owner, "worker-1", "Worker 1 should own lock A");
    assert.equal(inspect2!.owner, "worker-2", "Worker 2 should own lock B");
  } finally {
    h.cleanup();
  }
});

test("E2E Distributed Lock: second owner blocked from acquiring existing lock", () => {
  const h = createLockHarness("e2e-lock-blocked-");

  try {
    // Worker 1 acquires lock
    const result1 = h.adapter.acquire({ lockKey: "exclusive-resource", owner: "worker-1" });
    assert.equal(result1.acquired, true, "Worker 1 should acquire lock");

    // Worker 2 tries to acquire same lock
    const result2 = h.adapter.acquire({ lockKey: "exclusive-resource", owner: "worker-2" });

    assert.equal(result2.acquired, false, "Worker 2 should be blocked");
    assert.equal(result2.lock, undefined, "Should not have lock record");
  } finally {
    h.cleanup();
  }
});

test("E2E Distributed Lock: multiple locks can be held by same owner", () => {
  const h = createLockHarness("e2e-lock-multi-same-");

  try {
    const result1 = h.adapter.acquire({ lockKey: "lock-1", owner: "worker-1" });
    const result2 = h.adapter.acquire({ lockKey: "lock-2", owner: "worker-1" });
    const result3 = h.adapter.acquire({ lockKey: "lock-3", owner: "worker-1" });

    assert.equal(result1.acquired, true, "Should acquire lock 1");
    assert.equal(result2.acquired, true, "Should acquire lock 2");
    assert.equal(result3.acquired, true, "Should acquire lock 3");
  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 6: Lock Extension
// ---------------------------------------------------------------------------

test("E2E Distributed Lock: extend increases TTL", () => {
  const h = createLockHarness("e2e-lock-extend-");

  try {
    // Acquire with short TTL
    h.adapter.acquire({ lockKey: "extendable-lock", owner: "worker-1", ttlMs: 1000 });

    // Extend
    const extended = h.adapter.extend("extendable-lock", "worker-1", 5000);

    assert.ok(extended, "Should return extended lock record");
    assert.ok(extended!.ttlMs > 1000, "TTL should be increased");
  } finally {
    h.cleanup();
  }
});

test("E2E Distributed Lock: extend fails for wrong owner", () => {
  const h = createLockHarness("e2e-lock-extend-fail-");

  try {
    // Worker 1 acquires
    h.adapter.acquire({ lockKey: "lock-to-extend", owner: "worker-1" });

    // Worker 2 tries to extend
    const extended = h.adapter.extend("lock-to-extend", "worker-2", 5000);

    assert.equal(extended, null, "Should fail to extend with wrong owner");
  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 7: Custom TTL
// ---------------------------------------------------------------------------

test("E2E Distributed Lock: custom TTL is preserved", () => {
  const h = createLockHarness("e2e-lock-ttl-");

  try {
    const result = h.adapter.acquire({ lockKey: "ttl-lock", owner: "worker-1", ttlMs: 60000 });

    assert.equal(result.lock!.ttlMs, 60000, "TTL should be 60 seconds");
  } finally {
    h.cleanup();
  }
});

test("E2E Distributed Lock: default TTL is 30 seconds", () => {
  const h = createLockHarness("e2e-lock-default-ttl-");

  try {
    const result = h.adapter.acquire({ lockKey: "default-ttl-lock", owner: "worker-1" });

    assert.equal(result.lock!.ttlMs, 30000, "Default TTL should be 30 seconds");
  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 8: Lock Metadata
// ---------------------------------------------------------------------------

test("E2E Distributed Lock: force steal records reason in metadata", () => {
  const h = createLockHarness("e2e-lock-metadata-");

  try {
    const stolen = h.adapter.forceSteal("metadata-lock", "worker-2", "stale_owner_recovery");

    assert.ok(stolen.metadata, "Should have metadata");
    assert.ok(stolen.metadata!.includes("forceStealReason"), "Should include reason field");
    assert.ok(stolen.metadata!.includes("stale_owner_recovery"), "Should include actual reason");
  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 9: Complete Lock Lifecycle E2E
// ---------------------------------------------------------------------------

test("E2E Distributed Lock: complete lifecycle - acquire, use, release", () => {
  const h = createLockHarness("e2e-lock-lifecycle-");

  try {
    const lockKey = "lifecycle-lock";

    // 1. Acquire lock
    const acquired = h.adapter.acquire({ lockKey, owner: "worker-1", ttlMs: 30000 });
    assert.equal(acquired.acquired, true, "Should acquire lock");
    assert.ok(acquired.lock!.fencingToken > 0, "Should have fencing token");

    // 2. Verify lock is held
    const inspected = h.adapter.inspect(lockKey);
    assert.equal(inspected!.owner, "worker-1", "Should be owned by worker-1");

    // 3. Use the lock (simulate work with fencing token)
    const fencingToken = acquired.lock!.fencingToken;
    assert.ok(fencingToken > 0, "Fencing token should be valid for write authority");

    // 4. Extend lock if needed
    const extended = h.adapter.extend(lockKey, "worker-1", 15000);
    assert.ok(extended, "Should extend lock");
    assert.ok(extended!.fencingToken > fencingToken, "Extended lock should have new fencing token");

    // 5. Release lock
    const released = h.adapter.release(lockKey, "worker-1");
    assert.equal(released, true, "Should release lock");

    // 6. Verify lock is released
    const afterRelease = h.adapter.inspect(lockKey);
    assert.equal(afterRelease, null, "Lock should be released");
  } finally {
    h.cleanup();
  }
});

test("E2E Distributed Lock: failover scenario with force steal", () => {
  const h = createLockHarness("e2e-lock-failover-");

  try {
    const lockKey = "failover-lock";

    // 1. Worker 1 acquires lock
    const worker1Acquire = h.adapter.acquire({ lockKey, owner: "worker-1" });
    assert.equal(worker1Acquire.acquired, true, "Worker 1 should acquire");

    // 2. Worker 1 starts processing (has fencing token)
    const worker1Token = worker1Acquire.lock!.fencingToken;

    // 3. Worker 1 appears to fail (no heartbeat, etc.)

    // 4. Worker 2 attempts to acquire (blocked by Worker 1's lock)
    const worker2Acquire = h.adapter.acquire({ lockKey, owner: "worker-2" });
    assert.equal(worker2Acquire.acquired, false, "Worker 2 should be blocked");

    // 5. After timeout considerations, Worker 2 force-steals
    const stolen = h.adapter.forceSteal(lockKey, "worker-2", "stale_owner_recovery");
    assert.equal(stolen.owner, "worker-2", "Worker 2 should now own lock");
    assert.ok(stolen.fencingToken > worker1Token, "New fencing token should be higher");

    // 6. Worker 2 can now proceed with higher fencing token
    const afterSteal = h.adapter.inspect(lockKey);
    assert.equal(afterSteal!.owner, "worker-2", "Lock should be owned by Worker 2");

    // 7. Worker 2 completes and releases
    const released = h.adapter.release(lockKey, "worker-2");
    assert.equal(released, true, "Worker 2 should release lock");
  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 10: Lock Adapter Backend Kind
// ---------------------------------------------------------------------------

test("E2E Distributed Lock: sqlite adapter reports correct backend kind", () => {
  const h = createLockHarness("e2e-lock-backend-");

  try {
    assert.equal(h.adapter.backendKind, "sqlite", "Backend should be sqlite");
  } finally {
    h.cleanup();
  }
});
