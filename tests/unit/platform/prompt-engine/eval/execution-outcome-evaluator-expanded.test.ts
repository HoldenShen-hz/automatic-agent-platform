/**
 * Execution Outcome Evaluator Expanded Tests
 *
 * Expanded tests for execution-outcome-evaluator covering:
 * - Issue #1961: Quality score weights sum 1.2>1.0, clamp loses resolution
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createPlanGraphBundle } from "../../../../../src/platform/contracts/executable-contracts/index.js";
import { ExecutionOutcomeEvaluator } from "../../../../../src/platform/prompt-engine/eval/execution-outcome-evaluator.js";
import type { QualityGateConfig } from "../../../../../src/platform/prompt-engine/eval/types.js";

const plan = createPlanGraphBundle({
  planGraphBundleId: "plan-bundle-expanded",
  harnessRunId: "harness-run-expanded",
  graph: {
    graphId: "graph-expanded",
    nodes: [{
      nodeId: "node-1",
      nodeType: "tool",
      inputRefs: [],
      outputSchemaRef: "schema:test.output",
      riskClass: "medium",
      budgetIntent: { amount: 1, currency: "USD", resourceKinds: ["token"] },
      sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
      retryPolicyRef: "retry:default",
      timeoutMs: 1000,
    }],
    edges: [],
    entryNodeIds: ["node-1"],
    terminalNodeIds: ["node-1"],
    joinStrategy: "all",
    graphHash: "graph-hash-expanded",
  },
  schedulerPolicy: {
    policyId: "scheduler:test",
    strategy: "deterministic_fifo",
  },
  budgetPlanRef: "budget:test",
  riskProfile: {
    riskClass: "medium",
    reasons: ["test"],
  },
  validationReport: { valid: true, findings: [] },
  artifactRefs: [],
  createdAt: "2026-05-24T00:00:00.000Z",
});

// Issue #1961: Weights that sum > 1.0 should still work but with potential resolution loss
test("ExecutionOutcomeEvaluator handles weights that sum greater than 1.0", () => {
  const config: QualityGateConfig = {
    qualityGate: {
      defaultPassThreshold: 0.5,
      criticalPassThreshold: 0.8,
      enforcement: "blocking",
    },
    qualityScoreWeights: {
      successSignal: 0.5,    // 0.5
      completionOutcome: 0.5, // +0.5 = 1.0
      failureSignal: 0.3,    // +0.3 = 1.3 (already > 1)
      partialSignal: 0.1,     // +0.1 = 1.4
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

  const evaluator = new ExecutionOutcomeEvaluator({ config });

  // Single success signal
  const result = evaluator.evaluate(plan, {
    feedbackId: "fb_weight_test",
    taskId: "task_expanded",
    executionId: null,
    planId: "plan_expanded",
    outcome: "completed",
    signals: [
      {
        signalId: "sig_success",
        source: "execution",
        taskId: "task_expanded",
        category: "success",
        severity: "info",
        payload: { summary: "task completed" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
    emittedAt: Date.now(),
  } as any);

  // Quality score should be clamped to max of 1.0
  assert.ok(result.qualityScore <= 1.0, `Quality score ${result.qualityScore} should be <= 1.0`);
  // With weights summing to 1.4 and only success signal, score would be 0.5 (success) + 0.5 (completion) = 1.0, clamped
  assert.equal(result.qualityScore, 1.0);
});

test("ExecutionOutcomeEvaluator with extreme weights still produces valid scores", () => {
  const config: QualityGateConfig = {
    qualityGate: {
      defaultPassThreshold: 0.5,
      criticalPassThreshold: 0.8,
      enforcement: "blocking",
    },
    qualityScoreWeights: {
      successSignal: 0.1,
      completionOutcome: 0.9,
      failureSignal: 0.8,    // High failure penalty
      partialSignal: 0.5,
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

  const evaluator = new ExecutionOutcomeEvaluator({ config });

  // Failure signals should dominate
  const result = evaluator.evaluate(plan, {
    feedbackId: "fb_extreme",
    taskId: "task_extreme",
    executionId: null,
    planId: "plan_extreme",
    outcome: "failed",
    signals: [
      {
        signalId: "sig_fail",
        source: "execution",
        taskId: "task_extreme",
        category: "failure",
        severity: "error",
        payload: { summary: "task failed" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
    emittedAt: Date.now(),
  } as any);

  // Score should still be >= 0 due to Math.max(0, ...)
  assert.ok(result.qualityScore >= 0);
  assert.equal(result.passed, false);
});

test("ExecutionOutcomeEvaluator factor breakdown reflects weights correctly", () => {
  const config: QualityGateConfig = {
    qualityGate: {
      defaultPassThreshold: 0.5,
      criticalPassThreshold: 0.8,
      enforcement: "blocking",
    },
    qualityScoreWeights: {
      successSignal: 0.4,
      completionOutcome: 0.5,
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

  const evaluator = new ExecutionOutcomeEvaluator({ config });

  const result = evaluator.evaluate(plan, {
    feedbackId: "fb_breakdown",
    taskId: "task_breakdown",
    executionId: null,
    planId: "plan_breakdown",
    outcome: "completed",
    signals: [
      {
        signalId: "sig_1",
        source: "execution",
        taskId: "task_breakdown",
        category: "success",
        severity: "info",
        payload: { summary: "ok" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
      {
        signalId: "sig_2",
        source: "execution",
        taskId: "task_breakdown",
        category: "failure",
        severity: "error",
        payload: { summary: "error" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
    emittedAt: Date.now(),
  } as any);

  // Factor breakdown should reflect actual weights
  assert.equal(result.factorBreakdown.successSignals, 1);
  assert.equal(result.factorBreakdown.failureSignals, 1);
  assert.equal(result.factorBreakdown.completionBonus, 0.5);  // completionOutcome weight
  assert.equal(result.factorBreakdown.failurePenalty, 0.3);  // failureSignal weight
});

test("ExecutionOutcomeEvaluator calculates quality score with multiple signals", () => {
  const config: QualityGateConfig = {
    qualityGate: {
      defaultPassThreshold: 0.5,
      criticalPassThreshold: 0.8,
      enforcement: "blocking",
    },
    qualityScoreWeights: {
      successSignal: 0.2,
      completionOutcome: 0.4,
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

  const evaluator = new ExecutionOutcomeEvaluator({ config });

  const result = evaluator.evaluate(plan, {
    feedbackId: "fb_multi",
    taskId: "task_multi",
    executionId: null,
    planId: "plan_multi",
    outcome: "completed",
    signals: [
      { signalId: "sig_1", source: "execution", taskId: "task_multi", category: "success", severity: "info", payload: { summary: "ok1" }, stepOutputRefs: [], timestamp: Date.now() },
      { signalId: "sig_2", source: "execution", taskId: "task_multi", category: "success", severity: "info", payload: { summary: "ok2" }, stepOutputRefs: [], timestamp: Date.now() },
      { signalId: "sig_3", source: "execution", taskId: "task_multi", category: "partial", severity: "warning", payload: { summary: "partial" }, stepOutputRefs: [], timestamp: Date.now() },
    ],
    emittedAt: Date.now(),
  } as any);

  // 2 success = 0.4, completion = 0.4, partial penalty = 0.1 = 0.7
  // May be clamped if exceeds 1.0
  assert.ok(result.qualityScore >= 0);
  assert.ok(result.qualityScore <= 1.0);
});

test("ExecutionOutcomeEvaluator handles all signal types together", () => {
  const evaluator = new ExecutionOutcomeEvaluator();

  const result = evaluator.evaluate(plan, {
    feedbackId: "fb_all_types",
    taskId: "task_all_types",
    executionId: null,
    planId: "plan_all_types",
    outcome: "completed",
    signals: [
      { signalId: "sig_s1", source: "execution", taskId: "task_all_types", category: "success", severity: "info", payload: { summary: "s1" }, stepOutputRefs: [], timestamp: Date.now() },
      { signalId: "sig_s2", source: "execution", taskId: "task_all_types", category: "success", severity: "info", payload: { summary: "s2" }, stepOutputRefs: [], timestamp: Date.now() },
      { signalId: "sig_f1", source: "execution", taskId: "task_all_types", category: "failure", severity: "error", payload: { summary: "f1" }, stepOutputRefs: [], timestamp: Date.now() },
      { signalId: "sig_p1", source: "execution", taskId: "task_all_types", category: "partial", severity: "warning", payload: { summary: "p1" }, stepOutputRefs: [], timestamp: Date.now() },
    ],
    emittedAt: Date.now(),
  } as any);

  // All signal types should be counted
  assert.equal(result.factorBreakdown.successSignals, 2);
  assert.equal(result.factorBreakdown.failureSignals, 1);
  assert.equal(result.factorBreakdown.partialSignals, 1);
  assert.equal(result.factorBreakdown.completionBonus, 0.4); // default weight
  assert.equal(result.factorBreakdown.failurePenalty, 0.2);  // default weight
  assert.equal(result.factorBreakdown.partialPenalty, 0.1);  // default weight
});

test("ExecutionOutcomeEvaluator with timeout signals", () => {
  const evaluator = new ExecutionOutcomeEvaluator();

  const result = evaluator.evaluate(plan, {
    feedbackId: "fb_timeout",
    taskId: "task_timeout",
    executionId: null,
    planId: "plan_timeout",
    outcome: "failed",
    signals: [
      {
        signalId: "sig_timeout",
        source: "execution",
        taskId: "task_timeout",
        category: "timeout",
        severity: "error",
        payload: { summary: "operation timed out" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
    emittedAt: Date.now(),
  } as any);

  // Timeout is treated as failure
  assert.equal(result.factorBreakdown.failureSignals, 1);
  assert.equal(result.nextAction, "retry");
});

test("ExecutionOutcomeEvaluator getConfig returns current configuration", () => {
  const config: QualityGateConfig = {
    qualityGate: {
      defaultPassThreshold: 0.75,
      criticalPassThreshold: 0.95,
      enforcement: "warning",
    },
    qualityScoreWeights: {
      successSignal: 0.25,
      completionOutcome: 0.55,
      failureSignal: 0.35,
      partialSignal: 0.15,
    },
    actionThresholds: {
      completeMinScore: 0.6,
      approvalRequiredScore: 0.4,
      retryMaxFailures: 5,
    },
    evidence: {
      enabled: true,
      artifactKind: "custom-quality",
      retentionDays: 60,
    },
  };

  const evaluator = new ExecutionOutcomeEvaluator({ config });
  const retrievedConfig = evaluator.getConfig();

  assert.equal(retrievedConfig.qualityGate.defaultPassThreshold, 0.75);
  assert.equal(retrievedConfig.qualityGate.criticalPassThreshold, 0.95);
  assert.equal(retrievedConfig.actionThresholds.retryMaxFailures, 5);
});

test("ExecutionOutcomeEvaluator returns evaluationId in result", () => {
  const evaluator = new ExecutionOutcomeEvaluator();

  const result = evaluator.evaluate(plan, {
    feedbackId: "fb_id",
    taskId: "task_id",
    executionId: null,
    planId: "plan_id",
    outcome: "completed",
    signals: [],
    emittedAt: Date.now(),
  } as any);

  // Evaluation ID should be present and valid
  assert.ok(result.evaluationId.startsWith("outcome_eval_") || result.evaluationId.length > 0);
});

test("ExecutionOutcomeEvaluator constraint compliance returns correct structure", () => {
  const evaluator = new ExecutionOutcomeEvaluator();

  const result = evaluator.evaluate(plan, {
    feedbackId: "fb_constraints",
    taskId: "task_constraints",
    executionId: null,
    planId: "plan_constraints",
    outcome: "completed",
    signals: [],
    emittedAt: Date.now(),
  }, undefined, undefined, undefined);

  // Should have constraint compliance result
  assert.ok(result.constraintCompliance !== undefined);
  assert.ok(typeof result.constraintCompliance.compliant === "boolean");
});

test("ExecutionOutcomeEvaluator budget adherence with actual cost", () => {
  const evaluator = new ExecutionOutcomeEvaluator();

  const result = evaluator.evaluate(plan, {
    feedbackId: "fb_budget",
    taskId: "task_budget",
    executionId: null,
    planId: "plan_budget",
    outcome: "completed",
    signals: [],
    emittedAt: Date.now(),
  }, undefined, 0.05);

  // Should have budget adherence result
  assert.ok(result.budgetAdherence !== undefined);
  assert.ok(typeof result.budgetAdherence.adherent === "boolean");
});

test("ExecutionOutcomeEvaluator timing SLO with actual duration", () => {
  const evaluator = new ExecutionOutcomeEvaluator();

  const result = evaluator.evaluate(plan, {
    feedbackId: "fb_timing",
    taskId: "task_timing",
    executionId: null,
    planId: "plan_timing",
    outcome: "completed",
    signals: [],
    emittedAt: Date.now(),
  }, 60000); // 1 minute

  // Should have timing SLO result
  assert.ok(result.timingSlo !== undefined);
  assert.ok(typeof result.timingSlo.withinSlo === "boolean");
});
