/**
 * Additional distributed-lock coverage tests
 *
 * Tests to increase code coverage for edge cases and untested scenarios
 * in the distributed-lock directory.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { SqliteLockAdapter } from "../../../../../src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.js";
import {
  DISTRIBUTED_LOCKS_DDL,
  type DistributedLockAdapter,
  type LockBackendKind,
} from "../../../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-types.js";
import * as DistributedLock from "../../../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-service.js";

// =============================================================================
// SqliteLockAdapter edge case tests
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

test("SqliteLockAdapter handles zero TTL as infinite expiry [distributed-lock-coverage]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire with zero TTL (infinite)
  const result = adapter.acquire({ lockKey: "infinite-lock", owner: "owner", ttlMs: 0 });
  assert.equal(result.acquired, true);
  assert.equal(result.lock!.ttlMs, 0);

  // Another owner should still be blocked because zero TTL means infinite
  const result2 = adapter.acquire({ lockKey: "infinite-lock", owner: "other-owner", ttlMs: 5000 });
  assert.equal(result2.acquired, false);

  db.close();
});

test("SqliteLockAdapter release returns false when owner does not match [distributed-lock-coverage]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  // Try to release with different owner
  const released = adapter.release("test-lock", "wrong-owner");
  assert.equal(released, false);

  // Original owner can still release
  const originalRelease = adapter.release("test-lock", "owner-1");
  assert.equal(originalRelease, true);

  db.close();
});

test("SqliteLockAdapter extend returns null when owner does not match [distributed-lock-coverage]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  const extended = adapter.extend("test-lock", "wrong-owner", 30000);
  assert.equal(extended, null);

  db.close();
});

test("SqliteLockAdapter extend increments fencing token [distributed-lock-coverage]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });
  const initialToken = adapter.inspect("test-lock")!.fencingToken;

  adapter.extend("test-lock", "owner-1", 30000);
  const newToken = adapter.inspect("test-lock")!.fencingToken;

  assert.ok(newToken > initialToken);

  db.close();
});

test("SqliteLockAdapter forceSteal replaces existing lock [distributed-lock-coverage]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  const stolen = adapter.forceSteal("test-lock", "owner-2", "test reason");
  assert.equal(stolen.owner, "owner-2");
  assert.ok(stolen.fencingToken > 0);
  assert.ok(stolen.metadata !== null);

  db.close();
});

test("SqliteLockAdapter forceSteal creates lock if not exists [distributed-lock-coverage]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Force steal a non-existent lock should create it
  const stolen = adapter.forceSteal("new-lock", "new-owner", "creating lock");
  assert.equal(stolen.owner, "new-owner");
  assert.equal(stolen.lockKey, "new-lock");

  db.close();
});

test("SqliteLockAdapter inspect returns correct metadata [distributed-lock-coverage]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  const record = adapter.inspect("test-lock");
  assert.equal(record!.metadata, null);

  db.close();
});

test("SqliteLockAdapter acquire issues a fresh fencing token after expired lock eviction [distributed-lock-coverage]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Manually insert an expired lock with a high fencing token
  const pastTime = new Date(Date.now() - 60000).toISOString();
  db.prepare(`
    INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms)
    VALUES (?, ?, ?, 'held', ?, ?)
  `).run("stale-lock", "dead-owner", 999, pastTime, 30000);

  // Expired-row eviction does not backfill the AUTOINCREMENT table from stale rows;
  // the runtime only guarantees a fresh positive token from its fencing table.
  const result = adapter.acquire({ lockKey: "stale-lock", owner: "new-owner", ttlMs: 30000 });
  assert.equal(result.acquired, true);
  assert.ok(result.lock!.fencingToken > 0);

  db.close();
});

// Note: SqliteLockAdapter constructor requires the table to exist, so we cannot test
// database error during acquire with a missing table (it would fail in constructor).
// The error handling for release, extend, inspect, and forceSteal is tested above.

test("SqliteLockAdapter handles database error on release [distributed-lock-coverage]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  // Drop table to cause error
  db.exec("DROP TABLE distributed_locks");

  const released = adapter.release("test-lock", "owner-1");
  assert.equal(released, false);
});

test("SqliteLockAdapter handles database error on extend [distributed-lock-coverage]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  // Drop table to cause error
  db.exec("DROP TABLE distributed_locks");

  const extended = adapter.extend("test-lock", "owner-1", 30000);
  assert.equal(extended, null);
});

test("SqliteLockAdapter handles database error on inspect [distributed-lock-coverage]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  // Drop table to cause error
  db.exec("DROP TABLE distributed_locks");

  const record = adapter.inspect("test-lock");
  assert.equal(record, null);
});

test("SqliteLockAdapter handles database error on forceSteal [distributed-lock-coverage]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Drop table to cause error
  db.exec("DROP TABLE distributed_locks");

  assert.throws(
    () => adapter.forceSteal("test-lock", "new-owner", "reason"),
    (error: unknown) => (error as any)?.code === "E7lock.force_steal_failed",
  );
});

// =============================================================================
// DistributedLockAdapter interface tests
// =============================================================================

test("DistributedLockAdapter interface requires backendKind property [distributed-lock-coverage]", () => {
  const mockAdapter: DistributedLockAdapter = {
    backendKind: "sqlite",
    acquire: () => ({ acquired: false }),
    release: () => false,
    extend: () => null,
    forceSteal: () => ({ lockKey: "", owner: "", fencingToken: 0, status: "held", acquiredAt: "", ttlMs: 0, metadata: null }),
    inspect: () => null,
  };

  assert.equal(mockAdapter.backendKind, "sqlite");
});

test("LockBackendKind accepts all valid string literals [distributed-lock-coverage]", () => {
  const kinds: LockBackendKind[] = ["sqlite", "pg_advisory", "redis"];
  assert.equal(kinds.length, 3);
});

// =============================================================================
// DISTRIBUTED_LOCKS_DDL tests
// =============================================================================

test("DISTRIBUTED_LOCKS_DDL creates valid SQL [distributed-lock-coverage]", () => {
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("CREATE TABLE"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("distributed_locks"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("lock_key"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("owner"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("fencing_token"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("status"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("acquired_at"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("ttl_ms"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("metadata"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("version"));
});

test("DISTRIBUTED_LOCKS_DDL can be executed on in-memory database [distributed-lock-coverage]", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(DISTRIBUTED_LOCKS_DDL);

  // Verify table exists
  const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='distributed_locks'").get();
  assert.ok(result);

  db.close();
});

// =============================================================================
// Index exports tests
// =============================================================================

// Note: TypeScript interfaces (DistributedLockAdapter, LockRecord, etc.) are
// compile-time constructs and are not exported as runtime values.
// We test the actual runtime exports below.

test("Index exports DISTRIBUTED_LOCKS_DDL constant [distributed-lock-coverage]", () => {
  assert.ok(DistributedLock.DISTRIBUTED_LOCKS_DDL);
  assert.equal(typeof DistributedLock.DISTRIBUTED_LOCKS_DDL, "string");
});

test("Index exports lockLogger [distributed-lock-coverage]", () => {
  assert.ok(DistributedLock.lockLogger);
});

test("Index exports defaultPostgresFactory [distributed-lock-coverage]", () => {
  assert.ok(DistributedLock.defaultPostgresFactory);
  assert.equal(typeof DistributedLock.defaultPostgresFactory, "function");
});

test("Index exports inferPgSslFromDsn [distributed-lock-coverage]", () => {
  assert.ok(DistributedLock.inferPgSslFromDsn);
  assert.equal(typeof DistributedLock.inferPgSslFromDsn, "function");
});

test("Index exports SqliteLockAdapter [distributed-lock-coverage]", () => {
  assert.ok(DistributedLock.SqliteLockAdapter);
});

test("Index exports PgAdvisoryLockAdapter [distributed-lock-coverage]", () => {
  assert.ok(DistributedLock.PgAdvisoryLockAdapter);
});

test("Index exports RedisLockAdapter [distributed-lock-coverage]", () => {
  assert.ok(DistributedLock.RedisLockAdapter);
});

test("Index exports createLockAdapter function [distributed-lock-coverage]", () => {
  assert.ok(DistributedLock.createLockAdapter);
  assert.equal(typeof DistributedLock.createLockAdapter, "function");
});

// =============================================================================
// inferPgSslFromDsn edge case tests
// =============================================================================

test("inferPgSslFromDsn handles url with multiple query params [distributed-lock-coverage]", () => {
  const result = DistributedLock.inferPgSslFromDsn("postgres://user:pass@host/db?foo=bar&sslmode=require&baz=qux");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn handles url with port and query params [distributed-lock-coverage]", () => {
  const result = DistributedLock.inferPgSslFromDsn("postgres://user:pass@host:5432/db?sslmode=require");
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn returns null for sslmode=verify-full [distributed-lock-coverage]", () => {
  // verify-full is not 'require', so returns null
  const result = DistributedLock.inferPgSslFromDsn("postgres://user:pass@host/db?sslmode=verify-full");
  assert.equal(result, null);
});

test("inferPgSslFromDsn handles whitespace in sslmode value [distributed-lock-coverage]", () => {
  const result = DistributedLock.inferPgSslFromDsn("postgres://user:pass@host/db?sslmode=%20require%20");
  // URL decoded value should be " require " which trims to "require"
  assert.deepEqual(result, { rejectUnauthorized: true });
});

test("inferPgSslFromDsn returns null for empty sslmode value [distributed-lock-coverage]", () => {
  const result = DistributedLock.inferPgSslFromDsn("postgres://user:pass@host/db?sslmode=");
  // Empty string after trimming is falsy, so returns null
  assert.equal(result, null);
});

// =============================================================================
// defaultPostgresFactory edge case tests
// =============================================================================

test("defaultPostgresFactory returns function that can be called with different DSNs [distributed-lock-coverage]", () => {
  const factory = DistributedLock.defaultPostgresFactory;

  // Multiple calls should return separate drivers
  const driver1 = factory("postgres://localhost/db1", { max: 1 });
  const driver2 = factory("postgres://localhost/db2", { max: 1 });

  assert.equal(typeof driver1, "function");
  assert.equal(typeof driver2, "function");
  assert.notEqual(driver1, driver2);
});
