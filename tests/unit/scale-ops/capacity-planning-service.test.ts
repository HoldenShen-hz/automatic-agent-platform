import assert from "node:assert/strict";
import test from "node:test";

import {
  CapacityPlanningService,
  type CapacitySignal,
  type CapacityForecast,
  type CapacityScenario,
} from "../../../src/ops-maturity/capacity-planner/capacity-planning-service.js";

test("CapacityPlanningService recordSignal stores signal", async () => {
  const service = new CapacityPlanningService();
  const signal: CapacitySignal = {
    resourceType: "compute",
    timestamp: new Date().toISOString(),
    usage: 75,
  };

  const result = service.recordSignal(signal);

  assert.equal(result.resourceType, "compute");
  assert.equal(result.usage, 75);
});

test("CapacityPlanningService forecast requires signals", async () => {
  const service = new CapacityPlanningService();
  const now = new Date();
  const start = new Date(now.getTime() - 86400000).toISOString();
  const end = now.toISOString();

  assert.throws(
    () => service.forecast("compute", 7, { start, end }),
    (err: Error) => err.message.includes("empty_window")
  );
});

test("CapacityPlanningService forecast returns forecast with trend", async () => {
  const service = new CapacityPlanningService();
  const now = Date.now();
  for (let i = 0; i < 10; i++) {
    service.recordSignal({
      resourceType: "compute",
      timestamp: new Date(now - (10 - i) * 3600000).toISOString(),
      usage: 50 + i * 2,
    });
  }
  const start = new Date(now - 10 * 3600000).toISOString();
  const end = new Date(now).toISOString();

  const forecast = service.forecast("compute", 7, { start, end });

  assert.equal(forecast.resourceType, "compute");
  assert.ok(forecast.trend === "up" || forecast.trend === "down" || forecast.trend === "flat");
  assert.ok(forecast.projectedUsage.length > 0);
  assert.ok(forecast.confidenceInterval.low < forecast.confidenceInterval.high);
});

test("CapacityPlanningService compareScenarios sorts by projected units", async () => {
  const service = new CapacityPlanningService();
  const now = Date.now();
  for (let i = 0; i < 5; i++) {
    service.recordSignal({
      resourceType: "memory",
      timestamp: new Date(now - (5 - i) * 3600000).toISOString(),
      usage: 60,
    });
  }
  const start = new Date(now - 5 * 3600000).toISOString();
  const end = new Date(now).toISOString();

  const scenarios: CapacityScenario[] = [
    {
      scenarioId: "s1",
      label: "aggressive",
      baselineUnits: 100,
      growthPercent: 20,
      optimizationPercent: 0,
    },
    {
      scenarioId: "s2",
      label: "moderate",
      baselineUnits: 100,
      growthPercent: 10,
      optimizationPercent: 0,
    },
    {
      scenarioId: "s3",
      label: "conservative",
      baselineUnits: 100,
      growthPercent: 5,
      optimizationPercent: 0,
    },
  ];

  const results = service.compareScenarios(scenarios);

  assert.equal(results.length, 3);
  assert.ok(results[0] != null && results[1] != null && results[2] != null);
  assert.ok(results[0].projectedUnits >= results[1].projectedUnits);
  assert.ok(results[1].projectedUnits >= results[2].projectedUnits);
});

test("CapacityPlanningService buildRecommendation returns recommendation", async () => {
  const service = new CapacityPlanningService();
  const now = Date.now();
  for (let i = 0; i < 10; i++) {
    service.recordSignal({
      resourceType: "gpu",
      timestamp: new Date(now - (10 - i) * 3600000).toISOString(),
      usage: 50 + i * 5,
    });
  }
  const start = new Date(now - 10 * 3600000).toISOString();
  const end = new Date(now).toISOString();
  const forecast = service.forecast("gpu", 7, { start, end });

  const recommendation = service.buildRecommendation(forecast, {
    costPerUnit: 0.10,
    targetHeadroomPercent: 20,
  });

  assert.ok(recommendation.recommendedAction === "scale_up" || recommendation.recommendedAction === "hold" || recommendation.recommendedAction === "optimize");
  assert.ok(recommendation.projectedPeak > 0);
  assert.ok(recommendation.sloRisk === "low" || recommendation.sloRisk === "medium" || recommendation.sloRisk === "high");
});

test("CapacityPlanningService compareForecastToActual calculates error ratio", async () => {
  const service = new CapacityPlanningService();
  const forecast: CapacityForecast = {
    resourceType: "compute",
    trainingWindow: {
      start: new Date(Date.now() - 86400000).toISOString(),
      end: new Date().toISOString(),
      sampleCount: 10,
    },
    projectedUsage: [60, 65, 70, 75, 80, 85, 90],
    confidenceInterval: { low: 75, high: 95 },
    trend: "up",
    generatedAt: new Date().toISOString(),
  };

  const comparison = service.compareForecastToActual({
    forecast,
    actualUsage: 88,
    maxErrorRatio: 0.2,
  });

  assert.equal(comparison.resourceType, "compute");
  assert.equal(comparison.actualUsage, 88);
  assert.ok(comparison.errorRatio > 0);
  assert.ok(comparison.needsRecalibration === true || comparison.needsRecalibration === false);
});

test("CapacityPlanningService forecast handles region-specific signals", async () => {
  const service = new CapacityPlanningService();
  const now = Date.now();
  service.recordSignal({ resourceType: "compute", regionId: "us-east", timestamp: new Date(now - 3600000).toISOString(), usage: 80 });
  service.recordSignal({ resourceType: "compute", regionId: "eu-west", timestamp: new Date(now - 3600000).toISOString(), usage: 40 });
  const start = new Date(now - 3600000).toISOString();
  const end = new Date(now).toISOString();

  const forecast = service.forecast("compute", 3, { start, end, regionId: "us-east" });

  assert.equal(forecast.resourceType, "compute");
});

test("CapacityPlanningService buildRecommendation with high risk returns scale_up", async () => {
  const service = new CapacityPlanningService();
  const now = Date.now();
  for (let i = 0; i < 20; i++) {
    service.recordSignal({
      resourceType: "memory",
      timestamp: new Date(now - (20 - i) * 1800000).toISOString(),
      usage: 90,
      queueDepth: 1000,
      errorBudgetBurn: 0.15,
    });
  }
  const start = new Date(now - 20 * 1800000).toISOString();
  const end = new Date(now).toISOString();
  const forecast = service.forecast("memory", 7, { start, end });

  const recommendation = service.buildRecommendation(forecast, {
    costPerUnit: 0.05,
    targetHeadroomPercent: 20,
    maxQueueDepth: 500,
    latestQueueDepth: 1000,
    latestErrorBudgetBurn: 0.15,
  });

  assert.equal(recommendation.recommendedAction, "scale_up");
  assert.equal(recommendation.sloRisk, "high");
});
