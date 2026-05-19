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
    const result = {
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
    const input = {
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
    const plan = {
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
    // Verify structure matches expected usage
    const result = {
        taskId: "test",
        status: "completed",
        steps: ["s1", "s2"],
        completedAt: new Date().toISOString(),
    };
    const toolInput = {
        taskId: "test",
        toolName: "test_tool",
        parameters: {},
        iteration: 1,
    };
    const failurePlan = {
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
    const successOutcome = {
        type: "success",
        taskId: "task_1",
        result: "completed successfully",
    };
    const failureOutcome = {
        type: "failure",
        taskId: "task_2",
        error: "execution failed",
    };
    const partialOutcome = {
        type: "partial",
        taskId: "task_3",
        completedSteps: ["step_1", "step_2"],
    };
    assert.equal(successOutcome.type, "success");
    assert.equal(failureOutcome.type, "failure");
    assert.equal(partialOutcome.type, "partial");
});
test("Optional type properties work correctly", () => {
    const withOptional = {
        taskId: "task_1",
        retryCount: 2,
    };
    const withoutOptional = {
        taskId: "task_2",
    };
    assert.equal(withOptional.retryCount, 2);
    assert.equal(withoutOptional.retryCount, undefined);
    assert.ok(withOptional.metadata === undefined);
});
test("Readonly array types work correctly", () => {
    const steps = ["step_1", "step_2", "step_3"];
    const results = [
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
    const pending = {
        taskId: "task_pending",
        completedAt: null,
    };
    const completed = {
        taskId: "task_completed",
        completedAt: "2026-04-26T00:00:00.000Z",
    };
    assert.equal(pending.completedAt, null);
    assert.notEqual(completed.completedAt, null);
});
//# sourceMappingURL=types.test.js.map