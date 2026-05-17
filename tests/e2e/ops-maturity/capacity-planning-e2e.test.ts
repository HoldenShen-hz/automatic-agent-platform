/**
 * E2E Capacity Planning Tests
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../../helpers/e2e-harness.js";
import { CapacityPlanningService } from "../../../src/ops-maturity/capacity-planner/capacity-planning-service.js";
import { CapacityTrendAnalyzerService } from "../../../src/ops-maturity/capacity-planner/trend-analyzer/index.js";

function recordUsageSeries(service: CapacityPlanningService, values: readonly number[]) {
  values.forEach((value, index) => {
    service.recordSignal({
      resourceType: "workers",
      timestamp: `2026-05-01T0${index}:00:00.000Z`,
      usage: value,
      queueDepth: Math.max(0, value - 10),
    });
  });
}

test("E2E Capacity: CapacityPlanningService forecasts current usage trend", async () => {
  const harness = createE2EHarness("aa-e2e-capacity-");
  try {
    const service = new CapacityPlanningService();
    recordUsageSeries(service, [40, 45, 50, 55]);

    const forecast = service.forecast("workers", 3, {
      start: "2026-05-01T00:00:00.000Z",
      end: "2026-05-01T03:00:00.000Z",
    });

    assert.equal(forecast.resourceType, "workers");
    assert.equal(forecast.trainingWindow.sampleCount, 4);
    assert.equal(forecast.trend, "up");
    assert.equal(forecast.projectedUsage.length, 3);
  } finally {
    harness.cleanup();
  }
});

test("E2E Capacity: Service compares forecast to actual usage", async () => {
  const harness = createE2EHarness("aa-e2e-capacity-forecast-");
  try {
    const service = new CapacityPlanningService();
    recordUsageSeries(service, [20, 22, 25, 28]);

    const forecast = service.forecast("workers", 2, {
      start: "2026-05-01T00:00:00.000Z",
      end: "2026-05-01T03:00:00.000Z",
    });
    const comparison = service.compareForecastToActual({
      forecast,
      actualUsage: forecast.projectedUsage.at(-1) ?? 0,
      maxErrorRatio: 0.2,
    });

    assert.equal(comparison.resourceType, "workers");
    assert.equal(comparison.needsRecalibration, false);
    assert.equal(comparison.errorRatio, 0);
  } finally {
    harness.cleanup();
  }
});

test("E2E Capacity: Trend analyzer identifies rising workload patterns", async () => {
  const harness = createE2EHarness("aa-e2e-trend-");
  try {
    const analyzer = new CapacityTrendAnalyzerService();
    const trends = analyzer.analyze([10, 12, 15, 18]);

    assert.equal(trends.direction, "up");
    assert.ok(trends.average > 0);
    assert.ok(trends.volatility > 0);
    assert.ok(trends.confidencePercent >= 55);
  } finally {
    harness.cleanup();
  }
});

test("E2E Capacity: Service recommends resource allocation adjustments", async () => {
  const harness = createE2EHarness("aa-e2e-alloc-");
  try {
    const service = new CapacityPlanningService();
    recordUsageSeries(service, [70, 78, 85, 92]);

    const forecast = service.forecast("workers", 2, {
      start: "2026-05-01T00:00:00.000Z",
      end: "2026-05-01T03:00:00.000Z",
    });
    const recommendation = service.buildRecommendation(forecast, {
      costPerUnit: 0.15,
      targetHeadroomPercent: 25,
      maxQueueDepth: 20,
      latestQueueDepth: 24,
      latestErrorBudgetBurn: 0.12,
    });

    assert.equal(recommendation.resourceType, "workers");
    assert.equal(recommendation.recommendedAction, "scale_up");
    assert.equal(recommendation.sloRisk, "high");
  } finally {
    harness.cleanup();
  }
});
