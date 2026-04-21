export interface CostOptimizationRecommendation {
  readonly recommendationId: string;
  readonly subjectId: string;
  readonly estimatedSavingsUsd: number;
  readonly riskLevel: "low" | "medium" | "high";
  readonly action: "right_size" | "downgrade_model" | "increase_cache_hit" | "schedule_shift";
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
    action: currentCostUsd > 100 ? "right_size" : "increase_cache_hit",
  };
}

export function prioritizeCostOptimizationRecommendations(
  items: readonly CostOptimizationRecommendation[],
): CostOptimizationRecommendation[] {
  return [...items].sort((left, right) => right.estimatedSavingsUsd - left.estimatedSavingsUsd);
}
