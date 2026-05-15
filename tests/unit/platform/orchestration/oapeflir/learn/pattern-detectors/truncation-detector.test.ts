import test from "node:test";
import assert from "node:assert/strict";

import { detectLlmTruncation } from "../../../../../../../src/platform/five-plane-orchestration/oapeflir/learn/pattern-detectors/truncation-detector.js";
import { parseLearningSignal } from "../../../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { LearningSignal } from "../../../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function createLearningSignal(overrides: Partial<LearningSignal> = {}): LearningSignal {
  return parseLearningSignal({
    learningSignalId: "learn_1",
    taskId: "task_1",
    sourceFeedbackId: "fb_1",
    learningType: "failure_pattern",
    confidence: 0.8,
    valueSummary: "Test summary",
    evidenceRefs: [],
    sourceSignalIds: ["sig_1"],
    relatedSignalIds: ["sig_1"],
    evidence: {},
    generatedAt: 1000,
    ...overrides,
  });
}

// =============================================================================
// detectLlmTruncation tests
// =============================================================================

test("detectLlmTruncation returns null when no truncation evidence", () => {
  const signal = createLearningSignal({ evidence: { finishReason: "stop", maxTokens: 1000, tokensUsed: 500 } });
  const result = detectLlmTruncation(signal);
  assert.equal(result, null);
});

test("detectLlmTruncation detects explicit finish_reason=length", () => {
  const signal = createLearningSignal({
    evidence: { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 },
  });
  const result = detectLlmTruncation(signal);
  assert.notEqual(result, null);
  assert.equal(result?.patternType, "llm_truncation");
  assert.ok(result?.title.includes("truncated"));
});

test("detectLlmTruncation detects near-max_tokens usage (>95%)", () => {
  const signal = createLearningSignal({
    evidence: { finishReason: "stop", maxTokens: 1000, tokensUsed: 980 },
  });
  const result = detectLlmTruncation(signal);
  assert.notEqual(result, null);
  assert.equal(result?.patternType, "llm_truncation");
  assert.ok(result?.title.includes("near token limit"));
});

test("detectLlmTruncation ignores when tokensUsed is 0", () => {
  const signal = createLearningSignal({
    evidence: { finishReason: "stop", maxTokens: 1000, tokensUsed: 0 },
  });
  const result = detectLlmTruncation(signal);
  assert.equal(result, null);
});

test("detectLlmTruncation handles legacy finish_reason field", () => {
  const signal = createLearningSignal({
    evidence: { finish_reason: "length", max_tokens: 2000, tokens_used: 2000 },
  });
  const result = detectLlmTruncation(signal);
  assert.notEqual(result, null);
  assert.equal(result?.patternType, "llm_truncation");
});

test("detectLlmTruncation handles missing stepId", () => {
  const signal = createLearningSignal({
    evidence: { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 },
  });
  const result = detectLlmTruncation(signal);
  assert.notEqual(result, null);
  assert.equal(result?.stepId, "");
});

test("detectLlmTruncation threshold is inclusive at 95%", () => {
  const signal = createLearningSignal({
    evidence: { finishReason: "stop", maxTokens: 1000, tokensUsed: 950 }, // exactly 95%
  });
  const result = detectLlmTruncation(signal);
  // 950/1000 = 95%, condition is >= 95%, so should trigger secondary detection
  // But primary detection (finishReason="length") also fails, so secondary kicks in
  assert.notEqual(result, null);
});
