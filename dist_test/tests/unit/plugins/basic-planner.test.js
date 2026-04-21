import test from "node:test";
import assert from "node:assert/strict";
import { createBasicPlannerPlugin } from "../../../src/plugins/planners/basic-planner.js";
function createMinimalTask(assessment = {}) {
    return {
        taskId: "task_test_1",
        intent: "Test task",
        assessment: {
            taskId: "task_test_1",
            timestamp: Date.now(),
            situationRef: "situation_1",
            phase: "pre-execution",
            complexity: "moderate",
            risk: "low",
            riskAssessment: {
                level: "low",
                factors: [],
            },
            routingDecision: {
                division: "core",
                workflow: "default",
                rationale: "test",
            },
            resourceAllocation: {
                modelClass: "standard",
                maxTokens: 1000,
                timeoutMs: 60000,
            },
            approvalPolicy: {
                required: false,
            },
            executionMode: "auto",
            suggestedActions: [],
            ...assessment,
        },
    };
}
test("createBasicPlannerPlugin returns valid plugin structure", () => {
    const plugin = createBasicPlannerPlugin();
    assert.equal(plugin.pluginId, "plugin.core.basic-planner");
    assert.equal(plugin.domainId, "core");
    assert.equal(plugin.spiType, "planner");
    assert.deepEqual(plugin.capabilityIds, ["workflow.suggest"]);
});
test("basic planner suggests direct-execute for trivial complexity", async () => {
    const plugin = createBasicPlannerPlugin();
    const task = createMinimalTask({ complexity: "trivial" });
    const result = await plugin.suggestWorkflow(task);
    assert.ok(result !== null);
    assert.equal(result.workflowId, "workflow.core.trivial");
    assert.equal(result.overrides.length, 1);
    assert.equal(result.overrides[0].stepName, "direct-execute");
    assert.deepEqual(result.overrides[0].toolHints, ["read", "write"]);
});
test("basic planner suggests direct-execute for simple complexity", async () => {
    const plugin = createBasicPlannerPlugin();
    const task = createMinimalTask({ complexity: "simple" });
    const result = await plugin.suggestWorkflow(task);
    assert.ok(result !== null);
    assert.equal(result.workflowId, "workflow.core.simple");
    assert.equal(result.overrides.length, 1);
    assert.equal(result.overrides[0].stepName, "direct-execute");
});
test("basic planner suggests plan-execute-review for moderate complexity", async () => {
    const plugin = createBasicPlannerPlugin();
    const task = createMinimalTask({ complexity: "moderate", approvalPolicy: { required: false } });
    const result = await plugin.suggestWorkflow(task);
    assert.ok(result !== null);
    assert.equal(result.overrides.length, 3);
    assert.equal(result.overrides[0].stepName, "plan");
    assert.equal(result.overrides[1].stepName, "execute");
    assert.equal(result.overrides[2].stepName, "review");
});
test("basic planner suggests full pipeline for complex complexity", async () => {
    const plugin = createBasicPlannerPlugin();
    const task = createMinimalTask({ complexity: "complex" });
    const result = await plugin.suggestWorkflow(task);
    assert.ok(result !== null);
    assert.equal(result.overrides.length, 4);
    assert.equal(result.overrides[0].stepName, "plan");
    assert.equal(result.overrides[1].stepName, "approve");
    assert.equal(result.overrides[2].stepName, "execute");
    assert.equal(result.overrides[3].stepName, "validate");
});
test("basic planner returns null for critical complexity", async () => {
    const plugin = createBasicPlannerPlugin();
    const task = createMinimalTask({ complexity: "critical" });
    const result = await plugin.suggestWorkflow(task);
    assert.equal(result, null);
});
test("basic planner sets requiresReview when approvalPolicy.required is true", async () => {
    const plugin = createBasicPlannerPlugin();
    const task = createMinimalTask({ complexity: "moderate", approvalPolicy: { required: true } });
    const result = await plugin.suggestWorkflow(task);
    assert.ok(result !== null);
    assert.ok(result.overrides.some((step) => step.requiresReview === true));
});
test("basic planner sets requiresReview when risk is high", async () => {
    const plugin = createBasicPlannerPlugin();
    const task = createMinimalTask({ complexity: "moderate", risk: "high", approvalPolicy: { required: false } });
    const result = await plugin.suggestWorkflow(task);
    assert.ok(result !== null);
    assert.ok(result.overrides.some((step) => step.requiresReview === true));
});
test("basic planner does not set requiresReview for low risk trivial task", async () => {
    const plugin = createBasicPlannerPlugin();
    const task = createMinimalTask({ complexity: "trivial", risk: "low", approvalPolicy: { required: false } });
    const result = await plugin.suggestWorkflow(task);
    assert.ok(result !== null);
    // direct-execute step should not require review (should be undefined or false)
    const requiresReview = result.overrides[0].requiresReview;
    assert.ok(!requiresReview, `Expected requiresReview to be falsy, got ${requiresReview}`);
});
test("basic planner includes retryPolicy in moderate complexity execute step", async () => {
    const plugin = createBasicPlannerPlugin();
    const task = createMinimalTask({ complexity: "moderate" });
    const result = await plugin.suggestWorkflow(task);
    assert.ok(result !== null);
    const executeStep = result.overrides.find((step) => step.stepName === "execute");
    assert.ok(executeStep !== undefined);
    assert.ok(executeStep.retryPolicy !== undefined);
    assert.equal(executeStep.retryPolicy.maxRetries, 1);
});
test("basic planner includes retryPolicy in complex complexity execute step", async () => {
    const plugin = createBasicPlannerPlugin();
    const task = createMinimalTask({ complexity: "complex" });
    const result = await plugin.suggestWorkflow(task);
    assert.ok(result !== null);
    const executeStep = result.overrides.find((step) => step.stepName === "execute");
    assert.ok(executeStep !== undefined);
    assert.ok(executeStep.retryPolicy !== undefined);
    assert.equal(executeStep.retryPolicy.maxRetries, 2);
});
test("basic planner rationale includes assessment complexity and risk", async () => {
    const plugin = createBasicPlannerPlugin();
    const task = createMinimalTask({ complexity: "moderate", risk: "high" });
    const result = await plugin.suggestWorkflow(task);
    assert.ok(result !== null);
    assert.ok(result.rationale.includes("assessment=moderate"), `Expected rationale to include "assessment=moderate", got: ${result.rationale}`);
    assert.ok(result.rationale.includes("risk=high"), `Expected rationale to include "risk=high", got: ${result.rationale}`);
});
test("basic planner has initialize method", async () => {
    const plugin = createBasicPlannerPlugin();
    assert.ok(plugin.initialize !== undefined);
    const result = await plugin.initialize();
    assert.equal(result, undefined);
});
test("basic planner has healthCheck method", async () => {
    const plugin = createBasicPlannerPlugin();
    assert.ok(plugin.healthCheck !== undefined);
    const result = await plugin.healthCheck();
    assert.equal(result, true);
});
test("basic planner has shutdown method", async () => {
    const plugin = createBasicPlannerPlugin();
    assert.ok(plugin.shutdown !== undefined);
    const result = await plugin.shutdown();
    assert.equal(result, undefined);
});
test("basic planner assigns correct timeoutMs for each complexity level", async () => {
    const plugin = createBasicPlannerPlugin();
    const trivialTask = createMinimalTask({ complexity: "trivial" });
    const trivialResult = await plugin.suggestWorkflow(trivialTask);
    assert.equal(trivialResult.overrides[0].timeoutMs, 30_000);
    const moderateTask = createMinimalTask({ complexity: "moderate" });
    const moderateResult = await plugin.suggestWorkflow(moderateTask);
    const moderateExecuteStep = moderateResult.overrides.find((s) => s.stepName === "execute");
    assert.equal(moderateExecuteStep.timeoutMs, 60_000);
    const complexTask = createMinimalTask({ complexity: "complex" });
    const complexResult = await plugin.suggestWorkflow(complexTask);
    const complexExecuteStep = complexResult.overrides.find((s) => s.stepName === "execute");
    assert.equal(complexExecuteStep.timeoutMs, 90_000);
});
//# sourceMappingURL=basic-planner.test.js.map