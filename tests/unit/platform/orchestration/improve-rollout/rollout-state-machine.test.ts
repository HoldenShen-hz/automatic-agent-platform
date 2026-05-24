import assert from "node:assert/strict";
import test from "node:test";

import { RolloutStateMachine, type RolloutTransitionOptions } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/rollout/rollout-state-machine.js";
import type { ImprovementCandidate } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/improvement-candidate.js";

function createMockCandidate(status: ImprovementCandidate["status"] = "approved"): ImprovementCandidate {
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

test("RolloutStateMachine.transition promotes approved candidate into evaluation and canary", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("approved");

  const evaluation = machine.transition(candidate, "L1_evaluate");
  const canary = machine.transition(candidate, "L2_canary", {
    currentStatus: "evaluation_enabled",
  });

  assert.equal(evaluation.status, "evaluation_enabled");
  assert.equal(evaluation.level, "L1_evaluate");
  assert.equal(canary.status, "canary_5");
  assert.equal(canary.previousLevel, "L1_evaluate");
});

test("RolloutStateMachine.transition records metadata and evidence", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("approved");
  const options: RolloutTransitionOptions = {
    approvedBy: "admin_user",
    strategyVersionId: "strategy_v2",
    guardrailReasonCodes: ["guardrail_1", "guardrail_2"],
  };

  const result = machine.transition(candidate, "L1_evaluate", options);

  assert.equal(result.approvedBy, "admin_user");
  assert.equal(result.strategyVersionId, "strategy_v2");
  assert.deepEqual(result.guardrailReasonCodes, ["guardrail_1", "guardrail_2"]);
  assert.deepEqual(result.evidence, ["signal_1"]);
});

test("RolloutStateMachine.transition blocks invalid transitions and supports pause", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("approved");

  const paused = machine.transition(candidate, "L4_stable", {
    currentStatus: "stable_75",
    targetStatus: "paused",
  });
  assert.equal(paused.status, "paused");

  assert.throws(() => {
    machine.transition(candidate, "L4_stable");
  }, /Invalid rollout transition/);
});
