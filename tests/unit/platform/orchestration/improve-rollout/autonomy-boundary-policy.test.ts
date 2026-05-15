import assert from "node:assert/strict";
import test from "node:test";

import { AutonomyBoundaryPolicy, type AutonomyTarget } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/autonomy-boundary-policy.js";
import type { LearningObject } from "../../../../../src/platform/five-plane-orchestration/learn/learning-object-model.js";

function makeLearningObject(overrides: Partial<LearningObject> = {}): LearningObject {
  return {
    learningObjectId: "test-" + Math.random().toString(36).slice(2),
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

test("AutonomyBoundaryPolicy decides allowed for routing_policy target", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [makeLearningObject({ evidenceRefs: ["e1"], promotionStatus: "validated" })];

  const decision = policy.decide("routing_policy", learningObjects);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "improvement.allowed");
});

test("AutonomyBoundaryPolicy decides allowed for planning_policy target", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [makeLearningObject({ evidenceRefs: ["e1"], promotionStatus: "validated" })];

  const decision = policy.decide("planning_policy", learningObjects);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "improvement.allowed");
});

test("AutonomyBoundaryPolicy decides allowed for execution_policy target", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [makeLearningObject({ evidenceRefs: ["e1"], promotionStatus: "validated" })];

  const decision = policy.decide("execution_policy", learningObjects);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "improvement.allowed");
});

test("AutonomyBoundaryPolicy decides allowed for memory_policy target", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [makeLearningObject({ evidenceRefs: ["e1"], promotionStatus: "validated" })];

  const decision = policy.decide("memory_policy", learningObjects);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "improvement.allowed");
});

test("AutonomyBoundaryPolicy decides not allowed for sandbox_policy target", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [makeLearningObject({ evidenceRefs: ["e1"], promotionStatus: "validated" })];

  const decision = policy.decide("sandbox_policy", learningObjects);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "improvement.manual_approval_required");
});

test("AutonomyBoundaryPolicy decides not allowed for provider_registry target", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [makeLearningObject({ evidenceRefs: ["e1"], promotionStatus: "validated" })];

  const decision = policy.decide("provider_registry", learningObjects);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "improvement.manual_approval_required");
});

test("AutonomyBoundaryPolicy decides not allowed when learning objects not validated", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [makeLearningObject({ evidenceRefs: ["e1"], promotionStatus: "draft" })];

  const decision = policy.decide("routing_policy", learningObjects);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "improvement.learning_object_not_validated");
});

test("AutonomyBoundaryPolicy decides not allowed when learning objects promoted but no evidence", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [makeLearningObject({ evidenceRefs: [], promotionStatus: "promoted" })];

  const decision = policy.decide("planning_policy", learningObjects);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "improvement.learning_object_not_validated");
});

test("AutonomyBoundaryPolicy decides allowed when all learning objects validated and have evidence", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [
    makeLearningObject({ evidenceRefs: ["e1"], promotionStatus: "validated" }),
    makeLearningObject({ evidenceRefs: ["e2"], promotionStatus: "promoted" }),
  ];

  const decision = policy.decide("execution_policy", learningObjects);

  assert.equal(decision.allowed, true);
  assert.equal(decision.reasonCode, "improvement.allowed");
});

test("AutonomyBoundaryPolicy decides not allowed when any learning object not validated", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [
    makeLearningObject({ evidenceRefs: ["e1"], promotionStatus: "validated" }),
    makeLearningObject({ evidenceRefs: ["e2"], promotionStatus: "draft" }),
  ];

  const decision = policy.decide("routing_policy", learningObjects);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "improvement.learning_object_not_validated");
});

test("AutonomyBoundaryPolicy decides not allowed when any learning object has no evidence", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [
    makeLearningObject({ evidenceRefs: ["e1"], promotionStatus: "validated" }),
    makeLearningObject({ evidenceRefs: [], promotionStatus: "validated" }),
  ];

  const decision = policy.decide("planning_policy", learningObjects);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "improvement.learning_object_not_validated");
});

test("AutonomyBoundaryPolicy handles empty learning objects array", () => {
  const policy = new AutonomyBoundaryPolicy();

  const decision = policy.decide("routing_policy", []);

  // Every() on empty array returns true, so allEvidenceBacked is true
  assert.equal(decision.allowed, true);
});

test("AutonomyBoundaryPolicy checks evidenceRefs length, not just presence", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [makeLearningObject({ evidenceRefs: [], promotionStatus: "validated" })];

  const decision = policy.decide("execution_policy", learningObjects);

  assert.equal(decision.allowed, false);
});

test("AutonomyBoundaryPolicy accepts all auto allowed targets", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [makeLearningObject({ evidenceRefs: ["e1"], promotionStatus: "validated" })];

  const autoTargets: AutonomyTarget[] = ["routing_policy", "planning_policy", "execution_policy", "memory_policy"];

  for (const target of autoTargets) {
    const decision = policy.decide(target, learningObjects);
    assert.equal(decision.allowed, true, `Failed for ${target}`);
  }
});

test("AutonomyBoundaryPolicy requires manual approval for non-auto targets", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects = [makeLearningObject({ evidenceRefs: ["e1"], promotionStatus: "validated" })];

  const manualTargets: AutonomyTarget[] = ["sandbox_policy", "provider_registry"];

  for (const target of manualTargets) {
    const decision = policy.decide(target, learningObjects);
    assert.equal(decision.allowed, false, `Failed for ${target}`);
    assert.equal(decision.reasonCode, "improvement.manual_approval_required");
  }
});
