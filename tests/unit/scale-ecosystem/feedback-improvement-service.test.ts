import assert from "node:assert/strict";
import test from "node:test";

import { FeedbackImprovementService } from "../../../src/scale-ecosystem/feedback-loop/feedback-improvement-service.js";
import {
  deriveFeedbackTrustScore,
  parseFeedbackSignal,
  type FeedbackSignal,
  type FeedbackTrustFactors,
} from "../../../src/platform/five-plane-orchestration/oapeflir/types/feedback-signal.js";

const defaultTrustFactors: FeedbackTrustFactors = {
  sourceReliability: 0.9,
  historicalAccuracy: 0.9,
  authenticatedSource: true,
  attackSurfaceExposure: 0.1,
  holdoutOverlap: 0,
};

function createSignal(overrides: Partial<FeedbackSignal>): FeedbackSignal {
  const trustFactors = overrides.trustFactors ?? defaultTrustFactors;
  return parseFeedbackSignal({
    signalId: "sig-default",
    source: "execution",
    taskId: "task_1",
    category: "failure",
    severity: "error",
    payload: {},
    stepOutputRefs: [],
    timestamp: 1,
    trustFactors,
    feedbackTrustScore: overrides.feedbackTrustScore ?? deriveFeedbackTrustScore(trustFactors),
    ...overrides,
  });
}

test("FeedbackImprovementService turns feedback into traceable candidates and gated release [feedback-improvement-service]", () => {
  const service = new FeedbackImprovementService();
  const ingested = service.ingest({
    taskId: "task_1",
    signals: [
      createSignal({
        signalId: "sig_fail",
        payload: { summary: "schema mismatch", reasonCode: "schema.invalid" },
        stepOutputRefs: ["artifact:a"],
      }),
      createSignal({
        signalId: "sig_fix",
        source: "user",
        category: "correction",
        severity: "warning",
        payload: { summary: "adjust prompt", reasonCode: "user.fix" },
        stepOutputRefs: ["artifact:a"],
        timestamp: 2,
      }),
      createSignal({
        signalId: "sig_ok",
        category: "success",
        severity: "info",
        payload: { summary: "recovered", reasonCode: "recovery.ok" },
        stepOutputRefs: ["artifact:a"],
        timestamp: 3,
      }),
    ],
  });

  assert.equal(ingested.candidates.length, 1);
  assert.equal(ingested.candidates[0]?.sourceSignalIds.length, 3);

  const decision = service.review(ingested.candidates[0]!.candidateId, "reviewer_1", "approved", {
    rolloutGatePassed: true,
    policyGatePassed: true,
    reviewedAt: "2026-04-20T00:00:00.000Z",
  });
  assert.equal(decision.decision, "approved");

  const released = service.release(ingested.candidates[0]!.candidateId, "owner_1");
  assert.equal(released.reviewStatus, "released");

  const snapshot = service.buildSnapshot(ingested.feedback.signals, "2026-04-20T00:10:00.000Z");
  assert.equal(snapshot.candidateCount, 1);
  assert.equal(snapshot.trackingSummary.released, 1);
});

test("FeedbackImprovementService rejects candidates without source signals [feedback-improvement-service]", () => {
  const service = new FeedbackImprovementService();
  assert.throws(() => {
    service.createCandidate({
      learningSignalId: "learning_1",
      taskId: "task_1",
      sourceFeedbackId: "feedback_1",
      learningType: "failure_pattern",
      confidence: 0.8,
      valueSummary: "missing provenance",
      evidenceRefs: [],
      sourceSignalIds: [],
      relatedSignalIds: [],
      evidence: {},
      generatedAt: 1,
    });
  }, /feedback_improvement\.missing_source_signal/);
});
