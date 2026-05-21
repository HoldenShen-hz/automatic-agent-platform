import assert from "node:assert/strict";
import test from "node:test";

// RolloutStateMachine tests - stateless transition-based API
import { RolloutStateMachine } from "../../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/rollout/rollout-state-machine.js";
import type { ImprovementCandidate } from "../../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/improvement-candidate-registry.js";

function createMockCandidate(overrides: Partial<ImprovementCandidate> = {}): ImprovementCandidate {
  return {
    candidateId: "ic_test_123",
    taskId: "task_123",
    sourceSignalRefs: ["signal_1"],
    sourceLearningObjectIds: ["lo_1"],
    changeScope: "task_template",
    description: "Test candidate",
    expectedBenefit: "Test benefit",
    status: "approved",
    createdAt: Date.now(),
    ...overrides,
  } as ImprovementCandidate;
}

test("RolloutStateMachine can be instantiated", () => {
  const machine = new RolloutStateMachine();
  assert.ok(machine !== undefined);
});

test("RolloutStateMachine has required state transition methods", () => {
  const machine = new RolloutStateMachine();
  assert.equal(typeof machine.transition, "function");
});

test("RolloutStateMachine.transition creates a rollout record", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "approved" });

  const record = machine.transition(candidate, "L1_evaluate");

  assert.ok(record.recordId.startsWith("rollout_"));
  assert.equal(record.candidateId, "ic_test_123");
  assert.equal(record.level, "L1_evaluate");
  assert.equal(record.status, "evaluation_enabled");
});

test("RolloutStateMachine.transition rejects invalid transitions", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "approved" });

  assert.throws(
    () => machine.transition(candidate, "L5_full"),
    /Invalid rollout transition/,
  );
});

test("RolloutStateMachine.transition allows candidate_created to reject", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "candidate_created" });

  const record = machine.transition(candidate, "L0_off", {
    targetStatus: "rejected",
  });

  assert.equal(record.status, "rejected");
  assert.equal(record.level, "L0_off");
});

test("RolloutStateMachine.transition handles canary progression", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "evaluation_enabled" });

  const record = machine.transition(candidate, "L2_canary", {
    targetStatus: "canary_5",
  });

  assert.equal(record.level, "L2_canary");
  assert.equal(record.status, "canary_5");
});