import assert from "node:assert/strict";
import test from "node:test";

import { ImprovementCandidateRegistry } from "../../../../../src/platform/orchestration/improve-rollout/improvement-candidate-registry.js";
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

test("ImprovementCandidateRegistry register creates candidate with proposed status", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects = [createMockLearningObject()];

  const candidate = registry.register({
    taskId: "task-1",
    target: "routing_policy",
    learningObjects,
    description: "Test description",
  });

  assert.ok(candidate.candidateId.startsWith("improvement_candidate_"));
  assert.equal(candidate.taskId, "task-1");
  assert.equal(candidate.status, "proposed");
  assert.equal(candidate.description, "Test description");
});

test("ImprovementCandidateRegistry register extracts evidence refs from learning objects", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects = [
    createMockLearningObject({ learningObjectId: "lo-1", evidenceRefs: ["e1", "e2"] }),
    createMockLearningObject({ learningObjectId: "lo-2", evidenceRefs: ["e3"] }),
  ];

  const candidate = registry.register({
    taskId: "task-1",
    target: "planning_policy",
    learningObjects,
    description: "Test",
  });

  assert.deepEqual(candidate.sourceSignalRefs, ["e1", "e2", "e3"]);
});

test("ImprovementCandidateRegistry register extracts learning object IDs", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects = [
    createMockLearningObject({ learningObjectId: "lo-1" }),
    createMockLearningObject({ learningObjectId: "lo-2" }),
  ];

  const candidate = registry.register({
    taskId: "task-1",
    target: "execution_policy",
    learningObjects,
    description: "Test",
  });

  assert.deepEqual(candidate.sourceLearningObjectIds, ["lo-1", "lo-2"]);
});

test("ImprovementCandidateRegistry register maps routing_policy target to policy scope", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects = [createMockLearningObject()];

  const candidate = registry.register({
    taskId: "task-1",
    target: "routing_policy",
    learningObjects,
    description: "Test",
  });

  assert.equal(candidate.changeScope, "policy");
});

test("ImprovementCandidateRegistry register maps planning_policy target to policy scope", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects = [createMockLearningObject()];

  const candidate = registry.register({
    taskId: "task-1",
    target: "planning_policy",
    learningObjects,
    description: "Test",
  });

  assert.equal(candidate.changeScope, "policy");
});

test("ImprovementCandidateRegistry register maps execution_policy target to policy scope", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects = [createMockLearningObject()];

  const candidate = registry.register({
    taskId: "task-1",
    target: "execution_policy",
    learningObjects,
    description: "Test",
  });

  assert.equal(candidate.changeScope, "policy");
});

test("ImprovementCandidateRegistry register maps memory_policy target to workflow scope", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects = [createMockLearningObject()];

  const candidate = registry.register({
    taskId: "task-1",
    target: "memory_policy",
    learningObjects,
    description: "Test",
  });

  assert.equal(candidate.changeScope, "workflow");
});

test("ImprovementCandidateRegistry register maps sandbox_policy target to tool_config scope", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects = [createMockLearningObject()];

  const candidate = registry.register({
    taskId: "task-1",
    target: "sandbox_policy",
    learningObjects,
    description: "Test",
  });

  assert.equal(candidate.changeScope, "tool_config");
});

test("ImprovementCandidateRegistry register maps provider_registry target to model scope", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects = [createMockLearningObject()];

  const candidate = registry.register({
    taskId: "task-1",
    target: "provider_registry",
    learningObjects,
    description: "Test",
  });

  assert.equal(candidate.changeScope, "model");
});

test("ImprovementCandidateRegistry register uses default expected benefit", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects = [createMockLearningObject()];

  const candidate = registry.register({
    taskId: "task-1",
    target: "routing_policy",
    learningObjects,
    description: "Test",
  });

  assert.ok(candidate.expectedBenefit.length > 0);
});

test("ImprovementCandidateRegistry register uses custom expected benefit", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects = [createMockLearningObject()];

  const candidate = registry.register({
    taskId: "task-1",
    target: "routing_policy",
    learningObjects,
    description: "Test",
    expectedBenefit: "Custom benefit",
  });

  assert.equal(candidate.expectedBenefit, "Custom benefit");
});

test("ImprovementCandidateRegistry list returns all registered candidates", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects = [createMockLearningObject()];

  registry.register({
    taskId: "task-1",
    target: "routing_policy",
    learningObjects,
    description: "Test 1",
  });
  registry.register({
    taskId: "task-2",
    target: "planning_policy",
    learningObjects,
    description: "Test 2",
  });

  const candidates = registry.list();

  assert.equal(candidates.length, 2);
});

test("ImprovementCandidateRegistry list returns empty array initially", () => {
  const registry = new ImprovementCandidateRegistry();

  const candidates = registry.list();

  assert.deepEqual(candidates, []);
});

test("ImprovementCandidateRegistry updateStatus updates candidate status", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects = [createMockLearningObject()];

  const registered = registry.register({
    taskId: "task-1",
    target: "routing_policy",
    learningObjects,
    description: "Test",
  });

  const updated = registry.updateStatus(registered.candidateId, "approved");

  assert.ok(updated);
  assert.equal(updated?.status, "approved");
});

test("ImprovementCandidateRegistry updateStatus returns null for unknown candidate", () => {
  const registry = new ImprovementCandidateRegistry();

  const updated = registry.updateStatus("unknown-candidate", "approved");

  assert.equal(updated, null);
});

test("ImprovementCandidateRegistry updateStatus preserves other fields", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects = [createMockLearningObject()];

  const registered = registry.register({
    taskId: "task-1",
    target: "routing_policy",
    learningObjects,
    description: "Original description",
  });

  const updated = registry.updateStatus(registered.candidateId, "shadow_running");

  assert.ok(updated);
  assert.equal(updated?.candidateId, registered.candidateId);
  assert.equal(updated?.taskId, "task-1");
  assert.equal(updated?.description, "Original description");
  assert.equal(updated?.status, "shadow_running");
});

test("ImprovementCandidateRegistry register deduplicates evidence refs", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects = [
    createMockLearningObject({ evidenceRefs: ["shared", "e1"] }),
    createMockLearningObject({ evidenceRefs: ["shared", "e2"] }),
  ];

  const candidate = registry.register({
    taskId: "task-1",
    target: "routing_policy",
    learningObjects,
    description: "Test",
  });

  assert.deepEqual(candidate.sourceSignalRefs, ["shared", "e1", "e2"]);
});

test("ImprovementCandidateRegistry updateStatus works with rejected status", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects = [createMockLearningObject()];

  const registered = registry.register({
    taskId: "task-1",
    target: "routing_policy",
    learningObjects,
    description: "Test",
  });

  const updated = registry.updateStatus(registered.candidateId, "rejected");

  assert.ok(updated);
  assert.equal(updated?.status, "rejected");
});

test("ImprovementCandidateRegistry updateStatus works with rolled_back status", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects = [createMockLearningObject()];

  const registered = registry.register({
    taskId: "task-1",
    target: "routing_policy",
    learningObjects,
    description: "Test",
  });

  const updated = registry.updateStatus(registered.candidateId, "rolled_back");

  assert.ok(updated);
  assert.equal(updated?.status, "rolled_back");
});
