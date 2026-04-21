export function analyzeCapacityTrend(samples: readonly number[]): { readonly average: number; readonly direction: "up" | "down" | "flat" } {
  if (samples.length === 0) {
    return { average: 0, direction: "flat" };
  }
  const average = samples.reduce((sum, item) => sum + item, 0) / samples.length;
  const direction = samples.at(-1)! > samples[0]! ? "up" : samples.at(-1)! < samples[0]! ? "down" : "flat";
  return { average: Number(average.toFixed(2)), direction };
}

export function estimateCapacityVolatility(samples: readonly number[]): number {
  if (samples.length < 2) {
    return 0;
  }
  const deltas = samples.slice(1).map((value, index) => Math.abs(value - samples[index]!));
  return Number((deltas.reduce((sum, value) => sum + value, 0) / deltas.length).toFixed(2));
}
