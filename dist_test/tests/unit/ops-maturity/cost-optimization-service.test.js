import assert from "node:assert/strict";
import test from "node:test";
import { CostOptimizationService } from "../../../src/ops-maturity/cost-optimizer/cost-optimization-service.js";
test("CostOptimizationService aggregates sourced costs into recommendations and simulations", () => {
    const service = new CostOptimizationService();
    service.recordCost({
        subjectType: "workflow",
        subjectId: "workflow_a",
        costType: "model",
        amountUsd: 12.5,
        decisionRef: "decision_1",
        modelRef: "gpt-5.4",
        capturedAt: "2026-04-20T00:00:00.000Z",
    });
    service.recordCost({
        subjectType: "workflow",
        subjectId: "workflow_a",
        costType: "tool",
        amountUsd: 7.5,
        decisionRef: "decision_2",
        capturedAt: "2026-04-20T00:10:00.000Z",
    });
    assert.deepEqual(service.aggregate("workflow"), { workflow_a: 20 });
    const recommendations = service.buildRecommendations("workflow");
    assert.equal(recommendations.length, 1);
    assert.equal(recommendations[0]?.subjectId, "workflow_a");
    const simulation = service.simulate([
        {
            scenarioId: "scenario_reduce_10",
            subjectId: "workflow_a",
            reductionPercent: 10,
        },
    ]);
    assert.equal(simulation[0]?.simulatedCostUsd, 18);
    const dashboard = service.buildDashboardSlice("2026-04-20T01:00:00.000Z");
    assert.equal(dashboard.totalCostUsd, 20);
    assert.equal(dashboard.unsourcedRecordCount, 0);
});
test("CostOptimizationService rejects unsourced records from optimization chain", () => {
    const service = new CostOptimizationService();
    assert.throws(() => {
        service.recordCost({
            subjectType: "task",
            subjectId: "task_a",
            costType: "model",
            amountUsd: 5,
            decisionRef: "",
            capturedAt: "2026-04-20T00:00:00.000Z",
        });
    }, /cost_optimizer\.unsourced_record/);
    assert.equal(service.buildDashboardSlice().unsourcedRecordCount, 1);
});
//# sourceMappingURL=cost-optimization-service.test.js.map