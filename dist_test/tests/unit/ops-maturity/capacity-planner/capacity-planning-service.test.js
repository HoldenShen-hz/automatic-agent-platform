import assert from "node:assert/strict";
import test from "node:test";
import { CapacityPlanningService } from "../../../../src/ops-maturity/capacity-planner/capacity-planning-service.js";
test("CapacityPlanningService records signals and retrieves them in forecast windows", () => {
    const service = new CapacityPlanningService();
    service.recordSignal({
        resourceType: "workers",
        regionId: "us-east",
        timestamp: "2026-04-20T00:00:00.000Z",
        usage: 100,
        queueDepth: 10,
    });
    service.recordSignal({
        resourceType: "workers",
        regionId: "us-east",
        timestamp: "2026-04-20T01:00:00.000Z",
        usage: 120,
        queueDepth: 20,
    });
    service.recordSignal({
        resourceType: "workers",
        regionId: "us-east",
        timestamp: "2026-04-20T02:00:00.000Z",
        usage: 150,
        queueDepth: 30,
    });
    const forecast = service.forecast("workers", 3, {
        regionId: "us-east",
        start: "2026-04-20T00:00:00.000Z",
        end: "2026-04-20T02:00:00.000Z",
        generatedAt: "2026-04-20T02:30:00.000Z",
    });
    assert.equal(forecast.resourceType, "workers");
    assert.equal(forecast.regionId, "us-east");
    assert.equal(forecast.trainingWindow.sampleCount, 3);
    assert.equal(forecast.trainingWindow.start, "2026-04-20T00:00:00.000Z");
    assert.equal(forecast.trainingWindow.end, "2026-04-20T02:00:00.000Z");
    assert.equal(forecast.projectedUsage.length, 3);
    assert.equal(forecast.trend, "up");
    assert.equal(forecast.generatedAt, "2026-04-20T02:30:00.000Z");
    assert.ok(forecast.confidenceInterval.low < forecast.confidenceInterval.high);
});
test("CapacityPlanningService rejects empty windows during forecast", () => {
    const service = new CapacityPlanningService();
    assert.throws(() => {
        service.forecast("workers", 2, {
            start: "2026-04-20T00:00:00.000Z",
            end: "2026-04-20T01:00:00.000Z",
        });
    }, /capacity_planning\.empty_window/);
});
test("CapacityPlanningService detects downward trend and produces flat trend", () => {
    const service = new CapacityPlanningService();
    service.recordSignal({
        resourceType: "memory",
        timestamp: "2026-04-20T00:00:00.000Z",
        usage: 500,
    });
    service.recordSignal({
        resourceType: "memory",
        timestamp: "2026-04-20T01:00:00.000Z",
        usage: 400,
    });
    service.recordSignal({
        resourceType: "memory",
        timestamp: "2026-04-20T02:00:00.000Z",
        usage: 300,
    });
    const downForecast = service.forecast("memory", 2, {
        start: "2026-04-20T00:00:00.000Z",
        end: "2026-04-20T02:00:00.000Z",
    });
    assert.equal(downForecast.trend, "down");
    service.recordSignal({
        resourceType: "storage",
        timestamp: "2026-04-20T00:00:00.000Z",
        usage: 200,
    });
    service.recordSignal({
        resourceType: "storage",
        timestamp: "2026-04-20T01:00:00.000Z",
        usage: 200,
    });
    service.recordSignal({
        resourceType: "storage",
        timestamp: "2026-04-20T02:00:00.000Z",
        usage: 200,
    });
    const flatForecast = service.forecast("storage", 2, {
        start: "2026-04-20T00:00:00.000Z",
        end: "2026-04-20T02:00:00.000Z",
    });
    assert.equal(flatForecast.trend, "flat");
});
test("CapacityPlanningService compares scenarios and sorts by projected units", () => {
    const service = new CapacityPlanningService();
    const scenarios = service.compareScenarios([
        {
            scenarioId: "scenario_hold",
            label: "hold",
            baselineUnits: 100,
            growthPercent: 20,
            optimizationPercent: 0,
        },
        {
            scenarioId: "scenario_optimize",
            label: "optimize",
            baselineUnits: 100,
            growthPercent: 20,
            optimizationPercent: 15,
        },
        {
            scenarioId: "scenario_scale",
            label: "scale_up",
            baselineUnits: 200,
            growthPercent: 20,
            optimizationPercent: 0,
        },
    ]);
    assert.equal(scenarios.length, 3);
    assert.equal(scenarios[0].scenarioId, "scenario_optimize");
    assert.equal(scenarios[1].scenarioId, "scenario_hold");
    assert.equal(scenarios[2].scenarioId, "scenario_scale");
});
test("CapacityPlanningService builds recommendation with scale_up action for high SLO risk", () => {
    const service = new CapacityPlanningService();
    service.recordSignal({
        resourceType: "workers",
        timestamp: "2026-04-20T00:00:00.000Z",
        usage: 100,
    });
    service.recordSignal({
        resourceType: "workers",
        timestamp: "2026-04-20T01:00:00.000Z",
        usage: 120,
    });
    service.recordSignal({
        resourceType: "workers",
        timestamp: "2026-04-20T02:00:00.000Z",
        usage: 150,
    });
    const forecast = service.forecast("workers", 2, {
        start: "2026-04-20T00:00:00.000Z",
        end: "2026-04-20T02:00:00.000Z",
    });
    const recommendation = service.buildRecommendation(forecast, {
        costPerUnit: 0.5,
        targetHeadroomPercent: 20,
        maxQueueDepth: 100,
        latestQueueDepth: 120,
        latestErrorBudgetBurn: 0.08,
    });
    assert.equal(recommendation.resourceType, "workers");
    assert.equal(recommendation.recommendedAction, "scale_up");
    assert.equal(recommendation.sloRisk, "high");
    assert.equal(recommendation.estimatedCostDeltaPercent, 20);
    assert.ok(recommendation.projectedPeak > 0);
    assert.ok(recommendation.rationale.includes("trend=up"));
});
test("CapacityPlanningService builds recommendation with optimize action for downward trend", () => {
    const service = new CapacityPlanningService();
    service.recordSignal({
        resourceType: "memory",
        timestamp: "2026-04-20T00:00:00.000Z",
        usage: 500,
    });
    service.recordSignal({
        resourceType: "memory",
        timestamp: "2026-04-20T01:00:00.000Z",
        usage: 400,
    });
    service.recordSignal({
        resourceType: "memory",
        timestamp: "2026-04-20T02:00:00.000Z",
        usage: 300,
    });
    const forecast = service.forecast("memory", 2, {
        start: "2026-04-20T00:00:00.000Z",
        end: "2026-04-20T02:00:00.000Z",
    });
    const recommendation = service.buildRecommendation(forecast, {
        costPerUnit: 0.1,
        targetHeadroomPercent: 10,
    });
    assert.equal(recommendation.recommendedAction, "optimize");
    assert.equal(recommendation.sloRisk, "low");
    assert.equal(recommendation.estimatedCostDeltaPercent, -10);
});
test("CapacityPlanningService builds recommendation with hold action for stable forecast", () => {
    const service = new CapacityPlanningService();
    service.recordSignal({
        resourceType: "storage",
        timestamp: "2026-04-20T00:00:00.000Z",
        usage: 200,
    });
    service.recordSignal({
        resourceType: "storage",
        timestamp: "2026-04-20T01:00:00.000Z",
        usage: 200,
    });
    service.recordSignal({
        resourceType: "storage",
        timestamp: "2026-04-20T02:00:00.000Z",
        usage: 200,
    });
    const forecast = service.forecast("storage", 2, {
        start: "2026-04-20T00:00:00.000Z",
        end: "2026-04-20T02:00:00.000Z",
    });
    const recommendation = service.buildRecommendation(forecast, {
        costPerUnit: 0.05,
        targetHeadroomPercent: 15,
    });
    assert.equal(recommendation.recommendedAction, "hold");
    assert.equal(recommendation.sloRisk, "medium");
    assert.equal(recommendation.estimatedCostDeltaPercent, 0);
});
test("CapacityPlanningService uses default generatedAt timestamp when not provided", () => {
    const service = new CapacityPlanningService();
    service.recordSignal({
        resourceType: "workers",
        timestamp: "2026-04-20T00:00:00.000Z",
        usage: 100,
    });
    service.recordSignal({
        resourceType: "workers",
        timestamp: "2026-04-20T01:00:00.000Z",
        usage: 110,
    });
    const forecast = service.forecast("workers", 1, {
        start: "2026-04-20T00:00:00.000Z",
        end: "2026-04-20T01:00:00.000Z",
    });
    assert.ok(forecast.generatedAt.length > 0);
    assert.ok(forecast.generatedAt.startsWith("2026-04-20"));
});
test("CapacityPlanningService rejects forecast with empty training window", () => {
    const service = new CapacityPlanningService();
    const forecast = service.forecast("workers", 2, {
        start: "2026-04-20T00:00:00.000Z",
        end: "2026-04-20T02:00:00.000Z",
    });
    assert.throws(() => {
        service.buildRecommendation(forecast, {
            costPerUnit: 0.5,
            targetHeadroomPercent: 20,
        });
    }, /capacity_planning\.forecast_window_required/);
});
test("CapacityPlanningService handles signals without regionId as global", () => {
    const service = new CapacityPlanningService();
    service.recordSignal({
        resourceType: "cpu",
        timestamp: "2026-04-20T00:00:00.000Z",
        usage: 80,
    });
    service.recordSignal({
        resourceType: "cpu",
        timestamp: "2026-04-20T01:00:00.000Z",
        usage: 90,
    });
    const forecast = service.forecast("cpu", 1, {
        start: "2026-04-20T00:00:00.000Z",
        end: "2026-04-20T01:00:00.000Z",
    });
    assert.equal(forecast.resourceType, "cpu");
    assert.ok(forecast.regionId === undefined);
    assert.equal(forecast.trainingWindow.sampleCount, 2);
});
//# sourceMappingURL=capacity-planning-service.test.js.map