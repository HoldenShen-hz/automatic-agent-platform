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

function overrideRate(score: CapabilityTrustScore): number {
  return score.totalExecutions === 0 ? 1 : score.humanOverrides / score.totalExecutions;
}

export function assessPromotion(score: CapabilityTrustScore): PromotionAssessment {
  const rate = successRate(score);
  const overrides = overrideRate(score);

  // §42.2: Human override rate check - block promotion if override rate too high
  // supervised->semi_auto requires <5% override, semi_auto->full_auto requires <1%
  if (score.currentAutonomy === "supervised" && overrides >= 0.05) {
    return {
      shouldPromote: false,
      currentLevel: score.currentAutonomy,
      targetLevel: score.currentAutonomy,
      reasonCodes: ["autonomy.promotion_blocked_by_override_rate"],
    };
  }
  if (score.currentAutonomy === "semi_auto" && overrides >= 0.01) {
    return {
      shouldPromote: false,
      currentLevel: score.currentAutonomy,
      targetLevel: score.currentAutonomy,
      reasonCodes: ["autonomy.promotion_blocked_by_override_rate"],
    };
  }

  if (score.incidents > 0 || (score.failedExecutions > 2 && rate < 0.96)) {
    return {
      shouldPromote: false,
      currentLevel: score.currentAutonomy,
      targetLevel: score.currentAutonomy,
      reasonCodes: ["autonomy.promotion_blocked_by_incident"],
    };
  }
  if (score.currentAutonomy === "suggestion" && score.totalExecutions >= 50 && rate >= 0.95 && overrides < 0.05) {
    return { shouldPromote: true, currentLevel: score.currentAutonomy, targetLevel: "supervised", reasonCodes: ["autonomy.meets_supervised_threshold"] };
  }
  if (score.currentAutonomy === "supervised" && score.totalExecutions >= 200 && rate >= 0.98 && overrides < 0.01) {
    return { shouldPromote: true, currentLevel: score.currentAutonomy, targetLevel: "semi_auto", reasonCodes: ["autonomy.meets_semi_auto_threshold"] };
  }
  if (score.currentAutonomy === "semi_auto" && score.totalExecutions >= 500 && rate >= 0.99) {
    return {
      shouldPromote: false,
      currentLevel: score.currentAutonomy,
      targetLevel: score.currentAutonomy,
      reasonCodes: ["autonomy.full_auto_requires_governance_override"],
    };
  }
  return {
    shouldPromote: false,
    currentLevel: score.currentAutonomy,
    targetLevel: score.currentAutonomy,
    reasonCodes: ["autonomy.promotion_threshold_not_met"],
  };
}
