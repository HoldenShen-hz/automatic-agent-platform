/**
 * Provider health tracking for monitoring model/provider reliability.
 *
 * Tracks success rates, latency, and failure patterns for LLM providers to support
 * backpressure decisions, fallback routing, and degraded mode activation.
 *
 * ## References
 * - Contract: {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/observability_contract.md Observability Contract}
 * - Related: {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/debug_inspect_health_backpressure_contract.md debug_inspect_health_backpressure_contract.md}
 * - Related: {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/provider_reliability_contract.md provider_reliability_contract.md} (if exists)
 * - Glossary: {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md Glossary - provider, model, backpressure, heartbeat, trace}
 * - Architecture: {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/architecture/00-platform-architecture.md 01_architecture_and_technical_design.md}
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

export class ProviderHealthTracker {
  private readonly attempts: ProviderAttemptRecord[] = [];
  private readonly retentionLimit: number;
  private readonly degradedThreshold: number;
  private readonly failedThreshold: number;

  public constructor(options: ProviderHealthTrackerOptions = {}) {
    this.retentionLimit = options.retentionLimit ?? 500;
    this.degradedThreshold = options.degradedThreshold ?? 0.8;
    this.failedThreshold = options.failedThreshold ?? 0.5;
  }

  public recordAttempt(record: ProviderAttemptRecord): ProviderAttemptRecord {
    this.attempts.push(record);
    if (this.attempts.length > this.retentionLimit) {
      this.attempts.splice(0, this.attempts.length - this.retentionLimit);
    }
    return record;
  }

  public getSummary(windowMs: number = 5 * 60_000, now: string = new Date().toISOString()): ProviderHealthSummary {
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
    const status: ProviderHealthSummary["status"] =
      successRate < this.failedThreshold
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
