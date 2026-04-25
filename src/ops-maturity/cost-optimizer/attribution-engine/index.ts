export interface CostAttributionEntry {
  readonly subjectId: string;
  readonly amountUsd: number;
}

export function aggregateCostAttribution(entries: readonly CostAttributionEntry[]): Record<string, number> {
  const raw = entries.reduce<Record<string, number>>((acc, item) => {
    acc[item.subjectId] = (acc[item.subjectId] ?? 0) + item.amountUsd;
    return acc;
  }, {});
  // Use Math.round with epsilon adjustment for 4 decimal places rounding
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => {
      const scaled = v * 10000;
      const rounded = Math.round(scaled + 1e-9); // Add small epsilon to handle floating-point errors
      return [k, rounded / 10000];
    })
  );
}
