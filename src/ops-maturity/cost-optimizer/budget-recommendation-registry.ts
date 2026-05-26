import type { BudgetRecommendationRegistryLike } from "../../platform/five-plane-execution/budget-allocator-types.js";
import type { CostOptimizationRecommendation } from "./recommendation-engine/index.js";

export interface CostRecommendationListener {
  onRecommendations(recommendations: readonly CostOptimizationRecommendation[]): void;
}

export class BudgetRecommendationRegistry implements BudgetRecommendationRegistryLike, CostRecommendationListener {
  private readonly recommendedLimitUsdBySubject = new Map<string, number>();

  public onRecommendations(recommendations: readonly CostOptimizationRecommendation[]): void {
    for (const recommendation of recommendations) {
      const currentLimit = this.recommendedLimitUsdBySubject.get(recommendation.subjectId);
      const proposedLimit = Math.max(0, recommendation.estimatedSavingsUsd);
      if (currentLimit == null || proposedLimit > currentLimit) {
        this.recommendedLimitUsdBySubject.set(recommendation.subjectId, proposedLimit);
      }
    }
  }

  public resolveRecommendedLimitUsd(subjectId: string, currentLimitUsd: number): number | null {
    const savingsUsd = this.recommendedLimitUsdBySubject.get(subjectId);
    if (savingsUsd == null || savingsUsd <= 0) {
      return null;
    }
    return Math.max(0, Number((currentLimitUsd - savingsUsd).toFixed(6)));
  }
}
