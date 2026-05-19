import assert from "node:assert/strict";
import test from "node:test";
import { CapacityPlanningService } from "../../../src/ops-maturity/capacity-planner/capacity-planning-service.js";
test("integration: runtime metrics flow into forecast and cost/SLO-aware capacity recommendation", () => {
    const service = new CapacityPlanningService();
    for (const signal of [
        { timestamp: "2026-04-20T00:00:00.000Z", usage: 90, queueDepth: 20, errorBudgetBurn: 0.01 },
        { timestamp: "2026-04-20T01:00:00.000Z", usage: 110, queueDepth: 40, errorBudgetBurn: 0.02 },
        { timestamp: "2026-04-20T02:00:00.000Z", usage: 140, queueDepth: 110, errorBudgetBurn: 0.12 },
    ]) {
        service.recordSignal({
            resourceType: "dispatcher_workers",
            regionId: "cn-sh",
            ...signal,
        });
    }
    const forecast = service.forecast("dispatcher_workers", 3, {
        regionId: "cn-sh",
        start: "2026-04-20T00:00:00.000Z",
        end: "2026-04-20T02:00:00.000Z",
        generatedAt: "2026-04-20T02:10:00.000Z",
    });
    const recommendation = service.buildRecommendation(forecast, {
        costPerUnit: 0.8,
        targetHeadroomPercent: 25,
        maxQueueDepth: 100,
        latestQueueDepth: 110,
        latestErrorBudgetBurn: 0.12,
    });
    assert.equal(forecast.trainingWindow.sampleCount, 3);
    assert.equal(recommendation.recommendedAction, "scale_up");
    assert.equal(recommendation.sloRisk, "high");
});
//# sourceMappingURL=capacity-planning-integration.test.js.map