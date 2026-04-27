/**
 * Unit tests for LearningObjectValidator
 * Tests the validate and validateMany methods
 */

import assert from "node:assert/strict";
import test from "node:test";
import { LearningObjectValidator } from "../../../../../src/platform/orchestration/learn/learning-object-validator.js";
import type { LearningObject } from "../../../../../src/platform/orchestration/learn/learning-object-model.js";

function makeLearningObject(overrides: Partial<LearningObject> = {}): LearningObject {
  return {
    learningObjectId: "learning-" + Math.random().toString(36).slice(2),
    learningType: "failure_pattern",
    title: "Test learning object",
    summary: "Test summary",
    confidence: 0.8,
    evidenceRefs: ["evidence-1"],
    sourceSignalIds: ["signal-1"],
    recommendation: "Test recommendation",
    validatedBy: "none",
    promotionStatus: "draft",
    createdAt: Date.now(),
    ...overrides,
  };
}

test("LearningObjectValidator.validate returns valid=true for object with evidence and sufficient confidence", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    learningType: "failure_pattern",
    confidence: 0.8,
    evidenceRefs: ["evidence-1"],
  });

  const result = validator.validate(obj);

  assert.equal(result.valid, true);
  assert.equal(result.reasonCode, "learning.validated");
  assert.equal(result.learningObject.validatedBy, "evidence");
  assert.equal(result.learningObject.promotionStatus, "validated");
});

test("LearningObjectValidator.validate returns valid=false for object without evidenceRefs", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    evidenceRefs: [],
  });

  const result = validator.validate(obj);

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.missing_evidence");
  assert.equal(result.learningObject.validatedBy, "none");
  assert.equal(result.learningObject.promotionStatus, "draft");
});

test("LearningObjectValidator.validate returns valid=false for failure_pattern with confidence below 0.5", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    learningType: "failure_pattern",
    confidence: 0.3,
    evidenceRefs: ["evidence-1"],
  });

  const result = validator.validate(obj);

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.confidence_below_floor");
});

test("LearningObjectValidator.validate returns valid=false for user_correction with confidence below 0.9", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    learningType: "user_correction",
    confidence: 0.5,
    evidenceRefs: ["evidence-1"],
  });

  const result = validator.validate(obj);

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.confidence_below_floor");
});

test("LearningObjectValidator.validate returns valid=false for recovery_playbook with confidence below 0.7", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    learningType: "recovery_playbook",
    confidence: 0.5,
    evidenceRefs: ["evidence-1"],
  });

  const result = validator.validate(obj);

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.confidence_below_floor");
});

test("LearningObjectValidator.validate returns valid=false for model_retraining with confidence below 0.8", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    learningType: "model_retraining",
    confidence: 0.5,
    evidenceRefs: ["evidence-1"],
  });

  const result = validator.validate(obj);

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.confidence_below_floor");
});

test("LearningObjectValidator.validate returns valid=false for dataset_gap with confidence below 0.8", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    learningType: "dataset_gap",
    confidence: 0.5,
    evidenceRefs: ["evidence-1"],
  });

  const result = validator.validate(obj);

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.confidence_below_floor");
});

test("LearningObjectValidator.validate accepts exact threshold confidence for failure_pattern (0.5)", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    learningType: "failure_pattern",
    confidence: 0.5,
    evidenceRefs: ["evidence-1"],
  });

  const result = validator.validate(obj);

  assert.equal(result.valid, true);
});

test("LearningObjectValidator.validate accepts exact threshold confidence for user_correction (0.9)", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    learningType: "user_correction",
    confidence: 0.9,
    evidenceRefs: ["evidence-1"],
  });

  const result = validator.validate(obj);

  assert.equal(result.valid, true);
});

test("LearningObjectValidator.validate accepts exact threshold confidence for recovery_playbook (0.7)", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    learningType: "recovery_playbook",
    confidence: 0.7,
    evidenceRefs: ["evidence-1"],
  });

  const result = validator.validate(obj);

  assert.equal(result.valid, true);
});

test("LearningObjectValidator.validate returns object with preserved fields", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    learningObjectId: "learning-preserved",
    learningType: "failure_pattern",
    title: "Preserved Title",
    summary: "Preserved Summary",
    confidence: 0.8,
    evidenceRefs: ["evidence-1"],
    recommendation: "Preserved Recommendation",
  });

  const result = validator.validate(obj);

  assert.equal(result.learningObject.learningObjectId, "learning-preserved");
  assert.equal(result.learningObject.title, "Preserved Title");
  assert.equal(result.learningObject.summary, "Preserved Summary");
  assert.equal(result.learningObject.recommendation, "Preserved Recommendation");
});

test("LearningObjectValidator.validateMany returns only valid objects", () => {
  const validator = new LearningObjectValidator();
  const objects = [
    makeLearningObject({ learningObjectId: "valid-1", confidence: 0.8, evidenceRefs: ["e1"] }),
    makeLearningObject({ learningObjectId: "invalid-1", confidence: 0.3, evidenceRefs: [] }),
    makeLearningObject({ learningObjectId: "valid-2", confidence: 0.9, evidenceRefs: ["e2"] }),
    makeLearningObject({ learningObjectId: "invalid-2", confidence: 0.2, evidenceRefs: [] }),
  ];

  const results = validator.validateMany(objects);

  assert.equal(results.length, 2);
  assert.ok(results.some((obj) => obj.learningObjectId === "valid-1"));
  assert.ok(results.some((obj) => obj.learningObjectId === "valid-2"));
});

test("LearningObjectValidator.validateMany returns empty array for all invalid objects", () => {
  const validator = new LearningObjectValidator();
  const objects = [
    makeLearningObject({ confidence: 0.3, evidenceRefs: [] }),
    makeLearningObject({ confidence: 0.2, evidenceRefs: [] }),
  ];

  const results = validator.validateMany(objects);

  assert.equal(results.length, 0);
});

test("LearningObjectValidator.validateMany returns empty array for empty input", () => {
  const validator = new LearningObjectValidator();
  const results = validator.validateMany([]);
  assert.equal(results.length, 0);
});

test("LearningObjectValidator.validateMany preserves valid objects unchanged", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    learningObjectId: "preserve-test",
    learningType: "failure_pattern",
    confidence: 0.8,
    evidenceRefs: ["evidence-1"],
    validatedBy: "evidence",
    promotionStatus: "validated",
  });

  const results = validator.validateMany([obj]);

  assert.equal(results.length, 1);
  assert.equal(results[0].validatedBy, "evidence");
  assert.equal(results[0].promotionStatus, "validated");
});

test("LearningObjectValidator.validate updates validatedBy to evidence when it was none", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    validatedBy: "none",
    confidence: 0.8,
    evidenceRefs: ["evidence-1"],
  });

  const result = validator.validate(obj);

  assert.equal(result.learningObject.validatedBy, "evidence");
});

test("LearningObjectValidator.validate preserves validatedBy when it is already set", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    validatedBy: "human_review",
    confidence: 0.8,
    evidenceRefs: ["evidence-1"],
  });

  const result = validator.validate(obj);

  assert.equal(result.learningObject.validatedBy, "human_review");
});

test("LearningObjectValidator.validate updates promotionStatus to validated when it was draft", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    promotionStatus: "draft",
    confidence: 0.8,
    evidenceRefs: ["evidence-1"],
  });

  const result = validator.validate(obj);

  assert.equal(result.learningObject.promotionStatus, "validated");
});

test("LearningObjectValidator.validate preserves promotionStatus when it is already promoted", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    promotionStatus: "promoted",
    confidence: 0.8,
    evidenceRefs: ["evidence-1"],
  });

  const result = validator.validate(obj);

  assert.equal(result.learningObject.promotionStatus, "promoted");
});

test("LearningObjectValidator.validate handles object with multiple evidenceRefs", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    evidenceRefs: ["ref1", "ref2", "ref3", "ref4"],
    confidence: 0.8,
  });

  const result = validator.validate(obj);

  assert.equal(result.valid, true);
  assert.deepEqual(result.learningObject.evidenceRefs, ["ref1", "ref2", "ref3", "ref4"]);
});

test("LearningObjectValidator.validate processes all learning types correctly", () => {
  const validator = new LearningObjectValidator();
  const types = ["failure_pattern", "user_correction", "recovery_playbook", "model_retraining", "dataset_gap"] as const;
  const thresholds = [0.5, 0.9, 0.7, 0.8, 0.8];

  for (let i = 0; i < types.length; i++) {
    const obj = makeLearningObject({
      learningType: types[i],
      confidence: thresholds[i] + 0.1, // Above threshold
      evidenceRefs: ["evidence-1"],
    });
    const result = validator.validate(obj);
    assert.equal(result.valid, true, `Should be valid for ${types[i]} at threshold + 0.1`);
  }
});
