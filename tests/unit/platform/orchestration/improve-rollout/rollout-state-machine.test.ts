import assert from "node:assert/strict";
import test from "node:test";

import { RolloutStateMachine, type RolloutTransitionOptions } from "../../../../../src/platform/orchestration/improve-rollout/rollout/rollout-state-machine.js";
import type { ImprovementCandidate } from "../../../../../src/platform/orchestration/oapeflir/types/improvement-candidate.js";
import type { RolloutRecord } from "../../../../../src/platform/orchestration/oapeflir/types/rollout-record.js";

function createMockCandidate(status: ImprovementCandidate["status"] = "proposed"): ImprovementCandidate {
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

test("RolloutStateMachine.transition allows draft to pending_approval", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("proposed");
  
  const result = machine.transition(candidate, "suggest");
  
  assert.equal(result.status, "pending_approval");
  assert.equal(result.level, "suggest");
  assert.equal(result.previousLevel, "off");
});

test("RolloutStateMachine.transition allows draft to shadow", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("proposed");
  
  const result = machine.transition(candidate, "shadow");
  
  assert.equal(result.status, "shadow");
  assert.equal(result.level, "shadow");
});

test("RolloutStateMachine.transition allows shadow to canary_5", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("shadow_running");
  
  const result = machine.transition(candidate, "canary_5");
  
  assert.equal(result.status, "canary_5");
  assert.equal(result.level, "canary_5");
  assert.equal(result.previousLevel, "shadow");
});

test("RolloutStateMachine.transition allows canary_5 to partial_25", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("shadow_running");
  
  const result = machine.transition(candidate, "partial_25");
  
  assert.equal(result.status, "partial_25");
  assert.equal(result.level, "partial_25");
});

test("RolloutStateMachine.transition allows progression through all levels", () => {
  const machine = new RolloutStateMachine();
  const levels: Array<{ level: "canary_5" | "partial_25" | "partial_50" | "partial_75" | "stable"; expectedStatus: string }> = [
    { level: "canary_5", expectedStatus: "canary_5" },
    { level: "partial_25", expectedStatus: "partial_25" },
    { level: "partial_50", expectedStatus: "partial_50" },
    { level: "partial_75", expectedStatus: "partial_75" },
    { level: "stable", expectedStatus: "stable" },
  ];
  
  let candidate = createMockCandidate("shadow_running");
  
  for (const { level, expectedStatus } of levels) {
    const result = machine.transition(candidate, level);
    assert.equal(result.status, expectedStatus, `Failed for level ${level}`);
    candidate = createMockCandidate("approved");
  }
});

test("RolloutStateMachine.transition allows rollback from any active state", () => {
  const machine = new RolloutStateMachine();
  const activeStates: ImprovementCandidate["status"][] = ["approved", "shadow_running"];
  
  for (const status of activeStates) {
    const candidate = createMockCandidate(status);
    const result = machine.transition(candidate, "off");
    assert.equal(result.status, "rolled_back", `Failed for status ${status}`);
    assert.equal(result.level, "off");
  }
});

test("RolloutStateMachine.transition throws for invalid transition", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("proposed");
  
  assert.throws(() => {
    machine.transition(candidate, "stable");
  }, /Invalid rollout transition/);
});

test("RolloutStateMachine.transition throws for rejected candidate", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("rejected");
  
  assert.throws(() => {
    machine.transition(candidate, "suggest");
  }, /Invalid rollout transition/);
});

test("RolloutStateMachine.transition records approval info when provided", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("proposed");
  const options: RolloutTransitionOptions = {
    approvedBy: "admin_user",
  };
  
  const result = machine.transition(candidate, "suggest", options);
  
  assert.equal(result.approvedBy, "admin_user");
});

test("RolloutStateMachine.transition records guardrail reason codes", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("proposed");
  const options: RolloutTransitionOptions = {
    guardrailReasonCodes: ["guardrail_1", "guardrail_2"],
  };
  
  const result = machine.transition(candidate, "shadow", options);
  
  assert.deepEqual(result.guardrailReasonCodes, ["guardrail_1", "guardrail_2"]);
});

test("RolloutStateMachine.transition uses provided strategyVersionId", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("proposed");
  const options: RolloutTransitionOptions = {
    strategyVersionId: "strategy_v2",
  };
  
  const result = machine.transition(candidate, "suggest", options);
  
  assert.equal(result.strategyVersionId, "strategy_v2");
});

test("RolloutStateMachine.transition includes evidence from candidate", () => {
  const machine = new RolloutStateMachine();
  const candidate: ImprovementCandidate = {
    ...createMockCandidate("proposed"),
    sourceSignalRefs: ["signal_a", "signal_b"],
  };
  
  const result = machine.transition(candidate, "shadow");
  
  assert.deepEqual(result.evidence, ["signal_a", "signal_b"]);
});

test("RolloutStateMachine.transition generates unique recordId", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("proposed");
  
  const result1 = machine.transition(candidate, "shadow");
  const result2 = machine.transition(candidate, "shadow");
  
  assert.notEqual(result1.recordId, result2.recordId);
  assert.ok(result1.recordId.startsWith("rollout_"));
});

test("RolloutStateMachine.transition allows paused to resume", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("approved");
  
  // First transition to paused
  const paused = machine.transition(candidate, "suggest", { currentStatus: "stable", targetStatus: "paused" });
  assert.equal(paused.status, "paused");
  
  // Then resume from paused
  const resumed = machine.transition(candidate, "canary_5", { currentStatus: "paused" });
  assert.equal(resumed.status, "canary_5");
});

test("RolloutStateMachine.transition allows transition from draft to rejected", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("proposed");
  
  const result = machine.transition(candidate, "off");
  
  assert.equal(result.status, "rejected");
});

test("RolloutStateMachine.transition records transitionedAt timestamp", () => {
  const machine = new RolloutStateMachine();
  const candidate = createMockCandidate("proposed");
  const before = Date.now();
  
  const result = machine.transition(candidate, "shadow");
  
  const after = Date.now();
  assert.ok(result.transitionedAt >= before);
  assert.ok(result.transitionedAt <= after);
});
