import assert from "node:assert/strict";
import test from "node:test";

/**
 * Tests for StageTransitionFSM covering:
 * - Issue #2022: FSM blocks feedback→observe backward transition, OAPEFLIR闭环 impossible
 * - Issue #2023: recordStageCompletion("release") sets index=8 out of bounds
 */

import { StageTransitionFSM, createStageTransitionFSM, OAPEFLIR_STAGES } from "../../../../../src/platform/five-plane-orchestration/oapeflir/stage-transition-fsm.js";

test("StageTransitionFSM initializes with observe stage", () => {
  const fsm = new StageTransitionFSM();

  assert.equal(fsm.getCurrentStage(), "observe");
  assert.equal(fsm.getStageStatus("observe"), "pending");
});

test("StageTransitionFSM.canTransitionTo allows forward progression", () => {
  const fsm = new StageTransitionFSM();

  // Can transition to assess from observe
  const result1 = fsm.canTransitionTo("assess");
  assert.equal(result1.allowed, true, "should allow observe→assess");

  // After recording assess entry, can go to plan
  fsm.recordStageEntry("assess");
  fsm.recordStageCompletion("assess");

  const result2 = fsm.canTransitionTo("plan");
  assert.equal(result2.allowed, true, "should allow assess→plan after completion");
});

test("StageTransitionFSM.canTransitionTo blocks skip over stages - Issue #2022", () => {
  const fsm = new StageTransitionFSM();

  // Should not be able to skip from observe to execute (must go through assess, plan)
  const result = fsm.canTransitionTo("execute");
  assert.equal(result.allowed, false, "should not allow skipping stages");
  assert.equal(result.reasonCode, "fsm.skip_not_allowed");
});

test("StageTransitionFSM allows backward transitions for feedback-driven replan - Issue #2022", () => {
  const fsm = new StageTransitionFSM();

  // Progress to feedback stage
  fsm.recordStageEntry("assess");
  fsm.recordStageCompletion("assess");
  fsm.recordStageEntry("plan");
  fsm.recordStageCompletion("plan");
  fsm.recordStageEntry("execute");
  fsm.recordStageCompletion("execute");
  fsm.recordStageEntry("feedback");
  fsm.recordStageCompletion("feedback");

  assert.equal(fsm.getCurrentStage(), "learn", "after feedback completion, should be at learn");

  // Issue #2022: feedback→observe or feedback→assess should be allowed for replanning
  // The FSM should allow backward transitions when current stage is a valid predecessor
  const resultObserve = fsm.canTransitionTo("observe");
  assert.equal(resultObserve.allowed, true, "feedback→observe should be allowed for OAPEFLIR闭环");

  // Also test feedback→plan (replan without going all the way back to observe)
  fsm.recordStageEntry("observe");
  fsm.recordStageCompletion("observe");
  fsm.recordStageEntry("assess");
  fsm.recordStageCompletion("assess");

  const resultPlan = fsm.canTransitionTo("plan");
  // feedback→plan is also a valid backward transition for replanning
  assert.equal(resultPlan.allowed, true, "backward to plan should be allowed");
});

test("StageTransitionFSM.recordStageCompletion updates index correctly", () => {
  const fsm = new StageTransitionFSM();

  // Complete observe
  fsm.recordStageCompletion("observe");
  assert.equal(fsm.getCurrentStage(), "assess");

  // Complete assess
  fsm.recordStageCompletion("assess");
  assert.equal(fsm.getCurrentStage(), "plan");

  // Complete plan
  fsm.recordStageCompletion("plan");
  assert.equal(fsm.getCurrentStage(), "execute");

  // Continue through the cycle
  fsm.recordStageCompletion("execute");
  assert.equal(fsm.getCurrentStage(), "feedback");

  fsm.recordStageCompletion("feedback");
  assert.equal(fsm.getCurrentStage(), "learn");

  fsm.recordStageCompletion("learn");
  assert.equal(fsm.getCurrentStage(), "improve");

  fsm.recordStageCompletion("improve");
  assert.equal(fsm.getCurrentStage(), "release");

  // Issue #2023: After completing release, should not go out of bounds
  fsm.recordStageCompletion("release");
  assert.ok(fsm.getCurrentStage() !== undefined, "should have valid stage after release");
  assert.equal(fsm.isComplete(), true, "should be complete after release");
});

test("StageTransitionFSM.recordStageCompletion release stays in bounds - Issue #2023", () => {
  const fsm = new StageTransitionFSM();

  // Progress all the way to release
  for (let i = 0; i < OAPEFLIR_STAGES.length - 1; i++) {
    const stage = OAPEFLIR_STAGES[i]!;
    fsm.recordStageEntry(stage);
    fsm.recordStageCompletion(stage);
  }

  // Now at release
  assert.equal(fsm.getCurrentStage(), "release");

  // Complete release
  fsm.recordStageCompletion("release");

  // Issue #2023: Should not go out of bounds (index 8 with only 8 stages 0-7)
  assert.ok(fsm.getCurrentStage() !== undefined, "stage should be defined");
  assert.ok(OAPEFLIR_STAGES.includes(fsm.getCurrentStage()), "stage should be valid");

  // isComplete should be true
  assert.equal(fsm.isComplete(), true);
});

test("StageTransitionFSM.recordStageEntry backward transition updates index - Issue #2022", () => {
  const fsm = new StageTransitionFSM();

  // Progress to feedback
  fsm.recordStageEntry("assess");
  fsm.recordStageCompletion("assess");
  fsm.recordStageEntry("plan");
  fsm.recordStageCompletion("plan");
  fsm.recordStageEntry("execute");
  fsm.recordStageCompletion("execute");
  fsm.recordStageEntry("feedback");
  fsm.recordStageCompletion("feedback");

  // Now at learn stage
  assert.equal(fsm.getCurrentStage(), "learn");

  // Issue #2022: Enter observe (backward transition for replanning)
  fsm.recordStageEntry("observe");

  // The FSM should update currentStageIndex for backward transition
  // Issue #2023 fix also corrected recordStageEntry to update index for backward transitions
  assert.equal(fsm.getCurrentStage(), "observe", "should be at observe after backward transition");
});

test("StageTransitionFSM.getNextStage returns null when complete", () => {
  const fsm = new StageTransitionFSM();

  // Complete all stages
  for (const stage of OAPEFLIR_STAGES) {
    fsm.recordStageEntry(stage);
    fsm.recordStageCompletion(stage);
  }

  assert.equal(fsm.getNextStage(), null, "should return null when complete");
  assert.equal(fsm.isComplete(), true);
});

test("StageTransitionFSM.getExecutionSummary returns all stage statuses", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageEntry("assess");
  fsm.recordStageCompletion("assess");

  const summary = fsm.getExecutionSummary();

  assert.equal(summary.observe.status, "completed");
  assert.equal(summary.assess.status, "completed");
  assert.equal(summary.plan.status, "pending");
  assert.ok(summary.observe.timestamp !== undefined);
});

test("StageTransitionFSM.reset restores initial state", () => {
  const fsm = new StageTransitionFSM();

  // Progress through some stages
  fsm.recordStageEntry("assess");
  fsm.recordStageCompletion("assess");
  fsm.recordStageEntry("plan");
  fsm.recordStageCompletion("plan");

  // Reset
  fsm.reset();

  assert.equal(fsm.getCurrentStage(), "observe");
  assert.equal(fsm.isComplete(), false);
  assert.equal(fsm.getStageStatus("assess"), "pending");
});

test("StageTransitionFSM.recordStageSkipped marks stage and advances index", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageSkipped("assess", "fsm.prerequisite_not_met");

  assert.equal(fsm.getStageStatus("assess"), "skipped");
  assert.equal(fsm.getStageSkipReason("assess"), "fsm.prerequisite_not_met");
  assert.equal(fsm.getCurrentStage(), "plan", "should skip assess and move to plan");
});

test("StageTransitionFSM recordStageError marks stage as error", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageEntry("plan");
  fsm.recordStageError("plan");

  assert.equal(fsm.getStageStatus("plan"), "error");
});

test("createStageTransitionFSM returns new FSM instance", () => {
  const fsm = createStageTransitionFSM();

  assert.ok(fsm instanceof StageTransitionFSM);
  assert.equal(fsm.getCurrentStage(), "observe");
});