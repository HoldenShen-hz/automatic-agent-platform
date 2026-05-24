import test from "node:test";
import assert from "node:assert/strict";

import { createPlanGraphBundle } from "../../../../../src/platform/contracts/executable-contracts/index.js";
import { ExecutionOutcomeEvaluator } from "../../../../../src/platform/prompt-engine/eval/execution-outcome-evaluator.js";
import { PostExecutionQualityGate } from "../../../../../src/platform/prompt-engine/eval/post-execution-quality-gate.js";
import type { QualityGateConfig } from "../../../../../src/platform/prompt-engine/eval/types.js";

const plan = createPlanGraphBundle({
  planGraphBundleId: "plan-bundle-1",
  harnessRunId: "harness-run-1",
  graph: {
    graphId: "graph-1",
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
    graphHash: "graph-hash-1",
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

function createDefaultConfig(): QualityGateConfig {
  return {
    qualityGate: {
      defaultPassThreshold: 0.5,
      criticalPassThreshold: 0.8,
      enforcement: "blocking",
    },
    qualityScoreWeights: {
      // R34-15 fix: weights must sum to 1.0 (was 1.2) to preserve resolution
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
}

test("ExecutionOutcomeEvaluator and PostExecutionQualityGate accept successful feedback", () => {
  const evaluator = new ExecutionOutcomeEvaluator();
  const gate = new PostExecutionQualityGate();
  const evaluation = evaluator.evaluate(plan, {
    feedbackId: "fb_1",
    taskId: "task_1",
    executionId: null,
    planId: "plan_1",
    outcome: "completed",
    signals: [
      {
        signalId: "sig_1",
        source: "execution",
        taskId: "task_1",
        category: "success",
        severity: "info",
        payload: {
          summary: "patch validated",
        },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
    emittedAt: Date.now(),
  } as any);

  assert.equal(evaluation.passed, true);
  assert.equal(gate.decide(evaluation).releaseStage, "released");
});

test("ExecutionOutcomeEvaluator returns failure for failed outcome with failure signals", () => {
  const evaluator = new ExecutionOutcomeEvaluator();
  const evaluation = evaluator.evaluate(plan, {
    feedbackId: "fb_2",
    taskId: "task_1",
    executionId: null,
    planId: "plan_1",
    outcome: "failed",
    signals: [
      {
        signalId: "sig_2",
        source: "execution",
        taskId: "task_1",
        category: "failure",
        severity: "error",
        payload: {
          summary: "deployment failed",
          reasonCode: "deploy.timeout",
        },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
    emittedAt: Date.now(),
  } as any);

  assert.equal(evaluation.passed, false);
  assert.equal(evaluation.nextAction, "retry");
  assert.ok(evaluation.reasons.some((r) => r.includes("failure")));
});

test("ExecutionOutcomeEvaluator triggers replan for repairable outcome", () => {
  const evaluator = new ExecutionOutcomeEvaluator();
  const evaluation = evaluator.evaluate(plan, {
    feedbackId: "fb_3",
    taskId: "task_1",
    executionId: null,
    planId: "plan_1",
    outcome: "repairable",
    signals: [],
    emittedAt: Date.now(),
  } as any);

  assert.equal(evaluation.nextAction, "replan");
});

test("ExecutionOutcomeEvaluator handles partial signals correctly", () => {
  const evaluator = new ExecutionOutcomeEvaluator();
  const evaluation = evaluator.evaluate(plan, {
    feedbackId: "fb_4",
    taskId: "task_1",
    executionId: null,
    planId: "plan_1",
    outcome: "completed",
    signals: [
      {
        signalId: "sig_4a",
        source: "execution",
        taskId: "task_1",
        category: "success",
        severity: "info",
        payload: { summary: "step 1 ok" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
      {
        signalId: "sig_4b",
        source: "execution",
        taskId: "task_1",
        category: "partial",
        severity: "warning",
        payload: { summary: "partial output" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
    emittedAt: Date.now(),
  } as any);

  assert.equal(evaluation.nextAction, "complete");
  assert.ok(evaluation.qualityScore < 1.0);
});

test("ExecutionOutcomeEvaluator routes partial outcomes to approve without escalating", () => {
  const evaluator = new ExecutionOutcomeEvaluator();
  const evaluation = evaluator.evaluate(plan, {
    feedbackId: "fb_partial_approve",
    taskId: "task_1",
    executionId: null,
    planId: "plan_1",
    outcome: "partial",
    signals: [
      {
        signalId: "sig_partial_approve",
        source: "validation",
        taskId: "task_1",
        category: "partial",
        severity: "warning",
        payload: { summary: "partial output", reasonCode: "validation.partial_completion" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
    emittedAt: Date.now(),
  } as any);

  assert.equal(evaluation.nextAction, "approve");
  assert.equal(evaluation.verdict, "approve");
});

test("ExecutionOutcomeEvaluator routes to approve when approval signal is present", () => {
  const evaluator = new ExecutionOutcomeEvaluator();
  const evaluation = evaluator.evaluate(plan, {
    feedbackId: "fb_5",
    taskId: "task_1",
    executionId: null,
    planId: "plan_1",
    outcome: "failed",
    signals: [
      {
        signalId: "sig_5",
        source: "execution",
        taskId: "task_1",
        category: "failure",
        severity: "error",
        payload: {
          summary: "needs approval",
          reasonCode: "approval.required",
        },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
    emittedAt: Date.now(),
  } as any);

  assert.equal(evaluation.nextAction, "approve");
  assert.equal(evaluation.verdict, "approve");
});

test("ExecutionOutcomeEvaluator uses configurable thresholds - higher pass threshold", () => {
  const config: QualityGateConfig = {
    qualityGate: {
      defaultPassThreshold: 0.81,
      criticalPassThreshold: 0.9,
      enforcement: "blocking",
    },
    qualityScoreWeights: {
      // R34-15 fix: weights must sum to 1.0 (was 1.2) to preserve resolution
      successSignal: 0.3,
      completionOutcome: 0.4,
      failureSignal: 0.2,
      partialSignal: 0.1,
    },
    actionThresholds: {
      completeMinScore: 0.8,
      approvalRequiredScore: 0.5,
      retryMaxFailures: 3,
    },
    evidence: {
      enabled: false,
      artifactKind: "quality-evaluation",
      retentionDays: 90,
    },
  };

  const evaluator = new ExecutionOutcomeEvaluator({ config });
  const evaluation = evaluator.evaluate(plan, {
    feedbackId: "fb_6",
    taskId: "task_1",
    executionId: null,
    planId: "plan_1",
    outcome: "completed",
    signals: [
      {
        signalId: "sig_6",
        source: "execution",
        taskId: "task_1",
        category: "success",
        severity: "info",
        payload: { summary: "single success" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
    emittedAt: Date.now(),
  } as any);

  assert.equal(evaluation.nextAction, "approve");
  assert.equal(evaluation.passed, false);
  // R34-15 fix: weights 0.3 + 0.4 = 0.7, not 0.8
  assert.equal(evaluation.qualityScore, 0.7);
});

test("ExecutionOutcomeEvaluator uses configurable weights", () => {
  const config: QualityGateConfig = {
    qualityGate: {
      defaultPassThreshold: 0.5,
      criticalPassThreshold: 0.8,
      enforcement: "blocking",
    },
    qualityScoreWeights: {
      successSignal: 0.1,
      completionOutcome: 0.9,
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
  const evaluation = evaluator.evaluate(plan, {
    feedbackId: "fb_7",
    taskId: "task_1",
    executionId: null,
    planId: "plan_1",
    outcome: "completed",
    signals: [
      {
        signalId: "sig_7",
        source: "execution",
        taskId: "task_1",
        category: "success",
        severity: "info",
        payload: { summary: "ok" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
    emittedAt: Date.now(),
  } as any);

  assert.equal(evaluation.qualityScore, 1.0);
  assert.equal(evaluation.passed, true);
});

test("ExecutionOutcomeEvaluator provides factor breakdown", () => {
  const evaluator = new ExecutionOutcomeEvaluator();
  const evaluation = evaluator.evaluate(plan, {
    feedbackId: "fb_8",
    taskId: "task_1",
    executionId: null,
    planId: "plan_1",
    outcome: "completed",
    signals: [
      {
        signalId: "sig_8a",
        source: "execution",
        taskId: "task_1",
        category: "success",
        severity: "info",
        payload: { summary: "ok" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
      {
        signalId: "sig_8b",
        source: "execution",
        taskId: "task_1",
        category: "failure",
        severity: "error",
        payload: { summary: "error" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
    emittedAt: Date.now(),
  } as any);

  assert.equal(evaluation.factorBreakdown.successSignals, 1);
  assert.equal(evaluation.factorBreakdown.failureSignals, 1);
  assert.equal(evaluation.factorBreakdown.completionBonus, 0.4);
  assert.equal(evaluation.factorBreakdown.failurePenalty, 0.2);
});

test("ExecutionOutcomeEvaluator escalates after max retries", () => {
  const config: QualityGateConfig = {
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
      retryMaxFailures: 2,
    },
    evidence: {
      enabled: false,
      artifactKind: "quality-evaluation",
      retentionDays: 90,
    },
  };

  const evaluator = new ExecutionOutcomeEvaluator({ config });
  const evaluation = evaluator.evaluate(plan, {
    feedbackId: "fb_9",
    taskId: "task_1",
    executionId: null,
    planId: "plan_1",
    outcome: "failed",
    signals: [
      {
        signalId: "sig_9a",
        source: "execution",
        taskId: "task_1",
        category: "failure",
        severity: "error",
        payload: { summary: "fail 1" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
      {
        signalId: "sig_9b",
        source: "execution",
        taskId: "task_1",
        category: "failure",
        severity: "error",
        payload: { summary: "fail 2" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
      {
        signalId: "sig_9c",
        source: "execution",
        taskId: "task_1",
        category: "failure",
        severity: "error",
        payload: { summary: "fail 3" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
    emittedAt: Date.now(),
  } as any);

  assert.equal(evaluation.nextAction, "escalate");
});

// R34-15: Verify quality score weights sum to 1.0 to preserve resolution
test("ExecutionOutcomeEvaluator weights sum to 1.0", () => {
  const evaluator = new ExecutionOutcomeEvaluator();
  const evaluation = evaluator.evaluate(plan, {
    feedbackId: "fb_weight_test",
    taskId: "task_1",
    executionId: null,
    planId: "plan_1",
    outcome: "completed",
    signals: [
      {
        signalId: "sig_w1",
        source: "execution",
        taskId: "task_1",
        category: "success",
        severity: "info",
        payload: { summary: "ok" },
        stepOutputRefs: [],
        timestamp: Date.now(),
      },
    ],
    emittedAt: Date.now(),
  } as any);

  // With weights summing to 1.0 (0.3 successSignal + 0.4 completionOutcome):
  // qualityScore should be 0.7, not clamped to 0.8
  assert.equal(evaluation.qualityScore, 0.7);
  assert.equal(evaluation.passed, true); // 0.7 >= medium risk threshold
});
