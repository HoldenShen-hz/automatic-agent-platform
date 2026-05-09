import type { RolloutRecord, RolloutStatus } from "../oapeflir/types/rollout-record.js";
import { AutoRollbackService, type RolloutMetrics } from "./auto-rollback-service.js";
import { GuardrailEvaluator } from "./guardrail-evaluator.js";
import type { ImprovementCandidate } from "./improvement-candidate-registry.js";
import { RolloutStateMachine } from "./rollout/rollout-state-machine.js";
import type { StrategyReleaseLevel, StrategyVersion } from "./strategy-versioning.js";
import { rolloutFreezeManager } from "../../shared/observability/rollout-freeze-manager.js";

export interface RolloutDecision {
  allowed: boolean;
  releaseLevel: StrategyReleaseLevel;
  reasonCode: string;
  reasonCodes: string[];
}

export interface MetricsGateDecision {
  allowed: boolean;
  rollback: boolean;
  reasonCodes: string[];
}

const PROGRESSIVE_STATUSES: ReadonlySet<RolloutStatus> = new Set([
  "canary_5",
  "partial_25",
  "stable_75",
  "stable_100",
]);

export class PolicyRolloutService {
  private readonly stateMachine = new RolloutStateMachine();
  private readonly guardrails = new GuardrailEvaluator();
  private readonly autoRollback: AutoRollbackService;

  public constructor(autoRollback: AutoRollbackService = new AutoRollbackService()) {
    this.autoRollback = autoRollback;
  }

  public decide(candidate: ImprovementCandidate, strategyVersion: StrategyVersion): RolloutDecision {
    // Check if rollouts are frozen due to error budget exhaustion
    if (rolloutFreezeManager.isFrozen()) {
      return {
        allowed: false,
        releaseLevel: "L0_off",
        reasonCode: "rollout.frozen_error_budget",
        reasonCodes: ["rollout.frozen_error_budget: rollouts are frozen due to error budget exhaustion"],
      };
    }

    const guardrailDecision = this.guardrails.evaluate(candidate, strategyVersion);
    if (!guardrailDecision.allowed) {
      return {
        allowed: false,
        releaseLevel: "L0_off",
        reasonCode: guardrailDecision.reasonCodes[0] ?? "improvement.guardrail_blocked",
        reasonCodes: guardrailDecision.reasonCodes,
      };
    }
    if (candidate.status !== "approved" && strategyVersion.releaseLevel !== "L0_off") {
      return {
        allowed: false,
        releaseLevel: "L0_off",
        reasonCode: "improvement.candidate_not_approved",
        reasonCodes: ["improvement.candidate_not_approved"],
      };
    }
    return {
      allowed: true,
      releaseLevel: strategyVersion.releaseLevel,
      reasonCode: `improvement.${strategyVersion.releaseLevel}`,
      reasonCodes: [`improvement.${strategyVersion.releaseLevel}`],
    };
  }

  public start(candidate: ImprovementCandidate, strategyVersion: StrategyVersion, approvedBy?: string): RolloutRecord | null {
    const decision = this.decide(candidate, strategyVersion);
    if (!decision.allowed) {
      return null;
    }
    return this.stateMachine.transition(candidate, decision.releaseLevel, {
      approvedBy,
      strategyVersionId: strategyVersion.strategyVersionId,
      guardrailReasonCodes: decision.reasonCodes,
      triggeredBy: approvedBy == null ? "scheduler" : "human",
      triggerReason: decision.reasonCode,
    });
  }

  public promote(
    candidate: ImprovementCandidate,
    current: RolloutRecord,
    targetStatus: Exclude<RolloutStatus, "candidate_created" | "under_review" | "approved" | "rejected" | "rolled_back" | "paused">,
    metrics?: RolloutMetrics,
    approvedBy?: string,
  ): RolloutRecord {
    const metricsGate = this.evaluateMetricsGate(current, targetStatus, metrics);
    if (!metricsGate.allowed) {
      if (metricsGate.rollback && metrics) {
        return this.rollback(candidate, current, metrics, approvedBy);
      }
      throw new Error(metricsGate.reasonCodes[0] ?? `Invalid rollout promotion: ${current.status} -> ${targetStatus}`);
    }
    return this.stateMachine.transition(candidate, inferLevelFromStatus(targetStatus), {
      currentStatus: current.status,
      targetStatus,
      approvedBy,
      strategyVersionId: current.strategyVersionId,
      guardrailReasonCodes: metricsGate.reasonCodes,
      triggeredBy: approvedBy == null ? "scheduler" : "human",
      triggerReason: metricsGate.reasonCodes[0] ?? `rollout.promote.${targetStatus}`,
      metrics: metrics == null ? undefined : {
        errorRate: metrics.failureRate,
        latencyP99: metrics.p99LatencyMs,
        successRate: Math.max(0, 1 - metrics.failureRate),
        sampleCount: metrics.requestCount,
      },
    });
  }

  public rollback(
    candidate: ImprovementCandidate,
    current: RolloutRecord,
    metrics: RolloutMetrics,
    approvedBy?: string,
  ): RolloutRecord {
    const rollbackDecision = this.autoRollback.evaluate(current, metrics);
    return this.stateMachine.transition(candidate, "L0_off", {
      currentStatus: current.status,
      targetStatus: "rolled_back",
      approvedBy,
      strategyVersionId: current.strategyVersionId,
      guardrailReasonCodes: rollbackDecision.reasonCodes,
      triggeredBy: "auto_rollback",
      triggerReason: rollbackDecision.reasonCodes[0] ?? "rollout.auto_rollback",
      metrics: {
        errorRate: metrics.failureRate,
        latencyP99: metrics.p99LatencyMs,
        successRate: Math.max(0, 1 - metrics.failureRate),
        sampleCount: metrics.requestCount,
      },
    });
  }

  public evaluateMetricsGate(
    current: RolloutRecord,
    targetStatus: RolloutStatus,
    metrics?: RolloutMetrics,
  ): MetricsGateDecision {
    // R23-44 fix: Always evaluate rollback decision regardless of target status.
    // Rollback should be triggered for any status if metrics indicate problems.
    if (!metrics) {
      // If no metrics provided, allow promotion but don't trigger rollback
      if (PROGRESSIVE_STATUSES.has(targetStatus)) {
        return {
          allowed: false,
          rollback: false,
          reasonCodes: ["rollout.metrics_required"],
        };
      }
      return { allowed: true, rollback: false, reasonCodes: [] };
    }

    // R23-44 fix: Evaluate auto-rollback even for non-progressive statuses
    // This ensures rollback is triggered when metrics indicate problems during any rollout phase
    const rollbackDecision = this.autoRollback.evaluate(current, metrics);
    if (rollbackDecision.rollback) {
      return {
        allowed: false,
        rollback: true,
        reasonCodes: rollbackDecision.reasonCodes,
      };
    }

    // For progressive statuses, check if metrics are sufficient for promotion
    if (PROGRESSIVE_STATUSES.has(targetStatus)) {
      return {
        allowed: true,
        rollback: false,
        reasonCodes: ["rollout.metrics_gate_passed"],
      };
    }

    return { allowed: true, rollback: false, reasonCodes: [] };
  }
}

function inferLevelFromStatus(status: RolloutStatus): StrategyReleaseLevel {
  switch (status) {
    case "candidate_created":
    case "under_review":
    case "approved":
    case "rejected":
    case "rolled_back":
    case "paused":
      return "L0_off";
    case "evaluation_enabled":
      return "L1_evaluate";
    case "canary_5":
      return "L2_canary";
    case "partial_25":
      return "L3_partial";
    case "stable_75":
      return "L4_stable";
    case "stable_100":
    case "released":
      return "L5_full";
  }
}
