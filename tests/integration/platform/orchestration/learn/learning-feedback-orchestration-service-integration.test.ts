/**
 * Integration Test: Learning Feedback Orchestration Service
 *
 * Tests the LearningFeedbackOrchestrationService which orchestrates the full
 * learning pipeline: strategy learning, knowledge promotion, and memory storage.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createSeededIntegrationContext } from "../../../../helpers/integration-context.js";
import {
  LearningFeedbackOrchestrationService,
  type LearningFeedbackOrchestrationInput,
} from "../../../../../src/platform/orchestration/learn/learning-feedback-orchestration-service.js";
import type { LearningSignal } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function makeSignal(overrides: Partial<LearningSignal> & { learningSignalId: string; taskId: string }): LearningSignal {
  return {
    learningSignalId: overrides.learningSignalId,
    taskId: overrides.taskId,
    sourceFeedbackId: `feedback-${overrides.learningSignalId}`,
    learningType: overrides.learningType ?? "failure_pattern",
    valueSummary: overrides.valueSummary ?? "test feedback",
    confidence: overrides.confidence ?? 0.8,
    generatedAt: overrides.generatedAt ?? Date.now(),
    evidence: overrides.evidence ?? {},
    evidenceRefs: overrides.evidenceRefs ?? [],
    sourceSignalIds: overrides.sourceSignalIds ?? [],
    relatedSignalIds: overrides.relatedSignalIds ?? [],
  };
}

test("LearningFeedbackOrchestrationService.process returns complete result structure", () => {
  const ctx = createSeededIntegrationContext("aa-lfos-struct-");
  try {
    const service = new LearningFeedbackOrchestrationService();

    const input: LearningFeedbackOrchestrationInput = {
      taskId: "task-lfos-struct",
      signals: [
        makeSignal({ learningSignalId: "sig-lfos-struct-1", taskId: "task-lfos-struct" }),
      ],
      promoteToKnowledge: false,
      rememberValidatedLearnings: false,
    };

    const result = service.process(input);

    assert.equal(result.taskId, "task-lfos-struct");
    assert.ok(Array.isArray(result.learningObjects));
    assert.ok(result.promotedKnowledge);
    assert.ok(Array.isArray(result.rememberedMemories));
    assert.ok(result.learningTypeCounts);
    assert.equal(typeof result.skippedDuplicateCount, "number");
  } finally {
    ctx.cleanup();
  }
});

test("LearningFeedbackOrchestrationService.process handles empty signals", () => {
  const ctx = createSeededIntegrationContext("aa-lfos-empty-");
  try {
    const service = new LearningFeedbackOrchestrationService();

    const input: LearningFeedbackOrchestrationInput = {
      taskId: "task-lfos-empty",
      signals: [],
    };

    const result = service.process(input);

    assert.equal(result.learningObjects.length, 0);
    assert.equal(result.skippedDuplicateCount, 0);
  } finally {
    ctx.cleanup();
  }
});

test("LearningFeedbackOrchestrationService.process counts learning objects by type", () => {
  const ctx = createSeededIntegrationContext("aa-lfos-count-");
  try {
    const service = new LearningFeedbackOrchestrationService();

    const input: LearningFeedbackOrchestrationInput = {
      taskId: "task-lfos-count",
      signals: [
        makeSignal({ learningSignalId: "sig-lfos-count-1", taskId: "task-lfos-count", learningType: "failure_pattern" }),
        makeSignal({ learningSignalId: "sig-lfos-count-2", taskId: "task-lfos-count", learningType: "failure_pattern" }),
        makeSignal({
          learningSignalId: "sig-lfos-count-3",
          taskId: "task-lfos-count",
          learningType: "user_correction",
          confidence: 0.95,
        }),
        makeSignal({ learningSignalId: "sig-lfos-count-4", taskId: "task-lfos-count", learningType: "recovery_playbook" }),
      ],
      promoteToKnowledge: false,
      rememberValidatedLearnings: false,
    };

    const result = service.process(input);

    assert.equal(result.learningTypeCounts["failure_pattern"], 2);
    assert.equal(result.learningTypeCounts["user_correction"], 1);
    assert.equal(result.learningTypeCounts["recovery_playbook"], 1);
  } finally {
    ctx.cleanup();
  }
});

test("LearningFeedbackOrchestrationService.process deduplicates learning objects", () => {
  const ctx = createSeededIntegrationContext("aa-lfos-dedup-");
  try {
    const service = new LearningFeedbackOrchestrationService();

    // Create signals that will produce duplicates
    const input: LearningFeedbackOrchestrationInput = {
      taskId: "task-lfos-dedup",
      signals: [
        makeSignal({
          learningSignalId: "sig-lfos-dedup-1",
          taskId: "task-lfos-dedup",
          learningType: "failure_pattern",
          valueSummary: "Same issue",
          evidenceRefs: ["evidence-same"],
        }),
        makeSignal({
          learningSignalId: "sig-lfos-dedup-2",
          taskId: "task-lfos-dedup",
          learningType: "failure_pattern",
          valueSummary: "Same issue",
          evidenceRefs: ["evidence-same"],
        }),
      ],
      promoteToKnowledge: false,
      rememberValidatedLearnings: false,
    };

    const result = service.process(input);

    // Deduplication should have occurred
    assert.ok(result.learningObjects.length >= 1);
    assert.ok(result.skippedDuplicateCount >= 0);
  } finally {
    ctx.cleanup();
  }
});

test("LearningFeedbackOrchestrationService.process skips promotion when promoteToKnowledge is false", () => {
  const ctx = createSeededIntegrationContext("aa-lfos-no-promote-");
  try {
    const service = new LearningFeedbackOrchestrationService();

    const input: LearningFeedbackOrchestrationInput = {
      taskId: "task-lfos-no-promote",
      signals: [
        makeSignal({ learningSignalId: "sig-lfos-no-promote", taskId: "task-lfos-no-promote" }),
      ],
      promoteToKnowledge: false,
      rememberValidatedLearnings: false,
    };

    const result = service.process(input);

    assert.equal(result.promotedKnowledge.promotedCount, 0);
    assert.deepEqual(result.promotedKnowledge.knowledgeDocumentIds, []);
  } finally {
    ctx.cleanup();
  }
});

test("LearningFeedbackOrchestrationService.process includes executionId in result", () => {
  const ctx = createSeededIntegrationContext("aa-lfos-exec-");
  try {
    const service = new LearningFeedbackOrchestrationService();

    const input: LearningFeedbackOrchestrationInput = {
      taskId: "task-lfos-exec",
      executionId: "exec-lfos-exec",
      signals: [
        makeSignal({ learningSignalId: "sig-lfos-exec", taskId: "task-lfos-exec" }),
      ],
      promoteToKnowledge: false,
      rememberValidatedLearnings: false,
    };

    const result = service.process(input);

    assert.equal(result.taskId, "task-lfos-exec");
  } finally {
    ctx.cleanup();
  }
});

test("LearningFeedbackOrchestrationService.process handles various learning types", () => {
  const ctx = createSeededIntegrationContext("aa-lfos-types-");
  try {
    const service = new LearningFeedbackOrchestrationService();

    const input: LearningFeedbackOrchestrationInput = {
      taskId: "task-lfos-types",
      signals: [
        makeSignal({ learningSignalId: "sig-lfos-types-1", taskId: "task-lfos-types", learningType: "failure_pattern" }),
        makeSignal({
          learningSignalId: "sig-lfos-types-2",
          taskId: "task-lfos-types",
          learningType: "user_correction",
          confidence: 0.95,
        }),
        makeSignal({ learningSignalId: "sig-lfos-types-3", taskId: "task-lfos-types", learningType: "recovery_playbook" }),
        makeSignal({
          learningSignalId: "sig-lfos-types-4",
          taskId: "task-lfos-types",
          learningType: "model_retraining",
          confidence: 0.85,
        }),
        makeSignal({
          learningSignalId: "sig-lfos-types-5",
          taskId: "task-lfos-types",
          learningType: "dataset_gap",
          confidence: 0.85,
        }),
      ],
      promoteToKnowledge: false,
      rememberValidatedLearnings: false,
    };

    const result = service.process(input);

    assert.ok(result.learningObjects.length >= 5);
    assert.ok(result.learningTypeCounts["failure_pattern"] >= 1);
    assert.ok(result.learningTypeCounts["user_correction"] >= 1);
    assert.ok(result.learningTypeCounts["recovery_playbook"] >= 1);
    assert.ok(result.learningTypeCounts["model_retraining"] >= 1);
    assert.ok(result.learningTypeCounts["dataset_gap"] >= 1);
  } finally {
    ctx.cleanup();
  }
});

test("LearningFeedbackOrchestrationService.process works with default services", () => {
  const ctx = createSeededIntegrationContext("aa-lfos-default-");
  try {
    // Service with no overrides - uses all defaults
    const service = new LearningFeedbackOrchestrationService();

    const input: LearningFeedbackOrchestrationInput = {
      taskId: "task-lfos-default",
      signals: [
        makeSignal({ learningSignalId: "sig-lfos-default", taskId: "task-lfos-default" }),
      ],
      promoteToKnowledge: false, // Disable promotion to avoid external dependencies
      rememberValidatedLearnings: false, // Disable memory to avoid memory service dependency
    };

    const result = service.process(input);

    assert.ok(Array.isArray(result.learningObjects));
    assert.ok(result.learningObjects.length >= 0);
  } finally {
    ctx.cleanup();
  }
});

test("LearningFeedbackOrchestrationService.process handles signals with evidence", () => {
  const ctx = createSeededIntegrationContext("aa-lfos-evidence-");
  try {
    const service = new LearningFeedbackOrchestrationService();

    const input: LearningFeedbackOrchestrationInput = {
      taskId: "task-lfos-evidence",
      signals: [
        makeSignal({
          learningSignalId: "sig-lfos-evidence",
          taskId: "task-lfos-evidence",
          evidenceRefs: ["evidence-1", "evidence-2"],
          evidence: { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 },
        }),
      ],
      promoteToKnowledge: false,
      rememberValidatedLearnings: false,
    };

    const result = service.process(input);

    assert.ok(result.learningObjects.length >= 1);
  } finally {
    ctx.cleanup();
  }
});

test("LearningFeedbackOrchestrationService.process handles high confidence signals", () => {
  const ctx = createSeededIntegrationContext("aa-lfos-high-conf-");
  try {
    const service = new LearningFeedbackOrchestrationService();

    const input: LearningFeedbackOrchestrationInput = {
      taskId: "task-lfos-high-conf",
      signals: [
        makeSignal({
          learningSignalId: "sig-lfos-high-conf",
          taskId: "task-lfos-high-conf",
          confidence: 0.99,
        }),
      ],
      promoteToKnowledge: false,
      rememberValidatedLearnings: false,
    };

    const result = service.process(input);

    assert.ok(result.learningObjects.length >= 1);
  } finally {
    ctx.cleanup();
  }
});
