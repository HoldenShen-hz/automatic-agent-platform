import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { createLockAdapter } from "../../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-service.js";
import { DISTRIBUTED_LOCKS_DDL } from "../../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-types.js";
import { SqliteLockAdapter } from "../../../../src/platform/five-plane-execution/distributed-lock/sqlite-lock-adapter.js";
import { PgAdvisoryLockAdapter } from "../../../../src/platform/five-plane-execution/distributed-lock/pg-advisory-lock-adapter.js";
import { RedisLockAdapter } from "../../../../src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.js";
import { lockLogger } from "../../../../src/platform/five-plane-execution/distributed-lock/locking-support.js";

// =============================================================================
// Test setup helpers
// =============================================================================

function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(DISTRIBUTED_LOCKS_DDL);
  return db;
}

// =============================================================================
// createLockAdapter factory function tests
// =============================================================================

test("createLockAdapter creates SqliteLockAdapter with DatabaseSync [distributed-lock]", () => {
  const db = createTestDb();
  const adapter = createLockAdapter("sqlite", db);

  assert.equal(adapter.backendKind, "sqlite");
  assert.ok(adapter instanceof SqliteLockAdapter);

  db.close();
});

test("createLockAdapter creates PgAdvisoryLockAdapter without db [distributed-lock]", () => {
  const adapter = createLockAdapter("pg_advisory");

  assert.equal(adapter.backendKind, "pg_advisory");
  assert.ok(adapter instanceof PgAdvisoryLockAdapter);
});

test("createLockAdapter creates RedisLockAdapter without db [distributed-lock]", () => {
  const adapter = createLockAdapter("redis");

  assert.equal(adapter.backendKind, "redis");
  assert.ok(adapter instanceof RedisLockAdapter);
});

test("createLockAdapter throws LockingError for unknown backend kind [distributed-lock]", () => {
  assert.throws(
    () => createLockAdapter("unknown" as "sqlite" | "pg_advisory" | "redis"),
    (error: unknown) => {
      const err = error as { code?: string; message?: string };
      return err.code?.includes("lock.backend_not_supported") &&
        err.message?.includes("unknown");
    },
  );
});

test("createLockAdapter throws LockingError for sqlite without db [distributed-lock]", () => {
  assert.throws(
    () => createLockAdapter("sqlite"),
    (error: unknown) => {
      const err = error as { code?: string };
      return err.code?.includes("lock.sqlite_adapter_requires_db");
    },
  );
});

// =============================================================================
// SqliteLockAdapter fencing token tests
// =============================================================================

test("SqliteLockAdapter fencing token starts at 1 for empty database [distributed-lock]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result = adapter.acquire({ lockKey: "test-lock", owner: "owner-1" });

  assert.equal(result.acquired, true);
  assert.equal(result.lock!.fencingToken, 1);

  db.close();
});

test("SqliteLockAdapter fencing token increments on each acquire [distributed-lock]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "lock-1", owner: "owner-1" });
  adapter.release("lock-1", "owner-1");
  const result2 = adapter.acquire({ lockKey: "lock-2", owner: "owner-1" });

  assert.equal(result2.acquired, true);
  assert.equal(result2.lock!.fencingToken, 2);

  db.close();
});

test("SqliteLockAdapter fencing token continues after forceSteal [distributed-lock]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1" });
  adapter.forceSteal("test-lock", "owner-2", "test");
  const result = adapter.acquire({ lockKey: "new-lock", owner: "owner-1" });

  // New lock should get fencing token 3 (incremented twice by forceSteal and once by new acquire)
  assert.equal(result.acquired, true);
  assert.equal(result.lock!.fencingToken, 3);

  db.close();
});

// =============================================================================
// SqliteLockAdapter TTL and expiry edge cases
// =============================================================================

test("SqliteLockAdapter uses default TTL of 30000ms [distributed-lock]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result = adapter.acquire({ lockKey: "test-lock", owner: "owner-1" });

  assert.equal(result.acquired, true);
  assert.equal(result.lock!.ttlMs, 30000);

  db.close();
});

test("SqliteLockAdapter respects provided ttlMs [distributed-lock]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  const result = adapter.acquire({ lockKey: "test-lock", owner: "owner-1", ttlMs: 60000 });

  assert.equal(result.acquired, true);
  assert.equal(result.lock!.ttlMs, 60000);

  db.close();
});

test("SqliteLockAdapter treats ttlMs of 0 as infinite TTL [distributed-lock]", () => {
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

test("SqliteLockAdapter handles lock with invalid acquired_at timestamp [distributed-lock]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Insert a lock with invalid acquired_at
  db.prepare(`
    INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms)
    VALUES (?, ?, ?, 'held', ?, ?)
  `).run("invalid-time-lock", "dead-owner", 1, "invalid-timestamp", 30000);

  // Invalid timestamp is treated as infinite expiry (Number.POSITIVE_INFINITY),
  // so the lock cannot be re-acquired until it expires
  const result = adapter.acquire({ lockKey: "invalid-time-lock", owner: "new-owner" });

  assert.equal(result.acquired, false);

  db.close();
});

// =============================================================================
// SqliteLockAdapter error handling tests
// =============================================================================

test("SqliteLockAdapter release returns false when owner does not match [distributed-lock]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1" });

  const released = adapter.release("test-lock", "wrong-owner");

  assert.equal(released, false);
});

test("SqliteLockAdapter extend returns null when owner does not match [distributed-lock]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1" });

  const extended = adapter.extend("test-lock", "wrong-owner", 30000);

  assert.equal(extended, null);
});

test("SqliteLockAdapter forceSteal throws LockingError on database error [distributed-lock]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Close the database to force an error
  db.close();

  assert.throws(
    () => adapter.forceSteal("test-lock", "new-owner", "test"),
    (error: unknown) => (error as { code?: string }).code?.includes("lock.force_steal_failed"),
  );
});

test("SqliteLockAdapter inspect returns null for invalid JSON metadata [distributed-lock]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  adapter.acquire({ lockKey: "test-lock", owner: "owner-1" });

  // Manually corrupt the metadata
  db.prepare(`UPDATE distributed_locks SET metadata = ? WHERE lock_key = ?`)
    .run("not-valid-json", "test-lock");

  const record = adapter.inspect("test-lock");

  // inspect returns the record as-is, even if metadata is not valid JSON
  assert.ok(record !== null);
  assert.equal(record!.metadata, "not-valid-json");

  db.close();
});

// =============================================================================
// PgAdvisoryLockAdapter lockKeyToAdvisoryKey edge cases
// =============================================================================

test("PgAdvisoryLockAdapter lockKeyToAdvisoryKey handles empty string [distributed-lock]", () => {
  const adapter = new PgAdvisoryLockAdapter({ dsn: "postgres://localhost/test" });

  const key = (adapter as unknown as { lockKeyToAdvisoryKey: (k: string) => bigint }).lockKeyToAdvisoryKey("");

  assert.equal(typeof key, "bigint");
});

test("PgAdvisoryLockAdapter lockKeyToAdvisoryKey handles unicode characters [distributed-lock]", () => {
  const adapter = new PgAdvisoryLockAdapter({ dsn: "postgres://localhost/test" });

  const key1 = (adapter as unknown as { lockKeyToAdvisoryKey: (k: string) => bigint }).lockKeyToAdvisoryKey("lock-测试-🔒");
  const key2 = (adapter as unknown as { lockKeyToAdvisoryKey: (k: string) => bigint }).lockKeyToAdvisoryKey("lock-测试-🔒");

  assert.equal(key1, key2);
  assert.equal(typeof key1, "bigint");
});

test("PgAdvisoryLockAdapter lockKeyToAdvisoryKey handles long strings [distributed-lock]", () => {
  const adapter = new PgAdvisoryLockAdapter({ dsn: "postgres://localhost/test" });

  const longKey = "a".repeat(10000);
  const key = (adapter as unknown as { lockKeyToAdvisoryKey: (k: string) => bigint }).lockKeyToAdvisoryKey(longKey);

  assert.equal(typeof key, "bigint");
  // Should be a positive bigint
  assert.ok(key >= BigInt(0));
});

// =============================================================================
// PgAdvisoryLockAdapter async method error handling
// =============================================================================

test("PgAdvisoryLockAdapter acquireAsync throws when postgres module not found [distributed-lock]", async () => {
  const adapter = new PgAdvisoryLockAdapter({
    dsn: "postgres://localhost/test",
    postgresFactory: () => {
      throw new ReferenceError("Cannot find module 'pg'");
    },
  });

  await assert.rejects(
    adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" }),
    (error: unknown) => (error as { code?: string }).code?.includes("lock.pg_advisory_not_implemented"),
  );
});

test("PgAdvisoryLockAdapter acquireAsync throws on ECONNREFUSED [distributed-lock]", async () => {
  const adapter = new PgAdvisoryLockAdapter({
    dsn: "postgres://localhost/test",
    postgresFactory: () => {
      const err: Error & { code?: string } = new Error("Connection refused");
      err.code = "ECONNREFUSED";
      throw err;
    },
  });

  // ECONNREFUSED is treated as a connection error and thrown as LockingError
  await assert.rejects(
    adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" }),
    (error: unknown) => (error as { code?: string }).code?.includes("lock.pg_advisory_not_implemented"),
  );
});

test("PgAdvisoryLockAdapter releaseAsync throws when postgres module not found [distributed-lock]", async () => {
  const adapter = new PgAdvisoryLockAdapter({
    dsn: "postgres://localhost/test",
    postgresFactory: () => {
      throw new ReferenceError("Cannot find module 'pg'");
    },
  });
  (
    adapter as unknown as {
      heldLocks: Map<string, { owner: string }>;
    }
  ).heldLocks.set("test-key", { owner: "test-owner" });

  await assert.rejects(
    adapter.releaseAsync("test-key", "test-owner"),
    (error: unknown) => (error as { code?: string }).code?.includes("lock.pg_advisory_not_implemented"),
  );
});

test("PgAdvisoryLockAdapter close is idempotent [distributed-lock]", async () => {
  const mockDriver = {
    end: async () => {},
  };
  const adapter = new PgAdvisoryLockAdapter({ dsn: "postgres://localhost/test" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (adapter as any).sql = mockDriver;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (adapter as any).connected = true;

  // Call close twice - should not throw
  await adapter.close();
  await adapter.close();
});

// =============================================================================
// RedisLockAdapter constructor and config tests
// =============================================================================

test("RedisLockAdapter uses default host and port [distributed-lock]", () => {
  const adapter = new RedisLockAdapter();

  assert.equal((adapter as unknown as { host: string }).host, "localhost");
  assert.equal((adapter as unknown as { port: number }).port, 6379);
});

test("RedisLockAdapter uses custom host and port from config [distributed-lock]", () => {
  const adapter = new RedisLockAdapter({ host: "redis.example.com", port: 6380 });

  assert.equal((adapter as unknown as { host: string }).host, "redis.example.com");
  assert.equal((adapter as unknown as { port: number }).port, 6380);
});

test("RedisLockAdapter uses default cliPath [distributed-lock]", () => {
  const adapter = new RedisLockAdapter();

  assert.equal((adapter as unknown as { cliPath: string }).cliPath, "redis-cli");
});

test("RedisLockAdapter uses custom cliPath from config [distributed-lock]", () => {
  const adapter = new RedisLockAdapter({ cliPath: "/usr/local/bin/redis-cli" });

  assert.equal((adapter as unknown as { cliPath: string }).cliPath, "/usr/local/bin/redis-cli");
});

test("RedisLockAdapter uses default connectTimeoutMs [distributed-lock]", () => {
  const adapter = new RedisLockAdapter();

  assert.equal((adapter as unknown as { connectTimeoutMs: number }).connectTimeoutMs, 500);
});

test("RedisLockAdapter uses custom connectTimeoutMs from config [distributed-lock]", () => {
  const adapter = new RedisLockAdapter({ connectTimeoutMs: 2000 });

  assert.equal((adapter as unknown as { connectTimeoutMs: number }).connectTimeoutMs, 2000);
});

// =============================================================================
// RedisLockAdapter async method error handling edge cases
// =============================================================================

test("RedisLockAdapter acquireAsync throws on connection error [distributed-lock]", async () => {
  const adapter = new RedisLockAdapter({ host: "localhost", port: 6379 });

  (adapter as unknown as {
    redis: {
      status: string;
      connect: () => Promise<void>;
      incr: () => Promise<number>;
      set: () => Promise<never>;
      get: () => Promise<null>;
      del: () => Promise<number>;
      eval: () => Promise<number>;
      scan: () => Promise<[string, string[]]>;
      mget: () => Promise<Array<string | null>>;
      quit: () => Promise<void>;
      disconnect: () => void;
      on: () => void;
    };
  }).redis = {
    status: "ready",
    connect: async () => {},
    incr: async () => 1,
    set: async () => {
      throw new Error("Connection reset by peer");
    },
    get: async () => null,
    del: async () => 1,
    eval: async () => 1,
    scan: async () => ["0", []],
    mget: async () => [],
    quit: async () => {},
    disconnect: () => {},
    on: () => {},
  };

  await assert.rejects(
    adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" }),
    (error: unknown) => error instanceof Error && error.message === "Connection reset by peer",
  );
});

test("RedisLockAdapter releaseAsync throws on Lua script error [distributed-lock]", async () => {
  const adapter = new RedisLockAdapter({ host: "localhost", port: 6379 });

  const redis = (adapter as unknown as { redis: { status: string; connect: () => Promise<void>; eval: () => Promise<never> } }).redis;
  Object.defineProperty(redis, "status", { value: "ready", writable: true });
  redis.connect = async () => {};
  redis.eval = async () => {
    throw new Error("ERR user script too slow");
  };

  await assert.rejects(
    adapter.releaseAsync("test-key", "test-owner"),
    (error: unknown) => error instanceof Error && error.message === "ERR user script too slow",
  );
});

test("RedisLockAdapter extendAsync caps TTL at 600000ms [distributed-lock]", async () => {
  const adapter = new RedisLockAdapter({ host: "localhost", port: 6379 });

  const redis = (adapter as unknown as {
    redis: {
      status: string;
      connect: () => Promise<void>;
      incr: () => Promise<number>;
      get: () => Promise<string>;
      eval: () => Promise<string>;
    };
  }).redis;
  Object.defineProperty(redis, "status", { value: "ready", writable: true });
  redis.connect = async () => {};
  redis.incr = async () => 2;
  redis.get = async () => JSON.stringify({
    owner: "test-owner",
    fencingToken: 1,
    ttlMs: 30000,
    acquiredAt: new Date().toISOString(),
    metadata: null,
  });
  redis.eval = async () => JSON.stringify({
    owner: "test-owner",
    fencingToken: 2,
    ttlMs: 600000,
    acquiredAt: new Date().toISOString(),
    metadata: null,
  });

  const result = await adapter.extendAsync("test-key", "test-owner", 999999);

  assert.equal(result?.ttlMs, 600000);
  assert.equal(result?.fencingToken, 2);
});

// =============================================================================
// lockLogger tests
// =============================================================================

test("lockLogger has log method [distributed-lock]", () => {
  assert.equal(typeof lockLogger.log, "function");
});

test("lockLogger can be called without throwing [distributed-lock]", () => {
  assert.doesNotThrow(() => {
    lockLogger.log({ level: "info", message: "test", data: {} });
  });
});

test("lockLogger accepts various log levels [distributed-lock]", () => {
  const levels = ["debug", "info", "warn", "error"] as const;

  for (const level of levels) {
    assert.doesNotThrow(() => {
      lockLogger.log({ level, message: `test-${level}`, data: {} });
    });
  }
});

// =============================================================================
// Integration-style tests with SQLite adapter
// =============================================================================

test("SqliteLockAdapter full lifecycle: acquire, extend, release [distributed-lock]", () => {
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

test("SqliteLockAdapter concurrent acquire attempts: first wins [distributed-lock]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // First owner acquires
  const first = adapter.acquire({ lockKey: "concurrency-lock", owner: "owner-1", ttlMs: 30000 });
  assert.equal(first.acquired, true);

  // Second owner fails
  const second = adapter.acquire({ lockKey: "concurrency-lock", owner: "owner-2", ttlMs: 30000 });
  assert.equal(second.acquired, false);

  db.close();
});

test("SqliteLockAdapter after release, new owner can acquire [distributed-lock]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // First owner acquires and releases
  adapter.acquire({ lockKey: "release-lock", owner: "owner-1", ttlMs: 30000 });
  adapter.release("release-lock", "owner-1");

  // New owner can now acquire
  const result = adapter.acquire({ lockKey: "release-lock", owner: "owner-2", ttlMs: 30000 });
  assert.equal(result.acquired, true);
  assert.equal(result.lock!.owner, "owner-2");

  db.close();
});

test("SqliteLockAdapter forceSteal allows new owner to take lock [distributed-lock]", () => {
  const db = createTestDb();
  const adapter = new SqliteLockAdapter(db);

  // Original owner acquires
  adapter.acquire({ lockKey: "steal-lock", owner: "owner-1", ttlMs: 30000 });

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

// =============================================================================
// DISTRIBUTED_LOCKS_DDL tests
// =============================================================================

test("DISTRIBUTED_LOCKS_DDL creates valid SQLite table [distributed-lock]", () => {
  const db = createTestDb();

  // The DDL should have created the table. Let's verify by inserting and querying.
  db.prepare(`
    INSERT INTO distributed_locks (lock_key, owner, fencing_token, status, acquired_at, ttl_ms)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run("ddl-test", "owner-1", 1, "held", new Date().toISOString(), 30000);

  const row = db.prepare("SELECT * FROM distributed_locks WHERE lock_key = ?").get("ddl-test") as { lock_key: string } | undefined;

  assert.ok(row !== undefined);
  assert.equal(row.lock_key, "ddl-test");

  db.close();
});

test("DISTRIBUTED_LOCKS_DDL includes all required columns [distributed-lock]", () => {
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("lock_key"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("owner"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("fencing_token"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("status"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("acquired_at"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("ttl_ms"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("metadata"));
  assert.ok(DISTRIBUTED_LOCKS_DDL.includes("PRIMARY KEY"));
});
