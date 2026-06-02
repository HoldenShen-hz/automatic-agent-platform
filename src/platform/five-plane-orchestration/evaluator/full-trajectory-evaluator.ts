import { newId, nowIso } from "../../contracts/types/ids.js";
import type { PlanGraphBundle } from "../../contracts/executable-contracts/index.js";
import type { FeedbackBatch as RuntimeFeedbackBatch } from "../../contracts/types/feedback.js";
import { ExecutionOutcomeEvaluator, type EvaluationOutcome } from "../../prompt-engine/eval/execution-outcome-evaluator.js";
import type { FeedbackBatch } from "../../../scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { EvaluatorService, type EvaluationReport as OrchestrationEvaluationReport } from "./evaluator-service.js";

export type TrajectoryDimensionName =
  | "tool_selection_correctness"
  | "tool_argument_correctness"
  | "policy_compliance"
  | "approval_compliance"
  | "evidence_usage"
  | "context_usage"
  | "cost_latency_discipline"
  | "final_task_success";

export interface FullTrajectoryDimensionScore {
  readonly dimension: TrajectoryDimensionName;
  readonly score: number;
  readonly maxScore: 5;
  readonly source: "rule" | "hybrid";
  readonly rationale: string;
}

export interface FullTrajectoryRuleInput {
  readonly toolSelectionCorrect: boolean;
  readonly toolArgumentCorrect: boolean;
  readonly policyCompliant: boolean;
  readonly approvalCompliant: boolean;
  readonly evidenceUsageScore: number;
  readonly contextUsageScore: number;
  readonly finalTaskSuccess: boolean;
}

export interface FullTrajectoryLlmJudgeCalibration {
  readonly judgeScore: number;
  readonly agreementRate: number;
  readonly calibrationVersion: string;
  readonly sampleAuditRef?: string;
}

export interface FullTrajectoryThresholds {
  readonly trajectoryMinScore: number;
  readonly llmJudgeMinimumAgreementRate: number;
}

export interface FullTrajectoryEvaluationInput {
  readonly planGraphBundle: PlanGraphBundle;
  readonly feedback: FeedbackBatch;
  readonly ruleInput: FullTrajectoryRuleInput;
  readonly actualDurationMs?: number;
  readonly actualCost?: number;
  readonly baselineQualityScore?: number | null;
  readonly llmJudge?: FullTrajectoryLlmJudgeCalibration;
  readonly thresholds?: Partial<FullTrajectoryThresholds>;
}

export interface FullTrajectoryEvaluationReport {
  readonly trajectoryReportId: string;
  readonly checkedAt: string;
  readonly riskClass: string;
  readonly score: number;
  readonly maxScore: 40;
  readonly passed: boolean;
  readonly thresholds: FullTrajectoryThresholds;
  readonly blockingEligibleJudge: boolean;
  readonly blockerReasons: readonly string[];
  readonly dimensions: readonly FullTrajectoryDimensionScore[];
  readonly ruleScore: number;
  readonly llmJudgeScore: number | null;
  readonly orchestrationReport: OrchestrationEvaluationReport;
  readonly outcomeReport: EvaluationOutcome;
}

const DEFAULT_THRESHOLDS: FullTrajectoryThresholds = {
  trajectoryMinScore: 32,
  llmJudgeMinimumAgreementRate: 0.8,
};

const RISK_ADJUSTED_TRAJECTORY_MIN_SCORE = {
  low: 28,
  medium: 32,
  high: 34,
  critical: 36,
} as const;

export class FullTrajectoryEvaluator {
  private readonly orchestrationEvaluator: EvaluatorService;
  private readonly outcomeEvaluator: ExecutionOutcomeEvaluator;

  public constructor(options: {
    orchestrationEvaluator?: EvaluatorService;
    outcomeEvaluator?: ExecutionOutcomeEvaluator;
  } = {}) {
    this.orchestrationEvaluator = options.orchestrationEvaluator ?? new EvaluatorService();
    this.outcomeEvaluator = options.outcomeEvaluator ?? new ExecutionOutcomeEvaluator();
  }

  public evaluate(input: FullTrajectoryEvaluationInput): FullTrajectoryEvaluationReport {
    const riskClass = resolveRiskClass(input.planGraphBundle);
    const thresholds = resolveThresholds(riskClass, input.thresholds);
    const orchestrationReport = this.orchestrationEvaluator.evaluate({
      planGraphBundle: input.planGraphBundle,
      feedback: input.feedback,
      ...(input.actualDurationMs != null ? { actualDurationMs: input.actualDurationMs } : {}),
      ...(input.actualCost != null ? { actualCost: input.actualCost } : {}),
    });
    const outcomeReport = this.outcomeEvaluator.evaluate(
      input.planGraphBundle,
      input.feedback as RuntimeFeedbackBatch,
      input.actualDurationMs,
      input.actualCost,
      input.baselineQualityScore,
    );

    const costLatencyScore = buildCostLatencyScore(outcomeReport);
    const dimensions: FullTrajectoryDimensionScore[] = [
      buildBooleanDimension(
        "tool_selection_correctness",
        input.ruleInput.toolSelectionCorrect,
        "tool selection matched the intended execution path",
      ),
      buildBooleanDimension(
        "tool_argument_correctness",
        input.ruleInput.toolArgumentCorrect,
        "tool arguments satisfied the contract and risk controls",
      ),
      buildBooleanDimension(
        "policy_compliance",
        input.ruleInput.policyCompliant,
        "policy checks remained compliant across the trajectory",
      ),
      buildBooleanDimension(
        "approval_compliance",
        input.ruleInput.approvalCompliant,
        "approval workflow stayed aligned with high-risk controls",
      ),
      buildScalarDimension(
        "evidence_usage",
        input.ruleInput.evidenceUsageScore,
        "evidence usage stayed traceable and attributable",
      ),
      buildScalarDimension(
        "context_usage",
        input.ruleInput.contextUsageScore,
        "context usage remained grounded and mission-relevant",
      ),
      {
        dimension: "cost_latency_discipline",
        score: costLatencyScore,
        maxScore: 5,
        source: "hybrid",
        rationale: buildCostLatencyRationale(outcomeReport),
      },
      buildBooleanDimension(
        "final_task_success",
        input.ruleInput.finalTaskSuccess,
        "final task outcome satisfied the requested goal",
      ),
    ];

    const ruleScore = dimensions.reduce((sum, dimension) => sum + dimension.score, 0);
    const llmJudgeScore = input.llmJudge == null ? null : clampDimensionScore(input.llmJudge.judgeScore, 40);
    const blockingEligibleJudge = input.llmJudge == null
      ? false
      : input.llmJudge.agreementRate >= thresholds.llmJudgeMinimumAgreementRate;
    const score = llmJudgeScore == null || !blockingEligibleJudge
      ? ruleScore
      : Number((((ruleScore / 40) + (llmJudgeScore / 40)) / 2 * 40).toFixed(2));

    const blockerReasons: string[] = [];
    if (score < thresholds.trajectoryMinScore) {
      blockerReasons.push(`trajectory_score_below_threshold:${score}<${thresholds.trajectoryMinScore}`);
    }
    if ((riskClass === "high" || riskClass === "critical") && !input.ruleInput.policyCompliant) {
      blockerReasons.push("policy_compliance_required_for_high_risk");
    }
    if ((riskClass === "high" || riskClass === "critical") && !input.ruleInput.approvalCompliant) {
      blockerReasons.push("approval_compliance_required_for_high_risk");
    }
    if (!orchestrationReport.passed) {
      blockerReasons.push(`orchestration_decision:${orchestrationReport.decision}`);
    }
    if (!input.ruleInput.finalTaskSuccess && !outcomeReport.passed) {
      blockerReasons.push(`outcome_verdict:${outcomeReport.verdict}`);
    }
    if (input.llmJudge != null && !blockingEligibleJudge) {
      blockerReasons.push(`llm_judge_not_calibrated:${input.llmJudge.agreementRate.toFixed(2)}<${thresholds.llmJudgeMinimumAgreementRate.toFixed(2)}`);
    }

    return {
      trajectoryReportId: newId("trajectory_eval"),
      checkedAt: nowIso(),
      riskClass,
      score,
      maxScore: 40,
      passed: blockerReasons.length === 0,
      thresholds,
      blockingEligibleJudge,
      blockerReasons,
      dimensions,
      ruleScore,
      llmJudgeScore,
      orchestrationReport,
      outcomeReport,
    };
  }
}

function resolveRiskClass(planGraphBundle: PlanGraphBundle): string {
  return planGraphBundle.riskProfile?.riskClass ?? "medium";
}

function resolveThresholds(
  riskClass: string,
  overrides?: Partial<FullTrajectoryThresholds>,
): FullTrajectoryThresholds {
  const defaultTrajectoryMinScore =
    RISK_ADJUSTED_TRAJECTORY_MIN_SCORE[riskClass as keyof typeof RISK_ADJUSTED_TRAJECTORY_MIN_SCORE]
    ?? DEFAULT_THRESHOLDS.trajectoryMinScore;
  return {
    trajectoryMinScore: overrides?.trajectoryMinScore ?? defaultTrajectoryMinScore,
    llmJudgeMinimumAgreementRate: overrides?.llmJudgeMinimumAgreementRate ?? DEFAULT_THRESHOLDS.llmJudgeMinimumAgreementRate,
  };
}

function buildBooleanDimension(
  dimension: TrajectoryDimensionName,
  passed: boolean,
  rationale: string,
): FullTrajectoryDimensionScore {
  return {
    dimension,
    score: passed ? 5 : 0,
    maxScore: 5,
    source: "rule",
    rationale,
  };
}

function buildScalarDimension(
  dimension: TrajectoryDimensionName,
  score: number,
  rationale: string,
): FullTrajectoryDimensionScore {
  return {
    dimension,
    score: clampDimensionScore(score, 5),
    maxScore: 5,
    source: "rule",
    rationale,
  };
}

function clampDimensionScore(score: number, maxScore: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }
  return Math.max(0, Math.min(maxScore, Number(score.toFixed(2))));
}

function buildCostLatencyScore(outcomeReport: EvaluationOutcome): number {
  const budgetOk = outcomeReport.dimensions.budgetAdherence.adherent;
  const timingOk = outcomeReport.dimensions.timingSlo.withinSlo;
  if (budgetOk && timingOk) {
    return 5;
  }
  if (budgetOk || timingOk) {
    return 3;
  }
  return 0;
}

function buildCostLatencyRationale(outcomeReport: EvaluationOutcome): string {
  const budget = outcomeReport.dimensions.budgetAdherence;
  const timing = outcomeReport.dimensions.timingSlo;
  return `budget=${budget.adherent ? "ok" : "exceeded"}, timing=${timing.withinSlo ? "ok" : "exceeded"}`;
}
