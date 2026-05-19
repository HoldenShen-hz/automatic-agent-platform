import assert from "node:assert/strict";
import test from "node:test";
import { normalizeStepFailurePlan, resolveStepFailurePlan, normalizeStepErrorCode, buildStepFailureSummary, } from "../../../../../src/core/runtime/supervisor/index.js";
test("core/runtime/supervisor shim exports normalizeStepFailurePlan", () => {
    assert.equal(typeof normalizeStepFailurePlan, "function", "normalizeStepFailurePlan should be a function");
});
test("core/runtime/supervisor shim exports resolveStepFailurePlan", () => {
    assert.equal(typeof resolveStepFailurePlan, "function", "resolveStepFailurePlan should be a function");
});
test("core/runtime/supervisor shim exports normalizeStepErrorCode", () => {
    assert.equal(typeof normalizeStepErrorCode, "function", "normalizeStepErrorCode should be a function");
});
test("core/runtime/supervisor shim exports buildStepFailureSummary", () => {
    assert.equal(typeof buildStepFailureSummary, "function", "buildStepFailureSummary should be a function");
});
test("core/runtime/supervisor shim re-exports same implementation as platform", async () => {
    const shim = await import("../../../../../src/core/runtime/supervisor/index.js");
    const platform = await import("../../../../../src/platform/execution/execution-engine/multi-step-supervisor.js");
    assert.equal(shim.normalizeStepFailurePlan, platform.normalizeStepFailurePlan, "normalizeStepFailurePlan should point to platform implementation");
    assert.equal(shim.resolveStepFailurePlan, platform.resolveStepFailurePlan, "resolveStepFailurePlan should point to platform implementation");
    assert.equal(shim.normalizeStepErrorCode, platform.normalizeStepErrorCode, "normalizeStepErrorCode should point to platform implementation");
    assert.equal(shim.buildStepFailureSummary, platform.buildStepFailureSummary, "buildStepFailureSummary should point to platform implementation");
});
test("normalizeStepFailurePlan handles string input", () => {
    const result = normalizeStepFailurePlan("tool.execution_failed");
    assert.equal(result.errorCode, "tool.execution_failed");
    assert.equal(result.summary, undefined);
});
test("normalizeStepFailurePlan handles StepFailurePlan input", () => {
    const input = {
        errorCode: "validation.schema_mismatch",
        summary: "Schema validation failed",
        message: "Output did not match schema",
    };
    const result = normalizeStepFailurePlan(input);
    assert.equal(result.errorCode, "validation.schema_mismatch");
    assert.equal(result.summary, "Schema validation failed");
    assert.equal(result.message, "Output did not match schema");
});
test("normalizeStepErrorCode handles validation errors", () => {
    const result = normalizeStepErrorCode(new Error("workflow.output_schema_invalid: field"));
    assert.equal(result, "validation.schema_mismatch");
});
test("normalizeStepErrorCode handles missing field errors", () => {
    const result = normalizeStepErrorCode(new Error("workflow.output_schema_missing: field"));
    assert.equal(result, "validation.invalid_input");
});
test("normalizeStepErrorCode handles generic errors", () => {
    const result = normalizeStepErrorCode(new Error("some unexpected error"));
    assert.equal(result, "internal.unexpected_error");
});
test("normalizeStepErrorCode handles non-Error inputs", () => {
    assert.equal(normalizeStepErrorCode("string error"), "internal.unexpected_error");
    assert.equal(normalizeStepErrorCode(null), "internal.unexpected_error");
    assert.equal(normalizeStepErrorCode(undefined), "internal.unexpected_error");
});
test("buildStepFailureSummary includes step ID and error code", () => {
    const decision = {
        action: "retry",
        errorCode: "tool.execution_failed",
        failureClass: "transient",
        retryable: true,
        backoff: "exponential",
        retryDelayMs: 1000,
    };
    const result = buildStepFailureSummary("step_1", decision);
    assert.ok(result.includes("step_1"), "Summary should include step ID");
    assert.ok(result.includes("retry"), "Summary should include action");
    assert.ok(result.includes("tool.execution_failed"), "Summary should include error code");
});
test("buildStepFailureSummary for escalate action", () => {
    const decision = {
        action: "escalate",
        errorCode: "validation.schema_mismatch",
        failureClass: "destructive",
        retryable: false,
        backoff: "none",
        retryDelayMs: 0,
    };
    const result = buildStepFailureSummary("step_2", decision);
    assert.ok(result.includes("step_2"));
    assert.ok(result.includes("escalate") || result.includes("requires escalation"));
    assert.ok(result.includes("validation.schema_mismatch"));
});
test("buildStepFailureSummary for fail action", () => {
    const decision = {
        action: "fail",
        errorCode: "internal.unexpected_error",
        failureClass: "non_retryable",
        retryable: false,
        backoff: "none",
        retryDelayMs: 0,
    };
    const result = buildStepFailureSummary("step_3", decision);
    assert.ok(result.includes("step_3"));
    assert.ok(result.includes("internal.unexpected_error"));
});
test("resolveStepFailurePlan returns null when no injection", () => {
    const input = {
        dbPath: "/tmp/test.db",
        title: "Test",
        request: "Test request",
    };
    const result = resolveStepFailurePlan(input, "step_1", 1);
    assert.equal(result, null);
});
test("resolveStepFailurePlan uses stepFailurePlans", () => {
    const input = {
        dbPath: "/tmp/test.db",
        title: "Test",
        request: "Test request",
        stepFailurePlans: {
            step_1: [{ errorCode: "planned.failure", summary: "Planned failure" }],
        },
    };
    const result = resolveStepFailurePlan(input, "step_1", 1);
    assert.ok(result !== null);
    assert.equal(result.errorCode, "planned.failure");
    assert.equal(result.summary, "Planned failure");
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
    assert.equal(result.errorCode, "tool.execution_failed");
});
test("resolveStepFailurePlan ignores stepFailureInjection on second attempt", () => {
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
            step_1: [{ errorCode: "from_plans", summary: "From plans not injection" }],
        },
    };
    const result = resolveStepFailurePlan(input, "step_1", 1);
    assert.ok(result !== null);
    assert.equal(result.errorCode, "from_plans");
});
test("StepFailurePlan type is exported and usable", () => {
    const plan = { errorCode: "test.error" };
    assert.equal(plan.errorCode, "test.error");
});
//# sourceMappingURL=index.test.js.map