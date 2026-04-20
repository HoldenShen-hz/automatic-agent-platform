export function simulateCostOptimization(currentCostUsd: number, reductionPercent: number): number {
  return Number((currentCostUsd * (1 - reductionPercent / 100)).toFixed(2));
}
