import assert from "node:assert/strict";
import test from "node:test";
import { InjectedWorkflowCrashError, isInjectedWorkflowCrashError, maybeInjectWorkflowCrash, } from "../../../src/platform/execution/recovery/workflow-crash-simulator.js";
test("workflow crash simulator throws only for the matching point and step", () => {
    const context = {
        point: "tool_completed",
        taskId: "task-1",
        executionId: "exec-1",
        workflowId: "single_agent_minimal",
        stepId: "draft_solution",
    };
    assert.doesNotThrow(() => {
        maybeInjectWorkflowCrash({ point: "step_started", stepId: "draft_solution" }, context);
    });
    assert.doesNotThrow(() => {
        maybeInjectWorkflowCrash({ point: "tool_completed", stepId: "final_review" }, context);
    });
    let thrown = null;
    try {
        maybeInjectWorkflowCrash({ point: "tool_completed", stepId: "draft_solution" }, context);
    }
    catch (error) {
        thrown = error;
    }
    assert.equal(isInjectedWorkflowCrashError(thrown), true);
    assert.equal(thrown instanceof InjectedWorkflowCrashError, true);
    assert.equal(thrown.point, "tool_completed");
    assert.equal(thrown.stepId, "draft_solution");
    assert.equal(thrown.executionId, "exec-1");
});
test("workflow crash simulator does not throw when injection is undefined", () => {
    const context = {
        point: "tool_completed",
        taskId: "task-1",
        executionId: "exec-1",
        workflowId: "single_agent_minimal",
        stepId: "draft_solution",
    };
    assert.doesNotThrow(() => {
        maybeInjectWorkflowCrash(undefined, context);
    });
});
test("workflow crash simulator crashes when point matches and stepId is null (any step)", () => {
    const context = {
        point: "step_started",
        taskId: "task-1",
        executionId: "exec-1",
        workflowId: "single_agent_minimal",
        stepId: "any_step",
    };
    assert.doesNotThrow(() => {
        maybeInjectWorkflowCrash({ point: "tool_completed", stepId: null }, context);
    });
    let thrown = null;
    try {
        maybeInjectWorkflowCrash({ point: "step_started", stepId: null }, context);
    }
    catch (error) {
        thrown = error;
    }
    assert.equal(isInjectedWorkflowCrashError(thrown), true);
    assert.equal(thrown.point, "step_started");
});
test("workflow crash simulator handles all crash points", () => {
    const points = ["step_started", "tool_completed", "before_commit"];
    for (const point of points) {
        const context = {
            point,
            taskId: "task-1",
            executionId: "exec-1",
            workflowId: "single_agent_minimal",
            stepId: "test_step",
        };
        let thrown = null;
        try {
            maybeInjectWorkflowCrash({ point, stepId: "test_step" }, context);
        }
        catch (error) {
            thrown = error;
        }
        assert.equal(isInjectedWorkflowCrashError(thrown), true, `Should crash for point ${point}`);
        assert.equal(thrown.point, point);
    }
});
test("isInjectedWorkflowCrashError returns false for non-crash errors", () => {
    assert.equal(isInjectedWorkflowCrashError(new Error("regular error")), false);
    assert.equal(isInjectedWorkflowCrashError(null), false);
    assert.equal(isInjectedWorkflowCrashError(undefined), false);
    assert.equal(isInjectedWorkflowCrashError({}), false);
    assert.equal(isInjectedWorkflowCrashError("string error"), false);
});
test("InjectedWorkflowCrashError has correct error code and details", () => {
    const context = {
        point: "before_commit",
        taskId: "task-abc",
        executionId: "exec-xyz",
        workflowId: "multi_step_flow",
        stepId: "commit_state",
    };
    const error = new InjectedWorkflowCrashError(context);
    assert.equal(error.code, "workflow.crash_injected");
    assert.equal(error.message.includes("before_commit"), true);
    assert.equal(error.message.includes("commit_state"), true);
    assert.equal(error.taskId, "task-abc");
    assert.equal(error.executionId, "exec-xyz");
    assert.equal(error.workflowId, "multi_step_flow");
    assert.equal(error.stepId, "commit_state");
    assert.equal(error.retryable, false);
});
//# sourceMappingURL=workflow-crash-simulator.test.js.map