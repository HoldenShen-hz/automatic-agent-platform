import assert from "node:assert/strict";
import test from "node:test";

import { RolloutStateMachine } from "../../../../src/platform/five-plane-orchestration/improve-rollout/rollout/rollout-state-machine.js";
import type { ImprovementCandidate } from "../../../../src/platform/five-plane-orchestration/improve-rollout/improvement-candidate-registry.js";

function createCandidate(status: ImprovementCandidate["status"] = "approved"): ImprovementCandidate {
  return {
    candidateId: "candidate_1",
    taskId: "task_1",
    learningObjectId: "learning_1",
    source: "failure_pattern",
    targetScope: "task",
    priority: "medium",
    rolloutLevel: "L0_off",
    metrics: { errorRate: 0, latencyP99: 0, successRate: 1, sampleCount: 0 },
    guardrails: [],
    sourceSignalRefs: ["signal_1"],
    sourceLearningObjectIds: ["learning_1"],
    changeScope: "prompt",
    description: "Test candidate",
    expectedBenefit: "Improves quality",
    status,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

test("RolloutStateMachine follows canonical progressive transitions", () => {
  const machine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const evaluation = machine.transition(candidate, "L1_evaluate");
  const canary = machine.transition(candidate, "L2_canary", { currentStatus: "evaluation_enabled" });
  const stable = machine.transition(candidate, "L5_full", { currentStatus: "stable_75" });

  assert.equal(evaluation.status, "evaluation_enabled");
  assert.equal(canary.status, "canary_5");
  assert.equal(stable.status, "stable_100");
});

test("RolloutStateMachine handles rollback and pause transitions", () => {
  const machine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const rolledBack = machine.transition(candidate, "L0_off", { currentStatus: "canary_5" });
  const paused = machine.transition(candidate, "L4_stable", {
    currentStatus: "stable_75",
    targetStatus: "paused",
  });

  assert.equal(rolledBack.status, "rolled_back");
  assert.equal(paused.status, "paused");
});

test("RolloutStateMachine rejects invalid transitions", () => {
  const machine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  assert.throws(() => {
    machine.transition(candidate, "L4_stable");
  }, /Invalid rollout transition/);
});
