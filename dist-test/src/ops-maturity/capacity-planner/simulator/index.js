export function simulateCapacityScenario(input) {
    const grown = input.baselineUnits * (1 + input.growthPercent / 100);
    return Number((grown * (1 - input.optimizationPercent / 100)).toFixed(2));
}
export class CapacityScenarioSimulatorService {
    simulate(input) {
        const projectedUnits = simulateCapacityScenario(input);
        return {
            projectedUnits,
            savingsPercent: Number((((input.baselineUnits - projectedUnits) / Math.max(1, input.baselineUnits)) * 100).toFixed(2)),
        };
    }
}
//# sourceMappingURL=index.js.map