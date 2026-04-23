import test from "node:test";
import assert from "node:assert/strict";
import type { FeedbackEnvelope } from "../../../../../src/platform/orchestration/harness/types/feedback-envelope.js";

test("types/feedback-envelope.ts exports FeedbackEnvelope type", () => {
  const envelope: FeedbackEnvelope = {
    feedbackId: "feedback-123",
    signals: ["signal-1", "signal-2"],
    learnedActions: ["action-1", "action-2"],
    createdAt: "2026-04-23T00:00:00Z",
  };

  assert.equal(envelope.feedbackId, "feedback-123");
  assert.equal(envelope.signals.length, 2);
  assert.equal(envelope.learnedActions.length, 2);
  assert.ok(typeof envelope.createdAt === "string");
});

test("FeedbackEnvelope can be constructed with empty arrays", () => {
  const envelope: FeedbackEnvelope = {
    feedbackId: "feedback-empty",
    signals: [],
    learnedActions: [],
    createdAt: "2026-04-23T00:00:00Z",
  };

  assert.equal(envelope.feedbackId, "feedback-empty");
  assert.equal(envelope.signals.length, 0);
  assert.equal(envelope.learnedActions.length, 0);
});

test("FeedbackEnvelope signals can include evidence refs", () => {
  const envelope: FeedbackEnvelope = {
    feedbackId: "feedback-evidence",
    signals: ["evidence-1", "evidence-2", "finding-code-1"],
    learnedActions: ["update_plan_bundle"],
    createdAt: "2026-04-23T00:00:00Z",
  };

  assert.ok(envelope.signals.some((s) => s.startsWith("evidence-")));
  assert.ok(envelope.learnedActions.some((a) => a.includes("update")));
});