/**
 * Canary rollout stages as defined in architecture doc §61.4.
 */
export const CANARY_STAGES = [5, 20, 50, 100];
export const DEFAULT_PROMOTION_CRITERIA = {
    minRolloutPercent: 25,
    minSuccessRate: 0.99,
    maxErrorRate: 0.01,
    maxLatencyP50Ms: 2000,
};
/**
 * Checks if canary should be promoted based on progress metrics.
 * As defined in architecture doc §61.3.
 */
export function shouldPromoteCanary(progress, criteria = DEFAULT_PROMOTION_CRITERIA) {
    return (progress.rolloutPercent >= criteria.minRolloutPercent &&
        progress.successRate >= criteria.minSuccessRate &&
        progress.errorRate <= criteria.maxErrorRate &&
        progress.latencyP50Ms <= criteria.maxLatencyP50Ms);
}
/**
 * Gets the next canary stage based on current rollout percent.
 */
export function getNextCanaryStage(currentPercent) {
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
export function shouldRollbackCanary(progress) {
    return progress.errorRate > 0.05 || progress.successRate < 0.90;
}
/**
 * Calculates traffic split for given canary stage.
 */
export function calculateTrafficSplit(canaryStage) {
    return {
        canaryPercent: canaryStage,
        stablePercent: 100 - canaryStage,
    };
}
//# sourceMappingURL=index.js.map