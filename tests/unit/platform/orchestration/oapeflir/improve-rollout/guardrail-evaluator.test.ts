import test from "node:test";
import assert from "node:assert/strict";

import { GuardrailEvaluator } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/guardrail-evaluator.js";
import { createStrategyVersion } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/strategy-versioning.js";
import type { ImprovementCandidate } from "../../../../../../src/platform/five-plane-orchestration/improve-rollout/improvement-candidate-registry.js";
import type { LearningObject } from "../../../../../../src/platform/five-plane-orchestration/learn/learning-object-model.js";

function createLearningObject(overrides: Partial<LearningObject> = {}): LearningObject {
  return {
    learningObjectId: "lo_1",
    objectId: "lo_1",
    learningType: "failure_pattern",
    kind: "failure_pattern",
    title: "Test",
    summary: "Summary",
    content: {
      title: "Test",
      summary: "Summary",
      evidenceRefs: ["evidence:1"],
      sourceSignalIds: [],
      recommendation: "Rec",
    },
    confidence: 0.9,
    evidenceRefs: ["evidence:1"],
    sourceSignalIds: [],
    recommendation: "Rec",
    validatedBy: "evidence",
    promotionStatus: "validated",
    status: "validated",
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

function createCandidate(overrides: Partial<ImprovementCandidate> = {}): ImprovementCandidate {
  return {
    candidateId: "candidate_1",
    taskId: "task_1",
    learningObjectId: "lo_1",
    source: "failure_pattern",
    targetScope: "platform",
    priority: "medium",
    rolloutLevel: "L0_off",
    metrics: {
      errorRate: 0,
      latencyP99: 0,
      successRate: 1,
      sampleCount: 0,
    },
    guardrails: [],
    sourceSignalRefs: ["evidence:1"],
    sourceLearningObjectIds: ["lo_1"],
    changeScope: "policy",
    description: "Test",
    expectedBenefit: "Test benefit",
    status: "approved",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

test("GuardrailEvaluator allows candidate with all evidence", () => {
  const evaluator = new GuardrailEvaluator();
  const learningObjects = [createLearningObject()];
  const strategyVersion = createStrategyVersion("Test", learningObjects, "stable");

  const candidate = createCandidate();

  const result = evaluator.evaluate(candidate, strategyVersion);
  assert.equal(result.allowed, true);
  assert.deepEqual(result.reasonCodes, []);
});

test("GuardrailEvaluator blocks candidate with missing signal refs", () => {
  const evaluator = new GuardrailEvaluator();
  const strategyVersion = createStrategyVersion("Test", [], "stable");

  const candidate = createCandidate({ sourceSignalRefs: [] });

  const result = evaluator.evaluate(candidate, strategyVersion);
  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.includes("improvement.guardrail_missing_evidence"));
});

test("GuardrailEvaluator blocks candidate with missing learning objects", () => {
  const evaluator = new GuardrailEvaluator();
  const strategyVersion = createStrategyVersion("Test", [], "stable");

  const candidate = createCandidate({ sourceLearningObjectIds: [], learningObjectId: "missing_learning_object" });

  const result = evaluator.evaluate(candidate, strategyVersion);
  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.includes("improvement.guardrail_missing_learning_object"));
});

test("GuardrailEvaluator blocks unlinked strategy", () => {
  const evaluator = new GuardrailEvaluator();
  const strategyVersion = createStrategyVersion("Test", [], "stable");

  const candidate = createCandidate();

  // Strategy version has empty sourceLearningObjectIds
  const result = evaluator.evaluate(candidate, strategyVersion);
  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.includes("improvement.guardrail_unlinked_strategy"));
});

test("GuardrailEvaluator blocks shadow release without approval", () => {
  const evaluator = new GuardrailEvaluator();
  const strategyVersion = createStrategyVersion("Test", [], "shadow");

  const candidate = createCandidate({ status: "proposed" });

  const result = evaluator.evaluate(candidate, strategyVersion);
  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.includes("improvement.guardrail_shadow_requires_approval"));
});

test("GuardrailEvaluator allows shadow with approved status", () => {
  const evaluator = new GuardrailEvaluator();
  const learningObjects = [createLearningObject()];
  const strategyVersion = createStrategyVersion("Test", learningObjects, "shadow");

  const candidate = createCandidate();

  const result = evaluator.evaluate(candidate, strategyVersion);
  assert.equal(result.allowed, true);
});

test("GuardrailEvaluator allows shadow_running status", () => {
  const evaluator = new GuardrailEvaluator();
  const learningObjects = [createLearningObject()];
  const strategyVersion = createStrategyVersion("Test", learningObjects, "shadow");

  const candidate = createCandidate({ status: "shadow_running" });

  const result = evaluator.evaluate(candidate, strategyVersion);
  assert.equal(result.allowed, true);
});
