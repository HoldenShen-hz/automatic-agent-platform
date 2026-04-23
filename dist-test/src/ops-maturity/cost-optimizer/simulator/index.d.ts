export declare function simulateCostOptimization(currentCostUsd: number, reductionPercent: number): number;
export interface CostSimulationScenario {
    readonly scenarioId: string;
    readonly baselineCostUsd: number;
    readonly reductionPercent: number;
}
export declare function simulateScenarioSavings(scenarios: readonly CostSimulationScenario[]): Record<string, number>;
