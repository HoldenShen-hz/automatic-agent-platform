import assert from "node:assert/strict";
import test from "node:test";
import { buildEdgeExecutionPlan, } from "../../../../src/ops-maturity/edge-runtime/edge-orchestrator/index.js";
test("buildEdgeExecutionPlan creates plan with correct taskIds", () => {
    const plan = buildEdgeExecutionPlan(["task_1", "task_2", "task_3"]);
    assert.deepEqual(plan.orderedTaskIds, ["task_1", "task_2", "task_3"]);
    assert.equal(plan.syncRequired, true);
    assert.equal(plan.priority, "normal");
});
test("buildEdgeExecutionPlan preserves task order", () => {
    const plan = buildEdgeExecutionPlan(["task_c", "task_a", "task_b"]);
    assert.deepEqual(plan.orderedTaskIds, ["task_c", "task_a", "task_b"]);
});
test("buildEdgeExecutionPlan defaults priority to normal", () => {
    const plan = buildEdgeExecutionPlan(["task_1"]);
    assert.equal(plan.priority, "normal");
});
test("buildEdgeExecutionPlan accepts explicit priority", () => {
    const lowPlan = buildEdgeExecutionPlan(["task_1"], "low");
    assert.equal(lowPlan.priority, "low");
    const highPlan = buildEdgeExecutionPlan(["task_1"], "high");
    assert.equal(highPlan.priority, "high");
});
test("buildEdgeExecutionPlan always requires sync", () => {
    const plan = buildEdgeExecutionPlan(["task_1"]);
    assert.equal(plan.syncRequired, true);
});
test("buildEdgeExecutionPlan returns empty array for empty input", () => {
    const plan = buildEdgeExecutionPlan([]);
    assert.deepEqual(plan.orderedTaskIds, []);
});
test("EdgeExecutionPlan type shape is correct", () => {
    const plan = {
        orderedTaskIds: ["task_1", "task_2"],
        syncRequired: true,
        priority: "high",
    };
    assert.deepEqual(plan.orderedTaskIds, ["task_1", "task_2"]);
    assert.equal(plan.priority, "high");
});
//# sourceMappingURL=edge-orchestrator.test.js.map