/**
 * Provider health tracking for monitoring model/provider reliability.
 *
 * Tracks success rates, latency, and failure patterns for LLM providers to support
 * backpressure decisions, fallback routing, and degraded mode activation.
 *
 * ## References
 * - Contract: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/contracts/observability_contract.md Observability Contract}
 * - Related: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/contracts/debug_inspect_health_backpressure_contract.md debug_inspect_health_backpressure_contract.md}
 * - Related: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/contracts/provider_reliability_contract.md provider_reliability_contract.md} (if exists)
 * - Glossary: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/governance/glossary_and_terminology.md Glossary - provider, model, backpressure, heartbeat, trace}
 * - Architecture: {@link https://github.com/anomalyco/opencode/tree/main/docs_zh/architecture/00-platform-architecture.md 01_architecture_and_technical_design.md}
 *
 * @module
 */
export class ProviderHealthTracker {
    attempts = [];
    retentionLimit;
    degradedThreshold;
    failedThreshold;
    constructor(options = {}) {
        this.retentionLimit = options.retentionLimit ?? 500;
        this.degradedThreshold = options.degradedThreshold ?? 0.8;
        this.failedThreshold = options.failedThreshold ?? 0.5;
    }
    recordAttempt(record) {
        this.attempts.push(record);
        if (this.attempts.length > this.retentionLimit) {
            this.attempts.splice(0, this.attempts.length - this.retentionLimit);
        }
        return record;
    }
    getSummary(windowMs = 5 * 60_000, now = new Date().toISOString()) {
        const cutoff = new Date(new Date(now).getTime() - windowMs).toISOString();
        const recent = this.attempts.filter((attempt) => attempt.recordedAt >= cutoff);
        if (recent.length === 0) {
            return {
                status: "healthy",
                successRate: 1,
                totalCalls: 0,
                failedCalls: 0,
                fallbackCount: 0,
                latestFailureCodes: [],
            };
        }
        const failedAttempts = recent.filter((attempt) => !attempt.succeeded);
        const successRate = (recent.length - failedAttempts.length) / recent.length;
        const status = successRate < this.failedThreshold
            ? "failed"
            : successRate < this.degradedThreshold
                ? "degraded"
                : "healthy";
        return {
            status,
            successRate: Math.round(successRate * 1000) / 1000,
            totalCalls: recent.length,
            failedCalls: failedAttempts.length,
            fallbackCount: recent.filter((attempt) => attempt.fallbackProvider != null).length,
            latestFailureCodes: failedAttempts.flatMap((attempt) => (attempt.errorCode ? [attempt.errorCode] : [])).slice(-5),
        };
    }
}
//# sourceMappingURL=provider-health-tracker.js.map