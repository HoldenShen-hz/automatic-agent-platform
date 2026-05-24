import assert from "node:assert/strict";
import test from "node:test";

import { ExperienceDistillationService } from "../../../../../src/platform/five-plane-orchestration/learn/experience-distillation-service.js";
import type { LearningSignal } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function makeSignal(overrides: Partial<LearningSignal> = {}): LearningSignal {
  return {
    learningSignalId: overrides.learningSignalId ?? "signal-1",
    taskId: overrides.taskId ?? "task-1",
    sourceFeedbackId: overrides.sourceFeedbackId ?? "feedback-1",
    learningType: overrides.learningType ?? "failure_pattern",
    confidence: overrides.confidence ?? 0.7,
    valueSummary: overrides.valueSummary ?? "Retries succeeded after refreshing the session.",
    evidenceRefs: overrides.evidenceRefs ?? ["artifact-1"],
    sourceSignalIds: overrides.sourceSignalIds ?? ["source-1"],
    relatedSignalIds: overrides.relatedSignalIds ?? [],
    evidence: overrides.evidence ?? {},
    generatedAt: overrides.generatedAt ?? 1_717_000_000_000,
  };
}

test("ExperienceDistillationService distills canonical learning objects", () => {
  const service = new ExperienceDistillationService();

  const [result] = service.distill([makeSignal()]);

  assert.ok(result);
  assert.equal(result.learningType, "failure_pattern");
  assert.equal(result.kind, "failure_pattern");
  assert.equal(result.summary, "Retries succeeded after refreshing the session.");
  assert.equal(result.validatedBy, "none");
  assert.equal(result.promotionStatus, "quarantine");
  assert.equal(result.status, "created");
  assert.deepEqual(result.content.evidenceRefs, ["artifact-1"]);
});

test("ExperienceDistillationService normalizes deprecated learning types", () => {
  const service = new ExperienceDistillationService();

  const [datasetGap] = service.distill([makeSignal({ learningType: "dataset_gap" })]);
  const [modelRetraining] = service.distill([makeSignal({ learningType: "model_retraining" })]);

  assert.ok(datasetGap);
  assert.ok(modelRetraining);
  assert.equal(datasetGap.learningType, "failure_pattern");
  assert.equal(datasetGap.kind, "failure_pattern");
  assert.equal(modelRetraining.learningType, "user_correction");
  assert.equal(modelRetraining.kind, "user_correction");
});

test("ExperienceDistillationService carries over timestamps, ids, and signals", () => {
  const service = new ExperienceDistillationService();

  const [result] = service.distill([
    makeSignal({
      generatedAt: 1_720_000_000_000,
      sourceSignalIds: ["a", "b"],
      evidenceRefs: ["ev-1", "ev-2"],
    }),
  ]);

  assert.ok(result);
  assert.equal(result.createdAt, "1720000000000");
  assert.deepEqual(result.sourceSignalIds, ["a", "b"]);
  assert.deepEqual(result.evidenceRefs, ["ev-1", "ev-2"]);
  assert.notEqual(result.learningObjectId, result.objectId);
});

test("ExperienceDistillationService chooses recommendations by learning type", () => {
  const service = new ExperienceDistillationService();
  const [failure] = service.distill([makeSignal({ learningType: "failure_pattern" })]);
  const [recovery] = service.distill([makeSignal({ learningType: "recovery_playbook" })]);

  assert.ok(failure);
  assert.ok(recovery);
  assert.ok(failure.recommendation.includes("planning guidance"));
  assert.ok(recovery.recommendation.includes("recovery playbook"));
});

test("ExperienceDistillationService handles empty and multi-signal batches", () => {
  const service = new ExperienceDistillationService();

  assert.deepEqual(service.distill([]), []);
  const results = service.distill([
    makeSignal({ learningSignalId: "signal-1" }),
    makeSignal({ learningSignalId: "signal-2" }),
  ]);
  assert.equal(results.length, 2);
  assert.notEqual(results[0]?.learningObjectId, results[1]?.learningObjectId);
});
