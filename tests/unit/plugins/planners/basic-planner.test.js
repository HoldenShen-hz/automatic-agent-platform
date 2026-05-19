import assert from "node:assert/strict";
import test from "node:test";
import { createBasicPlannerPlugin } from "../../../../src/plugins/planners/basic-planner.js";
test("createBasicPlannerPlugin returns valid plugin structure", () => {
    const plugin = createBasicPlannerPlugin();
    assert.equal(plugin.pluginId, "plugin.core.basic-planner");
    assert.equal(plugin.domainId, "core");
    assert.equal(plugin.spiType, "planner");
    assert.deepEqual(plugin.capabilityIds, ["workflow.suggest"]);
});
test("createBasicPlannerPlugin initialize returns undefined", async () => {
    const plugin = createBasicPlannerPlugin();
    const result = await plugin.initialize();
    assert.equal(result, undefined);
});
test("createBasicPlannerPlugin healthCheck returns true", async () => {
    const plugin = createBasicPlannerPlugin();
    const result = await plugin.healthCheck();
    assert.equal(result, true);
});
test("createBasicPlannerPlugin shutdown returns undefined", async () => {
    const plugin = createBasicPlannerPlugin();
    const result = await plugin.shutdown();
    assert.equal(result, undefined);
});
test("suggestWorkflow returns null for critical complexity", async () => {
    const plugin = createBasicPlannerPlugin();
    const result = await plugin.suggestWorkflow({
        taskId: "task_123",
        assessment: {
            complexity: "critical",
            risk: "high",
            approvalPolicy: { required: false },
        },
    });
    assert.equal(result, null);
});
test("suggestWorkflow returns direct-execute for trivial complexity", async () => {
    const plugin = createBasicPlannerPlugin();
    const result = await plugin.suggestWorkflow({
        taskId: "task_trivial",
        assessment: {
            complexity: "trivial",
            risk: "low",
            approvalPolicy: { required: false },
        },
    });
    assert.ok(result != null);
    assert.equal(result.workflowId, "workflow.core.trivial");
    assert.equal(result.overrides.length, 1);
    assert.equal(result.overrides[0].stepName, "direct-execute");
});
test("suggestWorkflow returns direct-execute for simple complexity without approval", async () => {
    const plugin = createBasicPlannerPlugin();
    const result = await plugin.suggestWorkflow({
        taskId: "task_simple",
        assessment: {
            complexity: "simple",
            risk: "low",
            approvalPolicy: { required: false },
        },
    });
    assert.ok(result != null);
    assert.equal(result.workflowId, "workflow.core.simple");
    assert.equal(result.overrides.length, 1);
    assert.equal(result.overrides[0].stepName, "direct-execute");
});
test("suggestWorkflow includes review step with requiresReview=false for moderate without approval", async () => {
    const plugin = createBasicPlannerPlugin();
    const result = await plugin.suggestWorkflow({
        taskId: "task_moderate",
        assessment: {
            complexity: "moderate",
            risk: "low",
            approvalPolicy: { required: false },
        },
    });
    assert.ok(result != null);
    assert.equal(result.overrides.length, 3);
    assert.equal(result.overrides[2].stepName, "review");
    assert.equal(result.overrides[2].requiresReview, false);
});
test("suggestWorkflow includes review step with requiresReview=true for moderate with approval", async () => {
    const plugin = createBasicPlannerPlugin();
    const result = await plugin.suggestWorkflow({
        taskId: "task_moderate_approval",
        assessment: {
            complexity: "moderate",
            risk: "high",
            approvalPolicy: { required: true },
        },
    });
    assert.ok(result != null);
    assert.equal(result.overrides.length, 3);
    assert.equal(result.overrides[2].stepName, "review");
    assert.equal(result.overrides[2].requiresReview, true);
});
test("suggestWorkflow sets retryPolicy for moderate execute step", async () => {
    const plugin = createBasicPlannerPlugin();
    const result = await plugin.suggestWorkflow({
        taskId: "task_moderate",
        assessment: {
            complexity: "moderate",
            risk: "low",
            approvalPolicy: { required: false },
        },
    });
    assert.ok(result != null);
    const executeStep = result.overrides.find((s) => s.stepName === "execute");
    assert.ok(executeStep != null);
    assert.deepEqual(executeStep.retryPolicy, { maxRetries: 1, backoffMs: 500 });
});
test("suggestWorkflow includes approve step for complex complexity", async () => {
    const plugin = createBasicPlannerPlugin();
    const result = await plugin.suggestWorkflow({
        taskId: "task_complex",
        assessment: {
            complexity: "complex",
            risk: "low",
            approvalPolicy: { required: false },
        },
    });
    assert.ok(result != null);
    assert.equal(result.overrides.length, 4);
    assert.ok(result.overrides.some((s) => s.stepName === "approve"));
});
test("suggestWorkflow approve step has requiresReview=true", async () => {
    const plugin = createBasicPlannerPlugin();
    const result = await plugin.suggestWorkflow({
        taskId: "task_complex",
        assessment: {
            complexity: "complex",
            risk: "low",
            approvalPolicy: { required: false },
        },
    });
    assert.ok(result != null);
    const approveStep = result.overrides.find((s) => s.stepName === "approve");
    assert.ok(approveStep != null);
    assert.equal(approveStep.requiresReview, true);
});
test("suggestWorkflow complex execute step has higher retry policy", async () => {
    const plugin = createBasicPlannerPlugin();
    const result = await plugin.suggestWorkflow({
        taskId: "task_complex",
        assessment: {
            complexity: "complex",
            risk: "low",
            approvalPolicy: { required: false },
        },
    });
    assert.ok(result != null);
    const executeStep = result.overrides.find((s) => s.stepName === "execute");
    assert.ok(executeStep != null);
    assert.deepEqual(executeStep.retryPolicy, { maxRetries: 2, backoffMs: 1000 });
});
test("suggestWorkflow rationale includes assessment info", async () => {
    const plugin = createBasicPlannerPlugin();
    const result = await plugin.suggestWorkflow({
        taskId: "task_test",
        assessment: {
            complexity: "moderate",
            risk: "high",
            approvalPolicy: { required: true },
        },
    });
    assert.ok(result != null);
    assert.ok(result.rationale.includes("assessment=moderate"));
    assert.ok(result.rationale.includes("risk=high"));
    assert.ok(result.rationale.includes("approvalRequired=true"));
});
test("suggestWorkflow uses tool hints correctly for different complexities", async () => {
    const plugin = createBasicPlannerPlugin();
    const trivialResult = await plugin.suggestWorkflow({
        taskId: "task_trivial",
        assessment: { complexity: "trivial", risk: "low", approvalPolicy: { required: false } },
    });
    assert.deepEqual(trivialResult.overrides[0].toolHints, ["read", "write"]);
    const moderateResult = await plugin.suggestWorkflow({
        taskId: "task_moderate",
        assessment: { complexity: "moderate", risk: "low", approvalPolicy: { required: false } },
    });
    const moderateExecute = moderateResult.overrides.find((s) => s.stepName === "execute");
    assert.deepEqual(moderateExecute.toolHints, ["write", "apply_patch"]);
    const complexResult = await plugin.suggestWorkflow({
        taskId: "task_complex",
        assessment: { complexity: "complex", risk: "low", approvalPolicy: { required: false } },
    });
    const complexExecute = complexResult.overrides.find((s) => s.stepName === "execute");
    assert.deepEqual(complexExecute.toolHints, ["apply_patch", "write"]);
});
test("suggestWorkflow sets timeout values correctly for different complexities", async () => {
    const plugin = createBasicPlannerPlugin();
    const trivialResult = await plugin.suggestWorkflow({
        taskId: "task_trivial",
        assessment: { complexity: "trivial", risk: "low", approvalPolicy: { required: false } },
    });
    assert.equal(trivialResult.overrides[0].timeoutMs, 30_000);
    const moderateResult = await plugin.suggestWorkflow({
        taskId: "task_moderate",
        assessment: { complexity: "moderate", risk: "low", approvalPolicy: { required: false } },
    });
    const moderatePlan = moderateResult.overrides.find((s) => s.stepName === "plan");
    assert.equal(moderatePlan.timeoutMs, 45_000);
    const complexResult = await plugin.suggestWorkflow({
        taskId: "task_complex",
        assessment: { complexity: "complex", risk: "low", approvalPolicy: { required: false } },
    });
    const complexPlan = complexResult.overrides.find((s) => s.stepName === "plan");
    assert.equal(complexPlan.timeoutMs, 60_000);
});
//# sourceMappingURL=basic-planner.test.js.map