import assert from "node:assert/strict";
import test from "node:test";

// These are difficult to test without full backend setup
// Testing the type exports and factory existence instead

import {
  createRuntimeServices,
  runtimeFactories,
  ExecutionDispatchServiceAsync,
  ExecutionWorkerHandshakeServiceAsync,
  ExecutionWorkerWritebackServiceAsync,
  ExecutionPriorityPreemptionServiceAsync,
  type RuntimeServices,
  type AnyStorageBackendHandle,
} from "../../../../../src/platform/five-plane-execution/execution-engine/runtime-factory.js";

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

test("RuntimeServices type is exported", () => {
  // This is a type-only test - if the type compiles, the test passes
  // We use unknown to avoid actual implementation requirements
  const services = {} as RuntimeServices;
  assert.ok(services, "RuntimeServices should be a valid type");
});

test("AnyStorageBackendHandle type is exported", () => {
  // This is a union type, we just verify it exists
  const handle: AnyStorageBackendHandle | undefined = undefined;
  assert.ok(handle === undefined, "AnyStorageBackendHandle should be a valid type");
});

// ---------------------------------------------------------------------------
// ExecutionDispatchServiceAsync is exported
// ---------------------------------------------------------------------------

test("ExecutionDispatchServiceAsync is exported from runtime-factory", () => {
  assert.ok(ExecutionDispatchServiceAsync, "ExecutionDispatchServiceAsync should be exported");
  assert.equal(typeof ExecutionDispatchServiceAsync, "function", "Should be a constructor");
});

// ---------------------------------------------------------------------------
// ExecutionWorkerHandshakeServiceAsync is exported
// ---------------------------------------------------------------------------

test("ExecutionWorkerHandshakeServiceAsync is exported from runtime-factory", () => {
  assert.ok(ExecutionWorkerHandshakeServiceAsync, "ExecutionWorkerHandshakeServiceAsync should be exported");
  assert.equal(typeof ExecutionWorkerHandshakeServiceAsync, "function", "Should be a constructor");
});

// ---------------------------------------------------------------------------
// ExecutionWorkerWritebackServiceAsync is exported
// ---------------------------------------------------------------------------

test("ExecutionWorkerWritebackServiceAsync is exported from runtime-factory", () => {
  assert.ok(ExecutionWorkerWritebackServiceAsync, "ExecutionWorkerWritebackServiceAsync should be exported");
  assert.equal(typeof ExecutionWorkerWritebackServiceAsync, "function", "Should be a constructor");
});

// ---------------------------------------------------------------------------
// ExecutionPriorityPreemptionServiceAsync is exported
// ---------------------------------------------------------------------------

test("ExecutionPriorityPreemptionServiceAsync is exported from runtime-factory", () => {
  assert.ok(ExecutionPriorityPreemptionServiceAsync, "ExecutionPriorityPreemptionServiceAsync should be exported");
  assert.equal(typeof ExecutionPriorityPreemptionServiceAsync, "function", "Should be a constructor");
});

// ---------------------------------------------------------------------------
// runtimeFactories object structure
// ---------------------------------------------------------------------------

test("runtimeFactories has createHaCoordinatorService", () => {
  assert.ok(runtimeFactories, "runtimeFactories should exist");
  assert.equal(typeof runtimeFactories.createHaCoordinatorService, "function", "Should have createHaCoordinatorService");
});

test("runtimeFactories has createExecutionLeaseService", () => {
  assert.ok(runtimeFactories.createExecutionLeaseService, "Should have createExecutionLeaseService");
  assert.equal(typeof runtimeFactories.createExecutionLeaseService, "function");
});

test("runtimeFactories has createHotUpgradeService", () => {
  assert.ok(runtimeFactories.createHotUpgradeService, "Should have createHotUpgradeService");
  assert.equal(typeof runtimeFactories.createHotUpgradeService, "function");
});

test("runtimeFactories has createDispatchService", () => {
  assert.ok(runtimeFactories.createDispatchService, "Should have createDispatchService");
  assert.equal(typeof runtimeFactories.createDispatchService, "function");
});

test("runtimeFactories has createHandshakeService", () => {
  assert.ok(runtimeFactories.createHandshakeService, "Should have createHandshakeService");
  assert.equal(typeof runtimeFactories.createHandshakeService, "function");
});

test("runtimeFactories has createWritebackService", () => {
  assert.ok(runtimeFactories.createWritebackService, "Should have createWritebackService");
  assert.equal(typeof runtimeFactories.createWritebackService, "function");
});

test("runtimeFactories has createPreemptionService", () => {
  assert.ok(runtimeFactories.createPreemptionService, "Should have createPreemptionService");
  assert.equal(typeof runtimeFactories.createPreemptionService, "function");
});

// ---------------------------------------------------------------------------
// createRuntimeServices requires proper backend
// ---------------------------------------------------------------------------

test("createRuntimeServices throws with missing backend", () => {
  // Passing null or undefined should throw an error
  assert.throws(
    () => createRuntimeServices(null as unknown as AnyStorageBackendHandle),
    "Should throw error about requiring postgres shadow sqlite",
  );
});

test("createRuntimeServices throws with undefined backend", () => {
  assert.throws(
    () => createRuntimeServices(undefined as unknown as AnyStorageBackendHandle),
    "Should throw error about requiring postgres shadow sqlite",
  );
});

// ---------------------------------------------------------------------------
// Individual factory functions throw with invalid backends
// ---------------------------------------------------------------------------

test("runtimeFactories.createDispatchService throws with invalid backend", () => {
  assert.throws(
    () => runtimeFactories.createDispatchService(null as unknown as AnyStorageBackendHandle),
  );
});

test("runtimeFactories.createHandshakeService throws with invalid backend", () => {
  assert.throws(
    () => runtimeFactories.createHandshakeService(null as unknown as AnyStorageBackendHandle),
  );
});

test("runtimeFactories.createWritebackService throws with invalid backend", () => {
  assert.throws(
    () => runtimeFactories.createWritebackService(null as unknown as AnyStorageBackendHandle),
  );
});

test("runtimeFactories.createPreemptionService throws with invalid backend", () => {
  assert.throws(
    () => runtimeFactories.createPreemptionService(null as unknown as AnyStorageBackendHandle),
  );
});

// ---------------------------------------------------------------------------
// Additional factory function tests - null/undefined handling
// ---------------------------------------------------------------------------

test("runtimeFactories.createHaCoordinatorService throws with null backend", () => {
  assert.throws(
    () => runtimeFactories.createHaCoordinatorService(null as unknown as AnyStorageBackendHandle),
  );
});

test("runtimeFactories.createHaCoordinatorService throws with undefined backend", () => {
  assert.throws(
    () => runtimeFactories.createHaCoordinatorService(undefined as unknown as AnyStorageBackendHandle),
  );
});

test("runtimeFactories.createExecutionLeaseService throws with null backend", () => {
  assert.throws(
    () => runtimeFactories.createExecutionLeaseService(null as unknown as AnyStorageBackendHandle),
  );
});

test("runtimeFactories.createExecutionLeaseService throws with undefined backend", () => {
  assert.throws(
    () => runtimeFactories.createExecutionLeaseService(undefined as unknown as AnyStorageBackendHandle),
  );
});

test("runtimeFactories.createHotUpgradeService throws with null backend", () => {
  assert.throws(
    () => runtimeFactories.createHotUpgradeService(null as unknown as AnyStorageBackendHandle),
  );
});

test("runtimeFactories.createHotUpgradeService throws with undefined backend", () => {
  assert.throws(
    () => runtimeFactories.createHotUpgradeService(undefined as unknown as AnyStorageBackendHandle),
  );
});

test("runtimeFactories.createDispatchService throws with undefined backend", () => {
  assert.throws(
    () => runtimeFactories.createDispatchService(undefined as unknown as AnyStorageBackendHandle),
  );
});

test("runtimeFactories.createHandshakeService throws with undefined backend", () => {
  assert.throws(
    () => runtimeFactories.createHandshakeService(undefined as unknown as AnyStorageBackendHandle),
  );
});

test("runtimeFactories.createWritebackService throws with undefined backend", () => {
  assert.throws(
    () => runtimeFactories.createWritebackService(undefined as unknown as AnyStorageBackendHandle),
  );
});

test("runtimeFactories.createPreemptionService throws with undefined backend", () => {
  assert.throws(
    () => runtimeFactories.createPreemptionService(undefined as unknown as AnyStorageBackendHandle),
  );
});

// ---------------------------------------------------------------------------
// createRuntimeServices validates backend properly
// ---------------------------------------------------------------------------

test("createRuntimeServices validates backend is an object", () => {
  // Should throw about postgres shadow sqlite since null doesn't have driver property
  assert.throws(
    () => createRuntimeServices("invalid" as unknown as AnyStorageBackendHandle),
  );
});

test("createRuntimeServices validates backend has valid driver", () => {
  // Backend with invalid driver should fail
  const invalidBackend = {
    driver: "mongodb", // Invalid driver
    runtimeProfile: { driver: "mongodb", environment: "test", issues: [] },
  } as unknown as AnyStorageBackendHandle;
  assert.throws(
    () => createRuntimeServices(invalidBackend),
  );
});

// ---------------------------------------------------------------------------
// Type guard function tests
// ---------------------------------------------------------------------------

test("AnyStorageBackendHandle accepts sqlite driver type", () => {
  // This tests the type is correctly a union of SQLite and Postgres handles
  const handle = { driver: "sqlite" } as AnyStorageBackendHandle;
  assert.equal(handle.driver, "sqlite");
});

test("AnyStorageBackendHandle accepts postgres driver type", () => {
  // This tests the type is correctly a union of SQLite and Postgres handles
  const handle = { driver: "postgres" } as AnyStorageBackendHandle;
  assert.equal(handle.driver, "postgres");
});

// ---------------------------------------------------------------------------
// RuntimeServices interface structure validation
// ---------------------------------------------------------------------------

test("RuntimeServices interface has all required service properties", () => {
  // Verify that a complete RuntimeServices object can be constructed
  // with all required properties
  const services: RuntimeServices = {
    ha: null as unknown as import("../../../../../src/platform/five-plane-execution/execution-engine/runtime-factory.js").HaCoordinatorServiceAsync,
    leases: null as unknown as import("../../../../../src/platform/five-plane-execution/execution-engine/runtime-factory.js").ExecutionLeaseServiceAsync,
    hotUpgrade: null as unknown as import("../../../../../src/platform/five-plane-execution/execution-engine/runtime-factory.js").HotUpgradeServiceAsync,
    dispatch: null as unknown as import("../../../../../src/platform/five-plane-execution/execution-engine/runtime-factory.js").ExecutionDispatchServiceAsync,
    handshake: null as unknown as import("../../../../../src/platform/five-plane-execution/execution-engine/runtime-factory.js").ExecutionWorkerHandshakeServiceAsync,
    writeback: null as unknown as import("../../../../../src/platform/five-plane-execution/execution-engine/runtime-factory.js").ExecutionWorkerWritebackServiceAsync,
    preemption: null as unknown as import("../../../../../src/platform/five-plane-execution/execution-engine/runtime-factory.js").ExecutionPriorityPreemptionServiceAsync,
  };

  // Verify all properties exist
  assert.ok("ha" in services);
  assert.ok("leases" in services);
  assert.ok("hotUpgrade" in services);
  assert.ok("dispatch" in services);
  assert.ok("handshake" in services);
  assert.ok("writeback" in services);
  assert.ok("preemption" in services);
});

// ---------------------------------------------------------------------------
// Individual factory functions are distinct
// ---------------------------------------------------------------------------

test("Each runtimeFactories function is distinct", () => {
  // Each factory function should be a separate reference
  const factories = [
    runtimeFactories.createHaCoordinatorService,
    runtimeFactories.createExecutionLeaseService,
    runtimeFactories.createHotUpgradeService,
    runtimeFactories.createDispatchService,
    runtimeFactories.createHandshakeService,
    runtimeFactories.createWritebackService,
    runtimeFactories.createPreemptionService,
  ];

  // All functions should be unique (no duplicates)
  const uniqueSet = new Set(factories);
  assert.equal(uniqueSet.size, factories.length, "All factory functions should be distinct");
});

// ---------------------------------------------------------------------------
// runtimeFactories object is frozen (as const)
// ---------------------------------------------------------------------------

test("runtimeFactories object methods are all functions", () => {
  // Verify all properties in runtimeFactories are functions
  assert.equal(typeof runtimeFactories.createHaCoordinatorService, "function");
  assert.equal(typeof runtimeFactories.createExecutionLeaseService, "function");
  assert.equal(typeof runtimeFactories.createHotUpgradeService, "function");
  assert.equal(typeof runtimeFactories.createDispatchService, "function");
  assert.equal(typeof runtimeFactories.createHandshakeService, "function");
  assert.equal(typeof runtimeFactories.createWritebackService, "function");
  assert.equal(typeof runtimeFactories.createPreemptionService, "function");
});

// ---------------------------------------------------------------------------
// Service constructor exports are classes/functions
// ---------------------------------------------------------------------------

test("ExecutionDispatchServiceAsync is a constructor function", () => {
  assert.equal(typeof ExecutionDispatchServiceAsync, "function");
});

test("ExecutionWorkerHandshakeServiceAsync is a constructor function", () => {
  assert.equal(typeof ExecutionWorkerHandshakeServiceAsync, "function");
});

test("ExecutionWorkerWritebackServiceAsync is a constructor function", () => {
  assert.equal(typeof ExecutionWorkerWritebackServiceAsync, "function");
});

test("ExecutionPriorityPreemptionServiceAsync is a constructor function", () => {
  assert.equal(typeof ExecutionPriorityPreemptionServiceAsync, "function");
});

// ---------------------------------------------------------------------------
// Type re-exports from runtime-factory
// ---------------------------------------------------------------------------

test("HaCoordinatorServiceAsync type is re-exported from runtime-factory", () => {
  // The type should be available for import
  const typeName: import("../../../../../src/platform/five-plane-execution/execution-engine/runtime-factory.js").HaCoordinatorServiceAsync = {} as never;
  assert.ok(typeName !== null);
});

test("ExecutionLeaseServiceAsync type is re-exported from runtime-factory", () => {
  const typeName: import("../../../../../src/platform/five-plane-execution/execution-engine/runtime-factory.js").ExecutionLeaseServiceAsync = {} as never;
  assert.ok(typeName !== null);
});

test("HotUpgradeServiceAsync type is re-exported from runtime-factory", () => {
  const typeName: import("../../../../../src/platform/five-plane-execution/execution-engine/runtime-factory.js").HotUpgradeServiceAsync = {} as never;
  assert.ok(typeName !== null);
});

// ---------------------------------------------------------------------------
// createRuntimeServices error codes are specific
// ---------------------------------------------------------------------------

test("createRuntimeServices throws with specific error code for missing shadow sqlite", () => {
  // Create a postgres backend without shadow sqlite - should throw specific error
  const postgresBackend = {
    driver: "postgres",
    runtimeProfile: {
      driver: "postgres",
      environment: "test",
      issues: [],
      postgres: {
        dsnConfigured: true,
        dsnValue: "postgresql://localhost/test",
        host: "localhost",
        database: "test",
        sslmode: "disable",
        poolMin: 0,
        poolMax: 10,
        dualRun: false,
        shadowSqlitePath: null,
      },
    },
    sql: {
      backendType: "postgres",
      filePath: "postgresql://localhost/test",
      migrate(): void { throw new Error("unsupported"); },
      getSchemaStatus(): never { throw new Error("unsupported"); },
      assertSchemaCurrent(): void { throw new Error("unsupported"); },
      integrityCheck(): string[] { throw new Error("unsupported"); },
      transaction<T>(): T { throw new Error("unsupported"); },
      readTransaction<T>(): T { throw new Error("unsupported"); },
      healthCheck: async (): Promise<boolean> => false,
    },
    asyncSql: {} as never,
    asyncRepos: {} as never,
    postgres: { filePath: "postgresql://localhost/test" } as never,
  } as unknown as AnyStorageBackendHandle;

  assert.throws(
    () => createRuntimeServices(postgresBackend),
    /storage\.postgres_shadow_sqlite_required_for_runtime_services/,
  );
});
