import { type CapacityScenarioInput } from "./simulator/index.js";
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
export declare class CapacityPlanningService {
    private readonly signals;
    private readonly forecaster;
    private readonly simulator;
    private readonly analyzer;
    recordSignal(signal: CapacitySignal): CapacitySignal;
    forecast(resourceType: string, periods: number, options: {
        readonly regionId?: string;
        readonly start: string;
        readonly end: string;
        readonly generatedAt?: string;
    }): CapacityForecast;
    compareScenarios(scenarios: readonly CapacityScenario[]): Array<CapacityScenario & {
        readonly projectedUnits: number;
    }>;
    buildRecommendation(forecast: CapacityForecast, options: {
        readonly costPerUnit: number;
        readonly targetHeadroomPercent: number;
        readonly maxQueueDepth?: number;
        readonly latestQueueDepth?: number;
        readonly latestErrorBudgetBurn?: number;
    }): CapacityRecommendation;
    private getWindow;
    private estimateGrowthRate;
    private signalKey;
}
