import assert from "node:assert/strict";
import test from "node:test";

import { PostExecutionQualityGate } from "../../../../../src/platform/prompt-engine/eval/post-execution-quality-gate.js";
import type { EvaluationReport, ExecutionOutcomeEvaluation } from "../../../../../src/platform/prompt-engine/eval/execution-outcome-evaluator.js";

test("PostExecutionQualityGate decides released when complete and passed", () => {
  const gate = new PostExecutionQualityGate();
  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_123",
    taskId: "task_456",
    nextAction: "complete",
    passed: true,
    qualityScore: 0.85,
    reasons: ["success_signal"],
    factorBreakdown: {
      successSignals: 5,
      failureSignals: 0,
      partialSignals: 1,
      completionBonus: 0.1,
      failurePenalty: 0,
      partialPenalty: 0.05,
    },
    evaluatedAt: Date.now(),
  };

  const decision = gate.decide(evaluation);

  assert.equal(decision.accepted, true);
  assert.equal(decision.releaseStage, "released");
  assert.deepEqual(decision.reasonCodes, ["quality.accepted"]);
});

test("PostExecutionQualityGate decides approval when nextAction is approve", () => {
  const gate = new PostExecutionQualityGate();
  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_123",
    taskId: "task_456",
    nextAction: "approve",
    passed: false,
    qualityScore: 0.65,
    reasons: ["approval_required"],
    factorBreakdown: {
      successSignals: 3,
      failureSignals: 1,
      partialSignals: 2,
      completionBonus: 0,
      failurePenalty: 0.1,
      partialPenalty: 0.1,
    },
    evaluatedAt: Date.now(),
  };

  const decision = gate.decide(evaluation);

  assert.equal(decision.accepted, false);
  assert.equal(decision.releaseStage, "approval");
  assert.deepEqual(decision.reasonCodes, ["quality.approval_required"]);
});

test("PostExecutionQualityGate decides approval for canonical approve verdict", () => {
  const gate = new PostExecutionQualityGate();
  const evaluation: EvaluationReport = {
    verdict: "approve",
    score: 0.65,
    passed: false,
    issues: ["approval_required"],
    recommendation: "approve",
    confidence: 0.65,
    evidenceRefs: ["approval_required"],
    notes: "approval required",
    dimensions: {
      qualityScore: 0.65,
      constraintCompliance: {
        compliant: true,
        violatedConstraints: [],
        severity: "info",
      },
      budgetAdherence: {
        adherent: true,
        plannedBudget: 100,
        actualCost: 40,
        variancePercent: -60,
        severity: "info",
      },
      riskEvaluation: {
        withinRiskBudget: true,
        riskLevel: "unchanged",
        currentRiskScore: 0.2,
        baselineRiskScore: 0.2,
        severity: "info",
      },
      timingSlo: {
        withinSlo: true,
        plannedDurationMs: 1000,
        actualDurationMs: 250,
        variancePercent: -75,
        severity: "info",
      },
    },
  };

  const decision = gate.decide(evaluation);

  assert.equal(decision.accepted, false);
  assert.equal(decision.releaseStage, "approval");
  assert.deepEqual(decision.reasonCodes, ["quality.approval_required"]);
});

test("PostExecutionQualityGate decides repair when nextAction is retry", () => {
  const gate = new PostExecutionQualityGate();
  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_123",
    taskId: "task_456",
    nextAction: "retry",
    passed: false,
    qualityScore: 0.45,
    reasons: ["retry_required"],
    factorBreakdown: {
      successSignals: 2,
      failureSignals: 3,
      partialSignals: 1,
      completionBonus: 0,
      failurePenalty: 0.3,
      partialPenalty: 0.05,
    },
    evaluatedAt: Date.now(),
  };

  const decision = gate.decide(evaluation);

  assert.equal(decision.accepted, false);
  assert.equal(decision.releaseStage, "repair");
  assert.deepEqual(decision.reasonCodes, ["quality.repair_required", "quality.retry_required"]);
});

test("PostExecutionQualityGate decides repair when nextAction is replan", () => {
  const gate = new PostExecutionQualityGate();
  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_123",
    taskId: "task_456",
    nextAction: "replan",
    passed: false,
    qualityScore: 0.3,
    reasons: ["replan_required"],
    factorBreakdown: {
      successSignals: 1,
      failureSignals: 4,
      partialSignals: 1,
      completionBonus: 0,
      failurePenalty: 0.4,
      partialPenalty: 0.05,
    },
    evaluatedAt: Date.now(),
  };

  const decision = gate.decide(evaluation);

  assert.equal(decision.accepted, false);
  assert.equal(decision.releaseStage, "repair");
  assert.deepEqual(decision.reasonCodes, ["quality.repair_required", "quality.replan_required"]);
});

test("PostExecutionQualityGate decides blocked for unknown nextAction", () => {
  const gate = new PostExecutionQualityGate();
  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_123",
    taskId: "task_456",
    nextAction: "escalate",
    passed: false,
    qualityScore: 0.2,
    reasons: [],
    factorBreakdown: {
      successSignals: 0,
      failureSignals: 5,
      partialSignals: 1,
      completionBonus: 0,
      failurePenalty: 0.5,
      partialPenalty: 0.05,
    },
    evaluatedAt: Date.now(),
  };

  const decision = gate.decide(evaluation);

  assert.equal(decision.accepted, false);
  assert.equal(decision.releaseStage, "blocked");
  assert.deepEqual(decision.reasonCodes, ["quality.blocked", "quality.escalate"]);
});

test("PostExecutionQualityGate handles evaluation with passed false and complete action", () => {
  const gate = new PostExecutionQualityGate();
  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_999",
    taskId: "task_888",
    nextAction: "complete",
    passed: false,
    qualityScore: 0.55,
    reasons: ["partial_failure"],
    factorBreakdown: {
      successSignals: 2,
      failureSignals: 1,
      partialSignals: 3,
      completionBonus: 0.05,
      failurePenalty: 0.1,
      partialPenalty: 0.15,
    },
    evaluatedAt: Date.now(),
  };

  const decision = gate.decide(evaluation);

  assert.equal(decision.accepted, false);
  assert.equal(decision.releaseStage, "blocked");
  assert.deepEqual(decision.reasonCodes, ["quality.blocked"]);
});

test("PostExecutionQualityGate returns correct reason codes per release stage", () => {
  const gate = new PostExecutionQualityGate();

  // Test released
  const releasedEval: ExecutionOutcomeEvaluation = {
    evaluationId: "e1",
    taskId: "t1",
    nextAction: "complete",
    passed: true,
    qualityScore: 0.9,
    reasons: [],
    factorBreakdown: {
      successSignals: 5,
      failureSignals: 0,
      partialSignals: 0,
      completionBonus: 0.1,
      failurePenalty: 0,
      partialPenalty: 0,
    },
    evaluatedAt: Date.now(),
  };
  assert.equal(gate.decide(releasedEval).reasonCodes[0], "quality.accepted");

  // Test approval
  const approvalEval: ExecutionOutcomeEvaluation = {
    evaluationId: "e2",
    taskId: "t2",
    nextAction: "approve",
    passed: false,
    qualityScore: 0.6,
    reasons: [],
    factorBreakdown: {
      successSignals: 3,
      failureSignals: 1,
      partialSignals: 2,
      completionBonus: 0,
      failurePenalty: 0.1,
      partialPenalty: 0.1,
    },
    evaluatedAt: Date.now(),
  };
  assert.equal(gate.decide(approvalEval).reasonCodes[0], "quality.approval_required");

  // Test repair
  const repairEval: ExecutionOutcomeEvaluation = {
    evaluationId: "e3",
    taskId: "t3",
    nextAction: "retry",
    passed: false,
    qualityScore: 0.4,
    reasons: [],
    factorBreakdown: {
      successSignals: 2,
      failureSignals: 3,
      partialSignals: 1,
      completionBonus: 0,
      failurePenalty: 0.3,
      partialPenalty: 0.05,
    },
    evaluatedAt: Date.now(),
  };
  assert.equal(gate.decide(repairEval).reasonCodes[0], "quality.repair_required");

  // Test blocked
  const blockedEval: ExecutionOutcomeEvaluation = {
    evaluationId: "e4",
    taskId: "t4",
    nextAction: "escalate",
    passed: false,
    qualityScore: 0.1,
    reasons: [],
    factorBreakdown: {
      successSignals: 0,
      failureSignals: 5,
      partialSignals: 1,
      completionBonus: 0,
      failurePenalty: 0.5,
      partialPenalty: 0.05,
    },
    evaluatedAt: Date.now(),
  };
  assert.equal(gate.decide(blockedEval).reasonCodes[0], "quality.blocked");
});

test("PostExecutionQualityGate returns multiple reason codes when applicable", () => {
  const gate = new PostExecutionQualityGate();
  const evaluation: ExecutionOutcomeEvaluation = {
    evaluationId: "eval_multi",
    taskId: "task_multi",
    nextAction: "complete",
    passed: true,
    qualityScore: 0.95,
    reasons: ["high_quality", "low_latency"],
    factorBreakdown: {
      successSignals: 10,
      failureSignals: 0,
      partialSignals: 0,
      completionBonus: 0.15,
      failurePenalty: 0,
      partialPenalty: 0,
    },
    evaluatedAt: Date.now(),
  };

  const decision = gate.decide(evaluation);

  assert.equal(decision.accepted, true);
  assert.ok(decision.reasonCodes.includes("quality.accepted"));
});
