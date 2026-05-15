import assert from "node:assert/strict";
import test from "node:test";

import { RolloutStateMachine } from "../../../../../../src/platform/five-plane-orchestration/improve-rollout/rollout/rollout-state-machine.js";
import type { ImprovementCandidate } from "../../../../../../src/platform/five-plane-orchestration/improve-rollout/improvement-candidate-registry.js";

function createMockCandidate(overrides: Partial<ImprovementCandidate> = {}): ImprovementCandidate {
  return {
    candidateId: "ic_123",
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

test("RolloutStateMachine.transition creates an evaluation rollout record", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = machine.transition(candidate, "L1_evaluate");

  assert.ok(record.recordId.startsWith("rollout_"));
  assert.equal(record.candidateId, "ic_123");
  assert.equal(record.level, "L1_evaluate");
  assert.equal(record.status, "evaluation_enabled");
});

test("RolloutStateMachine.transition supports explicit target status", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = machine.transition(candidate, "L2_canary", {
    currentStatus: "evaluation_enabled",
    targetStatus: "canary_5",
  });

  assert.equal(record.level, "L2_canary");
  assert.equal(record.status, "canary_5");
});

test("RolloutStateMachine.transition infers previous rollout level", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = machine.transition(candidate, "L3_partial", {
    currentStatus: "canary_5",
  });

  assert.equal(record.level, "L3_partial");
  assert.equal(record.previousLevel, "L2_canary");
});

test("RolloutStateMachine.transition rejects invalid direct jump", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  assert.throws(
    () => machine.transition(candidate, "L4_stable"),
    /Invalid rollout transition/,
  );
});

test("RolloutStateMachine.transition allows candidate_created to reject", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = machine.transition(candidate, "L0_off", {
    currentStatus: "candidate_created",
    targetStatus: "rejected",
  });

  assert.equal(record.status, "rejected");
  assert.equal(record.level, "L0_off");
});

test("RolloutStateMachine.transition records approvedBy", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = machine.transition(candidate, "L1_evaluate", {
    approvedBy: "admin-user",
  });

  assert.equal(record.approvedBy, "admin-user");
});

test("RolloutStateMachine.transition records strategyVersionId", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = machine.transition(candidate, "L1_evaluate", {
    strategyVersionId: "strategy_v2",
  });

  assert.equal(record.strategyVersionId, "strategy_v2");
});

test("RolloutStateMachine.transition records guardrailReasonCodes", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = machine.transition(candidate, "L1_evaluate", {
    guardrailReasonCodes: ["code_1", "code_2"],
  });

  assert.deepEqual(record.guardrailReasonCodes, ["code_1", "code_2"]);
});

test("RolloutStateMachine.transition infers currentStatus from approved candidate", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "approved" });

  const record = machine.transition(candidate, "L1_evaluate");

  assert.equal(record.status, "evaluation_enabled");
  assert.equal(record.previousLevel, "L0_off");
});

test("RolloutStateMachine.transition blocks rejected and rolled_back terminals", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  assert.throws(() => machine.transition(candidate, "L1_evaluate", {
    currentStatus: "rejected",
  }), /Invalid rollout transition/);

  assert.throws(() => machine.transition(candidate, "L1_evaluate", {
    currentStatus: "rolled_back",
  }), /Invalid rollout transition/);
});

test("RolloutStateMachine.transition preserves candidate evidence", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate({
    sourceSignalRefs: ["signal_a", "signal_b", "signal_c"],
  });

  const record = machine.transition(candidate, "L1_evaluate");

  assert.deepEqual(record.evidence, ["signal_a", "signal_b", "signal_c"]);
});

test("RolloutStateMachine.transition promotes stable_75 to stable_100", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = machine.transition(candidate, "L5_full", {
    currentStatus: "stable_75",
  });

  assert.equal(record.level, "L5_full");
  assert.equal(record.status, "stable_100");
  assert.equal(record.previousLevel, "L4_stable");
});
