/**
 * StageTransitionFSM Integration Tests
 *
 * Validates R5-3/R9-16: FSM integration with feedback-driven replanning.
 * Backward transitions from feedback/learn/improve/release to plan/assess/execute
 * must be allowed for loop re-entry.
 *
 * Architecture: §5.3 OAPEFLIR Stage Transitions + §9.16 Feedback-Driven Replanning
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

// ─────────────────────────────────────────────────────────────────────────────
// R9-16 / R5-3: Feedback-driven backward transitions for replanning
// ─────────────────────────────────────────────────────────────────────────────

test("StageTransitionFSM allows feedback-to-plan backward transition (replan)", () => {
  const fsm = new StageTransitionFSM();

  // Progress through observe → execute
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");

  // R9-16: From feedback, we can go back to plan for replanning
  const result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, true, "feedback→plan must be allowed for replanning");
  assert.equal(result.reasonCode, "fsm.feedback_driven_replan", "reason must indicate feedback-driven replan");
});

test("StageTransitionFSM allows feedback-to-assess backward transition (replan)", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");

  const result = fsm.canTransitionTo("assess");
  assert.equal(result.allowed, true, "feedback→assess must be allowed for replanning");
  assert.equal(result.reasonCode, "fsm.feedback_driven_replan");
});

test("StageTransitionFSM allows learn-to-plan backward transition (replan)", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");
  fsm.recordStageCompletion("learn");

  const result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, true, "learn→plan must be allowed for replanning");
});

test("StageTransitionFSM allows improve-to-plan backward transition (replan)", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");
  fsm.recordStageCompletion("learn");
  fsm.recordStageCompletion("improve");

  const result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, true, "improve→plan must be allowed for replanning");
});

test("StageTransitionFSM blocks knowledge-promotion completion from re-entering plan", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");
  fsm.recordStageCompletion("learn");
  fsm.recordStageCompletion("improve");
  fsm.recordStageCompletion("release");
  fsm.recordStageCompletion("knowledge_promotion");

  const result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, false, "completed release→plan must not implicitly re-enter");
  assert.equal(result.reasonCode, "fsm.complete");
});

test("StageTransitionFSM allows feedback-to-execute backward transition (replan)", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");

  const result = fsm.canTransitionTo("execute");
  assert.equal(result.allowed, true, "feedback→execute must be allowed for replanning");
});

test("StageTransitionFSM rejects non-feedback backward transitions (normal backward)", () => {
  const fsm = new StageTransitionFSM();

  // Complete only through assess
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");

  // plan→observe is not feedback-driven, should be rejected
  const result = fsm.canTransitionTo("observe");
  assert.equal(result.allowed, false, "plan→observe without feedback context must be rejected");
  assert.equal(result.reasonCode, "fsm.backward_not_allowed", "must be rejected as backward_not_allowed");
});

test("StageTransitionFSM rejects early stage backward transitions", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");

  // assess→observe is not feedback-driven from feedback/learn/improve/release
  const result = fsm.canTransitionTo("observe");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.backward_not_allowed");
});

test("StageTransitionFSM reasonCodes include stage names for feedback-driven replan", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");

  const result = fsm.canTransitionTo("plan");
  assert.ok(result.reasonCodes.length > 0, "must have reason codes");
  assert.ok(
    result.reasonCodes.some((code) => code.includes("feedback") && code.includes("plan")),
    "reason code must mention feedback→plan transition",
  );
});

test("StageTransitionFSM records multiple loop iterations", () => {
  const fsm = new StageTransitionFSM();

  // First iteration
  fsm.recordStageEntry("observe");
  fsm.recordStageCompletion("observe");
  fsm.recordStageEntry("assess");
  fsm.recordStageCompletion("assess");
  fsm.recordStageEntry("plan");
  fsm.recordStageCompletion("plan");
  fsm.recordStageEntry("execute");
  fsm.recordStageCompletion("execute");
  fsm.recordStageEntry("feedback");
  fsm.recordStageCompletion("feedback");

  // Replan back to plan
  fsm.recordStageEntry("plan");
  fsm.recordStageCompletion("plan");
  fsm.recordStageEntry("execute");
  fsm.recordStageCompletion("execute");
  fsm.recordStageEntry("feedback");
  fsm.recordStageCompletion("feedback");

  // Verify multiple completions recorded
  const summary = fsm.getExecutionSummary();
  assert.ok(
    summary["plan"].timestamp !== undefined,
    "plan stage must have timestamp from last completion",
  );
});

test("StageTransitionFSM linear forward progression still works", () => {
  const fsm = new StageTransitionFSM();

  // Verify all forward transitions work normally
  const sequence: OapeflirStage[] = [
    "observe",
    "assess",
    "plan",
    "execute",
    "feedback",
    "learn",
    "improve",
    "release",
    "knowledge_promotion",
  ];

  for (const stage of sequence) {
    const canProceed = fsm.canTransitionTo(stage);
    assert.ok(
      canProceed.allowed || fsm.getCurrentStage() === stage,
      `Forward transition to ${stage} should be allowed`,
    );
    fsm.recordStageCompletion(stage);
  }

  assert.equal(fsm.isComplete(), true, "FSM should be complete after all stages");
});

test("StageTransitionFSM forward skip is rejected in all cases", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");

  // observe → feedback is skipping assess and plan
  const result = fsm.canTransitionTo("feedback");
  assert.equal(result.allowed, false, "skipping stages must be rejected");
  assert.equal(result.reasonCode, "fsm.skip_not_allowed");
});

test("StageTransitionFSM same stage transition is allowed only while current", () => {
  const fsm = new StageTransitionFSM();

  // Any stage can transition to itself
  for (const stage of OAPEFLIR_STAGES) {
    fsm.recordStageCompletion(stage);
    const result = fsm.canTransitionTo(stage);
    if (fsm.getCurrentStage() === stage) {
      assert.equal(result.allowed, true, `${stage}→${stage} is allowed while current`);
      assert.ok(
        result.reasonCode === "fsm.same_stage" || result.reasonCode === "fsm.transition_allowed",
        `unexpected same-current reason: ${result.reasonCode}`,
      );
    } else {
      assert.equal(result.allowed, false, `${stage}→${stage} is not same-stage after advancing`);
    }
  }
});

test("StageTransitionFSM records stage entry with pending status", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageEntry("assess", "pending");

  assert.equal(fsm.getStageStatus("assess"), "pending", "assess should be pending after entry");
  assert.ok(fsm.getStageTimestamp("assess") !== undefined, "timestamp should be set on entry");
});

test("StageTransitionFSM execute from feedback is allowed (feedback-driven)", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");

  // From feedback, can go back to execute (not just plan)
  const result = fsm.canTransitionTo("execute");
  assert.equal(result.allowed, true, "feedback→execute must be allowed for replanning");
  assert.equal(result.reasonCode, "fsm.feedback_driven_replan");
});

test("StageTransitionFSM all 9 stages have valid entry conditions", () => {
  const fsm = new StageTransitionFSM();

  for (const stage of OAPEFLIR_STAGES) {
    const result = fsm.canTransitionTo(stage);
    assert.ok(
      result.allowed ||
      result.reasonCode === "fsm.prerequisite_not_met" ||
      result.reasonCode === "fsm.backward_not_allowed" ||
      result.reasonCode === "fsm.skip_not_allowed" ||
      result.reasonCode === "fsm.same_stage",
      `Stage ${stage} must have a defined transition result`,
    );
  }
});

test("createStageTransitionFSM creates FSM ready for observe stage", () => {
  const fsm = createStageTransitionFSM();

  assert.equal(fsm.getCurrentStage(), "observe", "should start at observe");
  assert.equal(fsm.getStageStatus("observe"), "pending", "observe should be pending");
  assert.ok(fsm.canTransitionTo("observe").allowed, "observe transition should be allowed");
});

test("StageTransitionFSM getExecutionSummary tracks all stage statuses", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageSkipped("improve", "test.skip");

  const summary = fsm.getExecutionSummary();

  assert.equal(summary["observe"].status, "completed");
  assert.equal(summary["assess"].status, "completed");
  assert.equal(summary["improve"].status, "skipped");
  assert.equal(summary["plan"].status, "pending");
  assert.equal(summary["learn"].status, "pending");
});

test("StageTransitionFSM reset restores initial state", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");

  fsm.reset();

  assert.equal(fsm.getCurrentStage(), "observe", "should return to observe");
  assert.equal(fsm.getStageStatus("observe"), "pending", "observe should be pending");
  assert.equal(fsm.getStageStatus("plan"), "pending", "plan should be pending after reset");
  assert.equal(fsm.getStageTimestamp("observe"), undefined, "timestamps should be cleared");
});
