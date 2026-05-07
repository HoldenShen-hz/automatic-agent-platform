export interface CostAttributionEntry {
  readonly subjectId: string;
  readonly llmCostUsd: number;
  readonly toolCostUsd: number;
  readonly computeCostUsd: number;
  readonly storageCostUsd: number;
  readonly egressCostUsd: number;
  readonly humanReviewCostUsd: number;
}

export function aggregateCostAttribution(entries: readonly CostAttributionEntry[]): Record<string, number> {
  const raw = entries.reduce<Record<string, { llm: number; tool: number; compute: number; storage: number; egress: number; humanReview: number }>>((acc, item) => {
    if (!acc[item.subjectId]) {
      acc[item.subjectId] = { llm: 0, tool: 0, compute: 0, storage: 0, egress: 0, humanReview: 0 };
    }
    acc[item.subjectId].llm += item.llmCostUsd;
    acc[item.subjectId].tool += item.toolCostUsd;
    acc[item.subjectId].compute += item.computeCostUsd;
    acc[item.subjectId].storage += item.storageCostUsd;
    acc[item.subjectId].egress += item.egressCostUsd;
    acc[item.subjectId].humanReview += item.humanReviewCostUsd;
    return acc;
  }, {});
  // Compute total per subject (sum of 7 dimensions)
  // Use Math.round with epsilon adjustment for 4 decimal places rounding
  return Object.fromEntries(
    Object.entries(raw).map(([k, v]) => {
      const total = v.llm + v.tool + v.compute + v.storage + v.egress + v.humanReview;
      const scaled = total * 10000;
      const rounded = Math.round(scaled + 1e-9);
      return [k, rounded / 10000];
    })
  );
}
