import test from "node:test";
import assert from "node:assert/strict";

import { detectSchemaValidationLoop } from "../../../../../../../src/platform/five-plane-orchestration/oapeflir/learn/pattern-detectors/schema-loop-detector.js";
import { parseLearningSignal } from "../../../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { LearningSignal } from "../../../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function createLearningSignal(overrides: Partial<LearningSignal> = {}): LearningSignal {
  return parseLearningSignal({
    learningSignalId: "learn_1",
    taskId: "task_1",
    sourceFeedbackId: "fb_1",
    learningType: "failure_pattern",
    confidence: 0.8,
    valueSummary: "Schema validation failed",
    evidenceRefs: [],
    sourceSignalIds: ["sig_1"],
    relatedSignalIds: ["sig_1"],
    evidence: {},
    generatedAt: 1000,
    ...overrides,
  });
}

// =============================================================================
// detectSchemaValidationLoop tests
// =============================================================================

test("detectSchemaValidationLoop returns null for empty signals", () => {
  const result = detectSchemaValidationLoop([]);
  assert.equal(result, null);
});

test("detectSchemaValidationLoop returns null for non-failure_pattern signals", () => {
  const signals = [
    createLearningSignal({ learningType: "recovery_playbook" }),
  ];
  const result = detectSchemaValidationLoop(signals);
  assert.equal(result, null);
});

test("detectSchemaValidationLoop returns null when fewer than minOccurrences", () => {
  const signals = [
    createLearningSignal({ learningSignalId: "sig_1", learningType: "failure_pattern", evidence: { stepId: "step_1" } }),
    createLearningSignal({ learningSignalId: "sig_2", learningType: "failure_pattern", evidence: { stepId: "step_1" } }),
  ];
  const result = detectSchemaValidationLoop(signals, 3);
  assert.equal(result, null);
});

test("detectSchemaValidationLoop detects loop when threshold met", () => {
  const signals = [
    createLearningSignal({ learningSignalId: "sig_1", learningType: "failure_pattern", evidence: { stepId: "step_1" } }),
    createLearningSignal({ learningSignalId: "sig_2", learningType: "failure_pattern", evidence: { stepId: "step_1" } }),
    createLearningSignal({ learningSignalId: "sig_3", learningType: "failure_pattern", evidence: { stepId: "step_1" } }),
  ];
  const result = detectSchemaValidationLoop(signals, 3);
  assert.notEqual(result, null);
  assert.equal(result?.patternType, "schema_validation_loop");
  assert.equal(result?.taskId, "task_1");
});

test("detectSchemaValidationLoop groups by taskId:stepId", () => {
  const signals = [
    createLearningSignal({ learningSignalId: "sig_1", taskId: "task_1", learningType: "failure_pattern", evidence: { stepId: "step_1" } }),
    createLearningSignal({ learningSignalId: "sig_2", taskId: "task_1", learningType: "failure_pattern", evidence: { stepId: "step_1" } }),
    createLearningSignal({ learningSignalId: "sig_3", taskId: "task_1", learningType: "failure_pattern", evidence: { stepId: "step_1" } }),
  ];
  const result = detectSchemaValidationLoop(signals, 3);
  assert.notEqual(result, null);
  // All 3 signals form a loop on task_1:step_1
  assert.equal(result?.taskId, "task_1");
});

test("detectSchemaValidationLoop handles signals with missing stepId", () => {
  const signals = [
    createLearningSignal({ learningSignalId: "sig_1", learningType: "failure_pattern", evidence: {} }),
    createLearningSignal({ learningSignalId: "sig_2", learningType: "failure_pattern", evidence: {} }),
    createLearningSignal({ learningSignalId: "sig_3", learningType: "failure_pattern", evidence: {} }),
  ];
  const result = detectSchemaValidationLoop(signals, 3);
  // These have empty stepId, so they won't form a group
  assert.equal(result, null);
});

test("detectSchemaValidationLoop uses default minOccurrences of 3", () => {
  const signals = [
    createLearningSignal({ learningSignalId: "sig_1", learningType: "failure_pattern", evidence: { stepId: "step_1" } }),
    createLearningSignal({ learningSignalId: "sig_2", learningType: "failure_pattern", evidence: { stepId: "step_1" } }),
    createLearningSignal({ learningSignalId: "sig_3", learningType: "failure_pattern", evidence: { stepId: "step_1" } }),
  ];
  const result = detectSchemaValidationLoop(signals);
  assert.notEqual(result, null);
});
