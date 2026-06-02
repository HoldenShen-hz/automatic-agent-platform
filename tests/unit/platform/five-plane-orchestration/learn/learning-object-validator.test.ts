import assert from "node:assert/strict";
import test from "node:test";

import { LearningObjectValidator } from "../../../../../src/platform/five-plane-orchestration/learn/learning-object-validator.js";
import type { LearningObject } from "../../../../../src/platform/five-plane-orchestration/learn/learning-object-model.js";

function makeLearningObject(overrides: Partial<LearningObject> = {}): LearningObject {
  const objectId = overrides.objectId ?? overrides.learningObjectId ?? "learning-1";
  const kind = overrides.kind ?? overrides.learningType ?? "failure_pattern";
  const title = overrides.title ?? "Reduce flaky retry loops";
  const summary = overrides.summary ?? "Observed repeated retries during worker recovery.";
  const recommendation = overrides.recommendation ?? "Add a guardrail before retrying.";
  const evidenceRefs = overrides.evidenceRefs ?? ["artifact-1"];
  const sourceSignalIds = overrides.sourceSignalIds ?? ["signal-1"];
  return {
    learningObjectId: objectId,
    objectId,
    learningType: kind,
    kind,
    title,
    summary,
    content: {
      title,
      summary,
      evidenceRefs,
      sourceSignalIds,
      recommendation,
    },
    confidence: overrides.confidence ?? 0.85,
    evidenceRefs,
    sourceSignalIds,
    recommendation,
    validatedBy: overrides.validatedBy ?? "none",
    promotionStatus: overrides.promotionStatus ?? "draft",
    status: overrides.status ?? "created",
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  };
}

test("LearningObjectValidator validates canonical learning objects", () => {
  const validator = new LearningObjectValidator();

  const result = validator.validate(makeLearningObject());

  assert.equal(result.valid, true);
  assert.equal(result.reasonCode, "learning.validated");
  assert.equal(result.learningObject.validatedBy, "evidence");
  assert.equal(result.learningObject.promotionStatus, "validated");
});

test("LearningObjectValidator rejects objects without evidence", () => {
  const validator = new LearningObjectValidator();

  const result = validator.validate(makeLearningObject({ evidenceRefs: [] }));

  assert.equal(result.valid, false);
  assert.equal(result.reasonCode, "learning.missing_evidence");
  assert.equal(result.learningObject.promotionStatus, "quarantined");
});

test("LearningObjectValidator enforces confidence floors per type", () => {
  const validator = new LearningObjectValidator();

  assert.equal(
    validator.validate(makeLearningObject({ learningType: "failure_pattern", kind: "failure_pattern", confidence: 0.49 })).reasonCode,
    "learning.confidence_below_floor",
  );
  assert.equal(
    validator.validate(makeLearningObject({ learningType: "user_correction", kind: "user_correction", confidence: 0.89 })).reasonCode,
    "learning.confidence_below_floor",
  );
});

test("LearningObjectValidator quarantines secret and PII content", () => {
  const validator = new LearningObjectValidator();

  const secret = validator.validate(makeLearningObject({
    title: "password reset failure",
    summary: "api_key = leaked-key",
  }));
  const pii = validator.validate(makeLearningObject({
    title: "customer contact",
    summary: "Reach user@example.com about recovery",
  }));

  assert.equal(secret.reasonCode, "learning.secret_detected");
  assert.equal(pii.reasonCode, "learning.pii_detected");
});

test("LearningObjectValidator scans content and evidence fields for secrets and modern email domains", () => {
  const validator = new LearningObjectValidator();

  const secretInEvidence = validator.validate(makeLearningObject({
    evidenceRefs: ["https://example.test/download?token=secret-token"],
  }));
  const piiInContent = validator.validate(makeLearningObject({
    summary: "Escalate to analyst@company.dev for approval",
  }));

  assert.equal(secretInEvidence.reasonCode, "learning.secret_detected");
  assert.equal(piiInContent.reasonCode, "learning.pii_detected");
});

test("LearningObjectValidator validateMany filters invalid objects and preserves valid ones", () => {
  const validator = new LearningObjectValidator();

  const results = validator.validateMany([
    makeLearningObject({ learningObjectId: "valid-1", objectId: "valid-1" }),
    makeLearningObject({ learningObjectId: "invalid-1", objectId: "invalid-1", evidenceRefs: [] }),
    makeLearningObject({
      learningObjectId: "valid-2",
      objectId: "valid-2",
      learningType: "recovery_playbook",
      kind: "recovery_playbook",
      confidence: 0.9,
    }),
  ]);

  assert.deepEqual(results.map((entry) => entry.learningObjectId), ["valid-1", "valid-2"]);
  assert.ok(results.every((entry) => entry.promotionStatus === "validated"));
});

test("LearningObjectValidator caps retained history between validateMany batches", () => {
  const validator = new LearningObjectValidator({ maxKnownObjects: 1 });

  validator.validateMany([
    makeLearningObject({
      learningObjectId: "alpha",
      objectId: "alpha",
      title: "Alpha title",
      summary: "Alpha summary",
    }),
  ]);
  validator.validateMany([
    makeLearningObject({
      learningObjectId: "beta",
      objectId: "beta",
      title: "Beta title",
      summary: "Beta summary",
    }),
  ]);

  const result = validator.validate(makeLearningObject({
    learningObjectId: "alpha-2",
    objectId: "alpha-2",
    title: "Alpha title",
    summary: "Alpha summary",
  }));

  assert.equal(result.valid, true);
});
