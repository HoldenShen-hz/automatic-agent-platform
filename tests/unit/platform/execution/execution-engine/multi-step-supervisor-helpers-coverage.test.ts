/**
 * Unit Tests: multi-step-supervisor helper functions - Extended Coverage
 *
 * Tests for untested edge cases in the exported helper functions from multi-step-supervisor.ts:
 * - normalizeStepFailurePlan edge cases
 * - resolveStepFailurePlan edge cases
 * - normalizeStepErrorCode edge cases
 * - buildStepFailureSummary edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeStepFailurePlan,
  resolveStepFailurePlan,
  normalizeStepErrorCode,
  buildStepFailureSummary,
} from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-supervisor.js";
import type { MultiStepToolExecutionInput, StepFailurePlan } from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration-types.js";
import type { WorkflowStepRetryDecision } from "../../../../../src/platform/five-plane-orchestration/oapeflir/workflow/workflow-step-retry-policy.js";

// =============================================================================
// normalizeStepFailurePlan edge case tests
// =============================================================================

test("normalizeStepFailurePlan returns errorCode for string input", () => {
  const result = normalizeStepFailurePlan("custom.error_code");
  assert.equal(result.errorCode, "custom.error_code");
  assert.equal(result.summary, undefined);
  assert.equal(result.message, undefined);
});

test("normalizeStepFailurePlan preserves full StepFailurePlan with all fields", () => {
  const input: StepFailurePlan = {
    errorCode: "validation.failed",
    summary: "Validation failed summary",
    message: "Detailed validation message",
    retryable: true,
  };
  const result = normalizeStepFailurePlan(input);
  assert.equal(result.errorCode, "validation.failed");
  assert.equal(result.summary, "Validation failed summary");
  assert.equal(result.message, "Detailed validation message");
  assert.equal((result as StepFailurePlan & { retryable?: boolean }).retryable, true);
});

test("normalizeStepFailurePlan handles StepFailurePlan with only errorCode", () => {
  const input: StepFailurePlan = { errorCode: "only_error_code" };
  const result = normalizeStepFailurePlan(input);
  assert.equal(result.errorCode, "only_error_code");
});

test("normalizeStepFailurePlan handles empty string", () => {
  const result = normalizeStepFailurePlan("");
  assert.equal(result.errorCode, "");
});

test("normalizeStepFailurePlan handles string with special characters", () => {
  const result = normalizeStepFailurePlan("error.with.dots.and_underscores");
  assert.equal(result.errorCode, "error.with.dots.and_underscores");
});

test("normalizeStepFailurePlan handles string resembling JSON", () => {
  const result = normalizeStepFailurePlan('{"key": "value"}');
  assert.equal(result.errorCode, '{"key": "value"}');
});

// =============================================================================
// resolveStepFailurePlan edge case tests
// =============================================================================

function createMockInput(overrides: Partial<MultiStepToolExecutionInput> & {
  stepFailurePlans?: Readonly<Record<string, readonly (string | StepFailurePlan)[]>>;
  stepFailureInjection?: ReadonlySet<string>;
} = {}): MultiStepToolExecutionInput {
  return {
    dbPath: "/tmp/test.db",
    title: "Test",
    request: "Test request",
    ...overrides,
  } as MultiStepToolExecutionInput;
}

test("resolveStepFailurePlan returns null when stepFailurePlans is undefined", () => {
  const input = createMockInput({ stepFailurePlans: undefined });
  const result = resolveStepFailurePlan(input, "step_1", 1);
  assert.equal(result, null);
});

test("resolveStepFailurePlan returns null when stepFailurePlans is empty object", () => {
  const input = createMockInput({ stepFailurePlans: {} });
  const result = resolveStepFailurePlan(input, "step_1", 1);
  assert.equal(result, null);
});

test("resolveStepFailurePlan returns null when step has no plans", () => {
  const input = createMockInput({
    stepFailurePlans: { other_step: [{ errorCode: "other" }] },
  });
  const result = resolveStepFailurePlan(input, "step_1", 1);
  assert.equal(result, null);
});

test("resolveStepFailurePlan returns null for attempt 0", () => {
  const input = createMockInput({
    stepFailurePlans: { step_1: [{ errorCode: "attempt_1" }] },
  });
  const result = resolveStepFailurePlan(input, "step_1", 0);
  assert.equal(result, null);
});

test("resolveStepFailurePlan returns planned failure for attempt 1", () => {
  const input = createMockInput({
    stepFailurePlans: { step_1: [{ errorCode: "first_attempt" }] },
  });
  const result = resolveStepFailurePlan(input, "step_1", 1);
  assert.ok(result !== null);
  assert.equal(result!.errorCode, "first_attempt");
});

test("resolveStepFailurePlan returns planned failure for second attempt", () => {
  const input = createMockInput({
    stepFailurePlans: {
      step_1: [{ errorCode: "first" }, { errorCode: "second" }, { errorCode: "third" }],
    },
  });
  const result = resolveStepFailurePlan(input, "step_1", 2);
  assert.ok(result !== null);
  assert.equal(result!.errorCode, "second");
});

test("resolveStepFailurePlan returns planned failure for last attempt", () => {
  const input = createMockInput({
    stepFailurePlans: {
      step_1: [{ errorCode: "attempt_1" }, { errorCode: "attempt_2" }],
    },
  });
  const result = resolveStepFailurePlan(input, "step_1", 2);
  assert.ok(result !== null);
  assert.equal(result!.errorCode, "attempt_2");
});

test("resolveStepFailurePlan mixes string and object plans", () => {
  const input = createMockInput({
    stepFailurePlans: {
      step_1: ["string_code", { errorCode: "object_code" }],
    },
  });
  const result1 = resolveStepFailurePlan(input, "step_1", 1);
  const result2 = resolveStepFailurePlan(input, "step_1", 2);
  assert.ok(result1 !== null);
  assert.ok(result2 !== null);
  assert.equal(result1!.errorCode, "string_code");
  assert.equal(result2!.errorCode, "object_code");
});

test("resolveStepFailurePlan injection takes precedence over no plan", () => {
  const input = createMockInput({
    stepFailureInjection: new Set(["injected_step"]),
  });
  const result = resolveStepFailurePlan(input, "injected_step", 1);
  assert.ok(result !== null);
  assert.equal(result!.errorCode, "tool.execution_failed");
  assert.ok(result!.summary!.includes("injected"));
});

test("resolveStepFailurePlan planned failure takes precedence over injection", () => {
  const input = createMockInput({
    stepFailurePlans: { injected_step: [{ errorCode: "planned" }] },
    stepFailureInjection: new Set(["injected_step"]),
  });
  const result = resolveStepFailurePlan(input, "injected_step", 1);
  assert.ok(result !== null);
  assert.equal(result!.errorCode, "planned");
});

test("resolveStepFailurePlan injection does not apply on attempt 2", () => {
  const input = createMockInput({
    stepFailureInjection: new Set(["step_to_inject"]),
  });
  const result = resolveStepFailurePlan(input, "step_to_inject", 2);
  assert.equal(result, null);
});

test("resolveStepFailurePlan handles undefined stepFailureInjection", () => {
  const input = createMockInput({ stepFailureInjection: undefined });
  const result = resolveStepFailurePlan(input, "any_step", 1);
  assert.equal(result, null);
});

test("resolveStepFailurePlan handles empty stepFailureInjection set", () => {
  const input = createMockInput({ stepFailureInjection: new Set() });
  const result = resolveStepFailurePlan(input, "any_step", 1);
  assert.equal(result, null);
});

test("resolveStepFailurePlan returns null for negative attempt", () => {
  const input = createMockInput({
    stepFailurePlans: { step_1: [{ errorCode: "neg_attempt" }] },
  });
  const result = resolveStepFailurePlan(input, "step_1", -1);
  assert.equal(result, null);
});

test("resolveStepFailurePlan handles very large attempt number", () => {
  const input = createMockInput({
    stepFailurePlans: { step_1: [{ errorCode: "only_one" }] },
  });
  const result = resolveStepFailurePlan(input, "step_1", 999999);
  assert.equal(result, null);
});

test("resolveStepFailurePlan injection summary format", () => {
  const input = createMockInput({
    stepFailureInjection: new Set(["my_step"]),
  });
  const result = resolveStepFailurePlan(input, "my_step", 1);
  assert.ok(result !== null);
  assert.ok(result!.summary!.includes("my_step"));
  assert.ok(result!.summary!.includes("injected"));
  assert.equal(result!.message, "Injected failure");
});

// =============================================================================
// normalizeStepErrorCode edge case tests
// =============================================================================

test("normalizeStepErrorCode handles workflow.output_schema_invalid prefix", () => {
  const error = new Error("workflow.output_schema_invalid: some field missing");
  const result = normalizeStepErrorCode(error);
  assert.equal(result, "validation.schema_mismatch");
});

test("normalizeStepErrorCode handles workflow.output_schema_missing prefix", () => {
  const error = new Error("workflow.output_schema_missing: output key not found");
  const result = normalizeStepErrorCode(error);
  assert.equal(result, "validation.invalid_input");
});

test("normalizeStepErrorCode returns internal.unexpected_error for generic Error", () => {
  const error = new Error("Something broke");
  const result = normalizeStepErrorCode(error);
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode handles Error with empty message", () => {
  const error = new Error("");
  const result = normalizeStepErrorCode(error);
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode handles non-Error string", () => {
  const result = normalizeStepErrorCode("plain string error");
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode handles non-Error number", () => {
  const result = normalizeStepErrorCode(12345);
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode handles non-Error object", () => {
  const result = normalizeStepErrorCode({ message: "error object" });
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode handles null", () => {
  const result = normalizeStepErrorCode(null);
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode handles undefined", () => {
  const result = normalizeStepErrorCode(undefined);
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode handles Error with long message", () => {
  const longMessage = "workflow.output_schema_invalid" + "x".repeat(1000);
  const error = new Error(longMessage);
  const result = normalizeStepErrorCode(error);
  assert.equal(result, "validation.schema_mismatch");
});

test("normalizeStepErrorCode handles message with multiple prefixes", () => {
  // Should match first prefix (output_schema_invalid)
  const error = new Error("workflow.output_schema_invalid and then workflow.output_schema_missing");
  const result = normalizeStepErrorCode(error);
  assert.equal(result, "validation.schema_mismatch");
});

test("normalizeStepErrorCode handles empty Error message", () => {
  const error = new Error();
  const result = normalizeStepErrorCode(error);
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode handles string that looks like error code", () => {
  const result = normalizeStepErrorCode("validation.schema_mismatch");
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode handles Symbol", () => {
  const result = normalizeStepErrorCode(Symbol("error"));
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode handles function", () => {
  const result = normalizeStepErrorCode(() => { throw new Error(); });
  assert.equal(result, "internal.unexpected_error");
});

// =============================================================================
// buildStepFailureSummary edge case tests
// =============================================================================

test("buildStepFailureSummary retry action format", () => {
  const decision: WorkflowStepRetryDecision = {
    action: "retry",
    errorCode: "timeout",
    failureClass: "transient",
    retryable: true,
    backoff: "none",
    retryDelayMs: 0,
  };
  const result = buildStepFailureSummary("test_step", decision);
  assert.ok(result.includes("test_step"));
  assert.ok(result.includes("retry"));
  assert.ok(result.includes("timeout"));
});

test("buildStepFailureSummary escalate action format", () => {
  const decision: WorkflowStepRetryDecision = {
    action: "escalate",
    errorCode: "auth.failed",
    failureClass: "destructive",
    retryable: false,
    backoff: "none",
    retryDelayMs: 0,
  };
  const result = buildStepFailureSummary("escalate_step", decision);
  assert.ok(result.includes("escalate_step"));
  assert.ok(result.includes("escalation"));
  assert.ok(result.includes("auth.failed"));
});

test("buildStepFailureSummary fail action format", () => {
  const decision: WorkflowStepRetryDecision = {
    action: "fail",
    errorCode: "unrecoverable",
    failureClass: "non_retryable",
    retryable: false,
    backoff: "none",
    retryDelayMs: 0,
  };
  const result = buildStepFailureSummary("fail_step", decision);
  assert.ok(result.includes("fail_step"));
  assert.ok(result.includes("failed"));
  assert.ok(result.includes("unrecoverable"));
});

test("buildStepFailureSummary handles unknown action (default)", () => {
  const decision: WorkflowStepRetryDecision = {
    action: "unknown_action" as "retry" | "escalate" | "fail",
    errorCode: "unknown",
    failureClass: "unknown",
    retryable: false,
    backoff: "none",
    retryDelayMs: 0,
  };
  const result = buildStepFailureSummary("any_step", decision);
  assert.ok(result.includes("any_step"));
  assert.ok(result.includes("failed"));
  assert.ok(result.includes("unknown"));
});

test("buildStepFailureSummary includes stepId in all cases", () => {
  const stepIds = ["step_1", "my_step", "unicode_步骤", "step-with-chars_123"];

  for (const stepId of stepIds) {
    const decision: WorkflowStepRetryDecision = {
      action: "retry",
      errorCode: "test",
      failureClass: "transient",
      retryable: true,
      backoff: "exponential",
      retryDelayMs: 1000,
    };
    const result = buildStepFailureSummary(stepId, decision);
    assert.ok(result.includes(stepId), `Result should include stepId: ${stepId}`);
  }
});

test("buildStepFailureSummary includes errorCode in all cases", () => {
  const errorCodes = ["code1", "a.b.c", "validation.error", "123_error"];

  for (const errorCode of errorCodes) {
    const decision: WorkflowStepRetryDecision = {
      action: "fail",
      errorCode,
      failureClass: "non_retryable",
      retryable: false,
      backoff: "none",
      retryDelayMs: 0,
    };
    const result = buildStepFailureSummary("test_step", decision);
    assert.ok(result.includes(errorCode), `Result should include errorCode: ${errorCode}`);
  }
});

test("buildStepFailureSummary with exponential backoff", () => {
  const decision: WorkflowStepRetryDecision = {
    action: "retry",
    errorCode: "transient",
    failureClass: "transient",
    retryable: true,
    backoff: "exponential",
    retryDelayMs: 5000,
  };
  const result = buildStepFailureSummary("backoff_step", decision);
  assert.ok(result.includes("backoff_step"));
  assert.ok(result.includes("retry"));
});

test("buildStepFailureSummary with linear backoff", () => {
  const decision: WorkflowStepRetryDecision = {
    action: "retry",
    errorCode: "transient",
    failureClass: "transient",
    retryable: true,
    backoff: "linear",
    retryDelayMs: 3000,
  };
  const result = buildStepFailureSummary("linear_step", decision);
  assert.ok(result.includes("linear_step"));
});

test("buildStepFailureSummary with long error code", () => {
  const longErrorCode = "validation." + "x".repeat(100);
  const decision: WorkflowStepRetryDecision = {
    action: "fail",
    errorCode: longErrorCode,
    failureClass: "non_retryable",
    retryable: false,
    backoff: "none",
    retryDelayMs: 0,
  };
  const result = buildStepFailureSummary("long_error_step", decision);
  assert.ok(result.includes(longErrorCode));
});

test("buildStepFailureSummary with unicode stepId", () => {
  const decision: WorkflowStepRetryDecision = {
    action: "retry",
    errorCode: "unicode_error",
    failureClass: "transient",
    retryable: true,
    backoff: "none",
    retryDelayMs: 0,
  };
  const result = buildStepFailureSummary("步骤_测试", decision);
  assert.ok(result.includes("步骤_测试"));
  assert.ok(result.includes("retry"));
});
