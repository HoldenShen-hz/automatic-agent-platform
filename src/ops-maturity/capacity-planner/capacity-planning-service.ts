import { nowIso } from "../../platform/contracts/types/ids.js";
import { CapacityForecasterService, forecastCapacityUsage } from "./forecaster/index.js";
import { CapacityScenarioSimulatorService, simulateCapacityScenario, type CapacityScenarioInput } from "./simulator/index.js";
import { CapacityTrendAnalyzerService, analyzeCapacityTrend } from "./trend-analyzer/index.js";

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
  readonly slaTier: "gold" | "silver" | "bronze";
  readonly queueDelayRiskMs: number;
  readonly budgetHeadroomPercent: number;
  readonly approvalCapacityNeeded: number;
  readonly providerQuotaPressure: number;
  readonly regionFailoverReservePercent: number;
}

export interface CapacityForecastActualComparison {
  readonly resourceType: string;
  readonly actualUsage: number;
  readonly forecastUsage: number;
  readonly errorRatio: number;
  readonly needsRecalibration: boolean;
}

export interface CapacityPlanningServiceOptions {
  readonly confidenceBandStdDevMultiplier?: number;
  readonly queueDepthToDelayMs?: number;
  readonly providerQuotaLimits?: Readonly<Record<string, number>>;
}

export class CapacityPlanningService {
  private readonly signals = new Map<string, CapacitySignal[]>();
  private readonly forecaster = new CapacityForecasterService();
  private readonly simulator = new CapacityScenarioSimulatorService();
  private readonly analyzer = new CapacityTrendAnalyzerService();
  private readonly confidenceBandStdDevMultiplier: number;
  private readonly queueDepthToDelayMs: number;
  private readonly providerQuotaLimits: Readonly<Record<string, number>>;

  public constructor(options: CapacityPlanningServiceOptions = {}) {
    this.confidenceBandStdDevMultiplier = options.confidenceBandStdDevMultiplier ?? 1.96;
    this.queueDepthToDelayMs = options.queueDepthToDelayMs ?? 100;
    this.providerQuotaLimits = options.providerQuotaLimits ?? {};
  }

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
    const trend = this.analyzer.analyze(window.map((item) => item.usage));
    const latestSignal = window.at(-1);
    if (latestSignal == null) {
      throw new Error(`capacity_planning.latest_signal_missing:${resourceType}`);
    }
    const latestUsage = latestSignal.usage;
    const growthRatePercent = this.estimateGrowthRate(window);
    const projectedUsage = this.forecaster.forecast(latestUsage, growthRatePercent, periods).projectedUsage;
    const latestProjection = projectedUsage.at(-1);
    if (latestProjection == null) {
      throw new Error(`capacity_planning.latest_projection_missing:${resourceType}`);
    }
    const usageValues = window.map((item) => item.usage);
    const variance = usageValues.reduce((sum, usage) => sum + (usage - latestUsage) ** 2, 0) / Math.max(1, usageValues.length - 1);
    const standardDeviation = Math.sqrt(Math.max(0, variance));
    const band = Math.max(1, Number((standardDeviation * this.confidenceBandStdDevMultiplier).toFixed(2)));

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
        low: Number((latestProjection - band).toFixed(2)),
        high: Number((latestProjection + band).toFixed(2)),
      },
      trend: trend.direction,
      generatedAt: options.generatedAt ?? nowIso(),
    };
  }

  public compareScenarios(scenarios: readonly CapacityScenario[]): Array<CapacityScenario & { readonly projectedUnits: number }> {
    return scenarios.map((scenario) => ({
      ...scenario,
      projectedUnits: this.simulator.simulate(scenario).projectedUnits,
    })).sort((left, right) => right.projectedUnits - left.projectedUnits);
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
    const providerQuotaLimit = this.providerQuotaLimits[forecast.resourceType];
    const providerQuotaPressure = providerQuotaLimit != null && providerQuotaLimit > 0
      ? Number(Math.min(1, projectedPeak / providerQuotaLimit).toFixed(4))
      : 0;

    return {
      resourceType: forecast.resourceType,
      recommendedAction,
      rationale: `trend=${forecast.trend}; projected_peak=${projectedPeak}; cost_per_unit=${options.costPerUnit}`,
      projectedPeak,
      estimatedCostDeltaPercent,
      sloRisk,
      slaTier: sloRisk === "low" ? "gold" : sloRisk === "medium" ? "silver" : "bronze",
      queueDelayRiskMs: Math.max(0, options.latestQueueDepth ?? 0) * this.queueDepthToDelayMs,
      budgetHeadroomPercent: Math.max(0, 100 - Math.max(0, estimatedCostDeltaPercent)),
      approvalCapacityNeeded: sloRisk === "high" ? 2 : 1,
      providerQuotaPressure,
      regionFailoverReservePercent: this.computeDynamicFailoverReserve(
        sloRisk === "low" ? "gold" : sloRisk === "medium" ? "silver" : "bronze",
        forecast.trend,
        providerQuotaPressure,
        options.latestErrorBudgetBurn ?? 0,
      ),
    };
  }

  public compareForecastToActual(input: {
    readonly forecast: CapacityForecast;
    readonly actualUsage: number;
    readonly maxErrorRatio: number;
    readonly actualPeriodIndex?: number;
  }): CapacityForecastActualComparison {
    const alignedIndex = input.actualPeriodIndex == null
      ? input.forecast.projectedUsage.length - 1
      : Math.min(Math.max(0, input.actualPeriodIndex), input.forecast.projectedUsage.length - 1);
    const forecastUsage = input.forecast.projectedUsage[alignedIndex];
    if (forecastUsage == null || forecastUsage === 0) {
      throw new Error(`capacity_planning.forecast_usage_required:${input.forecast.resourceType}`);
    }
    const errorRatio = Number((Math.abs(input.actualUsage - forecastUsage) / forecastUsage).toFixed(4));
    return {
      resourceType: input.forecast.resourceType,
      actualUsage: input.actualUsage,
      forecastUsage,
      errorRatio,
      needsRecalibration: errorRatio > input.maxErrorRatio,
    };
  }

  private getWindow(resourceType: string, start: string, end: string, regionId?: string): CapacitySignal[] {
    return (this.signals.get(this.signalKey(resourceType, regionId)) ?? [])
      .filter((signal) => signal.timestamp >= start && signal.timestamp <= end);
  }

  private estimateGrowthRate(signals: readonly CapacitySignal[]): number {
    if (signals.length < 2) {
      return 0;
    }
    const firstSignal = signals[0];
    const lastSignal = signals.at(-1);
    if (firstSignal == null || lastSignal == null) {
      return 0;
    }
    const first = firstSignal.usage;
    const last = lastSignal.usage;
    if (first === 0) {
      return 0;
    }
    return Number((((last - first) / first) * 100).toFixed(2));
  }

  private signalKey(resourceType: string, regionId?: string): string {
    return `${resourceType}:${regionId ?? "global"}`;
  }

  private computeDynamicFailoverReserve(
    slaTier: "gold" | "silver" | "bronze",
    trend: CapacityForecast["trend"],
    providerQuotaPressure: number,
    errorBudgetBurn: number,
  ): number {
    const base = slaTier === "gold" ? 30 : slaTier === "silver" ? 20 : 15;
    const trendAdjustment = trend === "up" ? 5 : trend === "down" ? -3 : 0;
    const quotaAdjustment = providerQuotaPressure >= 0.9 ? 10 : providerQuotaPressure >= 0.75 ? 5 : 0;
    const burnAdjustment = errorBudgetBurn >= 0.2 ? 10 : errorBudgetBurn >= 0.1 ? 5 : 0;
    return Math.max(10, Math.min(50, base + trendAdjustment + quotaAdjustment + burnAdjustment));
  }
}
