const DEFAULT_CONFIG = {
    maxFailureRate: 0.05,
    maxLatencyMultiplier: 2,
    minimumRequestCount: 20,
    minimumObservationWindowMs: 60_000,
};
export class AutoRollbackService {
    config;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    evaluate(_rollout, metrics) {
        const reasonCodes = [];
        if (metrics.requestCount < this.config.minimumRequestCount) {
            return {
                rollback: false,
                reasonCodes: ["rollout.metrics_insufficient_sample"],
            };
        }
        if ((metrics.observationWindowMs ?? this.config.minimumObservationWindowMs) < this.config.minimumObservationWindowMs) {
            return {
                rollback: false,
                reasonCodes: ["rollout.metrics_insufficient_window"],
            };
        }
        if (metrics.failureRate > this.config.maxFailureRate) {
            reasonCodes.push("rollout.failure_rate_exceeded");
        }
        const baselineLatency = Math.max(metrics.baselineP99LatencyMs, 1);
        if ((metrics.p99LatencyMs / baselineLatency) > this.config.maxLatencyMultiplier) {
            reasonCodes.push("rollout.latency_multiplier_exceeded");
        }
        return {
            rollback: reasonCodes.length > 0,
            reasonCodes,
        };
    }
}
//# sourceMappingURL=auto-rollback-service.js.map