import assert from "node:assert/strict";
import test from "node:test";

import type { LearningSignal } from "../../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { detectModelHallucination } from "../../../../../../src/platform/orchestration/learn/pattern-detectors/hallucination-detector.js";

function makeSignal(overrides: Partial<LearningSignal["evidence"]> & {
  evalScore?: number;
  learningSignalId?: string;
  taskId?: string;
  valueSummary?: string;
}): LearningSignal {
  return {
    learningSignalId: "sig-001",
    taskId: "task-001",
    sourceFeedbackId: "fb-001",
    learningType: "failure_pattern",
    confidence: 0.8,
    valueSummary: "Low quality output detected",
    evidenceRefs: [],
    sourceSignalIds: [],
    relatedSignalIds: [],
    evidence: {
      evalScore: 0,
      modelId: "claude-3",
      stepId: "step-1",
      ...overrides,
    },
    generatedAt: Date.now(),
  };
}

test("detectModelHallucination detects low eval score", () => {
  const signal = makeSignal({ evalScore: 0.2 }) as LearningSignal;
  const result = detectModelHallucination(signal);

  assert.notStrictEqual(result, null);
  assert.strictEqual(result!.patternType, "model_hallucination");
  assert.strictEqual(result!.taskId, "task-001");
});

test("detectModelHallucination ignores high eval score", () => {
  const signal = makeSignal({ evalScore: 0.5 }) as LearningSignal;
  const result = detectModelHallucination(signal);

  assert.strictEqual(result, null);
});

test("detectModelHallucination ignores zero eval score", () => {
  const signal = makeSignal({ evalScore: 0 }) as LearningSignal;
  const result = detectModelHallucination(signal);

  assert.strictEqual(result, null);
});

test("detectModelHallucination uses qualityScore when evalScore is absent", () => {
  // When evalScore is not present (undefined), qualityScore should be used
  const signal = {
    learningSignalId: "sig-001",
    taskId: "task-001",
    sourceFeedbackId: "fb-001",
    learningType: "failure_pattern" as const,
    confidence: 0.8,
    valueSummary: "Low quality output detected",
    evidenceRefs: [],
    sourceSignalIds: [],
    relatedSignalIds: [],
    evidence: {
      qualityScore: 0.2,
      modelId: "claude-3",
      stepId: "step-1",
    },
    generatedAt: Date.now(),
  };
  const result = detectModelHallucination(signal);

  assert.notStrictEqual(result, null);
  assert.strictEqual(result!.patternType, "model_hallucination");
});

test("detectModelHallucination handles missing modelId", () => {
  const signal = makeSignal({ evalScore: 0.1 }) as LearningSignal;
  delete (signal.evidence as Record<string, unknown>).modelId;
  delete (signal.evidence as Record<string, unknown>).model;
  const result = detectModelHallucination(signal);

  assert.notStrictEqual(result, null);
  assert.ok(result!.summary.includes("\"unknown\""));
});

test("detectModelHallucination returns correct recommendation", () => {
  const signal = makeSignal({ evalScore: 0.15 }) as LearningSignal;
  const result = detectModelHallucination(signal);

  assert.notStrictEqual(result, null);
  assert.ok(result!.recommendation.includes("grounding context"));
});
