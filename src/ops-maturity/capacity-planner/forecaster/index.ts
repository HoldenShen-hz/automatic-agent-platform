export function forecastCapacityUsage(currentUsage: number, growthRatePercent: number, periods: number): number[] {
  const result: number[] = [];
  let usage = currentUsage;
  for (let index = 0; index < periods; index += 1) {
    usage = Number((usage * (1 + growthRatePercent / 100)).toFixed(2));
    result.push(usage);
  }
  return result;
}

export function forecastCapacityPeak(currentUsage: number, growthRatePercent: number, periods: number): number {
  return Math.max(...forecastCapacityUsage(currentUsage, growthRatePercent, periods), currentUsage);
}

export interface ForecastSeries {
  readonly projectedUsage: readonly number[];
  readonly peak: number;
}

export class CapacityForecasterService {
  public forecast(currentUsage: number, growthRatePercent: number, periods: number): ForecastSeries {
    const projectedUsage = forecastCapacityUsage(currentUsage, growthRatePercent, periods);
    return {
      projectedUsage,
      peak: forecastCapacityPeak(currentUsage, growthRatePercent, periods),
    };
  }
}
