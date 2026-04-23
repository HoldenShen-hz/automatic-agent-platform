import assert from "node:assert/strict";
import test from "node:test";

import { createExecutionLeaseService } from "../../../../../src/platform/execution/lease/execution-lease-factory.js";
import { ExecutionLeaseServiceAsync } from "../../../../../src/platform/execution/lease/execution-lease-service-async.js";

test("createExecutionLeaseService returns ExecutionLeaseServiceAsync for sqlite backend", () => {
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

  const service = createExecutionLeaseService(backend as any);

  assert.ok(service instanceof ExecutionLeaseServiceAsync);
});

test("createExecutionLeaseService creates a working service instance", () => {
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

  const service = createExecutionLeaseService(backend as any);

  // Verify service has expected methods
  assert.equal(typeof service.acquireLease, "function");
  assert.equal(typeof service.renewLease, "function");
  assert.equal(typeof service.releaseLease, "function");
  assert.equal(typeof service.validateWriteAccess, "function");
  assert.equal(typeof service.reclaimExpiredLeases, "function");
  assert.equal(typeof service.handoverLease, "function");
});
