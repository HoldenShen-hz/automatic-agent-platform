import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeStepFailurePlan,
  resolveStepFailurePlan,
  normalizeStepErrorCode,
  buildStepFailureSummary,
} from "../../../../src/platform/execution/execution-engine/multi-step-supervisor.js";
import type { StepFailurePlan } from "../../../../src/platform/execution/execution-engine/multi-step-orchestration-types.js";

test("normalizeStepFailurePlan handles string input", () => {
  const result = normalizeStepFailurePlan("tool.execution_failed");
  assert.equal(result.errorCode, "tool.execution_failed");
});

test("normalizeStepFailurePlan handles StepFailurePlan input", () => {
  const input: StepFailurePlan = {
    errorCode: "validation.schema_mismatch",
    summary: "Schema validation failed",
    message: "The output did not match the expected schema",
  };
  const result = normalizeStepFailurePlan(input);
  assert.equal(result.errorCode, "validation.schema_mismatch");
  assert.equal(result.summary, "Schema validation failed");
  assert.equal(result.message, "The output did not match the expected schema");
});

test("normalizeStepErrorCode handles validation errors", () => {
  const result1 = normalizeStepErrorCode(new Error("workflow.output_schema_invalid: some field"));
  assert.equal(result1, "validation.schema_mismatch");

  const result2 = normalizeStepErrorCode(new Error("workflow.output_schema_missing: missing field"));
  assert.equal(result2, "validation.invalid_input");
});

test("normalizeStepErrorCode handles generic errors", () => {
  const result = normalizeStepErrorCode(new Error("some unexpected error"));
  assert.equal(result, "internal.unexpected_error");
});

test("normalizeStepErrorCode handles non-Error inputs", () => {
  const result1 = normalizeStepErrorCode("plain string error");
  assert.equal(result1, "internal.unexpected_error");

  const result2 = normalizeStepErrorCode(null);
  assert.equal(result2, "internal.unexpected_error");

  const result3 = normalizeStepErrorCode(undefined);
  assert.equal(result3, "internal.unexpected_error");

  const result4 = normalizeStepErrorCode({ message: "object error" });
  assert.equal(result4, "internal.unexpected_error");
});

test("buildStepFailureSummary for retry action", () => {
  const decision = {
    action: "retry" as const,
    errorCode: "tool.execution_failed",
    failureClass: "retryable" as const,
    retryDelayMs: 1000,
  };
  const result = buildStepFailureSummary("step_1", decision);
  assert.ok(result.includes("step_1"));
  assert.ok(result.includes("retry"));
  assert.ok(result.includes("tool.execution_failed"));
});

test("buildStepFailureSummary for escalate action", () => {
  const decision = {
    action: "escalate" as const,
    errorCode: "validation.schema_mismatch",
    failureClass: "non_retryable" as const,
    retryDelayMs: 0,
  };
  const result = buildStepFailureSummary("step_2", decision);
  assert.ok(result.includes("step_2"));
  assert.ok(result.includes("requires escalation"));
  assert.ok(result.includes("validation.schema_mismatch"));
});

test("buildStepFailureSummary for fail action", () => {
  const decision = {
    action: "fail" as const,
    errorCode: "internal.unexpected_error",
    failureClass: "non_retryable" as const,
    retryDelayMs: 0,
  };
  const result = buildStepFailureSummary("step_3", decision);
  assert.ok(result.includes("step_3"));
  assert.ok(result.includes("internal.unexpected_error"));
});

test("resolveStepFailurePlan returns null when no planned failures", () => {
  const input = {
    dbPath: "/tmp/test.db",
    title: "Test",
    request: "Test request",
  };
  const result = resolveStepFailurePlan(input, "step_1", 1);
  assert.equal(result, null);
});

test("resolveStepFailurePlan returns null when stepFailureInjection is empty", () => {
  const input = {
    dbPath: "/tmp/test.db",
    title: "Test",
    request: "Test request",
    stepFailureInjection: new Set<string>(),
  };
  const result = resolveStepFailurePlan(input, "step_1", 1);
  assert.equal(result, null);
});

test("resolveStepFailurePlan uses stepFailurePlans if provided", () => {
  const input = {
    dbPath: "/tmp/test.db",
    title: "Test",
    request: "Test request",
    stepFailurePlans: {
      step_1: [{ errorCode: "planned.failure", summary: "Planned failure for test" }],
    },
  };
  const result = resolveStepFailurePlan(input, "step_1", 1);
  assert.ok(result !== null);
  assert.equal(result!.errorCode, "planned.failure");
  assert.equal(result!.summary, "Planned failure for test");
});

test("resolveStepFailurePlan uses stepFailurePlans with string entries", () => {
  const input = {
    dbPath: "/tmp/test.db",
    title: "Test",
    request: "Test request",
    stepFailurePlans: {
      step_1: ["tool.execution_failed", { errorCode: "validation.schema_mismatch" }],
    },
  };
  const result1 = resolveStepFailurePlan(input, "step_1", 1);
  assert.ok(result1 !== null);
  assert.equal(result1!.errorCode, "tool.execution_failed");

  const result2 = resolveStepFailurePlan(input, "step_1", 2);
  assert.ok(result2 !== null);
  assert.equal(result2!.errorCode, "validation.schema_mismatch");
});

test("resolveStepFailurePlan uses stepFailureInjection on first attempt", () => {
  const input = {
    dbPath: "/tmp/test.db",
    title: "Test",
    request: "Test request",
    stepFailureInjection: new Set(["step_1"]),
  };
  const result = resolveStepFailurePlan(input, "step_1", 1);
  assert.ok(result !== null);
  assert.equal(result!.errorCode, "tool.execution_failed");
  assert.ok(result!.summary!.includes("step_1"));
});

test("resolveStepFailurePlan does not use stepFailureInjection on second attempt", () => {
  const input = {
    dbPath: "/tmp/test.db",
    title: "Test",
    request: "Test request",
    stepFailureInjection: new Set(["step_1"]),
  };
  const result = resolveStepFailurePlan(input, "step_1", 2);
  assert.equal(result, null);
});

test("resolveStepFailurePlan stepFailurePlans takes precedence over stepFailureInjection", () => {
  const input = {
    dbPath: "/tmp/test.db",
    title: "Test",
    request: "Test request",
    stepFailureInjection: new Set(["step_1"]),
    stepFailurePlans: {
      step_1: [{ errorCode: "planned.failure", summary: "From stepFailurePlans" }],
    },
  };
  const result = resolveStepFailurePlan(input, "step_1", 1);
  assert.ok(result !== null);
  assert.equal(result!.errorCode, "planned.failure");
  assert.equal(result!.summary, "From stepFailurePlans");
});

test("resolveStepFailurePlan returns null for non-injected step", () => {
  const input = {
    dbPath: "/tmp/test.db",
    title: "Test",
    request: "Test request",
    stepFailureInjection: new Set(["other_step"]),
  };
  const result = resolveStepFailurePlan(input, "step_1", 1);
  assert.equal(result, null);
});

test("StepFailurePlan type allows partial fields", () => {
  const plan1: StepFailurePlan = { errorCode: "error.code" };
  assert.equal(plan1.errorCode, "error.code");
  assert.equal(plan1.summary, undefined);
  assert.equal(plan1.message, undefined);

  const plan2: StepFailurePlan = {
    errorCode: "error.code",
    summary: "Short summary",
  };
  assert.equal(plan2.summary, "Short summary");

  const plan3: StepFailurePlan = {
    errorCode: "error.code",
    message: "Detailed message",
  };
  assert.equal(plan3.message, "Detailed message");
});
