import assert from "node:assert/strict";
import test from "node:test";
import { CapacityPlanningService } from "../../../src/ops-maturity/capacity-planner/capacity-planning-service.js";
test("CapacityPlanningService produces forecast windows, scenario comparisons, and recommendations", () => {
    const service = new CapacityPlanningService();
    service.recordSignal({
        resourceType: "workers",
        regionId: "cn-sh",
        timestamp: "2026-04-20T00:00:00.000Z",
        usage: 100,
        queueDepth: 40,
        errorBudgetBurn: 0.01,
    });
    service.recordSignal({
        resourceType: "workers",
        regionId: "cn-sh",
        timestamp: "2026-04-20T01:00:00.000Z",
        usage: 120,
        queueDepth: 60,
        errorBudgetBurn: 0.03,
    });
    service.recordSignal({
        resourceType: "workers",
        regionId: "cn-sh",
        timestamp: "2026-04-20T02:00:00.000Z",
        usage: 150,
        queueDepth: 120,
        errorBudgetBurn: 0.08,
    });
    const forecast = service.forecast("workers", 2, {
        regionId: "cn-sh",
        start: "2026-04-20T00:00:00.000Z",
        end: "2026-04-20T02:00:00.000Z",
        generatedAt: "2026-04-20T02:10:00.000Z",
    });
    assert.equal(forecast.trainingWindow.sampleCount, 3);
    assert.equal(forecast.projectedUsage.length, 2);
    const scenarios = service.compareScenarios([
        {
            scenarioId: "scenario_hold",
            label: "hold",
            baselineUnits: 150,
            growthPercent: 10,
            optimizationPercent: 0,
        },
        {
            scenarioId: "scenario_opt",
            label: "optimize",
            baselineUnits: 150,
            growthPercent: 10,
            optimizationPercent: 15,
        },
    ]);
    assert.equal(scenarios[0]?.scenarioId, "scenario_opt");
    const recommendation = service.buildRecommendation(forecast, {
        costPerUnit: 0.5,
        targetHeadroomPercent: 20,
        maxQueueDepth: 100,
        latestQueueDepth: 120,
        latestErrorBudgetBurn: 0.08,
    });
    assert.equal(recommendation.resourceType, "workers");
});
test("CapacityPlanningService rejects empty windows from the decision chain", () => {
    const service = new CapacityPlanningService();
    assert.throws(() => {
        service.forecast("workers", 2, {
            start: "2026-04-20T00:00:00.000Z",
            end: "2026-04-20T01:00:00.000Z",
        });
    }, /capacity_planning\.empty_window/);
});
//# sourceMappingURL=capacity-planning-service.test.js.map