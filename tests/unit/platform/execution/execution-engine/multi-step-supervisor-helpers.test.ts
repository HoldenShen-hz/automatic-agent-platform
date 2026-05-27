/**
 * Unit Tests: multi-step-supervisor helper functions
 *
 * Tests for:
 * - normalizeStepFailurePlan()
 * - resolveStepFailurePlan()
 * - normalizeStepErrorCode()
 * - buildStepFailureSummary()
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeStepFailurePlan,
  resolveStepFailurePlan,
  normalizeStepErrorCode,
  buildStepFailureSummary,
} from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-supervisor.js";
import type { StepFailurePlan, MultiStepToolExecutionInput } from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration-types.js";
import type { WorkflowStepRetryDecision } from "../../../../../src/platform/five-plane-orchestration/oapeflir/workflow/workflow-step-retry-policy.js";

// =============================================================================
// normalizeStepFailurePlan tests
// =============================================================================

test("normalizeStepFailurePlan returns string as StepFailurePlan with errorCode [multi-step-supervisor-helpers]", () => {
  const result = normalizeStepFailurePlan("tool.execution_failed");
  assert.equal(result.errorCode, "tool.execution_failed");
});

test("normalizeStepFailurePlan returns StepFailurePlan unchanged [multi-step-supervisor-helpers]", () => {
  const input: StepFailurePlan = { errorCode: "validation.schema_mismatch", summary: "Schema validation failed" };
  const result = normalizeStepFailurePlan(input);
  assert.equal(result.errorCode, "validation.schema_mismatch");
  assert.equal(result.summary, "Schema validation failed");
});

test("normalizeStepFailurePlan preserves message when present [multi-step-supervisor-helpers]", () => {
  const input: StepFailurePlan = { errorCode: "timeout", message: "Step timed out after 30s" };
  const result = normalizeStepFailurePlan(input);
  assert.equal(result.message, "Step timed out after 30s");
});

// =============================================================================
// resolveStepFailurePlan tests
// =============================================================================

test("resolveStepFailurePlan returns null when no failure plans configured [multi-step-supervisor-helpers]", () => {
  const input = createMockInput({});
  const result = resolveStepFailurePlan(input, "step_1", 1);
  assert.equal(result, null);
});

test("resolveStepFailurePlan returns planned failure from stepFailurePlans [multi-step-supervisor-helpers]", () => {
  const input = createMockInput({
    stepFailurePlans: {
      "step_1": [{ errorCode: "planned_failure" }],
    },
  });
  const result = resolveStepFailurePlan(input, "step_1", 1);
  assert.ok(result !== null);
  assert.equal(result!.errorCode, "planned_failure");
});

test("resolveStepFailurePlan returns null for step with no plan [multi-step-supervisor-helpers]", () => {
  const input = createMockInput({
    stepFailurePlans: {
      "step_1": [{ errorCode: "planned_failure" }],
    },
  });
  const result = resolveStepFailurePlan(input, "step_2", 1);
  assert.equal(result, null);
});

test("resolveStepFailurePlan returns null for attempt beyond planned count [multi-step-supervisor-helpers]", () => {
  const input = createMockInput({
    stepFailurePlans: {
      "step_1": [{ errorCode: "attempt_1" }, { errorCode: "attempt_2" }],
    },
  });
  const result = resolveStepFailurePlan(input, "step_1", 3);
  assert.equal(result, null);
});

test("resolveStepFailurePlan handles string StepFailurePlan in plan array [multi-step-supervisor-helpers]", () => {
  const input = createMockInput({
    stepFailurePlans: {
      "step_1": ["string_failure_code"],
    },
  });
  const result = resolveStepFailurePlan(input, "step_1", 1);
  assert.ok(result !== null);
  assert.equal(result!.errorCode, "string_failure_code");
});

test("resolveStepFailurePlan returns injected failure from stepFailureInjection on first attempt [multi-step-supervisor-helpers]", () => {
  const input = createMockInput({
    stepFailureInjection: new Set(["step_injected"]),
  });
  const result = resolveStepFailurePlan(input, "step_injected", 1);
  assert.ok(result !== null);
  assert.equal(result!.errorCode, "tool.execution_failed");
  assert.ok(result!.summary!.includes("injected"));
});

test("resolveStepFailurePlan returns null from stepFailureInjection on second attempt [multi-step-supervisor-helpers]", () => {
  const input = createMockInput({
    stepFailureInjection: new Set(["step_injected"]),
  });
  const result = resolveStepFailurePlan(input, "step_injected", 2);
  assert.equal(result, null);
});

test("resolveStepFailurePlan planned failure takes precedence over injection [multi-step-supervisor-helpers]", () => {
  const input = createMockInput({
    stepFailurePlans: {
      "step_injected": [{ errorCode: "planned_priority" }],
    },
    stepFailureInjection: new Set(["step_injected"]),
  });
  const result = resolveStepFailurePlan(input, "step_injected", 1);
  assert.ok(result !== null);
  assert.equal(result!.errorCode, "planned_priority");
});

// =============================================================================
// normalizeStepErrorCode tests
// =============================================================================

test("normalizeStepErrorCode returns validation.schema_mismatch for workflow output schema invalid [multi-step-supervisor-helpers]", () => {
  const error = new Error("workflow.output_schema_invalid: field X missing");
  const result = normalizeStepErrorCode(error);
  assert.equal(result, "validation.schema_mismatch");
});

test("normalizeStepErrorCode returns validation.invalid_input for workflow output schema missing [multi-step-supervisor-helpers]", () => {
  const error = new Error("workflow.output_schema_missing: output not found");
  const result = normalizeStepErrorCode(error);
  assert.equal(result, "validation.invalid_input");
});

test("normalizeStepErrorCode returns internal.unexpected_error for generic errors [multi-step-supervisor-helpers]", () => {
  const error = new Error("Something went wrong");
  const result = normalizeStepErrorCode(error);
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode handles non-Error inputs [multi-step-supervisor-helpers]", () => {
  const result = normalizeStepErrorCode("string error");
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode handles null/undefined [multi-step-supervisor-helpers]", () => {
  const result1 = normalizeStepErrorCode(null);
  const result2 = normalizeStepErrorCode(undefined);
  assert.equal(result1, "internal.unexpected_error");
  assert.equal(result2, "internal.unexpected_error");
});

test("normalizeStepErrorCode uses startsWith for prefix matching [multi-step-supervisor-helpers]", () => {
  const error = new Error("workflow.output_schema_invalid longer message here");
  const result = normalizeStepErrorCode(error);
  assert.equal(result, "validation.schema_mismatch");
});

// =============================================================================
// buildStepFailureSummary tests
// =============================================================================

test("buildStepFailureSummary returns retry message when action is retry [multi-step-supervisor-helpers]", () => {
  const decision: WorkflowStepRetryDecision = { action: "retry", errorCode: "tool.timeout", failureClass: "transient", retryable: true, backoff: "none", retryDelayMs: 1000 };
  const result = buildStepFailureSummary("step_1", decision);
  assert.ok(result.includes("retry"));
  assert.ok(result.includes("step_1"));
  assert.ok(result.includes("tool.timeout"));
});

test("buildStepFailureSummary returns escalate message when action is escalate [multi-step-supervisor-helpers]", () => {
  const decision: WorkflowStepRetryDecision = { action: "escalate", errorCode: "workflow.circuit_broken", failureClass: "destructive", retryable: false, backoff: "none", retryDelayMs: 0 };
  const result = buildStepFailureSummary("step_2", decision);
  assert.ok(result.includes("escalation"));
  assert.ok(result.includes("step_2"));
  assert.ok(result.includes("workflow.circuit_broken"));
});

test("buildStepFailureSummary returns step failed message for default action [multi-step-supervisor-helpers]", () => {
  const decision: WorkflowStepRetryDecision = { action: "fail", errorCode: "internal.error", failureClass: "non_retryable", retryable: false, backoff: "none", retryDelayMs: 0 };
  const result = buildStepFailureSummary("step_3", decision);
  assert.ok(result.includes("failed"));
  assert.ok(result.includes("step_3"));
  assert.ok(result.includes("internal.error"));
});

test("buildStepFailureSummary includes error code in message [multi-step-supervisor-helpers]", () => {
  const decision: WorkflowStepRetryDecision = { action: "retry", errorCode: "validation.timeout", failureClass: "transient", retryable: true, backoff: "exponential", retryDelayMs: 2000 };
  const result = buildStepFailureSummary("validate_step", decision);
  assert.ok(result.includes("validation.timeout"));
});

// =============================================================================
// Helper
// =============================================================================

function createMockInput(overrides: Partial<MultiStepToolExecutionInput> & {
  stepFailurePlans?: Readonly<Record<string, readonly (string | StepFailurePlan)[]>>;
  stepFailureInjection?: ReadonlySet<string>;
}): MultiStepToolExecutionInput {
  return {
    dbPath: "/tmp/test.db",
    title: "Test",
    request: "Test request",
    ...overrides,
  } as MultiStepToolExecutionInput;
}