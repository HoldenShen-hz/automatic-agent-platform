import test from "node:test";
import assert from "node:assert/strict";

import { ExecutionOutcomeEvaluator } from "../../../../../src/platform/prompt-engine/eval/execution-outcome-evaluator.js";
import { PostExecutionQualityGate } from "../../../../../src/platform/prompt-engine/eval/post-execution-quality-gate.js";

const plan = {
  planId: "plan_1",
  taskId: "task_1",
  assessmentRef: "assessment:task_1:1",
  version: 1,
  strategy: "linear" as const,
  steps: [
    {
      stepId: "step_1",
      action: "execute",
      title: "execute",
      inputs: {},
      outputs: [],
      dependencies: [],
      status: "pending" as const,
      timeout: 1000,
      retryPolicy: {
        maxRetries: 0,
        backoffMs: 0,
      },
    },
  ],
  createdAt: Date.now(),
};

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
  });

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
  });

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
  });

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
  });

  assert.equal(evaluation.nextAction, "complete");
  assert.ok(evaluation.qualityScore < 1.0);
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
  });

  assert.equal(evaluation.nextAction, "approve");
});
