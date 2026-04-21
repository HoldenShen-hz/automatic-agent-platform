/**
 * @fileoverview Horizontal Scaling Controller
 *
 * Implements §8 "可扩展性" - automatic scaling strategy.
 * Monitors queue depth and worker utilization to trigger HPA events.
 *
 * Scaling triggers:
 * - Queue backlog > threshold → scale out workers
 * - Worker utilization > 80% → scale out
 * - Queue depth < threshold × 0.3 → scale in
 * - Worker utilization < 30% → scale in
 */
const DEFAULT_SCALING_POLICY = {
    scaleOutThreshold: 10,
    scaleInThreshold: 3,
    targetUtilization: 70,
    minWorkers: 1,
    maxWorkers: 100,
    stabilizationWindowSeconds: 300,
    cooldownSeconds: 60,
};
/**
 * Determines scaling direction based on queue depth and worker utilization.
 *
 * @param metrics - Current worker pool and queue metrics
 * @param policy - Scaling policy thresholds
 * @returns ScalingAction with direction, desired count, and reason
 */
export function evaluateScalingAction(metrics, policy = DEFAULT_SCALING_POLICY) {
    const now = new Date().toISOString();
    const metricsList = [
        { name: "utilization", current: metrics.utilizationPercent, target: policy.targetUtilization, unit: "%" },
        { name: "queueDepth", current: metrics.queueDepth, target: policy.scaleOutThreshold, unit: "tasks" },
    ];
    // Scale out conditions
    if (metrics.queueDepth > policy.scaleOutThreshold && metrics.utilizationPercent > policy.targetUtilization) {
        const desiredWorkers = Math.min(Math.ceil(metrics.activeWorkers * 1.5), policy.maxWorkers);
        return {
            direction: "out",
            desiredWorkers,
            reason: `Queue depth (${metrics.queueDepth}) exceeds threshold (${policy.scaleOutThreshold}) and utilization (${metrics.utilizationPercent}%) above target (${policy.targetUtilization}%)`,
            metrics: metricsList,
            timestamp: now,
        };
    }
    if (metrics.utilizationPercent > 80 && metrics.queueDepth > policy.scaleOutThreshold * 0.5) {
        const desiredWorkers = Math.min(metrics.activeWorkers + 2, policy.maxWorkers);
        return {
            direction: "out",
            desiredWorkers,
            reason: `High utilization (${metrics.utilizationPercent}%) with backlog`,
            metrics: metricsList,
            timestamp: now,
        };
    }
    // Scale in conditions
    if (metrics.utilizationPercent < 30 && metrics.queueDepth < policy.scaleInThreshold) {
        const desiredWorkers = Math.max(Math.floor(metrics.activeWorkers * 0.7), policy.minWorkers);
        return {
            direction: "in",
            desiredWorkers,
            reason: `Low utilization (${metrics.utilizationPercent}%) and queue nearly empty (${metrics.queueDepth})`,
            metrics: metricsList,
            timestamp: now,
        };
    }
    return {
        direction: "none",
        desiredWorkers: metrics.activeWorkers,
        reason: "Metrics within acceptable range",
        metrics: metricsList,
        timestamp: now,
    };
}
/**
 * Horizontal Scaling Controller
 *
 * Monitors worker pool and queue metrics, emits HPA events when scaling thresholds are breached.
 * Implements the automatic scaling strategy from §8.4.
 */
export class HorizontalScalingController {
    poolName;
    policy;
    lastScalingAction = null;
    lastActionTimestamp = 0;
    cooldownMs;
    constructor(poolName, policy = DEFAULT_SCALING_POLICY) {
        this.poolName = poolName;
        this.policy = policy;
        this.cooldownMs = policy.cooldownSeconds * 1000;
    }
    /**
     * Process metrics and determine if scaling is needed.
     */
    processMetrics(queueStats, workerMetrics) {
        const now = Date.now();
        const action = evaluateScalingAction(workerMetrics, this.policy);
        // Check cooldown
        if (action.direction !== "none" && this.lastScalingAction?.direction === action.direction) {
            const elapsed = now - this.lastActionTimestamp;
            if (elapsed < this.cooldownMs) {
                return {
                    eventType: "cooldown_active",
                    timestamp: new Date().toISOString(),
                    workerPool: this.poolName,
                    action: {
                        direction: "none",
                        desiredWorkers: workerMetrics.activeWorkers,
                        reason: `Cooldown active, ${Math.ceil((this.cooldownMs - elapsed) / 1000)}s remaining`,
                        metrics: action.metrics,
                        timestamp: action.timestamp,
                    },
                    cooldownRemainingMs: this.cooldownMs - elapsed,
                };
            }
        }
        // No action needed
        if (action.direction === "none") {
            this.lastScalingAction = action;
            return null;
        }
        this.lastScalingAction = action;
        this.lastActionTimestamp = now;
        return {
            eventType: action.direction === "out" ? "scale_out" : "scale_in",
            timestamp: new Date().toISOString(),
            workerPool: this.poolName,
            action,
        };
    }
    /**
     * Compute recommended worker count from queue depth using HPA-style formula.
     *
     * replicas = ceil(sum(requests) / targetAvg)
     * Simplified: desiredWorkers = ceil(queueDepth / targetWorkersPerWorker)
     */
    computeWorkerCount(queueStats, targetWorkersPerWorker = 5) {
        const pending = queueStats.waiting + queueStats.active;
        return Math.max(1, Math.ceil(pending / targetWorkersPerWorker));
    }
    /**
     * Get current scaling state.
     */
    getScalingState() {
        const elapsed = Date.now() - this.lastActionTimestamp;
        return {
            lastAction: this.lastScalingAction,
            cooldownRemainingMs: Math.max(0, this.cooldownMs - elapsed),
        };
    }
}
//# sourceMappingURL=horizontal-scaling-controller.js.map