/**
 * Integration Test: Experience Distillation Service
 *
 * Tests the ExperienceDistillationService which transforms learning signals
 * into distilled LearningObjects with appropriate recommendations.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createSeededIntegrationContext } from "../../../../helpers/integration-context.js";
import { ExperienceDistillationService } from "../../../../../src/platform/orchestration/learn/experience-distillation-service.js";
import type { LearningSignal } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function makeSignal(overrides: Partial<LearningSignal> & { learningSignalId: string; taskId: string }): LearningSignal {
  return {
    learningSignalId: overrides.learningSignalId,
    taskId: overrides.taskId,
    sourceFeedbackId: `feedback-${overrides.learningSignalId}`,
    learningType: overrides.learningType ?? "failure_pattern",
    valueSummary: overrides.valueSummary ?? "test experience",
    confidence: overrides.confidence ?? 0.8,
    generatedAt: overrides.generatedAt ?? Date.now(),
    evidence: overrides.evidence ?? {},
    evidenceRefs: overrides.evidenceRefs ?? [],
    sourceSignalIds: overrides.sourceSignalIds ?? [],
    relatedSignalIds: overrides.relatedSignalIds ?? [],
  };
}

test("ExperienceDistillationService integrates with task context", () => {
  const ctx = createSeededIntegrationContext("aa-eds-task-");
  try {
    const service = new ExperienceDistillationService();

    const signal = makeSignal({
      learningSignalId: "sig-eds-task",
      taskId: "task-eds-task",
      valueSummary: "Effective strategy for data extraction",
    });

    const results = service.distill([signal]);

    assert.equal(results.length, 1);
    assert.equal(results[0]!.learningType, "failure_pattern");
    assert.ok(results[0]!.learningObjectId.startsWith("learning_"));
    assert.ok(results[0]!.title.includes("Distilled"));
  } finally {
    ctx.cleanup();
  }
});

test("ExperienceDistillationService handles multiple learning types", () => {
  const ctx = createSeededIntegrationContext("aa-eds-types-");
  try {
    const service = new ExperienceDistillationService();

    const signals: LearningSignal[] = [
      makeSignal({ learningSignalId: "sig-eds-1", taskId: "task-eds-types", learningType: "failure_pattern", valueSummary: "Schema mismatch error" }),
      makeSignal({ learningSignalId: "sig-eds-2", taskId: "task-eds-types", learningType: "user_correction", valueSummary: "User corrected output format" }),
      makeSignal({ learningSignalId: "sig-eds-3", taskId: "task-eds-types", learningType: "recovery_playbook", valueSummary: "Successfully recovered from timeout" }),
      makeSignal({ learningSignalId: "sig-eds-4", taskId: "task-eds-types", learningType: "model_retraining", valueSummary: "Model needs more edge case training" }),
      makeSignal({ learningSignalId: "sig-eds-5", taskId: "task-eds-types", learningType: "dataset_gap", valueSummary: "Missing training data for medical domain" }),
    ];

    const results = service.distill(signals);

    assert.equal(results.length, 5);
    const types = results.map((r) => r.learningType);
    assert.ok(types.includes("failure_pattern"));
    assert.ok(types.includes("user_correction"));
    assert.ok(types.includes("recovery_playbook"));
    assert.ok(types.includes("model_retraining"));
    assert.ok(types.includes("dataset_gap"));
  } finally {
    ctx.cleanup();
  }
});

test("ExperienceDistillationService preserves signal metadata", () => {
  const ctx = createSeededIntegrationContext("aa-eds-meta-");
  try {
    const service = new ExperienceDistillationService();

    const signal = makeSignal({
      learningSignalId: "sig-eds-meta",
      taskId: "task-eds-meta",
      learningType: "user_correction",
      valueSummary: "User provided better approach",
      confidence: 0.92,
      evidenceRefs: ["evidence-meta-1", "evidence-meta-2"],
      sourceSignalIds: ["source-meta-1"],
    });

    const results = service.distill([signal]);

    assert.equal(results.length, 1);
    assert.equal(results[0]!.confidence, 0.92);
    assert.deepEqual(results[0]!.evidenceRefs, ["evidence-meta-1", "evidence-meta-2"]);
    assert.deepEqual(results[0]!.sourceSignalIds, ["source-meta-1"]);
  } finally {
    ctx.cleanup();
  }
});

test("ExperienceDistillationService builds correct recommendations per type", () => {
  const ctx = createSeededIntegrationContext("aa-eds-rec-");
  try {
    const service = new ExperienceDistillationService();

    const recoverySignal = makeSignal({
      learningSignalId: "sig-eds-rec",
      taskId: "task-eds-rec",
      learningType: "recovery_playbook",
      valueSummary: "Successfully recovered using fallback strategy",
    });

    const results = service.distill([recoverySignal]);

    assert.ok(results[0]!.recommendation.includes("recovery playbook"));
  } finally {
    ctx.cleanup();
  }
});

test("ExperienceDistillationService generates unique IDs per signal", () => {
  const ctx = createSeededIntegrationContext("aa-eds-unique-");
  try {
    const service = new ExperienceDistillationService();

    const signals: LearningSignal[] = [
      makeSignal({ learningSignalId: "sig-eds-unique-1", taskId: "task-eds-unique" }),
      makeSignal({ learningSignalId: "sig-eds-unique-2", taskId: "task-eds-unique" }),
      makeSignal({ learningSignalId: "sig-eds-unique-3", taskId: "task-eds-unique" }),
    ];

    const results = service.distill(signals);

    const ids = results.map((r) => r.learningObjectId);
    assert.equal(new Set(ids).size, 3, "All learning object IDs should be unique");
  } finally {
    ctx.cleanup();
  }
});

test("ExperienceDistillationService handles empty signal list", () => {
  const ctx = createSeededIntegrationContext("aa-eds-empty-");
  try {
    const service = new ExperienceDistillationService();
    const results = service.distill([]);
    assert.equal(results.length, 0);
  } finally {
    ctx.cleanup();
  }
});

test("ExperienceDistillationService sets promotionStatus to draft", () => {
  const ctx = createSeededIntegrationContext("aa-eds-draft-");
  try {
    const service = new ExperienceDistillationService();

    const signal = makeSignal({
      learningSignalId: "sig-eds-draft",
      taskId: "task-eds-draft",
    });

    const results = service.distill([signal]);

    assert.equal(results[0]!.promotionStatus, "draft");
  } finally {
    ctx.cleanup();
  }
});

test("ExperienceDistillationService uses current timestamp for createdAt", () => {
  const ctx = createSeededIntegrationContext("aa-eds-time-");
  try {
    const service = new ExperienceDistillationService();
    const before = Date.now();

    const signal = makeSignal({
      learningSignalId: "sig-eds-time",
      taskId: "task-eds-time",
    });

    const results = service.distill([signal]);
    const after = Date.now();

    assert.ok(results[0]!.createdAt >= before && results[0]!.createdAt <= after);
  } finally {
    ctx.cleanup();
  }
});
