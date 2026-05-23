import assert from "node:assert/strict";
import test from "node:test";

import { createMinimalPlanGraphBundle } from "../../../helpers/fixtures/base.js";
import { EvaluatorService } from "../../../../src/platform/five-plane-orchestration/evaluator/evaluator-service.js";
import type { FeedbackBatch } from "../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function createFeedbackTrust() {
  return {
    feedbackTrustScore: 0.5,
    trustFactors: {
      sourceReliability: 0.5,
      historicalAccuracy: 0.5,
      authenticatedSource: false,
      attackSurfaceExposure: 0.5,
      holdoutOverlap: 0,
    },
  };
}

function createFeedback(overrides: Partial<FeedbackBatch> = {}): FeedbackBatch {
  return {
    feedbackId: "feedback-e2e-001",
    taskId: "task-e2e-001",
    executionId: null,
    planId: null,
    outcome: "completed",
    emittedAt: Date.now(),
    signals: [],
    ...overrides,
  };
}

test("E2E Evaluator: accepts a clean successful feedback batch", () => {
  const service = new EvaluatorService();
  const bundle = createMinimalPlanGraphBundle("hrun-eval-accept");

  const report = service.evaluate({
    planGraphBundle: bundle,
    feedback: createFeedback({
      signals: [
        {
          signalId: "sig-success",
          taskId: "task-e2e-001",
          source: "execution",
          category: "success",
          severity: "info",
          payload: { summary: "step completed" },
          stepOutputRefs: [],
          timestamp: Date.now(),
          ...createFeedbackTrust(),
        },
      ],
    }),
  });

  assert.equal(report.passed, true);
  assert.equal(report.decision, "accept");
  assert.ok(report.qualityScore >= 0.7);
});

test("E2E Evaluator: converts failure signals into a non-accept decision", () => {
  const service = new EvaluatorService();
  const bundle = createMinimalPlanGraphBundle("hrun-eval-fail");

  const report = service.evaluate({
    planGraphBundle: bundle,
    feedback: createFeedback({
      outcome: "failed",
      signals: [
        {
          signalId: "sig-failure",
          taskId: "task-e2e-002",
          source: "execution",
          category: "failure",
          severity: "error",
          payload: { reasonCode: "timeout" },
          stepOutputRefs: [],
          timestamp: Date.now(),
          ...createFeedbackTrust(),
        },
      ],
    }),
  });

  assert.equal(report.passed, false);
  assert.notEqual(report.decision, "accept");
  assert.ok(report.findings.some((finding) => finding.category === "quality"));
});

test("E2E Evaluator: emits budget findings when actual cost exceeds the plan", () => {
  const service = new EvaluatorService();
  const bundle = createMinimalPlanGraphBundle("hrun-eval-budget");

  const report = service.evaluate({
    planGraphBundle: bundle,
    feedback: createFeedback(),
    actualCost: 999,
  });

  const budgetFinding = report.findings.find((finding) => finding.category === "budget");
  assert.ok(budgetFinding);
  assert.equal(budgetFinding.severity, "info");
  assert.ok(budgetFinding.message.includes("cost consumed"));
});
