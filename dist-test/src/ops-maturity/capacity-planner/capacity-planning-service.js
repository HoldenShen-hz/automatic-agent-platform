import { nowIso } from "../../platform/contracts/types/ids.js";
import { CapacityForecasterService } from "./forecaster/index.js";
import { CapacityScenarioSimulatorService } from "./simulator/index.js";
import { CapacityTrendAnalyzerService } from "./trend-analyzer/index.js";
export class CapacityPlanningService {
    signals = new Map();
    forecaster = new CapacityForecasterService();
    simulator = new CapacityScenarioSimulatorService();
    analyzer = new CapacityTrendAnalyzerService();
    recordSignal(signal) {
        const key = this.signalKey(signal.resourceType, signal.regionId);
        this.signals.set(key, [...(this.signals.get(key) ?? []), signal].sort((left, right) => left.timestamp.localeCompare(right.timestamp)));
        return signal;
    }
    forecast(resourceType, periods, options) {
        const window = this.getWindow(resourceType, options.start, options.end, options.regionId);
        if (window.length === 0) {
            throw new Error(`capacity_planning.empty_window:${resourceType}`);
        }
        const trend = this.analyzer.analyze(window.map((item) => item.usage));
        const latestUsage = window.at(-1).usage;
        const growthRatePercent = this.estimateGrowthRate(window);
        const projectedUsage = this.forecaster.forecast(latestUsage, growthRatePercent, periods).projectedUsage;
        const band = Math.max(1, Number((projectedUsage.at(-1) * 0.1).toFixed(2)));
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
                low: Number((projectedUsage.at(-1) - band).toFixed(2)),
                high: Number((projectedUsage.at(-1) + band).toFixed(2)),
            },
            trend: trend.direction,
            generatedAt: options.generatedAt ?? nowIso(),
        };
    }
    compareScenarios(scenarios) {
        return scenarios.map((scenario) => ({
            ...scenario,
            projectedUnits: this.simulator.simulate(scenario).projectedUnits,
        })).sort((left, right) => left.projectedUnits - right.projectedUnits);
    }
    buildRecommendation(forecast, options) {
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
    getWindow(resourceType, start, end, regionId) {
        return (this.signals.get(this.signalKey(resourceType, regionId)) ?? [])
            .filter((signal) => signal.timestamp >= start && signal.timestamp <= end);
    }
    estimateGrowthRate(signals) {
        if (signals.length < 2) {
            return 5;
        }
        const first = signals[0].usage;
        const last = signals.at(-1).usage;
        if (first === 0) {
            return 5;
        }
        return Number((((last - first) / first) * 100).toFixed(2));
    }
    signalKey(resourceType, regionId) {
        return `${resourceType}:${regionId ?? "global"}`;
    }
}
//# sourceMappingURL=capacity-planning-service.js.map