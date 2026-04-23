import test from "node:test";
import assert from "node:assert/strict";
import { PlanStrategySchema, PlanStepStatusSchema, PlanStepSchema, PlanSchema, parsePlan, } from "../../../../../../src/platform/orchestration/oapeflir/types/plan.js";
test("PlanStrategySchema accepts valid strategies", () => {
    const strategies = ["linear", "hierarchical", "tree_branch", "reflexive", "goal_driven", "resource_constrained", "online", "replanned"];
    for (const strategy of strategies) {
        assert.equal(PlanStrategySchema.parse(strategy), strategy);
    }
});
test("PlanStepStatusSchema accepts valid statuses", () => {
    const statuses = ["pending", "running", "done", "failed", "skipped"];
    for (const status of statuses) {
        assert.equal(PlanStepStatusSchema.parse(status), status);
    }
});
test("PlanStepSchema parses valid step", () => {
    const input = {
        stepId: "step_1",
        action: "execute_tool",
        title: "Execute tool",
        inputs: { toolName: "bash", command: "ls" },
        dependencies: [],
        status: "pending",
        timeout: 60000,
        retryPolicy: { maxRetries: 3, backoffMs: 1000 },
    };
    const result = PlanStepSchema.parse(input);
    assert.equal(result.stepId, "step_1");
    assert.equal(result.timeout, 60000);
});
test("PlanStepSchema applies defaults", () => {
    const input = {
        stepId: "step_2",
        action: "fetch_data",
        timeout: 30000,
        retryPolicy: { maxRetries: 0, backoffMs: 0 },
    };
    const result = PlanStepSchema.parse(input);
    assert.deepEqual(result.inputs, {});
    assert.equal(result.outputs, undefined);
    assert.deepEqual(result.dependencies, []);
    assert.equal(result.status, "pending");
});
test("PlanSchema parses valid plan", () => {
    const input = {
        planId: "plan_1",
        taskId: "task_1",
        version: 1,
        assessmentRef: "assessment_1",
        strategy: "linear",
        steps: [
            {
                stepId: "step_1",
                action: "fetch",
                timeout: 30000,
                retryPolicy: { maxRetries: 0, backoffMs: 0 },
            },
            {
                stepId: "step_2",
                action: "process",
                timeout: 60000,
                retryPolicy: { maxRetries: 2, backoffMs: 500 },
            },
        ],
        createdAt: 1234567890,
    };
    const result = PlanSchema.parse(input);
    assert.equal(result.planId, "plan_1");
    assert.equal(result.steps.length, 2);
});
test("PlanSchema requires at least one step", () => {
    assert.throws(() => {
        PlanSchema.parse({
            planId: "plan_2",
            taskId: "task_2",
            version: 1,
            assessmentRef: "assessment_2",
            strategy: "linear",
            steps: [],
            createdAt: 0,
        });
    });
});
test("parsePlan throws on invalid plan", () => {
    assert.throws(() => {
        parsePlan({
            planId: "",
            taskId: "task_3",
            version: 1,
            assessmentRef: "assessment_3",
            strategy: "invalid",
            steps: [],
            createdAt: 0,
        });
    });
});
//# sourceMappingURL=plan.test.js.map