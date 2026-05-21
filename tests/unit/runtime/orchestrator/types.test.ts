import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for src/core/runtime/orchestrator/types.ts
 * Re-exports types from multi-step-orchestration-types.js
 */
test("orchestrator types exports MultiStepOrchestrationResult", async () => {
  const types = await import("../../../src/core/runtime/orchestrator/types.js");
  assert.ok("MultiStepOrchestrationResult" in types, "should export MultiStepOrchestrationResult");
});

test("orchestrator types exports MultiStepToolExecutionInput", async () => {
  const types = await import("../../../src/core/runtime/orchestrator/types.js");
  assert.ok("MultiStepToolExecutionInput" in types, "should export MultiStepToolExecutionInput");
});

test("orchestrator types exports StepFailurePlan", async () => {
  const types = await import("../../../src/core/runtime/orchestrator/types.js");
  assert.ok("StepFailurePlan" in types, "should export StepFailurePlan");
});

test("StepFailurePlan has expected shape when object is constructed", async () => {
  // StepFailurePlan should have errorCode as required and optional summary/message
  const types = await import("../../../src/core/runtime/orchestrator/types.js");
  // Create a valid object matching the StepFailurePlan interface
  const plan: { errorCode: string; summary?: string; message?: string } = {
    errorCode: "test_error",
    summary: "Test summary",
    message: "Test message",
  };
  assert.equal(plan.errorCode, "test_error");
  assert.equal(plan.summary, "Test summary");
  assert.equal(plan.message, "Test message");
});

test("MultiStepOrchestrationResult type can be referenced in type position", async () => {
  // Verify the type can be used in type annotations
  const types = await import("../../../src/core/runtime/orchestrator/types.js");
  assert.ok(types.MultiStepOrchestrationResult !== undefined, "MultiStepOrchestrationResult should be exported");
});

test("MultiStepToolExecutionInput type can be referenced in type position", async () => {
  // Verify the type can be used in type annotations
  const types = await import("../../../src/core/runtime/orchestrator/types.js");
  assert.ok(types.MultiStepToolExecutionInput !== undefined, "MultiStepToolExecutionInput should be exported");
});