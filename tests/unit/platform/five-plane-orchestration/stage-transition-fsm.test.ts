import assert from "node:assert/strict";
import test from "node:test";

import {
  StageTransitionFSM,
  OAPEFLIR_STAGES,
  createStageTransitionFSM,
  type StageStatus,
} from "../../../../../../src/platform/five-plane-orchestration/oapeflir/stage-transition-fsm.js";

test("StageTransitionFSM creates with all stages pending", () => {
  const fsm = new StageTransitionFSM();
  for (const stage of OAPEFLIR_STAGES) {
    assert.equal(fsm.getStageStatus(stage), "pending");
  }
  assert.equal(fsm.getCurrentStage(), "observe");
});

test("canTransitionTo rejects invalid stage names", () => {
  const fsm = new StageTransitionFSM();
  const result = fsm.canTransitionTo("assess" as any);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.invalid_stage");
});

test("canTransitionTo allows forward transition to next stage", () => {
  const fsm = new StageTransitionFSM();
  const result = fsm.canTransitionTo("assess");
  assert.equal(result.allowed, true);
  assert.equal(result.targetStage, "assess");
  assert.equal(result.reasonCode, "fsm.transition_allowed");
});

test("canTransitionTo blocks skipping stages", () => {
  const fsm = new StageTransitionFSM();
  const result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.skip_not_allowed");
});

test("canTransitionTo blocks backward transitions except valid predecessors", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageEntry("execute");
  fsm.recordStageCompletion("execute");
  // feedback is a valid predecessor for plan
  const result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "fsm.valid_predecessor_backward");
});

test("canTransitionTo blocks backward transitions from assess to observe", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageEntry("assess");
  const result = fsm.canTransitionTo("observe");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.backward_not_allowed");
});

test("canTransitionTo allows same stage transition", () => {
  const fsm = new StageTransitionFSM();
  const result = fsm.canTransitionTo("observe");
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "fsm.same_stage");
});

test("recordStageEntry updates stage status and current stage", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageEntry("assess");
  assert.equal(fsm.getCurrentStage(), "assess");
  assert.equal(fsm.getStageStatus("assess"), "pending");
  assert.ok(fsm.getStageTimestamp("assess") !== undefined);
});

test("recordStageCompletion updates stage status and advances index", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageEntry("assess");
  fsm.recordStageCompletion("assess");
  assert.equal(fsm.getStageStatus("assess"), "completed");
  assert.ok(fsm.getStageTimestamp("assess") !== undefined);
});

test("recordStageSkipped updates stage status with reason", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageSkipped("learn", "no_signals");
  assert.equal(fsm.getStageStatus("learn"), "skipped");
  assert.equal(fsm.getStageSkipReason("learn"), "no_signals");
});

test("recordStageError updates stage status to error", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageError("execute");
  assert.equal(fsm.getStageStatus("execute"), "error");
});

test("getNextStage returns null when complete", () => {
  const fsm = new StageTransitionFSM();
  // Advance past all stages
  for (const stage of OAPEFLIR_STAGES) {
    fsm.recordStageEntry(stage);
    fsm.recordStageCompletion(stage);
  }
  assert.equal(fsm.getNextStage(), null);
  assert.equal(fsm.isComplete(), true);
});

test("getNextStage returns first stage initially", () => {
  const fsm = new StageTransitionFSM();
  assert.equal(fsm.getNextStage(), "observe");
});

test("getExecutionSummary returns status for all stages", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageEntry("observe");
  fsm.recordStageCompletion("observe");
  fsm.recordStageEntry("assess");
  const summary = fsm.getExecutionSummary();
  assert.equal(summary.observe.status, "completed");
  assert.equal(summary.assess.status, "pending");
  assert.ok(summary.observe.timestamp !== undefined);
});

test("reset restores initial state", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageEntry("assess");
  fsm.recordStageCompletion("assess");
  fsm.reset();
  assert.equal(fsm.getCurrentStage(), "observe");
  assert.equal(fsm.getStageStatus("assess"), "pending");
});

test("backward transition updates currentStageIndex when entering earlier stage", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageEntry("execute");
  fsm.recordStageCompletion("execute");
  fsm.recordStageEntry("feedback");
  fsm.recordStageCompletion("feedback");
  // backward transition to plan
  fsm.recordStageEntry("plan");
  assert.equal(fsm.getCurrentStage(), "plan");
});

test("feedback-driven replan allows backward to plan/assess/execute", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageEntry("feedback");
  fsm.recordStageCompletion("feedback");
  fsm.recordStageEntry("learn");
  fsm.recordStageCompletion("learn");
  // from release, feedback-driven replan to plan
  fsm.recordStageEntry("release");
  const result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "fsm.feedback_driven_replan");
});

test("createStageTransitionFSM factory creates instance", () => {
  const fsm = createStageTransitionFSM();
  assert.ok(fsm instanceof StageTransitionFSM);
  assert.equal(fsm.getCurrentStage(), "observe");
});

test("improve allows skipped or completed predecessor", () => {
  const fsm = new StageTransitionFSM();
  // advance to learn and skip it
  fsm.recordStageEntry("learn");
  fsm.recordStageSkipped("learn", "no_objects");
  const result = fsm.canTransitionTo("improve");
  assert.equal(result.allowed, true);
});

test("release allows skipped or completed predecessor", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageEntry("improve");
  fsm.recordStageSkipped("improve", "no_candidate");
  const result = fsm.canTransitionTo("release");
  assert.equal(result.allowed, true);
});