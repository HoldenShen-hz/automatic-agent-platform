import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeStepFailurePlan,
  resolveStepFailurePlan,
  normalizeStepErrorCode,
  buildStepFailureSummary,
} from "../../../../src/platform/execution/execution-engine/multi-step-supervisor.js";
import type { MultiStepToolExecutionInput } from "../../../../src/platform/execution/execution-engine/multi-step-orchestration-types.js";

test("normalizeStepFailurePlan converts string to StepFailurePlan", () => {
  const result = normalizeStepFailurePlan("E001");
  assert.deepEqual(result, { errorCode: "E001" });
});

test("normalizeStepFailurePlan preserves StepFailurePlan objects", () => {
  const input = { errorCode: "E002", summary: "Something went wrong", message: "Details here" };
  const result = normalizeStepFailurePlan(input);
  assert.deepEqual(result, input);
});

test("resolveStepFailurePlan returns null when no failures configured", () => {
  const input: MultiStepToolExecutionInput = {
    dbPath: "/tmp/test.db",
    title: "test task",
    request: "do something",
  };

  assert.equal(resolveStepFailurePlan(input, "step_1", 1), null);
});

test("resolveStepFailurePlan returns configured plan for step and attempt", () => {
  const input: MultiStepToolExecutionInput = {
    dbPath: "/tmp/test.db",
    title: "test task",
    request: "do something",
    stepFailurePlans: {
      step_1: ["E100", "E101"],
      step_2: [{ errorCode: "E200", summary: "Step 2 failed" }],
    },
  };

  // First attempt for step_1
  const result1 = resolveStepFailurePlan(input, "step_1", 1);
  assert.deepEqual(result1, { errorCode: "E100" });

  // Second attempt for step_1
  const result2 = resolveStepFailurePlan(input, "step_1", 2);
  assert.deepEqual(result2, { errorCode: "E101" });

  // Third attempt for step_1 (no plan)
  const result3 = resolveStepFailurePlan(input, "step_1", 3);
  assert.equal(result3, null);

  // First attempt for step_2
  const result4 = resolveStepFailurePlan(input, "step_2", 1);
  assert.deepEqual(result4, { errorCode: "E200", summary: "Step 2 failed" });
});

test("resolveStepFailurePlan returns injected failure for first attempt", () => {
  const input: MultiStepToolExecutionInput = {
    dbPath: "/tmp/test.db",
    title: "test task",
    request: "do something",
    stepFailureInjection: new Set(["step_injected"]),
  };

  const result = resolveStepFailurePlan(input, "step_injected", 1);
  assert.ok(result != null);
  assert.equal(result.errorCode, "tool.execution_failed");
  assert.ok(result.summary?.includes("Step step_injected failed (injected)"));
});

test("resolveStepFailurePlan returns null for injected step on subsequent attempts", () => {
  const input: MultiStepToolExecutionInput = {
    dbPath: "/tmp/test.db",
    title: "test task",
    request: "do something",
    stepFailureInjection: new Set(["step_injected"]),
  };

  // Only first attempt gets the injection
  const result = resolveStepFailurePlan(input, "step_injected", 2);
  assert.equal(result, null);
});

test("normalizeStepErrorCode handles validation schema mismatch", () => {
  assert.equal(
    normalizeStepErrorCode(new Error("workflow.output_schema_invalid: field x is wrong")),
    "validation.schema_mismatch",
  );
});

test("normalizeStepErrorCode handles validation invalid input", () => {
  assert.equal(
    normalizeStepErrorCode(new Error("workflow.output_schema_missing: field y")),
    "validation.invalid_input",
  );
});

test("normalizeStepErrorCode returns unexpected error code for other errors", () => {
  assert.equal(normalizeStepErrorCode(new Error("some other error")), "internal.unexpected_error");
  assert.equal(normalizeStepErrorCode(new Error("unknown error")), "internal.unexpected_error");
});

test("normalizeStepErrorCode handles non-Error inputs", () => {
  assert.equal(normalizeStepErrorCode("string error"), "internal.unexpected_error");
  assert.equal(normalizeStepErrorCode(123), "internal.unexpected_error");
  assert.equal(normalizeStepErrorCode(null), "internal.unexpected_error");
});

test("buildStepFailureSummary for retry action", () => {
  const decision = { action: "retry" as const, errorCode: "E100", retryDelayMs: 1000, failureClass: "transient" as const, retryable: true, backoff: "exponential" as const };
  const summary = buildStepFailureSummary("step_1", decision);
  assert.ok(summary.includes("step_1"));
  assert.ok(summary.includes("E100"));
  assert.ok(summary.includes("retry"));
});

test("buildStepFailureSummary for escalate action", () => {
  const decision = { action: "escalate" as const, errorCode: "E200", retryDelayMs: 0, failureClass: "permanent" as const, retryable: false, backoff: "none" as const };
  const summary = buildStepFailureSummary("step_2", decision as any);
  assert.ok(summary.includes("step_2"));
  assert.ok(summary.includes("E200"));
  assert.ok(summary.includes("escalation"));
});

test("buildStepFailureSummary for fail action", () => {
  const decision = { action: "fail" as const, errorCode: "E300", retryDelayMs: 0, failureClass: "unknown" as const, retryable: false, backoff: "none" as const };
  const summary = buildStepFailureSummary("step_3", decision as any);
  assert.ok(summary.includes("step_3"));
  assert.ok(summary.includes("E300"));
});