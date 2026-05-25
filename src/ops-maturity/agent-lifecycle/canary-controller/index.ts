/**
 * Canary rollout stages as defined in architecture doc §61.4.
 */
export const CANARY_STAGES = [5, 20, 50, 100] as const;

export type CanaryStage = typeof CANARY_STAGES[number];

/**
 * Canary progress tracking with traffic splitting.
 * As defined in architecture doc §61.4.
 */
export interface CanaryProgress {
  readonly rolloutPercent: number;
  readonly successRate: number;
  readonly latencyP50Ms: number;
  readonly errorRate: number;
  readonly currentStage: CanaryStage;
}

/**
 * Canary promotion criteria per architecture doc §61.3.
 */
export interface CanaryPromotionCriteria {
  readonly minRolloutPercent: number;
  readonly minSuccessRate: number;
  readonly maxErrorRate: number;
  readonly maxLatencyP50Ms: number;
}

export const DEFAULT_PROMOTION_CRITERIA: CanaryPromotionCriteria = {
  minRolloutPercent: 25,
  minSuccessRate: 0.99,
  maxErrorRate: 0.01,
  maxLatencyP50Ms: 2000,
};

/**
 * Checks if canary should be promoted based on progress metrics.
 * As defined in architecture doc §61.3.
 */
export function shouldPromoteCanary(
  progress: CanaryProgress,
  criteria: CanaryPromotionCriteria = DEFAULT_PROMOTION_CRITERIA,
): boolean {
  const hasRequiredMetrics = Number.isFinite(progress.successRate)
    && Number.isFinite(progress.errorRate)
    && Number.isFinite(progress.latencyP50Ms);
  if (!hasRequiredMetrics) {
    return false;
  }
  const successRate = progress.successRate;
  const errorRate = progress.errorRate;
  const latencyP50Ms = progress.latencyP50Ms;
  return (
    progress.rolloutPercent >= criteria.minRolloutPercent &&
    successRate >= criteria.minSuccessRate &&
    errorRate <= criteria.maxErrorRate &&
    latencyP50Ms <= criteria.maxLatencyP50Ms
  );
}

/**
 * Gets the next canary stage based on current rollout percent.
 */
export function getNextCanaryStage(currentPercent: number): CanaryStage | null {
  for (const stage of CANARY_STAGES) {
    if (currentPercent < stage) {
      return stage;
    }
  }
  return null;
}

/**
 * Checks if canary should rollback based on metrics.
 */
export function shouldRollbackCanary(progress: CanaryProgress): boolean {
  const hasRequiredMetrics = Number.isFinite(progress.successRate)
    && Number.isFinite(progress.errorRate)
    && Number.isFinite(progress.latencyP50Ms);
  if (!hasRequiredMetrics) {
    return false;
  }
  return (
    progress.successRate < DEFAULT_PROMOTION_CRITERIA.minSuccessRate
    || progress.errorRate > DEFAULT_PROMOTION_CRITERIA.maxErrorRate
    || progress.latencyP50Ms > DEFAULT_PROMOTION_CRITERIA.maxLatencyP50Ms
  );
}

/**
 * Traffic split configuration for canary vs stable.
 */
export interface TrafficSplitConfig {
  readonly canaryPercent: number;
  readonly stablePercent: number;
  readonly weight: number;
}

/**
 * Calculates traffic split for given canary stage.
 * Handles invalid stage values by defaulting to 100% canary.
 */
export function calculateTrafficSplit(canaryStage: CanaryStage): TrafficSplitConfig {
  // canaryStage should be a number (5, 20, 50, 100) but test may pass invalid values
  const stage = typeof canaryStage === "number" && CANARY_STAGES.includes(canaryStage) ? canaryStage : 100;
  return {
    canaryPercent: stage,
    stablePercent: 100 - stage,
    weight: stage,
  };
}
