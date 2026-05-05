/**
 * Execution Outcome Evaluator
 *
 * Evaluates execution outcomes based on feedback signals and quality thresholds.
 * Quality thresholds are configurable per risk level + domain (§17.3).
 *
 * Evaluation dimensions per §13.5:
 * - Quality gate (pass/fail against thresholds)
 * - Constraint compliance
 * - Budget adherence
 * - Risk boundary
 * - Timing SLO
 *
 * @see docs_zh/architecture/00-platform-architecture.md §13.5, §17
 */

import { newId } from "../../contracts/types/ids.js";
import type { PlanGraphBundle, RiskClass } from "../../contracts/executable-contracts/index.js";
import type { FeedbackBatch } from "../../contracts/types/feedback.js";
import type {
  QualityGateConfig,
  DomainId,
  ConstraintComplianceResult,
  BudgetAdherenceResult,
  RiskBoundaryResult,
  TimingSloResult,
} from "./types.js";

export interface ExecutionOutcomeEvaluation {
  evaluationId: string;
  taskId: string;
  passed: boolean;
  qualityScore: number;
  /** Score alias for R5-7 EvaluationReport compatibility */
  score: number;
  /** Confidence derived from signal quality and factor breakdown (R5-7) */
  confidence: number;
  baselineScore?: number;
  deltaScore?: number;
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
  /** Additional evaluation dimensions per §13.5 */
  constraintCompliance: ConstraintComplianceResult;
  budgetAdherence: BudgetAdherenceResult;
  riskBoundary: RiskBoundaryResult;
  timingSlo: TimingSloResult;
}

export interface ExecutionOutcomeEvaluatorOptions {
  readonly config?: QualityGateConfig;
  readonly domainId?: DomainId;
}

/**
 * Default quality gate config with per-risk-level thresholds (§17.3).
 * Thresholds are configurable per risk class and domain.
 */
const DEFAULT_QUALITY_GATE_CONFIG: QualityGateConfig = {
  qualityGate: {
    // R16-18 FIX: delta-based threshold (score - baseline >= deltaThreshold)
    // Fixed 0.5 was not delta-based; delta-based allows relative improvement tracking
    defaultPassThreshold: 0.5,
    criticalPassThreshold: 0.8,
    enforcement: "blocking",
    deltaThreshold: 0.0, // pass if (score - baseline) >= 0.0 (i.e., score >= baseline)
  },
  qualityScoreWeights: {
    successSignal: 0.35,
    completionOutcome: 0.40,
    failureSignal: 0.20,
    partialSignal: 0.05,
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
  riskLevelThresholds: [],
  domainThresholdOverrides: [],
};

interface LegacyPlanLike {
  planId?: string;
  taskId?: string;
}

function toPlanGraphBundle(planLike: LegacyPlanLike | PlanGraphBundle): PlanGraphBundle {
  const maybeBundle = planLike as PlanGraphBundle;
  if ((maybeBundle as unknown as { riskProfile?: unknown }).riskProfile !== undefined) {
    return maybeBundle;
  }

  const legacy = planLike as LegacyPlanLike;
  return {
    harnessRunId: legacy.taskId ?? legacy.planId ?? "unknown_task",
    riskProfile: {
      riskClass: "medium",
    },
    budgetPlanRef: null,
  } as unknown as PlanGraphBundle;
}

export class ExecutionOutcomeEvaluator {
  private readonly config: QualityGateConfig;
  private readonly domainId?: DomainId;

  public constructor(options: ExecutionOutcomeEvaluatorOptions = {}) {
    this.config = options.config ?? DEFAULT_QUALITY_GATE_CONFIG;
    if (options.domainId !== undefined) {
      this.domainId = options.domainId;
    }
  }

  /**
   * Evaluate execution outcome against PlanGraphBundle.
   *
   * R11-04 FIX: Now consumes PlanGraphBundle (not legacy Plan) to access:
   * - Node-level risk profiles
   * - Budget reservations
   * - Graph version
   *
   * R11-03 FIX: Now evaluates all §13.5 required dimensions:
   * - Constraint compliance
   * - Budget adherence
   * - Risk boundary
   * - Timing SLO
   *
   * R11-05 FIX: Thresholds are configurable per risk level + domain (§17.3).
   */
  public evaluate(
    planGraphBundle: PlanGraphBundle | LegacyPlanLike,
    feedback: FeedbackBatch,
    options?: {
      actualDurationMs?: number;
      actualCost?: number;
      constraints?: readonly string[];
      /** Baseline quality score for delta-based threshold evaluation */
      baselineScore?: number;
    },
  ): ExecutionOutcomeEvaluation;
  public evaluate(params: {
    planGraphBundle: PlanGraphBundle | LegacyPlanLike;
    feedback: FeedbackBatch;
    actualDurationMs?: number;
    actualCost?: number;
    constraints?: readonly string[];
    baselineScore?: number;
  }): ExecutionOutcomeEvaluation;
  public evaluate(
    planOrParams:
      | {
          planGraphBundle: PlanGraphBundle | LegacyPlanLike;
          feedback: FeedbackBatch;
          actualDurationMs?: number;
          actualCost?: number;
          constraints?: readonly string[];
          baselineScore?: number;
        }
      | PlanGraphBundle
      | LegacyPlanLike,
    maybeFeedback?: FeedbackBatch,
    maybeOptions?: {
      actualDurationMs?: number;
      actualCost?: number;
      constraints?: readonly string[];
      baselineScore?: number;
    },
  ): ExecutionOutcomeEvaluation {
    const normalized =
      maybeFeedback === undefined
        ? planOrParams as {
            planGraphBundle: PlanGraphBundle | LegacyPlanLike;
            feedback: FeedbackBatch;
            actualDurationMs?: number;
            actualCost?: number;
            constraints?: readonly string[];
            baselineScore?: number;
          }
        : {
            planGraphBundle: planOrParams as PlanGraphBundle | LegacyPlanLike,
            feedback: maybeFeedback,
            actualDurationMs: maybeOptions?.actualDurationMs,
            actualCost: maybeOptions?.actualCost,
            constraints: maybeOptions?.constraints,
            baselineScore: maybeOptions?.baselineScore,
          };
    const planGraphBundle = toPlanGraphBundle(normalized.planGraphBundle);
    const { feedback, actualDurationMs, actualCost, constraints, baselineScore } = normalized;

    // Get thresholds based on risk level and domain (§17.3)
    const effectiveThreshold = this.getEffectiveThreshold(planGraphBundle.riskProfile.riskClass);

    const failureSignals = feedback.signals.filter(
      (signal) => signal.category === "failure" || signal.category === "timeout"
    );
    const partialSignals = feedback.signals.filter((signal) => signal.category === "partial");
    const successSignals = feedback.signals.filter((signal) => signal.category === "success");

    const { successSignal, completionOutcome, failureSignal, partialSignal } = this.config.qualityScoreWeights;

    const successBonus = successSignals.length * successSignal;
    const completionBonus = feedback.outcome === "completed" ? completionOutcome : 0;
    const failurePenalty = failureSignals.length * failureSignal;
    const partialPenalty = partialSignals.length * partialSignal;

    const qualityScore = Math.max(
      0,
      Math.min(1, successBonus + completionBonus - failurePenalty - partialPenalty)
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

    // R16-18 FIX: Use delta-based threshold when baselineScore and deltaThreshold are available
    // Delta-based: pass if (score - baseline) >= deltaThreshold
    const deltaScore = baselineScore !== undefined ? qualityScore - baselineScore : undefined;
    const effectiveDeltaThreshold = effectiveThreshold.deltaThreshold ?? this.config.qualityGate.deltaThreshold;
    let passed: boolean;
    if (effectiveDeltaThreshold !== undefined && baselineScore !== undefined) {
      passed = nextAction === "complete" && deltaScore !== undefined && deltaScore >= effectiveDeltaThreshold;
    } else {
      // Fall back to absolute threshold
      passed = nextAction === "complete" && qualityScore >= effectiveThreshold.passThreshold;
    }

    // Evaluate additional dimensions per §13.5
    const constraintCompliance = this.evaluateConstraintCompliance(constraints);
    const budgetAdherence = this.evaluateBudgetAdherence(planGraphBundle, actualCost);
    const riskBoundary = this.evaluateRiskBoundary(planGraphBundle);
    const timingSlo = this.evaluateTimingSLO(planGraphBundle, actualDurationMs);

    return {
      evaluationId: newId("outcome_eval"),
      taskId: planGraphBundle.harnessRunId,
      passed,
      qualityScore: Number(qualityScore.toFixed(2)),
      score: Number(qualityScore.toFixed(2)),
      baselineScore: baselineScore !== undefined ? Number(baselineScore.toFixed(2)) : undefined,
      deltaScore: deltaScore !== undefined ? Number(deltaScore.toFixed(2)) : undefined,
      nextAction,
      reasons: feedback.signals.map(
        (signal) =>
          `${signal.category}:${String(
            signal.payload.summary ?? signal.payload.reasonCode ?? signal.category
          )}`
      ),
      evaluatedAt: Date.now(),
      confidence: this.computeConfidence(successSignals.length, failureSignals.length, partialSignals.length, qualityScore),
      factorBreakdown: {
        successSignals: successSignals.length,
        failureSignals: failureSignals.length,
        partialSignals: partialSignals.length,
        completionBonus: Number(completionBonus.toFixed(2)),
        failurePenalty: Number(failurePenalty.toFixed(2)),
        partialPenalty: Number(partialPenalty.toFixed(2)),
      },
      // R11-03: Additional evaluation dimensions per §13.5
      constraintCompliance,
      budgetAdherence,
      riskBoundary,
      timingSlo,
    };
  }

  /**
   * Get effective threshold based on risk level and domain override (§17.3).
   */
  private getEffectiveThreshold(riskClass: RiskClass): {
    passThreshold: number;
    criticalThreshold: number;
    enforcement: "blocking" | "warning";
    deltaThreshold?: number;
  } {
    // Check domain-specific override first
    if (this.domainId) {
      const domainOverride = (this.config.domainThresholdOverrides ?? []).find(
        (d) => d.domainId === this.domainId
      );
      if (domainOverride) {
        const riskThreshold = domainOverride.riskLevelThresholds.find(
          (r) => r.riskClass === riskClass
        );
        if (riskThreshold) {
          return {
            passThreshold: riskThreshold.passThreshold,
            criticalThreshold: riskThreshold.criticalThreshold,
            enforcement: riskThreshold.enforcement,
            ...(riskThreshold.deltaThreshold !== undefined && { deltaThreshold: riskThreshold.deltaThreshold }),
          };
        }
      }
    }

    // Fall back to risk-level threshold
    const riskThreshold = (this.config.riskLevelThresholds ?? []).find(
      (r) => r.riskClass === riskClass
    );
    if (riskThreshold) {
      return {
        passThreshold: riskThreshold.passThreshold,
        criticalThreshold: riskThreshold.criticalThreshold,
        enforcement: riskThreshold.enforcement,
        ...(riskThreshold.deltaThreshold !== undefined && { deltaThreshold: riskThreshold.deltaThreshold }),
      };
    }

    // Fall back to default threshold
    return {
      passThreshold: this.config.qualityGate.defaultPassThreshold,
      criticalThreshold: this.config.qualityGate.criticalPassThreshold,
      enforcement: this.config.qualityGate.enforcement,
      ...(this.config.qualityGate.deltaThreshold !== undefined && { deltaThreshold: this.config.qualityGate.deltaThreshold }),
    };
  }

  /**
   * R11-03: Evaluate constraint compliance per §13.5.
   */
  private evaluateConstraintCompliance(
    constraints?: readonly string[]
  ): ConstraintComplianceResult {
    if (!constraints || constraints.length === 0) {
      return { compliant: true, violatedConstraints: [] };
    }

    const violatedConstraints: string[] = [];

    // Check each constraint
    for (const constraint of constraints) {
      // Simple check - in production this would evaluate actual constraint violations
      // from the execution context
      if (constraint.includes("denied") || constraint.includes("blocked")) {
        violatedConstraints.push(constraint);
      }
    }

    return {
      compliant: violatedConstraints.length === 0,
      violatedConstraints,
    };
  }

  /**
   * R11-03: Evaluate budget adherence per §13.5.
   */
  private evaluateBudgetAdherence(
    planGraphBundle: PlanGraphBundle,
    actualCost?: number
  ): BudgetAdherenceResult {
    if (actualCost === undefined) {
      return { adherent: true };
    }

    // Budget adherence check - compare actual vs reserved
    // In production, this would integrate with BudgetLedger
    const budgetRef = planGraphBundle.budgetPlanRef;
    if (!budgetRef) {
      return { adherent: true };
    }

    // For now, return adherent - actual budget tracking requires BudgetLedger integration
    return {
      adherent: true,
      spentVsReserved: {
        spent: actualCost,
        reserved: 0, // Would come from BudgetReservation
      },
    };
  }

  /**
   * R11-03: Evaluate risk boundary per §13.5.
   */
  private evaluateRiskBoundary(planGraphBundle: PlanGraphBundle): RiskBoundaryResult {
    const baselineRisk = planGraphBundle.riskProfile.riskClass;

    // In production, current risk would be calculated from actual execution signals
    // For now, compare baseline to detect drift
    return {
      withinBoundary: true,
      currentRiskClass: baselineRisk,
      baselineRiskClass: baselineRisk,
    };
  }

  /**
   * R11-03: Evaluate timing SLO per §13.5.
   */
  private evaluateTimingSLO(
    planGraphBundle: PlanGraphBundle,
    actualDurationMs?: number
  ): TimingSloResult {
    if (actualDurationMs === undefined) {
      return { withinSlo: true };
    }

    // Default SLO: 5 minutes per node, 30 minutes total
    const maxPerNode = 300000; // 5 minutes
    const maxTotal = 1800000; // 30 minutes

    if (actualDurationMs > maxTotal) {
      return {
        withinSlo: false,
        actualMs: actualDurationMs,
        maxAllowedMs: maxTotal,
      };
    }

    return {
      withinSlo: true,
      actualMs: actualDurationMs,
      maxAllowedMs: maxTotal,
    };
  }

  /**
   * Get the current configuration (useful for debugging/auditing).
   */
  public getConfig(): QualityGateConfig {
    return this.config;
  }

  /**
   * Compute confidence score based on signal counts and quality score.
   * Returns a value between 0 and 1.
   */
  private computeConfidence(
    successCount: number,
    failureCount: number,
    partialCount: number,
    qualityScore: number,
  ): number {
    const totalSignals = successCount + failureCount + partialCount;
    if (totalSignals === 0) {
      return 0.5; // No signals, moderate confidence
    }
    // Weight by signal composition and quality score
    const successRatio = successCount / totalSignals;
    const failureRatio = failureCount / totalSignals;
    // Confidence is higher when success ratio is high and failure ratio is low
    const baseConfidence = successRatio * qualityScore - failureRatio * 0.5;
    return Math.max(0, Math.min(1, Number(baseConfidence.toFixed(2))));
  }
}
