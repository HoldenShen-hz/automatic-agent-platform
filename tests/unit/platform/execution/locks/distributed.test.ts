import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { SqliteLockAdapter } from "../../../../../src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.js";
import { DISTRIBUTED_LOCKS_DDL } from "../../../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-types.js";
import type { DistributedLockAdapter, LockRecord } from "../../../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-types.js";

// =============================================================================
// Test setup helpers
// =============================================================================

function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(DISTRIBUTED_LOCKS_DDL);
  return db;
}

// =============================================================================
// Fencing token tests
// =============================================================================

test("Distributed: SqliteLockAdapter fencing token starts at 1 [distributed]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result = adapter.acquire({ lockKey: "fencing-test", owner: "owner-1" });

  assert.equal(result.acquired, true);
  assert.equal(result.lock!.fencingToken, 1);

  db.close();
});

test("Distributed: SqliteLockAdapter fencing token increments on re-acquire after release [distributed]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // First lock
  adapter.acquire({ lockKey: "lock-1", owner: "owner-1" });
  adapter.release("lock-1", "owner-1");

  // Second lock on different key
  const result = adapter.acquire({ lockKey: "lock-2", owner: "owner-1" });

  assert.equal(result.acquired, true);
  assert.equal(result.lock!.fencingToken, 2);

  db.close();
});

test("Distributed: SqliteLockAdapter fencing token increments after forceSteal [distributed]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1" });
  adapter.forceSteal("test-lock", "owner-2", "test reason");
  const result = adapter.acquire({ lockKey: "new-lock", owner: "owner-1" });

  // Should be 3 because: initial acquire (1) + forceSteal increments (2) + new acquire (3)
  assert.equal(result.acquired, true);
  assert.equal(result.lock!.fencingToken, 3);

  db.close();
});

test("Distributed: Different owners get different fencing tokens on same key sequence [distributed]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Owner 1 acquires
  const r1 = adapter.acquire({ lockKey: "shared-lock", owner: "owner-1" });
  adapter.release("shared-lock", "owner-1");

  // Owner 2 acquires
  const r2 = adapter.acquire({ lockKey: "shared-lock", owner: "owner-2" });
  adapter.release("shared-lock", "owner-2");

  // Owner 1 acquires again
  const r3 = adapter.acquire({ lockKey: "shared-lock", owner: "owner-1" });

  assert.equal(r1.lock!.fencingToken, 1);
  assert.equal(r2.lock!.fencingToken, 2);
  assert.equal(r3.lock!.fencingToken, 3);

  db.close();
});

// =============================================================================
// Distributed lock acquisition semantics
// =============================================================================

test("Distributed: First acquirer wins for same lock key [distributed]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // First owner acquires
  const first = adapter.acquire({ lockKey: "compete-lock", owner: "owner-1" });
  assert.equal(first.acquired, true);

  // Second owner fails
  const second = adapter.acquire({ lockKey: "compete-lock", owner: "owner-2" });
  assert.equal(second.acquired, false);

  db.close();
});

test("Distributed: After release, new owner can acquire [distributed]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Owner 1 acquires and releases
  adapter.acquire({ lockKey: "release-lock", owner: "owner-1" });
  adapter.release("release-lock", "owner-1");

  // Owner 2 can now acquire
  const result = adapter.acquire({ lockKey: "release-lock", owner: "owner-2" });
  assert.equal(result.acquired, true);
  assert.equal(result.lock!.owner, "owner-2");

  db.close();
});

test("Distributed: Force steal allows new owner to take lock immediately [distributed]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Original owner acquires
  adapter.acquire({ lockKey: "steal-lock", owner: "owner-1" });

  // New owner force-steals
  const stolen = adapter.forceSteal("steal-lock", "owner-2", "urgent work needed");
  assert.equal(stolen.owner, "owner-2");
  assert.equal(stolen.status, "held");

  // Original owner can no longer release (wrong owner)
  const released = adapter.release("steal-lock", "owner-1");
  assert.equal(released, false);

  // New owner can release
  const releasedByNewOwner = adapter.release("steal-lock", "owner-2");
  assert.equal(releasedByNewOwner, true);

  db.close();
});

test("Distributed: Lock can be acquired after owner releases even if TTL not expired [distributed]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire with long TTL
  adapter.acquire({ lockKey: "long-ttl-lock", owner: "owner-1", ttlMs: 60000 });

  // Release before TTL expires
  adapter.release("long-ttl-lock", "owner-1");

  // New owner should succeed
  const result = adapter.acquire({ lockKey: "long-ttl-lock", owner: "owner-2" });
  assert.equal(result.acquired, true);
  assert.equal(result.lock!.owner, "owner-2");

  db.close();
});

// =============================================================================
// Concurrent acquire simulation
// =============================================================================

test("Distributed: Multiple adapters on same database - first write wins [distributed]", () => {
  const db = createTestDb();
  const adapter1 = new SqliteLockAdapter(db);
  const adapter2 = new SqliteLockAdapter(db);

  // Both try to acquire the same lock
  const r1 = adapter1.acquire({ lockKey: "concurrent-lock", owner: "adapter-1" });
  const r2 = adapter2.acquire({ lockKey: "concurrent-lock", owner: "adapter-2" });

  // Only one succeeds
  assert.ok(r1.acquired !== r2.acquired);

  db.close();
});

test("Distributed: Multiple locks can be held by same owner simultaneously [distributed]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const r1 = adapter.acquire({ lockKey: "lock-a", owner: "multi-owner" });
  const r2 = adapter.acquire({ lockKey: "lock-b", owner: "multi-owner" });
  const r3 = adapter.acquire({ lockKey: "lock-c", owner: "multi-owner" });

  assert.equal(r1.acquired, true);
  assert.equal(r2.acquired, true);
  assert.equal(r3.acquired, true);

  db.close();
});

test("Distributed: Same owner can re-acquire released lock [distributed]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire, release, re-acquire
  adapter.acquire({ lockKey: "reacquire-lock", owner: "owner-1" });
  adapter.release("reacquire-lock", "owner-1");
  const result = adapter.acquire({ lockKey: "reacquire-lock", owner: "owner-1" });

  assert.equal(result.acquired, true);
  assert.equal(result.lock!.fencingToken, 2); // Second acquire

  db.close();
});

// =============================================================================
// Lock lifecycle tests
// =============================================================================

test("Distributed: Full lock lifecycle - acquire, extend, release [distributed]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire
  const acquired = adapter.acquire({ lockKey: "lifecycle-lock", owner: "owner-1", ttlMs: 30000 });
  assert.equal(acquired.acquired, true);
  assert.ok(acquired.lock);

  // Extend
  const extended = adapter.extend("lifecycle-lock", "owner-1", 30000);
  assert.ok(extended !== null);
  assert.equal(extended.owner, "owner-1");

  // Release
  const released = adapter.release("lifecycle-lock", "owner-1");
  assert.equal(released, true);

  // Verify lock is gone
  const inspected = adapter.inspect("lifecycle-lock");
  assert.equal(inspected, null);

  db.close();
});

test("Distributed: Extend fails for non-existent lock [distributed]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const extended = adapter.extend("nonexistent", "owner-1", 30000);
  assert.equal(extended, null);

  db.close();
});

test("Distributed: Release fails for non-existent lock [distributed]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const released = adapter.release("nonexistent", "owner-1");
  assert.equal(released, false);

  db.close();
});

// =============================================================================
// Mock distributed adapter tests
// =============================================================================

test("Distributed: Mock adapter simulates distributed environment [distributed]", () => {
  const lockState = new Map<string, LockRecord>();
  const fencingTokens = new Map<string, number>();

  const mockAdapter: DistributedLockAdapter = {
    backendKind: "mock-distributed",
    acquire: ({ lockKey, owner, ttlMs }: { lockKey: string; owner: string; ttlMs?: number }) => {
      const existing = lockState.get(lockKey);
      if (existing && existing.status === "held") {
        return { acquired: false };
      }
      const currentToken = fencingTokens.get(lockKey) ?? 0;
      const nextToken = currentToken + 1;
      fencingTokens.set(lockKey, nextToken);
      const lock: LockRecord = {
        lockKey,
        owner,
        fencingToken: nextToken,
        status: "held",
        acquiredAt: new Date().toISOString(),
        ttlMs: ttlMs ?? 30000,
        metadata: null,
      };
      lockState.set(lockKey, lock);
      return { acquired: true, lock };
    },
    release: (lockKey: string, owner: string) => {
      const lock = lockState.get(lockKey);
      if (!lock || lock.owner !== owner) {
        return false;
      }
      lockState.delete(lockKey);
      return true;
    },
    extend: (lockKey: string, owner: string, additionalMs: number) => {
      const lock = lockState.get(lockKey);
      if (!lock || lock.owner !== owner) {
        return null;
      }
      lock.ttlMs += additionalMs;
      return { lockKey: lock.lockKey, owner: lock.owner, fencingToken: lock.fencingToken, status: lock.status };
    },
    forceSteal: (lockKey: string, newOwner: string, _reason: string) => {
      const lock = lockState.get(lockKey);
      const currentToken = fencingTokens.get(lockKey) ?? 0;
      const nextToken = currentToken + 1;
      fencingTokens.set(lockKey, nextToken);
      const newLock: LockRecord = {
        lockKey,
        owner: newOwner,
        fencingToken: nextToken,
        status: "held",
        acquiredAt: new Date().toISOString(),
        ttlMs: lock?.ttlMs ?? 30000,
        metadata: null,
      };
      lockState.set(lockKey, newLock);
      return { lockKey, owner: newOwner, fencingToken: nextToken, status: "held" };
    },
    inspect: (lockKey: string) => {
      const lock = lockState.get(lockKey);
      if (!lock) return null;
      return { ...lock, ttlMs: lock.ttlMs, metadata: lock.metadata };
    },
  };

  // Test the mock
  const r1 = mockAdapter.acquire({ lockKey: "dist-lock", owner: "node-1" });
  assert.equal(r1.acquired, true);
  assert.equal(r1.lock!.fencingToken, 1);

  // Another node tries to acquire
  const r2 = mockAdapter.acquire({ lockKey: "dist-lock", owner: "node-2" });
  assert.equal(r2.acquired, false);

  // Node 1 releases
  const released = mockAdapter.release("dist-lock", "node-1");
  assert.equal(released, true);

  // Now node 2 can acquire
  const r3 = mockAdapter.acquire({ lockKey: "dist-lock", owner: "node-2" });
  assert.equal(r3.acquired, true);
  assert.equal(r3.lock!.fencingToken, 2);
});

test("Distributed: Mock adapter with forceSteal transfers ownership [distributed]", () => {
  const lockState = new Map<string, LockRecord>();

  const mockAdapter: DistributedLockAdapter = {
    backendKind: "mock-steal",
    acquire: ({ lockKey, owner, ttlMs }: { lockKey: string; owner: string; ttlMs?: number }) => {
      const existing = lockState.get(lockKey);
      const lock: LockRecord = {
        lockKey,
        owner,
        fencingToken: (existing?.fencingToken ?? 0) + 1,
        status: "held",
        acquiredAt: new Date().toISOString(),
        ttlMs: ttlMs ?? 30000,
        metadata: null,
      };
      lockState.set(lockKey, lock);
      return { acquired: true, lock };
    },
    release: (lockKey: string, owner: string) => {
      const lock = lockState.get(lockKey);
      if (!lock || lock.owner !== owner) return false;
      lockState.delete(lockKey);
      return true;
    },
    extend: (lockKey: string, owner: string, additionalMs: number) => {
      const lock = lockState.get(lockKey);
      if (!lock || lock.owner !== owner) return null;
      lock.ttlMs += additionalMs;
      return { lockKey: lock.lockKey, owner: lock.owner, fencingToken: lock.fencingToken, status: lock.status };
    },
    forceSteal: (lockKey: string, newOwner: string, reason: string) => {
      const existing = lockState.get(lockKey);
      const fencingToken = (existing?.fencingToken ?? 0) + 1;
      const newLock: LockRecord = {
        lockKey,
        owner: newOwner,
        fencingToken,
        status: "held",
        acquiredAt: new Date().toISOString(),
        ttlMs: existing?.ttlMs ?? 30000,
        metadata: JSON.stringify({ stolen: true, reason }),
      };
      lockState.set(lockKey, newLock);
      return { lockKey, owner: newOwner, fencingToken, status: "held" };
    },
    inspect: (lockKey: string) => {
      const lock = lockState.get(lockKey);
      if (!lock) return null;
      return { ...lock, ttlMs: lock.ttlMs, metadata: lock.metadata };
    },
  };

  // Node 1 acquires
  mockAdapter.acquire({ lockKey: "steal-test", owner: "node-1" });

  // Admin force-steals
  const stolen = mockAdapter.forceSteal("steal-test", "admin", "policy violation");
  assert.equal(stolen.owner, "admin");

  // Node 1 can no longer release
  assert.equal(mockAdapter.release("steal-test", "node-1"), false);

  // Admin can release
  assert.equal(mockAdapter.release("steal-test", "admin"), true);
});

// =============================================================================
// Inspect behavior tests
// =============================================================================

test("Distributed: Inspect returns correct lock state [distributed]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "inspect-test", owner: "owner-1", ttlMs: 45000 });
  const inspected = adapter.inspect("inspect-test");

  assert.ok(inspected !== null);
  assert.equal(inspected!.lockKey, "inspect-test");
  assert.equal(inspected!.owner, "owner-1");
  assert.equal(inspected!.fencingToken, 1);
  assert.equal(inspected!.status, "held");
  assert.equal(inspected!.ttlMs, 45000);

  db.close();
});

test("Distributed: Inspect after release returns null [distributed]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "post-release", owner: "owner-1" });
  adapter.release("post-release", "owner-1");
  const inspected = adapter.inspect("post-release");

  assert.equal(inspected, null);

  db.close();
});

test("Distributed: Inspect after forceSteal returns new owner [distributed]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "steal-inspect", owner: "owner-1" });
  adapter.forceSteal("steal-inspect", "owner-2", "test");
  const inspected = adapter.inspect("steal-inspect");

  assert.ok(inspected !== null);
  assert.equal(inspected!.owner, "owner-2");
  assert.equal(inspected!.fencingToken, 2);

  db.close();
});

// =============================================================================
// DDL structure verification
// =============================================================================

test("Distributed: DDL includes all required columns for distributed operation [distributed]", () => {
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("lock_key"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("owner"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("fencing_token"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("status"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("acquired_at"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("ttl_ms"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("metadata"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("PRIMARY KEY"));
});

test("Distributed: DDL creates valid table that supports lock operations [distributed]", () => {
  const db = createTestDb();

  // Insert a lock record directly
  db.prepare(`
    INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run("direct-insert", "test-owner", 1, "held", new Date().toISOString(), 30000);

  // Query it back
  const row = db.prepare("SELECT * FROM distributed_locks WHERE lock_key = ?").get("direct-insert") as { lock_key: string; owner: string } | undefined;

  assert.ok(row !== undefined);
  assert.equal(row.lock_key, "direct-insert");
  assert.equal(row.owner, "test-owner");

  db.close();
});
