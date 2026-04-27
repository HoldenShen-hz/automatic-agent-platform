import test from "node:test";
import assert from "node:assert/strict";

import {
  StageTransitionFSM,
  OAPEFLIR_STAGES,
  createStageTransitionFSM,
  type OapeflirStage,
  type StageStatus,
} from "../../../../../src/platform/orchestration/oapeflir/stage-transition-fsm.js";

test("StageTransitionFSM canTransitionTo allows same stage", () => {
  const fsm = new StageTransitionFSM();
  const result = fsm.canTransitionTo("observe");
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "fsm.same_stage");
});

test("StageTransitionFSM canTransitionTo rejects backward movement", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");

  const result = fsm.canTransitionTo("observe");
  assert.equal(result.allowed, false);
  assert.ok(result.reasonCode.includes("backward"));
});

test("StageTransitionFSM canTransitionTo rejects skip", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");

  // After observe completion, current is assess. Trying to go to execute skips assess.
  const result = fsm.canTransitionTo("execute");
  assert.equal(result.allowed, false);
  assert.ok(result.reasonCode.includes("skip"));
});

test("StageTransitionFSM recordStageCompletion updates status", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");

  assert.equal(fsm.getStageStatus("observe"), "completed");
  assert.ok(fsm.getStageTimestamp("observe") !== undefined);
});

test("StageTransitionFSM recordStageSkipped updates status", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageSkipped("improve", "test.reason");

  assert.equal(fsm.getStageStatus("improve"), "skipped");
  assert.ok(fsm.getStageTimestamp("improve") !== undefined);
});

test("StageTransitionFSM recordStageError updates status", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageError("execute");

  assert.equal(fsm.getStageStatus("execute"), "error");
  assert.ok(fsm.getStageTimestamp("execute") !== undefined);
});

test("StageTransitionFSM getNextStage returns sequential stages", () => {
  const fsm = new StageTransitionFSM();

  assert.equal(fsm.getNextStage(), "observe");
  fsm.recordStageCompletion("observe");
  assert.equal(fsm.getNextStage(), "assess");
  fsm.recordStageCompletion("assess");
  assert.equal(fsm.getNextStage(), "plan");
});

test("StageTransitionFSM isComplete returns false until all stages done", () => {
  const fsm = new StageTransitionFSM();

  assert.equal(fsm.isComplete(), false);
  fsm.recordStageCompletion("observe");
  assert.equal(fsm.isComplete(), false);

  for (const stage of OAPEFLIR_STAGES) {
    fsm.recordStageCompletion(stage);
  }
  assert.equal(fsm.isComplete(), true);
});

test("StageTransitionFSM reset restores initial state", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");

  fsm.reset();

  assert.equal(fsm.getCurrentStage(), "observe");
  assert.equal(fsm.getStageStatus("observe"), "pending");
  assert.equal(fsm.getStageStatus("assess"), "pending");
});

test("StageTransitionFSM getExecutionSummary returns all stage statuses", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageSkipped("learn", "test");

  const summary = fsm.getExecutionSummary();

  assert.equal(summary["observe"].status, "completed");
  assert.equal(summary["learn"].status, "skipped");
  assert.equal(summary["plan"].status, "pending");
});

test("createStageTransitionFSM factory creates working instance", () => {
  const fsm = createStageTransitionFSM();
  assert.equal(fsm.getCurrentStage(), "observe");
  assert.ok(fsm.canTransitionTo("observe").allowed);
});

test("StageTransitionFSM rejects invalid stage name", () => {
  const fsm = new StageTransitionFSM();
  const result = fsm.canTransitionTo("invalid_stage" as OapeflirStage);

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.invalid_stage");
});

test("StageTransitionFSM linear progression through all 8 stages", () => {
  const fsm = new StageTransitionFSM();

  for (const stage of OAPEFLIR_STAGES) {
    assert.ok(fsm.canTransitionTo(stage).allowed || fsm.getCurrentStage() === stage);
    fsm.recordStageCompletion(stage);
  }

  assert.equal(fsm.isComplete(), true);
});
