import assert from "node:assert/strict";
import test from "node:test";

import { EvaluatorService } from "../../../../../src/platform/five-plane-orchestration/evaluator/evaluator-service.js";
import type { PlanGraphBundle } from "../../../../../src/platform/contracts/executable-contracts/index.js";
import type { FeedbackBatch } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function makePlanGraphBundle(overrides: Partial<Record<string, unknown>> = {}): PlanGraphBundle {
  return {
    harnessRunId: "hrun-1",
    planGraphBundleId: "bundle-1",
    graphVersion: 1,
    riskProfile: { riskClass: "medium" },
    budgetPlanRef: "budget-1",
    ...overrides,
  } as unknown as PlanGraphBundle;
}

function makeFeedbackSignal(overrides: Partial<FeedbackBatch["signals"][number]> = {}): FeedbackBatch["signals"][number] {
  return {
    signalId: "signal-1",
    taskId: "task-1",
    source: "execution",
    category: "success",
    severity: "info",
    payload: {},
    stepOutputRefs: [],
    timestamp: 1_717_000_000_000,
    trustFactors: {
      sourceReliability: 0.8,
      historicalAccuracy: 0.8,
      authenticatedSource: true,
      attackSurfaceExposure: 0.1,
      holdoutOverlap: 0,
    },
    feedbackTrustScore: 0.8,
    ...overrides,
  };
}

function makeFeedbackBatch(overrides: Partial<FeedbackBatch> = {}): FeedbackBatch {
  return {
    feedbackId: overrides.feedbackId ?? "feedback-1",
    batchId: overrides.batchId,
    taskId: overrides.taskId ?? "task-1",
    executionId: overrides.executionId ?? null,
    planId: overrides.planId ?? null,
    outcome: overrides.outcome ?? "completed",
    signals: overrides.signals ?? [makeFeedbackSignal()],
    emittedAt: overrides.emittedAt ?? 1_717_000_000_000,
  };
}

test("EvaluatorService accepts successful completed feedback", () => {
  const service = new EvaluatorService();

  const report = service.evaluate({
    planGraphBundle: makePlanGraphBundle(),
    feedback: makeFeedbackBatch(),
    actualDurationMs: 1_000,
    actualCost: 5,
  });

  assert.equal(report.decision, "accept");
  assert.equal(report.passed, true);
  assert.equal(report.riskLevel, "unchanged");
  assert.ok(report.findings.some((finding) => finding.category === "budget"));
});

test("EvaluatorService retries recoverable failure batches", () => {
  const service = new EvaluatorService();

  const report = service.evaluate({
    planGraphBundle: makePlanGraphBundle({ riskProfile: { riskClass: "low" } }),
    feedback: makeFeedbackBatch({
      outcome: "failed",
      signals: [
        makeFeedbackSignal({ category: "failure", severity: "error" }),
      ],
    }),
  });

  assert.equal(report.decision, "replan");
  assert.equal(report.passed, false);
  assert.equal(report.riskLevel, "elevated");
});

test("EvaluatorService replans when failures also elevate risk", () => {
  const service = new EvaluatorService();

  const report = service.evaluate({
    planGraphBundle: makePlanGraphBundle({ riskProfile: { riskClass: "high" } }),
    feedback: makeFeedbackBatch({
      outcome: "failed",
      signals: [
        makeFeedbackSignal({ category: "failure", severity: "error" }),
        makeFeedbackSignal({ signalId: "signal-2", category: "failure", severity: "error" }),
      ],
    }),
    actualDurationMs: 10_000,
  });

  assert.equal(report.decision, "escalate");
  assert.equal(report.riskLevel, "elevated");
  assert.ok(report.findings.some((finding) => finding.category === "risk" && finding.severity === "critical"));
});

test("EvaluatorService escalates critical findings and approves partial outcomes", () => {
  const service = new EvaluatorService();

  const escalated = service.evaluate({
    planGraphBundle: makePlanGraphBundle(),
    feedback: makeFeedbackBatch({
      outcome: "failed",
      signals: [makeFeedbackSignal({ category: "timeout", severity: "critical" })],
    }),
  });
  const approved = service.evaluate({
    planGraphBundle: makePlanGraphBundle({ budgetPlanRef: undefined }),
    feedback: makeFeedbackBatch({
      outcome: "partial",
      signals: [makeFeedbackSignal({ category: "partial", severity: "warning" })],
    }),
  });

  assert.equal(escalated.decision, "escalate");
  assert.equal(approved.decision, "approve");
});
