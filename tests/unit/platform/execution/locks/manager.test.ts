import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { createLockAdapter } from "../../../../../src/platform/execution/distributed-lock/distributed-lock-factory.js";
import { DISTRIBUTED_LOCKS_DDL } from "../../../../../src/platform/execution/distributed-lock/distributed-lock-types.js";
import { SqliteLockAdapter } from "../../../../../src/platform/execution/distributed-lock/sqlite-lock-adapter.js";
import { PgAdvisoryLockAdapter } from "../../../../../src/platform/execution/distributed-lock/pg-advisory-lock-adapter.js";
import { RedisLockAdapter } from "../../../../../src/platform/execution/distributed-lock/redis-lock-adapter.js";
import type { DistributedLockAdapter } from "../../../../../src/platform/execution/distributed-lock/distributed-lock-types.js";

// =============================================================================
// Test setup helpers
// =============================================================================

function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(DISTRIBUTED_LOCKS_DDL);
  return db;
}

// =============================================================================
// createLockAdapter factory tests
// =============================================================================

test("createLockAdapter creates SqliteLockAdapter with valid database", () => {
  const db = createTestDb();
  const adapter = createLockAdapter("sqlite", db);

  assert.ok(adapter instanceof SqliteLockAdapter);
  assert.equal(adapter.backendKind, "sqlite");

  db.close();
});

test("createLockAdapter creates PgAdvisoryLockAdapter without database", () => {
  const adapter = createLockAdapter("pg_advisory");

  assert.ok(adapter instanceof PgAdvisoryLockAdapter);
  assert.equal(adapter.backendKind, "pg_advisory");
});

test("createLockAdapter creates RedisLockAdapter without database", () => {
  const adapter = createLockAdapter("redis");

  assert.ok(adapter instanceof RedisLockAdapter);
  assert.equal(adapter.backendKind, "redis");
});

test("createLockAdapter throws for unknown backend kind", () => {
  assert.throws(
    () => createLockAdapter("unknown" as "sqlite" | "pg_advisory" | "redis"),
    (error: unknown) => {
      const err = error as { code?: string; message?: string };
      return (
        err.code?.includes("lock.backend_not_supported") &&
        err.message?.includes("unknown")
      );
    },
  );
});

test("createLockAdapter throws for sqlite when db is not provided", () => {
  assert.throws(
    () => createLockAdapter("sqlite"),
    (error: unknown) => {
      const err = error as { code?: string };
      return err.code?.includes("lock.sqlite_adapter_requires_db");
    },
  );
});

test("createLockAdapter error message includes the unsupported backend name", () => {
  assert.throws(
    () => createLockAdapter("mysql" as "sqlite" | "pg_advisory" | "redis"),
    (error: unknown) => {
      const err = error as { message?: string };
      return err.message?.includes("mysql");
    },
  );
});

// =============================================================================
// DistributedLockAdapter mock tests
// =============================================================================

test("DistributedLockAdapter mock can be created with all required methods", () => {
  const mockAdapter: DistributedLockAdapter = {
    backendKind: "mock",
    acquire: () => ({ acquired: true, lock: { lockKey: "key", owner: "owner", fencingToken: 1, status: "held", acquiredAt: new Date().toISOString(), ttlMs: 30000, metadata: null } }),
    release: () => true,
    extend: () => ({ lockKey: "key", owner: "owner", fencingToken: 1, status: "held" }),
    forceSteal: () => ({ lockKey: "key", owner: "newOwner", fencingToken: 2, status: "held" }),
    inspect: () => ({ lockKey: "key", owner: "owner", fencingToken: 1, status: "held", ttlMs: 30000, metadata: null }),
  };

  assert.equal(mockAdapter.backendKind, "mock");
  assert.equal(typeof mockAdapter.acquire, "function");
  assert.equal(typeof mockAdapter.release, "function");
  assert.equal(typeof mockAdapter.extend, "function");
  assert.equal(typeof mockAdapter.forceSteal, "function");
  assert.equal(typeof mockAdapter.inspect, "function");
});

test("DistributedLockAdapter mock acquire returns correct result structure", () => {
  const mockAdapter: DistributedLockAdapter = {
    backendKind: "mock",
    acquire: () => ({ acquired: false }),
    release: () => false,
    extend: () => null,
    forceSteal: () => ({ lockKey: "", owner: "", fencingToken: 0, status: "" }),
    inspect: () => null,
  };

  const result = mockAdapter.acquire({ lockKey: "test", owner: "owner" });
  assert.equal(result.acquired, false);
});

test("DistributedLockAdapter mock extend returns null for non-existent lock", () => {
  const mockAdapter: DistributedLockAdapter = {
    backendKind: "mock",
    acquire: () => ({ acquired: false }),
    release: () => false,
    extend: () => null,
    forceSteal: () => ({ lockKey: "", owner: "", fencingToken: 0, status: "" }),
    inspect: () => null,
  };

  const result = mockAdapter.extend("nonexistent", "owner", 30000);
  assert.equal(result, null);
});

// =============================================================================
// Manager-level lock operations with SQLite adapter
// =============================================================================

test("Manager: SqliteLockAdapter acquire returns lock with correct structure", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result = adapter.acquire({ lockKey: "test-lock", owner: "manager-test", ttlMs: 30000 });

  assert.equal(result.acquired, true);
  assert.ok(result.lock);
  assert.equal(result.lock!.lockKey, "test-lock");
  assert.equal(result.lock!.owner, "manager-test");
  assert.equal(result.lock!.fencingToken, 1);
  assert.equal(result.lock!.status, "held");
  assert.equal(result.lock!.ttlMs, 30000);

  db.close();
});

test("Manager: SqliteLockAdapter release returns true for correct owner", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "release-lock", owner: "owner-1" });
  const released = adapter.release("release-lock", "owner-1");

  assert.equal(released, true);
  db.close();
});

test("Manager: SqliteLockAdapter release returns false for wrong owner", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "release-lock", owner: "owner-1" });
  const released = adapter.release("release-lock", "wrong-owner");

  assert.equal(released, false);
  db.close();
});

test("Manager: SqliteLockAdapter extend returns extended lock info", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "extend-lock", owner: "owner-1" });
  const extended = adapter.extend("extend-lock", "owner-1", 60000);

  assert.ok(extended !== null);
  assert.equal(extended!.lockKey, "extend-lock");
  assert.equal(extended!.owner, "owner-1");
  db.close();
});

test("Manager: SqliteLockAdapter extend returns null for wrong owner", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "extend-lock", owner: "owner-1" });
  const extended = adapter.extend("extend-lock", "wrong-owner", 60000);

  assert.equal(extended, null);
  db.close();
});

test("Manager: SqliteLockAdapter inspect returns lock info", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "inspect-lock", owner: "owner-1", ttlMs: 30000 });
  const inspected = adapter.inspect("inspect-lock");

  assert.ok(inspected !== null);
  assert.equal(inspected!.lockKey, "inspect-lock");
  assert.equal(inspected!.owner, "owner-1");
  assert.equal(inspected!.ttlMs, 30000);
  db.close();
});

test("Manager: SqliteLockAdapter inspect returns null for non-existent lock", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const inspected = adapter.inspect("nonexistent-lock");

  assert.equal(inspected, null);
  db.close();
});

test("Manager: SqliteLockAdapter forceSteal transfers lock to new owner", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "steal-lock", owner: "owner-1" });
  const stolen = adapter.forceSteal("steal-lock", "owner-2", "manager decision");

  assert.equal(stolen.owner, "owner-2");
  assert.equal(stolen.status, "held");
  db.close();
});

// =============================================================================
// Error handling tests
// =============================================================================

test("Manager: createLockAdapter throws descriptive error for empty backend string", () => {
  assert.throws(
    () => createLockAdapter("" as "sqlite" | "pg_advisory" | "redis"),
    (error: unknown) => {
      const err = error as { code?: string };
      return err.code?.includes("lock.backend_not_supported");
    },
  );
});

test("Manager: SqliteLockAdapter release on closed database returns false", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1" });
  db.close();

  const released = adapter.release("test-lock", "owner-1");
  assert.equal(released, false);
});

test("Manager: SqliteLockAdapter extend on closed database returns null", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1" });
  db.close();

  const extended = adapter.extend("test-lock", "owner-1", 30000);
  assert.equal(extended, null);
});

test("Manager: SqliteLockAdapter inspect on closed database returns null", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1" });
  db.close();

  const inspected = adapter.inspect("test-lock");
  assert.equal(inspected, null);
});

// =============================================================================
// TTL behavior tests
// =============================================================================

test("Manager: SqliteLockAdapter uses default TTL when not specified", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result = adapter.acquire({ lockKey: "default-ttl", owner: "owner-1" });

  assert.equal(result.acquired, true);
  assert.equal(result.lock!.ttlMs, 30000);

  db.close();
});

test("Manager: SqliteLockAdapter respects custom TTL", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result = adapter.acquire({ lockKey: "custom-ttl", owner: "owner-1", ttlMs: 60000 });

  assert.equal(result.acquired, true);
  assert.equal(result.lock!.ttlMs, 60000);

  db.close();
});

test("Manager: SqliteLockAdapter treats zero TTL as infinite", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Manually insert a lock with ttl_ms = 0 (infinite)
  const pastTime = new Date(Date.now() - 60000).toISOString();
  db.prepare(`
    INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms)
    VALUES (?, ?, ?, 'held', ?, ?)
  `).run("infinite-lock", "dead-owner", 1, pastTime, 0);

  // Adapter should NOT evict this lock because ttl=0 means infinite
  const result = adapter.acquire({ lockKey: "infinite-lock", owner: "new-owner" });

  assert.equal(result.acquired, false);

  db.close();
});
