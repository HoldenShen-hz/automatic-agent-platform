export function simulateCapacityScenario(input) {
    const grown = input.baselineUnits * (1 + input.growthPercent / 100);
    return Number((grown * (1 - input.optimizationPercent / 100)).toFixed(2));
}
//# sourceMappingURL=index.js.map