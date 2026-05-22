export function forecastCapacityUsage(currentUsage: number, growthRatePercent: number, periods: number): number[] {
  assertForecastInputs(currentUsage, growthRatePercent, periods);
  const result: number[] = [];
  let usage = currentUsage;
  for (let index = 0; index < periods; index += 1) {
    usage = Number((usage * (1 + growthRatePercent / 100)).toFixed(2));
    result.push(usage);
  }
  return result;
}

export function forecastCapacityPeak(currentUsage: number, growthRatePercent: number, periods: number): number {
  assertForecastInputs(currentUsage, growthRatePercent, periods);
  return Math.max(...forecastCapacityUsage(currentUsage, growthRatePercent, periods), currentUsage);
}

export interface ForecastSeries {
  readonly projectedUsage: readonly number[];
  readonly peak: number;
}

export class CapacityForecasterService {
  public forecast(currentUsage: number, growthRatePercent: number, periods: number): ForecastSeries {
    assertForecastInputs(currentUsage, growthRatePercent, periods);
    const projectedUsage = forecastCapacityUsage(currentUsage, growthRatePercent, periods);
    return {
      projectedUsage,
      peak: forecastCapacityPeak(currentUsage, growthRatePercent, periods),
    };
  }
}

function assertForecastInputs(currentUsage: number, growthRatePercent: number, periods: number): void {
  if (!Number.isFinite(currentUsage) || currentUsage < 0) {
    throw new Error("capacity_forecast.invalid_current_usage");
  }
  if (!Number.isFinite(growthRatePercent)) {
    throw new Error("capacity_forecast.invalid_growth_rate");
  }
  if (!Number.isInteger(periods) || periods < 0 || periods > 10_000) {
    throw new Error("capacity_forecast.invalid_periods");
  }
}
