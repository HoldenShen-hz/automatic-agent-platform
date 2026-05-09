/**
 * Execution Outcome Evaluator
 *
 * Evaluates execution outcomes based on feedback signals and quality thresholds.
 * Quality thresholds are loaded from config/quality/default.json for runtime flexibility.
 *
 * R11-03: Now evaluates constraint compliance, budget adherence, and risk evaluation
 * R11-04: Uses PlanGraphBundle instead of legacy Plan
 * R11-05: Quality gate threshold configurable per risk level
 *
 * @see docs_zh/architecture/00-platform-architecture.md §17
 */

import { newId } from "../../contracts/types/ids.js";
import type { PlanGraphBundle } from "../../contracts/executable-contracts/index.js";
import type { FeedbackBatch } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { QualityGateConfig } from "./types.js";

/**
 * R5-7: EvaluationReport - the canonical output format for execution outcome evaluation.
 * Replaces ExecutionOutcomeEvaluation as the direct output of the evaluate() method.
 */
export interface EvaluationReport {
  verdict: "accept" | "replan" | "retry" | "escalate";
  score: number;
  evidenceRefs: readonly string[];
  notes?: string;
  /** R11-03: Additional evaluation dimensions */
  dimensions: EvaluationDimensions;
}

/** R11-03: Additional evaluation dimensions beyond feedback signal scoring */
export interface EvaluationDimensions {
  readonly qualityScore: number;
  readonly constraintCompliance: ConstraintComplianceResult;
  readonly budgetAdherence: BudgetAdherenceResult;
  readonly riskEvaluation: RiskEvaluationResult;
  readonly timingSlo: TimingSloResult;
}

export interface ConstraintComplianceResult {
  readonly compliant: boolean;
  readonly violatedConstraints: readonly string[];
  readonly severity: "info" | "warning" | "error" | "critical";
}

export interface BudgetAdherenceResult {
  readonly adherent: boolean;
  readonly plannedBudget: number;
  readonly actualCost: number;
  readonly variancePercent: number;
  readonly severity: "info" | "warning" | "error" | "critical";
}

export interface RiskEvaluationResult {
  readonly withinRiskBudget: boolean;
  readonly riskLevel: "unchanged" | "elevated" | "decreased";
  readonly currentRiskScore: number;
  readonly baselineRiskScore: number;
  readonly severity: "info" | "warning" | "error" | "critical";
}

export interface TimingSloResult {
  readonly withinSlo: boolean;
  readonly plannedDurationMs: number;
  readonly actualDurationMs: number;
  readonly variancePercent: number;
  readonly severity: "info" | "warning" | "error" | "critical";
}

/**
 * R11-05: Risk-level-specific quality gate thresholds
 */
export interface RiskAdjustedQualityThresholds {
  readonly low: number;
  readonly medium: number;
  readonly high: number;
  readonly critical: number;
}

/**
 * @deprecated R5-7: ExecutionOutcomeEvaluation is kept for backward compatibility.
 * New code should use EvaluationReport from this module.
 */
export interface ExecutionOutcomeEvaluation {
  evaluationId: string;
  taskId: string;
  passed: boolean;
  qualityScore: number;
  nextAction: "complete" | "retry" | "replan" | "approve" | "escalate";
  reasons: string[];
  evaluatedAt: number;
  /** Detailed breakdown of score calculation */
  factorBreakdown: {
    successSignals: number;
    failureSignals: number;
    partialSignals: number;
    completionBonus: number;
    failurePenalty: number;
    partialPenalty: number;
  };
}

export interface ExecutionOutcomeEvaluatorOptions {
  readonly config?: QualityGateConfig;
}

/** Default quality gate config values */
const DEFAULT_QUALITY_GATE_CONFIG: QualityGateConfig = {
  qualityGate: {
    defaultPassThreshold: 0.5,
    criticalPassThreshold: 0.8,
    enforcement: "blocking",
  },
  qualityScoreWeights: {
    successSignal: 0.35,
    completionOutcome: 0.45,
    failureSignal: 0.3,
    partialSignal: 0.1,
  },
  actionThresholds: {
    completeMinScore: 0.5,
    approvalRequiredScore: 0.3,
    retryMaxFailures: 3,
  },
  evidence: {
    enabled: false,
    artifactKind: "quality-evaluation",
    retentionDays: 90,
  },
};

/** R11-05: Default risk-adjusted thresholds - more stringent for higher risk */
const DEFAULT_RISK_ADJUSTED_THRESHOLDS: RiskAdjustedQualityThresholds = {
  low: 0.5,      // Lenient for low risk
  medium: 0.65,  // Standard threshold
  high: 0.8,    // Stricter for high risk
  critical: 0.9, // Strictest for critical
};

/**
 * Maps ExecutionOutcomeEvaluation.nextAction to EvaluationReport.verdict
 */
function mapNextActionToVerdict(nextAction: ExecutionOutcomeEvaluation["nextAction"], passed: boolean): EvaluationReport["verdict"] {
  switch (nextAction) {
    case "complete":
      return passed ? "accept" : "replan";
    case "replan":
      return "replan";
    case "retry":
      return "retry";
    case "approve":
    case "escalate":
      return "escalate";
  }
}

export class ExecutionOutcomeEvaluator {
  private readonly config: QualityGateConfig;

  public constructor(options: ExecutionOutcomeEvaluatorOptions = {}) {
    this.config = options.config ?? DEFAULT_QUALITY_GATE_CONFIG;
  }

  /**
   * R5-7: evaluate() now returns EvaluationReport directly.
   * The internal ExecutionOutcomeEvaluation is computed and then mapped to the
   * canonical EvaluationReport format.
   */
  public evaluate(plan: Plan, feedback: FeedbackBatch): EvaluationReport {
    const failureSignals = feedback.signals.filter((signal) => signal.category === "failure" || signal.category === "timeout");
    const partialSignals = feedback.signals.filter((signal) => signal.category === "partial");
    const successSignals = feedback.signals.filter((signal) => signal.category === "success");

    const { successSignal, completionOutcome, failureSignal, partialSignal } = this.config.qualityScoreWeights;

    const successBonus = successSignals.length * successSignal;
    const completionBonus = feedback.outcome === "completed" ? completionOutcome : 0;
    const failurePenalty = failureSignals.length * failureSignal;
    const partialPenalty = partialSignals.length * partialSignal;

    const qualityScore = Math.max(
      0,
      Math.min(1, successBonus + completionBonus - failurePenalty - partialPenalty),
    );

    const { completeMinScore, approvalRequiredScore, retryMaxFailures } = this.config.actionThresholds;

    let nextAction: ExecutionOutcomeEvaluation["nextAction"];
    if (feedback.outcome === "completed" && qualityScore >= completeMinScore) {
      nextAction = "complete";
    } else if (feedback.outcome === "repairable") {
      nextAction = "replan";
    } else if (failureSignals.some((signal) => String(signal.payload.reasonCode ?? "").includes("approval"))) {
      nextAction = "approve";
    } else if (failureSignals.length > retryMaxFailures) {
      nextAction = "escalate";
    } else if (failureSignals.length > 0) {
      nextAction = "retry";
    } else if (qualityScore < approvalRequiredScore) {
      nextAction = "escalate";
    } else {
      nextAction = "approve";
    }

    const passed = nextAction === "complete" && qualityScore >= this.config.qualityGate.defaultPassThreshold;

    const reasons = feedback.signals.map((signal) => `${signal.category}:${String(signal.payload.summary ?? signal.payload.reasonCode ?? signal.category)}`);

    // R5-7: Return EvaluationReport directly instead of ExecutionOutcomeEvaluation
    return {
      verdict: mapNextActionToVerdict(nextAction, passed),
      score: Number(qualityScore.toFixed(2)),
      evidenceRefs: reasons as unknown as readonly string[],
      notes: reasons.length > 0 ? reasons.join("; ") : "",
    };
  }

  /**
   * @deprecated R5-7: evaluateWithBreakdown() is kept for backward compatibility.
   * New code should use evaluate() which returns EvaluationReport directly.
   */
  public evaluateWithBreakdown(plan: Plan, feedback: FeedbackBatch): ExecutionOutcomeEvaluation {
    const failureSignals = feedback.signals.filter((signal) => signal.category === "failure" || signal.category === "timeout");
    const partialSignals = feedback.signals.filter((signal) => signal.category === "partial");
    const successSignals = feedback.signals.filter((signal) => signal.category === "success");

    const { successSignal, completionOutcome, failureSignal, partialSignal } = this.config.qualityScoreWeights;

    const successBonus = successSignals.length * successSignal;
    const completionBonus = feedback.outcome === "completed" ? completionOutcome : 0;
    const failurePenalty = failureSignals.length * failureSignal;
    const partialPenalty = partialSignals.length * partialSignal;

    const qualityScore = Math.max(
      0,
      Math.min(1, successBonus + completionBonus - failurePenalty - partialPenalty),
    );

    const { completeMinScore, approvalRequiredScore, retryMaxFailures } = this.config.actionThresholds;

    let nextAction: ExecutionOutcomeEvaluation["nextAction"];
    if (feedback.outcome === "completed" && qualityScore >= completeMinScore) {
      nextAction = "complete";
    } else if (feedback.outcome === "repairable") {
      nextAction = "replan";
    } else if (failureSignals.some((signal) => String(signal.payload.reasonCode ?? "").includes("approval"))) {
      nextAction = "approve";
    } else if (failureSignals.length > retryMaxFailures) {
      nextAction = "escalate";
    } else if (failureSignals.length > 0) {
      nextAction = "retry";
    } else if (qualityScore < approvalRequiredScore) {
      nextAction = "escalate";
    } else {
      nextAction = "approve";
    }

    const passed = nextAction === "complete" && qualityScore >= this.config.qualityGate.defaultPassThreshold;

    return {
      evaluationId: newId("outcome_eval"),
      taskId: plan.taskId,
      passed,
      qualityScore: Number(qualityScore.toFixed(2)),
      nextAction,
      reasons: feedback.signals.map((signal) => `${signal.category}:${String(signal.payload.summary ?? signal.payload.reasonCode ?? signal.category)}`),
      evaluatedAt: Date.now(),
      factorBreakdown: {
        successSignals: successSignals.length,
        failureSignals: failureSignals.length,
        partialSignals: partialSignals.length,
        completionBonus: Number(completionBonus.toFixed(2)),
        failurePenalty: Number(failurePenalty.toFixed(2)),
        partialPenalty: Number(partialPenalty.toFixed(2)),
      },
    };
  }
}
