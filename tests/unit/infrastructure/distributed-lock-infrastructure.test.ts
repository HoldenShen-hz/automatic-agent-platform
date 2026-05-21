/**
 * Infrastructure: Distributed Lock Tests
 *
 * Tests for distributed lock types, SQLite lock adapter, and lock transition logic.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

// Distributed lock types
import {
  DistributedLockAdapter,
  LockBackendKind,
  LockStatus,
  LockRecord,
  AcquireLockInput,
  AcquireLockResult,
  DISTRIBUTED_LOCKS_DDL,
  PgAdvisoryLockConfig,
  RedisLockConfig,
  LockDataSchema,
  LockData,
  LockType,
  LockTransitionCommand,
  LockTransitionResult,
  transitionLock,
  CreateLockAdapter,
} from "../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-types.js";

// SQLite lock adapter
import { SqliteLockAdapter } from "../../../src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.js";

// Authoritative SQL database
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";

// ── Distributed Lock Types Tests ───────────────────────────────────────────────

describe("Distributed Lock Types", () => {
  it("LockBackendKind accepts expected values", () => {
    const kinds: LockBackendKind[] = ["sqlite", "pg_advisory", "redis"];
    assert.equal(kinds.length, 3);
  });

  it("LockStatus includes all expected statuses", () => {
    const statuses: LockStatus[] = ["pending", "held", "extended", "released", "expired", "reclaimed", "stolen"];
    assert.equal(statuses.length, 7);
  });

  it("DISTRIBUTED_LOCKS_DDL creates valid SQL", () => {
    assert.ok(DISTRIBUTED_LOCKS_DDL.includes("CREATE TABLE IF NOT EXISTS distributed_locks"));
    assert.ok(DISTRIBUTED_LOCKS_DDL.includes("lock_key"));
    assert.ok(DISTRIBUTED_LOCKS_DDL.includes("owner"));
    assert.ok(DISTRIBUTED_LOCKS_DDL.includes("fencing_token"));
    assert.ok(DISTRIBUTED_LOCKS_DDL.includes("status"));
  });

  it("LockRecord has correct structure", () => {
    const record: LockRecord = {
      lockKey: "test-lock",
      owner: "owner-1",
      fencingToken: 42,
      status: "held",
      acquiredAt: new Date().toISOString(),
      ttlMs: 30000,
      metadata: null,
    };
    assert.equal(record.lockKey, "test-lock");
    assert.equal(record.owner, "owner-1");
    assert.equal(record.fencingToken, 42);
    assert.equal(record.status, "held");
  });

  it("AcquireLockInput allows optional ttlMs", () => {
    const input1: AcquireLockInput = { lockKey: "l1", owner: "o1" };
    const input2: AcquireLockInput = { lockKey: "l1", owner: "o1", ttlMs: 60000 };
    assert.equal(input1.ttlMs, undefined);
    assert.equal(input2.ttlMs, 60000);
  });

  it("AcquireLockResult with acquired false has no lock", () => {
    const result: AcquireLockResult = { acquired: false };
    assert.equal(result.acquired, false);
    assert.equal(result.lock, undefined);
  });

  it("AcquireLockResult with acquired true has lock record", () => {
    const result: AcquireLockResult = {
      acquired: true,
      lock: {
        lockKey: "l1",
        owner: "o1",
        fencingToken: 1,
        status: "held",
        acquiredAt: new Date().toISOString(),
        ttlMs: 30000,
        metadata: null,
      },
    };
    assert.equal(result.acquired, true);
    assert.ok(result.lock);
  });
});

// ── LockDataSchema Tests ───────────────────────────────────────────────────────

describe("LockDataSchema", () => {
  it("validates correct LockData", () => {
    const validData: LockData = {
      id: "lock_123",
      owner: "owner-1",
      fencingToken: 42,
      ttlMs: 30000,
      acquiredAt: new Date().toISOString(),
      metadata: null,
    };
    const result = LockDataSchema.safeParse(validData);
    assert.equal(result.success, true);
  });

  it("rejects empty id", () => {
    const invalidData = {
      id: "",
      owner: "owner-1",
      fencingToken: 42,
      ttlMs: 30000,
      acquiredAt: new Date().toISOString(),
      metadata: null,
    };
    const result = LockDataSchema.safeParse(invalidData);
    assert.equal(result.success, false);
  });

  it("rejects negative fencing token", () => {
    const invalidData = {
      id: "lock_123",
      owner: "owner-1",
      fencingToken: -1,
      ttlMs: 30000,
      acquiredAt: new Date().toISOString(),
      metadata: null,
    };
    const result = LockDataSchema.safeParse(invalidData);
    assert.equal(result.success, false);
  });

  it("rejects non-positive ttlMs", () => {
    const invalidData = {
      id: "lock_123",
      owner: "owner-1",
      fencingToken: 42,
      ttlMs: 0,
      acquiredAt: new Date().toISOString(),
      metadata: null,
    };
    const result = LockDataSchema.safeParse(invalidData);
    assert.equal(result.success, false);
  });

  it("rejects invalid acquiredAt timestamp", () => {
    const invalidData = {
      id: "lock_123",
      owner: "owner-1",
      fencingToken: 42,
      ttlMs: 30000,
      acquiredAt: "not-a-timestamp",
      metadata: null,
    };
    const result = LockDataSchema.safeParse(invalidData);
    assert.equal(result.success, false);
  });

  it("accepts string metadata", () => {
    const validData: LockData = {
      id: "lock_123",
      owner: "owner-1",
      fencingToken: 42,
      ttlMs: 30000,
      acquiredAt: new Date().toISOString(),
      metadata: '{"reason":"test"}',
    };
    const result = LockDataSchema.safeParse(validData);
    assert.equal(result.success, true);
  });
});

// ── Lock Transition Tests ──────────────────────────────────────────────────────

describe("transitionLock", () => {
  it("returns accepted for valid transition", () => {
    const command: LockTransitionCommand = {
      lockId: "lock-1",
      lockType: "execution_lease",
      resourceKey: "resource-1",
      fromStatus: "pending",
      toStatus: "held",
      ownerId: "owner-1",
      reasonCode: "acquired",
      traceId: "trace-123",
      occurredAt: new Date().toISOString(),
    };
    const result = transitionLock(command);
    assert.equal(result.accepted, true);
    assert.equal(result.command, command);
  });

  it("throws for empty lockId", () => {
    const command = {
      lockId: "",
      lockType: "execution_lease" as LockType,
      resourceKey: "resource-1",
      fromStatus: "pending" as LockStatus,
      toStatus: "held" as LockStatus,
      ownerId: "owner-1",
      reasonCode: "acquired",
      traceId: "trace-123",
      occurredAt: new Date().toISOString(),
    };
    assert.throws(() => transitionLock(command), /lock_id_required/);
  });

  it("throws for empty resourceKey", () => {
    const command = {
      lockId: "lock-1",
      lockType: "execution_lease" as LockType,
      resourceKey: "",
      fromStatus: "pending" as LockStatus,
      toStatus: "held" as LockStatus,
      ownerId: "owner-1",
      reasonCode: "acquired",
      traceId: "trace-123",
      occurredAt: new Date().toISOString(),
    };
    assert.throws(() => transitionLock(command), /resource_key_required/);
  });

  it("throws for empty ownerId", () => {
    const command = {
      lockId: "lock-1",
      lockType: "execution_lease" as LockType,
      resourceKey: "resource-1",
      fromStatus: "pending" as LockStatus,
      toStatus: "held" as LockStatus,
      ownerId: "",
      reasonCode: "acquired",
      traceId: "trace-123",
      occurredAt: new Date().toISOString(),
    };
    assert.throws(() => transitionLock(command), /owner_id_required/);
  });

  it("throws for empty reasonCode", () => {
    const command = {
      lockId: "lock-1",
      lockType: "execution_lease" as LockType,
      resourceKey: "resource-1",
      fromStatus: "pending" as LockStatus,
      toStatus: "held" as LockStatus,
      ownerId: "owner-1",
      reasonCode: "",
      traceId: "trace-123",
      occurredAt: new Date().toISOString(),
    };
    assert.throws(() => transitionLock(command), /reason_code_required/);
  });

  it("throws for empty traceId", () => {
    const command = {
      lockId: "lock-1",
      lockType: "execution_lease" as LockType,
      resourceKey: "resource-1",
      fromStatus: "pending" as LockStatus,
      toStatus: "held" as LockStatus,
      ownerId: "owner-1",
      reasonCode: "acquired",
      traceId: "",
      occurredAt: new Date().toISOString(),
    };
    assert.throws(() => transitionLock(command), /trace_id_required/);
  });

  it("throws for no-op transition (same status)", () => {
    const command = {
      lockId: "lock-1",
      lockType: "execution_lease" as LockType,
      resourceKey: "resource-1",
      fromStatus: "held" as LockStatus,
      toStatus: "held" as LockStatus,
      ownerId: "owner-1",
      reasonCode: "acquired",
      traceId: "trace-123",
      occurredAt: new Date().toISOString(),
    };
    assert.throws(() => transitionLock(command), /transition_noop/);
  });
});

// ── SqliteLockAdapter Tests ────────────────────────────────────────────────────

describe("SqliteLockAdapter", () => {
  let db: SqliteDatabase;
  let adapter: SqliteLockAdapter;

  beforeEach(() => {
    db = new SqliteDatabase(":memory:");
    db.migrate();
    adapter = new SqliteLockAdapter(db.connection as any);
  });

  it("backendKind returns sqlite", () => {
    assert.equal(adapter.backendKind, "sqlite");
  });

  it("acquire acquires lock successfully", () => {
    const input: AcquireLockInput = { lockKey: "lock-1", owner: "owner-1", ttlMs: 30000 };
    const result = adapter.acquire(input);
    assert.equal(result.acquired, true);
    assert.ok(result.lock);
    assert.equal(result.lock!.lockKey, "lock-1");
    assert.equal(result.lock!.owner, "owner-1");
    assert.equal(result.lock!.status, "held");
  });

  it("acquire returns false when lock already held by different owner", () => {
    adapter.acquire({ lockKey: "lock-1", owner: "owner-1", ttlMs: 30000 });
    const result = adapter.acquire({ lockKey: "lock-1", owner: "owner-2", ttlMs: 30000 });
    assert.equal(result.acquired, false);
  });

  it("acquire extends lock for same owner", () => {
    adapter.acquire({ lockKey: "lock-1", owner: "owner-1", ttlMs: 30000 });
    const result = adapter.acquire({ lockKey: "lock-1", owner: "owner-1", ttlMs: 60000 });
    assert.equal(result.acquired, true);
    assert.ok(result.lock);
  });

  it("release releases lock for correct owner", () => {
    adapter.acquire({ lockKey: "lock-1", owner: "owner-1", ttlMs: 30000 });
    const released = adapter.release("lock-1", "owner-1");
    assert.equal(released, true);
    const result = adapter.inspect("lock-1");
    assert.equal(result, null);
  });

  it("release returns false when lock not owned", () => {
    adapter.acquire({ lockKey: "lock-1", owner: "owner-1", ttlMs: 30000 });
    const released = adapter.release("lock-1", "wrong-owner");
    assert.equal(released, false);
  });

  it("extend extends lock TTL", () => {
    adapter.acquire({ lockKey: "lock-1", owner: "owner-1", ttlMs: 30000 });
    const result = adapter.extend("lock-1", "owner-1", 30000);
    assert.ok(result);
    assert.equal(result.ttlMs, 60000);
  });

  it("extend returns null when lock not found", () => {
    const result = adapter.extend("nonexistent", "owner-1", 30000);
    assert.equal(result, null);
  });

  it("forceSteal takes lock forcefully", () => {
    adapter.acquire({ lockKey: "lock-1", owner: "owner-1", ttlMs: 30000 });
    const result = adapter.forceSteal("lock-1", "new-owner", "needed for maintenance");
    assert.equal(result.owner, "new-owner");
    assert.ok(result.metadata);
  });

  it("inspect returns lock record", () => {
    adapter.acquire({ lockKey: "lock-1", owner: "owner-1", ttlMs: 30000 });
    const result = adapter.inspect("lock-1");
    assert.ok(result);
    assert.equal(result!.lockKey, "lock-1");
    assert.equal(result!.owner, "owner-1");
  });

  it("inspect returns null for non-existent lock", () => {
    const result = adapter.inspect("nonexistent-lock");
    assert.equal(result, null);
  });

  it("queryLock is alias for inspect", () => {
    adapter.acquire({ lockKey: "lock-1", owner: "owner-1", ttlMs: 30000 });
    const inspected = adapter.inspect("lock-1");
    const queried = adapter.queryLock("lock-1");
    assert.deepEqual(inspected, queried);
  });

  it("acquire with legacy lockName/ownerId input normalizes", () => {
    // Legacy API uses lockName and ownerId
    const result = adapter.acquire({ lockName: "legacy-lock", ownerId: "legacy-owner", ttlMs: 30000 });
    assert.equal(result.acquired, true);
    assert.ok(result.lock);
    assert.equal(result.lock!.lockKey, "legacy-lock");
  });

  it("release with legacy lockName/ownerId input normalizes", () => {
    adapter.acquire({ lockName: "legacy-lock", ownerId: "legacy-owner", ttlMs: 30000 });
    const released = adapter.release("legacy-lock", "legacy-owner");
    assert.equal(released, true);
  });

  it("inspect with legacy object input normalizes", () => {
    adapter.acquire({ lockName: "legacy-lock", ownerId: "legacy-owner", ttlMs: 30000 });
    const result = adapter.inspect({ lockName: "legacy-lock" } as any);
    assert.ok(result);
    assert.equal(result!.lockKey, "legacy-lock");
  });

  it("handles expired lock cleanup", () => {
    // First acquire and then manually expire it by setting acquired_at far in past
    adapter.acquire({ lockKey: "lock-1", owner: "owner-1", ttlMs: 1 });
    // Wait for lock to expire (TTL of 1ms)
    const result = adapter.acquire({ lockKey: "lock-1", owner: "owner-2", ttlMs: 30000 });
    assert.equal(result.acquired, true);
    assert.ok(result.lock);
    assert.equal(result.lock!.owner, "owner-2");
  });
});