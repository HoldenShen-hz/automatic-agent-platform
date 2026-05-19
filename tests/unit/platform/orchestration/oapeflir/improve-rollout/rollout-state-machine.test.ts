import assert from "node:assert/strict";
import test from "node:test";

import { RolloutStateMachine } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/rollout/rollout-state-machine.js";
import type { ImprovementCandidate } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/types/improvement-candidate.js";

function createCandidate(status: ImprovementCandidate["status"]): ImprovementCandidate {
  return {
    candidateId: `candidate_${status}`,
    taskId: "task_rollout",
    sourceSignalRefs: ["signal_1"],
    sourceLearningObjectIds: ["learning_1"],
    changeScope: "policy",
    description: "rollout candidate",
    expectedBenefit: "safer progressive promotion",
    status,
    createdAt: Date.now(),
  };
}

test("RolloutStateMachine promotes approved candidates into evaluation lane", () => {
  const stateMachine = new RolloutStateMachine();
  const record = stateMachine.transition(createCandidate("approved"), "L1_evaluate", {
    approvedBy: "operator",
  });

  assert.equal(record.previousLevel, "L0_off");
  assert.equal(record.level, "L1_evaluate");
  assert.equal(record.status, "evaluation_enabled");
});

test("RolloutStateMachine allows progressive promotion from evaluation to stable lanes", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const canary = stateMachine.transition(candidate, "L2_canary", {
    currentStatus: "evaluation_enabled",
  });
  assert.equal(canary.previousLevel, "L1_evaluate");
  assert.equal(canary.status, "canary_5");

  const partial = stateMachine.transition(candidate, "L3_partial", {
    currentStatus: "canary_5",
  });
  assert.equal(partial.previousLevel, "L2_canary");
  assert.equal(partial.status, "partial_25");

  const stable = stateMachine.transition(candidate, "L4_stable", {
    currentStatus: "partial_25",
  });
  assert.equal(stable.previousLevel, "L3_partial");
  assert.equal(stable.status, "stable_75");
});

test("RolloutStateMachine rejects invalid transitions", () => {
  const stateMachine = new RolloutStateMachine();
  assert.throws(
    () => stateMachine.transition(createCandidate("approved"), "L4_stable", {
      currentStatus: "candidate_created",
    }),
    /Invalid rollout transition/,
  );
});

test("RolloutStateMachine allows rejected and rolled_back self-transitions", () => {
  const stateMachine = new RolloutStateMachine();

  const rejected = stateMachine.transition(createCandidate("rejected"), "L0_off", {
    currentStatus: "rejected",
    targetStatus: "rejected",
  });
  assert.equal(rejected.status, "rejected");

  const rolledBack = stateMachine.transition(createCandidate("rolled_back"), "L0_off", {
    currentStatus: "rolled_back",
    targetStatus: "rolled_back",
  });
  assert.equal(rolledBack.status, "rolled_back");
});

test("RolloutStateMachine infers terminal statuses from candidate state", () => {
  const stateMachine = new RolloutStateMachine();

  const rejected = stateMachine.transition(createCandidate("rejected"), "L0_off", {
    targetStatus: "rejected",
  });
  assert.equal(rejected.previousLevel, "L0_off");
  assert.equal(rejected.status, "rejected");

  const rolledBack = stateMachine.transition(createCandidate("rolled_back"), "L0_off", {
    targetStatus: "rolled_back",
  });
  assert.equal(rolledBack.previousLevel, "L0_off");
  assert.equal(rolledBack.status, "rolled_back");
});

test("RolloutStateMachine allows paused rollouts to resume or roll back", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const resumed = stateMachine.transition(candidate, "L3_partial", {
    currentStatus: "paused",
  });
  assert.equal(resumed.status, "partial_25");

  const rolledBack = stateMachine.transition(candidate, "L0_off", {
    currentStatus: "paused",
    targetStatus: "rolled_back",
  });
  assert.equal(rolledBack.status, "rolled_back");
});

test("RolloutStateMachine blocks paused rollouts from jumping directly into stable or released states", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  assert.throws(
    () => stateMachine.transition(candidate, "L4_stable", {
      currentStatus: "paused",
    }),
    /Invalid rollout transition/,
  );
  assert.throws(
    () => stateMachine.transition(candidate, "L5_full", {
      currentStatus: "paused",
      targetStatus: "released",
    }),
    /Invalid rollout transition/,
  );
});

test("RolloutStateMachine preserves guardrail reason codes", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");

  const result = stateMachine.transition(candidate, "L1_evaluate", {
    guardrailReasonCodes: ["rollout.metrics_gate_failed", "rollout.latency_exceeded"],
  });

  assert.deepEqual(result.guardrailReasonCodes, ["rollout.metrics_gate_failed", "rollout.latency_exceeded"]);
});

test("RolloutStateMachine preserves evidence from candidate source signals", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createCandidate("approved");
  candidate.sourceSignalRefs = ["sig_1", "sig_2", "sig_3"];

  const result = stateMachine.transition(candidate, "L1_evaluate");

  assert.deepEqual(result.evidence, ["sig_1", "sig_2", "sig_3"]);
});
