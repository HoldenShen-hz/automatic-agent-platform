/**
 * Evaluator Service — Harness Evaluator Role
 *
 * §13.5: Evaluator is a first-class Harness role responsible for:
 * - Quality gating (quality gate / pass-fail)
 * - Goal deviation detection
 * - Risk escalation
 * - Decision output (accept/retry/replan/escalate/abort)
 *
 * This service consumes PlanGraphBundle (not legacy Plan) to access
 * graph-level metadata including node risk, budget reservation, and graph version.
 */

import { newId } from "../../contracts/types/ids.js";
import type { PlanGraphBundle } from "../../contracts/executable-contracts/index.js";
import type { FeedbackBatch } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";

export type EvaluatorDecision =
  | "accept"
  | "retry"
  | "replan"
  | "escalate"
  | "approve"
  | "abort";

export interface EvaluatorFinding {
  readonly findingId: string;
  readonly category: "quality" | "deviation" | "risk" | "budget" | "timing";
  readonly severity: "info" | "warning" | "error" | "critical";
  readonly message: string;
  readonly nodeId?: string;
  readonly evidenceRefs?: readonly string[];
}

export interface EvaluationReport {
  readonly reportId: string;
  readonly harnessRunId: string;
  readonly planGraphBundleId: string;
  readonly graphVersion: number;
  readonly passed: boolean;
  readonly qualityScore: number;
  readonly decision: EvaluatorDecision;
  readonly findings: readonly EvaluatorFinding[];
  readonly riskLevel: "unchanged" | "elevated" | "decreased";
  readonly evaluatedAt: number;
}

export interface EvaluatorConfig {
  readonly qualityGate: {
    readonly defaultPassThreshold: number;
    readonly criticalPassThreshold: number;
    readonly enforcement: "blocking" | "warning";
  };
  readonly riskThresholds: {
    readonly elevatedRiskThreshold: number;
    readonly criticalRiskThreshold: number;
  };
  readonly timingSlo: {
    readonly maxStepDurationMs: number;
    readonly maxTaskDurationMs: number;
  };
}

const DEFAULT_EVALUATOR_CONFIG: EvaluatorConfig = {
  qualityGate: {
    defaultPassThreshold: 0.5,
    criticalPassThreshold: 0.8,
    enforcement: "blocking",
  },
  riskThresholds: {
    elevatedRiskThreshold: 0.6,
    criticalRiskThreshold: 0.85,
  },
  timingSlo: {
    maxStepDurationMs: 30000,
    maxTaskDurationMs: 300000,
  },
};

export interface EvaluatorServiceOptions {
  readonly config?: EvaluatorConfig;
}

export class EvaluatorService {
  private readonly config: EvaluatorConfig;

  public constructor(options: EvaluatorServiceOptions = {}) {
    this.config = options.config ?? DEFAULT_EVALUATOR_CONFIG;
  }

  /**
   * Evaluate execution outcome against PlanGraphBundle.
   *
   * §13.5: Evaluator consumes PlanGraphBundle (not legacy Plan) to access:
   * - Node-level risk profiles
   * - Budget reservations
   * - Graph version
   *
   * Evaluation dimensions per §13.5:
   * - Quality gate (pass/fail against thresholds)
   * - Goal deviation (actual vs expected outcomes)
   * - Risk boundary (current risk vs baseline)
   * - Budget adherence (spent vs reserved)
   * - Timing SLO (actual vs expected duration)
   */
  public evaluate(params: {
    planGraphBundle: PlanGraphBundle;
    feedback: FeedbackBatch;
    actualDurationMs?: number;
    actualCost?: number;
  }): EvaluationReport {
    const { planGraphBundle, feedback, actualDurationMs, actualCost } = params;
    const findings: EvaluatorFinding[] = [];

    // Evaluate quality gate
    const qualityResult = this.evaluateQuality(feedback);
    if (!qualityResult.passed) {
      findings.push({
        findingId: newId("eval_find"),
        category: "quality",
        severity: qualityResult.severity,
        message: `Quality gate failed: ${qualityResult.message}`,
      });
    }

    // Evaluate goal deviation
    const deviationResult = this.evaluateGoalDeviation(planGraphBundle, feedback);
    if (deviationResult.hasDeviation) {
      findings.push({
        findingId: newId("eval_find"),
        category: "deviation",
        severity: deviationResult.severity,
        message: deviationResult.message,
      });
    }

    // Evaluate risk boundary
    const riskResult = this.evaluateRiskBoundary(planGraphBundle, feedback);
    findings.push({
      findingId: newId("eval_find"),
      category: "risk",
      severity: riskResult.severity,
      message: riskResult.message,
    });

    // Evaluate budget adherence
    const budgetResult = this.evaluateBudgetAdherence(planGraphBundle, actualCost);
    if (!budgetResult.adherent) {
      findings.push({
        findingId: newId("eval_find"),
        category: "budget",
        severity: budgetResult.severity,
        message: budgetResult.message,
      });
    }

    // Evaluate timing SLO
    const timingResult = this.evaluateTimingSLO(planGraphBundle, actualDurationMs);
    if (!timingResult.withinSlo) {
      findings.push({
        findingId: newId("eval_find"),
        category: "timing",
        severity: timingResult.severity,
        message: timingResult.message,
      });
    }

    // Determine overall decision
    const decision = this.determineDecision(findings, feedback);
    const passed = decision === "accept";
    const qualityScore = this.calculateQualityScore(qualityResult, riskResult, budgetResult, timingResult);

    return {
      reportId: newId("eval_report"),
      harnessRunId: planGraphBundle.harnessRunId,
      planGraphBundleId: planGraphBundle.planGraphBundleId,
      graphVersion: planGraphBundle.graphVersion,
      passed,
      qualityScore,
      decision,
      findings,
      riskLevel: riskResult.level,
      evaluatedAt: Date.now(),
    };
  }

  private evaluateQuality(feedback: FeedbackBatch): {
    passed: boolean;
    severity: EvaluatorFinding["severity"];
    message: string;
  } {
    const failureSignals = feedback.signals.filter(
      (s) => s.category === "failure" || s.category === "timeout"
    );
    const partialSignals = feedback.signals.filter((s) => s.category === "partial");
    const successSignals = feedback.signals.filter((s) => s.category === "success");

    const failureCount = failureSignals.length;
    const partialCount = partialSignals.length;
    const successCount = successSignals.length;

    if (failureCount > 0) {
      return {
        passed: false,
        severity: failureCount >= 3 ? "critical" : "error",
        message: `${failureCount} failure signal(s) detected`,
      };
    }

    if (partialCount > 2) {
      return {
        passed: false,
        severity: "warning",
        message: `${partialCount} partial signals detected`,
      };
    }

    if (successCount === 0 && feedback.signals.length > 0) {
      return {
        passed: false,
        severity: "warning",
        message: "No success signals despite feedback presence",
      };
    }

    return {
      passed: feedback.outcome === "completed",
      severity: "info",
      message: "Quality gate passed",
    };
  }

  private evaluateGoalDeviation(
    planGraphBundle: PlanGraphBundle,
    feedback: FeedbackBatch
  ): {
    hasDeviation: boolean;
    severity: EvaluatorFinding["severity"];
    message: string;
  } {
    // Check if execution outcome matches expected terminal state
    const failureSignals = feedback.signals.filter(
      (s) => s.category === "failure" || s.category === "timeout"
    );

    if (failureSignals.length > 0 && feedback.outcome !== "completed") {
      return {
        hasDeviation: true,
        severity: "error",
        message: `Goal not achieved: ${failureSignals.length} failure(s) preventing completion`,
      };
    }

    return {
      hasDeviation: false,
      severity: "info",
      message: "Goal deviation: none detected",
    };
  }

  private evaluateRiskBoundary(
    planGraphBundle: PlanGraphBundle,
    feedback: FeedbackBatch
  ): {
    severity: EvaluatorFinding["severity"];
    message: string;
    level: "unchanged" | "elevated" | "decreased";
  } {
    // Compare current risk against baseline riskProfile
    const baselineRisk = planGraphBundle.riskProfile.riskClass;
    const currentFailures = feedback.signals.filter(
      (s) => s.category === "failure" || s.category === "timeout"
    ).length;

    let level: "unchanged" | "elevated" | "decreased" = "unchanged";
    let severity: EvaluatorFinding["severity"] = "info";
    let message = `Risk boundary: baseline ${baselineRisk}`;

    if (currentFailures > 0) {
      if (baselineRisk === "low" && currentFailures >= 2) {
        level = "elevated";
        severity = "warning";
        message = `Risk elevated: ${currentFailures} failures against baseline ${baselineRisk}`;
      } else if (baselineRisk === "medium" && currentFailures >= 3) {
        level = "elevated";
        severity = "warning";
        message = `Risk elevated: ${currentFailures} failures against baseline ${baselineRisk}`;
      } else if (baselineRisk === "high" || baselineRisk === "critical") {
        level = "elevated";
        severity = currentFailures >= 2 ? "critical" : "error";
        message = `Risk boundary exceeded: ${currentFailures} failures against baseline ${baselineRisk}`;
      }
    }

    return { severity, message, level };
  }

  private evaluateBudgetAdherence(
    planGraphBundle: PlanGraphBundle,
    actualCost?: number
  ): {
    adherent: boolean;
    severity: EvaluatorFinding["severity"];
    message: string;
  } {
    // Budget adherence check - compare actual vs reserved
    if (actualCost === undefined) {
      return {
        adherent: true,
        severity: "info",
        message: "Budget adherence: no cost data available",
      };
    }

    const budgetReserved = planGraphBundle.budgetPlanRef;
    if (!budgetReserved) {
      return {
        adherent: true,
        severity: "info",
        message: "Budget adherence: no budget reservation found",
      };
    }

    // For now, return adherent - actual budget tracking requires BudgetLedger integration
    return {
      adherent: true,
      severity: "info",
      message: `Budget adherence: ${actualCost} cost consumed (budget ref: ${budgetReserved})`,
    };
  }

  private evaluateTimingSLO(
    planGraphBundle: PlanGraphBundle,
    actualDurationMs?: number
  ): {
    withinSlo: boolean;
    severity: EvaluatorFinding["severity"];
    message: string;
  } {
    if (actualDurationMs === undefined) {
      return {
        withinSlo: true,
        severity: "info",
        message: "Timing SLO: no duration data available",
      };
    }

    const maxDuration = this.config.timingSlo.maxTaskDurationMs;
    if (actualDurationMs > maxDuration) {
      return {
        withinSlo: false,
        severity: "warning",
        message: `Timing SLO breached: ${actualDurationMs}ms > ${maxDuration}ms max`,
      };
    }

    return {
      withinSlo: true,
      severity: "info",
      message: `Timing SLO: ${actualDurationMs}ms within ${maxDuration}ms`,
    };
  }

  private determineDecision(
    findings: readonly EvaluatorFinding[],
    feedback: FeedbackBatch
  ): EvaluatorDecision {
    // Critical findings force escalate/abort
    const criticalFindings = findings.filter((f) => f.severity === "critical");
    if (criticalFindings.length > 0) {
      return "escalate";
    }

    // Error findings suggest replan
    const errorFindings = findings.filter((f) => f.severity === "error");
    if (errorFindings.length > 0) {
      return "replan";
    }

    // Failure signals suggest retry
    const failureSignals = feedback.signals.filter(
      (s) => s.category === "failure" || s.category === "timeout"
    );
    if (failureSignals.length > 0) {
      return "retry";
    }

    // Approval required for partial completion
    if (feedback.outcome === "partial" || feedback.outcome === "repairable") {
      return "approve";
    }

    // Completed successfully
    if (feedback.outcome === "completed") {
      return "accept";
    }

    return "escalate";
  }

  private calculateQualityScore(
    quality: { passed: boolean; severity: EvaluatorFinding["severity"] },
    risk: { severity: EvaluatorFinding["severity"]; level: "unchanged" | "elevated" | "decreased" },
    budget: { adherent: boolean },
    timing: { withinSlo: boolean }
  ): number {
    let score = 1.0;

    if (!quality.passed) {
      score -= 0.3;
    }
    if (quality.severity === "error" || quality.severity === "critical") {
      score -= 0.2;
    }
    if (risk.level === "elevated") {
      score -= 0.2;
    }
    if (risk.severity === "critical") {
      score -= 0.15;
    }
    if (!budget.adherent) {
      score -= 0.15;
    }
    if (!timing.withinSlo) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  public getConfig(): EvaluatorConfig {
    return this.config;
  }
}
