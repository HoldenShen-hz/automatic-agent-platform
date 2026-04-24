import assert from "node:assert/strict";
import test from "node:test";

import { ExperienceDistillationService } from "../../../../../src/platform/orchestration/learn/experience-distillation-service.js";
import type { LearningSignal } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function makeSignal(overrides: Partial<LearningSignal> & { learningSignalId: string; taskId: string; learningType: string }): LearningSignal {
  return {
    learningSignalId: overrides.learningSignalId,
    taskId: overrides.taskId,
    agentId: overrides.agentId ?? "agent-1",
    learningType: overrides.learningType as LearningSignal["learningType"],
    valueSummary: overrides.valueSummary ?? "test summary",
    confidence: overrides.confidence ?? 0.8,
    generatedAt: overrides.generatedAt ?? Date.now(),
    evidence: overrides.evidence ?? {},
    evidenceRefs: overrides.evidenceRefs ?? [],
    sourceTaskId: overrides.sourceTaskId ?? overrides.taskId,
  };
}

// =============================================================================
// ExperienceDistillationService Tests
// =============================================================================

test("ExperienceDistillationService.distill creates learning objects from signals", () => {
  const service = new ExperienceDistillationService();
  const signals = [
    makeSignal({
      learningSignalId: "sig-1",
      taskId: "task-1",
      learningType: "failure_pattern",
      valueSummary: "Something failed",
    }),
  ];

  const results = service.distill(signals);
  assert.equal(results.length, 1);
  assert.equal(results[0]!.learningType, "failure_pattern");
  assert.equal(results[0]!.title, "Distilled failure_pattern");
});

test("ExperienceDistillationService.distill preserves signal confidence", () => {
  const service = new ExperienceDistillationService();
  const signals = [
    makeSignal({
      learningSignalId: "sig-conf",
      taskId: "task-conf",
      learningType: "failure_pattern",
      confidence: 0.75,
    }),
  ];

  const results = service.distill(signals);
  assert.equal(results[0]!.confidence, 0.75);
});

test("ExperienceDistillationService.distill preserves evidence refs", () => {
  const service = new ExperienceDistillationService();
  const signals = [
    makeSignal({
      learningSignalId: "sig-evidence",
      taskId: "task-evidence",
      learningType: "failure_pattern",
      evidenceRefs: ["ref-1", "ref-2"],
    }),
  ];

  const results = service.distill(signals);
  assert.deepEqual(results[0]!.evidenceRefs, ["ref-1", "ref-2"]);
});

test("ExperienceDistillationService.distill preserves source signal ids", () => {
  const service = new ExperienceDistillationService();
  const signals = [
    makeSignal({
      learningSignalId: "sig-source",
      taskId: "task-source",
      learningType: "failure_pattern",
      sourceSignalIds: ["source-1", "source-2"],
    }),
  ];

  const results = service.distill(signals);
  assert.deepEqual(results[0]!.sourceSignalIds, ["source-1", "source-2"]);
});

test("ExperienceDistillationService.distill sets recommendation for failure_pattern", () => {
  const service = new ExperienceDistillationService();
  const signals = [
    makeSignal({
      learningSignalId: "sig-rec-fp",
      taskId: "task-rec-fp",
      learningType: "failure_pattern",
    }),
  ];

  const results = service.distill(signals);
  assert.ok(results[0]!.recommendation.includes("preventive measures"));
});

test("ExperienceDistillationService.distill sets recommendation for recovery_playbook", () => {
  const service = new ExperienceDistillationService();
  const signals = [
    makeSignal({
      learningSignalId: "sig-rec-rp",
      taskId: "task-rec-rp",
      learningType: "recovery_playbook",
    }),
  ];

  const results = service.distill(signals);
  assert.ok(results[0]!.recommendation.includes("recovery playbook"));
});

test("ExperienceDistillationService.distill sets recommendation for user_correction", () => {
  const service = new ExperienceDistillationService();
  const signals = [
    makeSignal({
      learningSignalId: "sig-rec-uc",
      taskId: "task-rec-uc",
      learningType: "user_correction",
    }),
  ];

  const results = service.distill(signals);
  assert.ok(results[0]!.recommendation.includes("planning guidance"));
});

test("ExperienceDistillationService.distill preserves valueSummary as summary", () => {
  const service = new ExperienceDistillationService();
  const signals = [
    makeSignal({
      learningSignalId: "sig-summary",
      taskId: "task-summary",
      learningType: "failure_pattern",
      valueSummary: "Custom summary text",
    }),
  ];

  const results = service.distill(signals);
  assert.equal(results[0]!.summary, "Custom summary text");
});

test("ExperienceDistillationService.distill generates unique learning object IDs", () => {
  const service = new ExperienceDistillationService();
  const signals = [
    makeSignal({ learningSignalId: "sig-uid-1", taskId: "task-uid-1", learningType: "failure_pattern" }),
    makeSignal({ learningSignalId: "sig-uid-2", taskId: "task-uid-2", learningType: "failure_pattern" }),
  ];

  const results = service.distill(signals);
  assert.notEqual(results[0]!.learningObjectId, results[1]!.learningObjectId);
});

test("ExperienceDistillationService.distill handles empty signals array", () => {
  const service = new ExperienceDistillationService();
  const results = service.distill([]);
  assert.deepEqual(results, []);
});

test("ExperienceDistillationService.distill processes multiple signals", () => {
  const service = new ExperienceDistillationService();
  const signals = [
    makeSignal({ learningSignalId: "sig-multi-1", taskId: "task-multi-1", learningType: "failure_pattern" }),
    makeSignal({ learningSignalId: "sig-multi-2", taskId: "task-multi-2", learningType: "user_correction" }),
    makeSignal({ learningSignalId: "sig-multi-3", taskId: "task-multi-3", learningType: "recovery_playbook" }),
  ];

  const results = service.distill(signals);
  assert.equal(results.length, 3);
});

test("ExperienceDistillationService.distill sets promotionStatus to draft", () => {
  const service = new ExperienceDistillationService();
  const signals = [
    makeSignal({ learningSignalId: "sig-draft", taskId: "task-draft", learningType: "failure_pattern" }),
  ];

  const results = service.distill(signals);
  assert.equal(results[0]!.promotionStatus, "draft");
});

test("ExperienceDistillationService.distill sets validatedBy to none", () => {
  const service = new ExperienceDistillationService();
  const signals = [
    makeSignal({ learningSignalId: "sig-valid", taskId: "task-valid", learningType: "failure_pattern" }),
  ];

  const results = service.distill(signals);
  assert.equal(results[0]!.validatedBy, "none");
});

test("ExperienceDistillationService.distill uses current timestamp for createdAt", () => {
  const service = new ExperienceDistillationService();
  const before = Date.now();
  const signals = [
    makeSignal({ learningSignalId: "sig-time", taskId: "task-time", learningType: "failure_pattern" }),
  ];

  const results = service.distill(signals);
  const after = Date.now();

  assert.ok(results[0]!.createdAt >= before);
  assert.ok(results[0]!.createdAt <= after);
});

test("ExperienceDistillationService.distill handles all learning types", () => {
  const service = new ExperienceDistillationService();
  const types = ["failure_pattern", "user_correction", "recovery_playbook", "model_retraining", "dataset_gap"] as const;

  for (const learningType of types) {
    const signals = [
      makeSignal({ learningSignalId: `sig-${learningType}`, taskId: `task-${learningType}`, learningType }),
    ];
    const results = service.distill(signals);
    assert.equal(results.length, 1, `Failed for ${learningType}`);
    assert.equal(results[0]!.learningType, learningType, `Failed for ${learningType}`);
  }
});

test("ExperienceDistillationService.distill preserves custom createdAt from signal", () => {
  const customTime = 1700000000000;
  const service = new ExperienceDistillationService();
  const signals = [
    makeSignal({
      learningSignalId: "sig-created",
      taskId: "task-created",
      learningType: "failure_pattern",
      generatedAt: customTime,
    }),
  ];

  const results = service.distill(signals);
  assert.equal(results[0]!.createdAt, customTime);
});