import assert from "node:assert/strict";
import test from "node:test";

import { PgAdvisoryLockAdapter } from "../../../../../src/platform/five-plane-execution/distributed-lock/pg-advisory-lock-adapter.js";

test("PgAdvisoryLockAdapter acquire() throws pg_async_required [pg-advisory-lock-adapter]", () => {
  const adapter = new PgAdvisoryLockAdapter();

  assert.throws(
    () => adapter.acquire({ lockKey: "test-key", owner: "test-owner" }),
    (error: unknown) =>
      (error as any)?.code === "E7lock.pg_async_required"
      && (error as any)?.message.includes("acquire() requires async"),
  );
});

test("PgAdvisoryLockAdapter release() throws pg_async_required [pg-advisory-lock-adapter]", () => {
  const adapter = new PgAdvisoryLockAdapter();

  assert.throws(
    () => adapter.release("test-key", "test-owner"),
    (error: unknown) =>
      (error as any)?.code === "E7lock.pg_async_required"
      && (error as any)?.message.includes("release() requires async"),
  );
});

test("PgAdvisoryLockAdapter forceSteal() throws advisory_cannot_force_steal [pg-advisory-lock-adapter]", () => {
  const adapter = new PgAdvisoryLockAdapter();

  assert.throws(
    () => adapter.forceSteal("test-key", "new-owner", "test reason"),
    (error: unknown) =>
      (error as any)?.code === "E7lock.advisory_cannot_force_steal"
      && (error as any)?.message.includes("forceSteal is not supported"),
  );
});

test("PgAdvisoryLockAdapter inspect() returns null [pg-advisory-lock-adapter]", () => {
  const adapter = new PgAdvisoryLockAdapter();

  const result = adapter.inspect("test-key");

  assert.equal(result, null);
});

test("PgAdvisoryLockAdapter extend() refreshes held lock metadata for the owner [pg-advisory-lock-adapter]", () => {
  const adapter = new PgAdvisoryLockAdapter();
  (adapter as any).heldLocks.set("test-key", {
    lockKey: "test-key",
    owner: "test-owner",
    fencingToken: 7,
    status: "held",
    acquiredAt: "2026-05-19T00:00:00.000Z",
    ttlMs: 30000,
    metadata: null,
  });

  const result = adapter.extend("test-key", "test-owner", 5000);

  assert.ok(result);
  assert.equal(result!.ttlMs, 35000);
  assert.equal(result!.owner, "test-owner");
});

test("PgAdvisoryLockAdapter backendKind is pg_advisory [pg-advisory-lock-adapter]", () => {
  const adapter = new PgAdvisoryLockAdapter();

  assert.equal(adapter.backendKind, "pg_advisory");
});

// =============================================================================
// Async method tests (require PostgreSQL driver mocking)
// =============================================================================

// Mock driver using any to avoid complex generic type matching
type MockPostgresDriver = {
  end: () => Promise<void>;
  (strings: TemplateStringsArray, ...values: any[]): Promise<Array<{ [key: string]: any }>>;
};

function createMockDriver(options: {
  queryFn?: (strings: TemplateStringsArray, ...values: any[]) => Promise<Array<{ [key: string]: any }>>;
  endFn?: () => Promise<void>;
} = {}): MockPostgresDriver {
  const { queryFn = async () => [{ acquired: true }], endFn = async () => {} } = options;
  // Create a callable mock function that can be used as a tagged template function
  const mockFn = (async (strings: TemplateStringsArray, ...values: any[]) => queryFn(strings, ...values)) as MockPostgresDriver;
  mockFn.end = endFn;
  return mockFn;
}

// Helper to create adapter with mock driver
function createAdapterWithMockDriver(mockDriver: MockPostgresDriver): PgAdvisoryLockAdapter {
  const adapter = new PgAdvisoryLockAdapter({ dsn: "postgresql://test:test@localhost/test" });
  // sql is used as a tagged template function (driver`...`), so assign the callable directly
  (adapter as any).sql = mockDriver;
  (adapter as any).connected = true;
  return adapter;
}

test("PgAdvisoryLockAdapter acquireAsync returns lock when successful [pg-advisory-lock-adapter]", async () => {
  const mockDriver = createMockDriver({
    queryFn: async () => [{ acquired: true, fencing_token: 42 }],
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  const result = await adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" });

  assert.equal(result.acquired, true);
  assert.ok(result.lock);
  assert.equal(result.lock!.lockKey, "test-key");
  assert.equal(result.lock!.owner, "test-owner");
  assert.equal(result.lock!.status, "held");
  assert.equal(result.lock!.fencingToken, 42);
});

test("PgAdvisoryLockAdapter acquireAsync returns false when lock not acquired [pg-advisory-lock-adapter]", async () => {
  const mockDriver = createMockDriver({
    queryFn: async () => [{ acquired: false }],
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  const result = await adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" });

  assert.equal(result.acquired, false);
  assert.equal(result.lock, undefined);
});

test("PgAdvisoryLockAdapter acquireAsync throws when pg module not found [pg-advisory-lock-adapter]", async () => {
  // Pass a custom postgresFactory that throws module not found error
  const adapter = new PgAdvisoryLockAdapter({
    dsn: "postgresql://test:test@localhost/test",
    postgresFactory: () => {
      throw new ReferenceError("Cannot find module 'postgres'");
    },
  });

  await assert.rejects(
    adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" }),
    (error: unknown) =>
      (error as any)?.code === "E7lock.pg_advisory_not_implemented"
      && (error as any)?.message.includes("pg driver"),
  );
});

test("PgAdvisoryLockAdapter acquireAsync throws unavailable on connection error [pg-advisory-lock-adapter]", async () => {
  const mockDriver = createMockDriver({
    queryFn: async () => {
      throw new Error("Connection reset by peer");
    },
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  await assert.rejects(
    adapter.acquireAsync({ lockKey: "test-key", owner: "test-owner" }),
    (error: unknown) =>
      (error as any)?.code === "E7lock.pg_advisory_unavailable"
      && (error as Error).message.includes("Connection reset by peer"),
  );
});

test("PgAdvisoryLockAdapter releaseAsync returns true when successful [pg-advisory-lock-adapter]", async () => {
  const mockDriver = createMockDriver({
    queryFn: async () => [{ released: true }],
  });
  const adapter = createAdapterWithMockDriver(mockDriver);
  (adapter as any).heldLocks.set("test-key", {
    lockKey: "test-key",
    owner: "test-owner",
    fencingToken: 42,
    status: "held",
    acquiredAt: "2026-05-19T00:00:00.000Z",
    ttlMs: 30000,
    metadata: null,
  });

  const result = await adapter.releaseAsync("test-key", "test-owner");

  assert.equal(result, true);
});

test("PgAdvisoryLockAdapter releaseAsync returns false for owner mismatch [pg-advisory-lock-adapter]", async () => {
  const mockDriver = createMockDriver({
    queryFn: async () => [{ released: true }],
  });
  const adapter = createAdapterWithMockDriver(mockDriver);
  (adapter as any).heldLocks.set("test-key", {
    lockKey: "test-key",
    owner: "expected-owner",
    fencingToken: 42,
    status: "held",
    acquiredAt: "2026-05-19T00:00:00.000Z",
    ttlMs: 30000,
    metadata: null,
  });

  const result = await adapter.releaseAsync("test-key", "wrong-owner");

  assert.equal(result, false);
});

test("PgAdvisoryLockAdapter releaseAsync throws when pg module not found [pg-advisory-lock-adapter]", async () => {
  // Pass a custom postgresFactory that throws module not found error
  const adapter = new PgAdvisoryLockAdapter({
    dsn: "postgresql://test:test@localhost/test",
    postgresFactory: () => {
      throw new ReferenceError("Cannot find module 'postgres'");
    },
  });
  (adapter as any).heldLocks.set("test-key", {
    lockKey: "test-key",
    owner: "test-owner",
    fencingToken: 42,
    status: "held",
    acquiredAt: "2026-05-19T00:00:00.000Z",
    ttlMs: 30000,
    metadata: null,
  });

  await assert.rejects(
    adapter.releaseAsync("test-key", "test-owner"),
    (error: unknown) =>
      (error as any)?.code === "E7lock.pg_advisory_not_implemented"
      && (error as any)?.message.includes("pg driver"),
  );
});

test("PgAdvisoryLockAdapter releaseAsync returns false on error [pg-advisory-lock-adapter]", async () => {
  const mockDriver = createMockDriver({
    queryFn: async () => {
      throw new Error("some database error");
    },
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  const result = await adapter.releaseAsync("test-key", "test-owner");

  assert.equal(result, false);
});

test("PgAdvisoryLockAdapter close calls sql.end() when connected [pg-advisory-lock-adapter]", async () => {
  let endCalled = false;
  const mockDriver = createMockDriver({
    endFn: async () => { endCalled = true; },
  });
  const adapter = createAdapterWithMockDriver(mockDriver);

  await adapter.close();

  assert.equal(endCalled, true);
});

test("PgAdvisoryLockAdapter close does nothing when not connected [pg-advisory-lock-adapter]", async () => {
  await assert.doesNotReject(async () => {
    const adapter = new PgAdvisoryLockAdapter({ dsn: "postgresql://test:test@localhost/test" });
    // sql is null, connected is false

    // Should not throw
    await adapter.close();
  });
});

test("PgAdvisoryLockAdapter lockKeyToAdvisoryKey produces consistent bigint [pg-advisory-lock-adapter]", () => {
  const adapter = new PgAdvisoryLockAdapter({ dsn: "postgresql://test:test@localhost/test" });

  // Access private method via casting to any
  const key1 = (adapter as any).lockKeyToAdvisoryKey("test-key");
  const key2 = (adapter as any).lockKeyToAdvisoryKey("test-key");

  assert.equal(key1, key2);
  assert.equal(typeof key1, "bigint");
});

test("PgAdvisoryLockAdapter lockKeyToAdvisoryKey produces different keys for different inputs [pg-advisory-lock-adapter]", () => {
  const adapter = new PgAdvisoryLockAdapter({ dsn: "postgresql://test:test@localhost/test" });

  const key1 = (adapter as any).lockKeyToAdvisoryKey("key-a");
  const key2 = (adapter as any).lockKeyToAdvisoryKey("key-b");

  assert.notEqual(key1, key2);
});

// =============================================================================
// Constructor config override tests
// =============================================================================

test("PgAdvisoryLockAdapter constructor uses config.dsn when provided [pg-advisory-lock-adapter]", () => {
  // Create adapter with explicit dsn
  const adapter = new PgAdvisoryLockAdapter({ dsn: "postgresql://custom:custom@custom-host:5433/customdb" });

  // Verify dsn was set (via casting to access private field)
  assert.equal((adapter as any).dsn, "postgresql://custom:custom@custom-host:5433/customdb");
});

test("PgAdvisoryLockAdapter constructor uses config.ssl when provided as object [pg-advisory-lock-adapter]", () => {
  const adapter = new PgAdvisoryLockAdapter({
    dsn: "postgresql://test:test@localhost/test",
    ssl: { rejectUnauthorized: true },
  });

  assert.deepEqual((adapter as any).ssl, { rejectUnauthorized: true });
});

test("PgAdvisoryLockAdapter constructor uses config.ssl when provided as false [pg-advisory-lock-adapter]", () => {
  const adapter = new PgAdvisoryLockAdapter({
    dsn: "postgresql://test:test@localhost/test",
    ssl: false,
  });

  assert.equal((adapter as any).ssl, false);
});

test("PgAdvisoryLockAdapter constructor uses config.env when provided [pg-advisory-lock-adapter]", () => {
  const customEnv = {
    AA_LOCK_POSTGRES_DSN: "postgresql://env:env@env-host:5432/envdb",
    AA_LOCK_POSTGRES_POOL_MIN: "2",
    AA_LOCK_POSTGRES_POOL_MAX: "20",
    AA_LOCK_POSTGRES_IDLE_TIMEOUT_SECONDS: "30",
    AA_LOCK_POSTGRES_CONNECT_TIMEOUT_SECONDS: "15",
    AA_LOCK_POSTGRES_SSLMODE: "require",
  };
  const adapter = new PgAdvisoryLockAdapter({ env: customEnv });

  // Verify env values were loaded (via private fields)
  assert.equal((adapter as any).dsn, "postgresql://env:env@env-host:5432/envdb");
  assert.equal((adapter as any).poolMin, 2);
  assert.equal((adapter as any).poolMax, 20);
  assert.equal((adapter as any).idleTimeoutSeconds, 30);
  assert.equal((adapter as any).connectTimeoutSeconds, 15);
  assert.deepEqual((adapter as any).ssl, { rejectUnauthorized: true });
});

test("PgAdvisoryLockAdapter constructor uses config.postgresFactory when provided [pg-advisory-lock-adapter]", () => {
  const customFactory = (_dsn: string, _options: Record<string, unknown>) => createMockDriver();

  const adapter = new PgAdvisoryLockAdapter({
    dsn: "postgresql://test:test@localhost/test",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    postgresFactory: customFactory as any,
  });

  assert.equal((adapter as any).postgresFactory, customFactory);
});

test("PgAdvisoryLockAdapter ensureConnected throws connection error [pg-advisory-lock-adapter]", () => {
  const adapter = new PgAdvisoryLockAdapter({
    dsn: "postgresql://test:test@localhost/test",
    postgresFactory: () => {
      throw new Error("Connection refused");
    },
  });

  // Manually set connected to false and connectionError to trigger throw path
  (adapter as any).connected = false;
  (adapter as any).connectionError = null;

  assert.throws(
    () => (adapter as any).ensureConnected(),
    (error: unknown) => (error as Error).message === "Connection refused",
  );
});

test("PgAdvisoryLockAdapter ensureConnected reuses existing connection [pg-advisory-lock-adapter]", () => {
  const mockDriver = createMockDriver();
  const adapter = createAdapterWithMockDriver(mockDriver);

  // ensureConnected should not throw and should not call factory again
  (adapter as any).ensureConnected();

  // connected should still be true
  assert.equal((adapter as any).connected, true);
});
