export function forecastCapacityUsage(currentUsage: number, growthRatePercent: number, periods: number): number[] {
  const result: number[] = [];
  let usage = currentUsage;
  for (let index = 0; index < periods; index += 1) {
    usage = Number((usage * (1 + growthRatePercent / 100)).toFixed(2));
    result.push(usage);
  }
  return result;
}
