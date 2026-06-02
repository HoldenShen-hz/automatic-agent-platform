import assert from "node:assert/strict";
import test from "node:test";

import { FullTrajectoryEvaluator } from "../../../../../src/platform/five-plane-orchestration/evaluator/full-trajectory-evaluator.js";
import { EvaluatorService } from "../../../../../src/platform/five-plane-orchestration/evaluator/evaluator-service.js";
import type { PlanGraphBundle } from "../../../../../src/platform/contracts/executable-contracts/index.js";
import type { FeedbackBatch } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function makePlanGraphBundle(riskClass: "low" | "medium" | "high" | "critical" = "medium"): PlanGraphBundle {
  return {
    harnessRunId: "harness-1",
    planGraphBundleId: "bundle-1",
    graphVersion: 1,
    riskProfile: { riskClass, reasons: [] },
    budgetPlanRef: "budget-1",
  } as unknown as PlanGraphBundle;
}

function makeFeedbackBatch(overrides: Partial<FeedbackBatch> = {}): FeedbackBatch {
  return {
    feedbackId: "feedback-1",
    taskId: "task-1",
    executionId: "exec-1",
    planId: null,
    outcome: "completed",
    signals: [
      {
        signalId: "signal-1",
        taskId: "task-1",
        source: "execution",
        category: "success",
        severity: "info",
        payload: {},
        stepOutputRefs: [],
        timestamp: Date.now(),
        feedbackTrustScore: 0.9,
        trustFactors: {
          sourceReliability: 0.9,
          historicalAccuracy: 0.9,
          authenticatedSource: true,
          attackSurfaceExposure: 0.1,
          holdoutOverlap: 0,
        },
      },
    ],
    emittedAt: Date.now(),
    ...overrides,
  };
}

function createEvaluator(): FullTrajectoryEvaluator {
  return new FullTrajectoryEvaluator({
    orchestrationEvaluator: new EvaluatorService({
      riskEvaluationEngine: {
        evaluate: () => ({
          riskLevel: "medium",
          riskScore: 0.6,
          factors: {} as never,
        }),
      } as never,
    }),
  });
}

test("FullTrajectoryEvaluator passes high-risk trajectory when rule and judge checks satisfy thresholds", () => {
  const evaluator = createEvaluator();

  const report = evaluator.evaluate({
    planGraphBundle: makePlanGraphBundle("high"),
    feedback: makeFeedbackBatch(),
    actualDurationMs: 1_000,
    actualCost: 5,
    ruleInput: {
      toolSelectionCorrect: true,
      toolArgumentCorrect: true,
      policyCompliant: true,
      approvalCompliant: true,
      evidenceUsageScore: 4,
      contextUsageScore: 4,
      finalTaskSuccess: true,
    },
    thresholds: {
      trajectoryMinScore: 34,
    },
    llmJudge: {
      judgeScore: 38,
      agreementRate: 0.92,
      calibrationVersion: "judge-v1",
      sampleAuditRef: "audit-1",
    },
  });

  assert.equal(report.passed, true);
  assert.equal(report.blockerReasons.length, 0);
  assert.equal(report.blockingEligibleJudge, true);
  assert.ok(report.score >= 34);
  assert.equal(report.dimensions.find((item) => item.dimension === "policy_compliance")?.score, 5);
  assert.equal(report.dimensions.find((item) => item.dimension === "approval_compliance")?.score, 5);
});

test("FullTrajectoryEvaluator blocks high-risk trajectories when approval compliance is missing", () => {
  const evaluator = createEvaluator();

  const report = evaluator.evaluate({
    planGraphBundle: makePlanGraphBundle("critical"),
    feedback: makeFeedbackBatch(),
    actualDurationMs: 1_000,
    actualCost: 5,
    ruleInput: {
      toolSelectionCorrect: true,
      toolArgumentCorrect: true,
      policyCompliant: true,
      approvalCompliant: false,
      evidenceUsageScore: 5,
      contextUsageScore: 5,
      finalTaskSuccess: true,
    },
    thresholds: {
      trajectoryMinScore: 34,
    },
  });

  assert.equal(report.passed, false);
  assert.ok(report.blockerReasons.includes("approval_compliance_required_for_high_risk"));
});

test("FullTrajectoryEvaluator flags uncalibrated LLM judges as non-blocking", () => {
  const evaluator = createEvaluator();

  const report = evaluator.evaluate({
    planGraphBundle: makePlanGraphBundle("medium"),
    feedback: makeFeedbackBatch(),
    actualDurationMs: 1_000,
    actualCost: 5,
    ruleInput: {
      toolSelectionCorrect: true,
      toolArgumentCorrect: true,
      policyCompliant: true,
      approvalCompliant: true,
      evidenceUsageScore: 4,
      contextUsageScore: 4,
      finalTaskSuccess: true,
    },
    llmJudge: {
      judgeScore: 36,
      agreementRate: 0.74,
      calibrationVersion: "judge-v1",
    },
  });

  assert.equal(report.blockingEligibleJudge, false);
  assert.equal(report.score, report.ruleScore);
  assert.ok(report.blockerReasons.some((reason) => reason.startsWith("llm_judge_not_calibrated:")));
});

test("FullTrajectoryEvaluator uses stricter default trajectory thresholds for higher risk classes", () => {
  const evaluator = createEvaluator();
  const baseInput = {
    feedback: makeFeedbackBatch(),
    actualDurationMs: 1_000,
    actualCost: 5,
    ruleInput: {
      toolSelectionCorrect: true,
      toolArgumentCorrect: true,
      policyCompliant: true,
      approvalCompliant: true,
      evidenceUsageScore: 2,
      contextUsageScore: 2,
      finalTaskSuccess: true,
    },
  };

  const mediumReport = evaluator.evaluate({
    ...baseInput,
    planGraphBundle: makePlanGraphBundle("medium"),
  });
  const criticalReport = evaluator.evaluate({
    ...baseInput,
    planGraphBundle: makePlanGraphBundle("critical"),
  });

  assert.equal(mediumReport.thresholds.trajectoryMinScore, 32);
  assert.equal(criticalReport.thresholds.trajectoryMinScore, 36);
  assert.equal(mediumReport.passed, true);
  assert.equal(criticalReport.passed, false);
  assert.ok(criticalReport.blockerReasons.some((reason) => reason.startsWith("trajectory_score_below_threshold")));
});
