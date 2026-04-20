import { nowIso } from "../../platform/contracts/types/ids.js";
import { forecastCapacityUsage } from "./forecaster/index.js";
import { simulateCapacityScenario, type CapacityScenarioInput } from "./simulator/index.js";
import { analyzeCapacityTrend } from "./trend-analyzer/index.js";

export interface CapacitySignal {
  readonly resourceType: string;
  readonly regionId?: string;
  readonly timestamp: string;
  readonly usage: number;
  readonly queueDepth?: number;
  readonly errorBudgetBurn?: number;
}

export interface CapacityForecast {
  readonly resourceType: string;
  readonly regionId?: string;
  readonly trainingWindow: {
    readonly start: string;
    readonly end: string;
    readonly sampleCount: number;
  };
  readonly projectedUsage: readonly number[];
  readonly confidenceInterval: {
    readonly low: number;
    readonly high: number;
  };
  readonly trend: "up" | "down" | "flat";
  readonly generatedAt: string;
}

export interface CapacityScenario extends CapacityScenarioInput {
  readonly scenarioId: string;
  readonly label: string;
}

export interface CapacityRecommendation {
  readonly resourceType: string;
  readonly recommendedAction: "scale_up" | "hold" | "optimize";
  readonly rationale: string;
  readonly projectedPeak: number;
  readonly estimatedCostDeltaPercent: number;
  readonly sloRisk: "low" | "medium" | "high";
}

export class CapacityPlanningService {
  private readonly signals = new Map<string, CapacitySignal[]>();

  public recordSignal(signal: CapacitySignal): CapacitySignal {
    const key = this.signalKey(signal.resourceType, signal.regionId);
    this.signals.set(key, [...(this.signals.get(key) ?? []), signal].sort((left, right) => left.timestamp.localeCompare(right.timestamp)));
    return signal;
  }

  public forecast(
    resourceType: string,
    periods: number,
    options: {
      readonly regionId?: string;
      readonly start: string;
      readonly end: string;
      readonly generatedAt?: string;
    },
  ): CapacityForecast {
    const window = this.getWindow(resourceType, options.start, options.end, options.regionId);
    if (window.length === 0) {
      throw new Error(`capacity_planning.empty_window:${resourceType}`);
    }
    const trend = analyzeCapacityTrend(window.map((item) => item.usage));
    const latestUsage = window.at(-1)!.usage;
    const growthRatePercent = this.estimateGrowthRate(window);
    const projectedUsage = forecastCapacityUsage(latestUsage, growthRatePercent, periods);
    const band = Math.max(1, Number((projectedUsage.at(-1)! * 0.1).toFixed(2)));

    return {
      resourceType,
      ...(options.regionId != null ? { regionId: options.regionId } : {}),
      trainingWindow: {
        start: options.start,
        end: options.end,
        sampleCount: window.length,
      },
      projectedUsage,
      confidenceInterval: {
        low: Number((projectedUsage.at(-1)! - band).toFixed(2)),
        high: Number((projectedUsage.at(-1)! + band).toFixed(2)),
      },
      trend: trend.direction,
      generatedAt: options.generatedAt ?? nowIso(),
    };
  }

  public compareScenarios(scenarios: readonly CapacityScenario[]): Array<CapacityScenario & { readonly projectedUnits: number }> {
    return scenarios.map((scenario) => ({
      ...scenario,
      projectedUnits: simulateCapacityScenario(scenario),
    })).sort((left, right) => left.projectedUnits - right.projectedUnits);
  }

  public buildRecommendation(
    forecast: CapacityForecast,
    options: {
      readonly costPerUnit: number;
      readonly targetHeadroomPercent: number;
      readonly maxQueueDepth?: number;
      readonly latestQueueDepth?: number;
      readonly latestErrorBudgetBurn?: number;
    },
  ): CapacityRecommendation {
    if (forecast.trainingWindow.sampleCount <= 0) {
      throw new Error(`capacity_planning.forecast_window_required:${forecast.resourceType}`);
    }
    const projectedPeak = forecast.confidenceInterval.high;
    const queueRisk = (options.latestQueueDepth ?? 0) >= (options.maxQueueDepth ?? Number.POSITIVE_INFINITY);
    const burnRisk = (options.latestErrorBudgetBurn ?? 0) >= 0.1;
    const sloRisk = queueRisk || burnRisk
      ? "high"
      : forecast.trend === "up"
        ? "medium"
        : "low";
    const recommendedAction = sloRisk === "high"
      ? "scale_up"
      : forecast.trend === "down"
        ? "optimize"
        : "hold";
    const estimatedCostDeltaPercent = recommendedAction === "scale_up"
      ? options.targetHeadroomPercent
      : recommendedAction === "optimize"
        ? -10
        : 0;

    return {
      resourceType: forecast.resourceType,
      recommendedAction,
      rationale: `trend=${forecast.trend}; projected_peak=${projectedPeak}; cost_per_unit=${options.costPerUnit}`,
      projectedPeak,
      estimatedCostDeltaPercent,
      sloRisk,
    };
  }

  private getWindow(resourceType: string, start: string, end: string, regionId?: string): CapacitySignal[] {
    return (this.signals.get(this.signalKey(resourceType, regionId)) ?? [])
      .filter((signal) => signal.timestamp >= start && signal.timestamp <= end);
  }

  private estimateGrowthRate(signals: readonly CapacitySignal[]): number {
    if (signals.length < 2) {
      return 5;
    }
    const first = signals[0]!.usage;
    const last = signals.at(-1)!.usage;
    if (first === 0) {
      return 5;
    }
    return Number((((last - first) / first) * 100).toFixed(2));
  }

  private signalKey(resourceType: string, regionId?: string): string {
    return `${resourceType}:${regionId ?? "global"}`;
  }
}
