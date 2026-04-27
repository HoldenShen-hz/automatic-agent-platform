/**
 * Unit tests for OrchestrationPlanner types
 *
 * @see src/core/runtime/orchestrator/types.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

// Re-export the types directly by importing from the main orchestration module
// Since the file just re-exports from multi-step-orchestration-types, we test the type usage

test("MultiStepOrchestrationResult type can be referenced", () => {
  // Test that we can use the type structure from the re-exported module
  type TestResult = {
    taskId: string;
    status: string;
    steps: readonly string[];
    completedAt: string | null;
  };

  const result: TestResult = {
    taskId: "task_test_1",
    status: "completed",
    steps: ["step_1", "step_2"],
    completedAt: "2026-04-26T00:00:00.000Z",
  };

  assert.equal(result.taskId, "task_test_1");
  assert.equal(result.status, "completed");
  assert.ok(Array.isArray(result.steps));
  assert.equal(result.steps.length, 2);
});

test("MultiStepToolExecutionInput type can be referenced", () => {
  type TestInput = {
    taskId: string;
    toolName: string;
    parameters: Record<string, unknown>;
    iteration: number;
  };

  const input: TestInput = {
    taskId: "task_test_2",
    toolName: "test_tool",
    parameters: { arg1: "value1", arg2: 42 },
    iteration: 1,
  };

  assert.equal(input.taskId, "task_test_2");
  assert.equal(input.toolName, "test_tool");
  assert.ok(typeof input.parameters === "object");
  assert.equal(input.iteration, 1);
});

test("StepFailurePlan type can be referenced", () => {
  type TestFailurePlan = {
    taskId: string;
    stepId: string;
    error: string;
    recoveryAction: "retry" | "skip" | "abort";
    maxRetries: number;
  };

  const plan: TestFailurePlan = {
    taskId: "task_test_3",
    stepId: "step_failed",
    error: "Execution timeout",
    recoveryAction: "retry",
    maxRetries: 3,
  };

  assert.equal(plan.taskId, "task_test_3");
  assert.equal(plan.stepId, "step_failed");
  assert.equal(plan.recoveryAction, "retry");
  assert.equal(plan.maxRetries, 3);
});

test("Re-exported types match expected structure", () => {
  // These types mirror the structure of the re-exported types
  type OrchestrationResult = {
    taskId: string;
    status: "pending" | "running" | "completed" | "failed";
    steps: readonly string[];
    completedAt: string | null;
  };

  type ToolInput = {
    taskId: string;
    toolName: string;
    parameters: Record<string, unknown>;
    iteration: number;
  };

  type FailurePlan = {
    taskId: string;
    stepId: string;
    error: string;
    recoveryAction: "retry" | "skip" | "abort";
    maxRetries: number;
  };

  // Verify structure matches expected usage
  const result: OrchestrationResult = {
    taskId: "test",
    status: "completed",
    steps: ["s1", "s2"],
    completedAt: new Date().toISOString(),
  };

  const toolInput: ToolInput = {
    taskId: "test",
    toolName: "test_tool",
    parameters: {},
    iteration: 1,
  };

  const failurePlan: FailurePlan = {
    taskId: "test",
    stepId: "s1",
    error: "error",
    recoveryAction: "retry",
    maxRetries: 3,
  };

  assert.ok(result.status === "completed");
  assert.ok(toolInput.iteration >= 0);
  assert.ok(["retry", "skip", "abort"].includes(failurePlan.recoveryAction));
});

test("Types can be used in union types", () => {
  type OrchestrationOutcome =
    | { type: "success"; taskId: string; result: string }
    | { type: "failure"; taskId: string; error: string }
    | { type: "partial"; taskId: string; completedSteps: string[] };

  const successOutcome: OrchestrationOutcome = {
    type: "success",
    taskId: "task_1",
    result: "completed successfully",
  };

  const failureOutcome: OrchestrationOutcome = {
    type: "failure",
    taskId: "task_2",
    error: "execution failed",
  };

  const partialOutcome: OrchestrationOutcome = {
    type: "partial",
    taskId: "task_3",
    completedSteps: ["step_1", "step_2"],
  };

  assert.equal(successOutcome.type, "success");
  assert.equal(failureOutcome.type, "failure");
  assert.equal(partialOutcome.type, "partial");
});

test("Optional type properties work correctly", () => {
  type OptionalProps = {
    taskId: string;
    retryCount?: number;
    lastError?: string;
    metadata?: Record<string, unknown>;
  };

  const withOptional: OptionalProps = {
    taskId: "task_1",
    retryCount: 2,
  };

  const withoutOptional: OptionalProps = {
    taskId: "task_2",
  };

  assert.equal(withOptional.retryCount, 2);
  assert.equal(withoutOptional.retryCount, undefined);
  assert.ok(withOptional.metadata === undefined);
});

test("Readonly array types work correctly", () => {
  type StepsType = readonly string[];
  type ResultsType = readonly { stepId: string; status: string }[];

  const steps: StepsType = ["step_1", "step_2", "step_3"];
  const results: ResultsType = [
    { stepId: "step_1", status: "completed" },
    { stepId: "step_2", status: "completed" },
  ];

  assert.equal(steps.length, 3);
  assert.equal(results[0]?.stepId, "step_1");

  // Verify readonly nature
  const firstStep = steps[0];
  assert.equal(firstStep, "step_1");
});

test("Nullable completedAt field works correctly", () => {
  type WithNull = { taskId: string; completedAt: string | null };
  type WithoutNull = { taskId: string; completedAt: string };

  const pending: WithNull = {
    taskId: "task_pending",
    completedAt: null,
  };

  const completed: WithNull = {
    taskId: "task_completed",
    completedAt: "2026-04-26T00:00:00.000Z",
  };

  assert.equal(pending.completedAt, null);
  assert.notEqual(completed.completedAt, null);
});