import assert from "node:assert/strict";
import test from "node:test";

import type { LearningSignal } from "../../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { detectLlmTruncation } from "../../../../../../src/platform/five-plane-orchestration/learn/pattern-detectors/truncation-detector.js";

function makeSignal(overrides: Partial<LearningSignal["evidence"]> & {
  finishReason?: string;
  maxTokens?: number;
  tokensUsed?: number;
}): LearningSignal {
  return {
    learningSignalId: "sig-001",
    taskId: "task-001",
    sourceFeedbackId: "fb-001",
    learningType: "failure_pattern",
    confidence: 0.8,
    valueSummary: "Output may be incomplete",
    evidenceRefs: [],
    sourceSignalIds: [],
    relatedSignalIds: [],
    evidence: {
      finishReason: "stop",
      maxTokens: 1000,
      tokensUsed: 500,
      stepId: "step-1",
      ...overrides,
    },
    generatedAt: Date.now(),
  };
}

test("detectLlmTruncation detects explicit finish_reason=length", () => {
  const signal = makeSignal({ finishReason: "length" }) as LearningSignal;
  const result = detectLlmTruncation(signal);

  assert.notStrictEqual(result, null);
  assert.strictEqual(result!.patternType, "llm_truncation");
  assert.ok(result!.title.includes("max_tokens"));
});

test("detectLlmTruncation detects near token limit (>95%)", () => {
  const signal = makeSignal({
    finishReason: "stop",
    maxTokens: 1000,
    tokensUsed: 960,
  }) as LearningSignal;
  const result = detectLlmTruncation(signal);

  assert.notStrictEqual(result, null);
  assert.strictEqual(result!.patternType, "llm_truncation");
  assert.ok(result!.title.includes("near token limit"));
});

test("detectLlmTruncation ignores low token usage", () => {
  const signal = makeSignal({
    maxTokens: 1000,
    tokensUsed: 500,
  }) as LearningSignal;
  const result = detectLlmTruncation(signal);

  assert.strictEqual(result, null);
});

test("detectLlmTruncation ignores zero maxTokens", () => {
  const signal = makeSignal({
    maxTokens: 0,
    tokensUsed: 0,
  }) as LearningSignal;
  const result = detectLlmTruncation(signal);

  assert.strictEqual(result, null);
});

test("detectLlmTruncation uses alternative field names", () => {
  const signal = {
    learningSignalId: "sig-001",
    taskId: "task-001",
    sourceFeedbackId: "fb-001",
    learningType: "failure_pattern" as const,
    confidence: 0.8,
    valueSummary: "Output truncated",
    evidenceRefs: [],
    sourceSignalIds: [],
    relatedSignalIds: [],
    evidence: {
      finish_reason: "length",
      max_tokens: 500,
      tokens_used: 500,
    },
    generatedAt: Date.now(),
  };
  const result = detectLlmTruncation(signal);

  assert.notStrictEqual(result, null);
});

test("detectLlmTruncation returns correct recommendation", () => {
  const signal = makeSignal({
    finishReason: "length",
    maxTokens: 1000,
    tokensUsed: 1000,
  }) as LearningSignal;
  const result = detectLlmTruncation(signal);

  assert.notStrictEqual(result, null);
  assert.ok(result!.recommendation.includes("max_tokens") || result!.recommendation.includes("prompt"));
});
