/**
 * Learning Object Validator Unit Tests
 */

import assert from "node:assert/strict";
import test from "node:test";

import { LearningObjectValidator } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/learn/learning-object-validator.js";

function makeLearningObject(overrides: Partial<{
  learningObjectId: string;
  learningType: "failure_pattern" | "user_correction" | "recovery_playbook" | "model_retraining" | "dataset_gap";
  title: string;
  summary: string;
  confidence: number;
  evidenceRefs: string[];
  sourceSignalIds: string[];
  recommendation: string;
  validatedBy: "none" | "evidence" | "human_review" | "shadow_execution";
  promotionStatus: "draft" | "quarantine" | "validated" | "promoted" | "retired";
}> = {}): {
  learningObjectId: string;
  learningType: "failure_pattern" | "user_correction" | "recovery_playbook" | "model_retraining" | "dataset_gap";
  title: string;
  summary: string;
  confidence: number;
  evidenceRefs: string[];
  sourceSignalIds: string[];
  recommendation: string;
  validatedBy: "none" | "evidence" | "human_review" | "shadow_execution";
  promotionStatus: "draft" | "quarantine" | "validated" | "promoted" | "retired";
  createdAt: string;
} {
  return {
    learningObjectId: "learning-001",
    learningType: "failure_pattern",
    title: "Test Learning Object",
    summary: "Test summary",
    confidence: 0.8,
    evidenceRefs: ["evidence-1"],
    sourceSignalIds: ["signal-1"],
    recommendation: "Test recommendation",
    validatedBy: "none",
    promotionStatus: "draft",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

test("LearningObjectValidator.validate returns valid for good input", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    confidence: 0.8,
    evidenceRefs: ["evidence-1"],
    learningType: "failure_pattern",
  });
  const result = validator.validate(obj);

  assert.equal(result.valid, true);
  assert.equal(result.reasonCode, "learning.validated");
});

test("LearningObjectValidator.validate rejects missing evidenceRefs", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({ evidenceRefs: [] });
  const result = validator.validate(obj);

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.missing_evidence");
  assert.equal(result.learningObject.promotionStatus, "quarantined");
});

test("LearningObjectValidator.validate rejects confidence below floor for failure_pattern", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({ learningType: "failure_pattern", confidence: 0.3 });
  const result = validator.validate(obj);

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.confidence_below_floor");
});

test("LearningObjectValidator.validate rejects confidence below floor for user_correction", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({ learningType: "user_correction", confidence: 0.5 });
  const result = validator.validate(obj);

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.confidence_below_floor");
});

test("LearningObjectValidator.validate accepts user_correction with high confidence", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({ learningType: "user_correction", confidence: 0.95 });
  const result = validator.validate(obj);

  assert.equal(result.valid, true);
});

test("LearningObjectValidator.validate rejects recovery_playbook with low confidence", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({ learningType: "recovery_playbook", confidence: 0.5 });
  const result = validator.validate(obj);

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.confidence_below_floor");
});

test("LearningObjectValidator.validate detects PII patterns", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    title: "Password exposure issue",
    summary: "API key leaked in logs",
  });
  const result = validator.validate(obj);

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.pii_secret_detected");
});

test("LearningObjectValidator.validate detects SSN pattern", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    title: "Test",
    summary: "SSN: 123-45-6789 found",
  });
  const result = validator.validate(obj);

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.pii_secret_detected");
});

test("LearningObjectValidator.validate detects credit card pattern", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    title: "Test",
    summary: "Card: 1234567890123456 found",
  });
  const result = validator.validate(obj);

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.pii_secret_detected");
});

test("LearningObjectValidator.validate detects email pattern", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({
    title: "Test",
    summary: "Contact: user@example.com",
  });
  const result = validator.validate(obj);

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.pii_secret_detected");
});

test("LearningObjectValidator.validateMany filters valid objects", () => {
  const validator = new LearningObjectValidator();
  const inputs = [
    makeLearningObject({ learningObjectId: "valid-1", confidence: 0.8, evidenceRefs: ["e1"] }),
    makeLearningObject({ learningObjectId: "invalid-no-evidence", confidence: 0.8, evidenceRefs: [] }),
    makeLearningObject({ learningObjectId: "valid-2", confidence: 0.9, evidenceRefs: ["e2"], learningType: "user_correction" }),
  ];
  const results = validator.validateMany(inputs);

  assert.equal(results.length, 2);
  assert.ok(results.some(r => r.learningObjectId === "valid-1"));
  assert.ok(results.some(r => r.learningObjectId === "valid-2"));
});

test("LearningObjectValidator.validateMany handles empty array", () => {
  const validator = new LearningObjectValidator();
  const results = validator.validateMany([]);

  assert.equal(results.length, 0);
});

test("LearningObjectValidator.validateMany updates promotionStatus to validated for valid", () => {
  const validator = new LearningObjectValidator();
  const inputs = [
    makeLearningObject({
      learningObjectId: "test-1",
      confidence: 0.8,
      evidenceRefs: ["e1"],
      promotionStatus: "draft",
    }),
  ];
  const results = validator.validateMany(inputs);

  assert.equal(results[0].promotionStatus, "validated");
});

test("LearningObjectValidator.validate sets validatedBy to evidence for valid", () => {
  const validator = new LearningObjectValidator();
  const obj = makeLearningObject({ validatedBy: "none" });
  const result = validator.validate(obj);

  assert.equal(result.learningObject.validatedBy, "evidence");
});
