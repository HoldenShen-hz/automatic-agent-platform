import test from "node:test";
import assert from "node:assert/strict";

import { ImprovementCandidateRegistry, type RegisterImprovementCandidateInput } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/improvement-candidate-registry.js";
import type { LearningObject } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/learn/learning-object-model.js";

function createLearningObject(overrides: Partial<LearningObject> = {}): LearningObject {
  const learningObjectId = overrides.learningObjectId ?? overrides.objectId ?? "lo_test";
  const learningType = overrides.learningType ?? overrides.kind ?? "failure_pattern";
  const title = overrides.title ?? "Test Pattern";
  const summary = overrides.summary ?? "A test pattern";
  const evidenceRefs = overrides.evidenceRefs ?? ["artifact:1"];
  const sourceSignalIds = overrides.sourceSignalIds ?? ["sig_1"];
  const recommendation = overrides.recommendation ?? "Use narrower scope";

  return {
    learningObjectId,
    objectId: overrides.objectId ?? learningObjectId,
    learningType,
    kind: overrides.kind ?? learningType,
    title,
    summary,
    content: overrides.content ?? {
      title,
      summary,
      evidenceRefs,
      sourceSignalIds,
      recommendation,
    },
    confidence: overrides.confidence ?? 0.9,
    evidenceRefs,
    sourceSignalIds,
    recommendation,
    validatedBy: overrides.validatedBy ?? "evidence",
    promotionStatus: overrides.promotionStatus ?? "validated",
    status: overrides.status ?? "validated",
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    ...overrides,
  };
}

test("ImprovementCandidateRegistry registers a candidate", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects: LearningObject[] = [
    createLearningObject({ learningObjectId: "lo_1" }),
  ];

  const input: RegisterImprovementCandidateInput = {
    taskId: "task_1",
    target: "planning_policy",
    learningObjects,
    description: "Improve planning",
    expectedBenefit: "Better plans",
  };

  const candidate = registry.register(input);

  assert.ok(candidate.candidateId.startsWith("improvement_candidate_"));
  assert.equal(candidate.taskId, "task_1");
  assert.equal(candidate.changeScope, "policy");
  assert.equal(candidate.description, "Improve planning");
  assert.equal(candidate.status, "candidate_created");
});

test("ImprovementCandidateRegistry.list returns all candidates", () => {
  const registry = new ImprovementCandidateRegistry();

  registry.register({
    taskId: "task_1",
    target: "routing_policy",
    learningObjects: [],
    description: "Candidate 1",
  });

  registry.register({
    taskId: "task_2",
    target: "memory_policy",
    learningObjects: [],
    description: "Candidate 2",
  });

  const candidates = registry.list();
  assert.equal(candidates.length, 2);
});

test("ImprovementCandidateRegistry.updateStatus updates candidate status", () => {
  const registry = new ImprovementCandidateRegistry();

  const candidate = registry.register({
    taskId: "task_1",
    target: "execution_policy",
    learningObjects: [],
    description: "Test",
  });

  assert.equal(candidate.status, "candidate_created");

  const updated = registry.updateStatus(candidate.candidateId, "approved");
  assert.ok(updated);
  assert.equal(updated?.status, "approved");
});

test("ImprovementCandidateRegistry.updateStatus returns null for unknown candidate", () => {
  const registry = new ImprovementCandidateRegistry();

  const result = registry.updateStatus("unknown_id", "approved");
  assert.equal(result, null);
});

test("ImprovementCandidateRegistry maps autonomy targets to correct scopes", () => {
  const registry = new ImprovementCandidateRegistry();

  const routingCandidate = registry.register({
    taskId: "task_1",
    target: "routing_policy",
    learningObjects: [],
    description: "Routing policy",
  });
  assert.equal(routingCandidate.changeScope, "policy");

  const memoryCandidate = registry.register({
    taskId: "task_2",
    target: "memory_policy",
    learningObjects: [],
    description: "Memory policy",
  });
  assert.equal(memoryCandidate.changeScope, "workflow");

  const sandboxCandidate = registry.register({
    taskId: "task_3",
    target: "sandbox_policy",
    learningObjects: [],
    description: "Sandbox policy",
  });
  assert.equal(sandboxCandidate.changeScope, "tool_config");

  const providerCandidate = registry.register({
    taskId: "task_4",
    target: "provider_registry",
    learningObjects: [],
    description: "Provider registry",
  });
  assert.equal(providerCandidate.changeScope, "model");
});

test("ImprovementCandidateRegistry uses default expectedBenefit when not provided", () => {
  const registry = new ImprovementCandidateRegistry();

  const candidate = registry.register({
    taskId: "task_1",
    target: "planning_policy",
    learningObjects: [],
    description: "Test",
  });

  assert.ok(candidate.expectedBenefit.includes("Reduce repeated failure modes"));
});

test("ImprovementCandidateRegistry collects evidence refs from learning objects", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects: LearningObject[] = [
    createLearningObject({
      learningObjectId: "lo_1",
      title: "Pattern 1",
      summary: "Summary 1",
      evidenceRefs: ["artifact:a", "artifact:b"],
    }),
    createLearningObject({
      learningObjectId: "lo_2",
      learningType: "user_correction",
      kind: "user_correction",
      title: "Pattern 2",
      summary: "Summary 2",
      confidence: 0.8,
      evidenceRefs: ["artifact:c"],
      sourceSignalIds: ["sig_2"],
      recommendation: "Rec 2",
    }),
  ];

  const candidate = registry.register({
    taskId: "task_1",
    target: "planning_policy",
    learningObjects,
    description: "Test",
  });

  assert.equal(candidate.sourceSignalRefs.length, 3);
  assert.equal(candidate.sourceLearningObjectIds.length, 2);
});
