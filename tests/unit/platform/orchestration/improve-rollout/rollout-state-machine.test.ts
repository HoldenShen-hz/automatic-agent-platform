import assert from "node:assert/strict";
import test from "node:test";

import { RolloutStateMachine, type RolloutTransitionOptions } from "../../../../../src/platform/orchestration/improve-rollout/rollout/rollout-state-machine.js";
import type { ImprovementCandidate } from "../../../../../src/platform/orchestration/oapeflir/types/improvement-candidate.js";

function createMockCandidate(status: ImprovementCandidate["status"] = "approved"): ImprovementCandidate {
  return {
    candidateId: "candidate_1",
    taskId: "task_1",
    sourceSignalRefs: ["signal_1"],
    sourceLearningObjectIds: [],
    changeScope: "prompt",
    description: "Test candidate",
    expectedBenefit: "Improves quality",
    status,
    createdAt: Date.now(),
  };
}

test("RolloutStateMachine.transition promotes approved candidate into evaluation", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("approved");

  const result = machine.transition(candidate, "L1_evaluate");

  assert.equal(result.status, "evaluation_enabled");
  assert.equal(result.level, "L1_evaluate");
  assert.equal(result.previousLevel, "L0_off");
});

test("RolloutStateMachine.transition promotes evaluation_enabled to canary_5", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("approved");

  const result = machine.transition(candidate, "L2_canary", {
    currentStatus: "evaluation_enabled",
  });

  assert.equal(result.status, "canary_5");
  assert.equal(result.level, "L2_canary");
  assert.equal(result.previousLevel, "L1_evaluate");
});

test("RolloutStateMachine.transition progresses through standardized rollout stages", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("approved");
  const transitions = [
    { currentStatus: "canary_5", nextLevel: "L3_partial", expectedStatus: "partial_25", expectedLevel: "L3_partial", expectedPrevious: "L2_canary" },
    { currentStatus: "partial_25", nextLevel: "L4_stable", expectedStatus: "stable_75", expectedLevel: "L4_stable", expectedPrevious: "L3_partial" },
    { currentStatus: "stable_75", nextLevel: "L5_full", expectedStatus: "stable_100", expectedLevel: "L5_full", expectedPrevious: "L4_stable" },
    { currentStatus: "stable_100", nextLevel: "L5_full", expectedStatus: "released", expectedLevel: "L5_full", expectedPrevious: "L5_full" },
  ] as const;

  for (const transition of transitions) {
    const result = machine.transition(candidate, transition.nextLevel, {
      currentStatus: transition.currentStatus,
    });
    assert.equal(result.status, transition.expectedStatus);
    assert.equal(result.level, transition.expectedLevel);
    assert.equal(result.previousLevel, transition.expectedPrevious);
  }
});

test("RolloutStateMachine.transition rolls back progressive status and rejects pre-rollout status", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("approved");

  const rolledBack = machine.transition(candidate, "L0_off", {
    currentStatus: "canary_5",
  });
  assert.equal(rolledBack.status, "rolled_back");
  assert.equal(rolledBack.level, "L0_off");

  const rejected = machine.transition(candidate, "L0_off", {
    currentStatus: "candidate_created",
  });
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.level, "L0_off");
});

test("RolloutStateMachine.transition throws for invalid transition", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("approved");

  assert.throws(() => {
    machine.transition(candidate, "L4_stable");
  }, /Invalid rollout transition/);
});

test("RolloutStateMachine.transition blocks rejected candidate from resuming rollout", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("rejected");

  assert.throws(() => {
    machine.transition(candidate, "L1_evaluate", { currentStatus: "rejected" });
  }, /Invalid rollout transition/);
});

test("RolloutStateMachine.transition records approval and strategy metadata", () => {
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
});

test("RolloutStateMachine.transition includes evidence from candidate", () => {
  const machine = new RolloutStateMachine();
  const candidate: ImprovementCandidate = {
    ...createMockCandidate("approved"),
    sourceSignalRefs: ["signal_a", "signal_b"],
  };

  const result = machine.transition(candidate, "L1_evaluate");

  assert.deepEqual(result.evidence, ["signal_a", "signal_b"]);
});

test("RolloutStateMachine.transition generates unique record ids", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("approved");

  const result1 = machine.transition(candidate, "L1_evaluate");
  const result2 = machine.transition(candidate, "L1_evaluate");

  assert.notEqual(result1.recordId, result2.recordId);
  assert.ok(result1.recordId.startsWith("rollout_"));
});

test("RolloutStateMachine.transition allows paused rollout to resume", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("approved");

  const paused = machine.transition(candidate, "L4_stable", {
    currentStatus: "stable_75",
    targetStatus: "paused",
  });
  assert.equal(paused.status, "paused");

  const resumed = machine.transition(candidate, "L2_canary", {
    currentStatus: "paused",
  });
  assert.equal(resumed.status, "canary_5");
});
