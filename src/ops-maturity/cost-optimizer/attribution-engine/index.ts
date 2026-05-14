export interface CostAttributionEntry {
  readonly subjectId: string;
  readonly amountUsd?: number;
  readonly llmCostUsd?: number;
  readonly toolCostUsd?: number;
  readonly computeCostUsd?: number;
  readonly storageCostUsd?: number;
  readonly egressCostUsd?: number;
  readonly humanReviewCostUsd?: number;
}

export function aggregateCostAttribution(entries: readonly CostAttributionEntry[]): Record<string, number> {
  const total = entries.reduce((sum, item) => sum + entryAmount(item), 0);
  const raw = entries.reduce<Record<string, number>>((acc, item) => {
    if (!acc[item.subjectId]) {
      acc[item.subjectId] = 0;
    }
    const current = acc[item.subjectId]!;
    acc[item.subjectId] = current + entryAmount(item);
    return acc;
  }, {});
  // Round to 4 decimal places for floating point precision
  const roundedEntries = Object.entries(raw).map(([k, v]) => [k, roundUsd(v)] as const);
  const roundedTotal = roundUsd(total);
  if (roundedEntries.length > 1) {
    const lastIndex = roundedEntries.length - 1;
    const priorSum = roundedEntries.slice(0, lastIndex).reduce((sum, [, value]) => sum + value, 0);
    const [key, value] = roundedEntries[lastIndex]!;
    const adjusted = roundedTotal - priorSum;
    if (roundUsd(adjusted) === value) {
      roundedEntries[lastIndex] = [key, adjusted] as const;
    }
  }
  return Object.fromEntries(roundedEntries);
}

function entryAmount(item: CostAttributionEntry): number {
  if (item.amountUsd !== undefined) {
    return item.amountUsd;
  }
  return (item.llmCostUsd ?? 0)
    + (item.toolCostUsd ?? 0)
    + (item.computeCostUsd ?? 0)
    + (item.storageCostUsd ?? 0)
    + (item.egressCostUsd ?? 0)
    + (item.humanReviewCostUsd ?? 0);
}

function roundUsd(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}
