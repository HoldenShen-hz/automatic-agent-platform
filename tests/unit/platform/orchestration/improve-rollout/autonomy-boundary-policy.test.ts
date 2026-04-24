import assert from "node:assert/strict";
import test from "node:test";

import { AutonomyBoundaryPolicy } from "../../../../../src/platform/orchestration/improve-rollout/autonomy-boundary-policy.js";
import type { LearningObject } from "../../../../../src/platform/orchestration/learn/learning-object-model.js";

function createMockLearningObject(overrides: Partial<LearningObject> = {}): LearningObject {
  const base: LearningObject = {
    learningObjectId: "lo-1",
    learningType: "failure_pattern",
    title: "Routing failure pattern",
    summary: "Captures repeated routing failures for policy improvement.",
    confidence: 0.92,
    evidenceRefs: ["evidence-1"],
    sourceSignalIds: ["signal-1"],
    recommendation: "Tighten routing guardrails for this scenario.",
    validatedBy: "evidence",
    promotionStatus: "validated",
    createdAt: 1_710_000_000_000,
  };
  return {
    ...base,
    ...overrides,
  };
}

test("AutonomyBoundaryPolicy decide allows routing_policy target", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [createMockLearningObject()];

  const decision = policy.decide("routing_policy", learningObjects);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "improvement.allowed");
});

test("AutonomyBoundaryPolicy decide allows planning_policy target", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [createMockLearningObject()];

  const decision = policy.decide("planning_policy", learningObjects);

  assert.equal(decision.allowed, true);
});

test("AutonomyBoundaryPolicy decide allows execution_policy target", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [createMockLearningObject()];

  const decision = policy.decide("execution_policy", learningObjects);

  assert.equal(decision.allowed, true);
});

test("AutonomyBoundaryPolicy decide allows memory_policy target", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [createMockLearningObject()];

  const decision = policy.decide("memory_policy", learningObjects);

  assert.equal(decision.allowed, true);
});

test("AutonomyBoundaryPolicy decide blocks sandbox_policy target", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [createMockLearningObject()];

  const decision = policy.decide("sandbox_policy", learningObjects);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "improvement.manual_approval_required");
});

test("AutonomyBoundaryPolicy decide blocks provider_registry target", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [createMockLearningObject()];

  const decision = policy.decide("provider_registry", learningObjects);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "improvement.manual_approval_required");
});

test("AutonomyBoundaryPolicy decide blocks when learning object not validated", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [createMockLearningObject({ promotionStatus: "draft" })];

  const decision = policy.decide("routing_policy", learningObjects);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "improvement.learning_object_not_validated");
});

test("AutonomyBoundaryPolicy decide allows when all learning objects validated", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [
    createMockLearningObject({ learningObjectId: "lo-1", promotionStatus: "validated" }),
    createMockLearningObject({ learningObjectId: "lo-2", promotionStatus: "promoted" }),
  ];

  const decision = policy.decide("planning_policy", learningObjects);

  assert.equal(decision.allowed, true);
});

test("AutonomyBoundaryPolicy decide blocks when any learning object not validated", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [
    createMockLearningObject({ learningObjectId: "lo-1", promotionStatus: "validated" }),
    createMockLearningObject({ learningObjectId: "lo-2", promotionStatus: "draft" }),
  ];

  const decision = policy.decide("execution_policy", learningObjects);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "improvement.learning_object_not_validated");
});

test("AutonomyBoundaryPolicy decide blocks when learning object has no evidence refs", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [createMockLearningObject({ evidenceRefs: [] })];

  const decision = policy.decide("routing_policy", learningObjects);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "improvement.learning_object_not_validated");
});

test("AutonomyBoundaryPolicy decide allows promoted learning objects", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [createMockLearningObject({ promotionStatus: "promoted" })];

  const decision = policy.decide("memory_policy", learningObjects);

  assert.equal(decision.allowed, true);
});

test("AutonomyBoundaryPolicy decide handles multiple learning objects with mixed status", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [
    createMockLearningObject({ learningObjectId: "lo-1", promotionStatus: "validated" }),
    createMockLearningObject({ learningObjectId: "lo-2", promotionStatus: "promoted" }),
    createMockLearningObject({ learningObjectId: "lo-3", promotionStatus: "draft" }),
  ];

  const decision = policy.decide("routing_policy", learningObjects);

  assert.equal(decision.allowed, false);
});

test("AutonomyBoundaryPolicy decide handles empty learning objects array", () => {
  const policy = new AutonomyBoundaryPolicy();

  const decision = policy.decide("routing_policy", []);

  // Empty array returns true for every(), so allowed=true
  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "improvement.allowed");
});

test("AutonomyBoundaryPolicy decide returns correct reasonCode for allowed", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [createMockLearningObject()];

  const decision = policy.decide("routing_policy", learningObjects);

  assert.equal(decision.reasonCode, "improvement.allowed");
});

test("AutonomyBoundaryPolicy decide handles sandbox_policy with validated objects", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [createMockLearningObject()];

  const decision = policy.decide("sandbox_policy", learningObjects);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "improvement.manual_approval_required");
});
