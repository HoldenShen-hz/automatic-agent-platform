import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  CostForecastingService,
  type CostDataPoint,
  type ForecastingConfig,
  type SeasonalityPattern,
} from "../../../../../src/platform/five-plane-interface/api/cost-forecasting-service.js";

describe("CostForecastingService", () => {
  let service: CostForecastingService;

  beforeEach(() => {
    service = new CostForecastingService();
  });

  describe("forecast", () => {
    it("should generate forecast with predictions for given historical data", () => {
      const historicalData: readonly CostDataPoint[] = [
        { periodStart: "2024-01-01", periodEnd: "2024-01-31", costUsd: 100, periodType: "monthly" },
        { periodStart: "2024-02-01", periodEnd: "2024-02-29", costUsd: 120, periodType: "monthly" },
        { periodStart: "2024-03-01", periodEnd: "2024-03-31", costUsd: 110, periodType: "monthly" },
      ];
      const config: ForecastingConfig = {
        seasonalityPattern: "monthly",
        confidenceLevel: 0.95,
        horizonPeriods: 3,
      };

      const result = service.forecast(historicalData, config);

      assert.strictEqual(result.forecastPeriod, "monthly");
      assert.strictEqual(result.horizonPeriods, 3);
      assert.strictEqual(result.predictions.length, 3);
      assert.strictEqual(result.confidenceLevel, 0.95);
      assert.ok(result.forecastId.startsWith("forecast_"));
      assert.ok(result.generatedAt);
      assert.ok(result.trendAnalysis);
    });

    it("should handle empty historical data", () => {
      const config: ForecastingConfig = {
        seasonalityPattern: "monthly",
        horizonPeriods: 2,
      };

      const result = service.forecast([], config);

      assert.strictEqual(result.predictions.length, 2);
      assert.strictEqual(result.trendAnalysis.slope, 0);
      assert.strictEqual(result.trendAnalysis.rSquared, 0);
    });

    it("should handle single data point", () => {
      const historicalData: readonly CostDataPoint[] = [
        { periodStart: "2024-01-01", periodEnd: "2024-01-31", costUsd: 100, periodType: "monthly" },
      ];
      const config: ForecastingConfig = {
        seasonalityPattern: "linear",
        horizonPeriods: 1,
      };

      const result = service.forecast(historicalData, config);

      assert.strictEqual(result.predictions.length, 1);
      assert.strictEqual(result.trendAnalysis.intercept, 100);
      assert.strictEqual(result.trendAnalysis.slope, 0);
    });

    it("should apply custom seasonality coefficients", () => {
      const historicalData: readonly CostDataPoint[] = [
        { periodStart: "2024-01-01", periodEnd: "2024-01-31", costUsd: 100, periodType: "monthly" },
        { periodStart: "2024-02-01", periodEnd: "2024-02-29", costUsd: 100, periodType: "monthly" },
        { periodStart: "2024-03-01", periodEnd: "2024-03-31", costUsd: 100, periodType: "monthly" },
      ];
      const config: ForecastingConfig = {
        seasonalityPattern: "custom",
        customCoefficients: [
          { periodOffset: 0, coefficient: 1.2 },
          { periodOffset: 1, coefficient: 0.8 },
        ],
        horizonPeriods: 2,
      };

      const result = service.forecast(historicalData, config);

      assert.strictEqual(result.seasonalityPattern, "custom");
      assert.ok(result.predictions[0]?.includesSeasonality);
    });

    it("should compute valid trend analysis with linear regression", () => {
      // Linear data: y = 2x + 10
      const historicalData: readonly CostDataPoint[] = [
        { periodStart: "2024-01-01", periodEnd: "2024-01-31", costUsd: 10, periodType: "monthly" },
        { periodStart: "2024-02-01", periodEnd: "2024-02-29", costUsd: 12, periodType: "monthly" },
        { periodStart: "2024-03-01", periodEnd: "2024-03-31", costUsd: 14, periodType: "monthly" },
        { periodStart: "2024-04-01", periodEnd: "2024-04-30", costUsd: 16, periodType: "monthly" },
      ];
      const config: ForecastingConfig = {
        seasonalityPattern: "linear",
        horizonPeriods: 1,
      };

      const result = service.forecast(historicalData, config);

      assert.ok(result.trendAnalysis.slope > 0);
      assert.ok(result.trendAnalysis.rSquared >= 0);
      assert.ok(result.trendAnalysis.predictionInterval >= 0);
    });

    it("should calculate confidence intervals correctly", () => {
      const historicalData: readonly CostDataPoint[] = [
        { periodStart: "2024-01-01", periodEnd: "2024-01-31", costUsd: 100, periodType: "monthly" },
        { periodStart: "2024-02-01", periodEnd: "2024-02-29", costUsd: 100, periodType: "monthly" },
        { periodStart: "2024-03-01", periodEnd: "2024-03-31", costUsd: 100, periodType: "monthly" },
      ];
      const config: ForecastingConfig = {
        seasonalityPattern: "monthly",
        confidenceLevel: 0.95,
        horizonPeriods: 1,
      };

      const result = service.forecast(historicalData, config);
      const prediction = result.predictions[0];

      assert.ok(prediction);
      assert.ok(prediction.confidenceInterval.lowerBound <= prediction.predictedCostUsd);
      assert.ok(prediction.confidenceInterval.upperBound >= prediction.predictedCostUsd);
      assert.ok(prediction.confidenceInterval.lowerBound >= 0);
    });

    it("should use default horizon periods when not specified", () => {
      const historicalData: readonly CostDataPoint[] = [
        { periodStart: "2024-01-01", periodEnd: "2024-01-31", costUsd: 100, periodType: "monthly" },
      ];
      const config: ForecastingConfig = {
        seasonalityPattern: "linear",
      };

      const result = service.forecast(historicalData, config);

      assert.strictEqual(result.horizonPeriods, 3); // Default
    });

    it("should use default confidence level when not specified", () => {
      const historicalData: readonly CostDataPoint[] = [
        { periodStart: "2024-01-01", periodEnd: "2024-01-31", costUsd: 100, periodType: "monthly" },
      ];
      const config: ForecastingConfig = {
        seasonalityPattern: "linear",
      };

      const result = service.forecast(historicalData, config);

      assert.strictEqual(result.confidenceLevel, 0.95); // Default
    });
  });

  describe("detectPeriodType", () => {
    const createTestData = (daysDiff: number): readonly CostDataPoint[] => [
      {
        periodStart: "2024-01-01",
        periodEnd: new Date(Date.now() + daysDiff * 24 * 60 * 60 * 1000).toISOString(),
        costUsd: 100,
        periodType: "monthly",
      },
    ];

    it("should detect daily period", () => {
      const historicalData: readonly CostDataPoint[] = [
        { periodStart: "2024-01-01", periodEnd: "2024-01-02", costUsd: 10, periodType: "daily" },
        { periodStart: "2024-01-02", periodEnd: "2024-01-03", costUsd: 12, periodType: "daily" },
      ];
      const config: ForecastingConfig = { seasonalityPattern: "linear" };
      const result = service.forecast(historicalData, config);
      assert.strictEqual(result.forecastPeriod, "daily");
    });

    it("should detect weekly period", () => {
      const historicalData: readonly CostDataPoint[] = [
        { periodStart: "2024-01-01", periodEnd: "2024-01-08", costUsd: 100, periodType: "weekly" },
        { periodStart: "2024-01-08", periodEnd: "2024-01-15", costUsd: 120, periodType: "weekly" },
      ];
      const config: ForecastingConfig = { seasonalityPattern: "weekly" };
      const result = service.forecast(historicalData, config);
      assert.strictEqual(result.forecastPeriod, "weekly");
    });
  });
});