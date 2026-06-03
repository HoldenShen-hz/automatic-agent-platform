import assert from "node:assert/strict";
import test from "node:test";

// Learn Pattern Detectors module barrel
import {
  detectLlmTruncation,
  detectModelHallucination,
  detectSchemaValidationLoop,
  detectToolPermissionDenial,
  FailurePatternSchema,
  FailurePatternTypeSchema,
} from "../../../../../../src/platform/five-plane-orchestration/learn/pattern-detectors/index.js";
import type { LearningSignal } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/dto.js";

function createSignal(overrides: Partial<LearningSignal> = {}): LearningSignal {
  return {
    learningSignalId: "signal-1",
    taskId: "task-1",
    sourceFeedbackId: "feedback-1",
    learningType: "failure_pattern",
    confidence: 0.9,
    valueSummary: "test signal",
    evidenceRefs: [],
    sourceSignalIds: [],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
    ...overrides,
  };
}

test("detectLlmTruncation is exported as function", () => {
  assert.equal(typeof detectLlmTruncation, "function");
});

test("detectModelHallucination is exported as function", () => {
  assert.equal(typeof detectModelHallucination, "function");
});

test("detectSchemaValidationLoop is exported as function", () => {
  assert.equal(typeof detectSchemaValidationLoop, "function");
});

test("detectToolPermissionDenial is exported as function", () => {
  assert.equal(typeof detectToolPermissionDenial, "function");
});

test("FailurePatternSchema is exported", () => {
  assert.ok(FailurePatternSchema !== undefined);
});

test("FailurePatternTypeSchema is exported", () => {
  assert.ok(FailurePatternTypeSchema !== undefined);
});

test("detectLlmTruncation can be called with valid input", () => {
  const result = detectLlmTruncation(createSignal({
    evidence: { modelId: "test", finishReason: "stop", maxTokens: 10, tokensUsed: 1 },
  }));
  assert.ok(result !== undefined);
});

test("detectModelHallucination can be called with valid input", () => {
  const result = detectModelHallucination(createSignal({
    evidence: { evalScore: 0.25, modelId: "test-model" },
  }));
  assert.ok(result !== undefined);
});

test("detectSchemaValidationLoop can be called with valid input", () => {
  const result = detectSchemaValidationLoop([
    createSignal({ evidence: { stepId: "step-1" } }),
    createSignal({ learningSignalId: "signal-2", evidence: { stepId: "step-1" } }),
    createSignal({ learningSignalId: "signal-3", evidence: { stepId: "step-1" } }),
  ]);
  assert.ok(result !== undefined);
});

test("detectToolPermissionDenial can be called with valid input", () => {
  const result = detectToolPermissionDenial(createSignal({
    valueSummary: "permission denied",
    evidence: { toolName: "test", errorCode: "permission_denied" },
  }));
  assert.ok(result !== undefined);
});
