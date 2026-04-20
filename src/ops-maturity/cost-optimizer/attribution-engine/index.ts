export interface CostAttributionEntry {
  readonly subjectId: string;
  readonly amountUsd: number;
}

export function aggregateCostAttribution(entries: readonly CostAttributionEntry[]): Record<string, number> {
  return entries.reduce<Record<string, number>>((acc, item) => {
    acc[item.subjectId] = Number(((acc[item.subjectId] ?? 0) + item.amountUsd).toFixed(4));
    return acc;
  }, {});
}
