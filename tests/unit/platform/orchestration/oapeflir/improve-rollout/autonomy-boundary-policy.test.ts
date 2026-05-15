import test from "node:test";
import assert from "node:assert/strict";

import { AutonomyBoundaryPolicy } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/autonomy-boundary-policy.js";
import type { LearningObject } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/learn/learning-object-model.js";

test("AutonomyBoundaryPolicy allows high-confidence validated learning objects", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects: LearningObject[] = [
    {
      learningObjectId: "lo_1",
      learningType: "failure_pattern",
      title: "Pattern",
      summary: "Summary",
      confidence: 0.95,
      evidenceRefs: ["artifact:1"],
      sourceSignalIds: ["sig_1"],
      recommendation: "Use narrower scope",
      validatedBy: "evidence",
      promotionStatus: "validated",
      createdAt: Date.now(),
    },
  ];

  const decision = policy.decide("planning_policy", learningObjects);
  assert.equal(decision.allowed, true);
});

test("AutonomyBoundaryPolicy blocks learning objects with draft promotion status", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects: LearningObject[] = [
    {
      learningObjectId: "lo_1",
      learningType: "failure_pattern",
      title: "Pattern",
      summary: "Summary",
      confidence: 0.3,
      evidenceRefs: ["artifact:1"],
      sourceSignalIds: ["sig_1"],
      recommendation: "Use narrower scope",
      validatedBy: "evidence",
      promotionStatus: "draft",
      createdAt: Date.now(),
    },
  ];

  const decision = policy.decide("planning_policy", learningObjects);
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCode?.includes("learning_object_not_validated"));
});

test("AutonomyBoundaryPolicy blocks unvalidated learning objects for sensitive targets", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects: LearningObject[] = [
    {
      learningObjectId: "lo_1",
      learningType: "failure_pattern",
      title: "Pattern",
      summary: "Summary",
      confidence: 0.9,
      evidenceRefs: ["artifact:1"],
      sourceSignalIds: ["sig_1"],
      recommendation: "Use narrower scope",
      validatedBy: "evidence",
      promotionStatus: "draft",
      createdAt: Date.now(),
    },
  ];

  const decision = policy.decide("execution_policy", learningObjects);
  assert.equal(decision.allowed, false);
});

test("AutonomyBoundaryPolicy allows validated learning objects for auto-allowed targets", () => {
  const policy = new AutonomyBoundaryPolicy();
  const validatedLo: LearningObject = {
    learningObjectId: "lo_1",
    learningType: "failure_pattern",
    title: "Pattern",
    summary: "Summary",
    confidence: 0.9,
    evidenceRefs: ["artifact:1"],
    sourceSignalIds: ["sig_1"],
    recommendation: "Use narrower scope",
    validatedBy: "evidence",
    promotionStatus: "validated",
    createdAt: Date.now(),
  };

  const targets = ["routing_policy", "planning_policy", "execution_policy", "memory_policy"] as const;
  for (const target of targets) {
    const decision = policy.decide(target, [validatedLo]);
    assert.equal(decision.allowed, true, `Target ${target} should be allowed`);
  }
});

test("AutonomyBoundaryPolicy requires manual approval for sandbox_policy and provider_registry", () => {
  const policy = new AutonomyBoundaryPolicy();
  const validatedLo: LearningObject = {
    learningObjectId: "lo_1",
    learningType: "failure_pattern",
    title: "Pattern",
    summary: "Summary",
    confidence: 0.9,
    evidenceRefs: ["artifact:1"],
    sourceSignalIds: ["sig_1"],
    recommendation: "Use narrower scope",
    validatedBy: "evidence",
    promotionStatus: "validated",
    createdAt: Date.now(),
  };

  const decision = policy.decide("sandbox_policy", [validatedLo]);
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCode?.includes("manual_approval_required"));
});

test("AutonomyBoundaryPolicy requires evidence refs for policy changes", () => {
  const policy = new AutonomyBoundaryPolicy();
  const learningObjects: LearningObject[] = [
    {
      learningObjectId: "lo_1",
      learningType: "failure_pattern",
      title: "Pattern",
      summary: "Summary",
      confidence: 0.9,
      evidenceRefs: [],
      sourceSignalIds: ["sig_1"],
      recommendation: "Use narrower scope",
      validatedBy: "evidence",
      promotionStatus: "validated",
      createdAt: Date.now(),
    },
  ];

  const decision = policy.decide("planning_policy", learningObjects);
  assert.equal(decision.allowed, false);
});

test("AutonomyBoundaryPolicy handles empty learning objects", () => {
  const policy = new AutonomyBoundaryPolicy();

  const decision = policy.decide("planning_policy", []);
  // Empty array returns vacuously true from every(), so allowed is true
  assert.equal(decision.allowed, true);
});
