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
  evaluable: boolean;
  rollback: boolean;
  reasonCodes: string[];
}

const DEFAULT_CONFIG: AutoRollbackConfig = {
  maxFailureRate: 0.05,
  maxLatencyMultiplier: 2,
  minimumRequestCount: 20,
  minimumObservationWindowMs: 60_000,
};

export interface AutoRollbackServiceOptions {
  rollbackHandler?: (rollout: RolloutRecord, reasonCodes: string[]) => Promise<void> | void;
}

/**
 * R23-44 fix: AutoRollbackService evaluates metrics and triggers rollback when thresholds are exceeded.
 *
 * The evaluate() method returns an AutoRollbackDecision that signals whether rollback should occur.
 * Callers must invoke the rollbackHandler (if provided) to execute actual rollback.
 *
 * @example
 * ```typescript
 * const service = new AutoRollbackService({
 *   rollbackHandler: async (rollout, reasons) => {
 *     await rolloutStateMachine.transition(rollout.candidateId, "rolled_back");
 *   }
 * });
 * const decision = service.evaluate(rollout, metrics);
 * if (decision.rollback) {
 *   // decision.reasonCodes contains the failure reasons
 * }
 * ```
 */
export class AutoRollbackService {
  private readonly config: AutoRollbackConfig;
  /** R23-44 fix: Optional handler called when evaluate() returns rollback:true */
  private readonly rollbackHandler: ((rollout: RolloutRecord, reasonCodes: string[]) => Promise<void> | void) | undefined;

  public constructor(config: Partial<AutoRollbackConfig> & AutoRollbackServiceOptions = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rollbackHandler = config.rollbackHandler;
  }

  /**
   * R23-44 fix: Evaluates rollout metrics and determines if rollback should occur.
   *
   * Returns a decision object with rollback=true when failure rate or latency exceeds thresholds.
   * When rollback is indicated, callers MUST invoke the rollbackHandler to execute the actual
   * rollback operation (state transition, traffic routing, etc).
   *
   * @param rollout - The rollout record being evaluated
   * @param metrics - Current rollout metrics
   * @returns AutoRollbackDecision with rollback flag and reason codes
   */
  public evaluate(rollout: RolloutRecord, metrics: RolloutMetrics): AutoRollbackDecision {
    const decision = this.buildDecision(metrics);
    if (!decision.evaluable || !decision.rollback) {
      return decision;
    }
    this.executeRollbackSync(rollout, decision.reasonCodes);
    return decision;
  }

  public async evaluateAsync(rollout: RolloutRecord, metrics: RolloutMetrics): Promise<AutoRollbackDecision> {
    const decision = this.buildDecision(metrics);
    if (!decision.evaluable || !decision.rollback) {
      return decision;
    }
    await this.executeRollbackAsync(rollout, decision.reasonCodes);
    return decision;
  }

  private buildDecision(metrics: RolloutMetrics): AutoRollbackDecision {
    const reasonCodes: string[] = [];
    if (metrics.requestCount < this.config.minimumRequestCount) {
      return {
        evaluable: false,
        rollback: false,
        reasonCodes: ["rollout.metrics_insufficient_sample"],
      };
    }
    if ((metrics.observationWindowMs ?? this.config.minimumObservationWindowMs) < this.config.minimumObservationWindowMs) {
      return {
        evaluable: false,
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
      evaluable: true,
      rollback: reasonCodes.length > 0,
      reasonCodes,
    };
  }

  private executeRollbackSync(rollout: RolloutRecord, reasonCodes: string[]): void {
    if (!this.rollbackHandler) {
      return;
    }
    const result = this.rollbackHandler(rollout, reasonCodes);
    if (isPromiseLike(result)) {
      void result.catch(() => undefined);
      throw new Error("auto_rollback.async_handler_requires_evaluate_async");
    }
  }

  private async executeRollbackAsync(rollout: RolloutRecord, reasonCodes: string[]): Promise<void> {
    if (!this.rollbackHandler) {
      return;
    }
    await this.rollbackHandler(rollout, reasonCodes);
  }
}

function isPromiseLike(value: Promise<void> | void): value is Promise<void> {
  return value instanceof Promise;
}
