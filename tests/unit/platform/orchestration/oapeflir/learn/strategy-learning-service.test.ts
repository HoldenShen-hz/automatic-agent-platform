import test from "node:test";
import assert from "node:assert/strict";

import { StrategyLearningService } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/learn/strategy-learning-service.js";
import type { LearningSignal } from "../../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

test("StrategyLearningService turns learning signals into learning objects", () => {
  const service = new StrategyLearningService();
  const objects = service.learnSync([
    {
      learningSignalId: "ls_1",
      taskId: "task_1",
      sourceFeedbackId: "fb_1",
      learningType: "failure_pattern",
      confidence: 0.75,
      valueSummary: "schema mismatch in output",
      evidenceRefs: ["artifact:a"],
      sourceSignalIds: ["signal_1"],
      relatedSignalIds: ["signal_1"],
      evidence: { source: "execution", category: "failure" },
      generatedAt: Date.now(),
    },
    {
      learningSignalId: "ls_2",
      taskId: "task_1",
      sourceFeedbackId: "fb_1",
      learningType: "recovery_playbook",
      confidence: 0.8,
      valueSummary: "retry with narrower scope",
      evidenceRefs: ["artifact:b"],
      sourceSignalIds: ["signal_2"],
      relatedSignalIds: ["signal_2"],
      evidence: { pattern: "recovery_path" },
      generatedAt: Date.now(),
    },
  ]);

  assert.equal(objects.length, 2);
  assert.ok(objects.every((item) => item.evidenceRefs.length > 0));
  assert.ok(objects.every((item) => item.promotionStatus === "validated"));
});

test("StrategyLearningService returns empty array for empty signals", () => {
  const service = new StrategyLearningService();
  const objects = service.learnSync([]);
  assert.equal(objects.length, 0);
});

test("StrategyLearningService handles single learning signal", () => {
  const service = new StrategyLearningService();
  const objects = service.learnSync([
    {
      learningSignalId: "ls_3",
      taskId: "task_2",
      sourceFeedbackId: "fb_2",
      learningType: "recovery_playbook",
      confidence: 0.9,
      valueSummary: "retry with backoff works",
      evidenceRefs: ["artifact:c"],
      sourceSignalIds: ["signal_3"],
      relatedSignalIds: [],
      evidence: { pattern: "retry_path" },
      generatedAt: Date.now(),
    },
  ]);

  assert.equal(objects.length, 1);
  assert.equal(objects[0]?.learningType, "recovery_playbook");
});

test("StrategyLearningService assigns validated status to high-confidence signals", () => {
  const service = new StrategyLearningService();
  const objects = service.learnSync([
    {
      learningSignalId: "ls_4",
      taskId: "task_3",
      sourceFeedbackId: "fb_3",
      learningType: "user_correction",
      confidence: 0.95,
      valueSummary: "manual correction noted",
      evidenceRefs: ["artifact:d"],
      sourceSignalIds: ["signal_4"],
      relatedSignalIds: [],
      evidence: { source: "user", category: "correction" },
      generatedAt: Date.now(),
    },
  ]);

  assert.equal(objects[0]?.promotionStatus, "validated");
  assert.ok(objects[0]?.confidence >= 0.9);
});

test("StrategyLearningService async learn uses LLM for non-failure signals", async () => {
  const service = new StrategyLearningService();
  const signals: readonly LearningSignal[] = [
    {
      learningSignalId: "ls_5",
      taskId: "task_4",
      sourceFeedbackId: "fb_4",
      learningType: "failure_pattern",
      confidence: 0.75,
      valueSummary: "schema mismatch in output",
      evidenceRefs: ["artifact:e"],
      sourceSignalIds: ["signal_5"],
      relatedSignalIds: [],
      evidence: { source: "execution", category: "failure" },
      generatedAt: Date.now(),
    },
    {
      learningSignalId: "ls_6",
      taskId: "task_4",
      sourceFeedbackId: "fb_4",
      learningType: "user_correction",
      confidence: 0.9,
      valueSummary: "user corrected the approach",
      evidenceRefs: ["artifact:f"],
      sourceSignalIds: ["signal_6"],
      relatedSignalIds: [],
      evidence: { source: "user", category: "correction" },
      generatedAt: Date.now(),
    },
  ];

  const objects = await service.learn(signals);
  assert.ok(objects.length >= 1);
  assert.ok(objects.some((item) => item.learningType === "failure_pattern"));
});
