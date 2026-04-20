import assert from "node:assert/strict";
import test from "node:test";

import { FeedbackImprovementService } from "../../../src/scale-ecosystem/feedback-loop/feedback-improvement-service.js";

test("integration: feedback flows into candidate review and release with rollout gate", () => {
  const service = new FeedbackImprovementService();
  const result = service.ingest({
    taskId: "task_feedback_1",
    signals: [
      {
        signalId: "sig_fail",
        source: "execution",
        taskId: "task_feedback_1",
        category: "failure",
        severity: "error",
        payload: { summary: "connector timeout", reasonCode: "connector.timeout" },
        stepOutputRefs: ["artifact:timeout"],
        timestamp: 1,
      },
      {
        signalId: "sig_fix",
        source: "hitl",
        taskId: "task_feedback_1",
        category: "correction",
        severity: "warning",
        payload: { summary: "retry with backoff", reasonCode: "operator.backoff" },
        stepOutputRefs: ["artifact:timeout"],
        timestamp: 2,
      },
      {
        signalId: "sig_ok",
        source: "execution",
        taskId: "task_feedback_1",
        category: "success",
        severity: "info",
        payload: { summary: "recovered", reasonCode: "connector.recovered" },
        stepOutputRefs: ["artifact:timeout"],
        timestamp: 3,
      },
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
