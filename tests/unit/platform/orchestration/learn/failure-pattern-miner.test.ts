import assert from "node:assert/strict";
import test from "node:test";

import { FailurePatternMiner } from "../../../../../src/platform/orchestration/learn/failure-pattern-miner.js";
import type { LearningSignal } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

// Helper to create a minimal learning signal for testing
function makeSignal(overrides: Partial<LearningSignal> & { learningSignalId: string; taskId: string; learningType: LearningSignal["learningType"] }): LearningSignal {
  return {
    learningSignalId: overrides.learningSignalId,
    taskId: overrides.taskId,
    sourceFeedbackId: `feedback-${overrides.learningSignalId}`,
    learningType: overrides.learningType,
    valueSummary: overrides.valueSummary ?? "test summary",
    confidence: overrides.confidence ?? 0.8,
    generatedAt: overrides.generatedAt ?? Date.now(),
    evidence: overrides.evidence ?? {},
    evidenceRefs: overrides.evidenceRefs ?? [],
    sourceSignalIds: overrides.sourceSignalIds ?? [],
    relatedSignalIds: overrides.relatedSignalIds ?? [],
  };
}

// =============================================================================
// Pattern Detectors
// =============================================================================

test("FailurePatternMiner detects LLM truncation via finish_reason='length'", () => {
  const signal = makeSignal({
    learningSignalId: "sig-1",
    taskId: "task-1",
    learningType: "failure_pattern",
    valueSummary: "Model output was cut off",
    evidence: {
      finishReason: "length",
      maxTokens: 1000,
      tokensUsed: 1000,
    },
  });

  const results = new FailurePatternMiner().mine([signal]);
  assert.equal(results.length, 1);
  assert.equal(results[0]!.patternType, "failure_pattern");
  assert.ok(results[0]!.title.includes("truncated"));
});

test("FailurePatternMiner detects LLM truncation via high token ratio (>=95%)", () => {
  const signal = makeSignal({
    learningSignalId: "sig-2",
    taskId: "task-2",
    learningType: "failure_pattern",
    evidence: {
      finishReason: "stop",
      maxTokens: 2000,
      tokensUsed: 1950,
    },
  });

  const results = new FailurePatternMiner().mine([signal]);
  assert.equal(results.length, 1);
  assert.ok(results[0]!.title.includes("near token limit"));
});

test("FailurePatternMiner ignores signals without truncation evidence", () => {
  const signal = makeSignal({
    learningSignalId: "sig-3",
    taskId: "task-3",
    learningType: "failure_pattern",
    evidence: {
      finishReason: "stop",
      maxTokens: 2000,
      tokensUsed: 100,
    },
  });

  const results = new FailurePatternMiner().mine([signal]);
  assert.equal(results.length, 1);
  assert.equal(results[0]!.learningType, "failure_pattern");
});

test("FailurePatternMiner detects tool permission denial", () => {
  const signal = makeSignal({
    learningSignalId: "sig-4",
    taskId: "task-4",
    learningType: "failure_pattern",
    valueSummary: "permission denied",
    evidence: {
      toolName: "bash",
      operation: "execute",
    },
  });

  const results = new FailurePatternMiner().mine([signal]);
  assert.equal(results.length, 1);
  assert.ok(results[0]!.recommendation.includes("sandbox"));
});

test("FailurePatternMiner detects model hallucination via low eval score", () => {
  const signal = makeSignal({
    learningSignalId: "sig-5",
    taskId: "task-5",
    learningType: "failure_pattern",
    valueSummary: "Low quality output",
    evidence: {
      evalScore: 0.2,
      modelId: "gpt-4o",
      stepId: "step-1",
    },
  });

  const results = new FailurePatternMiner().mine([signal]);
  assert.equal(results.length, 1);
  assert.ok(results[0]!.title.includes("hallucination"));
});

test("FailurePatternMiner detects schema validation loop", () => {
  const signals: LearningSignal[] = [];
  for (let i = 0; i < 3; i++) {
    signals.push(makeSignal({
      learningSignalId: `sig-loop-${i}`,
      taskId: "task-loop",
      learningType: "failure_pattern",
      evidence: {
        stepId: "step-validation",
        repairAttempt: i + 1,
      },
    }));
  }

  const results = new FailurePatternMiner().mine(signals);
  assert.equal(results.length, 1);
  assert.ok(results[0]!.title.includes("Schema validation loop"));
});

test("FailurePatternMiner handles empty signal list", () => {
  const results = new FailurePatternMiner().mine([]);
  assert.deepEqual(results, []);
});

test("FailurePatternMiner filters out non-failure_pattern signals for pattern detectors", () => {
  const signal = makeSignal({
    learningSignalId: "sig-6",
    taskId: "task-6",
    learningType: "user_correction",
    valueSummary: "User corrected output",
  });

  const results = new FailurePatternMiner().mine([signal]);
  assert.equal(results.length, 1);
  assert.equal(results[0]!.learningType, "failure_pattern");
  assert.ok(results[0]!.title.includes("User corrected"));
});

test("FailurePatternMiner assigns generic failure for unmatched signals", () => {
  const signal = makeSignal({
    learningSignalId: "sig-7",
    taskId: "task-7",
    learningType: "failure_pattern",
    valueSummary: "Some random failure that does not match any pattern",
    evidence: {},
  });

  const results = new FailurePatternMiner().mine([signal]);
  assert.equal(results.length, 1);
  assert.ok(results[0]!.recommendation.includes("replanning"));
});

test("FailurePatternMiner processes multiple signals", () => {
  const signals = [
    makeSignal({
      learningSignalId: "sig-multi-1",
      taskId: "task-multi-1",
      learningType: "failure_pattern",
      evidence: { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 },
    }),
    makeSignal({
      learningSignalId: "sig-multi-2",
      taskId: "task-multi-2",
      learningType: "failure_pattern",
      evidence: { evalScore: 0.1, modelId: "test" },
    }),
    makeSignal({
      learningSignalId: "sig-multi-3",
      taskId: "task-multi-3",
      learningType: "recovery_playbook",
      valueSummary: "Recovery happened",
    }),
  ];

  const results = new FailurePatternMiner().mine(signals);
  assert.equal(results.length, 3);
});

test("FailurePatternMiner assigns correct sourceSignalIds", () => {
  const signal = makeSignal({
    learningSignalId: "sig-source-1",
    taskId: "task-source",
    learningType: "failure_pattern",
    evidence: { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 },
  });

  const results = new FailurePatternMiner().mine([signal]);
  assert.ok(results[0]!.sourceSignalIds.includes("sig-source-1"));
});

test("FailurePatternMiner assigns confidence 0.8 to detected patterns", () => {
  const signal = makeSignal({
    learningSignalId: "sig-conf-1",
    taskId: "task-conf",
    learningType: "failure_pattern",
    evidence: { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 },
  });

  const results = new FailurePatternMiner().mine([signal]);
  assert.equal(results[0]!.confidence, 0.8);
});

test("FailurePatternMiner sets promotionStatus to draft", () => {
  const signal = makeSignal({
    learningSignalId: "sig-draft-1",
    taskId: "task-draft",
    learningType: "failure_pattern",
    evidence: { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 },
  });

  const results = new FailurePatternMiner().mine([signal]);
  assert.equal(results[0]!.promotionStatus, "draft");
});

test("FailurePatternMiner handles signals with stepId in evidence", () => {
  const signal = makeSignal({
    learningSignalId: "sig-step-1",
    taskId: "task-step",
    learningType: "failure_pattern",
    evidence: {
      finishReason: "length",
      maxTokens: 1000,
      tokensUsed: 1000,
      stepId: "step-42",
    },
  });

  const results = new FailurePatternMiner().mine([signal]);
  assert.equal(results[0]!.stepId, "step-42");
});

test("FailurePatternMiner does not detect truncation when tokensUsed is 0", () => {
  const signal = makeSignal({
    learningSignalId: "sig-zero-1",
    taskId: "task-zero",
    learningType: "failure_pattern",
    evidence: {
      finishReason: "length",
      maxTokens: 1000,
      tokensUsed: 0,
    },
  });

  const results = new FailurePatternMiner().mine([signal]);
  // 0 tokens used doesn't pass the >= 95% check
  assert.equal(results.length, 1);
});

test("FailurePatternMiner handles hallucination with eval_score instead of evalScore", () => {
  const signal = makeSignal({
    learningSignalId: "sig-hall-1",
    taskId: "task-hall",
    learningType: "failure_pattern",
    evidence: {
      eval_score: 0.2,
      model: "claude-3",
    },
  });

  const results = new FailurePatternMiner().mine([signal]);
  assert.equal(results.length, 1);
  assert.ok(results[0]!.title.includes("hallucination"));
});

test("FailurePatternMiner does not detect hallucination when evalScore >= 0.3", () => {
  const signal = makeSignal({
    learningSignalId: "sig-hall-2",
    taskId: "task-hall-2",
    learningType: "failure_pattern",
    valueSummary: "decent output",
    evidence: {
      evalScore: 0.5,
    },
  });

  const results = new FailurePatternMiner().mine([signal]);
  // Should not create hallucination pattern for high eval score
  assert.equal(results.length, 1);
});