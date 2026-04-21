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
export interface ProviderAttemptRecord {
    provider: string;
    model: string;
    succeeded: boolean;
    latencyMs: number;
    recordedAt: string;
    errorCode?: string;
    fallbackProvider?: string;
}
export interface ProviderHealthSummary {
    status: "healthy" | "degraded" | "failed";
    successRate: number;
    totalCalls: number;
    failedCalls: number;
    fallbackCount: number;
    latestFailureCodes: string[];
}
export interface ProviderHealthTrackerOptions {
    retentionLimit?: number;
    degradedThreshold?: number;
    failedThreshold?: number;
}
export declare class ProviderHealthTracker {
    private readonly attempts;
    private readonly retentionLimit;
    private readonly degradedThreshold;
    private readonly failedThreshold;
    constructor(options?: ProviderHealthTrackerOptions);
    recordAttempt(record: ProviderAttemptRecord): ProviderAttemptRecord;
    getSummary(windowMs?: number, now?: string): ProviderHealthSummary;
}
