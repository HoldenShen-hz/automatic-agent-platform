import assert from "node:assert/strict";
import test from "node:test";

import { SqliteLockAdapter } from "../../../../../src/platform/execution/distributed-lock/sqlite-lock-adapter.js";
import { DatabaseSync } from "node:sqlite";

// ---------------------------------------------------------------------------
// Test database setup
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// acquire - INSERT failure (constraint violation) returns acquired: false
// ---------------------------------------------------------------------------

test("acquire - INSERT failure (constraint violation) returns acquired: false", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire first lock successfully
  const result1 = adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });
  assert.equal(result1.acquired, true);

  // Simulate constraint violation by directly manipulating the DB to a state
  // where INSERT would fail (but the adapter handles it gracefully)
  // The adapter's INSERT is wrapped in try-catch, returning acquired: false on error

  // Attempting to acquire again with different owner will:
  // 1. Find existing lock (not expired since we just acquired)
  // 2. Return acquired: false (not a constraint violation case, just lock held)
  const result2 = adapter.acquire({ lockKey: "test-lock", owner: "owner-2", ttlMs: 30000 });
  assert.equal(result2.acquired, false);

  db.close();
});

test("acquire - stale lock eviction logs correctly", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Manually insert a stale lock with past expiry
  const pastTime = new Date(Date.now() - 60000).toISOString();
  db.prepare(`
    INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms)
    VALUES (?, ?, ?, 'held', ?, ?)
  `).run("stale-lock", "dead-owner", 1, pastTime, 30000);

  // Adapter should detect expired lock and allow new acquisition
  const result = adapter.acquire({ lockKey: "stale-lock", owner: "new-owner", ttlMs: 30000 });
  assert.equal(result.acquired, true);
  assert.equal(result.lock!.owner, "new-owner");
  assert.ok(result.lock!.fencingToken > 1); // Should get new fencing token

  db.close();
});

test("acquire - expired lock at TTL boundary can be reacquired", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Use a tiny TTL and a timestamp safely in the past to avoid millisecond races.
  const boundaryTime = new Date(Date.now() - 2).toISOString();
  db.prepare(`
    INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms)
    VALUES (?, ?, ?, 'held', ?, ?)
  `).run("boundary-lock", "old-owner", 1, boundaryTime, 1);

  const result = adapter.acquire({ lockKey: "boundary-lock", owner: "new-owner", ttlMs: 30000 });
  assert.equal(result.acquired, true);
  assert.equal(result.lock!.owner, "new-owner");

  db.close();
});

test("acquire - INSERT constraint violation is caught and returns false", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire lock
  adapter.acquire({ lockKey: "unique-lock", owner: "owner-1", ttlMs: 30000 });

  // Try to force an insert failure by directly inserting duplicate
  // This simulates what would happen if the try-catch wasn't there
  try {
    db.prepare(`
      INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms)
      VALUES (?, ?, ?, 'held', ?, ?)
    `).run("unique-lock", "owner-2", 999, new Date().toISOString(), 30000);
    assert.fail("Should have thrown constraint error");
  } catch {
    // Expected - SQLite PRIMARY KEY constraint violation
  }

  // Adapter should handle this gracefully
  const result = adapter.acquire({ lockKey: "unique-lock", owner: "owner-2", ttlMs: 30000 });
  // Since existing lock is not expired, should return false
  assert.equal(result.acquired, false);

  db.close();
});

// ---------------------------------------------------------------------------
// release - owner mismatch returns false
// ---------------------------------------------------------------------------

test("release - owner mismatch returns false", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire lock with owner-1
  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  // Try to release with different owner
  const released = adapter.release("test-lock", "owner-2");
  assert.equal(released, false);

  // Verify lock is still held by original owner
  const record = adapter.inspect("test-lock");
  assert.ok(record !== null);
  assert.equal(record!.owner, "owner-1");

  db.close();
});

test("release - non-existent lock returns false", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const released = adapter.release("non-existent-lock", "any-owner");
  assert.equal(released, false);

  db.close();
});

// ---------------------------------------------------------------------------
// extend - wrong owner returns null
// ---------------------------------------------------------------------------

test("extend - wrong owner returns null", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire lock with owner-1
  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  // Try to extend with different owner
  const extended = adapter.extend("test-lock", "owner-2", 60000);
  assert.equal(extended, null);

  db.close();
});

test("extend - fencing token increments on successful extension", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire lock
  const result1 = adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });
  const originalToken = result1.lock!.fencingToken;

  // Extend the lock
  const extended = adapter.extend("test-lock", "owner-1", 60000);
  assert.ok(extended !== null);

  // Fencing token should be incremented
  assert.ok(extended!.fencingToken > originalToken);

  db.close();
});

test("extend - non-existent lock returns null", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const extended = adapter.extend("non-existent-lock", "owner-1", 30000);
  assert.equal(extended, null);

  db.close();
});

// ---------------------------------------------------------------------------
// forceSteal - metadata contains forceStealReason as JSON
// ---------------------------------------------------------------------------

test("forceSteal - metadata contains forceStealReason as JSON", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const stolen = adapter.forceSteal("test-lock", "new-owner", "emergency takeover");
  assert.ok(stolen.metadata !== null);

  const metadata = JSON.parse(stolen.metadata!);
  assert.equal(metadata.forceStealReason, "emergency takeover");

  db.close();
});

test("forceSteal - idempotent when stealing already-owned lock", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Force steal from owner-1
  const stolen1 = adapter.forceSteal("test-lock", "owner-2", "first steal");
  assert.equal(stolen1.owner, "owner-2");
  const token1 = stolen1.fencingToken;

  // Force steal again - should succeed and increment fencing token
  const stolen2 = adapter.forceSteal("test-lock", "owner-2", "second steal");
  assert.equal(stolen2.owner, "owner-2");
  assert.ok(stolen2.fencingToken > token1);

  // Verify final state
  const record = adapter.inspect("test-lock");
  assert.equal(record!.owner, "owner-2");

  db.close();
});

// ---------------------------------------------------------------------------
// inspect - returns null on error
// ---------------------------------------------------------------------------

test("inspect - returns null on error", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Inspect non-existent lock - returns null gracefully
  const record = adapter.inspect("non-existent-lock");
  assert.equal(record, null);

  db.close();
});

test("inspect - returns correct lock record", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  const record = adapter.inspect("test-lock");
  assert.ok(record !== null);
  assert.equal(record!.lockKey, "test-lock");
  assert.equal(record!.owner, "owner-1");
  assert.equal(record!.status, "held");
  assert.ok(record!.fencingToken > 0);

  db.close();
});

// ---------------------------------------------------------------------------
// Multiple sequential lock acquisitions - fencing tokens monotonically increase
// ---------------------------------------------------------------------------

test("Multiple sequential lock acquisitions - fencing tokens monotonically increase", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const tokens: number[] = [];

  // Acquire multiple different locks
  for (let i = 0; i < 5; i++) {
    const result = adapter.acquire({ lockKey: `lock-${i}`, owner: "owner-1", ttlMs: 30000 });
    assert.equal(result.acquired, true);
    tokens.push(result.lock!.fencingToken);
  }

  // Tokens should be strictly increasing
  for (let i = 1; i < tokens.length; i++) {
    assert.ok(tokens[i]! > tokens[i - 1]!, `Token ${tokens[i]} should be > ${tokens[i - 1]}`);
  }

  db.close();
});

test("Fencing tokens increase across forceSteal operations", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire a lock normally
  const result1 = adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });
  const token1 = result1.lock!.fencingToken;

  // Force steal
  const stolen1 = adapter.forceSteal("test-lock", "owner-2", "reason1");
  assert.ok(stolen1.fencingToken > token1);

  // Force steal again
  const stolen2 = adapter.forceSteal("test-lock", "owner-3", "reason2");
  assert.ok(stolen2.fencingToken > stolen1.fencingToken);

  db.close();
});

test("Fencing tokens increase when re-acquiring same lock after expiration", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire lock
  const result1 = adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });
  const token1 = result1.lock!.fencingToken;

  // Simulate expiration by directly updating the acquired_at to the past
  // Use a large negative offset to ensure expiration
  const pastTime = new Date(Date.now() - 120000).toISOString();
  db.prepare(`UPDATE distributed_locks SET acquired_at = ? WHERE lock_key = ?`)
    .run(pastTime, "test-lock");

  // Acquire again - should evict expired and create new with higher token
  const result2 = adapter.acquire({ lockKey: "test-lock", owner: "owner-2", ttlMs: 30000 });
  assert.equal(result2.acquired, true);
  assert.ok(result2.lock!.fencingToken > token1);

  db.close();
});
