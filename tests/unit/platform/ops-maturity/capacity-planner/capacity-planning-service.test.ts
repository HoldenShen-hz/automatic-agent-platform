import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { CapacityPlanningService, type CapacitySignal } from "../../../../../../src/ops-maturity/capacity-planner/capacity-planning-service.js";
import { forecastCapacityUsage, forecastCapacityPeak, CapacityForecasterService } from "../../../../../../src/ops-maturity/capacity-planner/forecaster/index.js";
import { simulateCapacityScenario, CapacityScenarioSimulatorService } from "../../../../../../src/ops-maturity/capacity-planner/simulator/index.js";
import { analyzeCapacityTrend, estimateCapacityVolatility, CapacityTrendAnalyzerService } from "../../../../../../src/ops-maturity/capacity-planner/trend-analyzer/index.js";

test("CapacityPlanningService.recordSignal stores signal and returns it", () => {
  const service = new CapacityPlanningService();
  const signal: CapacitySignal = {
    resourceType: "compute",
    timestamp: "2024-01-01T00:00:00Z",
    usage: 50,
  };

  const result = service.recordSignal(signal);

  assert.deepStrictEqual(result, signal);
});

test("CapacityPlanningService.recordSignal sorts signals by timestamp", () => {
  const service = new CapacityPlanningService();

  service.recordSignal({ resourceType: "compute", timestamp: "2024-01-02T00:00:00Z", usage: 30 });
  service.recordSignal({ resourceType: "compute", timestamp: "2024-01-01T00:00:00Z", usage: 20 });
  service.recordSignal({ resourceType: "compute", timestamp: "2024-01-03T00:00:00Z", usage: 40 });

  const forecast = service.forecast("compute", 1, {
    start: "2024-01-01T00:00:00Z",
    end: "2024-01-03T00:00:00Z",
  });

  assert.strictEqual(forecast.trainingWindow.sampleCount, 3);
});

test("CapacityPlanningService.forecast throws on empty window", () => {
  const service = new CapacityPlanningService();

  assert.throws(() => {
    service.forecast("compute", 1, { start: "2024-01-01T00:00:00Z", end: "2024-01-03T00:00:00Z" });
  }, /empty_window/);
});

test("CapacityPlanningService.forecast returns forecast with correct structure", () => {
  const service = new CapacityPlanningService();
  service.recordSignal({ resourceType: "compute", timestamp: "2024-01-01T00:00:00Z", usage: 100 });
  service.recordSignal({ resourceType: "compute", timestamp: "2024-01-02T00:00:00Z", usage: 110 });

  const forecast = service.forecast("compute", 3, {
    start: "2024-01-01T00:00:00Z",
    end: "2024-01-02T00:00:00Z",
  });

  assert.strictEqual(forecast.resourceType, "compute");
  assert.strictEqual(forecast.trend, "up");
  assert.ok(Array.isArray(forecast.projectedUsage));
  assert.strictEqual(forecast.projectedUsage.length, 3);
  assert.ok(typeof forecast.confidenceInterval.low === "number");
  assert.ok(typeof forecast.confidenceInterval.high === "number");
});

test("CapacityPlanningService.forecast uses regionId when provided", () => {
  const service = new CapacityPlanningService();
  service.recordSignal({ resourceType: "compute", regionId: "us-east-1", timestamp: "2024-01-01T00:00:00Z", usage: 50 });

  const forecast = service.forecast("compute", 1, {
    start: "2024-01-01T00:00:00Z",
    end: "2024-01-01T00:00:00Z",
    regionId: "us-east-1",
  });

  assert.strictEqual(forecast.regionId, "us-east-1");
});

test("CapacityPlanningService.compareScenarios sorts by projected units", () => {
  const service = new CapacityPlanningService();

  const results = service.compareScenarios([
    { scenarioId: "s1", label: "High Growth", baselineUnits: 100, growthPercent: 20, optimizationPercent: 5 },
    { scenarioId: "s2", label: "Low Growth", baselineUnits: 100, growthPercent: 5, optimizationPercent: 5 },
  ]);

  assert.ok(Array.isArray(results));
  assert.strictEqual(results[0].scenarioId, "s2");
});

test("CapacityPlanningService.buildRecommendation throws on empty training window", () => {
  const service = new CapacityPlanningService();
  const forecast = {
    resourceType: "compute",
    trainingWindow: { start: "2024-01-01", end: "2024-01-02", sampleCount: 0 },
    projectedUsage: [100],
    confidenceInterval: { low: 90, high: 110 },
    trend: "up" as const,
    generatedAt: "2024-01-01T00:00:00Z",
  };

  assert.throws(() => {
    service.buildRecommendation(forecast, { costPerUnit: 0.1, targetHeadroomPercent: 20 });
  }, /forecast_window_required/);
});

test("CapacityPlanningService.buildRecommendation returns scale_up for high risk", () => {
  const service = new CapacityPlanningService();
  const forecast = {
    resourceType: "compute",
    trainingWindow: { start: "2024-01-01", end: "2024-01-02", sampleCount: 5 },
    projectedUsage: [100],
    confidenceInterval: { low: 90, high: 150 },
    trend: "up" as const,
    generatedAt: "2024-01-01T00:00:00Z",
  };

  const rec = service.buildRecommendation(forecast, {
    costPerUnit: 0.1,
    targetHeadroomPercent: 20,
    maxQueueDepth: 100,
    latestQueueDepth: 150,
  });

  assert.strictEqual(rec.recommendedAction, "scale_up");
  assert.strictEqual(rec.sloRisk, "high");
});

test("forecastCapacityUsage projects usage with growth rate", () => {
  const projected = forecastCapacityUsage(100, 10, 3);

  assert.strictEqual(projected.length, 3);
  assert.strictEqual(projected[0], 110);
  assert.strictEqual(projected[1], 121);
  assert.strictEqual(projected[2], 133.1);
});

test("forecastCapacityUsage handles zero growth rate", () => {
  const projected = forecastCapacityUsage(100, 0, 3);

  assert.strictEqual(projected[0], 100);
  assert.strictEqual(projected[1], 100);
  assert.strictEqual(projected[2], 100);
});

test("forecastCapacityUsage handles negative growth rate", () => {
  const projected = forecastCapacityUsage(100, -10, 2);

  assert.strictEqual(projected[0], 90);
  assert.strictEqual(projected[1], 81);
});

test("forecastCapacityPeak returns maximum projected value", () => {
  const peak = forecastCapacityPeak(100, 10, 5);

  assert.ok(peak >= 100);
});

test("CapacityForecasterService.forecast returns forecast series", () => {
  const service = new CapacityForecasterService();
  const result = service.forecast(100, 10, 3);

  assert.ok(Array.isArray(result.projectedUsage));
  assert.strictEqual(result.projectedUsage.length, 3);
  assert.ok(typeof result.peak === "number");
});

test("simulateCapacityScenario calculates projected units", () => {
  const result = simulateCapacityScenario({
    baselineUnits: 100,
    growthPercent: 20,
    optimizationPercent: 10,
  });

  assert.strictEqual(result, 108);
});

test("simulateCapacityScenario handles zero optimization", () => {
  const result = simulateCapacityScenario({
    baselineUnits: 100,
    growthPercent: 20,
    optimizationPercent: 0,
  });

  assert.strictEqual(result, 120);
});

test("simulateCapacityScenario handles negative optimization", () => {
  const result = simulateCapacityScenario({
    baselineUnits: 100,
    growthPercent: 20,
    optimizationPercent: -10,
  });

  assert.strictEqual(result, 132);
});

test("CapacityScenarioSimulatorService.simulate returns projected units and savings", () => {
  const service = new CapacityScenarioSimulatorService();
  const result = service.simulate({ baselineUnits: 100, growthPercent: 20, optimizationPercent: 10 });

  assert.ok(typeof result.projectedUnits === "number");
  assert.ok(typeof result.savingsPercent === "number");
});

test("analyzeCapacityTrend returns up for increasing samples", () => {
  const result = analyzeCapacityTrend([50, 60, 70]);

  assert.strictEqual(result.direction, "up");
  assert.ok(typeof result.average === "number");
});

test("analyzeCapacityTrend returns down for decreasing samples", () => {
  const result = analyzeCapacityTrend([70, 60, 50]);

  assert.strictEqual(result.direction, "down");
});

test("analyzeCapacityTrend returns flat for equal samples", () => {
  const result = analyzeCapacityTrend([50, 50, 50]);

  assert.strictEqual(result.direction, "flat");
});

test("analyzeCapacityTrend returns flat for empty array", () => {
  const result = analyzeCapacityTrend([]);

  assert.strictEqual(result.direction, "flat");
  assert.strictEqual(result.average, 0);
});

test("estimateCapacityVolatility returns 0 for insufficient data", () => {
  const result = estimateCapacityVolatility([50]);

  assert.strictEqual(result, 0);
});

test("estimateCapacityVolatility calculates average delta", () => {
  const result = estimateCapacityVolatility([50, 60, 55, 70]);

  assert.ok(result >= 0);
});

test("CapacityTrendAnalyzerService.analyze returns complete analysis", () => {
  const service = new CapacityTrendAnalyzerService();
  const result = service.analyze([50, 60, 70, 80]);

  assert.ok(typeof result.average === "number");
  assert.ok(typeof result.direction === "string");
  assert.ok(typeof result.volatility === "number");
  assert.ok(typeof result.confidencePercent === "number");
});

test("CapacityTrendAnalyzerService.analyze confidence increases with sample count", () => {
  const service = new CapacityTrendAnalyzerService();

  const lowConfidence = service.analyze([50, 60]);
  const highConfidence = service.analyze([50, 60, 70, 80, 90, 100, 110, 120]);

  assert.ok(highConfidence.confidencePercent > lowConfidence.confidencePercent);
});

test("CapacityPlanningService handles multiple resource types separately", () => {
  const service = new CapacityPlanningService();

  service.recordSignal({ resourceType: "compute", timestamp: "2024-01-01T00:00:00Z", usage: 50 });
  service.recordSignal({ resourceType: "memory", timestamp: "2024-01-01T00:00:00Z", usage: 80 });

  const computeForecast = service.forecast("compute", 1, { start: "2024-01-01T00:00:00Z", end: "2024-01-01T00:00:00Z" });
  const memoryForecast = service.forecast("memory", 1, { start: "2024-01-01T00:00:00Z", end: "2024-01-01T00:00:00Z" });

  assert.strictEqual(computeForecast.resourceType, "compute");
  assert.strictEqual(memoryForecast.resourceType, "memory");
});

test("CapacityPlanningService.buildRecommendation optimizes for down trend", () => {
  const service = new CapacityPlanningService();
  const forecast = {
    resourceType: "compute",
    trainingWindow: { start: "2024-01-01", end: "2024-01-02", sampleCount: 5 },
    projectedUsage: [100],
    confidenceInterval: { low: 80, high: 90 },
    trend: "down" as const,
    generatedAt: "2024-01-01T00:00:00Z",
  };

  const rec = service.buildRecommendation(forecast, { costPerUnit: 0.1, targetHeadroomPercent: 20 });

  assert.strictEqual(rec.recommendedAction, "optimize");
  assert.strictEqual(rec.estimatedCostDeltaPercent, -10);
});

test("CapacityPlanningService.buildRecommendation holds for medium risk flat trend", () => {
  const service = new CapacityPlanningService();
  const forecast = {
    resourceType: "compute",
    trainingWindow: { start: "2024-01-01", end: "2024-01-02", sampleCount: 5 },
    projectedUsage: [100],
    confidenceInterval: { low: 90, high: 100 },
    trend: "flat" as const,
    generatedAt: "2024-01-01T00:00:00Z",
  };

  const rec = service.buildRecommendation(forecast, { costPerUnit: 0.1, targetHeadroomPercent: 20 });

  assert.strictEqual(rec.recommendedAction, "hold");
  assert.strictEqual(rec.estimatedCostDeltaPercent, 0);
});