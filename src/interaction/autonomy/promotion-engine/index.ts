import type { AutonomyLevel, CapabilityTrustScore } from "../index.js";

export interface PromotionAssessment {
  readonly shouldPromote: boolean;
  readonly currentLevel: AutonomyLevel;
  readonly targetLevel: AutonomyLevel;
  readonly reasonCodes: readonly string[];
}

const INCIDENT_FREE_WINDOWS_DAYS = {
  toSupervised: 30,
  toSemiAuto: 60,
  toFullAuto: 90,
} as const;

function successRate(score: CapabilityTrustScore): number {
  return score.totalExecutions === 0 ? 0 : score.successfulExecutions / score.totalExecutions;
}

function overrideRate(score: CapabilityTrustScore): number {
  return score.totalExecutions === 0 ? 0 : score.humanOverrides / score.totalExecutions;
}

function incidentFreeDays(score: CapabilityTrustScore): number {
  return score.lastIncidentAgeDays ?? Number.POSITIVE_INFINITY;
}

export function assessPromotion(score: CapabilityTrustScore): PromotionAssessment {
  const rate = successRate(score);
  const overrides = overrideRate(score);
  const lastIncidentAgeDays = incidentFreeDays(score);

  // §42.2: Incident-free time window check using lastIncidentTimestamp
  // Check that the incident-free window has actually elapsed, not just that no recent incident occurred
  const now = Date.now();
  const incidentFreeWindowMs = {
    toSupervised: INCIDENT_FREE_WINDOWS_DAYS.toSupervised * 24 * 3600 * 1000,
    toSemiAuto: INCIDENT_FREE_WINDOWS_DAYS.toSemiAuto * 24 * 3600 * 1000,
    toFullAuto: INCIDENT_FREE_WINDOWS_DAYS.toFullAuto * 24 * 3600 * 1000,
  };
  const lastIncidentTime = score.lastIncidentTimestamp ? new Date(score.lastIncidentTimestamp).getTime() : 0;
  const isIncidentFree = (windowMs: number) => lastIncidentTime === 0 || (now - lastIncidentTime) >= windowMs;

  // §42.2: Incident severity grading — P0/P1 incidents trigger immediate demotion regardless of override rate
  if (score.lastIncidentSeverity === "P0") {
    return {
      shouldPromote: false,
      currentLevel: score.currentAutonomy,
      targetLevel: "suggestion",
      reasonCodes: ["autonomy.promotion_blocked_by_p0_incident"],
    };
  }
  if (score.lastIncidentSeverity === "P1") {
    const demotionTarget = score.currentAutonomy === "full_auto"
      ? "semi_auto"
      : score.currentAutonomy === "semi_auto"
        ? "supervised"
        : score.currentAutonomy === "supervised"
          ? "suggestion"
          : score.currentAutonomy;
    return {
      shouldPromote: false,
      currentLevel: score.currentAutonomy,
      targetLevel: demotionTarget,
      reasonCodes: ["autonomy.promotion_blocked_by_p1_incident"],
    };
  }

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

  // §42.2: P2/P3 low-severity incidents don't block promotion (only P0/P1 do)
  if (score.lastIncidentSeverity === "P2" || score.lastIncidentSeverity === "P3") {
    // P2/P3 incidents are informational - don't block promotion
  } else if (score.incidents > 0 || (score.failedExecutions > 2 && rate < 0.96)) {
    return {
      shouldPromote: false,
      currentLevel: score.currentAutonomy,
      targetLevel: score.currentAutonomy,
      reasonCodes: ["autonomy.promotion_blocked_by_incident"],
    };
  }
  // R5-22 fix: Verify incident-free window has actually elapsed using lastIncidentTimestamp
  // lastIncidentAgeDays alone is insufficient - must confirm the full window has passed
  if (score.currentAutonomy === "suggestion" && !isIncidentFree(incidentFreeWindowMs.toSupervised)) {
    return {
      shouldPromote: false,
      currentLevel: score.currentAutonomy,
      targetLevel: score.currentAutonomy,
      reasonCodes: ["autonomy.promotion_blocked_by_incident_window"],
    };
  }
  if (score.currentAutonomy === "supervised" && !isIncidentFree(incidentFreeWindowMs.toSemiAuto)) {
    return {
      shouldPromote: false,
      currentLevel: score.currentAutonomy,
      targetLevel: score.currentAutonomy,
      reasonCodes: ["autonomy.promotion_blocked_by_incident_window"],
    };
  }
  if (score.currentAutonomy === "semi_auto" && !isIncidentFree(incidentFreeWindowMs.toFullAuto)) {
    return {
      shouldPromote: false,
      currentLevel: score.currentAutonomy,
      targetLevel: score.currentAutonomy,
      reasonCodes: ["autonomy.promotion_blocked_by_incident_window"],
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
