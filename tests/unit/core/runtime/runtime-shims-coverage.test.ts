import assert from "node:assert/strict";
import test from "node:test";

// Test the core/runtime shim files directly to improve coverage
// These files are re-export wrappers that point to platform/five-plane-execution/

// Test 1: distributed-lock-service.ts re-exports correctly
test("core/runtime distributed-lock-service module is importable", async () => {
  const shim = await import("../../../../src/core/runtime/distributed-lock-service.js");

  // The shim should have exports from the platform module
  assert.ok(shim, "Module should be importable");
  // Check that re-exports work - these should be available from the platform modules
  assert.ok(typeof shim.createLockAdapter === "function", "Should export createLockAdapter function");
  assert.ok(typeof shim.RedisLockAdapter === "function", "Should export RedisLockAdapter class");
  assert.ok(typeof shim.SqliteLockAdapter === "function", "Should export SqliteLockAdapter class");
});

// Test 2: process-tracker.ts re-exports correctly
test("core/runtime process-tracker module is importable", async () => {
  const shim = await import("../../../../src/core/runtime/process-tracker.js");

  // The shim should have exports
  assert.ok(shim, "Module should be importable");
  assert.ok(typeof shim.getProcessTracker === "function", "Should export getProcessTracker function");
});

// Test 3: queue-adapter.ts re-exports correctly
test("core/runtime queue-adapter module is importable", async () => {
  const shim = await import("../../../../src/core/runtime/queue-adapter.js");

  // The shim should have exports
  assert.ok(shim, "Module should be importable");
  assert.ok(typeof shim.createQueueAdapter === "function", "Should export createQueueAdapter function");
  assert.ok(typeof shim.RedisQueueAdapter === "function", "Should export RedisQueueAdapter class");
});

// Test 4: index.ts re-exports admission-controller functions
test("core/runtime index exports admission-controller functions", async () => {
  const runtime = await import("../../../../src/core/runtime/index.js");

  // AdmissionController is a class
  assert.ok(typeof runtime.AdmissionController === "function", "Should export AdmissionController class");
});

// Test 5: index.ts re-exports complexity-router functions
test("core/runtime index exports complexity-router functions", async () => {
  const runtime = await import("../../../../src/core/runtime/index.js");

  // routeComplexity is a function
  assert.ok(typeof runtime.routeComplexity === "function", "Should export routeComplexity function");
});

// Test 6: index.ts re-exports context-compaction-service
test("core/runtime index exports context-compaction-service functions", async () => {
  const runtime = await import("../../../../src/core/runtime/index.js");

  // ContextCompactionService is a class
  assert.ok(typeof runtime.ContextCompactionService === "function", "Should export ContextCompactionService class");
});

// Test 7: index.ts re-exports effect-buffer
test("core/runtime index exports effect-buffer class", async () => {
  const runtime = await import("../../../../src/core/runtime/index.js");

  // EffectBuffer is a class
  assert.ok(typeof runtime.EffectBuffer === "function", "Should export EffectBuffer class");
});

// Test 8: index.ts re-exports execution-dispatch-service
test("core/runtime index exports execution-dispatch-service class", async () => {
  const runtime = await import("../../../../src/core/runtime/index.js");

  // ExecutionDispatchService is a class
  assert.ok(typeof runtime.ExecutionDispatchService === "function", "Should export ExecutionDispatchService class");
});

// Test 9: index.ts re-exports execution-lease-service
test("core/runtime index exports execution-lease-service class", async () => {
  const runtime = await import("../../../../src/core/runtime/index.js");

  // ExecutionLeaseService is a class
  assert.ok(typeof runtime.ExecutionLeaseService === "function", "Should export ExecutionLeaseService class");
});

// Test 10: index.ts re-exports graceful-shutdown
test("core/runtime index exports graceful-shutdown class", async () => {
  const runtime = await import("../../../../src/core/runtime/index.js");

  // GracefulShutdown is a class
  assert.ok(typeof runtime.GracefulShutdown === "function", "Should export GracefulShutdown class");
});

// Test 11: index.ts re-exports loop-detection functions
test("core/runtime index exports loop-detection functions", async () => {
  const runtime = await import("../../../../src/core/runtime/index.js");

  // createLoopDetectionMiddleware is a function
  assert.ok(typeof runtime.createLoopDetectionMiddleware === "function", "Should export createLoopDetectionMiddleware function");
});

// Test 12: index.ts re-exports output-continuation-service
test("core/runtime index exports output-continuation-service class", async () => {
  const runtime = await import("../../../../src/core/runtime/index.js");

  // OutputContinuationService is a class
  assert.ok(typeof runtime.OutputContinuationService === "function", "Should export OutputContinuationService class");
});

// Test 13: index.ts re-exports runtime-context interface
test("core/runtime index re-exports runtime-context", async () => {
  const runtime = await import("../../../../src/core/runtime/index.js");

  // RuntimeContext is primarily a type, but the module should still be importable
  // Check that some export exists from this module
  assert.ok(runtime, "Module should be importable and have exports");
});

// Test 14: index.ts re-exports runtime-factory
test("core/runtime index exports runtime-factory", async () => {
  const runtime = await import("../../../../src/core/runtime/index.js");

  // runtimeFactories is an object
  assert.ok(runtime.runtimeFactories, "Should export runtimeFactories");
});

// Test 15: index.ts re-exports state-transition-machine
test("core/runtime index exports state-transition-machine class", async () => {
  const runtime = await import("../../../../src/core/runtime/index.js");

  // StateTransitionMachine is a class
  assert.ok(typeof runtime.StateTransitionMachine === "function", "Should export StateTransitionMachine class");
});

// Test 16: index.ts re-exports transition-service
test("core/runtime index exports transition-service class", async () => {
  const runtime = await import("../../../../src/core/runtime/index.js");

  // TransitionService is a class
  assert.ok(typeof runtime.TransitionService === "function", "Should export TransitionService class");
});

// Test 17: index.ts re-exports worker-registry-service
test("core/runtime index exports worker-registry-service class", async () => {
  const runtime = await import("../../../../src/core/runtime/index.js");

  // WorkerRegistryService is a class
  assert.ok(typeof runtime.WorkerRegistryService === "function", "Should export WorkerRegistryService class");
});

// Test 18: index.ts re-exports workflow-step-checkpoint functions
test("core/runtime index exports workflow-step-checkpoint functions", async () => {
  const runtime = await import("../../../../src/core/runtime/index.js");

  // readWorkflowStepCheckpoint and createWorkflowStepCheckpoint are functions
  assert.ok(typeof runtime.readWorkflowStepCheckpoint === "function", "Should export readWorkflowStepCheckpoint function");
  assert.ok(typeof runtime.createWorkflowStepCheckpoint === "function", "Should export createWorkflowStepCheckpoint function");
});

// Test 19: index.ts re-exports orchestrator submodule
test("core/runtime index exports orchestrator submodule functions", async () => {
  const runtime = await import("../../../../src/core/runtime/index.js");

  assert.ok(typeof runtime.runMultiStepOrchestration === "function", "Should export runMultiStepOrchestration");
  assert.ok(typeof runtime.executeMultiStepToolCallForTests === "function", "Should export executeMultiStepToolCallForTests");
  assert.ok(typeof runtime.resetMultiStepToolRegistryForTests === "function", "Should export resetMultiStepToolRegistryForTests");
});

// Test 20: Verify shims point to same implementations as platform
test("core/runtime distributed-lock shim is consistent with platform", async () => {
  const shim = await import("../../../../src/core/runtime/distributed-lock-service.js");
  const platform = await import("../../../../src/platform/five-plane-execution/distributed-lock/distributed-lock-service.js");

  // Both should export the same classes
  assert.equal(shim.RedisLockAdapter, platform.RedisLockAdapter);
  assert.equal(shim.SqliteLockAdapter, platform.SqliteLockAdapter);
  assert.equal(shim.PgAdvisoryLockAdapter, platform.PgAdvisoryLockAdapter);
});

// Test 21: Verify queue-adapter shim is consistent with platform
test("core/runtime queue-adapter shim is consistent with platform", async () => {
  const shim = await import("../../../../src/core/runtime/queue-adapter.js");
  const platform = await import("../../../../src/platform/five-plane-execution/queue/queue-adapter.js");

  // Both should export the same classes
  assert.equal(shim.RedisQueueAdapter, platform.RedisQueueAdapter);
  assert.equal(shim.SqliteQueueAdapter, platform.SqliteQueueAdapter);
});

// Test 22: Verify process-tracker shim is consistent with platform
test("core/runtime process-tracker shim is consistent with platform", async () => {
  const shim = await import("../../../../src/core/runtime/process-tracker.js");
  const platform = await import("../../../../src/platform/five-plane-execution/resource/process-tracker.js");

  // Both should export the same functions
  assert.equal(shim.getProcessTracker, platform.getProcessTracker);
});