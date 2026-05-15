import test from "node:test";
import assert from "node:assert/strict";

import { detectModelHallucination } from "../../../../../../../src/platform/five-plane-orchestration/oapeflir/learn/pattern-detectors/hallucination-detector.js";
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
// detectModelHallucination tests
// =============================================================================

test("detectModelHallucination returns null when evalScore >= 0.3", () => {
  const signal = createLearningSignal({ evidence: { evalScore: 0.5 } });
  const result = detectModelHallucination(signal);
  assert.equal(result, null);
});

test("detectModelHallucination returns null when evalScore is exactly 0", () => {
  const signal = createLearningSignal({ evidence: { evalScore: 0 } });
  const result = detectModelHallucination(signal);
  assert.equal(result, null);
});

test("detectModelHallucination detects low evalScore below 0.3", () => {
  const signal = createLearningSignal({ evidence: { evalScore: 0.2 } });
  const result = detectModelHallucination(signal);
  assert.notEqual(result, null);
  assert.equal(result?.patternType, "model_hallucination");
  assert.ok(result?.title.includes("0.20"));
});

test("detectModelHallucination handles eval_score field name", () => {
  const signal = createLearningSignal({ evidence: { eval_score: 0.15 } });
  const result = detectModelHallucination(signal);
  assert.notEqual(result, null);
  assert.equal(result?.patternType, "model_hallucination");
});

test("detectModelHallucination handles qualityScore as fallback", () => {
  const signal = createLearningSignal({ evidence: { qualityScore: 0.1 } });
  const result = detectModelHallucination(signal);
  assert.notEqual(result, null);
  assert.equal(result?.patternType, "model_hallucination");
});

test("detectModelHallucination includes modelId in summary", () => {
  const signal = createLearningSignal({ evidence: { evalScore: 0.2, modelId: "claude-3-opus" } });
  const result = detectModelHallucination(signal);
  assert.notEqual(result, null);
  assert.ok(result?.summary.includes("claude-3-opus"));
});

test("detectModelHallucination handles missing modelId", () => {
  const signal = createLearningSignal({ evidence: { evalScore: 0.2 } });
  const result = detectModelHallucination(signal);
  assert.notEqual(result, null);
  assert.ok(result?.summary.includes('"unknown"'));
});

test("detectModelHallucination threshold boundary at 0.3", () => {
  const signal = createLearningSignal({ evidence: { evalScore: 0.3 } });
  const result = detectModelHallucination(signal);
  // evalScore >= 0.3 should not trigger
  assert.equal(result, null);
});

test("detectModelHallucination threshold just below 0.3", () => {
  const signal = createLearningSignal({ evidence: { evalScore: 0.29 } });
  const result = detectModelHallucination(signal);
  assert.notEqual(result, null);
  assert.equal(result?.patternType, "model_hallucination");
});
