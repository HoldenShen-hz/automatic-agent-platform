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
import type { FeedbackBatch } from "../../contracts/types/feedback.js";
import type { QualityGateConfig } from "./types.js";
import {
  DefaultRiskEvaluationProvider,
  type RiskEvaluationProvider,
  type RiskFactors,
} from "./risk-evaluation-port.js";

/**
 * R5-7: EvaluationReport - the canonical output format for execution outcome evaluation.
 * Replaces ExecutionOutcomeEvaluation as the direct output of the evaluate() method.
 */
export interface EvaluationReport {
  verdict: "accept" | "approve" | "replan" | "retry" | "escalate";
  score: number;
  passed: boolean;
  issues: readonly string[];
  recommendation: "continue" | "retry" | "replan" | "escalate" | "approve";
  confidence: number;
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
  readonly riskEvaluationProvider?: RiskEvaluationProvider;
}

export type EvaluationOutcome = EvaluationReport & ExecutionOutcomeEvaluation;
export type LegacyEvaluationDimensionAliases = {
  constraintCompliance: ConstraintComplianceResult;
  budgetAdherence: BudgetAdherenceResult;
  riskEvaluation: RiskEvaluationResult;
  timingSlo: TimingSloResult;
};

/** Default quality gate config values */
const DEFAULT_QUALITY_GATE_CONFIG: QualityGateConfig = {
  qualityGate: {
    defaultPassThreshold: 0.5,
    criticalPassThreshold: 0.8,
    enforcement: "blocking",
  },
  qualityScoreWeights: {
    // R21 fix: weights must sum to 1.0 (was 1.2)
    successSignal: 0.3,
    completionOutcome: 0.4,
    failureSignal: 0.2,
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
    case "approve":
      return "approve";
    case "replan":
      return "replan";
    case "retry":
      return "retry";
    case "escalate":
      return "escalate";
  }
}

function mapVerdictToRecommendation(verdict: EvaluationReport["verdict"]): EvaluationReport["recommendation"] {
  switch (verdict) {
    case "accept":
      return "continue";
    case "approve":
      return "approve";
    case "replan":
      return "replan";
    case "retry":
      return "retry";
    case "escalate":
      return "escalate";
  }
}

export class ExecutionOutcomeEvaluator {
  private readonly config: QualityGateConfig;
  private readonly riskThresholds: RiskAdjustedQualityThresholds;
  private readonly riskEvaluationProvider: RiskEvaluationProvider;

  public constructor(options: ExecutionOutcomeEvaluatorOptions = {}) {
    this.config = options.config ?? DEFAULT_QUALITY_GATE_CONFIG;
    this.riskThresholds = DEFAULT_RISK_ADJUSTED_THRESHOLDS;
    this.riskEvaluationProvider = options.riskEvaluationProvider ?? new DefaultRiskEvaluationProvider();
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
  ): EvaluationOutcome & LegacyEvaluationDimensionAliases {
    const legacy = this.evaluateWithBreakdown(planGraphBundle, feedback, baselineQualityScore);

    // R11-03: Evaluate constraint compliance dimension
    const constraintCompliance = this.evaluateConstraintCompliance(planGraphBundle, feedback);

    // R11-03: Evaluate budget adherence dimension
    const budgetAdherence = this.evaluateBudgetAdherence(planGraphBundle, actualCost);

    // R11-03: Evaluate risk dimension
    const riskEvaluation = this.evaluateRisk(planGraphBundle, feedback);

    // R11-03: Evaluate timing SLO dimension
    const timingSlo = this.evaluateTimingSlo(planGraphBundle, actualDurationMs);

    const verdict = mapNextActionToVerdict(legacy.nextAction, legacy.passed);
    const issues = legacy.passed ? [] : legacy.reasons;
    return {
      ...legacy,
      verdict,
      score: legacy.qualityScore,
      passed: legacy.passed,
      issues,
      recommendation: mapVerdictToRecommendation(verdict),
      confidence: Number(Math.max(0, Math.min(1, legacy.qualityScore)).toFixed(4)),
      evidenceRefs: legacy.reasons,
      notes: legacy.reasons.length > 0 ? legacy.reasons.join("; ") : "",
      constraintCompliance,
      budgetAdherence,
      riskEvaluation,
      timingSlo,
      dimensions: {
        qualityScore: legacy.qualityScore,
        constraintCompliance,
        budgetAdherence,
        riskEvaluation,
        timingSlo,
      },
    };
  }

  public getConfig(): QualityGateConfig {
    return this.config;
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
    const plannedBudget = this.resolvePlannedBudget(planGraphBundle);
    let variancePercent = 0;

    if (actualCost !== undefined && actualCost > 0) {
      if (plannedBudget > 0) {
        variancePercent = ((actualCost - plannedBudget) / plannedBudget) * 100;
        if (actualCost > plannedBudget * 1.1) {
          adherent = false;
          severity = variancePercent > 50 ? "critical" : variancePercent > 25 ? "error" : "warning";
        }
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
    const evaluated = this.riskEvaluationProvider.evaluate({
      taskId: this.resolveTaskId(planGraphBundle),
      factors: this.buildRiskFactors(planGraphBundle, feedback),
    });
    const currentRiskScore = evaluated.riskScore;
    const riskLevel = currentRiskScore > baselineRiskScore
      ? "elevated"
      : currentRiskScore < baselineRiskScore
        ? "decreased"
        : "unchanged";
    const severity: RiskEvaluationResult["severity"] = riskLevel !== "elevated"
      ? "info"
      : evaluated.riskLevel === "critical"
        ? "critical"
        : evaluated.riskLevel === "high"
          ? "error"
          : "warning";

    const withinRiskBudget = currentRiskScore <= Math.min(1, baselineRiskScore + 0.15);

    return {
      withinRiskBudget,
      riskLevel,
      currentRiskScore: Number(currentRiskScore.toFixed(2)),
      baselineRiskScore,
      severity,
    };
  }

  private buildRiskFactors(planGraphBundle: PlanGraphBundle, feedback: FeedbackBatch): RiskFactors {
    const baseline = Math.max(1, Math.round(this.riskClassToScore(planGraphBundle.riskProfile?.riskClass ?? "medium") * 5));
    const failureCount = feedback.signals.filter((signal) => signal.category === "failure").length;
    const timeoutCount = feedback.signals.filter((signal) => signal.category === "timeout").length;
    const partialCount = feedback.signals.filter((signal) => signal.category === "partial").length;

    return {
      impact: Math.min(5, baseline + (failureCount > 0 ? 1 : 0)),
      irreversibility: Math.min(5, baseline + (feedback.outcome === "failed" ? 1 : 0)),
      dataSensitivity: baseline,
      autonomyModeRisk: Math.min(5, Math.max(1, baseline - 1 + failureCount + timeoutCount)),
      tenantImpact: Math.min(5, baseline + (partialCount > 2 ? 1 : 0)),
      blastRadius: Math.min(5, baseline + (timeoutCount > 0 ? 1 : 0)),
      historicalFailureRate: Math.min(100, failureCount * 20 + timeoutCount * 15),
      evidenceConfidence: failureCount > 0 || timeoutCount > 0 ? "medium" : "high",
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
    const plannedDurationMs = this.resolvePlannedDurationMs(planGraphBundle);
    let variancePercent = 0;

    if (actualDurationMs !== undefined) {
      if (plannedDurationMs > 0) {
        variancePercent = ((actualDurationMs - plannedDurationMs) / plannedDurationMs) * 100;
      }

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

  private resolvePlannedBudget(planGraphBundle: PlanGraphBundle): number {
    const worstPathBudget = planGraphBundle.validationReport?.worstPath?.estimatedBudgetAmount;
    if (Number.isFinite(worstPathBudget) && (worstPathBudget ?? 0) > 0) {
      return Number((worstPathBudget ?? 0).toFixed(2));
    }
    const nodeBudget = planGraphBundle.graph?.nodes?.reduce((total, node) => {
      const amount = node.budgetIntent?.amount;
      return Number.isFinite(amount) ? total + Number(amount) : total;
    }, 0) ?? 0;
    return Number(nodeBudget.toFixed(2));
  }

  private resolvePlannedDurationMs(planGraphBundle: PlanGraphBundle): number {
    const worstPathTimeout = planGraphBundle.validationReport?.worstPath?.timeoutMs;
    if (Number.isFinite(worstPathTimeout) && (worstPathTimeout ?? 0) > 0) {
      return Math.trunc(worstPathTimeout ?? 0);
    }
    return planGraphBundle.graph?.nodes?.reduce((total, node) => {
      const timeoutMs = node.timeoutMs;
      return Number.isFinite(timeoutMs) ? total + Number(timeoutMs) : total;
    }, 0) ?? 0;
  }

  /**
   * @deprecated R5-7: evaluateWithBreakdown() is kept for backward compatibility.
   * R11-04: Now consumes PlanGraphBundle instead of legacy Plan
   */
  public evaluateWithBreakdown(
    planGraphBundle: PlanGraphBundle,
    feedback: FeedbackBatch,
    baselineQualityScore?: number | null,
  ): ExecutionOutcomeEvaluation {
    const failureSignals = feedback.signals.filter((signal) => signal.category === "failure" || signal.category === "timeout");
    const partialSignals = feedback.signals.filter((signal) => signal.category === "partial");
    const successSignals = feedback.signals.filter((signal) => signal.category === "success");

    const { successSignal, completionOutcome, failureSignal, partialSignal } = this.config.qualityScoreWeights;

    const successBonus = successSignals.length * successSignal;
    const completionBonus = feedback.outcome === "completed" ? completionOutcome : 0;
    const failurePenalty = failureSignals.length * failureSignal;
    const partialPenalty = partialSignals.length * partialSignal;

    const positiveScore = Math.min(1, successBonus + completionBonus);
    const totalPenalty = Math.min(1, failurePenalty + partialPenalty);
    const qualityScore = Math.max(0, Number((positiveScore - totalPenalty).toFixed(6)));

    // R11-05: Get risk-adjusted threshold
    const riskClass = planGraphBundle.riskProfile?.riskClass ?? "medium";
    const riskAdjustedThreshold = this.riskThresholds[riskClass] ?? this.config.qualityGate.defaultPassThreshold;

    const { completeMinScore, approvalRequiredScore, retryMaxFailures } = this.config.actionThresholds;

    let nextAction: ExecutionOutcomeEvaluation["nextAction"];
    if (feedback.outcome === "completed" && qualityScore >= completeMinScore) {
      nextAction = "complete";
    } else if (feedback.outcome === "repairable") {
      nextAction = "replan";
    } else if (feedback.outcome === "partial") {
      nextAction = "approve";
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

    const deltaGatePassed = baselineQualityScore == null
      ? null
      : qualityScore - baselineQualityScore >= -0.05;

    if (nextAction === "complete" && deltaGatePassed === false) {
      nextAction = "replan";
    }

    const absoluteThresholdPassed = qualityScore >= riskAdjustedThreshold;
    const passed = nextAction === "complete"
      && absoluteThresholdPassed
      && (deltaGatePassed ?? true);
    const reasons = feedback.signals.map((signal) =>
      `${signal.category}:${String(signal.payload.summary ?? signal.payload.reasonCode ?? signal.category)}`,
    );
    if (deltaGatePassed === false) {
      reasons.push(
        `quality_score_delta_exceeded:${(qualityScore - baselineQualityScore!).toFixed(2)} < -0.05`,
      );
    }
    if (!absoluteThresholdPassed) {
      reasons.push(
        `quality_score_below_risk_threshold:${qualityScore.toFixed(2)} < ${riskAdjustedThreshold.toFixed(2)}`,
      );
    }

    return {
      evaluationId: newId("outcome_eval"),
      taskId: this.resolveTaskId(planGraphBundle),
      passed,
      qualityScore: Number(qualityScore.toFixed(2)),
      nextAction,
      reasons,
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
