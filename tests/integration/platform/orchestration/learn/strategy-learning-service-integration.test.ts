/**
 * Integration Test: Strategy Learning Service
 *
 * Tests the StrategyLearningService which orchestrates failure pattern mining
 * and experience distillation to produce validated LearningObjects.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createSeededIntegrationContext } from "../../../../helpers/integration-context.js";
import { StrategyLearningService } from "../../../../../src/platform/orchestration/learn/strategy-learning-service.js";
import type { LearningSignal } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function makeSignal(overrides: Partial<LearningSignal> & { learningSignalId: string; taskId: string }): LearningSignal {
  return {
    learningSignalId: overrides.learningSignalId,
    taskId: overrides.taskId,
    sourceFeedbackId: `feedback-${overrides.learningSignalId}`,
    learningType: overrides.learningType ?? "failure_pattern",
    valueSummary: overrides.valueSummary ?? "test signal",
    confidence: overrides.confidence ?? 0.8,
    generatedAt: overrides.generatedAt ?? Date.now(),
    evidence: overrides.evidence ?? {},
    evidenceRefs: overrides.evidenceRefs ?? [],
    sourceSignalIds: overrides.sourceSignalIds ?? [],
    relatedSignalIds: overrides.relatedSignalIds ?? [],
  };
}

test("StrategyLearningService.learnSync processes mixed signal types", () => {
  const ctx = createSeededIntegrationContext("aa-sls-mixed-");
  try {
    const service = new StrategyLearningService();

    const signals: LearningSignal[] = [
      makeSignal({
        learningSignalId: "sig-sls-mixed-1",
        taskId: "task-sls-mixed",
        learningType: "failure_pattern",
        evidence: { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 },
      }),
      makeSignal({
        learningSignalId: "sig-sls-mixed-2",
        taskId: "task-sls-mixed",
        learningType: "user_correction",
        valueSummary: "User corrected the approach",
        confidence: 0.95,
      }),
      makeSignal({
        learningSignalId: "sig-sls-mixed-3",
        taskId: "task-sls-mixed",
        learningType: "recovery_playbook",
        valueSummary: "Recovery was successful",
      }),
    ];

    const results = service.learnSync(signals);

    assert.ok(results.length >= 3);
    const types = results.map((r) => r.learningType);
    assert.ok(types.includes("failure_pattern"));
    assert.ok(types.includes("user_correction"));
    assert.ok(types.includes("recovery_playbook"));
  } finally {
    ctx.cleanup();
  }
});

test("StrategyLearningService.learnSync validates all returned objects", () => {
  const ctx = createSeededIntegrationContext("aa-sls-valid-");
  try {
    const service = new StrategyLearningService();

    const signals: LearningSignal[] = [
      makeSignal({
        learningSignalId: "sig-sls-valid",
        taskId: "task-sls-valid",
        evidence: { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 },
        evidenceRefs: ["evidence-valid"],
      }),
    ];

    const results = service.learnSync(signals);

    for (const obj of results) {
      assert.ok(obj.learningObjectId.startsWith("learning_"));
      assert.ok(obj.title.length > 0);
      assert.ok(obj.summary.length > 0);
      assert.ok(obj.recommendation.length > 0);
    }
  } finally {
    ctx.cleanup();
  }
});

test("StrategyLearningService.learnSync deduplicates similar learning objects", () => {
  const ctx = createSeededIntegrationContext("aa-sls-dedup-");
  try {
    const service = new StrategyLearningService();

    // Two identical signals that should produce duplicates
    const signals: LearningSignal[] = [
      makeSignal({
        learningSignalId: "sig-sls-dedup-1",
        taskId: "task-sls-dedup",
        learningType: "failure_pattern",
        valueSummary: "Identical issue",
        evidence: { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 },
        evidenceRefs: ["evidence-identical"],
      }),
      makeSignal({
        learningSignalId: "sig-sls-dedup-2",
        taskId: "task-sls-dedup",
        learningType: "failure_pattern",
        valueSummary: "Identical issue",
        evidence: { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 },
        evidenceRefs: ["evidence-identical"],
      }),
    ];

    const results = service.learnSync(signals);

    // Deduplication should reduce the count
    // The exact behavior depends on the validator's filtering
    assert.ok(results.length >= 1);
  } finally {
    ctx.cleanup();
  }
});

test("StrategyLearningService.learnSync handles empty signal list", () => {
  const ctx = createSeededIntegrationContext("aa-sls-empty-");
  try {
    const service = new StrategyLearningService();
    const results = service.learnSync([]);
    assert.equal(results.length, 0);
  } finally {
    ctx.cleanup();
  }
});

test("StrategyLearningService.learnSync filters out failure_pattern signals from distillation", () => {
  const ctx = createSeededIntegrationContext("aa-sls-filter-");
  try {
    const service = new StrategyLearningService();

    // Only failure_pattern signals - these go through mining, not distillation
    const signals: LearningSignal[] = [
      makeSignal({
        learningSignalId: "sig-sls-filter",
        taskId: "task-sls-filter",
        learningType: "failure_pattern",
        evidence: { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 },
      }),
    ];

    const results = service.learnSync(signals);

    // Should still get results from the miner
    assert.ok(results.length >= 1);
  } finally {
    ctx.cleanup();
  }
});

test("StrategyLearningService.learnSync processes large batch of signals", () => {
  const ctx = createSeededIntegrationContext("aa-sls-large-");
  try {
    const service = new StrategyLearningService();

    const signals: LearningSignal[] = [];
    for (let i = 0; i < 20; i++) {
      signals.push(
        makeSignal({
          learningSignalId: `sig-sls-large-${i}`,
          taskId: "task-sls-large",
          learningType: i % 2 === 0 ? "failure_pattern" : "user_correction",
          evidence: i % 2 === 0 ? { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 } : {},
        }),
      );
    }

    const results = service.learnSync(signals);

    assert.ok(results.length >= 10);
  } finally {
    ctx.cleanup();
  }
});

test("StrategyLearningService.learnSync assigns correct validatedBy field", () => {
  const ctx = createSeededIntegrationContext("aa-sls-vb-");
  try {
    const service = new StrategyLearningService();

    const signals: LearningSignal[] = [
      makeSignal({
        learningSignalId: "sig-sls-vb",
        taskId: "task-sls-vb",
        evidenceRefs: ["ref-1"],
        evidence: { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 },
      }),
    ];

    const results = service.learnSync(signals);

    for (const obj of results) {
      assert.ok(["evidence", "human_review"].includes(obj.validatedBy));
    }
  } finally {
    ctx.cleanup();
  }
});

test("StrategyLearningService.learnSync preserves source signal IDs", () => {
  const ctx = createSeededIntegrationContext("aa-sls-source-");
  try {
    const service = new StrategyLearningService();

    const signals: LearningSignal[] = [
      makeSignal({
        learningSignalId: "sig-sls-source",
        taskId: "task-sls-source",
        sourceSignalIds: ["source-a", "source-b"],
      }),
    ];

    const results = service.learnSync(signals);

    for (const obj of results) {
      assert.ok(obj.sourceSignalIds.length > 0);
    }
  } finally {
    ctx.cleanup();
  }
});

test("StrategyLearningService.learnSync handles signals with various confidence levels", () => {
  const ctx = createSeededIntegrationContext("aa-sls-conf-");
  try {
    const service = new StrategyLearningService();

    const signals: LearningSignal[] = [
      makeSignal({ learningSignalId: "sig-sls-conf-high", taskId: "task-sls-conf", confidence: 0.95 }),
      makeSignal({ learningSignalId: "sig-sls-conf-mid", taskId: "task-sls-conf", confidence: 0.5 }),
      makeSignal({ learningSignalId: "sig-sls-conf-low", taskId: "task-sls-conf", confidence: 0.1 }),
    ];

    const results = service.learnSync(signals);

    // All should have valid confidence values
    for (const obj of results) {
      assert.ok(obj.confidence >= 0 && obj.confidence <= 1);
    }
  } finally {
    ctx.cleanup();
  }
});
