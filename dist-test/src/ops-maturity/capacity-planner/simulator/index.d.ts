export interface CapacityScenarioInput {
    readonly baselineUnits: number;
    readonly growthPercent: number;
    readonly optimizationPercent: number;
}
export declare function simulateCapacityScenario(input: CapacityScenarioInput): number;
export interface SimulatedScenarioResult {
    readonly projectedUnits: number;
    readonly savingsPercent: number;
}
export declare class CapacityScenarioSimulatorService {
    simulate(input: CapacityScenarioInput): SimulatedScenarioResult;
}
