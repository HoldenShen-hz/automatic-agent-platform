import type { AutonomyLevel, CapabilityTrustScore } from "../index.js";

export interface PromotionAssessment {
  readonly shouldPromote: boolean;
  readonly currentLevel: AutonomyLevel;
  readonly targetLevel: AutonomyLevel;
  readonly reasonCodes: readonly string[];
}

function successRate(score: CapabilityTrustScore): number {
  return score.totalExecutions === 0 ? 0 : score.successfulExecutions / score.totalExecutions;
}

export function assessPromotion(score: CapabilityTrustScore): PromotionAssessment {
  const rate = successRate(score);
  if (score.incidents > 0 || score.failedExecutions > 2) {
    return {
      shouldPromote: false,
      currentLevel: score.currentAutonomy,
      targetLevel: score.currentAutonomy,
      reasonCodes: ["autonomy.promotion_blocked_by_incident"],
    };
  }
  if (score.currentAutonomy === "suggestion" && score.totalExecutions >= 50 && rate >= 0.95) {
    return { shouldPromote: true, currentLevel: score.currentAutonomy, targetLevel: "supervised", reasonCodes: ["autonomy.meets_supervised_threshold"] };
  }
  if (score.currentAutonomy === "supervised" && score.totalExecutions >= 200 && rate >= 0.98) {
    return { shouldPromote: true, currentLevel: score.currentAutonomy, targetLevel: "semi_auto", reasonCodes: ["autonomy.meets_semi_auto_threshold"] };
  }
  if (score.currentAutonomy === "semi_auto" && score.totalExecutions >= 500 && rate >= 0.99) {
    return { shouldPromote: true, currentLevel: score.currentAutonomy, targetLevel: "full_auto", reasonCodes: ["autonomy.meets_full_auto_threshold"] };
  }
  return {
    shouldPromote: false,
    currentLevel: score.currentAutonomy,
    targetLevel: score.currentAutonomy,
    reasonCodes: ["autonomy.promotion_threshold_not_met"],
  };
}
