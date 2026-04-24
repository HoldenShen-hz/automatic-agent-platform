import assert from "node:assert/strict";
import test from "node:test";

import {
  LearningObjectSchema,
  parseLearningObject,
  type LearningObject,
} from "../../../../../src/platform/orchestration/learn/learning-object-model.js";

// =============================================================================
// Schema Validation Tests
// =============================================================================

test("LearningObjectSchema accepts valid failure_pattern object", () => {
  const obj: LearningObject = {
    learningObjectId: "learning-123",
    learningType: "failure_pattern",
    title: "Test failure pattern",
    summary: "Something went wrong",
    confidence: 0.85,
    evidenceRefs: ["ref-1", "ref-2"],
    sourceSignalIds: ["sig-1"],
    recommendation: "Fix it",
    validatedBy: "evidence",
    promotionStatus: "validated",
    createdAt: 1700000000000,
  };

  const result = LearningObjectSchema.parse(obj);
  assert.equal(result.learningObjectId, "learning-123");
  assert.equal(result.learningType, "failure_pattern");
  assert.equal(result.confidence, 0.85);
});

test("LearningObjectSchema accepts valid user_correction object", () => {
  const obj: LearningObject = {
    learningObjectId: "learning-456",
    learningType: "user_correction",
    title: "User corrected the output",
    summary: "User provided correct answer",
    confidence: 0.95,
    evidenceRefs: [],
    sourceSignalIds: ["sig-2"],
    recommendation: "Use correct approach",
    validatedBy: "none",
    promotionStatus: "draft",
    createdAt: 1700000001000,
  };

  const result = LearningObjectSchema.parse(obj);
  assert.equal(result.learningType, "user_correction");
});

test("LearningObjectSchema accepts valid recovery_playbook object", () => {
  const obj: LearningObject = {
    learningObjectId: "learning-789",
    learningType: "recovery_playbook",
    title: "Recovery from timeout",
    summary: "Recovered by retrying with backoff",
    confidence: 0.75,
    evidenceRefs: ["ref-recovery"],
    sourceSignalIds: [],
    recommendation: "Automate retry",
    validatedBy: "human_review",
    promotionStatus: "promoted",
    createdAt: 1700000002000,
  };

  const result = LearningObjectSchema.parse(obj);
  assert.equal(result.learningType, "recovery_playbook");
});

test("LearningObjectSchema accepts valid model_retraining object", () => {
  const obj: LearningObject = {
    learningObjectId: "learning-ml",
    learningType: "model_retraining",
    title: "Retrain for better accuracy",
    summary: "Model needs retraining on new data",
    confidence: 0.88,
    evidenceRefs: [],
    sourceSignalIds: [],
    recommendation: "Initiate retraining",
    validatedBy: "shadow_execution",
    promotionStatus: "validated",
    createdAt: 1700000003000,
  };

  const result = LearningObjectSchema.parse(obj);
  assert.equal(result.learningType, "model_retraining");
});

test("LearningObjectSchema accepts valid dataset_gap object", () => {
  const obj: LearningObject = {
    learningObjectId: "learning-data",
    learningType: "dataset_gap",
    title: "Missing training data for X",
    summary: "Model lacks examples for category X",
    confidence: 0.82,
    evidenceRefs: ["gap-ref"],
    sourceSignalIds: [],
    recommendation: "Collect more data",
    validatedBy: "evidence",
    promotionStatus: "draft",
    createdAt: 1700000004000,
  };

  const result = LearningObjectSchema.parse(obj);
  assert.equal(result.learningType, "dataset_gap");
});

test("LearningObjectSchema rejects empty learningObjectId", () => {
  assert.throws(() => {
    LearningObjectSchema.parse({
      learningObjectId: "",
      learningType: "failure_pattern",
      title: "Test",
      summary: "Test summary",
      confidence: 0.5,
      evidenceRefs: [],
      sourceSignalIds: [],
      recommendation: "Test",
      validatedBy: "none",
      promotionStatus: "draft",
      createdAt: 1700000000000,
    });
  });
});

test("LearningObjectSchema rejects empty title", () => {
  assert.throws(() => {
    LearningObjectSchema.parse({
      learningObjectId: "learning-1",
      learningType: "failure_pattern",
      title: "",
      summary: "Test summary",
      confidence: 0.5,
      evidenceRefs: [],
      sourceSignalIds: [],
      recommendation: "Test",
      validatedBy: "none",
      promotionStatus: "draft",
      createdAt: 1700000000000,
    });
  });
});

test("LearningObjectSchema rejects invalid learningType", () => {
  assert.throws(() => {
    LearningObjectSchema.parse({
      learningObjectId: "learning-1",
      learningType: "invalid_type",
      title: "Test",
      summary: "Test summary",
      confidence: 0.5,
      evidenceRefs: [],
      sourceSignalIds: [],
      recommendation: "Test",
      validatedBy: "none",
      promotionStatus: "draft",
      createdAt: 1700000000000,
    });
  });
});

test("LearningObjectSchema rejects confidence < 0", () => {
  assert.throws(() => {
    LearningObjectSchema.parse({
      learningObjectId: "learning-1",
      learningType: "failure_pattern",
      title: "Test",
      summary: "Test summary",
      confidence: -0.1,
      evidenceRefs: [],
      sourceSignalIds: [],
      recommendation: "Test",
      validatedBy: "none",
      promotionStatus: "draft",
      createdAt: 1700000000000,
    });
  });
});

test("LearningObjectSchema rejects confidence > 1", () => {
  assert.throws(() => {
    LearningObjectSchema.parse({
      learningObjectId: "learning-1",
      learningType: "failure_pattern",
      title: "Test",
      summary: "Test summary",
      confidence: 1.5,
      evidenceRefs: [],
      sourceSignalIds: [],
      recommendation: "Test",
      validatedBy: "none",
      promotionStatus: "draft",
      createdAt: 1700000000000,
    });
  });
});

test("LearningObjectSchema rejects invalid validatedBy value", () => {
  assert.throws(() => {
    LearningObjectSchema.parse({
      learningObjectId: "learning-1",
      learningType: "failure_pattern",
      title: "Test",
      summary: "Test summary",
      confidence: 0.5,
      evidenceRefs: [],
      sourceSignalIds: [],
      recommendation: "Test",
      validatedBy: "invalid_validator",
      promotionStatus: "draft",
      createdAt: 1700000000000,
    });
  });
});

test("LearningObjectSchema rejects invalid promotionStatus value", () => {
  assert.throws(() => {
    LearningObjectSchema.parse({
      learningObjectId: "learning-1",
      learningType: "failure_pattern",
      title: "Test",
      summary: "Test summary",
      confidence: 0.5,
      evidenceRefs: [],
      sourceSignalIds: [],
      recommendation: "Test",
      validatedBy: "none",
      promotionStatus: "archived",
      createdAt: 1700000000000,
    });
  });
});

test("LearningObjectSchema rejects negative createdAt", () => {
  assert.throws(() => {
    LearningObjectSchema.parse({
      learningObjectId: "learning-1",
      learningType: "failure_pattern",
      title: "Test",
      summary: "Test summary",
      confidence: 0.5,
      evidenceRefs: [],
      sourceSignalIds: [],
      recommendation: "Test",
      validatedBy: "none",
      promotionStatus: "draft",
      createdAt: -1,
    });
  });
});

// =============================================================================
// parseLearningObject function tests
// =============================================================================

test("parseLearningObject parses valid object", () => {
  const input = {
    learningObjectId: "learning-parse",
    learningType: "failure_pattern",
    title: "Parsed object",
    summary: "This was parsed correctly",
    confidence: 0.9,
    evidenceRefs: ["e1"],
    sourceSignalIds: ["s1"],
    recommendation: "Parse correctly",
    validatedBy: "none",
    promotionStatus: "draft",
    createdAt: 1700000000000,
  };

  const result = parseLearningObject(input);
  assert.equal(result.learningObjectId, "learning-parse");
});

test("parseLearningObject throws on invalid input", () => {
  assert.throws(() => {
    parseLearningObject({
      learningObjectId: "",
      learningType: "failure_pattern",
      title: "Test",
      summary: "Test",
      confidence: 0.5,
      evidenceRefs: [],
      sourceSignalIds: [],
      recommendation: "Test",
      validatedBy: "none",
      promotionStatus: "draft",
      createdAt: 1700000000000,
    });
  });
});

test("parseLearningObject accepts all valid learningType values", () => {
  const types = ["failure_pattern", "user_correction", "recovery_playbook", "model_retraining", "dataset_gap"] as const;
  for (const learningType of types) {
    const input = {
      learningObjectId: `learning-${learningType}`,
      learningType,
      title: "Test",
      summary: "Test",
      confidence: 0.5,
      evidenceRefs: [],
      sourceSignalIds: [],
      recommendation: "Test",
      validatedBy: "none",
      promotionStatus: "draft",
      createdAt: 1700000000000,
    };
    const result = parseLearningObject(input);
    assert.equal(result.learningType, learningType);
  }
});

test("parseLearningObject accepts all valid validatedBy values", () => {
  const validators = ["none", "evidence", "human_review", "shadow_execution"] as const;
  for (const validatedBy of validators) {
    const input = {
      learningObjectId: `learning-${validatedBy}`,
      learningType: "failure_pattern",
      title: "Test",
      summary: "Test",
      confidence: 0.5,
      evidenceRefs: [],
      sourceSignalIds: [],
      recommendation: "Test",
      validatedBy,
      promotionStatus: "draft",
      createdAt: 1700000000000,
    };
    const result = parseLearningObject(input);
    assert.equal(result.validatedBy, validatedBy);
  }
});

test("parseLearningObject accepts all valid promotionStatus values", () => {
  const statuses = ["draft", "validated", "promoted", "retired"] as const;
  for (const promotionStatus of statuses) {
    const input = {
      learningObjectId: `learning-${promotionStatus}`,
      learningType: "failure_pattern",
      title: "Test",
      summary: "Test",
      confidence: 0.5,
      evidenceRefs: [],
      sourceSignalIds: [],
      recommendation: "Test",
      validatedBy: "none",
      promotionStatus,
      createdAt: 1700000000000,
    };
    const result = parseLearningObject(input);
    assert.equal(result.promotionStatus, promotionStatus);
  }
});