import assert from "node:assert/strict";
import test from "node:test";

import { nowIso } from "../../../src/platform/contracts/types/ids.js";
import { FeedbackCollector } from "../../../src/scale-ecosystem/feedback-loop/collector/feedback-collector.js";
import { FeedbackImprovementService } from "../../../src/scale-ecosystem/feedback-loop/feedback-improvement-service.js";
import { FeedbackQualityGrader } from "../../../src/scale-ecosystem/feedback-loop/quality-grader.js";
import type { FeedbackSignal } from "../../../src/platform/five-plane-orchestration/oapeflir/types/feedback-signal.js";

function createSignal(overrides: Partial<FeedbackSignal> = {}): FeedbackSignal {
  return {
    signalId: overrides.signalId ?? "signal-001",
    taskId: overrides.taskId ?? "task-001",
    source: overrides.source ?? "user",
    category: overrides.category ?? "correction",
    severity: overrides.severity ?? "warning",
    payload: overrides.payload ?? { summary: "Operator corrected the output", reasonCode: "correction" },
    stepOutputRefs: overrides.stepOutputRefs ?? ["step-output-1"],
    timestamp: overrides.timestamp ?? Date.now(),
    trustFactors: overrides.trustFactors ?? {
      sourceReliability: 1,
      historicalAccuracy: 1,
      authenticatedSource: true,
      attackSurfaceExposure: 0,
      holdoutOverlap: 0,
    },
    feedbackTrustScore: overrides.feedbackTrustScore ?? 1,
    trustScore: overrides.trustScore,
  };
}

test("E2E FeedbackLoop: collector normalizes duplicate signals", () => {
  const collector = new FeedbackCollector();
  const feedback = collector.collect({
    taskId: "task-feedback-dedupe",
    signals: [
      createSignal({ signalId: "sig-a" }),
      createSignal({ signalId: "sig-b" }),
    ],
  });

  assert.equal(feedback.signals.length, 1);
  assert.match(feedback.signals[0]!.signalId, /sig-a|sig-b/);
});

test("E2E FeedbackLoop: ingest produces learning signals and candidates from reviewable feedback", () => {
  const service = new FeedbackImprovementService();
  const result = service.ingest({
    taskId: "task-feedback-ingest",
    signals: [
      createSignal({
        signalId: "sig-failure",
        source: "execution",
        category: "failure",
        severity: "error",
        payload: { summary: "Execution failed", reasonCode: "timeout" },
      }),
      createSignal({
        signalId: "sig-correction",
        source: "user",
        category: "correction",
        severity: "warning",
        payload: { summary: "User corrected the plan", reasonCode: "manual_fix" },
      }),
      createSignal({
        signalId: "sig-recovery",
        source: "validation",
        category: "success",
        severity: "info",
        payload: { summary: "Recovery path succeeded", reasonCode: "validated" },
      }),
    ],
  });

  assert.ok(result.learningSignals.length > 0);
  assert.ok(result.candidates.length > 0);
  assert.equal(service.listCandidates().length, result.candidates.length);
});

test("E2E FeedbackLoop: quality grader returns bounded scores", () => {
  const grader = new FeedbackQualityGrader();
  const grade = grader.gradeSignals([
    createSignal({
      signalId: "sig-grade",
      source: "hitl",
      category: "correction",
      severity: "critical",
      payload: { summary: "Detailed correction", reasonCode: "precision_fix", notes: "long form" },
    }),
  ]);

  assert.ok(grade.score.overall >= 0 && grade.score.overall <= 1);
  assert.ok(["discard", "low", "medium", "high"].includes(grade.grade));
});
