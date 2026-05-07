import assert from "node:assert/strict";
import test from "node:test";

import { ImprovementCandidateRegistry } from "../../../../src/platform/five-plane-orchestration/improve-rollout/improvement-candidate-registry.js";

test("ImprovementCandidateRegistry evicts least recently used candidates at max size", () => {
  const registry = new ImprovementCandidateRegistry(2);
  const learningObjects = [
    {
      learningObjectId: "lo-1",
      learningType: "failure_pattern",
      title: "Pattern",
      summary: "Repeated failure",
      confidence: 0.8,
      evidenceRefs: ["evidence-1"],
      sourceSignalIds: ["signal-1"],
      recommendation: "Tighten routing policy",
      validatedBy: "evidence",
      promotionStatus: "validated",
      createdAt: "2026-05-07T00:00:00.000Z",
    },
  ] as any;

  const first = registry.register({
    taskId: "task-1",
    target: "routing_policy",
    learningObjects,
    description: "first",
  });
  registry.register({
    taskId: "task-2",
    target: "routing_policy",
    learningObjects,
    description: "second",
  });
  registry.register({
    taskId: "task-3",
    target: "routing_policy",
    learningObjects,
    description: "third",
  });

  const listedIds = registry.list().map((candidate) => candidate.candidateId);
  assert.equal(listedIds.includes(first.candidateId), false);
  assert.equal(listedIds.length, 2);
});
