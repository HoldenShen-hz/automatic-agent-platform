import assert from "node:assert/strict";
import test from "node:test";

import type { LearningSignal } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { ExperienceDistillationService } from "../../../../../src/platform/five-plane-orchestration/learn/experience-distillation-service.js";
import type { LearningObject } from "../../../../../src/platform/five-plane-orchestration/learn/learning-object-model.js";

function makeSignal(overrides: Partial<LearningSignal> = {}): LearningSignal {
  return {
    learningSignalId: "sig-1",
    taskId: "task-1",
    sourceFeedbackId: "feedback-1",
    learningType: "failure_pattern",
    valueSummary: "Step failed validation with schema mismatch",
    confidence: 0.8,
    evidence: { stepId: "step-1" },
    evidenceRefs: ["evidence-1"],
    sourceSignalIds: ["source-1"],
    relatedSignalIds: [],
    generatedAt: Date.now(),
    ...overrides,
  };
}

test("ExperienceDistillationService.distill creates LearningObject from signal", () => {
  const service = new ExperienceDistillationService();
  const signal = makeSignal();

  const objects = service.distill([signal]);

  assert.equal(objects.length, 1);
  assert.ok(objects[0]!.learningObjectId.startsWith("learning_"));
  assert.equal(objects[0]!.learningType, "failure_pattern");
  assert.equal(objects[0]!.title, "Distilled failure_pattern");
});

test("ExperienceDistillationService.distill preserves valueSummary as summary", () => {
  const service = new ExperienceDistillationService();
  const signal = makeSignal({ valueSummary: "Custom summary text" });

  const objects = service.distill([signal]);

  assert.equal(objects[0]!.summary, "Custom summary text");
});

test("ExperienceDistillationService.distill preserves confidence from signal", () => {
  const service = new ExperienceDistillationService();
  const signal = makeSignal({ confidence: 0.95 });

  const objects = service.distill([signal]);

  assert.equal(objects[0]!.confidence, 0.95);
});

test("ExperienceDistillationService.distill preserves evidenceRefs from signal", () => {
  const service = new ExperienceDistillationService();
  const signal = makeSignal({ evidenceRefs: ["ref-1", "ref-2", "ref-3"] });

  const objects = service.distill([signal]);

  assert.deepEqual(objects[0]!.evidenceRefs, ["ref-1", "ref-2", "ref-3"]);
});

test("ExperienceDistillationService.distill preserves sourceSignalIds from signal", () => {
  const service = new ExperienceDistillationService();
  const signal = makeSignal({ sourceSignalIds: ["src-1", "src-2"] });

  const objects = service.distill([signal]);

  assert.deepEqual(objects[0]!.sourceSignalIds, ["src-1", "src-2"]);
});

test("ExperienceDistillationService.distill sets validatedBy to none", () => {
  const service = new ExperienceDistillationService();
  const signal = makeSignal();

  const objects = service.distill([signal]);

  assert.equal(objects[0]!.validatedBy, "none");
});

test("ExperienceDistillationService.distill sets promotionStatus to quarantine", () => {
  const service = new ExperienceDistillationService();
  const signal = makeSignal();

  const objects = service.distill([signal]);

  assert.equal(objects[0]!.promotionStatus, "quarantine");
});

test("ExperienceDistillationService.distill uses current Date.now() for createdAt", () => {
  const service = new ExperienceDistillationService();
  const before = Date.now();
  const signal = makeSignal();
  const after = Date.now();

  const objects = service.distill([signal]);

  assert.ok(objects[0]!.createdAt >= before && objects[0]!.createdAt <= after);
});

test("ExperienceDistillationService.distill gives recovery_playbook specific recommendation", () => {
  const service = new ExperienceDistillationService();
  const signal = makeSignal({ learningType: "recovery_playbook" });

  const objects = service.distill([signal]);

  assert.ok(objects[0]!.recommendation.includes("recovery playbook"));
});

test("ExperienceDistillationService.distill gives non-recovery_playbook generic recommendation", () => {
  const service = new ExperienceDistillationService();
  const signal = makeSignal({ learningType: "user_correction" });

  const objects = service.distill([signal]);

  assert.ok(objects[0]!.recommendation.includes("future task execution"));
});

test("ExperienceDistillationService.distill processes multiple signals", () => {
  const service = new ExperienceDistillationService();
  const signals = [
    makeSignal({ learningSignalId: "sig-1", learningType: "failure_pattern" }),
    makeSignal({ learningSignalId: "sig-2", learningType: "user_correction" }),
    makeSignal({ learningSignalId: "sig-3", learningType: "recovery_playbook" }),
  ];

  const objects = service.distill(signals);

  assert.equal(objects.length, 3);
  assert.ok(objects[0]!.learningObjectId !== objects[1]!.learningObjectId);
  assert.ok(objects[1]!.learningObjectId !== objects[2]!.learningObjectId);
});

test("ExperienceDistillationService.distill generates unique learningObjectIds", () => {
  const service = new ExperienceDistillationService();
  const signals = [
    makeSignal({ learningSignalId: "sig-1" }),
    makeSignal({ learningSignalId: "sig-2" }),
    makeSignal({ learningSignalId: "sig-3" }),
  ];

  const objects = service.distill(signals);

  const ids = objects.map((o) => o.learningObjectId);
  assert.equal(new Set(ids).size, 3, "All IDs should be unique");
});

test("ExperienceDistillationService.distill returns empty array for empty signal list", () => {
  const service = new ExperienceDistillationService();

  const objects = service.distill([]);

  assert.equal(objects.length, 0);
});

test("ExperienceDistillationService.distill handles different learningTypes correctly", () => {
  const service = new ExperienceDistillationService();

  const learningTypes: LearningSignal["learningType"][] = [
    "failure_pattern",
    "user_correction",
    "recovery_playbook",
    "model_retraining",
    "dataset_gap",
  ];

  const signals = learningTypes.map((learningType, i) =>
    makeSignal({ learningSignalId: `sig-${i}`, learningType }),
  );

  const objects = service.distill(signals);

  assert.equal(objects.length, 5);
  objects.forEach((obj, i) => {
    const expectedType = signals[i]!.learningType === "model_retraining"
      ? "user_correction"
      : signals[i]!.learningType === "dataset_gap"
        ? "failure_pattern"
        : signals[i]!.learningType;
    assert.equal(obj.learningType, expectedType);
    assert.equal(obj.title, `Distilled ${signals[i]!.learningType}`);
  });
});

test("ExperienceDistillationService.distill preserves all fields from signal", () => {
  const service = new ExperienceDistillationService();
  const signal: LearningSignal = {
    learningSignalId: "sig-preserve-test",
    taskId: "task-preserve",
    sourceFeedbackId: "feedback-preserve",
    learningType: "model_retraining",
    valueSummary: "Model underperformed on edge cases",
    confidence: 0.75,
    evidence: { accuracy: 0.65 },
    evidenceRefs: ["ref-a", "ref-b"],
    sourceSignalIds: ["src-x"],
    relatedSignalIds: [],
    generatedAt: 1700000000000,
  };

  const objects = service.distill([signal]);

  assert.equal(objects[0]!.learningType, "user_correction");
  assert.equal(objects[0]!.summary, "Model underperformed on edge cases");
  assert.equal(objects[0]!.confidence, 0.75);
  assert.deepEqual(objects[0]!.evidenceRefs, ["ref-a", "ref-b"]);
  assert.deepEqual(objects[0]!.sourceSignalIds, ["src-x"]);
});
