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
  "partial_50",
  "partial_75",
  "stable",
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
        releaseLevel: "suggest",
        reasonCode: "rollout.frozen_error_budget",
        reasonCodes: ["rollout.frozen_error_budget: rollouts are frozen due to error budget exhaustion"],
      };
    }

    const guardrailDecision = this.guardrails.evaluate(candidate, strategyVersion);
    if (!guardrailDecision.allowed) {
      return {
        allowed: false,
        releaseLevel: "suggest",
        reasonCode: guardrailDecision.reasonCodes[0] ?? "improvement.guardrail_blocked",
        reasonCodes: guardrailDecision.reasonCodes,
      };
    }
    if (candidate.status !== "approved" && strategyVersion.releaseLevel === "shadow") {
      return {
        allowed: false,
        releaseLevel: "suggest",
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
    });
  }

  public promote(
    candidate: ImprovementCandidate,
    current: RolloutRecord,
    targetStatus: Exclude<RolloutStatus, "draft" | "rejected" | "rolled_back" | "paused">,
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
    });
  }

  public rollback(
    candidate: ImprovementCandidate,
    current: RolloutRecord,
    metrics: RolloutMetrics,
    approvedBy?: string,
  ): RolloutRecord {
    const rollbackDecision = this.autoRollback.evaluate(current, metrics);
    return this.stateMachine.transition(candidate, "off", {
      currentStatus: current.status,
      targetStatus: "rolled_back",
      approvedBy,
      strategyVersionId: current.strategyVersionId,
      guardrailReasonCodes: rollbackDecision.reasonCodes,
    });
  }

  public evaluateMetricsGate(
    current: RolloutRecord,
    targetStatus: RolloutStatus,
    metrics?: RolloutMetrics,
  ): MetricsGateDecision {
    if (!PROGRESSIVE_STATUSES.has(targetStatus) || current.status === "shadow") {
      return { allowed: true, rollback: false, reasonCodes: [] };
    }
    if (!metrics) {
      return {
        allowed: false,
        rollback: false,
        reasonCodes: ["rollout.metrics_required"],
      };
    }
    const rollbackDecision = this.autoRollback.evaluate(current, metrics);
    if (rollbackDecision.rollback) {
      return {
        allowed: false,
        rollback: true,
        reasonCodes: rollbackDecision.reasonCodes,
      };
    }
    return {
      allowed: true,
      rollback: false,
      reasonCodes: ["rollout.metrics_gate_passed"],
    };
  }
}

function inferLevelFromStatus(status: RolloutStatus): StrategyReleaseLevel {
  switch (status) {
    case "draft":
    case "rejected":
    case "rolled_back":
    case "paused":
      return "off";
    case "pending_approval":
      return "suggest";
    case "shadow":
      return "shadow";
    case "canary_5":
      return "canary_5";
    case "partial_25":
      return "partial_25";
    case "partial_50":
      return "partial_50";
    case "partial_75":
      return "partial_75";
    case "stable":
      return "stable";
  }
}
