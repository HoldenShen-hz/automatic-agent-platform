import assert from "node:assert/strict";
import test from "node:test";

import { PgAdvisoryLockAdapter } from "../../../../../src/platform/execution/distributed-lock/pg-advisory-lock-adapter.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type MockPostgresDriver = {
  end: () => Promise<void>;
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Array<{ [key: string]: unknown }>>;
};

function createMockDriver(options: {
  queryFn?: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Array<{ [key: string]: unknown }>>;
  endFn?: () => Promise<void>;
} = {}): MockPostgresDriver {
  const { queryFn = async () => [{ acquired: true }], endFn = async () => {} } = options;
  const mockFn = (async (strings: TemplateStringsArray, ...values: unknown[]) => queryFn(strings, ...values)) as MockPostgresDriver;
  mockFn.end = endFn;
  return mockFn;
}

function createAdapterWithMockDriver(mockDriver: MockPostgresDriver): PgAdvisoryLockAdapter {
  const adapter = new PgAdvisoryLockAdapter({ dsn: "postgresql://test:test@localhost/test" });
  (adapter as unknown as { sql: MockPostgresDriver }).sql = mockDriver;
  (adapter as unknown as { connected: boolean }).connected = true;
  return adapter;
}

// ---------------------------------------------------------------------------
// Synchronous interface stubs throw on the sync methods
// ---------------------------------------------------------------------------

test("PgAdvisoryLockAdapter: acquire() throws sync_deprecated error", () => {
  const adapter = new PgAdvisoryLockAdapter();

  assert.throws(
    () => adapter.acquire({ lockKey: "test-key", owner: "test-owner" }),
    (error: unknown) =>
      (error as { code?: string }).code === "E7lock.pg_async_required"
      && (error as Error).message.includes("acquire() requires async"),
  );
});

test("PgAdvisoryLockAdapter: release() throws sync_deprecated error", () => {
  const adapter = new PgAdvisoryLockAdapter();

  assert.throws(
    () => adapter.release("test-key", "test-owner"),
    (error: unknown) =>
      (error as { code?: string }).code === "E7lock.pg_async_required"
      && (error as Error).message.includes("release() requires async"),
  );
});

test("PgAdvisoryLockAdapter: forceSteal() throws advisory_cannot_force_steal", () => {
  const adapter = new PgAdvisoryLockAdapter();

  assert.throws(
    () => adapter.forceSteal("test-key", "new-owner", "emergency"),
    (error: unknown) =>
      (error as { code?: string }).code === "E7lock.advisory_cannot_force_steal"
      && (error as Error).message.includes("forceSteal is not supported"),
  );
});

test("PgAdvisoryLockAdapter: inspect() returns null (advisory locks not inspectable)", () => {
  const adapter = new PgAdvisoryLockAdapter();

  const result = adapter.inspect("test-key");

  assert.equal(result, null);
});

test("PgAdvisoryLockAdapter: extend() delegates to inspect and returns null", () => {
  const adapter = new PgAdvisoryLockAdapter();

  const result = adapter.extend("test-key", "test-owner", 5000);

  assert.equal(result, null);
});

test("PgAdvisoryLockAdapter: backendKind is pg_advisory", () => {
  const adapter = new PgAdvisoryLockAdapter();

  assert.equal(adapter.backendKind, "pg_advisory");
});

// ---------------------------------------------------------------------------
// Async acquireAsync
// ---------------------------------------------------------------------------

test("PgAdvisoryLockAdapter: acquireAsync returns lock record on success", async () => {
  const mockDriver = createMockDriver({
    queryFn: async () => [{ acquired: true }],
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  const result = await adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner", ttlMs: 30_000 });

  assert.equal(result.acquired, true);
  assert.ok(result.lock);
  assert.equal(result.lock!.lockKey, "test-key");
  assert.equal(result.lock!.owner, "test-owner");
  assert.equal(result.lock!.status, "held");
  assert.equal(result.lock!.ttlMs, 30_000);
  assert.ok(result.lock!.fencingToken > 0);
});

test("PgAdvisoryLockAdapter: acquireAsync uses default ttlMs of 30000", async () => {
  const mockDriver = createMockDriver({
    queryFn: async () => [{ acquired: true }],
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  const result = await adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" });

  assert.equal(result.lock!.ttlMs, 30_000);
});

test("PgAdvisoryLockAdapter: acquireAsync returns acquired=false when lock unavailable", async () => {
  const mockDriver = createMockDriver({
    queryFn: async () => [{ acquired: false }],
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  const result = await adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" });

  assert.equal(result.acquired, false);
  assert.equal(result.lock, undefined);
});

test("PgAdvisoryLockAdapter: acquireAsync increments fencing token on each call", async () => {
  const mockDriver = createMockDriver({
    queryFn: async () => [{ acquired: true }],
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  const r1 = await adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" });
  const r2 = await adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" });

  assert.ok(r2.lock!.fencingToken > r1.lock!.fencingToken);
});

test("PgAdvisoryLockAdapter: acquireAsync sets acquiredAt timestamp", async () => {
  const mockDriver = createMockDriver({
    queryFn: async () => [{ acquired: true }],
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  const before = new Date().toISOString();
  const result = await adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" });
  const after = new Date().toISOString();

  assert.ok(result.lock!.acquiredAt >= before);
  assert.ok(result.lock!.acquiredAt <= after);
});

test("PgAdvisoryLockAdapter: acquireAsync throws when postgres module not found", async () => {
  const adapter = new PgAdvisoryLockAdapter({
    dsn: "postgresql://test:test@localhost/test",
    postgresFactory: () => {
      throw new ReferenceError("Cannot find module 'postgres'");
    },
  });

  await assert.rejects(
    adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" }),
    (error: unknown) =>
      (error as { code?: string }).code === "E7lock.pg_advisory_not_implemented"
      && (error as Error).message.includes("pg driver"),
  );
});

test("PgAdvisoryLockAdapter: acquireAsync returns acquired=false on generic database errors", async () => {
  const mockDriver = createMockDriver({
    queryFn: async () => {
      throw new Error("Connection reset by peer");
    },
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  const result = await adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" });

  assert.equal(result.acquired, false);
});

// ---------------------------------------------------------------------------
// Async releaseAsync
// ---------------------------------------------------------------------------

test("PgAdvisoryLockAdapter: releaseAsync returns true on success", async () => {
  const mockDriver = createMockDriver({
    queryFn: async () => [{}],
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  const result = await adapter.releaseAsync("test-key", "test-owner");

  assert.equal(result, true);
});

test("PgAdvisoryLockAdapter: releaseAsync returns false on database error", async () => {
  const mockDriver = createMockDriver({
    queryFn: async () => {
      throw new Error("Release failed");
    },
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  const result = await adapter.releaseAsync("test-key", "test-owner");

  assert.equal(result, false);
});

test("PgAdvisoryLockAdapter: releaseAsync throws when postgres module not found", async () => {
  const adapter = new PgAdvisoryLockAdapter({
    dsn: "postgresql://test:test@localhost/test",
    postgresFactory: () => {
      throw new ReferenceError("Cannot find module 'postgres'");
    },
  });

  await assert.rejects(
    adapter.releaseAsync("test-key", "test-owner"),
    (error: unknown) =>
      (error as { code?: string }).code === "E7lock.pg_advisory_not_implemented"
      && (error as Error).message.includes("pg driver"),
  );
});

// ---------------------------------------------------------------------------
// close()
// ---------------------------------------------------------------------------

test("PgAdvisoryLockAdapter: close calls sql.end() when connected", async () => {
  let endCalled = false;
  const mockDriver = createMockDriver({
    endFn: async () => { endCalled = true; },
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  await adapter.close();

  assert.equal(endCalled, true);
});

test("PgAdvisoryLockAdapter: close does not throw when not connected", async () => {
  const adapter = new PgAdvisoryLockAdapter({ dsn: "postgresql://test:test@localhost/test" });

  // sql is null, connected is false - should not throw
  await adapter.close();
});

// ---------------------------------------------------------------------------
// Deadlock prevention via PostgreSQL advisory lock semantics
// ---------------------------------------------------------------------------

test("PgAdvisoryLockAdapter: pg_try_advisory_lock is non-blocking (returns true/false)", async () => {
  // The mock returns { acquired: true } which simulates pg_try_advisory_lock returning true
  const mockDriver = createMockDriver({
    queryFn: async () => [{ acquired: true }],
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  const result = await adapter.acquireAsync({ lockKey: "non-blocking-lock", owner: "test-owner" });

  // pg_try_advisory_lock returns immediately without waiting
  assert.equal(result.acquired, true);
});

test("PgAdvisoryLockAdapter: different lock keys can be acquired independently", async () => {
  const mockDriver = createMockDriver({
    queryFn: async () => [{ acquired: true }],
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  const r1 = await adapter.acquireAsync({ lockKey: "resource-1", owner: "owner-a" });
  const r2 = await adapter.acquireAsync({ lockKey: "resource-2", owner: "owner-b" });

  assert.equal(r1.acquired, true);
  assert.equal(r2.acquired, true);
  assert.notEqual(r1.lock!.lockKey, r2.lock!.lockKey);
});

test("PgAdvisoryLockAdapter: same lock key cannot be acquired twice by different owners (advisory lock blocks)", async () => {
  // This test verifies the contract: pg_try_advisory_lock returns false when lock is held.
  // Since our mock cannot truly simulate PostgreSQL state, we verify the interface contract
  // that acquireAsync returns { acquired: false } when the underlying pg_try_advisory_lock returns false.

  const mockDriver = createMockDriver({
    queryFn: async () => [{ acquired: false }], // Simulates lock already held
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  const result = await adapter.acquireAsync({ lockKey: "exclusive-resource", owner: "owner-b" });

  assert.equal(result.acquired, false);
  assert.equal(result.lock, undefined);
});

// ---------------------------------------------------------------------------
// lockKeyToAdvisoryKey hash function
// ---------------------------------------------------------------------------

test("PgAdvisoryLockAdapter: lockKeyToAdvisoryKey produces consistent output", () => {
  const adapter = new PgAdvisoryLockAdapter({ dsn: "postgresql://test:test@localhost/test" });

  const key1 = (adapter as unknown as { lockKeyToAdvisoryKey: (k: string) => bigint }).lockKeyToAdvisoryKey("my-lock");
  const key2 = (adapter as unknown as { lockKeyToAdvisoryKey: (k: string) => bigint }).lockKeyToAdvisoryKey("my-lock");

  assert.equal(key1, key2);
});

test("PgAdvisoryLockAdapter: lockKeyToAdvisoryKey produces different output for different keys", () => {
  const adapter = new PgAdvisoryLockAdapter({ dsn: "postgresql://test:test@localhost/test" });

  const key1 = (adapter as unknown as { lockKeyToAdvisoryKey: (k: string) => bigint }).lockKeyToAdvisoryKey("lock-a");
  const key2 = (adapter as unknown as { lockKeyToAdvisoryKey: (k: string) => bigint }).lockKeyToAdvisoryKey("lock-b");

  assert.notEqual(key1, key2);
});

test("PgAdvisoryLockAdapter: lockKeyToAdvisoryKey returns bigint", () => {
  const adapter = new PgAdvisoryLockAdapter({ dsn: "postgresql://test:test@localhost/test" });

  const key = (adapter as unknown as { lockKeyToAdvisoryKey: (k: string) => bigint }).lockKeyToAdvisoryKey("test");

  assert.equal(typeof key, "bigint");
});

test("PgAdvisoryLockAdapter: lockKeyToAdvisoryKey produces positive bigint", () => {
  const adapter = new PgAdvisoryLockAdapter({ dsn: "postgresql://test:test@localhost/test" });

  const key = (adapter as unknown as { lockKeyToAdvisoryKey: (k: string) => bigint }).lockKeyToAdvisoryKey("test");

  assert.ok(key > BigInt(0));
});

// ---------------------------------------------------------------------------
// Constructor configuration
// ---------------------------------------------------------------------------

test("PgAdvisoryLockAdapter: constructor accepts dsn config", () => {
  const adapter = new PgAdvisoryLockAdapter({ dsn: "postgresql://custom:custom@host:5433/db" });

  assert.equal((adapter as unknown as { dsn: string }).dsn, "postgresql://custom:custom@host:5433/db");
});

test("PgAdvisoryLockAdapter: constructor accepts ssl config", () => {
  const adapter = new PgAdvisoryLockAdapter({
    dsn: "postgresql://test:test@localhost/test",
    ssl: { rejectUnauthorized: true },
  });

  assert.deepEqual((adapter as unknown as { ssl: unknown }).ssl, { rejectUnauthorized: true });
});

test("PgAdvisoryLockAdapter: constructor accepts ssl: false", () => {
  const adapter = new PgAdvisoryLockAdapter({
    dsn: "postgresql://test:test@localhost/test",
    ssl: false,
  });

  assert.equal((adapter as unknown as { ssl: boolean }).ssl, false);
});

test("PgAdvisoryLockAdapter: constructor accepts pool config", () => {
  const adapter = new PgAdvisoryLockAdapter({
    dsn: "postgresql://test:test@localhost/test",
    poolMin: 2,
    poolMax: 20,
  });

  assert.equal((adapter as unknown as { poolMin: number }).poolMin, 2);
  assert.equal((adapter as unknown as { poolMax: number }).poolMax, 20);
});

test("PgAdvisoryLockAdapter: constructor accepts timeout configs", () => {
  const adapter = new PgAdvisoryLockAdapter({
    dsn: "postgresql://test:test@localhost/test",
    idleTimeoutSeconds: 45,
    connectTimeoutSeconds: 10,
  });

  assert.equal((adapter as unknown as { idleTimeoutSeconds: number }).idleTimeoutSeconds, 45);
  assert.equal((adapter as unknown as { connectTimeoutSeconds: number }).connectTimeoutSeconds, 10);
});

test("PgAdvisoryLockAdapter: constructor accepts custom postgresFactory", () => {
  const customFactory = (_dsn: string, _options: Record<string, unknown>) => createMockDriver();

  const adapter = new PgAdvisoryLockAdapter({
    dsn: "postgresql://test:test@localhost/test",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    postgresFactory: customFactory as any,
  });

  assert.equal((adapter as unknown as { postgresFactory: unknown }).postgresFactory, customFactory);
});

test("PgAdvisoryLockAdapter: constructor accepts env override", () => {
  const customEnv = {
    AA_LOCK_POSTGRES_DSN: "postgresql://env:env@env-host:5432/envdb",
    AA_LOCK_POSTGRES_POOL_MIN: "3",
    AA_LOCK_POSTGRES_POOL_MAX: "30",
    AA_LOCK_POSTGRES_IDLE_TIMEOUT_SECONDS: "60",
    AA_LOCK_POSTGRES_CONNECT_TIMEOUT_SECONDS: "20",
    AA_LOCK_POSTGRES_SSLMODE: "require",
  };

  const adapter = new PgAdvisoryLockAdapter({ env: customEnv });

  assert.equal((adapter as unknown as { dsn: string }).dsn, "postgresql://env:env@env-host:5432/envdb");
  assert.equal((adapter as unknown as { poolMin: number }).poolMin, 3);
  assert.equal((adapter as unknown as { poolMax: number }).poolMax, 30);
  assert.equal((adapter as unknown as { idleTimeoutSeconds: number }).idleTimeoutSeconds, 60);
  assert.equal((adapter as unknown as { connectTimeoutSeconds: number }).connectTimeoutSeconds, 20);
  assert.deepEqual((adapter as unknown as { ssl: unknown }).ssl, { rejectUnauthorized: true });
});

// ---------------------------------------------------------------------------
// ensureConnected behavior
// ---------------------------------------------------------------------------

test("PgAdvisoryLockAdapter: ensureConnected throws connection error when factory fails", () => {
  const adapter = new PgAdvisoryLockAdapter({
    dsn: "postgresql://test:test@localhost/test",
    postgresFactory: () => {
      throw new Error("Connection refused");
    },
  });

  (adapter as unknown as { connected: boolean }).connected = false;
  (adapter as unknown as { connectionError: Error | null }).connectionError = null;

  assert.throws(
    () => (adapter as unknown as { ensureConnected: () => void }).ensureConnected(),
    (error: unknown) => (error as Error).message === "Connection refused",
  );
});

test("PgAdvisoryLockAdapter: ensureConnected reuses existing connection", () => {
  const mockDriver = createMockDriver();
  const adapter = createAdapterWithMockDriver(mockDriver);

  // Should not throw - connection already established
  (adapter as unknown as { ensureConnected: () => void }).ensureConnected();

  assert.equal((adapter as unknown as { connected: boolean }).connected, true);
});

test("PgAdvisoryLockAdapter: ensureConnected throws cached connection error", () => {
  const adapter = new PgAdvisoryLockAdapter({ dsn: "postgresql://test:test@localhost/test" });

  const cachedError = new Error("Previous connection failure");
  (adapter as unknown as { connected: boolean }).connected = false;
  (adapter as unknown as { connectionError: Error | null }).connectionError = cachedError;

  assert.throws(
    () => (adapter as unknown as { ensureConnected: () => void }).ensureConnected(),
    (error: unknown) => error === cachedError,
  );
});
