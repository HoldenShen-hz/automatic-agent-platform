import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeLearningType,
  parseLearningObject,
} from "../../../../../src/platform/orchestration/learn/learning-object-model.js";

test("parseLearningObject accepts ISO createdAt timestamps from harness learn flow", () => {
  const createdAt = "2026-05-08T10:15:30.000Z";
  const learningObject = parseLearningObject({
    learningObjectId: "learning-iso-1",
    learningType: "failure_pattern",
    title: "Retry budget pattern",
    summary: "Repeated retry exhausted the budget.",
    confidence: 0.82,
    evidenceRefs: ["evidence-1"],
    sourceSignalIds: ["signal-1"],
    recommendation: "Tighten retry guardrails.",
    validatedBy: "evidence",
    promotionStatus: "validated",
    createdAt,
  });

  assert.equal(learningObject.createdAt, createdAt);
});

test("normalizeLearningType maps deprecated learning types to phase-1 canonical values", () => {
  assert.equal(normalizeLearningType("model_retraining"), "user_correction");
  assert.equal(normalizeLearningType("dataset_gap"), "failure_pattern");
});
