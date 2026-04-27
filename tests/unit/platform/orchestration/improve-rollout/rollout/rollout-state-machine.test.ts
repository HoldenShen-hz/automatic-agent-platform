import assert from "node:assert/strict";
import test from "node:test";

import { RolloutStateMachine } from "../../../../../../src/platform/orchestration/improve-rollout/rollout/rollout-state-machine.js";
import type { ImprovementCandidate } from "../../../../../../src/platform/orchestration/improve-rollout/improvement-candidate-registry.js";
import type { RolloutLevel, RolloutRecord } from "../../../../../../src/platform/orchestration/oapeflir/types/rollout-record.js";

function createMockCandidate(overrides: Partial<ImprovementCandidate> = {}): ImprovementCandidate {
  return {
    candidateId: "ic_123",
    taskId: "task_123",
    sourceSignalRefs: ["signal_1"],
    sourceLearningObjectIds: ["lo_1"],
    changeScope: "task_template",
    description: "Test candidate",
    expectedBenefit: "Test benefit",
    status: "proposed",
    createdAt: Date.now(),
    ...overrides,
  } as ImprovementCandidate;
}

test("RolloutStateMachine.transition creates valid rollout record", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = machine.transition(candidate, "shadow");

  assert.ok(record.recordId.startsWith("rollout_"), "recordId should start with rollout_");
  assert.equal(record.candidateId, "ic_123");
  assert.equal(record.level, "shadow");
  assert.equal(record.status, "shadow");
});

test("RolloutStateMachine.transition with explicit status", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = machine.transition(candidate, "canary_5", {
    currentStatus: "shadow",
    targetStatus: "canary_5",
  });

  assert.equal(record.level, "canary_5");
  assert.equal(record.status, "canary_5");
});

test("RolloutStateMachine.transition captures previous level", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = machine.transition(candidate, "partial_25", {
    currentStatus: "canary_5",
  });

  assert.equal(record.level, "partial_25");
  assert.equal(record.previousLevel, "canary_5");
});

test("RolloutStateMachine.transition invalid transition throws", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "draft" });

  assert.throws(
    () => machine.transition(candidate, "stable", { targetStatus: "stable" }),
    /Invalid rollout transition/,
  );
});

test("RolloutStateMachine.transition draft allows pending_approval", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "proposed" });

  const record = machine.transition(candidate, "suggest", {
    currentStatus: "draft",
    targetStatus: "pending_approval",
  });

  assert.equal(record.status, "pending_approval");
  assert.equal(record.level, "suggest");
});

test("RolloutStateMachine.transition records approvedBy", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = machine.transition(candidate, "shadow", {
    approvedBy: "admin-user",
  });

  assert.equal(record.approvedBy, "admin-user");
});

test("RolloutStateMachine.transition records strategyVersionId", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = machine.transition(candidate, "shadow", {
    strategyVersionId: "strategy_v2",
  });

  assert.equal(record.strategyVersionId, "strategy_v2");
});

test("RolloutStateMachine.transition records guardrailReasonCodes", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = machine.transition(candidate, "shadow", {
    guardrailReasonCodes: ["code_1", "code_2"],
  });

  assert.deepEqual(record.guardrailReasonCodes, ["code_1", "code_2"]);
});

test("RolloutStateMachine.transition infers currentStatus from candidate status", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "approved" });

  const record = machine.transition(candidate, "shadow");

  assert.equal(record.status, "shadow");
  // previousLevel should be "suggest" (inferred from pending_approval)
  assert.equal(record.previousLevel, "suggest");
});

test("RolloutStateMachine.transition with shadow_running candidate", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "shadow_running" });

  const record = machine.transition(candidate, "canary_5");

  assert.equal(record.status, "canary_5");
  assert.equal(record.level, "canary_5");
});

test("RolloutStateMachine.transition with rejected candidate", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "rejected" });

  // rejected status only allows "rejected" as target, so we must target "rejected"
  const record = machine.transition(candidate, "off", {
    currentStatus: "rejected",
    targetStatus: "rejected",
  });

  assert.equal(record.status, "rejected");
  assert.equal(record.level, "off");
});

test("RolloutStateMachine.transition with rolled_back candidate", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "rolled_back" });

  // rolled_back status only allows "rolled_back" as target
  const record = machine.transition(candidate, "off", {
    currentStatus: "rolled_back",
    targetStatus: "rolled_back",
  });

  assert.equal(record.status, "rolled_back");
  assert.equal(record.level, "off");
});

test("RolloutStateMachine.transition preserves candidate evidence", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate({
    sourceSignalRefs: ["signal_a", "signal_b", "signal_c"],
  });

  const record = machine.transition(candidate, "shadow");

  assert.deepEqual(record.evidence, ["signal_a", "signal_b", "signal_c"]);
});

test("RolloutStateMachine.transition from partial_25 to partial_50", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = machine.transition(candidate, "partial_50", {
    currentStatus: "partial_25",
    targetStatus: "partial_50",
  });

  assert.equal(record.level, "partial_50");
  assert.equal(record.status, "partial_50");
  assert.equal(record.previousLevel, "partial_25");
});
