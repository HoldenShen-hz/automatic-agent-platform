import assert from "node:assert/strict";
import test from "node:test";
import type {
  MultiStepOrchestrationResult,
  MultiStepToolExecutionInput,
  StepFailurePlan,
} from "../../../../src/core/runtime/orchestrator/types.js";

/**
 * Tests for src/core/runtime/orchestrator/types.ts
 * Re-exports types from multi-step-orchestration-types.js
 */
test("orchestrator types exports MultiStepOrchestrationResult", () => {
  const result = {} as MultiStepOrchestrationResult;
  assert.equal(typeof result, "object");
});

test("orchestrator types exports MultiStepToolExecutionInput", () => {
  const input = {} as MultiStepToolExecutionInput;
  assert.equal(typeof input, "object");
});

test("orchestrator types exports StepFailurePlan", () => {
  const plan = {} as StepFailurePlan;
  assert.equal(typeof plan, "object");
});

test("StepFailurePlan has expected shape when object is constructed", () => {
  // StepFailurePlan should have errorCode as required and optional summary/message
  const plan: StepFailurePlan = {
    errorCode: "test_error",
    summary: "Test summary",
    message: "Test message",
  };
  assert.equal(plan.errorCode, "test_error");
  assert.equal(plan.summary, "Test summary");
  assert.equal(plan.message, "Test message");
});

test("MultiStepOrchestrationResult type can be referenced in type position", () => {
  const result = {} as MultiStepOrchestrationResult;
  assert.equal(typeof result, "object");
});

test("MultiStepToolExecutionInput type can be referenced in type position", () => {
  const input = {} as MultiStepToolExecutionInput;
  assert.equal(typeof input, "object");
});
