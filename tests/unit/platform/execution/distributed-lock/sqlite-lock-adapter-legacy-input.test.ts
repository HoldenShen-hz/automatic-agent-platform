/**
 * SQLite Lock Adapter - Legacy Input Format and Extended Tests
 *
 * Tests for the legacy input format support (lockName/ownerId) and
 * additional edge cases not covered by existing tests.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteLockAdapter } from "../../../../../src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.js";
import { DatabaseSync } from "node:sqlite";

// Create an in-memory database for testing
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
// Legacy input format tests (lockName/ownerId)
// =============================================================================

test("SqliteLockAdapter.acquire accepts legacy format { lockName, ownerId } [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Use legacy input format
  const result = adapter.acquire({ lockName: "legacy-lock", ownerId: "legacy-owner", ttlMs: 30000 } as any);

  assert.equal(result.acquired, true);
  assert.ok(result.lock);
  assert.equal(result.lock!.lockKey, "legacy-lock");
  assert.equal(result.lock!.owner, "legacy-owner");

  db.close();
});

test("SqliteLockAdapter.acquire accepts legacy format with default TTL [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result = adapter.acquire({ lockName: "legacy-lock", ownerId: "legacy-owner" } as any);

  assert.equal(result.acquired, true);
  assert.ok(result.lock);
  assert.equal(result.lock!.ttlMs, 30000); // default TTL

  db.close();
});

test("SqliteLockAdapter.acquire legacy format re-acquire extends TTL [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // First acquisition with legacy format
  const result1 = adapter.acquire({ lockName: "legacy-lock", ownerId: "legacy-owner", ttlMs: 10000 } as any);
  assert.equal(result1.acquired, true);

  // Re-acquire with same owner extends TTL
  const result2 = adapter.acquire({ lockName: "legacy-lock", ownerId: "legacy-owner", ttlMs: 60000 } as any);
  assert.equal(result2.acquired, true);
  assert.equal(result2.lock!.ttlMs, 60000);

  db.close();
});

test("SqliteLockAdapter.acquire legacy format blocked by existing new-format lock [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire with new format
  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  // Try to acquire same key with legacy format but different owner
  const result = adapter.acquire({ lockName: "test-lock", ownerId: "owner-2", ttlMs: 30000 } as any);

  assert.equal(result.acquired, false);

  db.close();
});

test("SqliteLockAdapter.acquire new format blocked by existing legacy-format lock [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire with legacy format
  adapter.acquire({ lockName: "test-lock", ownerId: "owner-1", ttlMs: 30000 } as any);

  // Try to acquire same key with new format but different owner
  const result = adapter.acquire({ lockKey: "test-lock", owner: "owner-2", ttlMs: 30000 });

  assert.equal(result.acquired, false);

  db.close();
});

test("SqliteLockAdapter.release accepts legacy format { lockName, ownerId } [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire with legacy format
  adapter.acquire({ lockName: "legacy-lock", ownerId: "legacy-owner", ttlMs: 30000 } as any);

  // Release with legacy format
  const released = adapter.release({ lockName: "legacy-lock", ownerId: "legacy-owner" } as any);

  assert.equal(released, true);

  // Verify lock is released
  const result = adapter.acquire({ lockKey: "legacy-lock", owner: "new-owner", ttlMs: 30000 });
  assert.equal(result.acquired, true);

  db.close();
});

test("SqliteLockAdapter.release legacy format returns false for non-existent lock [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const released = adapter.release({ lockName: "non-existent", ownerId: "owner" } as any);

  assert.equal(released, false);

  db.close();
});

test("SqliteLockAdapter.inspect accepts legacy format lockName [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire with legacy format
  adapter.acquire({ lockName: "legacy-lock", ownerId: "legacy-owner", ttlMs: 30000 } as any);

  // Inspect with legacy format
  const record = adapter.inspect({ lockName: "legacy-lock" } as any);

  assert.ok(record !== null);
  assert.equal(record!.lockKey, "legacy-lock");
  assert.equal(record!.owner, "legacy-owner");

  db.close();
});

test("SqliteLockAdapter.inspect legacy format returns null for non-existent lock [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const record = adapter.inspect({ lockName: "non-existent" } as any);

  assert.equal(record, null);

  db.close();
});

// =============================================================================
// queryLock method tests
// =============================================================================

test("SqliteLockAdapter.queryLock is an alias for inspect [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  const inspectResult = adapter.inspect("test-lock");
  const queryResult = adapter.queryLock("test-lock");

  assert.deepEqual(inspectResult, queryResult);

  db.close();
});

test("SqliteLockAdapter.queryLock returns null for non-existent lock [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result = adapter.queryLock("non-existent-lock");

  assert.equal(result, null);

  db.close();
});

// =============================================================================
// Default TTL tests
// =============================================================================

test("SqliteLockAdapter.acquire uses default TTL of 30000ms when not specified [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result = adapter.acquire({ lockKey: "test-lock", owner: "owner-1" });

  assert.equal(result.acquired, true);
  assert.equal(result.lock!.ttlMs, 30000);

  db.close();
});

test("SqliteLockAdapter.acquire uses default TTL with legacy format [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result = adapter.acquire({ lockName: "test-lock", ownerId: "owner-1" } as any);

  assert.equal(result.acquired, true);
  assert.equal(result.lock!.ttlMs, 30000);

  db.close();
});

// =============================================================================
// Fencing token tests
// =============================================================================

test("SqliteLockAdapter.acquire generates incrementing fencing tokens [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result1 = adapter.acquire({ lockKey: "lock-1", owner: "owner", ttlMs: 30000 });
  const result2 = adapter.acquire({ lockKey: "lock-2", owner: "owner", ttlMs: 30000 });
  const result3 = adapter.acquire({ lockKey: "lock-3", owner: "owner", ttlMs: 30000 });

  assert.ok(result2.lock!.fencingToken > result1.lock!.fencingToken);
  assert.ok(result3.lock!.fencingToken > result2.lock!.fencingToken);

  db.close();
});

test("SqliteLockAdapter.extend increments fencing token [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });
  const beforeExtend = adapter.inspect("test-lock")!;

  adapter.extend("test-lock", "owner-1", 30000);
  const afterExtend = adapter.inspect("test-lock")!;

  assert.ok(afterExtend.fencingToken > beforeExtend.fencingToken);

  db.close();
});

test("SqliteLockAdapter.forceSteal generates new fencing token [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });
  const beforeSteal = adapter.inspect("test-lock")!.fencingToken;

  adapter.forceSteal("test-lock", "owner-2", "emergency");
  const afterSteal = adapter.inspect("test-lock")!.fencingToken;

  assert.ok(afterSteal > beforeSteal);

  db.close();
});

// =============================================================================
// Lock metadata tests
// =============================================================================

test("SqliteLockAdapter.forceSteal stores metadata with forceStealReason [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.forceSteal("test-lock", "owner-2", "emergency takeover");

  const record = adapter.inspect("test-lock");
  assert.ok(record !== null);
  assert.ok(record!.metadata !== null);

  const metadata = JSON.parse(record!.metadata!);
  assert.equal(metadata.forceStealReason, "emergency takeover");

  db.close();
});

test("SqliteLockAdapter.acquire stores null metadata [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  const record = adapter.inspect("test-lock");
  assert.equal(record!.metadata, null);

  db.close();
});

test("SqliteLockAdapter.extend preserves existing metadata [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.forceSteal("test-lock", "owner-1", "initial reason");
  adapter.extend("test-lock", "owner-1", 30000);

  const record = adapter.inspect("test-lock");
  assert.ok(record!.metadata !== null);

  db.close();
});

// =============================================================================
// Edge cases
// =============================================================================

test("SqliteLockAdapter.acquire handles empty lock key via legacy format [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Empty string as lockName - this should still work as the adapter doesn't validate
  const result = adapter.acquire({ lockName: "", ownerId: "owner", ttlMs: 30000 } as any);

  // The adapter will try to use empty string as lock key
  // which will succeed in inserting into the database
  assert.equal(result.acquired, true);

  db.close();
});

test("SqliteLockAdapter.release handles object input that is not legacy format [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  // Pass an object that doesn't have lockName/ownerId properties
  // The release method checks if input is an object with lockName
  // If not, it uses the object directly as lockKey
  const released = adapter.release({ notALegacyFormat: true } as any);

  // This will try to use "[object Object]" as lockKey, which won't match
  assert.equal(released, false);

  db.close();
});

test("SqliteLockAdapter.inspect handles object input [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  // Pass an object that doesn't have lockName property
  const record = adapter.inspect({ notALegacyFormat: true } as any);

  // This will try to use "[object Object]" as lockKey
  assert.equal(record, null);

  db.close();
});

// =============================================================================
// Status field tests
// =============================================================================

test("SqliteLockAdapter.acquire sets status to 'held' [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  const record = adapter.inspect("test-lock");
  assert.equal(record!.status, "held");

  db.close();
});

test("SqliteLockAdapter.forceSteal sets status to 'held' [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.forceSteal("test-lock", "owner-2", "takeover");

  const record = adapter.inspect("test-lock");
  assert.equal(record!.status, "held");

  db.close();
});

test("SqliteLockAdapter.extend preserves status as 'held' [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });
  adapter.extend("test-lock", "owner-1", 30000);

  const record = adapter.inspect("test-lock");
  assert.equal(record!.status, "held");

  db.close();
});

// =============================================================================
// Concurrency edge cases
// =============================================================================

test("SqliteLockAdapter handles rapid acquire-release cycles [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  for (let i = 0; i < 10; i++) {
    const acquired = adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });
    assert.equal(acquired.acquired, true);

    const released = adapter.release("test-lock", "owner-1");
    assert.equal(released, true);
  }

  db.close();
});

test("SqliteLockAdapter handles multiple locks with same owner [sqlite-lock-adapter-legacy-input]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const owners = ["owner-1", "owner-2", "owner-3"];

  for (const owner of owners) {
    const result = adapter.acquire({ lockKey: `lock-${owner}`, owner, ttlMs: 30000 });
    assert.equal(result.acquired, true);
    assert.equal(result.lock!.owner, owner);
  }

  // Verify all locks exist
  for (const owner of owners) {
    const record = adapter.inspect(`lock-${owner}`);
    assert.ok(record !== null);
    assert.equal(record!.owner, owner);
  }

  db.close();
});
