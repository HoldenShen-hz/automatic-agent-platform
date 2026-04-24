import test from "node:test";
import assert from "node:assert/strict";

import {
  LearningSignalSchema,
  LearningSignal,
  parseLearningSignal,
  FeedbackBatchOutcomeSchema,
} from "../../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import {
  FeedbackSignalSchema,
} from "../../../../../../src/platform/orchestration/oapeflir/types/feedback-signal.js";

test("LearningSignalSchema parses valid learning signal", () => {
  const validSignal = {
    learningSignalId: "learn_001",
    taskId: "task_123",
    sourceFeedbackId: "feedback_abc",
    learningType: "failure_pattern",
    confidence: 0.85,
    valueSummary: "Schema validation failures indicate input format issues",
    evidenceRefs: ["artifact:1", "artifact:2"],
    sourceSignalIds: ["sig_1", "sig_2"],
    relatedSignalIds: ["sig_3", "sig_4"],
    evidence: { pattern: "schema_drift", detectedAt: 1234567890 },
    generatedAt: Date.now(),
  };

  const result = LearningSignalSchema.parse(validSignal);
  assert.equal(result.learningSignalId, "learn_001");
  assert.equal(result.taskId, "task_123");
  assert.equal(result.sourceFeedbackId, "feedback_abc");
  assert.equal(result.learningType, "failure_pattern");
  assert.equal(result.confidence, 0.85);
  assert.equal(result.valueSummary, "Schema validation failures indicate input format issues");
  assert.deepEqual(result.evidenceRefs, ["artifact:1", "artifact:2"]);
  assert.deepEqual(result.sourceSignalIds, ["sig_1", "sig_2"]);
  assert.deepEqual(result.relatedSignalIds, ["sig_3", "sig_4"]);
});

test("LearningSignalSchema applies defaults for optional fields", () => {
  const minimalSignal = {
    learningSignalId: "learn_min",
    taskId: "task_min",
    sourceFeedbackId: "feedback_min",
    learningType: "user_correction",
    confidence: 0.9,
    valueSummary: "User corrected the prompt output",
    generatedAt: 0,
  };

  const result = LearningSignalSchema.parse(minimalSignal);
  assert.deepEqual(result.evidenceRefs, []);
  assert.deepEqual(result.sourceSignalIds, []);
  assert.deepEqual(result.relatedSignalIds, []);
  assert.deepEqual(result.evidence, {});
});

test("LearningSignalSchema rejects empty learningSignalId", () => {
  assert.throws(() => {
    LearningSignalSchema.parse({
      learningSignalId: "",
      taskId: "task_123",
      sourceFeedbackId: "feedback_123",
      learningType: "failure_pattern",
      confidence: 0.5,
      valueSummary: "Test summary",
      generatedAt: 0,
    });
  });
});

test("LearningSignalSchema rejects empty taskId", () => {
  assert.throws(() => {
    LearningSignalSchema.parse({
      learningSignalId: "learn_err",
      taskId: "",
      sourceFeedbackId: "feedback_123",
      learningType: "failure_pattern",
      confidence: 0.5,
      valueSummary: "Test summary",
      generatedAt: 0,
    });
  });
});

test("LearningSignalSchema rejects empty sourceFeedbackId", () => {
  assert.throws(() => {
    LearningSignalSchema.parse({
      learningSignalId: "learn_err",
      taskId: "task_123",
      sourceFeedbackId: "",
      learningType: "failure_pattern",
      confidence: 0.5,
      valueSummary: "Test summary",
      generatedAt: 0,
    });
  });
});

test("LearningSignalSchema rejects invalid learningType", () => {
  assert.throws(() => {
    LearningSignalSchema.parse({
      learningSignalId: "learn_err",
      taskId: "task_123",
      sourceFeedbackId: "feedback_123",
      learningType: "invalid_type",
      confidence: 0.5,
      valueSummary: "Test summary",
      generatedAt: 0,
    });
  });
});

test("LearningSignalSchema rejects confidence greater than 1", () => {
  assert.throws(() => {
    LearningSignalSchema.parse({
      learningSignalId: "learn_err",
      taskId: "task_123",
      sourceFeedbackId: "feedback_123",
      learningType: "failure_pattern",
      confidence: 1.5,
      valueSummary: "Test summary",
      generatedAt: 0,
    });
  });
});

test("LearningSignalSchema rejects confidence less than 0", () => {
  assert.throws(() => {
    LearningSignalSchema.parse({
      learningSignalId: "learn_err",
      taskId: "task_123",
      sourceFeedbackId: "feedback_123",
      learningType: "failure_pattern",
      confidence: -0.1,
      valueSummary: "Test summary",
      generatedAt: 0,
    });
  });
});

test("LearningSignalSchema rejects empty valueSummary", () => {
  assert.throws(() => {
    LearningSignalSchema.parse({
      learningSignalId: "learn_err",
      taskId: "task_123",
      sourceFeedbackId: "feedback_123",
      learningType: "failure_pattern",
      confidence: 0.5,
      valueSummary: "",
      generatedAt: 0,
    });
  });
});

test("LearningSignalSchema rejects negative generatedAt", () => {
  assert.throws(() => {
    LearningSignalSchema.parse({
      learningSignalId: "learn_err",
      taskId: "task_123",
      sourceFeedbackId: "feedback_123",
      learningType: "failure_pattern",
      confidence: 0.5,
      valueSummary: "Test summary",
      generatedAt: -1,
    });
  });
});

test("LearningSignalSchema accepts all valid learning types", () => {
  const learningTypes = [
    "failure_pattern",
    "user_correction",
    "recovery_playbook",
    "model_retraining",
    "dataset_gap",
  ] as const;

  for (const learningType of learningTypes) {
    const input = {
      learningSignalId: `learn_${learningType}`,
      taskId: "task_valid",
      sourceFeedbackId: "feedback_valid",
      learningType,
      confidence: 0.8,
      valueSummary: "Test signal for " + learningType,
      generatedAt: 1234567890,
    };
    assert.equal(LearningSignalSchema.parse(input).learningType, learningType);
  }
});

test("LearningSignalSchema accepts confidence boundary values", () => {
  const boundaryValues = [0, 0.0, 0.5, 1, 1.0];

  for (const confidence of boundaryValues) {
    const result = LearningSignalSchema.parse({
      learningSignalId: `learn_boundary_${confidence}`,
      taskId: "task_boundary",
      sourceFeedbackId: "feedback_boundary",
      learningType: "failure_pattern",
      confidence,
      valueSummary: "Boundary confidence test",
      generatedAt: 0,
    });
    assert.equal(result.confidence, confidence);
  }
});

test("parseLearningSignal returns parsed LearningSignal", () => {
  const input = {
    learningSignalId: "learn_parse_1",
    taskId: "task_parse",
    sourceFeedbackId: "feedback_parse",
    learningType: "recovery_playbook",
    confidence: 0.95,
    valueSummary: "Automated recovery playbook discovered",
    evidenceRefs: ["execution:123", "log:456"],
    sourceSignalIds: ["sig_recovery_1"],
    relatedSignalIds: [],
    evidence: { recoverySteps: 5, avgDurationMs: 1200 },
    generatedAt: 9876543210,
  };

  const result = parseLearningSignal(input);
  assert.equal(result.learningSignalId, "learn_parse_1");
  assert.equal(result.learningType, "recovery_playbook");
  assert.equal(result.confidence, 0.95);
  assert.equal(result.evidence.recoverySteps, 5);
});

test("parseLearningSignal throws on invalid input", () => {
  assert.throws(() => {
    parseLearningSignal({
      learningSignalId: "",
      taskId: "",
      sourceFeedbackId: "",
      learningType: "invalid",
      confidence: 2,
      valueSummary: "",
      generatedAt: -1,
    });
  });
});

test("LearningSignalSchema handles complex evidence object", () => {
  const signalWithComplexEvidence = {
    learningSignalId: "learn_complex",
    taskId: "task_complex",
    sourceFeedbackId: "feedback_complex",
    learningType: "dataset_gap",
    confidence: 0.72,
    valueSummary: "Training data missing edge cases",
    evidenceRefs: ["dataset:mnist_edge", "feedback:5678"],
    sourceSignalIds: ["sig_edge_1"],
    relatedSignalIds: ["sig_edge_2", "sig_edge_3"],
    evidence: {
      missingCategories: ["rotated_90", "rotated_180", "noisy"],
      frequencyPercent: 12.5,
      affectedTaskTypes: ["image_classification", "object_detection"],
      recommendations: {
        addSamples: 500,
        augmentation: ["rotate", "add_noise"],
      },
    },
    generatedAt: 1234567890,
  };

  const result = LearningSignalSchema.parse(signalWithComplexEvidence);
  const evidence = result.evidence as Record<string, unknown>;
  assert.deepEqual(evidence.missingCategories, ["rotated_90", "rotated_180", "noisy"]);
  assert.equal(evidence.frequencyPercent, 12.5);
});

test("LearningSignalSchema handles empty arrays for optional array fields", () => {
  const signalWithEmptyArrays = {
    learningSignalId: "learn_empty_arrays",
    taskId: "task_empty",
    sourceFeedbackId: "feedback_empty",
    learningType: "failure_pattern",
    confidence: 0.65,
    valueSummary: "Signal with empty optional arrays",
    evidenceRefs: [],
    sourceSignalIds: [],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: 1000000000,
  };

  const result = LearningSignalSchema.parse(signalWithEmptyArrays);
  assert.deepEqual(result.evidenceRefs, []);
  assert.deepEqual(result.sourceSignalIds, []);
  assert.deepEqual(result.relatedSignalIds, []);
});

test("FeedbackBatchOutcomeSchema accepts valid outcomes", () => {
  const outcomes = ["completed", "failed", "repairable", "escalated", "partial"] as const;
  for (const outcome of outcomes) {
    assert.equal(FeedbackBatchOutcomeSchema.parse(outcome), outcome);
  }
});

test("FeedbackBatchOutcomeSchema rejects invalid outcome", () => {
  assert.throws(() => {
    FeedbackBatchOutcomeSchema.parse("invalid_outcome");
  });
});
