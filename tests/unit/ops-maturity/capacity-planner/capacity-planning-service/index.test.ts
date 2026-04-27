import assert from "node:assert/strict";
import test from "node:test";

import { CapacityPlanningService } from "../../../../../src/ops-maturity/capacity-planner/capacity-planning-service.js";
import type {
  CapacitySignal,
  CapacityForecast,
  CapacityScenario,
  CapacityRecommendation,
} from "../../../../../src/ops-maturity/capacity-planner/capacity-planning-service.js";

test("CapacityPlanningService records and retrieves signals sorted by timestamp", () => {
  const service = new CapacityPlanningService();

  // Record signals out of order
  service.recordSignal({
    resourceType: "cpu",
    timestamp: "2026-04-20T02:00:00.000Z",
    usage: 200,
  });
  service.recordSignal({
    resourceType: "cpu",
    timestamp: "2026-04-20T00:00:00.000Z",
    usage: 100,
  });
  service.recordSignal({
    resourceType: "cpu",
    timestamp: "2026-04-20T01:00:00.000Z",
    usage: 150,
  });

  const forecast = service.forecast("cpu", 2, {
    start: "2026-04-20T00:00:00.000Z",
    end: "2026-04-20T02:00:00.000Z",
  });

  // Signals should be retrieved in chronological order
  assert.equal(forecast.trainingWindow.sampleCount, 3);
  assert.equal(forecast.trend, "up");
});

test("CapacityPlanningService computes correct growth rate from signals", () => {
  const service = new CapacityPlanningService();

  // 100% growth over two data points
  service.recordSignal({
    resourceType: "memory",
    timestamp: "2026-04-20T00:00:00.000Z",
    usage: 100,
  });
  service.recordSignal({
    resourceType: "memory",
    timestamp: "2026-04-20T01:00:00.000Z",
    usage: 200,
  });

  const forecast = service.forecast("memory", 1, {
    start: "2026-04-20T00:00:00.000Z",
    end: "2026-04-20T01:00:00.000Z",
  });

  // With 100% growth rate, projected usage should double
  assert.ok(forecast.projectedUsage[0]! > 200);
});

test("CapacityPlanningService uses default growth rate of 5 when only one signal", () => {
  const service = new CapacityPlanningService();

  service.recordSignal({
    resourceType: "disk",
    timestamp: "2026-04-20T00:00:00.000Z",
    usage: 100,
  });

  const forecast = service.forecast("disk", 1, {
    start: "2026-04-20T00:00:00.000Z",
    end: "2026-04-20T00:00:00.000Z",
  });

  // With default 5% growth rate, projected should be 105
  assert.equal(forecast.projectedUsage[0], 105);
});

test("CapacityPlanningService uses default growth rate when first usage is zero", () => {
  const service = new CapacityPlanningService();

  service.recordSignal({
    resourceType: "network",
    timestamp: "2026-04-20T00:00:00.000Z",
    usage: 0,
  });
  service.recordSignal({
    resourceType: "network",
    timestamp: "2026-04-20T01:00:00.000Z",
    usage: 100,
  });

  const forecast = service.forecast("network", 1, {
    start: "2026-04-20T00:00:00.000Z",
    end: "2026-04-20T01:00:00.000Z",
  });

  // First usage is 0, so default 5% growth rate
  assert.equal(forecast.projectedUsage[0], 105);
});

test("CapacityPlanningService filters signals outside time window", () => {
  const service = new CapacityPlanningService();

  service.recordSignal({
    resourceType: "workers",
    timestamp: "2026-04-19T00:00:00.000Z",
    usage: 50,
  });
  service.recordSignal({
    resourceType: "workers",
    timestamp: "2026-04-20T00:00:00.000Z",
    usage: 100,
  });
  service.recordSignal({
    resourceType: "workers",
    timestamp: "2026-04-21T00:00:00.000Z",
    usage: 150,
  });

  const forecast = service.forecast("workers", 1, {
    start: "2026-04-20T00:00:00.000Z",
    end: "2026-04-20T23:59:59.000Z",
  });

  // Only the middle signal is within the window
  assert.equal(forecast.trainingWindow.sampleCount, 1);
  assert.equal(forecast.trainingWindow.start, "2026-04-20T00:00:00.000Z");
  assert.equal(forecast.trainingWindow.end, "2026-04-20T23:59:59.000Z");
});

test("CapacityPlanningService builds recommendation with high sloRisk from queueDepth", () => {
  const service = new CapacityPlanningService();

  service.recordSignal({
    resourceType: "api",
    timestamp: "2026-04-20T00:00:00.000Z",
    usage: 100,
  });
  service.recordSignal({
    resourceType: "api",
    timestamp: "2026-04-20T01:00:00.000Z",
    usage: 110,
  });

  const forecast = service.forecast("api", 2, {
    start: "2026-04-20T00:00:00.000Z",
    end: "2026-04-20T01:00:00.000Z",
  });

  const recommendation = service.buildRecommendation(forecast, {
    costPerUnit: 0.1,
    targetHeadroomPercent: 20,
    maxQueueDepth: 50,
    latestQueueDepth: 100, // exceeds maxQueueDepth
    latestErrorBudgetBurn: 0.05, // below threshold
  });

  // queueDepth exceeds max, so high sloRisk
  assert.equal(recommendation.sloRisk, "high");
  assert.equal(recommendation.recommendedAction, "scale_up");
});

test("CapacityPlanningService builds recommendation with high sloRisk from errorBudgetBurn", () => {
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

  const forecast = service.forecast("workers", 2, {
    start: "2026-04-20T00:00:00.000Z",
    end: "2026-04-20T01:00:00.000Z",
  });

  const recommendation = service.buildRecommendation(forecast, {
    costPerUnit: 0.1,
    targetHeadroomPercent: 20,
    maxQueueDepth: 1000,
    latestQueueDepth: 10,
    latestErrorBudgetBurn: 0.15, // exceeds 0.1 threshold
  });

  // burnRisk exceeds threshold, so high sloRisk
  assert.equal(recommendation.sloRisk, "high");
  assert.equal(recommendation.recommendedAction, "scale_up");
});

test("CapacityPlanningService builds recommendation with medium sloRisk for up trend", () => {
  const service = new CapacityPlanningService();

  service.recordSignal({
    resourceType: "storage",
    timestamp: "2026-04-20T00:00:00.000Z",
    usage: 100,
  });
  service.recordSignal({
    resourceType: "storage",
    timestamp: "2026-04-20T01:00:00.000Z",
    usage: 120,
  });
  service.recordSignal({
    resourceType: "storage",
    timestamp: "2026-04-20T02:00:00.000Z",
    usage: 140,
  });

  const forecast = service.forecast("storage", 2, {
    start: "2026-04-20T00:00:00.000Z",
    end: "2026-04-20T02:00:00.000Z",
  });

  assert.equal(forecast.trend, "up");

  const recommendation = service.buildRecommendation(forecast, {
    costPerUnit: 0.05,
    targetHeadroomPercent: 15,
    maxQueueDepth: 1000,
    latestQueueDepth: 10,
    latestErrorBudgetBurn: 0.01,
  });

  // Up trend with no queue/burn risk -> medium sloRisk
  assert.equal(recommendation.sloRisk, "medium");
  assert.equal(recommendation.recommendedAction, "hold");
  assert.equal(recommendation.estimatedCostDeltaPercent, 0);
});

test("CapacityPlanningService compareScenarios sorts ascending by projectedUnits", () => {
  const service = new CapacityPlanningService();

  const scenarios: readonly CapacityScenario[] = [
    {
      scenarioId: "high_growth",
      label: "high growth",
      baselineUnits: 100,
      growthPercent: 50,
      optimizationPercent: 0,
    },
    {
      scenarioId: "low_growth",
      label: "low growth",
      baselineUnits: 100,
      growthPercent: 10,
      optimizationPercent: 0,
    },
    {
      scenarioId: "negative_growth",
      label: "negative growth",
      baselineUnits: 100,
      growthPercent: -20,
      optimizationPercent: 0,
    },
  ];

  const results = service.compareScenarios(scenarios);

  assert.equal(results.length, 3);
  // Sorted ascending by projectedUnits
  assert.equal(results[0]!.scenarioId, "negative_growth"); // 80 units
  assert.equal(results[1]!.scenarioId, "low_growth"); // 110 units
  assert.equal(results[2]!.scenarioId, "high_growth"); // 150 units
});

test("CapacityPlanningService returns proper CapacityRecommendation structure", () => {
  const service = new CapacityPlanningService();

  service.recordSignal({
    resourceType: "compute",
    timestamp: "2026-04-20T00:00:00.000Z",
    usage: 500,
  });
  service.recordSignal({
    resourceType: "compute",
    timestamp: "2026-04-20T01:00:00.000Z",
    usage: 450,
  });

  const forecast = service.forecast("compute", 1, {
    start: "2026-04-20T00:00:00.000Z",
    end: "2026-04-20T01:00:00.000Z",
  });

  const recommendation = service.buildRecommendation(forecast, {
    costPerUnit: 0.25,
    targetHeadroomPercent: 10,
  });

  // Verify structure
  assert.equal(typeof recommendation.resourceType, "string");
  assert.equal(
    recommendation.recommendedAction === "scale_up" ||
    recommendation.recommendedAction === "hold" ||
    recommendation.recommendedAction === "optimize",
    true
  );
  assert.equal(typeof recommendation.rationale, "string");
  assert.equal(typeof recommendation.projectedPeak, "number");
  assert.equal(typeof recommendation.estimatedCostDeltaPercent, "number");
  assert.equal(
    recommendation.sloRisk === "low" ||
    recommendation.sloRisk === "medium" ||
    recommendation.sloRisk === "high",
    true
  );
});

test("CapacityPlanningService forecast returns proper CapacityForecast structure", () => {
  const service = new CapacityPlanningService();

  service.recordSignal({
    resourceType: "gpu",
    timestamp: "2026-04-20T00:00:00.000Z",
    usage: 100,
  });
  service.recordSignal({
    resourceType: "gpu",
    timestamp: "2026-04-20T01:00:00.000Z",
    usage: 120,
  });

  const forecast = service.forecast("gpu", 3, {
    start: "2026-04-20T00:00:00.000Z",
    end: "2026-04-20T01:00:00.000Z",
  });

  // Verify structure
  assert.equal(forecast.resourceType, "gpu");
  assert.equal(typeof forecast.trainingWindow.start, "string");
  assert.equal(typeof forecast.trainingWindow.end, "string");
  assert.equal(typeof forecast.trainingWindow.sampleCount, "number");
  assert.ok(Array.isArray(forecast.projectedUsage));
  assert.equal(typeof forecast.confidenceInterval.low, "number");
  assert.equal(typeof forecast.confidenceInterval.high, "number");
  assert.equal(
    forecast.trend === "up" || forecast.trend === "down" || forecast.trend === "flat",
    true
  );
  assert.equal(typeof forecast.generatedAt, "string");
});

test("CapacityPlanningService signals with optional fields work correctly", () => {
  const service = new CapacityPlanningService();

  // Signal with all optional fields
  const signal: CapacitySignal = {
    resourceType: "memory",
    regionId: "us-west-2",
    timestamp: "2026-04-20T00:00:00.000Z",
    usage: 256,
    queueDepth: 50,
    errorBudgetBurn: 0.05,
  };

  const recorded = service.recordSignal(signal);
  assert.deepEqual(recorded, signal);

  const forecast = service.forecast("memory", 1, {
    regionId: "us-west-2",
    start: "2026-04-20T00:00:00.000Z",
    end: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(forecast.resourceType, "memory");
  assert.equal(forecast.regionId, "us-west-2");
  assert.equal(forecast.trainingWindow.sampleCount, 1);
});

test("CapacityPlanningService compareScenarios handles single scenario", () => {
  const service = new CapacityPlanningService();

  const results = service.compareScenarios([
    {
      scenarioId: "only",
      label: "only scenario",
      baselineUnits: 100,
      growthPercent: 20,
      optimizationPercent: 10,
    },
  ]);

  assert.equal(results.length, 1);
  assert.equal(results[0]!.scenarioId, "only");
  // 100 * 1.20 * 0.90 = 108
  assert.equal(results[0]!.projectedUnits, 108);
});

test("CapacityPlanningService confidence interval band is 10% of projected peak", () => {
  const service = new CapacityPlanningService();

  service.recordSignal({
    resourceType: "cpu",
    timestamp: "2026-04-20T00:00:00.000Z",
    usage: 100,
  });

  const forecast = service.forecast("cpu", 1, {
    start: "2026-04-20T00:00:00.000Z",
    end: "2026-04-20T00:00:00.000Z",
  });

  // Band is the margin added/subtracted from projected peak
  // band = max(1, round(projectedUsage * 0.1, 2))
  const expectedBand = Math.max(1, Number((forecast.projectedUsage[0]! * 0.1).toFixed(2)));
  // confidenceInterval.high = projectedUsage + band
  // confidenceInterval.low = projectedUsage - band
  assert.equal(forecast.confidenceInterval.high - forecast.projectedUsage[0]!, expectedBand);
  assert.equal(forecast.projectedUsage[0]! - forecast.confidenceInterval.low, expectedBand);
});
