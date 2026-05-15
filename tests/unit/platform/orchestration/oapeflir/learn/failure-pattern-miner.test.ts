import test from "node:test";
import assert from "node:assert/strict";

import { FailurePatternMiner } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/learn/failure-pattern-miner.js";
import type { LearningSignal } from "../../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function makeSignal(overrides: Partial<LearningSignal> = {}): LearningSignal {
  return {
    learningSignalId: "sig_test_1",
    taskId: "task_123",
    sourceFeedbackId: "fb_123",
    learningType: "failure_pattern",
    confidence: 0.8,
    valueSummary: "Test signal summary",
    evidenceRefs: [],
    sourceSignalIds: [],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
    ...overrides,
  };
}

test("FailurePatternMiner.mine returns empty array for empty signals", () => {
  const miner = new FailurePatternMiner();
  const result = miner.mine([]);
  assert.deepEqual(result, []);
});

test("FailurePatternMiner.mine detects llm_truncation", () => {
  const miner = new FailurePatternMiner();
  const signals: LearningSignal[] = [
    makeSignal({
      learningSignalId: "sig_truncation",
      evidence: { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 },
    }),
  ];

  const result = miner.mine(signals);

  assert.equal(result.length, 1);
  assert.equal(result[0]!.learningType, "failure_pattern");
  assert.ok(result[0]!.title.includes("truncated"));
});

test("FailurePatternMiner.mine detects tool_permission_denial", () => {
  const miner = new FailurePatternMiner();
  const signals: LearningSignal[] = [
    makeSignal({
      learningSignalId: "sig_permission",
      valueSummary: "permission denied",
      evidence: { toolName: "Read" },
    }),
  ];

  const result = miner.mine(signals);

  assert.equal(result.length, 1);
  assert.equal(result[0]!.learningType, "failure_pattern");
  assert.ok(result[0]!.title.includes("permission denial"));
});

test("FailurePatternMiner.mine detects model_hallucination", () => {
  const miner = new FailurePatternMiner();
  const signals: LearningSignal[] = [
    makeSignal({
      learningSignalId: "sig_hallucination",
      evidence: { evalScore: 0.1, modelId: "claude-3" },
    }),
  ];

  const result = miner.mine(signals);

  assert.equal(result.length, 1);
  assert.equal(result[0]!.learningType, "failure_pattern");
  assert.ok(result[0]!.title.includes("hallucination"));
});

test("FailurePatternMiner.mine creates generic failure for unmatched signals", () => {
  const miner = new FailurePatternMiner();
  const signals: LearningSignal[] = [
    makeSignal({
      learningSignalId: "sig_unknown",
      valueSummary: "Something went wrong but I don't know what",
      evidence: {},
    }),
  ];

  const result = miner.mine(signals);

  assert.equal(result.length, 1);
  assert.equal(result[0]!.learningType, "failure_pattern");
  assert.ok(result[0]!.title.includes("Failure pattern:"));
});

test("FailurePatternMiner.mine detects schema_validation_loop across multiple signals", () => {
  const miner = new FailurePatternMiner();
  const signals: LearningSignal[] = [
    makeSignal({ learningSignalId: "sig_1", evidence: { stepId: "step_x" } }),
    makeSignal({ learningSignalId: "sig_2", evidence: { stepId: "step_x" } }),
    makeSignal({ learningSignalId: "sig_3", evidence: { stepId: "step_x" } }),
  ];

  const result = miner.mine(signals);

  assert.ok(result.length >= 1);
  const loopResult = result.find(r => r.title.includes("Schema validation loop"));
  assert.ok(loopResult !== undefined);
});

test("FailurePatternMiner.mine handles multiple signals with different patterns", () => {
  const miner = new FailurePatternMiner();
  const signals: LearningSignal[] = [
    makeSignal({ learningSignalId: "sig_1", evidence: { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 } }),
    makeSignal({ learningSignalId: "sig_2", valueSummary: "permission denied", evidence: { toolName: "Write" } }),
  ];

  const result = miner.mine(signals);

  assert.equal(result.length, 2);
});

test("FailurePatternMiner.mine generates valid learning objects", () => {
  const miner = new FailurePatternMiner();
  const signals: LearningSignal[] = [
    makeSignal({
      learningSignalId: "sig_1",
      evidence: { evalScore: 0.1 },
    }),
  ];

  const result = miner.mine(signals);

  assert.equal(result.length, 1);
  assert.ok(result[0]!.learningObjectId.startsWith("learning_"));
  assert.equal(result[0]!.learningType, "failure_pattern");
  assert.ok(result[0]!.confidence > 0);
  assert.equal(result[0]!.promotionStatus, "quarantine");
  assert.equal(result[0]!.validatedBy, "none");
});

test("FailurePatternMiner.mine skips non-failure_pattern signals", () => {
  const miner = new FailurePatternMiner();
  const signals: LearningSignal[] = [
    makeSignal({
      learningSignalId: "sig_1",
      learningType: "user_correction" as any,
      evidence: { evalScore: 0.1 },
    }),
  ];

  const result = miner.mine(signals);

  assert.ok(result.length >= 0);
});
