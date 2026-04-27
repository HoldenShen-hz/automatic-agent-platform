import assert from "node:assert/strict";
import test from "node:test";

import type { LearningSignal } from "../../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { detectSchemaValidationLoop } from "../../../../../../src/platform/orchestration/learn/pattern-detectors/schema-loop-detector.js";

function makeSignal(taskId: string, stepId: string, learningType: LearningSignal["learningType"] = "failure_pattern"): LearningSignal {
  return {
    learningSignalId: `sig-${taskId}-${stepId}`,
    taskId,
    sourceFeedbackId: "fb-001",
    learningType,
    confidence: 0.8,
    valueSummary: "Schema validation failed",
    evidenceRefs: [],
    sourceSignalIds: [],
    relatedSignalIds: [],
    evidence: { stepId },
    generatedAt: Date.now(),
  };
}

test("detectSchemaValidationLoop detects 3+ failures on same step", () => {
  const signals: LearningSignal[] = [
    makeSignal("task-1", "step-a"),
    makeSignal("task-1", "step-a"),
    makeSignal("task-1", "step-a"),
  ];
  const result = detectSchemaValidationLoop(signals);

  assert.notStrictEqual(result, null);
  assert.strictEqual(result!.patternType, "schema_validation_loop");
  assert.strictEqual(result!.stepId, "step-a");
  assert.ok(result!.title.includes("3 repair attempts"));
});

test("detectSchemaValidationLoop ignores signals below threshold", () => {
  const signals: LearningSignal[] = [
    makeSignal("task-1", "step-a"),
    makeSignal("task-1", "step-a"),
  ];
  const result = detectSchemaValidationLoop(signals);

  assert.strictEqual(result, null);
});

test("detectSchemaValidationLoop ignores non-failure_pattern signals", () => {
  const signals: LearningSignal[] = [
    makeSignal("task-1", "step-a", "failure_pattern"),
    makeSignal("task-1", "step-a", "failure_pattern"),
    makeSignal("task-1", "step-a", "user_correction"),
  ];
  const result = detectSchemaValidationLoop(signals, 3);

  assert.strictEqual(result, null);
});

test("detectSchemaValidationLoop groups by taskId and stepId", () => {
  const signals: LearningSignal[] = [
    makeSignal("task-1", "step-a"),
    makeSignal("task-1", "step-a"),
    makeSignal("task-1", "step-a"),
    makeSignal("task-2", "step-a"),
    makeSignal("task-2", "step-a"),
  ];
  const result = detectSchemaValidationLoop(signals, 3);

  assert.notStrictEqual(result, null);
  assert.strictEqual(result!.taskId, "task-1");
});

test("detectSchemaValidationLoop ignores signals with empty stepId", () => {
  const signals: LearningSignal[] = [
    { ...makeSignal("task-1", ""), evidence: {} },
    { ...makeSignal("task-1", ""), evidence: {} },
    { ...makeSignal("task-1", ""), evidence: {} },
  ];
  const result = detectSchemaValidationLoop(signals);

  assert.strictEqual(result, null);
});

test("detectSchemaValidationLoop respects custom minOccurrences", () => {
  const signals: LearningSignal[] = [
    makeSignal("task-1", "step-a"),
    makeSignal("task-1", "step-a"),
    makeSignal("task-1", "step-a"),
    makeSignal("task-1", "step-a"),
  ];
  const result = detectSchemaValidationLoop(signals, 5);

  assert.strictEqual(result, null);
});

test("detectSchemaValidationLoop returns correct recommendation", () => {
  const signals: LearningSignal[] = [
    makeSignal("task-1", "step-a"),
    makeSignal("task-1", "step-a"),
    makeSignal("task-1", "step-a"),
  ];
  const result = detectSchemaValidationLoop(signals);

  assert.notStrictEqual(result, null);
  assert.ok(result!.recommendation.includes("schema") || result!.recommendation.includes("model"));
});
