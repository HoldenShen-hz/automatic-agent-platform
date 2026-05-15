/**
 * Unit tests for OAPEFLIR stage-transition-fsm
 * Tests the StageTransitionFSM class for OAPEFLIR 8-stage transitions
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  StageTransitionFSM,
  OAPEFLIR_STAGES,
  createStageTransitionFSM,
  type OapeflirStage,
  type StageTransitionResult,
} from "../../../../../src/platform/five-plane-orchestration/oapeflir/stage-transition-fsm.js";

test("StageTransitionFSM canTransitionTo returns valid result structure", () => {
  const fsm = new StageTransitionFSM();

  const result = fsm.canTransitionTo("observe");

  assert.equal(result.allowed, true);
  assert.equal(result.targetStage, "observe");
  assert.ok(Array.isArray(result.reasonCodes));
  assert.ok(result.reasonCode.length > 0);
});

test("StageTransitionFSM createStageTransitionFSM factory creates instance", () => {
  const fsm = createStageTransitionFSM();

  assert.ok(fsm instanceof StageTransitionFSM);
  assert.equal(fsm.getCurrentStage(), "observe");
});

test("StageTransitionFSM forward transition from observe to assess requires completion", () => {
  const fsm = new StageTransitionFSM();

  // Cannot transition to assess without completing observe
  const beforeResult = fsm.canTransitionTo("assess");
  assert.equal(beforeResult.allowed, false);
  assert.equal(beforeResult.reasonCode, "fsm.prerequisite_not_met");

  // After completing observe, can transition
  fsm.recordStageCompletion("observe");
  const afterResult = fsm.canTransitionTo("assess");
  assert.equal(afterResult.allowed, true);
});

test("StageTransitionFSM backward transition from feedback to assess is allowed (valid predecessor)", () => {
  const fsm = new StageTransitionFSM();

  // Progress to feedback
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");

  // feedback -> assess is allowed (feedback is valid predecessor for assess)
  const result = fsm.canTransitionTo("assess");
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "fsm.valid_predecessor_backward");
});

test("StageTransitionFSM feedback-driven replan from feedback to plan is allowed", () => {
  const fsm = new StageTransitionFSM();

  // Progress to feedback
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");

  // feedback -> plan is allowed via feedback-driven replan
  const result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "fsm.feedback_driven_replan");
});

test("StageTransitionFSM feedback-driven replan from learn to execute is allowed", () => {
  const fsm = new StageTransitionFSM();

  // Progress to learn
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");
  fsm.recordStageCompletion("learn");

  // learn -> execute is allowed via feedback-driven replan
  const result = fsm.canTransitionTo("execute");
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "fsm.feedback_driven_replan");
});

test("StageTransitionFSM canTransitionTo with invalid stage returns fsm.invalid_stage", () => {
  const fsm = new StageTransitionFSM();

  const result = fsm.canTransitionTo("nonexistent" as OapeflirStage);

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.invalid_stage");
});

test("StageTransitionFSM canTransitionTo skip_not_allowed for skipping assess", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  // Skip directly to plan (should fail)
  const result = fsm.canTransitionTo("plan");

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.skip_not_allowed");
});

test("StageTransitionFSM getStageTimestamp returns undefined for unvisited stage", () => {
  const fsm = new StageTransitionFSM();

  const timestamp = fsm.getStageTimestamp("observe");

  assert.equal(timestamp, undefined);
});

test("StageTransitionFSM getStageTimestamp returns number after entry", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageEntry("observe", "pending");
  const timestamp = fsm.getStageTimestamp("observe");

  assert.ok(typeof timestamp === "number");
  assert.ok(timestamp > 0);
});

test("StageTransitionFSM recordStageEntry with status", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageEntry("assess", "pending");

  assert.equal(fsm.getStageStatus("assess"), "pending");
});

test("StageTransitionFSM isComplete returns false before all stages done", () => {
  const fsm = new StageTransitionFSM();

  assert.equal(fsm.isComplete(), false);

  fsm.recordStageCompletion("observe");
  assert.equal(fsm.isComplete(), false);
});

test("StageTransitionFSM isComplete returns true after all stages done", () => {
  const fsm = new StageTransitionFSM();

  for (const stage of OAPEFLIR_STAGES) {
    fsm.recordStageCompletion(stage);
  }

  assert.equal(fsm.isComplete(), true);
});

test("StageTransitionFSM getNextStage returns null after completion", () => {
  const fsm = new StageTransitionFSM();

  for (const stage of OAPEFLIR_STAGES) {
    fsm.recordStageCompletion(stage);
  }

  assert.equal(fsm.getNextStage(), null);
});

test("StageTransitionFSM getNextStage returns stages in order", () => {
  const fsm = new StageTransitionFSM();

  assert.equal(fsm.getNextStage(), "observe");
  fsm.recordStageCompletion("observe");
  assert.equal(fsm.getNextStage(), "assess");
  fsm.recordStageCompletion("assess");
  assert.equal(fsm.getNextStage(), "plan");
});

test("StageTransitionFSM getExecutionSummary contains all 8 stages", () => {
  const fsm = new StageTransitionFSM();

  const summary = fsm.getExecutionSummary();

  for (const stage of OAPEFLIR_STAGES) {
    assert.ok(stage in summary, `Stage ${stage} should be in summary`);
    assert.ok("status" in summary[stage]);
    assert.equal(summary[stage].status, "pending");
  }
});

test("StageTransitionFSM reset restores initial state", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");

  fsm.reset();

  assert.equal(fsm.getCurrentStage(), "observe");
  assert.equal(fsm.getStageStatus("observe"), "pending");
  assert.equal(fsm.getStageStatus("assess"), "pending");
  assert.equal(fsm.getStageStatus("plan"), "pending");
  assert.equal(fsm.getStageTimestamp("observe"), undefined);
});

test("StageTransitionFSM all OAPEFLIR_STAGES contains 8 stages", () => {
  assert.equal(OAPEFLIR_STAGES.length, 8);
  assert.deepEqual(OAPEFLIR_STAGES, ["observe", "assess", "plan", "execute", "feedback", "learn", "improve", "release"]);
});

test("StageTransitionFSM recordStageSkipped advances current stage index", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageSkipped("improve", "test.skip");

  assert.equal(fsm.getStageStatus("improve"), "skipped");
  assert.equal(fsm.getCurrentStage(), "improve");
});

test("StageTransitionFSM same stage transition has fsm.same_stage reasonCode", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  const result = fsm.canTransitionTo("observe");

  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "fsm.same_stage");
});

test("StageTransitionFSM invalid predecessor returns fsm.invalid_predecessor", () => {
  const fsm = new StageTransitionFSM();

  // assess is not a valid predecessor for execute
  const result = fsm.canTransitionTo("execute");

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.invalid_predecessor");
});

test("StageTransitionFSM reasonCodes array is populated for transitions", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  const result = fsm.canTransitionTo("assess");

  assert.ok(result.reasonCodes.length > 0);
  assert.ok(result.reasonCodes.some(code => code.includes("assess")));
});

test("StageTransitionFSM backward transition blocked when current not valid predecessor", () => {
  const fsm = new StageTransitionFSM();

  // Progress to plan
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");

  // plan -> observe should be blocked (plan is not a valid predecessor for observe)
  const result = fsm.canTransitionTo("observe");

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.backward_not_allowed");
});

test("StageTransitionFSM improve stage accepts completed or skipped predecessor", () => {
  const fsm = new StageTransitionFSM();

  // Complete through learn
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");
  fsm.recordStageCompletion("learn");

  // learn -> improve should work
  const result = fsm.canTransitionTo("improve");
  assert.equal(result.allowed, true);
});

test("StageTransitionFSM release stage accepts completed or skipped predecessor", () => {
  const fsm = new StageTransitionFSM();

  // Complete through improve
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");
  fsm.recordStageCompletion("learn");
  fsm.recordStageCompletion("improve");

  // improve -> release should work
  const result = fsm.canTransitionTo("release");
  assert.equal(result.allowed, true);
});

test("StageTransitionFSM recordStageError sets error status", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageError("execute");

  assert.equal(fsm.getStageStatus("execute"), "error");
  assert.ok(fsm.getStageTimestamp("execute") !== undefined);
});

test("StageTransitionFSM reasonCodes contains fsm.transition_allowed for valid transition", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  const result = fsm.canTransitionTo("assess");

  assert.ok(result.reasonCodes.some(code => code.includes("transition_allowed")));
});