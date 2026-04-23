export function simulateCostOptimization(currentCostUsd, reductionPercent) {
    return Number((currentCostUsd * (1 - reductionPercent / 100)).toFixed(2));
}
export function simulateScenarioSavings(scenarios) {
    return Object.fromEntries(scenarios.map((scenario) => [
        scenario.scenarioId,
        Number((scenario.baselineCostUsd - simulateCostOptimization(scenario.baselineCostUsd, scenario.reductionPercent)).toFixed(2)),
    ]));
}
//# sourceMappingURL=index.js.map