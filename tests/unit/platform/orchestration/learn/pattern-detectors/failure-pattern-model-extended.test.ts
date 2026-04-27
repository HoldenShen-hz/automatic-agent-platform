/**
 * Unit tests for FailurePatternModel
 * Tests the schema validation and type definitions
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  FailurePatternTypeSchema,
  FailurePatternSchema,
} from "../../../../../../src/platform/orchestration/learn/pattern-detectors/failure-pattern-model.js";

test("FailurePatternTypeSchema accepts llm_truncation", () => {
  const result = FailurePatternTypeSchema.safeParse("llm_truncation");
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.equal(result.data, "llm_truncation");
  }
});

test("FailurePatternTypeSchema accepts schema_validation_loop", () => {
  const result = FailurePatternTypeSchema.safeParse("schema_validation_loop");
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.equal(result.data, "schema_validation_loop");
  }
});

test("FailurePatternTypeSchema accepts tool_permission_denial", () => {
  const result = FailurePatternTypeSchema.safeParse("tool_permission_denial");
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.equal(result.data, "tool_permission_denial");
  }
});

test("FailurePatternTypeSchema accepts model_hallucination", () => {
  const result = FailurePatternTypeSchema.safeParse("model_hallucination");
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.equal(result.data, "model_hallucination");
  }
});

test("FailurePatternTypeSchema accepts generic_failure", () => {
  const result = FailurePatternTypeSchema.safeParse("generic_failure");
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.equal(result.data, "generic_failure");
  }
});

test("FailurePatternTypeSchema rejects invalid type", () => {
  const result = FailurePatternTypeSchema.safeParse("invalid_type");
  assert.strictEqual(result.success, false);
});

test("FailurePatternTypeSchema rejects empty string", () => {
  const result = FailurePatternTypeSchema.safeParse("");
  assert.strictEqual(result.success, false);
});

test("FailurePatternSchema accepts valid pattern with all fields", () => {
  const pattern = {
    patternType: "llm_truncation" as const,
    taskId: "task-123",
    stepId: "step-456",
    title: "LLM output truncated",
    summary: "Model output was truncated at max_tokens",
    evidenceRefs: ["evidence-1", "evidence-2"],
    sourceSignalIds: ["signal-1"],
    recommendation: "Increase max_tokens",
    detectedAt: Date.now(),
  };
  const result = FailurePatternSchema.safeParse(pattern);
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.equal(result.data.patternType, "llm_truncation");
    assert.equal(result.data.taskId, "task-123");
    assert.equal(result.data.stepId, "step-456");
  }
});

test("FailurePatternSchema accepts pattern without optional stepId", () => {
  const pattern = {
    patternType: "generic_failure" as const,
    taskId: "task-123",
    title: "Generic failure",
    summary: "Something went wrong",
    recommendation: "Retry",
    detectedAt: Date.now(),
  };
  const result = FailurePatternSchema.safeParse(pattern);
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.data.stepId, undefined);
  }
});

test("FailurePatternSchema applies default values to evidenceRefs", () => {
  const pattern = {
    patternType: "model_hallucination" as const,
    taskId: "task-123",
    title: "Hallucination",
    summary: "Model hallucinated",
    recommendation: "Use factual data",
    detectedAt: Date.now(),
  };
  const result = FailurePatternSchema.safeParse(pattern);
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.deepStrictEqual(result.data.evidenceRefs, []);
  }
});

test("FailurePatternSchema applies default values to sourceSignalIds", () => {
  const pattern = {
    patternType: "tool_permission_denial" as const,
    taskId: "task-123",
    title: "Permission denied",
    summary: "Tool permission denied",
    recommendation: "Request permission",
    detectedAt: Date.now(),
  };
  const result = FailurePatternSchema.safeParse(pattern);
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.deepStrictEqual(result.data.sourceSignalIds, []);
  }
});

test("FailurePatternSchema rejects missing taskId", () => {
  const pattern = {
    patternType: "llm_truncation" as const,
    title: "Truncated",
    summary: "Summary",
    recommendation: "Rec",
    detectedAt: Date.now(),
  };
  const result = FailurePatternSchema.safeParse(pattern);
  assert.strictEqual(result.success, false);
});

test("FailurePatternSchema rejects empty taskId", () => {
  const pattern = {
    patternType: "llm_truncation" as const,
    taskId: "",
    title: "Truncated",
    summary: "Summary",
    recommendation: "Rec",
    detectedAt: Date.now(),
  };
  const result = FailurePatternSchema.safeParse(pattern);
  assert.strictEqual(result.success, false);
});

test("FailurePatternSchema rejects missing title", () => {
  const pattern = {
    patternType: "llm_truncation" as const,
    taskId: "task-123",
    summary: "Summary",
    recommendation: "Rec",
    detectedAt: Date.now(),
  };
  const result = FailurePatternSchema.safeParse(pattern);
  assert.strictEqual(result.success, false);
});

test("FailurePatternSchema rejects empty title", () => {
  const pattern = {
    patternType: "llm_truncation" as const,
    taskId: "task-123",
    title: "",
    summary: "Summary",
    recommendation: "Rec",
    detectedAt: Date.now(),
  };
  const result = FailurePatternSchema.safeParse(pattern);
  assert.strictEqual(result.success, false);
});

test("FailurePatternSchema rejects missing summary", () => {
  const pattern = {
    patternType: "llm_truncation" as const,
    taskId: "task-123",
    title: "Title",
    recommendation: "Rec",
    detectedAt: Date.now(),
  };
  const result = FailurePatternSchema.safeParse(pattern);
  assert.strictEqual(result.success, false);
});

test("FailurePatternSchema rejects empty summary", () => {
  const pattern = {
    patternType: "llm_truncation" as const,
    taskId: "task-123",
    title: "Title",
    summary: "",
    recommendation: "Rec",
    detectedAt: Date.now(),
  };
  const result = FailurePatternSchema.safeParse(pattern);
  assert.strictEqual(result.success, false);
});

test("FailurePatternSchema rejects missing recommendation", () => {
  const pattern = {
    patternType: "llm_truncation" as const,
    taskId: "task-123",
    title: "Title",
    summary: "Summary",
    detectedAt: Date.now(),
  };
  const result = FailurePatternSchema.safeParse(pattern);
  assert.strictEqual(result.success, false);
});

test("FailurePatternSchema rejects negative detectedAt", () => {
  const pattern = {
    patternType: "llm_truncation" as const,
    taskId: "task-123",
    title: "Title",
    summary: "Summary",
    recommendation: "Rec",
    detectedAt: -1,
  };
  const result = FailurePatternSchema.safeParse(pattern);
  assert.strictEqual(result.success, false);
});

test("FailurePatternSchema accepts zero detectedAt", () => {
  const pattern = {
    patternType: "llm_truncation" as const,
    taskId: "task-123",
    title: "Title",
    summary: "Summary",
    recommendation: "Rec",
    detectedAt: 0,
  };
  const result = FailurePatternSchema.safeParse(pattern);
  assert.strictEqual(result.success, true);
});

test("FailurePatternSchema accepts large detectedAt", () => {
  const pattern = {
    patternType: "llm_truncation" as const,
    taskId: "task-123",
    title: "Title",
    summary: "Summary",
    recommendation: "Rec",
    detectedAt: Number.MAX_SAFE_INTEGER,
  };
  const result = FailurePatternSchema.safeParse(pattern);
  assert.strictEqual(result.success, true);
});

test("FailurePatternSchema rejects invalid patternType", () => {
  const pattern = {
    patternType: "invalid_pattern" as any,
    taskId: "task-123",
    title: "Title",
    summary: "Summary",
    recommendation: "Rec",
    detectedAt: Date.now(),
  };
  const result = FailurePatternSchema.safeParse(pattern);
  assert.strictEqual(result.success, false);
});

test("FailurePatternSchema accepts all valid pattern types", () => {
  const types = ["llm_truncation", "schema_validation_loop", "tool_permission_denial", "model_hallucination", "generic_failure"] as const;
  for (const patternType of types) {
    const pattern = {
      patternType,
      taskId: "task-123",
      title: "Title",
      summary: "Summary",
      recommendation: "Rec",
      detectedAt: Date.now(),
    };
    const result = FailurePatternSchema.safeParse(pattern);
    assert.strictEqual(result.success, true, `Failed for patternType: ${patternType}`);
  }
});

test("FailurePatternSchema accepts pattern with empty evidenceRefs array", () => {
  const pattern = {
    patternType: "llm_truncation" as const,
    taskId: "task-123",
    title: "Title",
    summary: "Summary",
    recommendation: "Rec",
    detectedAt: Date.now(),
    evidenceRefs: [],
  };
  const result = FailurePatternSchema.safeParse(pattern);
  assert.strictEqual(result.success, true);
});

test("FailurePatternSchema accepts pattern with empty sourceSignalIds array", () => {
  const pattern = {
    patternType: "llm_truncation" as const,
    taskId: "task-123",
    title: "Title",
    summary: "Summary",
    recommendation: "Rec",
    detectedAt: Date.now(),
    sourceSignalIds: [],
  };
  const result = FailurePatternSchema.safeParse(pattern);
  assert.strictEqual(result.success, true);
});
