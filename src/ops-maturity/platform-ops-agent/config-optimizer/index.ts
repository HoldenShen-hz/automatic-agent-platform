export function buildConfigOptimizationSuggestion(key: string, currentValue: number, recommendedValue: number): string {
  return `${key}: ${currentValue} -> ${recommendedValue}`;
}

export function estimateConfigOptimizationSavings(currentValue: number, recommendedValue: number): number {
  return Number(Math.max(0, currentValue - recommendedValue).toFixed(2));
}
