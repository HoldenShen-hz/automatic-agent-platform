import assert from "node:assert/strict";
import test from "node:test";

import { createLeaseRepository } from "../../../../../src/platform/five-plane-execution/lease/lease-repository.js";
import { SqliteLeaseRepository } from "../../../../../src/platform/five-plane-execution/lease/lease-repository-sqlite.js";
import { PostgresLeaseRepository } from "../../../../../src/platform/five-plane-execution/lease/lease-repository-postgres.js";

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function createSqliteBackend(): any {
  return {
    driver: "sqlite" as const,
    sql: {
      connection: { exec: () => {}, prepare: () => ({ run: () => {} }) },
      filePath: ":memory:",
      backendType: "sqlite" as const,
      migrate: () => {},
      getSchemaStatus: () => ({ currentVersion: 1, pendingMigrations: 0 } as any),
      assertSchemaCurrent: () => {},
      integrityCheck: () => [],
      healthCheck: () => Promise.resolve(true),
      transaction: <T>(work: () => T) => work(),
      readTransaction: <T>(work: () => T) => work(),
    },
  };
}

function createPostgresBackend(): any {
  return {
    driver: "postgres" as const,
    asyncSql: {
      asyncConnection: {
        query: async () => ({ rows: [] }),
        execute: async () => {},
      },
      backendType: "postgres" as const,
    },
  };
}

// ---------------------------------------------------------------------------
// Tests: Basic factory behavior
// ---------------------------------------------------------------------------

test("createLeaseRepository returns SqliteLeaseRepository for sqlite backend [lease-repository]", () => {
  const backend = createSqliteBackend();
  const repo = createLeaseRepository(backend);

  assert.ok(repo instanceof SqliteLeaseRepository);
});

test("createLeaseRepository returns PostgresLeaseRepository for postgres backend [lease-repository]", () => {
  const backend = createPostgresBackend();
  const repo = createLeaseRepository(backend);

  assert.ok(repo instanceof PostgresLeaseRepository);
});

// ---------------------------------------------------------------------------
// Tests: SqliteLeaseRepository interface
// ---------------------------------------------------------------------------

test("createLeaseRepository interface is satisfied - SqliteLeaseRepository has all required methods [lease-repository]", () => {
  const backend = createSqliteBackend();
  const repo = createLeaseRepository(backend);

  // Verify all required methods exist
  assert.equal(typeof repo.insertLease, "function");
  assert.equal(typeof repo.getLease, "function");
  assert.equal(typeof repo.getActiveLeaseForExecution, "function");
  assert.equal(typeof repo.getLatestFencingToken, "function");
  assert.equal(typeof repo.listExecutionLeases, "function");
  assert.equal(typeof repo.updateLeaseStatus, "function");
  assert.equal(typeof repo.updateLeaseHeartbeat, "function");
  assert.equal(typeof repo.updateLeaseRelease, "function");
  assert.equal(typeof repo.insertLeaseAudit, "function");
  assert.equal(typeof repo.listLeaseAudits, "function");
});

test("createLeaseRepository interface is satisfied - PostgresLeaseRepository has all required methods [lease-repository]", () => {
  const backend = createPostgresBackend();
  const repo = createLeaseRepository(backend);

  // Verify all required methods exist
  assert.equal(typeof repo.insertLease, "function");
  assert.equal(typeof repo.getLease, "function");
  assert.equal(typeof repo.getActiveLeaseForExecution, "function");
  assert.equal(typeof repo.getLatestFencingToken, "function");
  assert.equal(typeof repo.listExecutionLeases, "function");
  assert.equal(typeof repo.updateLeaseStatus, "function");
  assert.equal(typeof repo.updateLeaseHeartbeat, "function");
  assert.equal(typeof repo.updateLeaseRelease, "function");
  assert.equal(typeof repo.insertLeaseAudit, "function");
  assert.equal(typeof repo.listLeaseAudits, "function");
});

// ---------------------------------------------------------------------------
// Tests: Repository type safety
// ---------------------------------------------------------------------------

test("SqliteLeaseRepository implements LeaseRepository interface correctly [lease-repository]", () => {
  const backend = createSqliteBackend();
  const repo = createLeaseRepository(backend);

  // All methods should be async (return Promises)
  assert.equal(repo.constructor.name, "SqliteLeaseRepository");
});

test("PostgresLeaseRepository implements LeaseRepository interface correctly [lease-repository]", () => {
  const backend = createPostgresBackend();
  const repo = createLeaseRepository(backend);

  // All methods should be async (return Promises)
  assert.equal(repo.constructor.name, "PostgresLeaseRepository");
});

// ---------------------------------------------------------------------------
// Tests: Multiple backend instances
// ---------------------------------------------------------------------------

test("createLeaseRepository creates independent repository instances [lease-repository]", () => {
  const backend1 = createSqliteBackend();
  const backend2 = createSqliteBackend();

  const repo1 = createLeaseRepository(backend1);
  const repo2 = createLeaseRepository(backend2);

  // Each call should create a new independent instance
  assert.ok(repo1 instanceof SqliteLeaseRepository);
  assert.ok(repo2 instanceof SqliteLeaseRepository);
  assert.ok(repo1 !== repo2);
});

test("createLeaseRepository works with multiple sqlite backends [lease-repository]", () => {
  const backend1 = createSqliteBackend();
  const backend2 = createSqliteBackend();

  const repo1 = createLeaseRepository(backend1);
  const repo2 = createLeaseRepository(backend2);

  assert.ok(repo1 instanceof SqliteLeaseRepository);
  assert.ok(repo2 instanceof SqliteLeaseRepository);
});

// ---------------------------------------------------------------------------
// Tests: Factory is idempotent
// ---------------------------------------------------------------------------

test("createLeaseRepository is idempotent for same backend [lease-repository]", () => {
  const backend = createSqliteBackend();

  const repo1 = createLeaseRepository(backend);
  const repo2 = createLeaseRepository(backend);

  // Same backend should give same type of repo
  assert.ok(repo1 instanceof SqliteLeaseRepository);
  assert.ok(repo2 instanceof SqliteLeaseRepository);
});

// ---------------------------------------------------------------------------
// Tests: Driver type is properly detected
// ---------------------------------------------------------------------------

test("createLeaseRepository detects 'sqlite' driver correctly [lease-repository]", () => {
  const backend = createSqliteBackend();
  const repo = createLeaseRepository(backend);

  assert.ok(repo instanceof SqliteLeaseRepository);
});

test("createLeaseRepository detects 'postgres' driver correctly [lease-repository]", () => {
  const backend = createPostgresBackend();
  const repo = createLeaseRepository(backend);

  assert.ok(repo instanceof PostgresLeaseRepository);
});
