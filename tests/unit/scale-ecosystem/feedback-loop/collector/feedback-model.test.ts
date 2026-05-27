import test from "node:test";
import assert from "node:assert/strict";

import {
  FeedbackBatchOutcomeSchema,
  FeedbackBatchSchema,
  LearningSignalSchema,
  parseFeedbackBatch,
  parseLearningSignal,
} from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import {
  FeedbackSignalSchema,
  parseFeedbackSignal,
} from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/feedback-signal.js";

test("FeedbackBatchSchema parses valid feedback batch [feedback-model]", () => {
  const input = {
    feedbackId: "feedback_1",
    taskId: "task_1",
    executionId: "exec_1",
    planId: "plan_1",
    outcome: "completed",
    signals: [],
    emittedAt: 1234567890,
  };

  const result = FeedbackBatchSchema.parse(input);
  assert.equal(result.feedbackId, "feedback_1");
  assert.equal(result.taskId, "task_1");
  assert.equal(result.outcome, "completed");
});

test("FeedbackBatchSchema applies defaults for optional fields [feedback-model]", () => {
  const input = {
    feedbackId: "feedback_2",
    taskId: "task_2",
    outcome: "failed",
    emittedAt: 1234567890,
  };

  const result = FeedbackBatchSchema.parse(input);
  assert.equal(result.executionId, null);
  assert.equal(result.planId, null);
  assert.deepEqual(result.signals, []);
});

test("FeedbackBatchOutcomeSchema accepts valid outcomes [feedback-model]", () => {
  const outcomes = ["completed", "failed", "repairable", "escalated", "partial"] as const;
  for (const outcome of outcomes) {
    assert.equal(FeedbackBatchOutcomeSchema.parse(outcome), outcome);
  }
});

test("FeedbackBatchOutcomeSchema rejects invalid outcomes [feedback-model]", () => {
  assert.throws(() => {
    FeedbackBatchOutcomeSchema.parse("invalid");
  });
});

test("LearningSignalSchema parses valid learning signal [feedback-model]", () => {
  const input = {
    learningSignalId: "learning_1",
    taskId: "task_1",
    sourceFeedbackId: "feedback_1",
    learningType: "failure_pattern",
    confidence: 0.85,
    valueSummary: "Schema validation failures indicate input format issues",
    evidenceRefs: ["artifact:1", "artifact:2"],
    sourceSignalIds: ["sig_1", "sig_2"],
    relatedSignalIds: ["sig_3"],
    evidence: { pattern: "schema_drift" },
    generatedAt: 1234567890,
  };

  const result = LearningSignalSchema.parse(input);
  assert.equal(result.learningSignalId, "learning_1");
  assert.equal(result.learningType, "failure_pattern");
  assert.equal(result.confidence, 0.85);
});

test("LearningSignalSchema applies defaults for optional fields [feedback-model]", () => {
  const input = {
    learningSignalId: "learning_2",
    taskId: "task_2",
    sourceFeedbackId: "feedback_2",
    learningType: "user_correction",
    confidence: 0.9,
    valueSummary: "User corrected the prompt",
    generatedAt: 1234567890,
  };

  const result = LearningSignalSchema.parse(input);
  assert.deepEqual(result.evidenceRefs, []);
  assert.deepEqual(result.sourceSignalIds, []);
  assert.deepEqual(result.relatedSignalIds, []);
  assert.deepEqual(result.evidence, {});
});

test("parseFeedbackBatch throws on invalid input [feedback-model]", () => {
  assert.throws(() => {
    parseFeedbackBatch({ feedbackId: "", taskId: "task_1", outcome: "invalid", emittedAt: 0 });
  });
});

test("parseLearningSignal throws on invalid input [feedback-model]", () => {
  assert.throws(() => {
    parseLearningSignal({
      learningSignalId: "",
      taskId: "task_1",
      sourceFeedbackId: "feedback_1",
      learningType: "invalid_type",
      confidence: 0.5,
      valueSummary: "",
      generatedAt: 0,
    });
  });
});

test("LearningSignalSchema rejects confidence outside [0, 1] [feedback-model]", () => {
  assert.throws(() => {
    LearningSignalSchema.parse({
      learningSignalId: "learning_3",
      taskId: "task_3",
      sourceFeedbackId: "feedback_3",
      learningType: "failure_pattern",
      confidence: 1.5,
      valueSummary: "Invalid confidence",
      generatedAt: 1234567890,
    });
  });

  assert.throws(() => {
    LearningSignalSchema.parse({
      learningSignalId: "learning_4",
      taskId: "task_4",
      sourceFeedbackId: "feedback_4",
      learningType: "failure_pattern",
      confidence: -0.1,
      valueSummary: "Invalid confidence",
      generatedAt: 1234567890,
    });
  });
});

test("LearningSignalSchema accepts all valid learning types [feedback-model]", () => {
  const learningTypes = ["failure_pattern", "user_correction", "recovery_playbook"] as const;
  for (const learningType of learningTypes) {
    const input = {
      learningSignalId: `learning_${learningType}`,
      taskId: "task_1",
      sourceFeedbackId: "feedback_1",
      learningType,
      confidence: 0.8,
      valueSummary: "Test signal",
      generatedAt: 1234567890,
    };
    assert.equal(LearningSignalSchema.parse(input).learningType, learningType);
  }
});

test("FeedbackSignalSchema parses valid signal [feedback-model]", () => {
  const input = {
    signalId: "sig_test",
    taskId: "task_1",
    source: "execution",
    category: "failure",
    severity: "error",
    payload: { reasonCode: "ERR_001" },
    stepOutputRefs: ["step:1"],
    timestamp: 1234567890,
  };

  const result = parseFeedbackSignal(input);
  assert.equal(result.signalId, "sig_test");
  assert.equal(result.category, "failure");
  assert.equal(result.source, "execution");
  assert.equal(result.severity, "error");
});

test("FeedbackSignalSchema rejects invalid source [feedback-model]", () => {
  assert.throws(() => {
    FeedbackSignalSchema.parse({
      signalId: "sig_test",
      taskId: "task_1",
      source: "invalid_source",
      category: "failure",
      severity: "error",
      payload: {},
      stepOutputRefs: [],
      timestamp: 1234567890,
    });
  });
});

test("FeedbackSignalSchema rejects invalid category [feedback-model]", () => {
  assert.throws(() => {
    FeedbackSignalSchema.parse({
      signalId: "sig_test",
      taskId: "task_1",
      source: "execution",
      category: "invalid_category",
      severity: "error",
      payload: {},
      stepOutputRefs: [],
      timestamp: 1234567890,
    });
  });
});

test("FeedbackSignalSchema rejects invalid severity [feedback-model]", () => {
  assert.throws(() => {
    FeedbackSignalSchema.parse({
      signalId: "sig_test",
      taskId: "task_1",
      source: "execution",
      category: "failure",
      severity: "invalid_severity",
      payload: {},
      stepOutputRefs: [],
      timestamp: 1234567890,
    });
  });
});

test("FeedbackSignalSchema applies defaults for optional fields [feedback-model]", () => {
  const result = FeedbackSignalSchema.parse({
    signalId: "sig_test",
    taskId: "task_1",
    source: "execution",
    category: "success",
    severity: "info",
    timestamp: 1234567890,
  });
  assert.deepEqual(result.payload, {});
  assert.deepEqual(result.stepOutputRefs, []);
});
