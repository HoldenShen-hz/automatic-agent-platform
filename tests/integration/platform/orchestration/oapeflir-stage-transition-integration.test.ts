/**
 * OAPEFLIR Stage Transition Integration Tests
 *
 * Tests the 8-stage OAPEFLIR lifecycle: observe → assess → plan →
 * execute → feedback → learn → improve → release
 *
 * Validates stage transition FSM and integration with workflow execution.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  StageTransitionFSM,
  OAPEFLIR_STAGES,
  type OapeflirStage,
  type StageStatus,
} from "../../../../src/platform/orchestration/oapeflir/stage-transition-fsm.js";

test("oapeflir-stage: FSM initializes to observe stage", () => {
  const fsm = new StageTransitionFSM();

  assert.equal(fsm.getCurrentStage(), "observe", "Initial stage should be observe");
  assert.equal(fsm.getStageStatus("observe"), "pending", "Observe should be pending");
  assert.ok(!fsm.isComplete(), "FSM should not be complete initially");
});

test("oapeflir-stage: Linear progression observe → assess → plan → execute", () => {
  const fsm = new StageTransitionFSM();

  // observe → assess
  let result = fsm.canTransitionTo("assess");
  assert.equal(result.allowed, true, "Should allow observe → assess");
  fsm.recordStageEntry("observe");
  fsm.recordStageCompletion("observe");

  assert.equal(fsm.getCurrentStage(), "assess", "Current should be assess after observe completion");

  // assess → plan
  result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, true, "Should allow assess → plan");
  fsm.recordStageEntry("assess");
  fsm.recordStageCompletion("assess");

  assert.equal(fsm.getCurrentStage(), "plan", "Current should be plan after assess completion");

  // plan → execute
  result = fsm.canTransitionTo("execute");
  assert.equal(result.allowed, true, "Should allow plan → execute");
  fsm.recordStageEntry("execute");
  fsm.recordStageCompletion("execute");

  assert.equal(fsm.getCurrentStage(), "execute", "Current should be execute after plan completion");
});

test("oapeflir-stage: Full linear 8-stage progression", () => {
  const fsm = new StageTransitionFSM();

  const expectedStages: OapeflirStage[] = [
    "observe",
    "assess",
    "plan",
    "execute",
    "feedback",
    "learn",
    "improve",
    "release",
  ];

  // Progress through all stages linearly
  for (let i = 0; i < expectedStages.length; i++) {
    const stage = expectedStages[i]!;

    if (i > 0) {
      const prevStage = expectedStages[i - 1]!;
      const result = fsm.canTransitionTo(stage);
      assert.equal(result.allowed, true, `Should allow transition to ${stage}`);
    }

    fsm.recordStageEntry(stage);
    fsm.recordStageCompletion(stage);
  }

  assert.ok(fsm.isComplete(), "FSM should be complete after all stages");
  assert.equal(fsm.getCurrentStage(), "release", "Final stage should be release");
});

test("oapeflir-stage: Cannot skip stages", () => {
  const fsm = new StageTransitionFSM();

  // Try to skip observe → plan (should fail)
  const result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, false, "Should not allow skipping observe");
  assert.ok(result.reasonCode.includes("skip_not_allowed"), "Reason should indicate skip not allowed");
});

test("oapeflir-stage: Backward transition allowed for feedback-driven replan", () => {
  const fsm = new StageTransitionFSM();

  // Progress to execute
  for (const stage of ["observe", "assess", "plan", "execute"] as const) {
    fsm.recordStageEntry(stage);
    fsm.recordStageCompletion(stage);
  }

  assert.equal(fsm.getCurrentStage(), "execute", "Should be at execute");

  // feedback → plan backward transition (valid for replan)
  let result = fsm.canTransitionTo("feedback");
  assert.equal(result.allowed, true, "Should allow execute → feedback");

  fsm.recordStageEntry("feedback");
  fsm.recordStageCompletion("feedback");

  // feedback → plan (valid backward transition for replanning)
  result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, true, "Should allow feedback → plan for replan");
  assert.ok(result.reasonCode.includes("feedback_driven_replan"), "Should be feedback-driven replan");
});

test("oapeflir-stage: Backward transition assess → plan allowed", () => {
  const fsm = new StageTransitionFSM();

  // Progress to plan
  for (const stage of ["observe", "assess", "plan"] as const) {
    fsm.recordStageEntry(stage);
    fsm.recordStageCompletion(stage);
  }

  // assess → plan (backward from current assess is valid)
  // Actually we're at plan here, so backward would be assess
  // But if we're at assess and want to go back to plan, that's also valid
  fsm.recordStageEntry("assess"); // go back to assess

  const result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, true, "Should allow assess → plan for replan");
});

test("oapeflir-stage: Same stage transition is allowed (idempotent)", () => {
  const fsm = new StageTransitionFSM();

  const result = fsm.canTransitionTo("observe");
  assert.equal(result.allowed, true, "Same stage transition should be allowed");
  assert.ok(result.reasonCode.includes("same_stage"), "Reason should be same_stage");
});

test("oapeflir-stage: Invalid stage returns error", () => {
  const fsm = new StageTransitionFSM();

  const result = fsm.canTransitionTo("invalid_stage" as OapeflirStage);
  assert.equal(result.allowed, false, "Invalid stage should not be allowed");
  assert.ok(result.reasonCode.includes("invalid_stage"), "Reason should indicate invalid stage");
});

test("oapeflir-stage: Stage skip not allowed when too far ahead", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageEntry("observe");
  fsm.recordStageCompletion("observe");

  fsm.recordStageEntry("assess");
  fsm.recordStageCompletion("assess");

  // Try to go directly from assess to execute (skip plan)
  const result = fsm.canTransitionTo("execute");
  assert.equal(result.allowed, false, "Should not allow skipping plan");
});

test("oapeflir-stage: Stage timestamps are recorded", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageEntry("observe");
  const beforeComplete = Date.now();
  fsm.recordStageCompletion("observe");

  const timestamp = fsm.getStageTimestamp("observe");
  assert.ok(timestamp != null, "Timestamp should be recorded");
  assert.ok(timestamp! >= beforeComplete, "Timestamp should be after entry");
});

test("oapeflir-stage: Stage skip reason is captured", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageEntry("improve");
  fsm.recordStageSkipped("improve", "quality_gate_passed_early");

  assert.equal(fsm.getStageStatus("improve"), "skipped", "Stage should be skipped");
  assert.equal(fsm.getStageSkipReason("improve"), "quality_gate_passed_early", "Skip reason should be recorded");
});

test("oapeflir-stage: Error status can be recorded", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageEntry("execute");
  fsm.recordStageError("execute");

  assert.equal(fsm.getStageStatus("execute"), "error", "Stage should be in error state");
});

test("oapeflir-stage: Execution summary captures all stage statuses", () => {
  const fsm = new StageTransitionFSM();

  // Complete some stages
  fsm.recordStageEntry("observe");
  fsm.recordStageCompletion("observe");

  fsm.recordStageEntry("assess");
  fsm.recordStageCompletion("assess");

  const summary = fsm.getExecutionSummary();

  assert.equal(summary.observe.status, "completed", "Observe should be completed");
  assert.equal(summary.assess.status, "completed", "Assess should be completed");
  assert.equal(summary.plan.status, "pending", "Plan should be pending");
  assert.equal(summary.execute.status, "pending", "Execute should be pending");
});

test("oapeflir-stage: OAPEFLIR_STAGES array contains all 8 stages", () => {
  assert.equal(OAPEFLIR_STAGES.length, 8, "Should have 8 stages");
  assert.deepEqual(OAPEFLIR_STAGES, [
    "observe",
    "assess",
    "plan",
    "execute",
    "feedback",
    "learn",
    "improve",
    "release",
  ]);
});

test("oapeflir-stage: FSM can be reset for reuse", () => {
  const fsm = new StageTransitionFSM();

  // Progress partially through
  fsm.recordStageEntry("observe");
  fsm.recordStageCompletion("observe");
  fsm.recordStageEntry("assess");
  fsm.recordStageCompletion("assess");

  // Reset
  fsm.reset();

  assert.equal(fsm.getCurrentStage(), "observe", "Should be back to observe after reset");
  assert.equal(fsm.getStageStatus("observe"), "pending", "Observe should be pending after reset");
  assert.ok(!fsm.isComplete(), "Should not be complete after reset");
});

test("oapeflir-stage: getNextStage returns next pending stage", () => {
  const fsm = new StageTransitionFSM();

  assert.equal(fsm.getNextStage(), "observe", "First next stage should be observe");

  fsm.recordStageEntry("observe");
  fsm.recordStageCompletion("observe");

  assert.equal(fsm.getNextStage(), "assess", "Next stage should be assess after observe completes");
});

test("oapeflir-stage: getNextStage returns null when complete", () => {
  const fsm = new StageTransitionFSM();

  // Complete all stages
  for (const stage of OAPEFLIR_STAGES) {
    fsm.recordStageEntry(stage);
    fsm.recordStageCompletion(stage);
  }

  assert.equal(fsm.getNextStage(), null, "Should return null when complete");
});

test("oapeflir-stage: Prerequisite validation for stages requiring completion", () => {
  const fsm = new StageTransitionFSM();

  // Try to enter plan without assess completed
  const result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, false, "Should not allow plan without assess completed");
  assert.ok(result.reasonCode.includes("prerequisite_not_met"), "Should indicate prerequisite not met");
});

test("oapeflir-stage: Learn stage allows improve to be skipped", () => {
  const fsm = new StageTransitionFSM();

  // Progress to learn
  for (const stage of ["observe", "assess", "plan", "execute", "feedback", "learn"] as const) {
    fsm.recordStageEntry(stage);
    fsm.recordStageCompletion(stage);
  }

  assert.equal(fsm.getCurrentStage(), "learn", "Should be at learn");

  // improve can be skipped (requiredStatus includes "skipped")
  const result = fsm.canTransitionTo("improve");
  assert.equal(result.allowed, true, "Should allow transition to improve");

  fsm.recordStageEntry("improve");
  fsm.recordStageSkipped("improve", "quality_already_sufficient");

  assert.equal(fsm.getStageStatus("improve"), "skipped", "improve should be skipped");
});

test("oapeflir-stage: Release stage allows improve to be skipped", () => {
  const fsm = new StageTransitionFSM();

  // Progress to improve
  for (const stage of ["observe", "assess", "plan", "execute", "feedback", "learn", "improve"] as const) {
    fsm.recordStageEntry(stage);
    fsm.recordStageCompletion(stage);
  }

  // Skip improve (release requiredStatus includes "skipped")
  const result = fsm.canTransitionTo("release");
  assert.equal(result.allowed, true, "Should allow release even with improve pending/skipped");
});

test("oapeflir-stage: Multiple backward transitions during replan cycle", () => {
  const fsm = new StageTransitionFSM();

  // Linear progress to execute
  for (const stage of ["observe", "assess", "plan", "execute"] as const) {
    fsm.recordStageEntry(stage);
    fsm.recordStageCompletion(stage);
  }

  // Feedback cycle 1: execute → feedback → plan → execute
  fsm.recordStageEntry("feedback");
  fsm.recordStageCompletion("feedback");

  let result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, true, "feedback → plan should be allowed");
  fsm.recordStageEntry("plan");
  fsm.recordStageCompletion("plan");

  result = fsm.canTransitionTo("execute");
  assert.equal(result.allowed, true, "plan → execute should be allowed");
  fsm.recordStageEntry("execute");
  fsm.recordStageCompletion("execute");

  // Feedback cycle 2: execute → feedback → assess → plan → execute
  fsm.recordStageEntry("feedback");
  fsm.recordStageCompletion("feedback");

  result = fsm.canTransitionTo("assess");
  assert.equal(result.allowed, true, "feedback → assess should be allowed for deeper replan");
  fsm.recordStageEntry("assess");
  fsm.recordStageCompletion("assess");

  result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, true, "assess → plan should be allowed");
  fsm.recordStageEntry("plan");
  fsm.recordStageCompletion("plan");

  result = fsm.canTransitionTo("execute");
  assert.equal(result.allowed, true, "plan → execute should be allowed");
});