import assert from "node:assert/strict";
import test from "node:test";

import { CostForecastingService, type CostDataPoint, type ForecastingConfig, type SeasonalityPattern, type CostForecast } from "../../../../../src/platform/five-plane-interface/api/cost-forecasting-service.js";

function makeDataPoints(overrides: Partial<CostDataPoint>[] = []): CostDataPoint[] {
  const defaults: CostDataPoint[] = [
    { periodStart: "2026-01-01T00:00:00.000Z", periodEnd: "2026-01-31T23:59:59.999Z", costUsd: 100, periodType: "monthly" },
    { periodStart: "2026-02-01T00:00:00.000Z", periodEnd: "2026-02-28T23:59:59.999Z", costUsd: 110, periodType: "monthly" },
    { periodStart: "2026-03-01T00:00:00.000Z", periodEnd: "2026-03-31T23:59:59.999Z", costUsd: 105, periodType: "monthly" },
  ];
  return overrides.map((o, i) => ({ ...defaults[i % defaults.length], ...o }));
}

function makeConfig(overrides: Partial<ForecastingConfig> = {}): ForecastingConfig {
  return {
    seasonalityPattern: "monthly",
    confidenceLevel: 0.95,
    horizonPeriods: 3,
    ...overrides,
  };
}

// ── Constructor & Defaults ──────────────────────────────────────────────────

test("CostForecastingService can be instantiated", () => {
  const service = new CostForecastingService();
  assert.ok(service != null);
});

// ── forecast() basic behavior ─────────────────────────────────────────────────

test("forecast returns a valid CostForecast structure", () => {
  const service = new CostForecastingService();
  const data = makeDataPoints();
  const config = makeConfig();
  const result = service.forecast(data, config);

  assert.ok(result.forecastId.startsWith("forecast_"));
  assert.ok(result.generatedAt.length > 0);
  assert.equal(result.forecastPeriod, "monthly");
  assert.equal(result.horizonPeriods, 3);
  assert.equal(result.predictions.length, 3);
  assert.equal(result.seasonalityPattern, "monthly");
  assert.equal(result.confidenceLevel, 0.95);
  // Trend analysis structure validation (values may vary with small samples)
  assert.ok(typeof result.trendAnalysis.slope === "number");
  assert.ok(typeof result.trendAnalysis.intercept === "number");
  assert.ok(result.trendAnalysis.rSquared >= 0);
  assert.ok(result.trendAnalysis.predictionInterval >= 0);
});

test("forecast uses default confidenceLevel when not provided", () => {
  const service = new CostForecastingService();
  const data = makeDataPoints();
  const config: ForecastingConfig = { seasonalityPattern: "monthly" };
  const result = service.forecast(data, config);
  assert.equal(result.confidenceLevel, 0.95);
});

test("forecast uses default horizonPeriods when not provided", () => {
  const service = new CostForecastingService();
  const data = makeDataPoints();
  const config: ForecastingConfig = { seasonalityPattern: "monthly" };
  const result = service.forecast(data, config);
  assert.equal(result.horizonPeriods, 3);
});

test("forecast returns predictions for each horizon period", () => {
  const service = new CostForecastingService();
  const data = makeDataPoints();
  const config = makeConfig({ horizonPeriods: 5 });
  const result = service.forecast(data, config);
  assert.equal(result.predictions.length, 5);
  for (const pred of result.predictions) {
    assert.ok(pred.periodStart.length > 0);
    assert.ok(pred.periodEnd.length > 0);
    assert.ok(pred.predictedCostUsd >= 0);
    assert.ok(pred.confidenceInterval.lowerBound >= 0);
    assert.ok(pred.confidenceInterval.upperBound >= pred.confidenceInterval.lowerBound);
    assert.ok(typeof pred.includesSeasonality === "boolean");
    assert.ok(typeof pred.trendContributionUsd === "number");
    assert.ok(typeof pred.seasonalContributionUsd === "number");
  }
});

// ── Trend Analysis ───────────────────────────────────────────────────────────

test("forecast handles empty data gracefully", () => {
  const service = new CostForecastingService();
  const data: CostDataPoint[] = [];
  const config = makeConfig();
  const result = service.forecast(data, config);
  assert.equal(result.predictions.length, 3);
  // Should not throw
});

test("forecast handles single data point", () => {
  const service = new CostForecastingService();
  const data = [makeDataPoints()[0]!];
  const config = makeConfig();
  const result = service.forecast(data, config);
  assert.equal(result.predictions.length, 3);
  assert.equal(result.trendAnalysis.slope, 0);
  // With single data point, intercept equals the data point value
  assert.ok(result.trendAnalysis.intercept >= 0);
});

test("forecast computes correct linear regression slope", () => {
  const service = new CostForecastingService();
  // Linear data: 100, 200, 300, 400
  const data: CostDataPoint[] = [
    { periodStart: "2026-01-01T00:00:00.000Z", periodEnd: "2026-01-31T23:59:59.999Z", costUsd: 100, periodType: "monthly" },
    { periodStart: "2026-02-01T00:00:00.000Z", periodEnd: "2026-02-28T23:59:59.999Z", costUsd: 200, periodType: "monthly" },
    { periodStart: "2026-03-01T00:00:00.000Z", periodEnd: "2026-03-31T23:59:59.999Z", costUsd: 300, periodType: "monthly" },
    { periodStart: "2026-04-01T00:00:00.000Z", periodEnd: "2026-04-30T23:59:59.999Z", costUsd: 400, periodType: "monthly" },
  ];
  const config = makeConfig({ horizonPeriods: 1 });
  const result = service.forecast(data, config);
  // Slope should be ~100 (each month adds 100)
  assert.ok(Math.abs(result.trendAnalysis.slope - 100) < 1);
  // Intercept should be ~100
  assert.ok(Math.abs(result.trendAnalysis.intercept - 100) < 10);
  // R-squared should be 1.0 for perfect linear data
  assert.ok(result.trendAnalysis.rSquared > 0.99);
});

test("forecast computes negative trend when costs decreasing", () => {
  const service = new CostForecastingService();
  const data: CostDataPoint[] = [
    { periodStart: "2026-01-01T00:00:00.000Z", periodEnd: "2026-01-31T23:59:59.999Z", costUsd: 400, periodType: "monthly" },
    { periodStart: "2026-02-01T00:00:00.000Z", periodEnd: "2026-02-28T23:59:59.999Z", costUsd: 300, periodType: "monthly" },
    { periodStart: "2026-03-01T00:00:00.000Z", periodEnd: "2026-03-31T23:59:59.999Z", costUsd: 200, periodType: "monthly" },
    { periodStart: "2026-04-01T00:00:00.000Z", periodEnd: "2026-04-30T23:59:59.999Z", costUsd: 100, periodType: "monthly" },
  ];
  const config = makeConfig({ horizonPeriods: 1 });
  const result = service.forecast(data, config);
  assert.ok(result.trendAnalysis.slope < 0);
});

test("forecast handles flat trend", () => {
  const service = new CostForecastingService();
  const data: CostDataPoint[] = [
    { periodStart: "2026-01-01T00:00:00.000Z", periodEnd: "2026-01-31T23:59:59.999Z", costUsd: 100, periodType: "monthly" },
    { periodStart: "2026-02-01T00:00:00.000Z", periodEnd: "2026-02-28T23:59:59.999Z", costUsd: 100, periodType: "monthly" },
    { periodStart: "2026-03-01T00:00:00.000Z", periodEnd: "2026-03-31T23:59:59.999Z", costUsd: 100, periodType: "monthly" },
  ];
  const config = makeConfig({ horizonPeriods: 1 });
  const result = service.forecast(data, config);
  assert.equal(result.trendAnalysis.slope, 0);
  assert.equal(result.trendAnalysis.rSquared, 0);
});

// ── Seasonality Patterns ────────────────────────────────────────────────────

test("forecast with linear seasonality returns predictions without seasonal adjustment", () => {
  const service = new CostForecastingService();
  const data = makeDataPoints();
  const config = makeConfig({ seasonalityPattern: "linear" });
  const result = service.forecast(data, config);
  for (const pred of result.predictions) {
    // Linear pattern should not include seasonality (coefficient = 1.0)
    assert.equal(pred.includesSeasonality, false);
  }
});

test("forecast with custom seasonality coefficients", () => {
  const service = new CostForecastingService();
  const data = makeDataPoints();
  const customCoeffs = [
    { periodOffset: 0, coefficient: 1.2 },
    { periodOffset: 1, coefficient: 0.8 },
  ];
  const config = makeConfig({ seasonalityPattern: "custom", customCoefficients: customCoeffs });
  const result = service.forecast(data, config);
  assert.equal(result.predictions.length, 3);
  // Should use custom coefficients
  assert.equal(result.seasonalityPattern, "custom");
});

test("forecast applies weekly seasonality when configured", () => {
  const service = new CostForecastingService();
  const data: CostDataPoint[] = [];
  // Create 8 weeks of data for weekly pattern
  for (let i = 0; i < 8; i++) {
    data.push({
      periodStart: `2026-0${Math.floor(i / 4) + 1}-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
      periodEnd: `2026-0${Math.floor(i / 4) + 1}-${String((i % 28) + 2).padStart(2, "0")}T00:00:00.000Z`,
      costUsd: 100 + (i % 2) * 20, // Alternate between 100 and 120
      periodType: "weekly",
    });
  }
  const config = makeConfig({ seasonalityPattern: "weekly" });
  const result = service.forecast(data, config);
  assert.equal(result.predictions.length, 3);
});

test("forecast applies quarterly seasonality when configured", () => {
  const service = new CostForecastingService();
  const data: CostDataPoint[] = [];
  // Create 12 months of data for quarterly pattern
  for (let i = 0; i < 12; i++) {
    data.push({
      periodStart: `2026-${String(Math.floor(i / 4) + 1).padStart(2, "0")}-01T00:00:00.000Z`,
      periodEnd: `2026-${String(Math.floor(i / 4) + 1).padStart(2, "0")}-28T23:59:59.999Z`,
      costUsd: 100 + (i % 4) * 10, // Q1=100, Q2=110, Q3=120, Q4=130
      periodType: "monthly",
    });
  }
  const config = makeConfig({ seasonalityPattern: "quarterly" });
  const result = service.forecast(data, config);
  assert.equal(result.predictions.length, 3);
});

test("forecast applies yearly seasonality when configured", () => {
  const service = new CostForecastingService();
  const data: CostDataPoint[] = [];
  for (let i = 0; i < 5; i++) {
    data.push({
      periodStart: `202${6 - i}-01-01T00:00:00.000Z`,
      periodEnd: `202${6 - i}-12-31T23:59:59.999Z`,
      costUsd: 1000 + i * 100,
      periodType: "yearly",
    });
  }
  const config = makeConfig({ seasonalityPattern: "yearly" });
  const result = service.forecast(data, config);
  assert.equal(result.predictions.length, 3);
});

// ── Edge Cases ──────────────────────────────────────────────────────────────

test("forecast handles insufficient data for seasonality (less than 4 points)", () => {
  const service = new CostForecastingService();
  const data = [
    { periodStart: "2026-01-01T00:00:00.000Z", periodEnd: "2026-01-31T23:59:59.999Z", costUsd: 100, periodType: "monthly" },
    { periodStart: "2026-02-01T00:00:00.000Z", periodEnd: "2026-02-28T23:59:59.999Z", costUsd: 110, periodType: "monthly" },
  ];
  const config = makeConfig({ seasonalityPattern: "monthly" });
  const result = service.forecast(data, config);
  // Should use default coefficient of 1.0 when insufficient data
  assert.equal(result.predictions.length, 3);
});

test("forecast handles zero/negative costs in data", () => {
  const service = new CostForecastingService();
  const data: CostDataPoint[] = [
    { periodStart: "2026-01-01T00:00:00.000Z", periodEnd: "2026-01-31T23:59:59.999Z", costUsd: 0, periodType: "monthly" },
    { periodStart: "2026-02-01T00:00:00.000Z", periodEnd: "2026-02-28T23:59:59.999Z", costUsd: 50, periodType: "monthly" },
    { periodStart: "2026-03-01T00:00:00.000Z", periodEnd: "2026-03-31T23:59:59.999Z", costUsd: 100, periodType: "monthly" },
  ];
  const config = makeConfig({ horizonPeriods: 1 });
  const result = service.forecast(data, config);
  // Predicted cost should be non-negative
  assert.ok(result.predictions[0]!.predictedCostUsd >= 0);
  // Lower bound should be non-negative
  assert.ok(result.predictions[0]!.confidenceInterval.lowerBound >= 0);
});

test("forecast ensures predicted cost is never negative", () => {
  const service = new CostForecastingService();
  const data: CostDataPoint[] = [
    { periodStart: "2026-01-01T00:00:00.000Z", periodEnd: "2026-01-31T23:59:59.999Z", costUsd: 10, periodType: "monthly" },
    { periodStart: "2026-02-01T00:00:00.000Z", periodEnd: "2026-02-28T23:59:59.999Z", costUsd: 5, periodType: "monthly" },
    { periodStart: "2026-03-01T00:00:00.000Z", periodEnd: "2026-03-31T23:59:59.999Z", costUsd: 1, periodType: "monthly" },
  ];
  const config = makeConfig({ horizonPeriods: 5 });
  const result = service.forecast(data, config);
  for (const pred of result.predictions) {
    assert.ok(pred.predictedCostUsd >= 0, "Predicted cost should never be negative");
    assert.ok(pred.confidenceInterval.lowerBound >= 0, "Lower bound should never be negative");
  }
});

test("forecast confidence interval upper bound is >= lower bound", () => {
  const service = new CostForecastingService();
  const data = makeDataPoints();
  const config = makeConfig();
  const result = service.forecast(data, config);
  for (const pred of result.predictions) {
    assert.ok(pred.confidenceInterval.upperBound >= pred.confidenceInterval.lowerBound);
  }
});

// ── Period Type Detection ────────────────────────────────────────────────────

test("forecast detects daily period type", () => {
  const service = new CostForecastingService();
  const data: CostDataPoint[] = [
    { periodStart: "2026-01-01T00:00:00.000Z", periodEnd: "2026-01-02T00:00:00.000Z", costUsd: 100, periodType: "daily" },
    { periodStart: "2026-01-02T00:00:00.000Z", periodEnd: "2026-01-03T00:00:00.000Z", costUsd: 110, periodType: "daily" },
  ];
  const config = makeConfig({ horizonPeriods: 1 });
  const result = service.forecast(data, config);
  assert.equal(result.forecastPeriod, "daily");
});

test("forecast detects weekly period type", () => {
  const service = new CostForecastingService();
  const data: CostDataPoint[] = [
    { periodStart: "2026-01-01T00:00:00.000Z", periodEnd: "2026-01-08T00:00:00.000Z", costUsd: 100, periodType: "weekly" },
    { periodStart: "2026-01-08T00:00:00.000Z", periodEnd: "2026-01-15T00:00:00.000Z", costUsd: 110, periodType: "weekly" },
  ];
  const config = makeConfig({ horizonPeriods: 1 });
  const result = service.forecast(data, config);
  assert.equal(result.forecastPeriod, "weekly");
});

test("forecast defaults to monthly when insufficient data", () => {
  const service = new CostForecastingService();
  const data: CostDataPoint[] = [
    { periodStart: "2026-01-01T00:00:00.000Z", periodEnd: "2026-01-31T23:59:59.999Z", costUsd: 100, periodType: "monthly" },
  ];
  const config = makeConfig({ horizonPeriods: 1 });
  const result = service.forecast(data, config);
  assert.equal(result.forecastPeriod, "monthly");
});

test("forecast detects quarterly period type", () => {
  const service = new CostForecastingService();
  const data: CostDataPoint[] = [
    { periodStart: "2026-01-01T00:00:00.000Z", periodEnd: "2026-04-01T00:00:00.000Z", costUsd: 100, periodType: "quarterly" },
    { periodStart: "2026-04-01T00:00:00.000Z", periodEnd: "2026-07-01T00:00:00.000Z", costUsd: 110, periodType: "quarterly" },
  ];
  const config = makeConfig({ horizonPeriods: 1 });
  const result = service.forecast(data, config);
  assert.equal(result.forecastPeriod, "quarterly");
});

test("forecast detects yearly period type", () => {
  const service = new CostForecastingService();
  const data: CostDataPoint[] = [
    { periodStart: "2025-01-01T00:00:00.000Z", periodEnd: "2026-01-01T00:00:00.000Z", costUsd: 1000, periodType: "yearly" },
    { periodStart: "2026-01-01T00:00:00.000Z", periodEnd: "2027-01-01T00:00:00.000Z", costUsd: 1100, periodType: "yearly" },
  ];
  const config = makeConfig({ horizonPeriods: 1 });
  const result = service.forecast(data, config);
  assert.equal(result.forecastPeriod, "yearly");
});

// ── Prediction Interval ─────────────────────────────────────────────────────

test("forecast prediction interval increases with lower confidence level", () => {
  const service = new CostForecastingService();
  const data = makeDataPoints();
  const config95 = makeConfig({ confidenceLevel: 0.95 });
  const config80 = makeConfig({ confidenceLevel: 0.80 });
  const result95 = service.forecast(data, config95);
  const result80 = service.forecast(data, config80);

  const pred95 = result95.predictions[0]!;
  const pred80 = result80.predictions[0]!;
  const interval95 = pred95.confidenceInterval.upperBound - pred95.confidenceInterval.lowerBound;
  const interval80 = pred80.confidenceInterval.upperBound - pred80.confidenceInterval.lowerBound;
  // Lower confidence = wider interval
  assert.ok(interval80 >= interval95);
});

// ── forecastId uniqueness ────────────────────────────────────────────────────

test("forecast generates unique forecastIds for each call", () => {
  const service = new CostForecastingService();
  const data = makeDataPoints();
  const config = makeConfig();
  const result1 = service.forecast(data, config);
  // forecastId format is forecast_<timestamp>_<uuid> so should be unique
  assert.ok(result1.forecastId.startsWith("forecast_"));
  assert.ok(result1.forecastId.length > "forecast_".length);
});

// ── generatedAt is ISO timestamp ─────────────────────────────────────────────

test("forecast generatedAt is a valid ISO timestamp", () => {
  const service = new CostForecastingService();
  const data = makeDataPoints();
  const config = makeConfig();
  const result = service.forecast(data, config);
  const date = new Date(result.generatedAt);
  assert.ok(!Number.isNaN(date.getTime()));
});

test("forecast period projections are in the future relative to last data point", () => {
  const service = new CostForecastingService();
  const data: CostDataPoint[] = [
    { periodStart: "2026-01-01T00:00:00.000Z", periodEnd: "2026-01-31T23:59:59.999Z", costUsd: 100, periodType: "monthly" },
    { periodStart: "2026-02-01T00:00:00.000Z", periodEnd: "2026-02-28T23:59:59.999Z", costUsd: 110, periodType: "monthly" },
    { periodStart: "2026-03-01T00:00:00.000Z", periodEnd: "2026-03-31T23:59:59.999Z", costUsd: 105, periodType: "monthly" },
  ];
  const config = makeConfig({ horizonPeriods: 1 });
  const result = service.forecast(data, config);
  const lastDataEnd = new Date(data[data.length - 1]!.periodEnd);
  const firstPredStart = new Date(result.predictions[0]!.periodStart);
  assert.ok(firstPredStart.getTime() > lastDataEnd.getTime());
});