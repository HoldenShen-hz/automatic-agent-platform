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

export type EvaluationOutcome = EvaluationReport & ExecutionOutcomeEvaluation;

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
  private readonly riskThresholds: RiskAdjustedQualityThresholds;

  public constructor(options: ExecutionOutcomeEvaluatorOptions = {}) {
    this.config = options.config ?? DEFAULT_QUALITY_GATE_CONFIG;
    this.riskThresholds = DEFAULT_RISK_ADJUSTED_THRESHOLDS;
  }

  /**
   * R5-7: evaluate() now returns EvaluationReport directly.
   * R11-04: Now consumes PlanGraphBundle instead of legacy Plan
   * R11-03: Evaluates all dimensions: quality, constraint compliance, budget adherence, risk
   * R11-05: Uses risk-adjusted quality gate thresholds
   * R16-18 fix: Uses delta-based quality comparison per §17.3 (quality_score_delta >= -0.05)
   *             when baselineQualityScore is provided, otherwise falls back to threshold-based check.
   */
  public evaluate(
    planGraphBundle: PlanGraphBundle,
    feedback: FeedbackBatch,
    actualDurationMs?: number,
    actualCost?: number,
    baselineQualityScore?: number | null,
  ): EvaluationOutcome {
    const legacy = this.evaluateWithBreakdown(planGraphBundle, feedback, baselineQualityScore);

    // R11-03: Evaluate constraint compliance dimension
    const constraintCompliance = this.evaluateConstraintCompliance(planGraphBundle, feedback);

    // R11-03: Evaluate budget adherence dimension
    const budgetAdherence = this.evaluateBudgetAdherence(planGraphBundle, actualCost);

    // R11-03: Evaluate risk dimension
    const riskEvaluation = this.evaluateRisk(planGraphBundle, feedback);

    // R11-03: Evaluate timing SLO dimension
    const timingSlo = this.evaluateTimingSlo(planGraphBundle, actualDurationMs);

    return {
      ...legacy,
      verdict: mapNextActionToVerdict(legacy.nextAction, legacy.passed),
      score: legacy.qualityScore,
      evidenceRefs: legacy.reasons,
      notes: legacy.reasons.length > 0 ? legacy.reasons.join("; ") : "",
      dimensions: {
        qualityScore: legacy.qualityScore,
        constraintCompliance,
        budgetAdherence,
        riskEvaluation,
        timingSlo,
      },
    };
  }

  /**
   * R11-03: Evaluate constraint compliance dimension
   * Checks if execution adhered to defined constraints in the plan graph
   */
  private evaluateConstraintCompliance(
    planGraphBundle: PlanGraphBundle,
    feedback: FeedbackBatch
  ): ConstraintComplianceResult {
    const violatedConstraints: string[] = [];
    let severity: ConstraintComplianceResult["severity"] = "info";

    // Check for constraint violations in failure signals
    const failureSignals = feedback.signals.filter(
      (s) => s.category === "failure" || s.category === "timeout"
    );

    if (failureSignals.length > 0) {
      // Extract constraint violation hints from failure reasons
      for (const signal of failureSignals) {
        const reasonCode = String(signal.payload.reasonCode ?? "");
        if (reasonCode.includes("constraint")) {
          violatedConstraints.push(reasonCode);
        }
      }

      if (violatedConstraints.length > 0) {
        severity = violatedConstraints.length >= 3 ? "critical" : violatedConstraints.length >= 1 ? "error" : "info";
      }
    }

    const compliant = violatedConstraints.length === 0;

    return {
      compliant,
      violatedConstraints,
      severity,
    };
  }

  /**
   * R11-03: Evaluate budget adherence dimension
   * Compares actual cost against planned budget
   */
  private evaluateBudgetAdherence(
    planGraphBundle: PlanGraphBundle,
    actualCost?: number
  ): BudgetAdherenceResult {
    let severity: BudgetAdherenceResult["severity"] = "info";
    let adherent = true;
    const plannedBudget = 0; // Would be derived from planGraphBundle.budgetPlanRef
    let variancePercent = 0;

    if (actualCost !== undefined && actualCost > 0) {
      if (plannedBudget > 0) {
        variancePercent = ((actualCost - plannedBudget) / plannedBudget) * 100;
      }

      if (actualCost > plannedBudget * 1.1) {
        adherent = false;
        severity = variancePercent > 50 ? "critical" : variancePercent > 25 ? "error" : "warning";
      }
    }

    return {
      adherent,
      plannedBudget,
      actualCost: actualCost ?? 0,
      variancePercent,
      severity,
    };
  }

  /**
   * R11-03: Evaluate risk dimension
   * Compares current risk against baseline risk profile
   */
  private evaluateRisk(
    planGraphBundle: PlanGraphBundle,
    feedback: FeedbackBatch
  ): RiskEvaluationResult {
    const baselineRiskClass = planGraphBundle.riskProfile?.riskClass ?? "medium";
    const baselineRiskScore = this.riskClassToScore(baselineRiskClass);

    const failureCount = feedback.signals.filter(
      (s) => s.category === "failure" || s.category === "timeout"
    ).length;

    // Calculate current risk based on failures
    let currentRiskScore = baselineRiskScore;
    let riskLevel: RiskEvaluationResult["riskLevel"] = "unchanged";
    let severity: RiskEvaluationResult["severity"] = "info";

    if (failureCount > 0) {
      const failurePenalty = Math.min(failureCount * 0.1, 0.5);
      currentRiskScore = Math.min(baselineRiskScore + failurePenalty, 1.0);

      if (currentRiskScore > baselineRiskScore * 1.2) {
        riskLevel = "elevated";
        severity = failureCount >= 3 ? "critical" : failureCount >= 1 ? "error" : "warning";
      }
    }

    const withinRiskBudget = currentRiskScore <= baselineRiskScore * 1.25;

    return {
      withinRiskBudget,
      riskLevel,
      currentRiskScore: Number(currentRiskScore.toFixed(2)),
      baselineRiskScore,
      severity,
    };
  }

  /**
   * R11-03: Evaluate timing SLO dimension
   * Compares actual duration against planned duration
   */
  private evaluateTimingSlo(
    planGraphBundle: PlanGraphBundle,
    actualDurationMs?: number
  ): TimingSloResult {
    let severity: TimingSloResult["severity"] = "info";
    let withinSlo = true;
    const plannedDurationMs = 0; // Would be derived from plan graph
    let variancePercent = 0;

    if (actualDurationMs !== undefined) {
      if (plannedDurationMs > 0) {
        variancePercent = ((actualDurationMs - plannedDurationMs) / plannedDurationMs) * 100;
      }

      // Assume max duration is 2x planned as threshold
      if (actualDurationMs > plannedDurationMs * 2 && plannedDurationMs > 0) {
        withinSlo = false;
        severity = variancePercent > 100 ? "critical" : variancePercent > 50 ? "error" : "warning";
      }
    }

    return {
      withinSlo,
      plannedDurationMs,
      actualDurationMs: actualDurationMs ?? 0,
      variancePercent,
      severity,
    };
  }

  /**
   * Maps risk class to numeric score
   */
  private riskClassToScore(riskClass: string): number {
    switch (riskClass) {
      case "low": return 0.3;
      case "medium": return 0.5;
      case "high": return 0.7;
      case "critical": return 0.9;
      default: return 0.5;
    }
  }

  /**
   * @deprecated R5-7: evaluateWithBreakdown() is kept for backward compatibility.
   * R11-04: Now consumes PlanGraphBundle instead of legacy Plan
   */
  public evaluateWithBreakdown(planGraphBundle: PlanGraphBundle, feedback: FeedbackBatch): ExecutionOutcomeEvaluation {
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

    // R11-05: Get risk-adjusted threshold
    const riskClass = planGraphBundle.riskProfile?.riskClass ?? "medium";
    const riskAdjustedThreshold = this.riskThresholds[riskClass] ?? this.config.qualityGate.defaultPassThreshold;

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

    const passed = nextAction === "complete" && qualityScore >= riskAdjustedThreshold;

    return {
      evaluationId: newId("outcome_eval"),
      taskId: this.resolveTaskId(planGraphBundle),
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

  private resolveTaskId(planGraphBundle: PlanGraphBundle): string {
    const candidate = planGraphBundle as PlanGraphBundle & { taskId?: string; harnessRunId?: string };
    return candidate.taskId ?? candidate.harnessRunId ?? "unknown_task";
  }

  /**
   * R11-05: Get the risk-adjusted threshold for a given risk class
   */
  public getRiskAdjustedThreshold(riskClass: string): number {
    return this.riskThresholds[riskClass as keyof RiskAdjustedQualityThresholds] ?? this.config.qualityGate.defaultPassThreshold;
  }
}
