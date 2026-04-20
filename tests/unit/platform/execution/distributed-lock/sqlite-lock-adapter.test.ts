import assert from "node:assert/strict";
import test from "node:test";

import { SqliteLockAdapter } from "../../../../../src/platform/execution/distributed-lock/sqlite-lock-adapter.js";
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

test("SqliteLockAdapter.acquire acquires lock successfully", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result = adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  assert.equal(result.acquired, true);
  assert.ok(result.lock);
  assert.equal(result.lock!.lockKey, "test-lock");
  assert.equal(result.lock!.owner, "owner-1");
  assert.equal(result.lock!.status, "held");
  assert.ok(result.lock!.fencingToken > 0);

  db.close();
});

test("SqliteLockAdapter.acquire returns existing lock for same owner", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result1 = adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });
  assert.equal(result1.acquired, true);

  // Same owner can re-acquire (renew)
  const result2 = adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 60000 });
  assert.equal(result2.acquired, true);

  db.close();
});

test("SqliteLockAdapter.acquire rejects different owner when lock held", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  const result = adapter.acquire({ lockKey: "test-lock", owner: "owner-2", ttlMs: 30000 });
  assert.equal(result.acquired, false);

  db.close();
});

test("SqliteLockAdapter.release releases lock", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  const released = adapter.release("test-lock", "owner-1");
  assert.equal(released, true);

  // Lock can now be acquired by another owner
  const result = adapter.acquire({ lockKey: "test-lock", owner: "owner-2", ttlMs: 30000 });
  assert.equal(result.acquired, true);

  db.close();
});

test("SqliteLockAdapter.release returns false for non-existent lock", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const released = adapter.release("non-existent-lock", "owner-1");
  assert.equal(released, false);

  db.close();
});

test("SqliteLockAdapter.extend extends lock TTL", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  const extended = adapter.extend("test-lock", "owner-1", 60000);
  assert.ok(extended !== null);
  assert.equal(extended!.lockKey, "test-lock");

  db.close();
});

test("SqliteLockAdapter.extend returns null for non-existent lock", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const extended = adapter.extend("non-existent-lock", "owner-1", 30000);
  assert.equal(extended, null);

  db.close();
});

test("SqliteLockAdapter.inspect returns lock record", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  const record = adapter.inspect("test-lock");
  assert.ok(record !== null);
  assert.equal(record!.lockKey, "test-lock");
  assert.equal(record!.owner, "owner-1");
  assert.equal(record!.status, "held");

  db.close();
});

test("SqliteLockAdapter.inspect returns null for non-existent lock", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const record = adapter.inspect("non-existent-lock");
  assert.equal(record, null);

  db.close();
});

test("SqliteLockAdapter.forceSteal takes over lock", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 30000 });

  const stolen = adapter.forceSteal("test-lock", "owner-2", "emergency takeover");
  assert.ok(stolen);
  assert.equal(stolen.owner, "owner-2");
  assert.equal(stolen.status, "held");

  // Verify the new owner has the lock
  const record = adapter.inspect("test-lock");
  assert.equal(record!.owner, "owner-2");

  db.close();
});

test("SqliteLockAdapter.acquire honors TTL on stale locks", () => {
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

  db.close();
});

test("SqliteLockAdapter.backendKind is sqlite", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  assert.equal(adapter.backendKind, "sqlite");

  db.close();
});
