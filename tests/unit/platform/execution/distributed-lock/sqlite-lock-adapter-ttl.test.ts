import assert from "node:assert/strict";
import test from "node:test";

import { SqliteLockAdapter } from "../../../../../src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.js";
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
// Lock not expired (within TTL) - new owner rejected
// ---------------------------------------------------------------------------

test("Lock not expired (within TTL) - new owner rejected", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Owner-1 acquires lock with 30000ms TTL
  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  // Owner-2 tries to acquire immediately - should be rejected
  const result = adapter.acquire({ lockKey: "test-lock", owner: "owner-2", ttlMs: 30000 });
  assert.equal(result.acquired, false);

  // Verify original owner still has the lock
  const record = adapter.inspect("test-lock");
  assert.ok(record !== null);
  assert.equal(record!.owner, "owner-1");

  db.close();
});

// ---------------------------------------------------------------------------
// Lock expired (past TTL) - new owner can acquire
// ---------------------------------------------------------------------------

test("Lock expired (past TTL) - new owner can acquire", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Owner-1 acquires lock
  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  // Manually set acquired_at to the past (simulating TTL expiration)
  const pastTime = new Date(Date.now() - 60000).toISOString();
  db.prepare(`UPDATE distributed_locks SET acquired_at = ? WHERE lock_key = ?`)
    .run(pastTime, "test-lock");

  // Owner-2 acquires - should succeed
  const result = adapter.acquire({ lockKey: "test-lock", owner: "owner-2", ttlMs: 30000 });
  assert.equal(result.acquired, true);
  assert.equal(result.lock!.owner, "owner-2");

  db.close();
});

// ---------------------------------------------------------------------------
// TTL = 0 treated as no-expiry (infinite)
// ---------------------------------------------------------------------------

test("TTL = 0 treated as no-expiry (infinite)", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire with TTL = 0 (should be treated as infinite/no-expiry)
  const result = adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 0 });
  assert.equal(result.acquired, true);

  // Manually set acquired_at to very old
  const veryOldTime = new Date(Date.now() - 100000).toISOString();
  db.prepare(`UPDATE distributed_locks SET acquired_at = ? WHERE lock_key = ?`)
    .run(veryOldTime, "test-lock");

  // Another owner trying to acquire - should be rejected because TTL=0 means no expiry
  const result2 = adapter.acquire({ lockKey: "test-lock", owner: "owner-2", ttlMs: 0 });
  assert.equal(result2.acquired, false);

  db.close();
});

test("TTL = 0 stored correctly and does not cause division by zero", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire with TTL = 0
  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 0 });

  // Inspect should return the lock with ttlMs = 0
  const record = adapter.inspect("test-lock");
  assert.ok(record !== null);
  assert.equal(record!.ttlMs, 0);

  db.close();
});

// ---------------------------------------------------------------------------
// Very long TTL (> 1 year) handled correctly
// ---------------------------------------------------------------------------

test("Very long TTL (> 1 year) handled correctly", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // 2 years in milliseconds
  const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;

  const result = adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: twoYearsMs });
  assert.equal(result.acquired, true);
  assert.equal(result.lock!.ttlMs, 600_000);

  // Verify stored correctly
  const record = adapter.inspect("test-lock");
  assert.ok(record !== null);
  assert.equal(record!.ttlMs, 600_000);

  db.close();
});

test("Lock with long TTL is still honored within the TTL period", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire with very long TTL (1 year)
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: oneYearMs });

  // Another owner trying immediately should fail
  const result = adapter.acquire({ lockKey: "test-lock", owner: "owner-2", ttlMs: 30000 });
  assert.equal(result.acquired, false);

  db.close();
});

// ---------------------------------------------------------------------------
// Lock extended beyond original TTL
// ---------------------------------------------------------------------------

test("Lock extended beyond original TTL", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire with 30 second TTL
  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  // Extend by 60 seconds
  const extended = adapter.extend("test-lock", "owner-1", 60000);
  assert.ok(extended !== null);

  // The extend() updates ttl_ms = ttl_ms + additionalMs
  // We can verify the lock is still held by trying to acquire with another owner
  const result = adapter.acquire({ lockKey: "test-lock", owner: "owner-2", ttlMs: 30000 });
  assert.equal(result.acquired, false);

  db.close();
});

test("Extended lock can still be force stolen after extension", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire and extend
  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });
  adapter.extend("test-lock", "owner-1", 60000);

  // Force steal should work
  const stolen = adapter.forceSteal("test-lock", "owner-2", "emergency");
  assert.equal(stolen.owner, "owner-2");

  db.close();
});

// ---------------------------------------------------------------------------
// Force steal clears previous owner's TTL
// ---------------------------------------------------------------------------

test("Force steal clears previous owner's TTL", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Owner-1 acquires with short TTL
  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  // Force steal
  const stolen = adapter.forceSteal("test-lock", "owner-2", "takeover");
  assert.equal(stolen.owner, "owner-2");

  // Verify the new lock has default TTL (30000) and new timestamps
  const record = adapter.inspect("test-lock");
  assert.ok(record !== null);
  assert.equal(record!.owner, "owner-2");
  assert.equal(record!.ttlMs, 30000); // Default TTL from forceSteal

  // The previous owner's TTL should not affect the new owner
  db.close();
});

test("Force steal creates fresh TTL, ignoring previous expiration", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Owner-1 acquires with short TTL and then it expires
  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  // Simulate expiration
  const pastTime = new Date(Date.now() - 60000).toISOString();
  db.prepare(`UPDATE distributed_locks SET acquired_at = ? WHERE lock_key = ?`)
    .run(pastTime, "test-lock");

  // Force steal
  const stolen = adapter.forceSteal("test-lock", "owner-2", "takeover");
  assert.equal(stolen.owner, "owner-2");

  // Even though the old lock was "expired", force steal works
  // and creates a new lock with fresh timestamps
  const record = adapter.inspect("test-lock");
  assert.ok(record !== null);

  // The new acquired_at should be recent, not the old past time
  const acquiredTime = Date.parse(record!.acquiredAt);
  const now = Date.now();
  assert.ok(Math.abs(acquiredTime - now) < 5000, "acquiredAt should be recent");

  db.close();
});

// ---------------------------------------------------------------------------
// Additional TTL edge cases
// ---------------------------------------------------------------------------

test("Lock with TTL exactly at expiresAt boundary is considered expired", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Insert lock with acquired_at exactly at the expiration boundary
  // acquired_at + ttl_ms = Date.now() means it expired just now
  const exactExpiryTime = new Date(Date.now() - 30000).toISOString(); // 30000ms ago
  db.prepare(`
    INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms)
    VALUES (?, ?, ?, 'held', ?, ?)
  `).run("test-lock", "owner-1", 1, exactExpiryTime, 30000);

  // The condition is Date.now() < expiresAt
  // If Date.now() === expiresAt, then Date.now() < expiresAt is false, so expired
  const result = adapter.acquire({ lockKey: "test-lock", owner: "owner-2", ttlMs: 30000 });
  assert.equal(result.acquired, true);

  db.close();
});

test("Re-acquiring same owner extends TTL and refreshes fencing token", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Acquire with short TTL
  const result1 = adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 10000 });
  const token1 = result1.lock!.fencingToken;

  // Immediately re-acquire with same owner - should renew TTL
  const result2 = adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 60000 });
  assert.equal(result2.acquired, true);

  assert.ok(result2.lock!.fencingToken > token1);

  db.close();
});
