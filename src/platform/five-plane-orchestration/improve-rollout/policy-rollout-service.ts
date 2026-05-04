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
  "canary_20",
  "canary_50",
  "stable_100",
]);

export interface EvaluationGateInput {
  passed: boolean;
  score: number;
  issues: readonly string[];
  recommendation: string;
  confidence: number;
}

export interface RolloutGatingOptions {
  evaluationGate?: EvaluationGateInput;
  requireApproval?: boolean;
  canaryPercent?: number;
  rollbackOnFailure?: boolean;
}

export class PolicyRolloutService {
  private readonly stateMachine = new RolloutStateMachine();
  private readonly guardrails = new GuardrailEvaluator();
  private readonly autoRollback: AutoRollbackService;

  public constructor(autoRollback: AutoRollbackService = new AutoRollbackService()) {
    this.autoRollback = autoRollback;
  }

  public startWithGating(
    candidate: ImprovementCandidate,
    strategyVersion: StrategyVersion,
    approvedBy: string,
    options: RolloutGatingOptions,
  ): { record: RolloutRecord | null; approved: boolean } {
    if (options.evaluationGate && !options.evaluationGate.passed) {
      this.stateMachine.transition(candidate, "off", {
        approvedBy,
        strategyVersionId: strategyVersion.strategyVersionId,
        guardrailReasonCodes: [`evaluation_gate.failed:${options.evaluationGate.issues.join(",")}`],
      } as Parameters<typeof this.stateMachine.transition>[2]);
      return { record: null, approved: false };
    }

    if (options.requireApproval && candidate.status !== "approved") {
      const decision = this.decide(candidate, strategyVersion);
      if (!decision.allowed) {
        return { record: null, approved: false };
      }
    }

    const decision = this.decide(candidate, strategyVersion);
    if (!decision.allowed) {
      return { record: null, approved: false };
    }

    const record = this.stateMachine.transition(candidate, decision.releaseLevel, {
      approvedBy,
      strategyVersionId: strategyVersion.strategyVersionId,
      guardrailReasonCodes: decision.reasonCodes,
    });

    if (options.canaryPercent && record) {
      // Canary routing configuration is derived from the rollout record/state.
    }

    return { record, approved: true };
  }

  public decide(candidate: ImprovementCandidate, strategyVersion: StrategyVersion): RolloutDecision {
    if (rolloutFreezeManager.isFrozen()) {
      return {
        allowed: false,
        releaseLevel: "off",
        reasonCode: "rollout.frozen_error_budget",
        reasonCodes: ["rollout.frozen_error_budget: rollouts are frozen due to error budget exhaustion"],
      };
    }

    const guardrailDecision = this.guardrails.evaluate(candidate, strategyVersion);
    if (!guardrailDecision.allowed) {
      return {
        allowed: false,
        releaseLevel: "off",
        reasonCode: guardrailDecision.reasonCodes[0] ?? "improvement.guardrail_blocked",
        reasonCodes: guardrailDecision.reasonCodes,
      };
    }

    if (candidate.status !== "approved" && strategyVersion.releaseLevel === "evaluate_0") {
      return {
        allowed: false,
        releaseLevel: "off",
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
    targetStatus: Exclude<
      RolloutStatus,
      "candidate_created" | "under_review" | "draft" | "pending_approval" | "rejected" | "rolled_back" | "paused"
    >,
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
    if (!PROGRESSIVE_STATUSES.has(targetStatus)) {
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
    case "candidate_created":
    case "under_review":
    case "draft":
    case "pending_approval":
    case "rejected":
    case "rolled_back":
    case "paused":
      return "off";
    case "evaluation_enabled":
      return "evaluate_0";
    case "canary_5":
      return "canary_5";
    case "canary_20":
      return "canary_20";
    case "canary_50":
      return "canary_50";
    case "stable_100":
    case "released":
      return "stable_100";
  }
}
