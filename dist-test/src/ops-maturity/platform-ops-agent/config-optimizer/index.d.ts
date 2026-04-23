export declare function buildConfigOptimizationSuggestion(key: string, currentValue: number, recommendedValue: number): string;
export declare function estimateConfigOptimizationSavings(currentValue: number, recommendedValue: number): number;
export interface ConfigOptimizationInput {
    readonly key: string;
    readonly currentValue: number;
    readonly recommendedValue: number;
    readonly unitCostUsd?: number;
    readonly currentLoad?: number;
    readonly projectedLoad?: number;
}
export interface ConfigOptimizationResult {
    readonly summary: string;
    readonly estimatedSavings: number;
    readonly savingsPercent: number;
    readonly urgency: "low" | "medium" | "high";
    readonly reasonCodes: readonly string[];
}
export declare class ConfigOptimizerService {
    optimize(input: ConfigOptimizationInput): ConfigOptimizationResult;
}
