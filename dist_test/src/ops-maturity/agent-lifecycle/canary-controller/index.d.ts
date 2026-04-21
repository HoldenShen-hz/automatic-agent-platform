/**
 * Canary rollout stages as defined in architecture doc §61.4.
 */
export declare const CANARY_STAGES: readonly [5, 20, 50, 100];
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
export declare const DEFAULT_PROMOTION_CRITERIA: CanaryPromotionCriteria;
/**
 * Checks if canary should be promoted based on progress metrics.
 * As defined in architecture doc §61.3.
 */
export declare function shouldPromoteCanary(progress: CanaryProgress, criteria?: CanaryPromotionCriteria): boolean;
/**
 * Gets the next canary stage based on current rollout percent.
 */
export declare function getNextCanaryStage(currentPercent: number): CanaryStage | null;
/**
 * Checks if canary should rollback based on metrics.
 */
export declare function shouldRollbackCanary(progress: CanaryProgress): boolean;
/**
 * Traffic split configuration for canary vs stable.
 */
export interface TrafficSplitConfig {
    readonly canaryPercent: number;
    readonly stablePercent: number;
}
/**
 * Calculates traffic split for given canary stage.
 */
export declare function calculateTrafficSplit(canaryStage: CanaryStage): TrafficSplitConfig;
