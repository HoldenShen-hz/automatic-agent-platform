import test from "node:test";
import assert from "node:assert/strict";

import {
  StageTransitionFSM,
  OAPEFLIR_STAGES,
  type OapeflirStage,
} from "../../../../../src/platform/orchestration/oapeflir/stage-transition-fsm.js";

test("StageTransitionFSM initializes with observe as current stage", () => {
  const fsm = new StageTransitionFSM();
  assert.equal(fsm.getCurrentStage(), "observe");
  assert.equal(fsm.getStageStatus("observe"), "pending");
});

test("StageTransitionFSM allows forward transitions through all stages", () => {
  const fsm = new StageTransitionFSM();

  assert.ok(fsm.canTransitionTo("observe").allowed);
  assert.equal(fsm.canTransitionTo("assess").allowed, false);

  fsm.recordStageCompletion("observe");
  assert.ok(fsm.canTransitionTo("assess").allowed);
  fsm.recordStageCompletion("assess");
  assert.ok(fsm.canTransitionTo("plan").allowed);
  fsm.recordStageCompletion("plan");
  assert.ok(fsm.canTransitionTo("execute").allowed);
  fsm.recordStageCompletion("execute");
  assert.ok(fsm.canTransitionTo("feedback").allowed);
  fsm.recordStageCompletion("feedback");
  assert.ok(fsm.canTransitionTo("learn").allowed);
  fsm.recordStageCompletion("learn");
  assert.ok(fsm.canTransitionTo("improve").allowed);
  fsm.recordStageCompletion("improve");
  assert.ok(fsm.canTransitionTo("release").allowed);
});

test("StageTransitionFSM blocks backward transitions", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");

  const result = fsm.canTransitionTo("observe");
  assert.ok(!result.allowed);
  assert.equal(result.reasonCode, "fsm.backward_not_allowed");
});

test("StageTransitionFSM blocks skipping stages", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");

  const result = fsm.canTransitionTo("execute");
  assert.ok(!result.allowed);
  assert.equal(result.reasonCode, "fsm.skip_not_allowed");
});

test("StageTransitionFSM records stage completion correctly", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  assert.equal(fsm.getStageStatus("observe"), "completed");
  assert.ok(fsm.getStageTimestamp("observe") !== undefined);
  assert.equal(fsm.getCurrentStage(), "assess");
});

test("StageTransitionFSM records stage skipped correctly", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageSkipped("improve", "improvement.no_learning_objects");
  assert.equal(fsm.getStageStatus("improve"), "skipped");
  assert.ok(fsm.getStageTimestamp("improve") !== undefined);
});

test("StageTransitionFSM records stage error correctly", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageError("execute");
  assert.equal(fsm.getStageStatus("execute"), "error");
  assert.ok(fsm.getStageTimestamp("execute") !== undefined);
});

test("StageTransitionFSM returns correct next stage", () => {
  const fsm = new StageTransitionFSM();

  assert.equal(fsm.getNextStage(), "observe");

  fsm.recordStageCompletion("observe");
  assert.equal(fsm.getNextStage(), "assess");

  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  assert.equal(fsm.getNextStage(), "execute");
});

test("StageTransitionFSM reports complete when all stages done", () => {
  const fsm = new StageTransitionFSM();

  assert.ok(!fsm.isComplete());

  for (const stage of OAPEFLIR_STAGES) {
    fsm.recordStageCompletion(stage);
  }

  assert.ok(fsm.isComplete());
  assert.equal(fsm.getNextStage(), null);
});

test("StageTransitionFSM getExecutionSummary returns all stages", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  fsm.recordStageSkipped("improve", "test");

  const summary = fsm.getExecutionSummary();

  assert.equal(summary["observe"].status, "completed");
  assert.equal(summary["improve"].status, "skipped");
  assert.equal(summary["plan"].status, "pending");
});

test("StageTransitionFSM reset clears all state", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");

  fsm.reset();

  assert.equal(fsm.getCurrentStage(), "observe");
  assert.equal(fsm.getStageStatus("observe"), "pending");
  assert.equal(fsm.getStageStatus("assess"), "pending");
  assert.equal(fsm.getStageTimestamp("observe"), undefined);
});

test("StageTransitionFSM same stage transition is allowed", () => {
  const fsm = new StageTransitionFSM();

  const result = fsm.canTransitionTo("observe");
  assert.ok(result.allowed);
  assert.equal(result.reasonCode, "fsm.same_stage");
});

test("StageTransitionFSM invalid stage is rejected", () => {
  const fsm = new StageTransitionFSM();

  const result = fsm.canTransitionTo("invalid_stage" as OapeflirStage);
  assert.ok(!result.allowed);
  assert.equal(result.reasonCode, "fsm.invalid_stage");
});

test("StageTransitionFSM respects entry condition validation", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageEntry("assess", "pending");
  const result = fsm.canTransitionTo("assess");

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.prerequisite_not_met");
});

test("StageTransitionFSM all stages have valid predecessors defined", () => {
  const fsm = new StageTransitionFSM();

  for (const stage of OAPEFLIR_STAGES) {
    const result = fsm.canTransitionTo(stage);
    assert.ok(
      result.allowed
        || result.reasonCode === "fsm.same_stage"
        || result.reasonCode === "fsm.prerequisite_not_met"
        || result.reasonCode === "fsm.backward_not_allowed"
        || result.reasonCode === "fsm.skip_not_allowed",
      `Stage ${stage} should have a defined transition result`,
    );
  }
});

test("StageTransitionFSM produces correct transition reasons", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  const backwardResult = fsm.canTransitionTo("observe");
  assert.ok(backwardResult.reasonCodes.length > 0);
  assert.ok(backwardResult.reasonCodes[0]?.includes("backward"));

  const skipResult = fsm.canTransitionTo("feedback");
  assert.ok(skipResult.reasonCodes[0]?.includes("skip"));
});
