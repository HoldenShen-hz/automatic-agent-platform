import test from "node:test";
import assert from "node:assert/strict";

import { detectToolPermissionDenial } from "../../../../../../../src/platform/five-plane-orchestration/oapeflir/learn/pattern-detectors/permission-detector.js";
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
// detectToolPermissionDenial tests
// =============================================================================

test("detectToolPermissionDenial returns null when no denial pattern", () => {
  const signal = createLearningSignal({ valueSummary: "Tool executed successfully" });
  const result = detectToolPermissionDenial(signal);
  assert.equal(result, null);
});

test("detectToolPermissionDenial detects permission denied", () => {
  const signal = createLearningSignal({ valueSummary: "permission denied for tool", evidence: { toolName: "bash" } });
  const result = detectToolPermissionDenial(signal);
  assert.notEqual(result, null);
  assert.equal(result?.patternType, "tool_permission_denial");
});

test("detectToolPermissionDenial detects permission_denied", () => {
  const signal = createLearningSignal({ valueSummary: "operation failed: permission_denied" });
  const result = detectToolPermissionDenial(signal);
  assert.notEqual(result, null);
  assert.equal(result?.patternType, "tool_permission_denial");
});

test("detectToolPermissionDenial detects access denied", () => {
  const signal = createLearningSignal({ valueSummary: "access denied to resource" });
  const result = detectToolPermissionDenial(signal);
  assert.notEqual(result, null);
  assert.equal(result?.patternType, "tool_permission_denial");
});

test("detectToolPermissionDenial detects forbidden", () => {
  const signal = createLearningSignal({ valueSummary: "403 forbidden" });
  const result = detectToolPermissionDenial(signal);
  assert.notEqual(result, null);
  assert.equal(result?.patternType, "tool_permission_denial");
});

test("detectToolPermissionDenial detects EPERM", () => {
  const signal = createLearningSignal({ valueSummary: "EPERM: operation not permitted" });
  const result = detectToolPermissionDenial(signal);
  assert.notEqual(result, null);
  assert.equal(result?.patternType, "tool_permission_denial");
});

test("detectToolPermissionDenial detects eacces", () => {
  const signal = createLearningSignal({ valueSummary: "error: eacces permission denied" });
  const result = detectToolPermissionDenial(signal);
  assert.notEqual(result, null);
  assert.equal(result?.patternType, "tool_permission_denial");
});

test("detectToolPermissionDenial detects sandbox", () => {
  const signal = createLearningSignal({ valueSummary: "sandbox policy blocked execution" });
  const result = detectToolPermissionDenial(signal);
  assert.notEqual(result, null);
  assert.equal(result?.patternType, "tool_permission_denial");
});

test("detectToolPermissionDenial extracts toolName from evidence", () => {
  const signal = createLearningSignal({
    valueSummary: "permission denied",
    evidence: { toolName: "Read" },
  });
  const result = detectToolPermissionDenial(signal);
  assert.notEqual(result, null);
  assert.ok(result?.title.includes("Read"));
});

test("detectToolPermissionDenial uses 'unknown' when toolName missing", () => {
  const signal = createLearningSignal({ valueSummary: "permission denied" });
  const result = detectToolPermissionDenial(signal);
  assert.notEqual(result, null);
  assert.ok(result?.title.includes("unknown"));
});

test("detectToolPermissionDenial case insensitive matching", () => {
  const signal = createLearningSignal({ valueSummary: "PERMISSION DENIED" });
  const result = detectToolPermissionDenial(signal);
  assert.notEqual(result, null);
  assert.equal(result?.patternType, "tool_permission_denial");
});

test("detectToolPermissionDenial detects requires approval", () => {
  const signal = createLearningSignal({ valueSummary: "operation requires approval" });
  const result = detectToolPermissionDenial(signal);
  assert.notEqual(result, null);
  assert.equal(result?.patternType, "tool_permission_denial");
});
