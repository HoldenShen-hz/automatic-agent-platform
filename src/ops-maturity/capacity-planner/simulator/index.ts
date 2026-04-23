export interface CapacityScenarioInput {
  readonly baselineUnits: number;
  readonly growthPercent: number;
  readonly optimizationPercent: number;
}

export function simulateCapacityScenario(input: CapacityScenarioInput): number {
  const grown = input.baselineUnits * (1 + input.growthPercent / 100);
  return Number((grown * (1 - input.optimizationPercent / 100)).toFixed(2));
}

export interface SimulatedScenarioResult {
  readonly projectedUnits: number;
  readonly savingsPercent: number;
}

export class CapacityScenarioSimulatorService {
  public simulate(input: CapacityScenarioInput): SimulatedScenarioResult {
    const projectedUnits = simulateCapacityScenario(input);
    return {
      projectedUnits,
      savingsPercent: Number((((input.baselineUnits - projectedUnits) / Math.max(1, input.baselineUnits)) * 100).toFixed(2)),
    };
  }
}
