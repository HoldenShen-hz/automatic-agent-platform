import assert from "node:assert/strict";
import test from "node:test";
test("StepFailurePlan requires errorCode", () => {
    const plan = {
        errorCode: "step.execution_failed",
    };
    assert.equal(plan.errorCode, "step.execution_failed");
    assert.equal(plan.summary, undefined);
    assert.equal(plan.message, undefined);
});
test("StepFailurePlan with optional fields", () => {
    const plan = {
        errorCode: "validation.schema_mismatch",
        summary: "Schema validation failed",
        message: "The output schema does not match the expected format",
    };
    assert.equal(plan.errorCode, "validation.schema_mismatch");
    assert.equal(plan.summary, "Schema validation failed");
    assert.equal(plan.message, "The output schema does not match the expected format");
});
test("StepFailurePlan allows partial fields - summary only", () => {
    const plan = {
        errorCode: "internal.unexpected_error",
        summary: "Something went wrong",
    };
    assert.equal(plan.errorCode, "internal.unexpected_error");
    assert.equal(plan.summary, "Something went wrong");
    assert.equal(plan.message, undefined);
});
test("StepFailurePlan allows partial fields - message only", () => {
    const plan = {
        errorCode: "tool.execution_failed",
        message: "The tool call timed out",
    };
    assert.equal(plan.errorCode, "tool.execution_failed");
    assert.equal(plan.summary, undefined);
    assert.equal(plan.message, "The tool call timed out");
});
test("MultiStepToolExecutionInput requires core fields", () => {
    const input = {
        dbPath: "/tmp/test.db",
        title: "Test Task",
        request: "Please perform the test task",
    };
    assert.equal(input.dbPath, "/tmp/test.db");
    assert.equal(input.title, "Test Task");
    assert.equal(input.request, "Please perform the test task");
    assert.equal(input.contextBudgetTokens, undefined);
    assert.equal(input.admissionPolicy, undefined);
    assert.equal(input.crashInjection, undefined);
    assert.equal(input.stepFailureInjection, undefined);
    assert.equal(input.stepFailurePlans, undefined);
    assert.equal(input.stepOutputOverrides, undefined);
});
test("MultiStepToolExecutionInput with optional contextBudgetTokens", () => {
    const input = {
        dbPath: "/tmp/test.db",
        title: "Token Budget Test",
        request: "Test request",
        contextBudgetTokens: 50000,
    };
    assert.equal(input.contextBudgetTokens, 50000);
});
test("MultiStepToolExecutionInput with stepFailureInjection", () => {
    const input = {
        dbPath: "/tmp/test.db",
        title: "Failure Injection Test",
        request: "Test request",
        stepFailureInjection: new Set(["step_1", "step_3"]),
    };
    assert.ok(input.stepFailureInjection);
    assert.equal(input.stepFailureInjection.has("step_1"), true);
    assert.equal(input.stepFailureInjection.has("step_3"), true);
    assert.equal(input.stepFailureInjection.has("step_2"), false);
});
test("MultiStepToolExecutionInput with stepFailurePlans using strings", () => {
    const input = {
        dbPath: "/tmp/test.db",
        title: "Step Failure Plans Test",
        request: "Test request",
        stepFailurePlans: {
            step_1: ["tool.execution_failed", "validation.schema_mismatch"],
            step_2: ["internal.unexpected_error"],
        },
    };
    assert.ok(input.stepFailurePlans);
    const step1Plans = input.stepFailurePlans["step_1"];
    const step2Plans = input.stepFailurePlans["step_2"];
    assert.ok(step1Plans);
    assert.ok(step2Plans);
    assert.equal(step1Plans.length, 2);
    assert.equal(step1Plans[0], "tool.execution_failed");
    assert.ok(step2Plans[0] != null);
    assert.equal(step2Plans[0], "internal.unexpected_error");
});
test("MultiStepToolExecutionInput with stepFailurePlans using StepFailurePlan objects", () => {
    const input = {
        dbPath: "/tmp/test.db",
        title: "Step Failure Plans Objects Test",
        request: "Test request",
        stepFailurePlans: {
            step_1: [
                { errorCode: "planned.failure", summary: "Planned failure for step 1" },
                { errorCode: "planned.failure.2", summary: "Second planned failure", message: "Details here" },
            ],
        },
    };
    assert.ok(input.stepFailurePlans);
    const step1Plans = input.stepFailurePlans["step_1"];
    assert.ok(step1Plans);
    assert.ok(step1Plans.length >= 1);
    const plan0 = step1Plans[0];
    const plan1 = step1Plans[1];
    assert.ok(plan0);
    assert.ok(plan1);
    assert.equal(plan0.errorCode, "planned.failure");
    assert.equal(plan0.summary, "Planned failure for step 1");
    assert.equal(plan1.errorCode, "planned.failure.2");
    assert.equal(plan1.message, "Details here");
});
test("MultiStepToolExecutionInput with mixed stepFailurePlans (strings and objects)", () => {
    const input = {
        dbPath: "/tmp/test.db",
        title: "Mixed Failure Plans Test",
        request: "Test request",
        stepFailurePlans: {
            step_1: ["tool.execution_failed", { errorCode: "validation.schema_mismatch", summary: "Schema issue" }],
        },
    };
    assert.ok(input.stepFailurePlans);
    const step1Plans = input.stepFailurePlans["step_1"];
    assert.ok(step1Plans);
    assert.ok(step1Plans[0] != null);
    assert.equal(step1Plans[0], "tool.execution_failed");
    const plan1 = step1Plans[1];
    assert.ok(plan1);
    assert.equal(plan1.errorCode, "validation.schema_mismatch");
});
test("MultiStepToolExecutionInput with stepOutputOverrides", () => {
    const input = {
        dbPath: "/tmp/test.db",
        title: "Output Overrides Test",
        request: "Test request",
        stepOutputOverrides: {
            step_1: { summary: "Custom summary", result: "Custom result" },
            step_2: { status: "skipped" },
        },
    };
    assert.ok(input.stepOutputOverrides);
    assert.deepEqual(input.stepOutputOverrides["step_1"], { summary: "Custom summary", result: "Custom result" });
    assert.deepEqual(input.stepOutputOverrides["step_2"], { status: "skipped" });
});
test("MultiStepOrchestrationResult type can be instantiated with partial data", () => {
    // This test verifies the type structure without actual implementation
    const mockSnapshot = {};
    const mockRouting = {};
    const mockPlannedWorkflow = {};
    const result = {
        snapshot: mockSnapshot,
        streamFrames: [],
        routing: mockRouting,
        plannedWorkflow: mockPlannedWorkflow,
        compaction: null,
    };
    assert.ok(result.snapshot === mockSnapshot);
    assert.ok(Array.isArray(result.streamFrames));
    assert.equal(result.streamFrames.length, 0);
    assert.ok(result.routing === mockRouting);
    assert.ok(result.plannedWorkflow === mockPlannedWorkflow);
    assert.equal(result.compaction, null);
});
test("MultiStepOrchestrationResult with compaction object", () => {
    const compaction = {
        usageBeforeTokens: 50000,
        usageAfterStage1Tokens: 35000,
        usageAfterStage2Tokens: 25000,
        stage1Triggered: true,
        stage2Triggered: false,
        fallbackToStage1: false,
        contextMessages: [],
        persistedRecords: [],
        errorCode: null,
        kvCacheFixedPrefixCacheKey: "kv_fixed_abc123",
        kvCacheDomainBlockCacheKey: null,
    };
    const result = {
        snapshot: {},
        streamFrames: [],
        routing: {},
        plannedWorkflow: {},
        compaction,
    };
    assert.ok(result.compaction !== null);
    assert.equal(result.compaction.usageBeforeTokens, 50000);
    assert.equal(result.compaction.stage1Triggered, true);
    assert.equal(result.compaction.kvCacheFixedPrefixCacheKey, "kv_fixed_abc123");
});
//# sourceMappingURL=multi-step-orchestration-types.test.js.map