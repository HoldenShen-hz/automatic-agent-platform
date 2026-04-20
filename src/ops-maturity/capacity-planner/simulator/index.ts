export interface CapacityScenarioInput {
  readonly baselineUnits: number;
  readonly growthPercent: number;
  readonly optimizationPercent: number;
}

export function simulateCapacityScenario(input: CapacityScenarioInput): number {
  const grown = input.baselineUnits * (1 + input.growthPercent / 100);
  return Number((grown * (1 - input.optimizationPercent / 100)).toFixed(2));
}
