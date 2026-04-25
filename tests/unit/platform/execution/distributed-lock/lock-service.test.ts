import assert from "node:assert/strict";
import test from "node:test";

import { SqliteLockAdapter } from "../../../../../src/platform/execution/distributed-lock/sqlite-lock-adapter.js";
import { DatabaseSync } from "node:sqlite";

// ---------------------------------------------------------------------------
// Test fixture
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
// Lock acquisition
// ---------------------------------------------------------------------------

test("SqliteLockAdapter: acquire locks a previously unlocked key", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result = adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 30_000 });

  assert.equal(result.acquired, true);
  assert.ok(result.lock);
  assert.equal(result.lock!.lockKey, "resource-1");
  assert.equal(result.lock!.owner, "owner-a");
  assert.ok(result.lock!.fencingToken > 0);

  db.close();
});

test("SqliteLockAdapter: acquire returns fencing token that increments", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const r1 = adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 30_000 });
  const r2 = adapter.acquire({ lockKey: "resource-2", owner: "owner-b", ttlMs: 30_000 });

  assert.ok(r1.lock!.fencingToken < r2.lock!.fencingToken);

  db.close();
});

test("SqliteLockAdapter: acquire sets status to 'held'", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result = adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 30_000 });

  assert.equal(result.lock!.status, "held");

  db.close();
});

test("SqliteLockAdapter: acquire stores correct ttlMs", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result = adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 60_000 });

  assert.equal(result.lock!.ttlMs, 60_000);

  db.close();
});

test("SqliteLockAdapter: acquire uses default ttlMs of 30000 when not provided", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result = adapter.acquire({ lockKey: "resource-1", owner: "owner-a" });

  assert.equal(result.lock!.ttlMs, 30_000);

  db.close();
});

test("SqliteLockAdapter: acquire sets acquiredAt timestamp", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const before = new Date().toISOString();
  const result = adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 30_000 });
  const after = new Date().toISOString();

  assert.ok(result.lock!.acquiredAt >= before);
  assert.ok(result.lock!.acquiredAt <= after);

  db.close();
});

// ---------------------------------------------------------------------------
// Lock release
// ---------------------------------------------------------------------------

test("SqliteLockAdapter: release returns true when lock is released", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 30_000 });
  const released = adapter.release("resource-1", "owner-a");

  assert.equal(released, true);

  db.close();
});

test("SqliteLockAdapter: release returns false when lock does not exist", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const released = adapter.release("non-existent-lock", "owner-a");

  assert.equal(released, false);

  db.close();
});

test("SqliteLockAdapter: release returns false when owner does not match", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 30_000 });
  const released = adapter.release("resource-1", "wrong-owner");

  assert.equal(released, false);

  db.close();
});

test("SqliteLockAdapter: after release, another owner can acquire lock", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 30_000 });
  adapter.release("resource-1", "owner-a");

  const result = adapter.acquire({ lockKey: "resource-1", owner: "owner-b", ttlMs: 30_000 });

  assert.equal(result.acquired, true);
  assert.equal(result.lock!.owner, "owner-b");

  db.close();
});

test("SqliteLockAdapter: release only deletes the matching lock key and owner", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 30_000 });
  adapter.acquire({ lockKey: "resource-2", owner: "owner-a", ttlMs: 30_000 });

  adapter.release("resource-1", "owner-a");

  const inspect1 = adapter.inspect("resource-1");
  const inspect2 = adapter.inspect("resource-2");

  assert.equal(inspect1, null);
  assert.ok(inspect2 !== null);

  db.close();
});

// ---------------------------------------------------------------------------
// Same-owner re-acquisition (lock renewal)
// ---------------------------------------------------------------------------

test("SqliteLockAdapter: same owner re-acquiring extends the lock", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 30_000 });
  const result = adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 60_000 });

  assert.equal(result.acquired, true);
  assert.equal(result.lock!.ttlMs, 60_000);

  db.close();
});

test("SqliteLockAdapter: same owner re-acquisition does not change fencing token", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const r1 = adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 30_000 });
  const r2 = adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 30_000 });

  assert.equal(r1.lock!.fencingToken, r2.lock!.fencingToken);

  db.close();
});

// ---------------------------------------------------------------------------
// Contention - different owner cannot acquire held lock
// ---------------------------------------------------------------------------

test("SqliteLockAdapter: different owner cannot acquire held lock", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 30_000 });
  const result = adapter.acquire({ lockKey: "resource-1", owner: "owner-b", ttlMs: 30_000 });

  assert.equal(result.acquired, false);
  assert.equal(result.lock, undefined);

  db.close();
});

test("SqliteLockAdapter: inspect returns null for non-existent lock", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result = adapter.inspect("non-existent-lock");

  assert.equal(result, null);

  db.close();
});

test("SqliteLockAdapter: inspect returns lock details for held lock", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 30_000 });
  const result = adapter.inspect("resource-1");

  assert.ok(result !== null);
  assert.equal(result!.lockKey, "resource-1");
  assert.equal(result!.owner, "owner-a");
  assert.equal(result!.status, "held");

  db.close();
});

// ---------------------------------------------------------------------------
// Deadlock prevention - stale lock eviction
// ---------------------------------------------------------------------------

test("SqliteLockAdapter: expired lock can be acquired by new owner", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Insert a lock that expired in the past (acquired_at far in the past + short ttl)
  const pastTime = new Date(Date.now() - 120_000).toISOString();
  db.prepare(`
    INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms)
    VALUES (?, ?, ?, 'held', ?, ?)
  `).run("stale-lock", "dead-owner", 1, pastTime, 10_000);

  // Adapter should detect expiration and allow takeover
  const result = adapter.acquire({ lockKey: "stale-lock", owner: "new-owner", ttlMs: 30_000 });

  assert.equal(result.acquired, true);
  assert.equal(result.lock!.owner, "new-owner");

  db.close();
});

test("SqliteLockAdapter: non-expired lock blocks new acquisition", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Insert a lock with future expiry (using a very long ttl and recent acquired_at)
  const recentTime = new Date(Date.now() - 5_000).toISOString();
  db.prepare(`
    INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms)
    VALUES (?, ?, ?, 'held', ?, ?)
  `).run("active-lock", "current-owner", 1, recentTime, 600_000);

  const result = adapter.acquire({ lockKey: "active-lock", owner: "new-owner", ttlMs: 30_000 });

  assert.equal(result.acquired, false);

  db.close();
});

test("SqliteLockAdapter: zero ttl means lock never expires", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Insert a lock with ttl_ms = 0 (infinite)
  const pastTime = new Date(Date.now() - 1_000_000).toISOString();
  db.prepare(`
    INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms)
    VALUES (?, ?, ?, 'held', ?, ?)
  `).run("infinite-lock", "owner-a", 1, pastTime, 0);

  // Should NOT be able to acquire because ttl=0 means never expires
  const result = adapter.acquire({ lockKey: "infinite-lock", owner: "owner-b", ttlMs: 30_000 });

  assert.equal(result.acquired, false);

  db.close();
});

test("SqliteLockAdapter: forceSteal allows takeover regardless of expiry", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 30_000 });

  const stolen = adapter.forceSteal("resource-1", "owner-b", "emergency intervention");

  assert.equal(stolen.owner, "owner-b");
  assert.equal(stolen.status, "held");

  db.close();
});

test("SqliteLockAdapter: forceSteal stores reason in metadata", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 30_000 });

  const stolen = adapter.forceSteal("resource-1", "owner-b", "admin override");

  assert.ok(stolen.metadata !== null);
  const metadata = JSON.parse(stolen.metadata);
  assert.equal(metadata.forceStealReason, "admin override");

  db.close();
});

test("SqliteLockAdapter: forceSteal increments fencing token", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const r1 = adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 30_000 });
  const stolen = adapter.forceSteal("resource-1", "owner-b", "takeover");

  assert.ok(stolen.fencingToken > r1.lock!.fencingToken);

  db.close();
});

// ---------------------------------------------------------------------------
// Lock timeout / TTL
// ---------------------------------------------------------------------------

test("SqliteLockAdapter: extend returns null for non-existent lock", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const extended = adapter.extend("non-existent-lock", "owner-a", 30_000);

  assert.equal(extended, null);

  db.close();
});

test("SqliteLockAdapter: extend updates ttl and increments fencing token", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 30_000 });
  const originalInspect = adapter.inspect("resource-1")!;

  const extended = adapter.extend("resource-1", "owner-a", 60_000);

  assert.ok(extended !== null);
  assert.ok(extended!.fencingToken > originalInspect.fencingToken);

  db.close();
});

test("SqliteLockAdapter: extend returns null when owner does not match", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 30_000 });
  const extended = adapter.extend("resource-1", "wrong-owner", 60_000);

  assert.equal(extended, null);

  db.close();
});

test("SqliteLockAdapter: backendKind is sqlite", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  assert.equal(adapter.backendKind, "sqlite");

  db.close();
});

test("SqliteLockAdapter: concurrent acquire of same key by different owner fails for second", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const first = adapter.acquire({ lockKey: "shared-resource", owner: "worker-1", ttlMs: 30_000 });
  assert.equal(first.acquired, true);

  // Simulate a second worker trying to acquire the same resource
  const second = adapter.acquire({ lockKey: "shared-resource", owner: "worker-2", ttlMs: 30_000 });
  assert.equal(second.acquired, false);

  db.close();
});

test("SqliteLockAdapter: multiple distinct keys can be held by different owners simultaneously", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const r1 = adapter.acquire({ lockKey: "resource-1", owner: "owner-a", ttlMs: 30_000 });
  const r2 = adapter.acquire({ lockKey: "resource-2", owner: "owner-b", ttlMs: 30_000 });
  const r3 = adapter.acquire({ lockKey: "resource-3", owner: "owner-c", ttlMs: 30_000 });

  assert.equal(r1.acquired, true);
  assert.equal(r2.acquired, true);
  assert.equal(r3.acquired, true);

  db.close();
});
