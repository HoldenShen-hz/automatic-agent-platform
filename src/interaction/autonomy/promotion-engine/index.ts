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

function computeOverrideRate(score: CapabilityTrustScore): number {
  return score.totalExecutions === 0 ? 1 : score.humanOverrides / score.totalExecutions;
}

// R9-45: Per-level time window constraints for promotion
const PROMOTION_TIME_WINDOWS: Record<AutonomyLevel, number> = {
  suggestion: 30,    // 30 days incident-free for supervised
  supervised: 60,    // 60 days incident-free for semi_auto
  semi_auto: 90,     // 90 days incident-free for full_auto
  full_auto: 0,      // N/A - already at top
  frozen: 0,         // N/A - cannot promote from frozen
};

export function assessPromotion(score: CapabilityTrustScore): PromotionAssessment {
  const rate = successRate(score);
  // R9-43: Check override rate - high override rate blocks promotion
  const overrideRate = computeOverrideRate(score);
  const overrideThreshold = 0.05; // 5% override rate threshold

  // R9-45: Check per-level time window constraint
  const requiredIncidentFreeDays = PROMOTION_TIME_WINDOWS[score.currentAutonomy] ?? 0;
  const incidentFreeDays = score.lastIncidentAgeDays ?? 0;
  const timeWindowMet = incidentFreeDays >= requiredIncidentFreeDays;

  // R9-43: Block promotion if override rate exceeds threshold
  if (overrideRate >= overrideThreshold) {
    return {
      shouldPromote: false,
      currentLevel: score.currentAutonomy,
      targetLevel: score.currentAutonomy,
      reasonCodes: [`autonomy.promotion_blocked_by_override_rate:${overrideRate.toFixed(3)}`],
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

  // R9-45: Enforce time window constraint
  if (!timeWindowMet) {
    return {
      shouldPromote: false,
      currentLevel: score.currentAutonomy,
      targetLevel: score.currentAutonomy,
      reasonCodes: [`autonomy.promotion_blocked_by_time_window:${incidentFreeDays}d < ${requiredIncidentFreeDays}d`],
    };
  }

  if (score.currentAutonomy === "suggestion" && score.totalExecutions >= 50 && rate >= 0.95) {
    return { shouldPromote: true, currentLevel: score.currentAutonomy, targetLevel: "supervised", reasonCodes: ["autonomy.meets_supervised_threshold"] };
  }
  if (score.currentAutonomy === "supervised" && score.totalExecutions >= 200 && rate >= 0.98) {
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
