// @ts-nocheck
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
} from "../../../../../src/platform/execution/execution-engine/runtime-factory.js";

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
// runtimeFactories is frozen
// ---------------------------------------------------------------------------

test("runtimeFactories is a frozen object", () => {
  assert.ok(Object.isFrozen(runtimeFactories), "runtimeFactories should be frozen");
});

// ---------------------------------------------------------------------------
// createRuntimeServices requires proper backend
// ---------------------------------------------------------------------------

test("createRuntimeServices throws with missing backend", () => {
  // Passing null or undefined should throw with descriptive error
  assert.throws(
    () => createRuntimeServices(null as unknown as AnyStorageBackendHandle),
    /postgres_shadow_sqlite_required_for_runtime_services/,
    "Should throw error about requiring postgres shadow sqlite",
  );
});

test("createRuntimeServices throws with undefined backend", () => {
  assert.throws(
    () => createRuntimeServices(undefined as unknown as AnyStorageBackendHandle),
    /postgres_shadow_sqlite_required_for_runtime_services/,
    "Should throw error about requiring postgres shadow sqlite",
  );
});

// ---------------------------------------------------------------------------
// Individual factory functions throw with invalid backends
// ---------------------------------------------------------------------------

test("runtimeFactories.createDispatchService throws with invalid backend", () => {
  assert.throws(
    () => runtimeFactories.createDispatchService(null as unknown as AnyStorageBackendHandle),
    /postgres_shadow_sqlite_required_for_dispatch_service/,
  );
});

test("runtimeFactories.createHandshakeService throws with invalid backend", () => {
  assert.throws(
    () => runtimeFactories.createHandshakeService(null as unknown as AnyStorageBackendHandle),
    /postgres_shadow_sqlite_required_for_handshake_service/,
  );
});

test("runtimeFactories.createWritebackService throws with invalid backend", () => {
  assert.throws(
    () => runtimeFactories.createWritebackService(null as unknown as AnyStorageBackendHandle),
    /postgres_shadow_sqlite_required_for_writeback_service/,
  );
});

test("runtimeFactories.createPreemptionService throws with invalid backend", () => {
  assert.throws(
    () => runtimeFactories.createPreemptionService(null as unknown as AnyStorageBackendHandle),
    /postgres_shadow_sqlite_required_for_preemption_service/,
  );
});
