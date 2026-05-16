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
import { RiskEvaluationEngine } from "../../five-plane-control-plane/risk-control/risk-evaluation-engine.js";
import { loadRiskConfig } from "../../five-plane-control-plane/risk-control/risk-config-loader.js";
import type { RiskFactors, RiskLevel } from "../../five-plane-control-plane/risk-control/types.js";

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
    // R11-05 FIX: configurable threshold per §17.3; not fixed at 0.5.
    // Default 0.7 aligns with quality_score_delta >= -0.05 delta-based evaluation
    defaultPassThreshold: 0.7,
    criticalPassThreshold: 0.9,
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
  readonly riskEvaluationEngine?: RiskEvaluationEngine;
}

export class EvaluatorService {
  private readonly config: EvaluatorConfig;
  private readonly riskEvaluationEngine: RiskEvaluationEngine;

  public constructor(options: EvaluatorServiceOptions = {}) {
    this.config = options.config ?? DEFAULT_EVALUATOR_CONFIG;
    this.riskEvaluationEngine = options.riskEvaluationEngine ?? new RiskEvaluationEngine({
      config: loadRiskConfig(),
    });
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
   *
   * @param params.planGraphBundle - The plan graph bundle to evaluate against
   * @param params.feedback - Aggregated feedback signals from execution
   * @param params.actualDurationMs - Actual execution duration
   * @param params.actualCost - Actual cost consumed
   * @param params.nodeRunId - Optional: filter feedback to a specific node/run
   *                           for workflow-aware evaluation. When provided,
   *                           only signals with matching nodeRunId are considered.
   *                           This enables per-node quality assessment in
   *                           parallel subgraph execution scenarios.
   */
  public evaluate(params: {
    planGraphBundle: PlanGraphBundle;
    feedback: FeedbackBatch;
    actualDurationMs?: number;
    actualCost?: number;
    nodeRunId?: string;
  }): EvaluationReport {
    const { planGraphBundle, feedback, actualDurationMs, actualCost, nodeRunId } = params;
    const findings: EvaluatorFinding[] = [];

    // Filter signals to the specific node if nodeRunId provided
    // R11-02 FIX: Workflow-aware evaluation - filter signals by nodeRunId
    // to enable per-node quality assessment in parallel subgraph execution
    const filteredSignals = nodeRunId
      ? feedback.signals.filter((s) => (s as { nodeRunId?: string }).nodeRunId === nodeRunId)
      : feedback.signals;

    const nodeFilteredFeedback: FeedbackBatch = {
      ...feedback,
      signals: filteredSignals,
    };

    // Evaluate quality gate
    const qualityResult = this.evaluateQuality(nodeFilteredFeedback);
    if (!qualityResult.passed) {
      findings.push({
        findingId: newId("eval_find"),
        category: "quality",
        severity: qualityResult.severity,
        message: `${qualityResult.message}${nodeRunId ? ` (node: ${nodeRunId})` : ""}`,
      });
    }

    // Evaluate goal deviation - emit finding based on result
    const deviationResult = this.evaluateGoalDeviation(planGraphBundle, nodeFilteredFeedback);
    if (deviationResult.hasDeviation) {
      findings.push({
        findingId: newId("eval_find"),
        category: "deviation",
        severity: deviationResult.severity,
        message: deviationResult.message,
      });
    } else {
      findings.push({
        findingId: newId("eval_find"),
        category: "deviation",
        severity: "info",
        message: "Goal deviation: none detected",
      });
    }

    // Evaluate risk boundary
    const riskResult = this.evaluateRiskBoundary(planGraphBundle, nodeFilteredFeedback);
    findings.push({
      findingId: newId("eval_find"),
      category: "risk",
      severity: riskResult.severity,
      message: `${riskResult.message}${nodeRunId ? ` (node: ${nodeRunId})` : ""}`,
    });

    // Evaluate budget adherence - always emit finding
    const budgetResult = this.evaluateBudgetAdherence(planGraphBundle, actualCost);
    findings.push({
      findingId: newId("eval_find"),
      category: "budget",
      severity: budgetResult.severity,
      message: budgetResult.message,
    });

    // Evaluate timing SLO - always emit finding
    const timingResult = this.evaluateTimingSLO(planGraphBundle, actualDurationMs);
    findings.push({
      findingId: newId("eval_find"),
      category: "timing",
      severity: timingResult.severity,
      message: timingResult.message,
    });

    // Determine overall decision
    const decision = this.determineDecision(findings, nodeFilteredFeedback);
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

    // Completed outcome - check if there were any issues along the way
    if (feedback.outcome === "completed" && feedback.signals.length > 0) {
      // Even completed outcomes may have had transient issues worth noting
      const hasNonSuccessSignals = feedback.signals.some(
        (s) => s.category !== "success"
      );
      if (hasNonSuccessSignals) {
        return {
          hasDeviation: true,
          severity: "info",
          message: "Goal achieved with transient issues noted",
        };
      }
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
    const baselineRisk = planGraphBundle.riskProfile.riskClass;
    const failureCount = feedback.signals.filter((signal) => signal.category === "failure" || signal.category === "timeout").length;
    const criticalCount = feedback.signals.filter((signal) => signal.severity === "critical").length;
    if (criticalCount > 0) {
      return {
        severity: "critical",
        message: `Risk boundary exceeded: baseline ${baselineRisk} -> critical`,
        level: baselineRisk === "critical" ? "unchanged" : "elevated",
      };
    }
    if (failureCount === 0) {
      return {
        severity: "info",
        message: `Risk boundary: baseline ${baselineRisk} unchanged`,
        level: "unchanged",
      };
    }
    // R11-03 FIX: When baseline is low and there are failures, we must elevate.
    // The RiskEvaluationEngine may return "unchanged" if evaluated score doesn't
    // cross the elevation threshold, but failures against low baseline should
    // always be treated as elevated risk.
    if (failureCount > 0 && baselineRisk === "low") {
      return {
        severity: failureCount >= 3 ? "error" : "warning",
        message: `Risk boundary exceeded: baseline ${baselineRisk} with ${failureCount} failure signal(s)`,
        level: "elevated",
      };
    }
    // R11-04 FIX: When baseline is high and there are failures,
    // the risk should be escalated to critical regardless of evaluated score.
    // High baseline with failures indicates critical risk.
    if (failureCount > 0 && baselineRisk === "high") {
      return {
        severity: failureCount >= 2 ? "critical" : "error",
        message: `Risk boundary exceeded: baseline ${baselineRisk} with ${failureCount} failure signal(s)`,
        level: "elevated",
      };
    }
    // R11-05 FIX: When baseline is critical and there are failures,
    // risk remains critical (already at maximum).
    if (failureCount > 0 && baselineRisk === "critical") {
      return {
        severity: "critical",
        message: `Risk boundary exceeded: baseline ${baselineRisk} with ${failureCount} failure signal(s)`,
        level: "elevated",
      };
    }
    // R11-06 FIX: Medium baseline with failures - use RiskEvaluationEngine for nuanced
    // assessment. Fall back to warning for moderate failure counts (1-2).
    if (failureCount === 2) {
      return {
        severity: "warning",
        message: `Risk boundary exceeded: baseline ${baselineRisk} with ${failureCount} failure signals`,
        level: "elevated",
      };
    }
    // For medium baseline with 1 failure, also check RiskEvaluationEngine
    // but if it doesn't elevate, fall back to warning
    if (failureCount >= 3) {
      return {
        severity: "error",
        message: `Risk boundary exceeded: baseline ${baselineRisk} with ${failureCount} failure signals`,
        level: "elevated",
      };
    }
    const evaluated = this.riskEvaluationEngine.evaluate({
      taskId: planGraphBundle.planGraphBundleId,
      factors: this.buildRiskFactors(planGraphBundle, feedback),
    });
    const level = this.compareRiskLevel(baselineRisk, evaluated.riskLevel);
    const severity = this.mapRiskSeverity(level, evaluated.riskLevel);
    const message = level === "elevated"
      ? `Risk boundary exceeded: baseline ${baselineRisk} -> ${evaluated.riskLevel} (${evaluated.riskScore})`
      : `Risk boundary: baseline ${baselineRisk} -> ${evaluated.riskLevel} (${evaluated.riskScore})`;
    return { severity, message, level };
  }

  private buildRiskFactors(planGraphBundle: PlanGraphBundle, feedback: FeedbackBatch): RiskFactors {
    const baseline = this.riskClassToWeight(planGraphBundle.riskProfile.riskClass);
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

  private compareRiskLevel(baselineRisk: string, evaluatedRisk: RiskLevel): "unchanged" | "elevated" | "decreased" {
    const baselineWeight = this.riskClassToWeight(baselineRisk);
    const evaluatedWeight = this.riskClassToWeight(evaluatedRisk);
    if (evaluatedWeight > baselineWeight) {
      return "elevated";
    }
    if (evaluatedWeight < baselineWeight) {
      return "decreased";
    }
    return "unchanged";
  }

  private mapRiskSeverity(
    level: "unchanged" | "elevated" | "decreased",
    riskLevel: RiskLevel,
  ): EvaluatorFinding["severity"] {
    if (level !== "elevated") {
      return "info";
    }
    if (riskLevel === "critical") {
      return "critical";
    }
    if (riskLevel === "high") {
      return "error";
    }
    return "warning";
  }

  private riskClassToWeight(riskClass: string): 1 | 2 | 4 | 5 {
    switch (riskClass) {
      case "critical":
        return 5;
      case "high":
        return 4;
      case "medium":
        return 2;
      default:
        return 1;
    }
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
    // Critical findings force escalate/abort - highest priority
    const criticalFindings = findings.filter((f) => f.severity === "critical");
    if (criticalFindings.length > 0) {
      return "escalate";
    }

    // Error findings suggest replan - but only if NO failure signals
    // Failure signals are handled separately as they indicate recoverable issues
    const errorFindings = findings.filter((f) => f.severity === "error");
    const failureSignals = feedback.signals.filter(
      (s) => s.category === "failure" || s.category === "timeout"
    );

    // If there are failure signals, they take priority for retry decision
    // UNLESS we have critical risk findings (checked above)
    if (failureSignals.length > 0) {
      // Check if risk boundary is elevated - if so, replan rather than retry
      const riskFindings = findings.filter((f) => f.category === "risk");
      const hasElevatedRisk = riskFindings.some((f) => f.severity === "error" || f.severity === "critical");
      if (hasElevatedRisk) {
        return "replan";
      }
      // R11-07 FIX: If quality gate failed with error/critical severity, replan
      // rather than retry since the quality issue indicates fundamental problem
      const qualityFindings = findings.filter((f) => f.category === "quality");
      const hasQualityError = qualityFindings.some((f) => f.severity === "error" || f.severity === "critical");
      if (hasQualityError) {
        return "replan";
      }
      return "retry";
    }

    // Error findings suggest replan (only reached if no failure signals)
    if (errorFindings.length > 0) {
      return "replan";
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
