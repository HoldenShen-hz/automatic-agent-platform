export interface CostOptimizationRecommendation {
  readonly recommendationId: string;
  readonly subjectId: string;
  readonly estimatedSavingsUsd: number;
  readonly riskLevel: "low" | "medium" | "high";
}

export function buildCostOptimizationRecommendation(subjectId: string, currentCostUsd: number): CostOptimizationRecommendation | null {
  if (currentCostUsd < 10) {
    return null;
  }
  return {
    recommendationId: `rec_${subjectId}`,
    subjectId,
    estimatedSavingsUsd: Number((currentCostUsd * 0.15).toFixed(2)),
    riskLevel: currentCostUsd > 100 ? "medium" : "low",
  };
}
