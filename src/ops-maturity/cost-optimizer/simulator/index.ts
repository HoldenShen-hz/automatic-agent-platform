export function simulateCostOptimization(currentCostUsd: number, reductionPercent: number): number {
  return Number((currentCostUsd * (1 - reductionPercent / 100)).toFixed(2));
}

export interface CostSimulationScenario {
  readonly scenarioId: string;
  readonly baselineCostUsd: number;
  readonly reductionPercent: number;
}

export function simulateScenarioSavings(scenarios: readonly CostSimulationScenario[]): Record<string, number> {
  return Object.fromEntries(
    scenarios.map((scenario) => [
      scenario.scenarioId,
      Number((scenario.baselineCostUsd - simulateCostOptimization(scenario.baselineCostUsd, scenario.reductionPercent)).toFixed(2)),
    ]),
  );
}
