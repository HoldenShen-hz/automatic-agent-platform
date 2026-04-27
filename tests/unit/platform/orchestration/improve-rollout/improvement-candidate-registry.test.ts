import assert from "node:assert/strict";
import test from "node:test";

import {
  ImprovementCandidateRegistry,
  type RegisterImprovementCandidateInput,
} from "../../../../../src/platform/orchestration/improve-rollout/improvement-candidate-registry.js";
import type { LearningObject } from "../../../../../src/platform/orchestration/learn/learning-object-model.js";
import type { AutonomyTarget } from "../../../../../src/platform/orchestration/improve-rollout/autonomy-boundary-policy.js";

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

function makeRegisterInput(overrides: Partial<RegisterImprovementCandidateInput> = {}): RegisterImprovementCandidateInput {
  return {
    taskId: "task-1",
    target: "planning_policy",
    learningObjects: [makeLearningObject()],
    description: "Test improvement candidate",
    expectedBenefit: "Test benefit",
    ...overrides,
  };
}

test("ImprovementCandidateRegistry.register creates candidate with correct fields", () => {
  const registry = new ImprovementCandidateRegistry();
  const input = makeRegisterInput();

  const candidate = registry.register(input);

  assert.equal(candidate.taskId, "task-1");
  assert.equal(candidate.description, "Test improvement candidate");
  assert.equal(candidate.expectedBenefit, "Test benefit");
  assert.equal(candidate.status, "proposed");
  assert.ok(typeof candidate.candidateId === "string");
  assert.ok(candidate.candidateId.startsWith("improvement_candidate"));
});

test("ImprovementCandidateRegistry.register maps autonomy target to change scope", () => {
  const registry = new ImprovementCandidateRegistry();

  const targets: AutonomyTarget[] = ["routing_policy", "planning_policy", "execution_policy"];
  for (const target of targets) {
    const candidate = registry.register(makeRegisterInput({ target }));
    assert.equal(candidate.changeScope, "policy");
  }

  const memoryTarget = registry.register(makeRegisterInput({ target: "memory_policy" }));
  assert.equal(memoryTarget.changeScope, "workflow");

  const sandboxTarget = registry.register(makeRegisterInput({ target: "sandbox_policy" }));
  assert.equal(sandboxTarget.changeScope, "tool_config");

  const providerTarget = registry.register(makeRegisterInput({ target: "provider_registry" }));
  assert.equal(providerTarget.changeScope, "model");
});

test("ImprovementCandidateRegistry.register collects evidence refs from learning objects", () => {
  const registry = new ImprovementCandidateRegistry();
  const lo1 = makeLearningObject({ learningObjectId: "lo-1", evidenceRefs: ["evidence-A", "evidence-B"] });
  const lo2 = makeLearningObject({ learningObjectId: "lo-2", evidenceRefs: ["evidence-C"] });

  const candidate = registry.register(makeRegisterInput({
    learningObjects: [lo1, lo2],
  }));

  assert.ok(candidate.sourceSignalRefs.includes("evidence-A"));
  assert.ok(candidate.sourceSignalRefs.includes("evidence-B"));
  assert.ok(candidate.sourceSignalRefs.includes("evidence-C"));
});

test("ImprovementCandidateRegistry.register collects learning object IDs", () => {
  const registry = new ImprovementCandidateRegistry();
  const lo1 = makeLearningObject({ learningObjectId: "lo-1" });
  const lo2 = makeLearningObject({ learningObjectId: "lo-2" });

  const candidate = registry.register(makeRegisterInput({
    learningObjects: [lo1, lo2],
  }));

  assert.ok(candidate.sourceLearningObjectIds.includes("lo-1"));
  assert.ok(candidate.sourceLearningObjectIds.includes("lo-2"));
});

test("ImprovementCandidateRegistry.register uses default expected benefit when not provided", () => {
  const registry = new ImprovementCandidateRegistry();
  const input: RegisterImprovementCandidateInput = {
    taskId: "task-1",
    target: "planning_policy",
    learningObjects: [],
    description: "Test",
  };

  const candidate = registry.register(input);

  assert.equal(candidate.expectedBenefit, "Reduce repeated failure modes and improve plan stability.");
});

test("ImprovementCandidateRegistry.list returns all registered candidates", () => {
  const registry = new ImprovementCandidateRegistry();
  registry.register(makeRegisterInput({ taskId: "task-1" }));
  registry.register(makeRegisterInput({ taskId: "task-2" }));
  registry.register(makeRegisterInput({ taskId: "task-3" }));

  const list = registry.list();

  assert.equal(list.length, 3);
});

test("ImprovementCandidateRegistry.list returns copy of candidates", () => {
  const registry = new ImprovementCandidateRegistry();
  registry.register(makeRegisterInput());

  const list1 = registry.list();
  const list2 = registry.list();

  assert.notEqual(list1, list2);
  assert.deepEqual(list1, list2);
});

test("ImprovementCandidateRegistry.updateStatus updates candidate status", () => {
  const registry = new ImprovementCandidateRegistry();
  const candidate = registry.register(makeRegisterInput());

  const updated = registry.updateStatus(candidate.candidateId, "approved");

  assert.ok(updated);
  assert.equal(updated?.status, "approved");
});

test("ImprovementCandidateRegistry.updateStatus returns null for unknown candidateId", () => {
  const registry = new ImprovementCandidateRegistry();

  const result = registry.updateStatus("unknown-candidate-id", "approved");

  assert.equal(result, null);
});

test("ImprovementCandidateRegistry.updateStatus returns null when candidate not found", () => {
  const registry = new ImprovementCandidateRegistry();

  const result = registry.updateStatus("non-existent", "rejected");

  assert.equal(result, null);
});

test("ImprovementCandidateRegistry handles all candidate statuses", () => {
  const registry = new ImprovementCandidateRegistry();
  const candidate = registry.register(makeRegisterInput());

  const statuses: Array<"proposed" | "evaluating" | "approved" | "shadow_running" | "rejected" | "rolled_back"> = [
    "proposed",
    "evaluating",
    "approved",
    "shadow_running",
    "rejected",
    "rolled_back",
  ];

  for (const status of statuses) {
    const updated = registry.updateStatus(candidate.candidateId, status);
    assert.equal(updated?.status, status);
  }
});

test("ImprovementCandidateRegistry.register deduplicates evidence refs", () => {
  const registry = new ImprovementCandidateRegistry();
  const lo1 = makeLearningObject({ evidenceRefs: ["evidence-A", "evidence-B"] });
  const lo2 = makeLearningObject({ evidenceRefs: ["evidence-A", "evidence-C"] });

  const candidate = registry.register(makeRegisterInput({
    learningObjects: [lo1, lo2],
  }));

  const evidenceACount = candidate.sourceSignalRefs.filter((ref) => ref === "evidence-A").length;
  assert.equal(evidenceACount, 1);
});

test("ImprovementCandidateRegistry.register uses provided expectedBenefit", () => {
  const registry = new ImprovementCandidateRegistry();
  const candidate = registry.register(makeRegisterInput({
    expectedBenefit: "Custom benefit description",
  }));

  assert.equal(candidate.expectedBenefit, "Custom benefit description");
});
