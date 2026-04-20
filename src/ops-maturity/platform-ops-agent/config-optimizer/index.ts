export function buildConfigOptimizationSuggestion(key: string, currentValue: number, recommendedValue: number): string {
  return `${key}: ${currentValue} -> ${recommendedValue}`;
}
