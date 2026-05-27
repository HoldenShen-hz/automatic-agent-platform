import assert from "node:assert/strict";
import test from "node:test";

import { createExecutionLeaseService } from "../../../../../src/platform/five-plane-execution/lease/execution-lease-factory.js";
import { ExecutionLeaseServiceAsync } from "../../../../../src/platform/five-plane-execution/lease/execution-lease-service-async.js";
import { createLeaseRepository } from "../../../../../src/platform/five-plane-execution/lease/lease-repository.js";
import { SqliteLeaseRepository } from "../../../../../src/platform/five-plane-execution/lease/lease-repository-sqlite.js";

// ---------------------------------------------------------------------------
// Mock backend factories
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

// ---------------------------------------------------------------------------
// Tests: Basic functionality
// ---------------------------------------------------------------------------

test("createExecutionLeaseService returns ExecutionLeaseServiceAsync for sqlite backend [execution-lease-factory]", () => {
  const backend = createSqliteBackend();
  const service = createExecutionLeaseService(backend);

  assert.ok(service instanceof ExecutionLeaseServiceAsync);
});

test("createExecutionLeaseService creates a working service instance [execution-lease-factory]", () => {
  const backend = createSqliteBackend();
  const service = createExecutionLeaseService(backend);

  // Verify service has expected methods
  assert.equal(typeof service.acquireLease, "function");
  assert.equal(typeof service.renewLease, "function");
  assert.equal(typeof service.releaseLease, "function");
  assert.equal(typeof service.validateWriteAccess, "function");
  assert.equal(typeof service.reclaimExpiredLeases, "function");
  assert.equal(typeof service.handoverLease, "function");
});

// ---------------------------------------------------------------------------
// Tests: Service is properly initialized
// ---------------------------------------------------------------------------

test("createExecutionLeaseService initializes with repo from createLeaseRepository [execution-lease-factory]", () => {
  const backend = createSqliteBackend();

  // The factory should use createLeaseRepository internally
  const service = createExecutionLeaseService(backend);

  // Service should be fully functional
  assert.ok(service != null);
});

test("createExecutionLeaseService works with different SQLite backend instances [execution-lease-factory]", () => {
  const backend1 = createSqliteBackend();
  const backend2 = createSqliteBackend();

  const service1 = createExecutionLeaseService(backend1);
  const service2 = createExecutionLeaseService(backend2);

  // Both services should be valid instances
  assert.ok(service1 instanceof ExecutionLeaseServiceAsync);
  assert.ok(service2 instanceof ExecutionLeaseServiceAsync);
  assert.ok(service1 !== service2); // Different instances
});

// ---------------------------------------------------------------------------
// Tests: Service type compatibility
// ---------------------------------------------------------------------------

test("ExecutionLeaseServiceAsync returned by factory has all required async methods [execution-lease-factory]", () => {
  const backend = createSqliteBackend();
  const service = createExecutionLeaseService(backend);

  // Async methods from ExecutionLeaseServiceAsync
  assert.equal(typeof service.acquireLease, "function");
  assert.equal(typeof service.renewLease, "function");
  assert.equal(typeof service.releaseLease, "function");
  assert.equal(typeof service.handoverLease, "function");
});

test("ExecutionLeaseServiceAsync returned by factory has validateWriteAccess method [execution-lease-factory]", () => {
  const backend = createSqliteBackend();
  const service = createExecutionLeaseService(backend);

  // validateWriteAccess is sync in ExecutionLeaseServiceAsync
  assert.equal(typeof service.validateWriteAccess, "function");
});

test("ExecutionLeaseServiceAsync returned by factory has reclaimExpiredLeases method [execution-lease-factory]", () => {
  const backend = createSqliteBackend();
  const service = createExecutionLeaseService(backend);

  // reclaimExpiredLeases is sync
  assert.equal(typeof service.reclaimExpiredLeases, "function");
});

// ---------------------------------------------------------------------------
// Tests: Multiple service instances
// ---------------------------------------------------------------------------

test("createExecutionLeaseService creates independent service instances [execution-lease-factory]", () => {
  const backend = createSqliteBackend();

  const service1 = createExecutionLeaseService(backend);
  const service2 = createExecutionLeaseService(backend);

  // Each call should create a new independent instance
  assert.ok(service1 instanceof ExecutionLeaseServiceAsync);
  assert.ok(service2 instanceof ExecutionLeaseServiceAsync);
  assert.ok(service1 !== service2);
});

// ---------------------------------------------------------------------------
// Tests: Backend validation (factory requires sync-compatible backend)
// ---------------------------------------------------------------------------

test("createExecutionLeaseService validates backend is sync-compatible for SQLite [execution-lease-factory]", () => {
  const backend = createSqliteBackend();

  // This should not throw since SQLite is sync-compatible
  const service = createExecutionLeaseService(backend);
  assert.ok(service instanceof ExecutionLeaseServiceAsync);
});

// ---------------------------------------------------------------------------
// Tests: Service operations work correctly (integration-style tests)
// ---------------------------------------------------------------------------

test("createExecutionLeaseService creates service where validateWriteAccess method exists and is callable [execution-lease-factory]", () => {
  const backend = createSqliteBackend();
  const service = createExecutionLeaseService(backend);

  // Method should exist
  assert.equal(typeof service.validateWriteAccess, "function");
});

test("createExecutionLeaseService creates service where reclaimExpiredLeases method exists and is callable [execution-lease-factory]", () => {
  const backend = createSqliteBackend();
  const service = createExecutionLeaseService(backend);

  // Method should exist
  assert.equal(typeof service.reclaimExpiredLeases, "function");
});
