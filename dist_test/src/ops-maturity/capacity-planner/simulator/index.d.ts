export interface CapacityScenarioInput {
    readonly baselineUnits: number;
    readonly growthPercent: number;
    readonly optimizationPercent: number;
}
export declare function simulateCapacityScenario(input: CapacityScenarioInput): number;
