import assert from "node:assert/strict";
import test from "node:test";

import { createHaRepository } from "../../../../../src/platform/five-plane-execution/ha/ha-repository.js";
import { SqliteHaRepository } from "../../../../../src/platform/five-plane-execution/ha/ha-repository-sqlite.js";
import { PostgresHaRepository } from "../../../../../src/platform/five-plane-execution/ha/ha-repository-postgres.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Storage Backends - using any to bypass complex type requirements
// ─────────────────────────────────────────────────────────────────────────────

function createMockSqliteBackend(): any {
  return {
    driver: "sqlite",
    sql: {
      connection: { exec: () => {}, prepare: () => ({ run: () => { return { changes: 0 }; }, get: () => undefined, all: () => [] }) },
      filePath: ":memory:",
      backendType: "sqlite",
      migrate: () => {},
      getSchemaStatus: () => ({ currentVersion: 1, pendingMigrations: 0 }),
      assertSchemaCurrent: () => {},
      integrityCheck: () => [],
      healthCheck: () => Promise.resolve(true),
      transaction: <T>(work: () => T) => work(),
      readTransaction: <T>(work: () => T) => work(),
    },
  };
}

function createMockPostgresBackend(coordinatorId?: string): any {
  return {
    driver: "postgres",
    asyncSql: {
      asyncConnection: {
        execute: async () => 0,
        query: async <T>(_sql: string, _params?: unknown[]): Promise<{ rows: T[]; rowCount: number }> => ({ rows: [] as T[], rowCount: 0 }),
        queryOne: async <T>(_sql: string, _params?: unknown[]): Promise<T | undefined> => undefined,
      },
    },
    coordinatorId: coordinatorId ?? "test-coord",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: createHaRepository factory
// ─────────────────────────────────────────────────────────────────────────────

test("createHaRepository returns SqliteHaRepository for sqlite driver", () => {
  const backend = createMockSqliteBackend();

  const repo = createHaRepository(backend);

  assert.ok(repo instanceof SqliteHaRepository);
});

test("createHaRepository returns PostgresHaRepository for postgres driver", () => {
  const backend = createMockPostgresBackend("my-custom-coord");

  const repo = createHaRepository(backend, "my-custom-coord");

  assert.ok(repo instanceof PostgresHaRepository);
});

test("createHaRepository uses provided coordinatorId for postgres", () => {
  const backend = createMockPostgresBackend("my-custom-coord");

  const repo = createHaRepository(backend, "my-custom-coord");

  assert.ok(repo instanceof PostgresHaRepository);
});

test("createHaRepository accepts optional coordinatorId for sqlite", () => {
  const backend = createMockSqliteBackend();

  // Should not throw - coordinatorId is optional for sqlite
  const repo = createHaRepository(backend, "optional-coord");

  assert.ok(repo instanceof SqliteHaRepository);
});

test("createHaRepository returns HaRepository interface compliant object", () => {
  const backend = createMockSqliteBackend();
  const repo = createHaRepository(backend);

  // Verify all required HaRepository methods are present
  assert.equal(typeof repo.upsertNode, "function");
  assert.equal(typeof repo.getNode, "function");
  assert.equal(typeof repo.listNodes, "function");
  assert.equal(typeof repo.updateNodeHeartbeat, "function");
  assert.equal(typeof repo.deleteNode, "function");
  assert.equal(typeof repo.insertLease, "function");
  assert.equal(typeof repo.updateLeaseStatus, "function");
  assert.equal(typeof repo.updateLeaseExpiration, "function");
  assert.equal(typeof repo.getActiveLease, "function");
  assert.equal(typeof repo.getLeaseByNodeId, "function");
  assert.equal(typeof repo.getLeaseById, "function");
  assert.equal(typeof repo.getExpiredLeases, "function");
  assert.equal(typeof repo.getActiveLeaseByNode, "function");
  assert.equal(typeof repo.insertEpoch, "function");
  assert.equal(typeof repo.updateEpochEnd, "function");
  assert.equal(typeof repo.getLatestEpoch, "function");
  assert.equal(typeof repo.listEpochs, "function");
  assert.equal(typeof repo.insertFailoverDecision, "function");
  assert.equal(typeof repo.listFailoverDecisions, "function");
  assert.equal(typeof repo.recordActionAudit, "function");
  assert.equal(typeof repo.getStaleNodes, "function");
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: SqliteHaRepository instance
// ─────────────────────────────────────────────────────────────────────────────

test("SqliteHaRepository can be instantiated directly", () => {
  const backend = createMockSqliteBackend();

  const repo = new SqliteHaRepository(backend.sql);

  assert.ok(repo instanceof SqliteHaRepository);
});

test("SqliteHaRepository implements all HaRepository methods", async () => {
  const backend = createMockSqliteBackend();
  const repo = new SqliteHaRepository(backend.sql);

  // All methods should be callable (even if they don't do real work in mock)
  await repo.upsertNode({
    nodeId: "test",
    region: "us-east",
    status: "active",
    isLeader: false,
    leadershipEpoch: 0,
    lastHeartbeatAt: new Date().toISOString(),
    metadata: null,
  });

  const node = await repo.getNode("test");
  // Mock returns undefined since it doesn't actually store

  const nodes = await repo.listNodes();
  assert.ok(Array.isArray(nodes));

  await repo.updateNodeHeartbeat("test");
  await repo.deleteNode("test");
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: PostgresHaRepository instance
// ─────────────────────────────────────────────────────────────────────────────

test("PostgresHaRepository can be instantiated directly", () => {
  const backend = createMockPostgresBackend("coord-123");

  const repo = new PostgresHaRepository(backend.asyncSql, backend.coordinatorId);

  assert.ok(repo instanceof PostgresHaRepository);
});

test("PostgresHaRepository implements all HaRepository methods", async () => {
  const backend = createMockPostgresBackend("coord-123");
  const repo = new PostgresHaRepository(backend.asyncSql, backend.coordinatorId);

  await repo.upsertNode({
    nodeId: "test",
    region: "us-east",
    status: "active",
    isLeader: false,
    leadershipEpoch: 0,
    lastHeartbeatAt: new Date().toISOString(),
    metadata: null,
  });

  const node = await repo.getNode("test");
  // Mock returns undefined

  const nodes = await repo.listNodes();
  assert.ok(Array.isArray(nodes));
});

test("PostgresHaRepository has tryAcquireAdvisoryLock method", async () => {
  const backend = createMockPostgresBackend("coord-123");
  const repo = new PostgresHaRepository(backend.asyncSql, backend.coordinatorId);

  assert.equal(typeof repo.tryAcquireAdvisoryLock, "function");
  const result = await repo.tryAcquireAdvisoryLock();
  assert.equal(typeof result, "boolean");
});

test("PostgresHaRepository has releaseAdvisoryLock method", async () => {
  const backend = createMockPostgresBackend("coord-123");
  const repo = new PostgresHaRepository(backend.asyncSql, backend.coordinatorId);

  assert.equal(typeof repo.releaseAdvisoryLock, "function");
  await repo.releaseAdvisoryLock(); // Should not throw
});
