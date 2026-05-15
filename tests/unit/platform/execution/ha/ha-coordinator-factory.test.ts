import assert from "node:assert/strict";
import test from "node:test";

import { createHaCoordinatorService, createHaRepositoryForBackend } from "../../../../../src/platform/five-plane-execution/ha/ha-coordinator-factory.js";
import { HaCoordinatorServiceAsync } from "../../../../../src/platform/five-plane-execution/ha/ha-coordinator-service-async.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Storage Backend Factory
// ─────────────────────────────────────────────────────────────────────────────

function createMockSqliteBackend(): any {
  return {
    driver: "sqlite" as const,
    sql: {
      connection: { exec: () => {}, prepare: () => ({ run: () => { return { changes: 0 }; }, get: () => undefined, all: () => [] }) },
      filePath: ":memory:",
      backendType: "sqlite" as const,
      migrate: () => {},
      getSchemaStatus: () => ({ currentVersion: 1, pendingMigrations: 0, expectedVersion: 1, upToDate: true, pendingVersions: [], checksumMismatches: false } as any),
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
    driver: "postgres" as const,
    asyncSql: {
      asyncConnection: {
        execute: async () => 0 as any,
        query: async <T>(_sql: string, _params?: unknown[]): Promise<{ rows: T[]; rowCount: number }> => ({ rows: [] as T[], rowCount: 0 }),
        queryOne: async <T>(_sql: string, _params?: unknown[]): Promise<T | undefined> => undefined,
      },
    },
    coordinatorId: coordinatorId ?? "test-coord",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: createHaCoordinatorService
// ─────────────────────────────────────────────────────────────────────────────

test("createHaCoordinatorService creates HaCoordinatorServiceAsync for sqlite backend", () => {
  const backend = createMockSqliteBackend();

  const service = createHaCoordinatorService(backend);

  assert.ok(service instanceof HaCoordinatorServiceAsync);
});

test("createHaCoordinatorService creates HaCoordinatorServiceAsync for postgres backend", () => {
  const backend = createMockPostgresBackend("my-coord-123");

  const service = createHaCoordinatorService(backend);

  assert.ok(service instanceof HaCoordinatorServiceAsync);
});

test("createHaCoordinatorService accepts optional options", () => {
  const backend = createMockSqliteBackend();

  const service = createHaCoordinatorService(backend, {
    defaultTtlMs: 30_000,
    strictLeaderAuthority: false,
  });

  assert.ok(service instanceof HaCoordinatorServiceAsync);
});

test("createHaCoordinatorService accepts coordinatorId override for sqlite", () => {
  const backend = createMockSqliteBackend();

  // Should accept coordinatorId even for sqlite (though it may not use it)
  const service = createHaCoordinatorService(backend, {
    coordinatorId: "sqlite-coord",
  });

  assert.ok(service instanceof HaCoordinatorServiceAsync);
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: createHaRepositoryForBackend
// ─────────────────────────────────────────────────────────────────────────────

test("createHaRepositoryForBackend creates repository for sqlite backend", () => {
  const backend = createMockSqliteBackend();

  const repo = createHaRepositoryForBackend(backend);

  assert.ok(repo !== null);
  // Sqlite repository should implement HaRepository interface
  assert.equal(typeof repo.upsertNode, "function");
  assert.equal(typeof repo.getNode, "function");
  assert.equal(typeof repo.listNodes, "function");
});

test("createHaRepositoryForBackend accepts optional coordinatorId for sqlite", () => {
  const backend = createMockSqliteBackend();

  // coordinatorId is optional for sqlite
  const repo = createHaRepositoryForBackend(backend, "optional-coord");

  assert.ok(repo !== null);
});

test("createHaRepositoryForBackend returns object with all HaRepository methods", () => {
  const backend = createMockSqliteBackend();
  const repo = createHaRepositoryForBackend(backend);

  // Verify all HaRepository methods exist
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

test("createHaRepositoryForBackend with undefined backend throws", () => {
  assert.throws(
    () => createHaRepositoryForBackend(undefined as any),
    // Will throw because backend.driver is undefined
  );
});
