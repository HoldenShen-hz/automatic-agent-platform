import type { RolloutRecord } from "../oapeflir/types/rollout-record.js";

export interface RolloutMetrics {
  requestCount: number;
  failureRate: number;
  p99LatencyMs: number;
  baselineP99LatencyMs: number;
  observationWindowMs?: number;
}

export interface AutoRollbackConfig {
  maxFailureRate: number;
  maxLatencyMultiplier: number;
  minimumRequestCount: number;
  minimumObservationWindowMs: number;
}

export interface AutoRollbackDecision {
  rollback: boolean;
  reasonCodes: string[];
}

const DEFAULT_CONFIG: AutoRollbackConfig = {
  maxFailureRate: 0.05,
  maxLatencyMultiplier: 2,
  minimumRequestCount: 20,
  minimumObservationWindowMs: 60_000,
};

export class AutoRollbackService {
  private readonly config: AutoRollbackConfig;

  public constructor(config: Partial<AutoRollbackConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public evaluate(_rollout: RolloutRecord, metrics: RolloutMetrics): AutoRollbackDecision {
    const reasonCodes: string[] = [];
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
