import assert from "node:assert/strict";
import test from "node:test";

import { createLeaseRepository } from "../../../../../src/platform/execution/lease/lease-repository.js";
import { SqliteLeaseRepository } from "../../../../../src/platform/execution/lease/lease-repository-sqlite.js";
import { PostgresLeaseRepository } from "../../../../../src/platform/execution/lease/lease-repository-postgres.js";

test("createLeaseRepository returns SqliteLeaseRepository for sqlite backend", () => {
  const backend = {
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

  const repo = createLeaseRepository(backend as any);

  assert.ok(repo instanceof SqliteLeaseRepository);
});

test("createLeaseRepository returns PostgresLeaseRepository for postgres backend", () => {
  const backend = {
    driver: "postgres" as const,
    asyncSql: {
      asyncConnection: {
        query: async () => ({ rows: [] }),
        execute: async () => {},
      },
      backendType: "postgres" as const,
    },
  };

  const repo = createLeaseRepository(backend as any);

  assert.ok(repo instanceof PostgresLeaseRepository);
});

test("createLeaseRepository interface is satisfied - SqliteLeaseRepository has all required methods", () => {
  const backend = {
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

  const repo = createLeaseRepository(backend as any);

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

test("createLeaseRepository interface is satisfied - PostgresLeaseRepository has all required methods", () => {
  const backend = {
    driver: "postgres" as const,
    asyncSql: {
      asyncConnection: {
        query: async () => ({ rows: [] }),
        execute: async () => {},
      },
      backendType: "postgres" as const,
    },
  };

  const repo = createLeaseRepository(backend as any);

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
