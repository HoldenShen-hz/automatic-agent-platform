import assert from "node:assert/strict";
import test from "node:test";

import { LearningObjectValidator } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/learn/learning-object-validator.js";

test("LearningObjectValidator promotes evidence-backed learning objects to validated", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    learningObjectId: "learning_1",
    learningType: "failure_pattern",
    title: "Narrow scope on schema failure",
    summary: "Schema mismatches converge after reducing scope.",
    confidence: 0.8,
    evidenceRefs: ["artifact:a"],
    sourceSignalIds: ["signal_1"],
    recommendation: "Replan with tighter scope.",
    validatedBy: "none",
    promotionStatus: "draft",
    createdAt: Date.now(),
  });

  assert.equal(result.valid, true);
  assert.equal(result.learningObject.promotionStatus, "validated");
  assert.equal(result.learningObject.validatedBy, "evidence");
});

test("LearningObjectValidator rejects learning objects without evidence", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    learningObjectId: "learning_2",
    learningType: "recovery_playbook",
    title: "Repair path",
    summary: "Retry after validation failure.",
    confidence: 0.8,
    evidenceRefs: [],
    sourceSignalIds: ["signal_2"],
    recommendation: "Persist the playbook.",
    validatedBy: "none",
    promotionStatus: "draft",
    createdAt: Date.now(),
  });

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.missing_evidence");
  assert.equal(result.learningObject.promotionStatus, "draft");
});

test("LearningObjectValidator rejects learning objects with confidence below minimum", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    learningObjectId: "learning_low_conf",
    learningType: "failure_pattern",
    title: "Low confidence pattern",
    summary: "This has evidence but confidence is too low.",
    confidence: 0.1,
    evidenceRefs: ["artifact:a"],
    sourceSignalIds: ["signal_low"],
    recommendation: "Collect more evidence.",
    validatedBy: "none",
    promotionStatus: "draft",
    createdAt: Date.now(),
  });

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.confidence_below_floor");
  assert.equal(result.learningObject.promotionStatus, "draft");
});

test("LearningObjectValidator preserves validatedBy when already set to human_review", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    learningObjectId: "learning_preserve_validated",
    learningType: "failure_pattern",
    title: "Pattern with pre-existing validator",
    summary: "This was already reviewed by a human.",
    confidence: 0.8,
    evidenceRefs: ["artifact:a"],
    sourceSignalIds: ["signal_1"],
    recommendation: "Approved by reviewer.",
    validatedBy: "human_review", // Already has a value - should be preserved
    promotionStatus: "draft",
    createdAt: Date.now(),
  });

  assert.equal(result.valid, true);
  assert.equal(result.learningObject.validatedBy, "human_review", "validatedBy should be preserved when not 'none'");
  assert.equal(result.learningObject.promotionStatus, "validated");
});

test("LearningObjectValidator preserves promotionStatus when already validated", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    learningObjectId: "learning_already_validated",
    learningType: "user_correction",
    title: "Previously validated correction",
    summary: "This correction was already validated.",
    confidence: 0.9,
    evidenceRefs: ["artifact:b"],
    sourceSignalIds: ["signal_2"],
    recommendation: "Apply this fix.",
    validatedBy: "none",
    promotionStatus: "validated", // Already validated - should be preserved
    createdAt: Date.now(),
  });

  assert.equal(result.valid, true);
  assert.equal(result.learningObject.validatedBy, "evidence");
  assert.equal(result.learningObject.promotionStatus, "validated", "promotionStatus should be preserved when not 'draft'");
});

test("LearningObjectValidator preserves both validatedBy and promotionStatus when already set", () => {
  const validator = new LearningObjectValidator();
  const result = validator.validate({
    learningObjectId: "learning_both_preserved",
    learningType: "recovery_playbook",
    title: "Fully processed playbook",
    summary: "Already reviewed and validated.",
    confidence: 0.85,
    evidenceRefs: ["artifact:c", "artifact:d"],
    sourceSignalIds: ["signal_3"],
    recommendation: "Use when encountering this error.",
    validatedBy: "human_review", // Non-none value
    promotionStatus: "validated", // Non-draft value
    createdAt: Date.now(),
  });

  assert.equal(result.valid, true);
  assert.equal(result.learningObject.validatedBy, "human_review", "validatedBy should be preserved");
  assert.equal(result.learningObject.promotionStatus, "validated", "promotionStatus should be preserved");
});
