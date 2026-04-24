import assert from "node:assert/strict";
import test from "node:test";

import { RolloutStateMachine } from "../../../../../src/platform/orchestration/improve-rollout/rollout/rollout-state-machine.js";
import type { ImprovementCandidate } from "../../../../../src/platform/orchestration/improve-rollout/improvement-candidate-registry.js";

function createMockCandidate(overrides: Partial<ImprovementCandidate> = {}): ImprovementCandidate {
  return {
    candidateId: "candidate-1",
    taskId: "task-1",
    sourceSignalRefs: ["signal-1"],
    sourceLearningObjectIds: ["lo-1"],
    changeScope: "policy",
    description: "Test improvement",
    expectedBenefit: "Test benefit",
    status: "approved",
    createdAt: Date.now(),
    ...overrides,
  };
}

test("RolloutStateMachine transition creates valid rollout record", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = sm.transition(candidate, "shadow");

  assert.equal(record.candidateId, "candidate-1");
  assert.equal(record.level, "shadow");
  assert.equal(record.previousLevel, "suggest");
  assert.equal(record.status, "shadow");
  assert.ok(record.recordId.startsWith("rollout_"));
});

test("RolloutStateMachine transition from approved candidate infers pending_approval status", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "approved" });

  const record = sm.transition(candidate, "suggest");

  assert.equal(record.status, "pending_approval");
  assert.equal(record.previousLevel, "suggest");
});

test("RolloutStateMachine transition from shadow_running candidate infers shadow status", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "shadow_running" });

  const record = sm.transition(candidate, "shadow");

  assert.equal(record.status, "shadow");
  assert.equal(record.previousLevel, "shadow");
});

test("RolloutStateMachine transition from rejected candidate", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "rejected" });

  // rejected can only stay rejected - transition with explicit targetStatus
  const record = sm.transition(candidate, "off", { currentStatus: "rejected", targetStatus: "rejected" });

  assert.equal(record.status, "rejected");
  assert.equal(record.previousLevel, "off");
});

test("RolloutStateMachine transition from rolled_back candidate", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "rolled_back" });

  // rolled_back can only stay rolled_back - transition with explicit targetStatus
  const record = sm.transition(candidate, "off", { currentStatus: "rolled_back", targetStatus: "rolled_back" });

  assert.equal(record.status, "rolled_back");
  assert.equal(record.previousLevel, "off");
});

test("RolloutStateMachine transition throws on invalid transition from draft", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "proposed" });

  assert.throws(
    () => sm.transition(candidate, "stable"),
    /Invalid rollout transition/,
  );
});

test("RolloutStateMachine transition allows draft to pending_approval", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "proposed" });

  const record = sm.transition(candidate, "suggest");

  assert.equal(record.status, "pending_approval");
});

test("RolloutStateMachine transition allows draft to shadow", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "proposed" });

  const record = sm.transition(candidate, "shadow");

  assert.equal(record.status, "shadow");
});

test("RolloutStateMachine transition allows shadow to canary_5", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "shadow_running" });

  const record = sm.transition(candidate, "canary_5");

  assert.equal(record.status, "canary_5");
});

test("RolloutStateMachine transition allows canary_5 to partial_25", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "approved" });

  const record = sm.transition(candidate, "canary_5", { currentStatus: "canary_5" });

  assert.equal(record.status, "canary_5");
});

test("RolloutStateMachine transition allows progression through all levels", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "approved" });

  let record = sm.transition(candidate, "shadow", { currentStatus: "shadow" });
  assert.equal(record.status, "shadow");

  record = sm.transition(candidate, "canary_5", { currentStatus: "shadow", targetStatus: "canary_5" });
  assert.equal(record.status, "canary_5");

  record = sm.transition(candidate, "partial_25", { currentStatus: "canary_5", targetStatus: "partial_25" });
  assert.equal(record.status, "partial_25");

  record = sm.transition(candidate, "partial_50", { currentStatus: "partial_25", targetStatus: "partial_50" });
  assert.equal(record.status, "partial_50");

  record = sm.transition(candidate, "partial_75", { currentStatus: "partial_50", targetStatus: "partial_75" });
  assert.equal(record.status, "partial_75");

  record = sm.transition(candidate, "stable", { currentStatus: "partial_75", targetStatus: "stable" });
  assert.equal(record.status, "stable");
});

test("RolloutStateMachine transition allows rollback from any progressive status", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = sm.transition(candidate, "off", { currentStatus: "canary_5", targetStatus: "rolled_back" });

  assert.equal(record.status, "rolled_back");
  assert.equal(record.level, "off");
});

test("RolloutStateMachine transition allows pause from stable", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = sm.transition(candidate, "suggest", { currentStatus: "stable", targetStatus: "paused" });

  assert.equal(record.status, "paused");
});

test("RolloutStateMachine transition allows resume from paused to canary_5", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = sm.transition(candidate, "canary_5", { currentStatus: "paused", targetStatus: "canary_5" });

  assert.equal(record.status, "canary_5");
});

test("RolloutStateMachine transition preserves strategyVersionId", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = sm.transition(candidate, "shadow", { strategyVersionId: "strategy-123" });

  assert.equal(record.strategyVersionId, "strategy-123");
});

test("RolloutStateMachine transition preserves guardrailReasonCodes", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate();
  const reasonCodes = ["rollout.guardrail_passed"];

  const record = sm.transition(candidate, "shadow", { guardrailReasonCodes: reasonCodes });

  assert.deepEqual(record.guardrailReasonCodes, reasonCodes);
});

test("RolloutStateMachine transition preserves evidence from candidate", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate({ sourceSignalRefs: ["sig-1", "sig-2"] });

  const record = sm.transition(candidate, "shadow");

  assert.deepEqual(record.evidence, ["sig-1", "sig-2"]);
});

test("RolloutStateMachine transition preserves approvedBy", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate();

  const record = sm.transition(candidate, "shadow", { approvedBy: "admin-1" });

  assert.equal(record.approvedBy, "admin-1");
});

test("RolloutStateMachine transition throws for rejected to any status except rejected", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "rejected" });

  assert.throws(
    () => sm.transition(candidate, "canary_5", { currentStatus: "rejected", targetStatus: "canary_5" }),
    /Invalid rollout transition/,
  );
});

test("RolloutStateMachine transition throws for rolled_back to any status except rolled_back", () => {
  const sm = new RolloutStateMachine();
  const candidate = createMockCandidate({ status: "rolled_back" });

  assert.throws(
    () => sm.transition(candidate, "stable", { currentStatus: "rolled_back", targetStatus: "stable" }),
    /Invalid rollout transition/,
  );
});
