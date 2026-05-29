import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for src/core/runtime/index.ts
 * This file re-exports from multiple five-plane execution modules.
 * Coverage: 0% (all statements/skipped)
 */
test("runtime index re-exports AdmissionController [runtime-bootstrap]", async () => {
  const runtime = await import("../../../src/core/runtime/index.js");
  assert.ok("AdmissionController" in runtime, "should export AdmissionController");
});

test("runtime index re-exports ComplexityRouter [runtime-bootstrap]", async () => {
  const runtime = await import("../../../src/core/runtime/index.js");
  assert.ok("routeComplexity" in runtime, "should export routeComplexity");
});

test("runtime index re-exports ContextCompactionService [runtime-bootstrap]", async () => {
  const runtime = await import("../../../src/core/runtime/index.js");
  assert.ok("ContextCompactionService" in runtime, "should export ContextCompactionService");
});

test("runtime index re-exports EffectBuffer [runtime-bootstrap]", async () => {
  const runtime = await import("../../../src/core/runtime/index.js");
  assert.ok("EffectBuffer" in runtime, "should export EffectBuffer");
});

test("runtime index re-exports ExecutionDispatchService [runtime-bootstrap]", async () => {
  const runtime = await import("../../../src/core/runtime/index.js");
  assert.ok("ExecutionDispatchService" in runtime, "should export ExecutionDispatchService");
});

test("runtime index re-exports ExecutionLeaseService [runtime-bootstrap]", async () => {
  const runtime = await import("../../../src/core/runtime/index.js");
  assert.ok("ExecutionLeaseService" in runtime, "should export ExecutionLeaseService");
});

test("runtime index re-exports GracefulShutdown [runtime-bootstrap]", async () => {
  const runtime = await import("../../../src/core/runtime/index.js");
  assert.ok("GracefulShutdown" in runtime, "should export GracefulShutdown");
});

test("runtime index re-exports LoopDetection [runtime-bootstrap]", async () => {
  const runtime = await import("../../../src/core/runtime/index.js");
  assert.ok("LoopDetectionState" in runtime, "should export LoopDetectionState");
});

test("runtime index re-exports orchestrator module [runtime-bootstrap]", async () => {
  const runtime = await import("../../../src/core/runtime/index.js");
  assert.ok("runMultiStepOrchestration" in runtime, "should export runMultiStepOrchestration");
});

test("runtime index re-exports OutputContinuationService [runtime-bootstrap]", async () => {
  const runtime = await import("../../../src/core/runtime/index.js");
  assert.ok("OutputContinuationService" in runtime, "should export OutputContinuationService");
});

test("runtime index re-exports RuntimeContext [runtime-bootstrap]", async () => {
  const runtime = await import("../../../src/core/runtime/index.js");
  assert.ok("getContext" in runtime, "should export runtime context helpers");
});

test("runtime index re-exports RuntimeFactory [runtime-bootstrap]", async () => {
  const runtime = await import("../../../src/core/runtime/index.js");
  assert.ok("createRuntimeServices" in runtime, "should export createRuntimeServices");
});

test("runtime index re-exports WorkerRegistryService [runtime-bootstrap]", async () => {
  const runtime = await import("../../../src/core/runtime/index.js");
  assert.ok("WorkerRegistryService" in runtime, "should export WorkerRegistryService");
});

test("runtime index re-exports workflow step checkpoint schema version [runtime-bootstrap]", async () => {
  const runtime = await import("../../../src/core/runtime/index.js");
  assert.equal(
    runtime.WORKFLOW_STEP_CHECKPOINT_SCHEMA_VERSION,
    "workflow_step_checkpoint.v1",
    "should export workflow step checkpoint schema version",
  );
});

test("runtime index re-exports createWorkflowStepCheckpoint [runtime-bootstrap]", async () => {
  const runtime = await import("../../../src/core/runtime/index.js");
  assert.ok("createWorkflowStepCheckpoint" in runtime, "should export createWorkflowStepCheckpoint");
});

test("runtime index exports are callable functions or classes [runtime-bootstrap]", async () => {
  const runtime = await import("../../../src/core/runtime/index.js");

  // Verify key exports are functions or classes
  if ("AdmissionController" in runtime) {
    assert.ok(typeof runtime.AdmissionController === "function", "AdmissionController should be a function");
  }
  if ("GracefulShutdown" in runtime) {
    assert.ok(typeof runtime.GracefulShutdown === "function", "GracefulShutdown should be a function");
  }
});
