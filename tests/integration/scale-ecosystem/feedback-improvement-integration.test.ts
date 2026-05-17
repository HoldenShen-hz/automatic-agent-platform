import assert from "node:assert/strict";
import test from "node:test";

import { FeedbackImprovementService } from "../../../src/scale-ecosystem/feedback-loop/feedback-improvement-service.js";
import type { FeedbackSignal } from "../../../src/scale-ecosystem/feedback-loop/collector/index.js";

function createSignal(overrides: Partial<FeedbackSignal> & { signalId: string; source: FeedbackSignal["source"]; taskId: string; category: FeedbackSignal["category"]; severity: FeedbackSignal["severity"] }): FeedbackSignal {
  const defaults: FeedbackSignal = {
    signalId: "",
    source: "execution",
    taskId: "",
    category: "failure",
    severity: "error",
    payload: { summary: "", reasonCode: "" },
    stepOutputRefs: [],
    timestamp: 0,
    feedbackTrustScore: 0.85,
    trustFactors: { sourceReliability: 0.9, historicalAccuracy: 0.8, authenticatedSource: true, attackSurfaceExposure: 0.1, holdoutOverlap: 0 },
  };
  return { ...defaults, ...overrides };
}

test("integration: feedback flows into candidate review and release with rollout gate", () => {
  const service = new FeedbackImprovementService();
  const result = service.ingest({
    taskId: "task_feedback_1",
    signals: [
      createSignal({ signalId: "sig_fail", source: "execution", taskId: "task_feedback_1", category: "failure", severity: "error", payload: { summary: "connector timeout", reasonCode: "connector.timeout" }, stepOutputRefs: ["artifact:timeout"], timestamp: 1 }),
      createSignal({ signalId: "sig_fix", source: "hitl", taskId: "task_feedback_1", category: "correction", severity: "warning", payload: { summary: "retry with backoff", reasonCode: "operator.backoff" }, stepOutputRefs: ["artifact:timeout"], timestamp: 2 }),
      createSignal({ signalId: "sig_ok", source: "execution", taskId: "task_feedback_1", category: "success", severity: "info", payload: { summary: "recovered", reasonCode: "connector.recovered" }, stepOutputRefs: ["artifact:timeout"], timestamp: 3 }),
    ],
  });

  const candidate = result.candidates[0]!;
  const review = service.review(candidate.candidateId, "reviewer_1", "approved", {
    rolloutGatePassed: true,
    policyGatePassed: true,
    reviewedAt: "2026-04-20T00:05:00.000Z",
  });
  assert.equal(review.decision, "approved");
  assert.equal(service.release(candidate.candidateId, "owner_1").reviewStatus, "released");
});
