import assert from "node:assert/strict";
import test from "node:test";

import { RolloutStateMachine } from "../../../../../src/platform/orchestration/improve-rollout/rollout/rollout-state-machine.js";
import type { ImprovementCandidate } from "../../../../../src/platform/orchestration/improve-rollout/improvement-candidate-registry.js";

function createMockCandidate(overrides: Partial<ImprovementCandidate> = {}): ImprovementCandidate {
  return {
    candidateId: "candidate_test_1",
    taskId: "task_test_1",
    sourceSignalRefs: [],
    sourceLearningObjectIds: [],
    changeScope: "policy",
    description: "Test candidate for rollout state machine",
    expectedBenefit: "Test benefit",
    status: "approved",
    createdAt: Date.now(),
    ...overrides,
  } as ImprovementCandidate;
}

test("RolloutStateMachine creates evaluation record from approved candidate", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "approved" });

  const record = stateMachine.transition(candidate, "L1_evaluate", {
    approvedBy: "admin_user",
    strategyVersionId: "v2.0.0",
    guardrailReasonCodes: ["guardrail_001", "guardrail_002"],
  });

  assert.equal(record.candidateId, candidate.candidateId);
  assert.equal(record.level, "L1_evaluate");
  assert.equal(record.previousLevel, "L0_off");
  assert.equal(record.status, "evaluation_enabled");
  assert.equal(record.approvedBy, "admin_user");
  assert.equal(record.strategyVersionId, "v2.0.0");
  assert.deepEqual(record.guardrailReasonCodes, ["guardrail_001", "guardrail_002"]);
});

test("RolloutStateMachine advances through canary to stable lanes", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createMockCandidate();

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

test("RolloutStateMachine promotes stable rollout to full release", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const full = stateMachine.transition(candidate, "L5_full", {
    currentStatus: "stable_100",
  });

  assert.equal(full.previousLevel, "L5_full");
  assert.equal(full.status, "released");
});

test("RolloutStateMachine rejects skipped transitions", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  assert.throws(
    () => stateMachine.transition(candidate, "L3_partial"),
    /Invalid rollout transition/,
  );
});

test("RolloutStateMachine permits terminal self-transitions", () => {
  const stateMachine = new RolloutStateMachine();

  const rejected = stateMachine.transition(createMockCandidate({ status: "rejected" }), "L0_off", {
    currentStatus: "rejected",
    targetStatus: "rejected",
  });
  assert.equal(rejected.status, "rejected");

  const rolledBack = stateMachine.transition(createMockCandidate({ status: "rolled_back" }), "L0_off", {
    currentStatus: "rolled_back",
    targetStatus: "rolled_back",
  });
  assert.equal(rolledBack.status, "rolled_back");
});

test("RolloutStateMachine allows paused rollouts to resume or roll back", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const resumed = stateMachine.transition(candidate, "L2_canary", {
    currentStatus: "paused",
  });
  assert.equal(resumed.status, "canary_5");

  const rolledBack = stateMachine.transition(candidate, "L0_off", {
    currentStatus: "paused",
    targetStatus: "rolled_back",
  });
  assert.equal(rolledBack.status, "rolled_back");
});

test("RolloutStateMachine preserves evidence from source signals", () => {
  const stateMachine = new RolloutStateMachine();
  const candidate = createMockCandidate({
    sourceSignalRefs: ["signal_1", "signal_2"],
  });

  const record = stateMachine.transition(candidate, "L1_evaluate");
  assert.deepEqual(record.evidence, ["signal_1", "signal_2"]);
});
