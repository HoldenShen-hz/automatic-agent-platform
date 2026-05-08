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
  const raw = entries.reduce<Record<string, number>>((acc, item) => {
    if (!acc[item.subjectId]) {
      acc[item.subjectId] = 0;
    }
    const current = acc[item.subjectId]!;
    // Use amountUsd if present, otherwise sum individual cost fields
    if (item.amountUsd !== undefined) {
      acc[item.subjectId] = current + item.amountUsd;
    } else {
      acc[item.subjectId] = current
        + (item.llmCostUsd ?? 0)
        + (item.toolCostUsd ?? 0)
        + (item.computeCostUsd ?? 0)
        + (item.storageCostUsd ?? 0)
        + (item.egressCostUsd ?? 0)
        + (item.humanReviewCostUsd ?? 0);
    }
    return acc;
  }, {});
  // Round to 4 decimal places for floating point precision
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => {
      const scaled = v * 10000;
      const rounded = Math.round(scaled + 1e-9);
      return [k, rounded / 10000];
    })
  );
}
