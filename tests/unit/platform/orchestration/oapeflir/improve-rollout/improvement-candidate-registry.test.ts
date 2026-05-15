import test from "node:test";
import assert from "node:assert/strict";

import { ImprovementCandidateRegistry, type RegisterImprovementCandidateInput } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/improvement-candidate-registry.js";
import type { LearningObject } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/learn/learning-object-model.js";

test("ImprovementCandidateRegistry registers a candidate", () => {
  const registry = new ImprovementCandidateRegistry();
  const learningObjects: LearningObject[] = [
    {
      learningObjectId: "lo_1",
      learningType: "failure_pattern",
      title: "Test Pattern",
      summary: "A test pattern",
      confidence: 0.9,
      evidenceRefs: ["artifact:1"],
      sourceSignalIds: ["sig_1"],
      recommendation: "Use narrower scope",
      validatedBy: "evidence",
      promotionStatus: "validated",
      createdAt: Date.now(),
    },
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
    {
      learningObjectId: "lo_1",
      learningType: "failure_pattern",
      title: "Pattern 1",
      summary: "Summary 1",
      confidence: 0.9,
      evidenceRefs: ["artifact:a", "artifact:b"],
      sourceSignalIds: ["sig_1"],
      recommendation: "Rec 1",
      validatedBy: "evidence",
      promotionStatus: "validated",
      createdAt: Date.now(),
    },
    {
      learningObjectId: "lo_2",
      learningType: "user_correction",
      title: "Pattern 2",
      summary: "Summary 2",
      confidence: 0.8,
      evidenceRefs: ["artifact:c"],
      sourceSignalIds: ["sig_2"],
      recommendation: "Rec 2",
      validatedBy: "evidence",
      promotionStatus: "validated",
      createdAt: Date.now(),
    },
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
