import assert from "node:assert/strict";
import test from "node:test";

import {
  FailurePatternSchema,
  FailurePatternTypeSchema,
} from "../../../../../../src/platform/orchestration/learn/pattern-detectors/failure-pattern-model.js";

test("FailurePatternTypeSchema accepts valid pattern types", () => {
  const types = [
    "llm_truncation",
    "schema_validation_loop",
    "tool_permission_denial",
    "model_hallucination",
    "generic_failure",
  ];

  for (const type of types) {
    const result = FailurePatternTypeSchema.safeParse(type);
    assert.strictEqual(result.success, true, `Expected ${type} to be valid`);
  }
});

test("FailurePatternTypeSchema rejects invalid pattern types", () => {
  const result = FailurePatternTypeSchema.safeParse("invalid_type");
  assert.strictEqual(result.success, false);
});

test("FailurePatternSchema accepts valid failure pattern", () => {
  const validPattern = {
    patternType: "llm_truncation",
    taskId: "task-001",
    stepId: "step-1",
    title: "LLM output truncated",
    summary: "Model output was truncated at max_tokens",
    evidenceRefs: ["ref-1", "ref-2"],
    sourceSignalIds: ["sig-1"],
    recommendation: "Increase max_tokens",
    detectedAt: Date.now(),
  };

  const result = FailurePatternSchema.safeParse(validPattern);
  assert.strictEqual(result.success, true);
});

test("FailurePatternSchema applies default values", () => {
  const partialPattern = {
    patternType: "model_hallucination",
    taskId: "task-001",
    title: "Hallucination detected",
    summary: "Model produced low quality output",
    recommendation: "Switch model",
    detectedAt: Date.now(),
  };

  const result = FailurePatternSchema.safeParse(partialPattern);
  assert.strictEqual(result.success, true);
  assert.deepStrictEqual(result.data!.evidenceRefs, []);
  assert.deepStrictEqual(result.data!.sourceSignalIds, []);
});

test("FailurePatternSchema rejects missing required fields", () => {
  const invalidPattern = {
    patternType: "llm_truncation",
    // missing taskId
    title: "Test",
    summary: "Test",
    recommendation: "Test",
    detectedAt: Date.now(),
  };

  const result = FailurePatternSchema.safeParse(invalidPattern);
  assert.strictEqual(result.success, false);
});

test("FailurePatternSchema rejects empty taskId", () => {
  const invalidPattern = {
    patternType: "llm_truncation",
    taskId: "",
    title: "Test",
    summary: "Test",
    recommendation: "Test",
    detectedAt: Date.now(),
  };

  const result = FailurePatternSchema.safeParse(invalidPattern);
  assert.strictEqual(result.success, false);
});

test("FailurePatternSchema rejects negative detectedAt", () => {
  const invalidPattern = {
    patternType: "llm_truncation",
    taskId: "task-001",
    title: "Test",
    summary: "Test",
    recommendation: "Test",
    detectedAt: -1,
  };

  const result = FailurePatternSchema.safeParse(invalidPattern);
  assert.strictEqual(result.success, false);
});

test("FailurePatternSchema accepts optional stepId", () => {
  const patternWithoutStepId = {
    patternType: "generic_failure",
    taskId: "task-001",
    title: "Generic failure",
    summary: "A failure occurred",
    recommendation: "Retry",
    detectedAt: Date.now(),
  };

  const result = FailurePatternSchema.safeParse(patternWithoutStepId);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.data!.stepId, undefined);
});
