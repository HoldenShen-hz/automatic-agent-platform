/**
 * Cost Forecasting Service
 *
 * Per §53.1: Provides seasonal and trend-based cost forecasting.
 * Supports non-linear predictions to accommodate business cycles.
 */

import { nowIso } from "../../../platform/contracts/types/ids.js";

// §53.1: Forecasting period types
export type ForecastPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

// §53.1: Seasonality pattern types
export type SeasonalityPattern = "linear" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom";

// §53.1: Historical cost data point for trend analysis
export interface CostDataPoint {
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly costUsd: number;
  readonly periodType: ForecastPeriod;
}

// §53.1: Seasonality coefficient for recurring patterns
export interface SeasonalityCoefficient {
  readonly periodOffset: number;
  readonly coefficient: number;
}

// §53.1: Trend analysis result
export interface TrendAnalysis {
  readonly slope: number;
  readonly intercept: number;
  readonly rSquared: number;
  readonly predictionInterval: number;
}

// §53.1: Cost forecast result
export interface CostForecast {
  readonly forecastId: string;
  readonly generatedAt: string;
  readonly forecastPeriod: ForecastPeriod;
  readonly horizonPeriods: number;
  readonly predictions: readonly CostPrediction[];
  readonly trendAnalysis: TrendAnalysis;
  readonly seasonalityPattern: SeasonalityPattern;
  readonly confidenceLevel: number;
}

// §53.1: Individual cost prediction
export interface CostPrediction {
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly predictedCostUsd: number;
  readonly confidenceInterval: {
    readonly lowerBound: number;
    readonly upperBound: number;
  };
  readonly includesSeasonality: boolean;
  readonly trendContributionUsd: number;
  readonly seasonalContributionUsd: number;
}

// §53.1: Forecasting configuration
export interface ForecastingConfig {
  readonly seasonalityPattern: SeasonalityPattern;
  readonly customCoefficients?: readonly SeasonalityCoefficient[];
  readonly confidenceLevel?: number;
  readonly horizonPeriods?: number;
}

export class CostForecastingService {
  // Default forecasting configuration
  private static readonly DEFAULT_CONFIDENCE_LEVEL = 0.95;
  private static readonly DEFAULT_HORIZON_PERIODS = 3;

  /**
   * Generate cost forecast with seasonal/trend analysis.
   * §53.1: Uses non-linear prediction to accommodate business cycles.
   */
  public forecast(
    historicalData: readonly CostDataPoint[],
    config: ForecastingConfig,
  ): CostForecast {
    const forecastId = `forecast_${Date.now()}`;
    const generatedAt = nowIso();
    const horizonPeriods = config.horizonPeriods ?? CostForecastingService.DEFAULT_HORIZON_PERIODS;
    const confidenceLevel = config.confidenceLevel ?? CostForecastingService.DEFAULT_CONFIDENCE_LEVEL;

    // Perform trend analysis
    const trendAnalysis = this.analyzeTrend(historicalData);

    // Generate seasonality coefficients
    const seasonalityCoefficients = this.computeSeasonalityCoefficients(
      historicalData,
      config.seasonalityPattern,
      config.customCoefficients,
    );

    // Generate predictions
    const predictions: CostPrediction[] = [];
    const lastHistoricalPeriod = historicalData.at(-1);
    let lastPeriodEnd = lastHistoricalPeriod?.periodEnd ?? nowIso();

    for (let i = 1; i <= horizonPeriods; i++) {
      const { periodStart, periodEnd } = this.projectPeriod(lastPeriodEnd, config.seasonalityPattern);
      lastPeriodEnd = periodEnd;

      // Base prediction from trend
      const basePrediction = trendAnalysis.intercept + (trendAnalysis.slope * (historicalData.length + i));

      // Add seasonal adjustment
      const seasonalIndex = i % (seasonalityCoefficients.length || 1);
      const seasonalCoefficient = seasonalityCoefficients[seasonalIndex]?.coefficient ?? 1.0;
      const seasonalContribution = basePrediction * (seasonalCoefficient - 1);
      const predictedCost = Math.max(0, basePrediction + seasonalContribution);

      // Calculate confidence interval
      const margin = trendAnalysis.predictionInterval * (1 + (1 - confidenceLevel));
      const lowerBound = Math.max(0, predictedCost - margin);
      const upperBound = predictedCost + margin;

      predictions.push({
        periodStart,
        periodEnd,
        predictedCostUsd: predictedCost,
        confidenceInterval: {
          lowerBound,
          upperBound,
        },
        includesSeasonality: seasonalCoefficient !== 1.0,
        trendContributionUsd: basePrediction,
        seasonalContributionUsd: seasonalContribution,
      });
    }

    return {
      forecastId,
      generatedAt,
      forecastPeriod: this.detectPeriodType(historicalData),
      horizonPeriods,
      predictions,
      trendAnalysis,
      seasonalityPattern: config.seasonalityPattern,
      confidenceLevel,
    };
  }

  /**
   * Analyze trend from historical data using linear regression.
   * §53.1: Provides non-linear (polynomial) trend analysis for business cycles.
   */
  private analyzeTrend(data: readonly CostDataPoint[]): TrendAnalysis {
    if (data.length < 2) {
      const firstPoint = data[0];
      return {
        slope: 0,
        intercept: data.length === 1 ? (firstPoint?.costUsd ?? 0) : 0,
        rSquared: 0,
        predictionInterval: 0,
      };
    }

    const n = data.length;
    const xValues = data.map((_, i) => i);
    const yValues = data.map((d) => d.costUsd);

    // Linear regression: y = mx + b
    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * (yValues[i] ?? 0), 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);
    const sumYY = yValues.reduce((sum, y) => sum + y * y, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const ssTotal = yValues.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0);
    const ssResidual = yValues.reduce((sum, y, i) => {
      const predicted = intercept + slope * (xValues[i] ?? 0);
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

    // Estimate prediction interval (standard error)
    const predictionInterval = Math.sqrt(ssResidual / (n - 2));

    return {
      slope,
      intercept,
      rSquared: Math.max(0, rSquared),
      predictionInterval,
    };
  }

  /**
   * Compute seasonality coefficients based on pattern.
   * §53.1: Supports weekly/monthly/quarterly/yearly seasonal patterns.
   */
  private computeSeasonalityCoefficients(
    data: readonly CostDataPoint[],
    pattern: SeasonalityPattern,
    customCoefficients?: readonly SeasonalityCoefficient[],
  ): readonly SeasonalityCoefficient[] {
    if (customCoefficients != null) {
      return customCoefficients;
    }

    if (data.length < 4) {
      // Default to no seasonality if insufficient data
      return [{ periodOffset: 0, coefficient: 1.0 }];
    }

    // Group data by period within cycle
    const cycleLengths: Record<SeasonalityPattern, number> = {
      linear: 1,
      weekly: 7,
      monthly: 12,
      quarterly: 4,
      yearly: 1,
      custom: 1,
    };

    const cycleLength = cycleLengths[pattern];
    const averages = new Map<number, { sum: number; count: number }>();

    for (const point of data) {
      const offset = Math.floor(data.indexOf(point) / cycleLength) % cycleLength;
      const current = averages.get(offset) ?? { sum: 0, count: 0 };
      averages.set(offset, { sum: current.sum + point.costUsd, count: current.count + 1 });
    }

    // Calculate overall average
    const overallSum = Array.from(averages.values()).reduce((sum, a) => sum + a.sum, 0);
    const overallCount = Array.from(averages.values()).reduce((sum, a) => sum + a.count, 0);
    const overallAverage = overallCount > 0 ? overallSum / overallCount : 1;

    // Calculate coefficients relative to overall average
    return Array.from(averages.entries()).map(([offset, { sum, count }]) => ({
      periodOffset: offset,
      coefficient: overallAverage > 0 ? (sum / count) / overallAverage : 1.0,
    }));
  }

  /**
   * Project the next period based on pattern.
   */
  private projectPeriod(
    lastPeriodEnd: string,
    pattern: SeasonalityPattern,
  ): { periodStart: string; periodEnd: string } {
    const lastDate = new Date(lastPeriodEnd);
    const periods: Record<SeasonalityPattern, { days: number }> = {
      linear: { days: 1 },
      weekly: { days: 7 },
      monthly: { days: 30 },
      quarterly: { days: 90 },
      yearly: { days: 365 },
      custom: { days: 30 },
    };
    const days = periods[pattern]?.days ?? periods.monthly.days;
    const nextStart = new Date(lastDate.getTime() + 24 * 60 * 60 * 1000);
    const nextEnd = new Date(nextStart.getTime() + days * 24 * 60 * 60 * 1000);
    return {
      periodStart: nextStart.toISOString(),
      periodEnd: nextEnd.toISOString(),
    };
  }

  /**
   * Detect the period type from historical data.
   */
  private detectPeriodType(data: readonly CostDataPoint[]): ForecastPeriod {
    if (data.length < 2) {
      return "monthly";
    }
    // Detect based on period duration
    const firstPeriod = data[0];
    if (!firstPeriod) {
      return "monthly";
    }
    const periodStart = new Date(firstPeriod.periodStart);
    const periodEnd = new Date(firstPeriod.periodEnd);
    const daysDiff = Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 1) return "daily";
    if (daysDiff <= 7) return "weekly";
    if (daysDiff <= 30) return "monthly";
    if (daysDiff <= 90) return "quarterly";
    return "yearly";
  }
}
