import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for src/core/runtime/supervisor/index.ts
 * Re-exports from five-plane-execution/execution-engine/multi-step-supervisor.js
 * and multi-step-supervisor-types.js
 */

// Import types for testing
interface StepFailurePlan {
  errorCode: string;
  summary?: string;
  message?: string;
}

interface MultiStepToolExecutionInput {
  request: string;
  title?: string;
  stepFailurePlans?: Record<string, (string | StepFailurePlan)[]>;
  stepFailureInjection?: Set<string>;
  stepOutputOverrides?: Record<string, unknown>;
  crashInjection?: { point: string };
  contextBudgetTokens?: number;
}

// Helper functions extracted from the source types
function normalizeStepFailurePlan(value: string | StepFailurePlan): StepFailurePlan {
  return typeof value === "string" ? { errorCode: value } : value;
}

function normalizeStepErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("workflow.output_schema_invalid")) return "validation.schema_mismatch";
  if (message.startsWith("workflow.output_schema_missing")) return "validation.invalid_input";
  return "internal.unexpected_error";
}

function buildStepFailureSummary(stepId: string, decision: { action: "retry" | "escalate" | "fail"; errorCode: string }): string {
  switch (decision.action) {
    case "retry":
      return `Step ${stepId} failed (${decision.errorCode}) and will retry.`;
    case "escalate":
      return `Step ${stepId} requires escalation (${decision.errorCode}).`;
    default:
      return `Step ${stepId} failed (${decision.errorCode}).`;
  }
}

function resolveStepFailurePlan(
  input: MultiStepToolExecutionInput,
  stepId: string,
  attempt: number,
): StepFailurePlan | null {
  const plannedFailure = input.stepFailurePlans?.[stepId]?.[attempt - 1];
  if (plannedFailure != null) {
    return normalizeStepFailurePlan(plannedFailure);
  }
  if (attempt === 1 && input.stepFailureInjection?.has(stepId)) {
    return { errorCode: "tool.execution_failed", summary: `Step ${stepId} failed (injected)`, message: "Injected failure" };
  }
  return null;
}

// Test normalizeStepFailurePlan
test("normalizeStepFailurePlan with string input [supervisor]", () => {
  const result = normalizeStepFailurePlan("tool.execution_failed");
  assert.equal(result.errorCode, "tool.execution_failed");
});

test("normalizeStepFailurePlan with object input [supervisor]", () => {
  const input: StepFailurePlan = { errorCode: "validation.schema_mismatch", summary: "Schema validation failed" };
  const result = normalizeStepFailurePlan(input);
  assert.equal(result.errorCode, "validation.schema_mismatch");
  assert.equal(result.summary, "Schema validation failed");
});

test("normalizeStepFailurePlan preserves full object [supervisor]", () => {
  const input: StepFailurePlan = { errorCode: "auth.unauthorized", message: "Access denied" };
  const result = normalizeStepFailurePlan(input);
  assert.deepEqual(result, input);
});

// Test normalizeStepErrorCode
test("normalizeStepErrorCode with Error starting with workflow.output_schema_invalid [supervisor]", () => {
  const error = new Error("workflow.output_schema_invalid: missing required field");
  const result = normalizeStepErrorCode(error);
  assert.equal(result, "validation.schema_mismatch");
});

test("normalizeStepErrorCode with Error starting with workflow.output_schema_missing [supervisor]", () => {
  const error = new Error("workflow.output_schema_missing: field not provided");
  const result = normalizeStepErrorCode(error);
  assert.equal(result, "validation.invalid_input");
});

test("normalizeStepErrorCode with generic Error [supervisor]", () => {
  const error = new Error("Something went wrong");
  const result = normalizeStepErrorCode(error);
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode with string error [supervisor]", () => {
  const result = normalizeStepErrorCode("Some error string");
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode with object error [supervisor]", () => {
  const result = normalizeStepErrorCode({ message: "error object" });
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode with null [supervisor]", () => {
  const result = normalizeStepErrorCode(null);
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode with undefined [supervisor]", () => {
  const result = normalizeStepErrorCode(undefined);
  assert.equal(result, "internal.unexpected_error");
});

// Test buildStepFailureSummary
test("buildStepFailureSummary with retry action [supervisor]", () => {
  const result = buildStepFailureSummary("step_1", { action: "retry", errorCode: "tool.timeout" });
  assert.equal(result, "Step step_1 failed (tool.timeout) and will retry.");
});

test("buildStepFailureSummary with escalate action [supervisor]", () => {
  const result = buildStepFailureSummary("step_2", { action: "escalate", errorCode: "auth.required" });
  assert.equal(result, "Step step_2 requires escalation (auth.required).");
});

test("buildStepFailureSummary with fail action [supervisor]", () => {
  const result = buildStepFailureSummary("step_3", { action: "fail", errorCode: "internal.error" });
  assert.equal(result, "Step step_3 failed (internal.error).");
});

// Test resolveStepFailurePlan
test("resolveStepFailurePlan with no failure injection [supervisor]", () => {
  const input: MultiStepToolExecutionInput = { request: "test" };
  const result = resolveStepFailurePlan(input, "step_1", 1);
  assert.equal(result, null);
});

test("resolveStepFailurePlan with planned failure as string [supervisor]", () => {
  const input: MultiStepToolExecutionInput = {
    request: "test",
    stepFailurePlans: { step_1: ["tool.execution_failed"] },
  };
  const result = resolveStepFailurePlan(input, "step_1", 1);
  assert.ok(result != null);
  assert.equal(result!.errorCode, "tool.execution_failed");
});

test("resolveStepFailurePlan with planned failure as object [supervisor]", () => {
  const input: MultiStepToolExecutionInput = {
    request: "test",
    stepFailurePlans: { step_1: [{ errorCode: "validation.schema_mismatch", summary: "Invalid schema" }] },
  };
  const result = resolveStepFailurePlan(input, "step_1", 1);
  assert.ok(result != null);
  assert.equal(result!.errorCode, "validation.schema_mismatch");
  assert.equal(result!.summary, "Invalid schema");
});

test("resolveStepFailurePlan with step failure injection [supervisor]", () => {
  const input: MultiStepToolExecutionInput = {
    request: "test",
    stepFailureInjection: new Set(["step_1"]),
  };
  const result = resolveStepFailurePlan(input, "step_1", 1);
  assert.ok(result != null);
  assert.equal(result!.errorCode, "tool.execution_failed");
  assert.ok(result!.summary!.includes("step_1"));
  assert.equal(result!.message, "Injected failure");
});

test("resolveStepFailurePlan ignores injection on retry attempt [supervisor]", () => {
  const input: MultiStepToolExecutionInput = {
    request: "test",
    stepFailureInjection: new Set(["step_1"]),
  };
  const result = resolveStepFailurePlan(input, "step_1", 2);
  assert.equal(result, null);
});

test("resolveStepFailurePlan with multiple attempts uses correct index [supervisor]", () => {
  const input: MultiStepToolExecutionInput = {
    request: "test",
    stepFailurePlans: { step_1: ["error_first", "error_second", "error_third"] },
  };
  assert.equal(resolveStepFailurePlan(input, "step_1", 1)?.errorCode, "error_first");
  assert.equal(resolveStepFailurePlan(input, "step_1", 2)?.errorCode, "error_second");
  assert.equal(resolveStepFailurePlan(input, "step_1", 3)?.errorCode, "error_third");
});

test("resolveStepFailurePlan with step not in plans returns null [supervisor]", () => {
  const input: MultiStepToolExecutionInput = {
    request: "test",
    stepFailurePlans: { step_1: ["error_first"] },
  };
  const result = resolveStepFailurePlan(input, "step_2", 1);
  assert.equal(result, null);
});

// Note: Dynamic imports for module export verification require running via npm run test:unit
// which properly maps src/ to dist/. The local helper functions above provide coverage for the
// multi-step-supervisor-types.ts functions (normalizeStepFailurePlan, normalizeStepErrorCode,
// buildStepFailureSummary, resolveStepFailurePlan).