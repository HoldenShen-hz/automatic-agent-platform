import assert from "node:assert/strict";
import test from "node:test";

import type { LearningSignal } from "../../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import { detectToolPermissionDenial } from "../../../../../../src/platform/orchestration/learn/pattern-detectors/permission-detector.js";

function makeSignal(valueSummary: string, evidence: Record<string, unknown> = {}): LearningSignal {
  return {
    learningSignalId: "sig-001",
    taskId: "task-001",
    sourceFeedbackId: "fb-001",
    learningType: "failure_pattern",
    confidence: 0.8,
    valueSummary,
    evidenceRefs: [],
    sourceSignalIds: [],
    relatedSignalIds: [],
    evidence,
    generatedAt: Date.now(),
  };
}

test("detectToolPermissionDenial detects permission denied in valueSummary", () => {
  const signal = makeSignal("permission denied", { toolName: "bash" });
  const result = detectToolPermissionDenial(signal);

  assert.notStrictEqual(result, null);
  assert.strictEqual(result!.patternType, "tool_permission_denial");
});

test("detectToolPermissionDenial detects EPERM", () => {
  const signal = makeSignal("EPERM: operation not permitted", { toolName: "write" });
  const result = detectToolPermissionDenial(signal);

  assert.notStrictEqual(result, null);
  assert.strictEqual(result!.patternType, "tool_permission_denial");
});

test("detectToolPermissionDenial detects access denied", () => {
  const signal = makeSignal("access denied for tool execute", { tool: "curl" });
  const result = detectToolPermissionDenial(signal);

  assert.notStrictEqual(result, null);
});

test("detectToolPermissionDenial detects sandbox block", () => {
  const signal = makeSignal("sandbox policy prevented execution", {});
  const result = detectToolPermissionDenial(signal);

  assert.notStrictEqual(result, null);
});

test("detectToolPermissionDenial ignores unrelated errors", () => {
  const signal = makeSignal("Connection timeout", { toolName: "http" });
  const result = detectToolPermissionDenial(signal);

  assert.strictEqual(result, null);
});

test("detectToolPermissionDenial case insensitive", () => {
  const signal = makeSignal("PERMISSION DENIED", { toolName: "bash" });
  const result = detectToolPermissionDenial(signal);

  assert.notStrictEqual(result, null);
});

test("detectToolPermissionDenial handles missing tool name", () => {
  const signal = makeSignal("permission denied", {});
  const result = detectToolPermissionDenial(signal);

  assert.notStrictEqual(result, null);
  assert.ok(result!.title.includes("unknown"));
});

test("detectToolPermissionDenial returns correct recommendation", () => {
  const signal = makeSignal("forbidden operation", { toolName: "exec" });
  const result = detectToolPermissionDenial(signal);

  assert.notStrictEqual(result, null);
  assert.ok(result!.recommendation.includes("sandbox") || result!.recommendation.includes("HITL"));
});
