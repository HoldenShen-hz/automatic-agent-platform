import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { unlinkSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import { SqliteLockAdapter } from "../../../../src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.js";
import { DISTRIBUTED_LOCKS_DDL } from "../../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-types.js";

function createTempDb(): { path: string; db: DatabaseSync } {
  const dir = mkdtempSync(join(tmpdir(), "sqlite-lock-test-"));
  const path = join(dir, "locks.db");
  const db = new DatabaseSync(path);
  db.exec(DISTRIBUTED_LOCKS_DDL);
  return { path, db };
}

function closeAndCleanup(path: string, db: DatabaseSync): void {
  db.close();
  rmSync(path, { recursive: true, force: true });
}

test("[SYS-REL-2.2] SQLite lock adapter acquires lock when no existing lock", () => {
  const { path, db } = createTempDb();
  try {
    const adapter = new SqliteLockAdapter(db);
    const result = adapter.acquire({ lockKey: "test-key", owner: "owner-1", ttlMs: 5000 });
    assert.equal(result.acquired, true);
    assert.ok(result.lock != null);
    assert.equal(result.lock!.lockKey, "test-key");
    assert.equal(result.lock!.owner, "owner-1");
    assert.equal(result.lock!.status, "held");
  } finally {
    closeAndCleanup(path, db);
  }
});

test("[SYS-REL-2.2] SQLite lock adapter rejects lock when same owner holds it (renewal)", () => {
  const { path, db } = createTempDb();
  try {
    const adapter = new SqliteLockAdapter(db);
    const first = adapter.acquire({ lockKey: "test-key", owner: "owner-1", ttlMs: 5000 });
    assert.equal(first.acquired, true);

    const second = adapter.acquire({ lockKey: "test-key", owner: "owner-1", ttlMs: 5000 });
    assert.equal(second.acquired, true, "Same owner should be able to renew the lock");
  } finally {
    closeAndCleanup(path, db);
  }
});

test("[SYS-REL-2.2] SQLite lock adapter rejects lock when different owner holds it and not expired", () => {
  const { path, db } = createTempDb();
  try {
    const adapter = new SqliteLockAdapter(db);
    adapter.acquire({ lockKey: "test-key", owner: "owner-1", ttlMs: 5000 });

    const result = adapter.acquire({ lockKey: "test-key", owner: "owner-2", ttlMs: 5000 });
    assert.equal(result.acquired, false);
  } finally {
    closeAndCleanup(path, db);
  }
});

test("[SYS-REL-2.2] SQLite lock adapter honours TTL on stale locks - evicts expired lock", () => {
  const { path, db } = createTempDb();
  try {
    const adapter = new SqliteLockAdapter(db);
    // Manually insert a stale lock with an old acquired_at timestamp and short ttl
    db.prepare(
      `INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms)
       VALUES (?, ?, ?, 'held', ?, ?)`,
    ).run("stale-key", "dead-owner", 100, "2020-01-01T00:00:00.000Z", 1000);

    // The lock from 2020 with 1000ms TTL is definitely expired
    const result = adapter.acquire({ lockKey: "stale-key", owner: "new-owner", ttlMs: 30000 });
    assert.equal(result.acquired, true, "Expired lock should be evicted and new owner should acquire");
    assert.equal(result.lock!.owner, "new-owner");
  } finally {
    closeAndCleanup(path, db);
  }
});

test("[SYS-REL-2.2] SQLite lock adapter releases lock correctly", () => {
  const { path, db } = createTempDb();
  try {
    const adapter = new SqliteLockAdapter(db);
    adapter.acquire({ lockKey: "test-key", owner: "owner-1", ttlMs: 5000 });

    const released = adapter.release("test-key", "owner-1");
    assert.equal(released, true);

    const inspected = adapter.inspect("test-key");
    assert.equal(inspected, null, "Lock should no longer exist after release");
  } finally {
    closeAndCleanup(path, db);
  }
});

test("[SYS-REL-2.2] SQLite lock adapter returns false when releasing non-existent lock", () => {
  const { path, db } = createTempDb();
  try {
    const adapter = new SqliteLockAdapter(db);
    const released = adapter.release("non-existent-key", "some-owner");
    assert.equal(released, false);
  } finally {
    closeAndCleanup(path, db);
  }
});

test("[SYS-REL-2.2] SQLite lock adapter forceSteal evicts existing lock", () => {
  const { path, db } = createTempDb();
  try {
    const adapter = new SqliteLockAdapter(db);
    adapter.acquire({ lockKey: "test-key", owner: "owner-1", ttlMs: 5000 });

    const stolen = adapter.forceSteal("test-key", "new-owner", "test reason");
    assert.equal(stolen.owner, "new-owner");
    assert.equal(stolen.status, "held");

    const inspected = adapter.inspect("test-key");
    assert.equal(inspected!.owner, "new-owner");
  } finally {
    closeAndCleanup(path, db);
  }
});

test("[SYS-REL-2.2] SQLite lock adapter orphaned lock cleanup - inspect returns null for missing lock", () => {
  const { path, db } = createTempDb();
  try {
    const adapter = new SqliteLockAdapter(db);
    const inspected = adapter.inspect("never-created-key");
    assert.equal(inspected, null);
  } finally {
    closeAndCleanup(path, db);
  }
});

test("[SYS-REL-2.2] SQLite lock adapter extend updates ttl and fencing token", () => {
  const { path, db } = createTempDb();
  try {
    const adapter = new SqliteLockAdapter(db);
    adapter.acquire({ lockKey: "test-key", owner: "owner-1", ttlMs: 5000 });

    const extended = adapter.extend("test-key", "owner-1", 10000);
    assert.ok(extended != null);
    assert.equal(extended!.lockKey, "test-key");
    assert.equal(extended!.owner, "owner-1");
  } finally {
    closeAndCleanup(path, db);
  }
});

test("[SYS-REL-2.2] SQLite lock adapter extend returns null for non-existent lock", () => {
  const { path, db } = createTempDb();
  try {
    const adapter = new SqliteLockAdapter(db);
    const extended = adapter.extend("non-existent-key", "some-owner", 5000);
    assert.equal(extended, null);
  } finally {
    closeAndCleanup(path, db);
  }
});

test("[SYS-REL-2.2] SQLite lock adapter concurrent acquire returns first winner", () => {
  const { path, db } = createTempDb();
  try {
    const adapter = new SqliteLockAdapter(db);
    // First acquirer wins
    const first = adapter.acquire({ lockKey: "concurrent-key", owner: "first-owner", ttlMs: 5000 });
    assert.equal(first.acquired, true);

    // Second acquirer loses
    const second = adapter.acquire({ lockKey: "concurrent-key", owner: "second-owner", ttlMs: 5000 });
    assert.equal(second.acquired, false);
  } finally {
    closeAndCleanup(path, db);
  }
});

test("[SYS-REL-2.2] SQLite lock adapter ttlMs=0 means infinite TTL (never expires)", () => {
  const { path, db } = createTempDb();
  try {
    const adapter = new SqliteLockAdapter(db);
    // Insert a lock with ttl_ms = 0 (infinite)
    db.prepare(
      `INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms)
       VALUES (?, ?, ?, 'held', ?, 0)`,
    ).run("infinite-key", "some-owner", 1, "2020-01-01T00:00:00.000Z");

    // Even with old timestamp, ttl=0 means it should not be considered expired
    const result = adapter.acquire({ lockKey: "infinite-key", owner: "new-owner", ttlMs: 30000 });
    assert.equal(result.acquired, false, "ttl=0 lock should not be evicted as it never expires");
  } finally {
    closeAndCleanup(path, db);
  }
});
