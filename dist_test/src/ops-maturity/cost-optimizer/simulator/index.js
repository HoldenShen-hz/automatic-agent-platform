export function simulateCostOptimization(currentCostUsd, reductionPercent) {
    return Number((currentCostUsd * (1 - reductionPercent / 100)).toFixed(2));
}
//# sourceMappingURL=index.js.map