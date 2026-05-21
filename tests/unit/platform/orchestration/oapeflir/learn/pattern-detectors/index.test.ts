import assert from "node:assert/strict";
import test from "node:test";

// OAPEFLIR Pattern Detectors barrel test - imports from the pattern-detectors module index
import * as PatternDetectors from "../../../../../../src/platform/five-plane-orchestration/oapeflir/learn/pattern-detectors/index.js";

test("PatternDetectors module is exported", () => {
  assert.ok(PatternDetectors !== undefined);
  assert.equal(typeof PatternDetectors, "object");
});

test("detectLlmTruncation is exported as function", () => {
  assert.equal(typeof PatternDetectors.detectLlmTruncation, "function");
});

test("detectToolPermissionDenial is exported as function", () => {
  assert.equal(typeof PatternDetectors.detectToolPermissionDenial, "function");
});

test("detectModelHallucination is exported as function", () => {
  assert.equal(typeof PatternDetectors.detectModelHallucination, "function");
});

test("detectSchemaValidationLoop is exported as function", () => {
  assert.equal(typeof PatternDetectors.detectSchemaValidationLoop, "function");
});

test("FailurePatternModel is exported", () => {
  assert.ok(PatternDetectors.FailurePatternModel !== undefined);
  assert.equal(typeof PatternDetectors.FailurePatternModel, "function");
});

test("FailurePatternType type is exported", () => {
  assert.ok(PatternDetectors.FailurePatternType !== undefined);
});

test("FailurePatternSeverity type is exported", () => {
  assert.ok(PatternDetectors.FailurePatternSeverity !== undefined);
});

test("HallucinationPattern type is exported", () => {
  assert.ok(PatternDetectors.HallucinationPattern !== undefined);
});

test("TruncationPattern type is exported", () => {
  assert.ok(PatternDetectors.TruncationPattern !== undefined);
});

test("PermissionDenialPattern type is exported", () => {
  assert.ok(PatternDetectors.PermissionDenialPattern !== undefined);
});

test("SchemaValidationLoopPattern type is exported", () => {
  assert.ok(PatternDetectors.SchemaValidationLoopPattern !== undefined);
});

test("FailurePatternSchema is exported", () => {
  assert.ok(PatternDetectors.FailurePatternSchema !== undefined);
});

test("HallucinationPatternSchema is exported", () => {
  assert.ok(PatternDetectors.HallucinationPatternSchema !== undefined);
});

test("TruncationPatternSchema is exported", () => {
  assert.ok(PatternDetectors.TruncationPatternSchema !== undefined);
});

test("PermissionDenialPatternSchema is exported", () => {
  assert.ok(PatternDetectors.PermissionDenialPatternSchema !== undefined);
});

test("SchemaValidationLoopPatternSchema is exported", () => {
  assert.ok(PatternDetectors.SchemaValidationLoopPatternSchema !== undefined);
});

// Test that detector functions return expected results for basic cases
test("detectLlmTruncation returns null for valid signal", () => {
  const result = PatternDetectors.detectLlmTruncation({
    learningSignalId: "sig_1",
    taskId: "task_1",
    sourceFeedbackId: "fb_1",
    learningType: "failure_pattern" as const,
    confidence: 0.8,
    valueSummary: "Normal completion",
    evidenceRefs: [],
    sourceSignalIds: [],
    relatedSignalIds: [],
    evidence: { finishReason: "stop", maxTokens: 1000, tokensUsed: 500 },
    generatedAt: Date.now(),
  });
  assert.equal(result, null);
});

test("detectToolPermissionDenial returns null for safe signal", () => {
  const result = PatternDetectors.detectToolPermissionDenial({
    learningSignalId: "sig_2",
    taskId: "task_2",
    sourceFeedbackId: "fb_2",
    learningType: "failure_pattern" as const,
    confidence: 0.8,
    valueSummary: "Tool completed successfully",
    evidenceRefs: [],
    sourceSignalIds: [],
    relatedSignalIds: [],
    evidence: { toolName: "Read" },
    generatedAt: Date.now(),
  });
  assert.equal(result, null);
});

test("detectModelHallucination returns null for high evalScore", () => {
  const result = PatternDetectors.detectModelHallucination({
    learningSignalId: "sig_3",
    taskId: "task_3",
    sourceFeedbackId: "fb_3",
    learningType: "failure_pattern" as const,
    confidence: 0.8,
    valueSummary: "Good quality output",
    evidenceRefs: [],
    sourceSignalIds: [],
    relatedSignalIds: [],
    evidence: { evalScore: 0.8, modelId: "claude-3" },
    generatedAt: Date.now(),
  });
  assert.equal(result, null);
});

test("detectSchemaValidationLoop returns null for empty signals array", () => {
  const result = PatternDetectors.detectSchemaValidationLoop([]);
  assert.equal(result, null);
});