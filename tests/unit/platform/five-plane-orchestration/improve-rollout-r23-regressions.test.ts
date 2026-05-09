import assert from "node:assert/strict";
import test from "node:test";

import {
  CANARY_ROLLOUT_LEVELS,
  PROGRESSIVE_ROLLOUT_LEVELS,
} from "../../../../src/platform/five-plane-orchestration/improve-rollout/index.js";
import { RolloutStateMachine } from "../../../../src/platform/five-plane-orchestration/improve-rollout/rollout/rollout-state-machine.js";
import { normalizeRolloutLevel, type ImprovementCandidate } from "../../../../src/platform/five-plane-orchestration/oapeflir/types/index.js";

function createCandidate(status: ImprovementCandidate["status"]): ImprovementCandidate {
  return {
    candidateId: "candidate-r23",
    taskId: "task-r23",
    learningObjectId: "learning-r23",
    source: "failure_pattern",
    targetScope: "task",
    priority: "medium",
    rolloutLevel: "L0_off",
    metrics: {
      errorRate: 0,
      latencyP99: 0,
      successRate: 1,
      sampleCount: 0,
    },
    guardrails: [],
    sourceSignalRefs: ["signal-r23"],
    sourceLearningObjectIds: ["learning-r23"],
    changeScope: "prompt",
    description: "Improve prompt stability",
    expectedBenefit: "Reduce regressions",
    status,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  };
}

test("improve-rollout exports canonical L0-L5 progression levels", () => {
  assert.deepEqual(CANARY_ROLLOUT_LEVELS, ["L1_evaluate", "L2_canary"]);
  assert.deepEqual(PROGRESSIVE_ROLLOUT_LEVELS, ["L2_canary", "L3_partial", "L4_stable", "L5_full"]);
  assert.equal(normalizeRolloutLevel("canary_5"), "L2_canary");
  assert.equal(normalizeRolloutLevel("stable_100"), "L5_full");
});

test("RolloutStateMachine rejects self-transitions that would emit misleading audit events", () => {
  const machine = new RolloutStateMachine();

  assert.throws(() => {
    machine.transition(createCandidate("canary_5"), "L2_canary", {
      currentStatus: "canary_5",
      targetStatus: "canary_5",
    });
  }, /Invalid rollout transition/);
});
