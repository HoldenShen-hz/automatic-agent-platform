import test from "node:test";
import assert from "node:assert/strict";

import { LearningObjectSchema, parseLearningObject } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/learn/learning-object-model.js";

test("LearningObjectSchema parses valid learning object", () => {
  const input = {
    learningObjectId: "lo_1",
    learningType: "failure_pattern",
    title: "Schema validation failures",
    summary: "Schema validation failures indicate input format issues",
    confidence: 0.9,
    evidenceRefs: ["artifact:1", "artifact:2"],
    sourceSignalIds: ["sig_1"],
    recommendation: "Use stricter schema validation",
    validatedBy: "evidence",
    promotionStatus: "validated",
    createdAt: 1234567890,
  };

  const result = LearningObjectSchema.parse(input);
  assert.equal(result.learningObjectId, "lo_1");
  assert.equal(result.learningType, "failure_pattern");
  assert.equal(result.confidence, 0.9);
});

test("LearningObjectSchema applies defaults", () => {
  const input = {
    learningObjectId: "lo_1",
    learningType: "failure_pattern",
    title: "Test",
    summary: "Test summary",
    confidence: 0.8,
    recommendation: "Test recommendation",
    createdAt: 1234567890,
  };

  const result = LearningObjectSchema.parse(input);
  assert.deepEqual(result.evidenceRefs, []);
  assert.deepEqual(result.sourceSignalIds, []);
  assert.equal(result.validatedBy, "none");
  assert.equal(result.promotionStatus, "untrusted");
});

test("LearningObjectSchema accepts all learning types", () => {
  const types = ["failure_pattern", "user_correction", "recovery_playbook"] as const;
  for (const type of types) {
    const result = LearningObjectSchema.parse({
      learningObjectId: "lo_1",
      learningType: type,
      title: "Test",
      summary: "Test summary",
      confidence: 0.8,
      recommendation: "Test",
      createdAt: 1234567890,
    });
    assert.equal(result.learningType, type);
  }
});

test("LearningObjectSchema accepts all validatedBy values", () => {
  const values = ["none", "evidence", "human_review", "shadow_execution"] as const;
  for (const value of values) {
    const result = LearningObjectSchema.parse({
      learningObjectId: "lo_1",
      learningType: "failure_pattern",
      title: "Test",
      summary: "Test summary",
      confidence: 0.8,
      recommendation: "Test",
      validatedBy: value,
      createdAt: 1234567890,
    });
    assert.equal(result.validatedBy, value);
  }
});

test("LearningObjectSchema accepts all promotionStatus values", () => {
  const statuses = ["draft", "validated", "promoted", "retired"] as const;
  for (const status of statuses) {
    const result = LearningObjectSchema.parse({
      learningObjectId: "lo_1",
      learningType: "failure_pattern",
      title: "Test",
      summary: "Test summary",
      confidence: 0.8,
      recommendation: "Test",
      promotionStatus: status,
      createdAt: 1234567890,
    });
    assert.equal(result.promotionStatus, status);
  }
});

test("LearningObjectSchema rejects confidence below 0", () => {
  assert.throws(() => {
    LearningObjectSchema.parse({
      learningObjectId: "lo_1",
      learningType: "failure_pattern",
      title: "Test",
      summary: "Test summary",
      confidence: -0.1,
      recommendation: "Test",
      createdAt: 1234567890,
    });
  });
});

test("LearningObjectSchema rejects confidence above 1", () => {
  assert.throws(() => {
    LearningObjectSchema.parse({
      learningObjectId: "lo_1",
      learningType: "failure_pattern",
      title: "Test",
      summary: "Test summary",
      confidence: 1.5,
      recommendation: "Test",
      createdAt: 1234567890,
    });
  });
});

test("LearningObjectSchema rejects empty learningObjectId", () => {
  assert.throws(() => {
    LearningObjectSchema.parse({
      learningObjectId: "",
      learningType: "failure_pattern",
      title: "Test",
      summary: "Test summary",
      confidence: 0.8,
      recommendation: "Test",
      createdAt: 1234567890,
    });
  });
});

test("LearningObjectSchema rejects empty title", () => {
  assert.throws(() => {
    LearningObjectSchema.parse({
      learningObjectId: "lo_1",
      learningType: "failure_pattern",
      title: "",
      summary: "Test summary",
      confidence: 0.8,
      recommendation: "Test",
      createdAt: 1234567890,
    });
  });
});

test("parseLearningObject returns parsed learning object", () => {
  const input = {
    learningObjectId: "lo_1",
    learningType: "failure_pattern",
    title: "Test",
    summary: "Test summary",
    confidence: 0.9,
    recommendation: "Test",
    createdAt: 1234567890,
  };

  const result = parseLearningObject(input);
  assert.equal(result.learningObjectId, "lo_1");
});

test("parseLearningObject throws on invalid input", () => {
  assert.throws(() => {
    parseLearningObject({
      learningObjectId: "",
      learningType: "invalid",
      title: "",
      summary: "",
      confidence: 2,
      recommendation: "",
      createdAt: -1,
    });
  });
});
