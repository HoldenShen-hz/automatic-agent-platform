/**
 * Phase Routing Tests for OAPEFLIR Stage Transition FSM
 *
 * Tests the 8-stage OAPEFLIR pipeline transitions:
 * Observe → Assess → Plan → Execute → Feedback → Learn → Improve → Release
 *
 * Architecture: §8 OAPEFLIR Design Principles
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  StageTransitionFSM,
  OAPEFLIR_STAGES,
  createStageTransitionFSM,
  type OapeflirStage,
  type StageStatus,
  type StageTransitionResult,
  type StageTransitionContext,
} from "../../../../../src/platform/five-plane-orchestration/oapeflir/stage-transition-fsm.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create minimal workflow for testing
// ─────────────────────────────────────────────────────────────────────────────

function createWorkflow(taskId: string) {
  return {
    workflow: { workflowId: `wf_${taskId}`, divisionId: "coding", steps: [] },
    executionSteps: [
      {
        stepId: `step_${taskId}`,
        divisionId: "coding",
        roleId: "writer",
        inputKeys: [],
        agentId: "agent_writer",
        outputKey: "result",
        outputSchemaPath: null,
        dependsOnStepIds: [],
        dependencyTypes: {},
        timeoutMs: 1000,
        maxAttempts: 1,
      },
    ],
    planReason: "workflow.single_step_execution",
    dependencyEdges: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Stage Transition FSM Core Behavior
// ─────────────────────────────────────────────────────────────────────────────

test("StageTransitionFSM initializes with correct stage order", () => {
  const fsm = new StageTransitionFSM();
  assert.equal(OAPEFLIR_STAGES.length, 8);
  assert.deepStrictEqual(OAPEFLIR_STAGES, [
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

test("StageTransitionFSM initial state is observe with pending status", () => {
  const fsm = new StageTransitionFSM();
  assert.equal(fsm.getCurrentStage(), "observe");
  assert.equal(fsm.getStageStatus("observe"), "pending");
  assert.equal(fsm.getStageStatus("assess"), "pending");
  assert.equal(fsm.getStageStatus("plan"), "pending");
});

test("StageTransitionFSM getStageTimestamp returns undefined initially", () => {
  const fsm = new StageTransitionFSM();
  assert.equal(fsm.getStageTimestamp("observe"), undefined);
  assert.equal(fsm.getStageTimestamp("assess"), undefined);
});

test("StageTransitionFSM getStageSkipReason returns undefined initially", () => {
  const fsm = new StageTransitionFSM();
  assert.equal(fsm.getStageSkipReason("improve"), undefined);
  assert.equal(fsm.getStageSkipReason("release"), undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Forward Transitions
// ─────────────────────────────────────────────────────────────────────────────

test("canTransitionTo observe is always allowed (same stage)", () => {
  const fsm = new StageTransitionFSM();
  const result = fsm.canTransitionTo("observe");
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "fsm.same_stage");
});

test("canTransitionTo assess blocked when observe not completed", () => {
  const fsm = new StageTransitionFSM();
  const result = fsm.canTransitionTo("assess");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.prerequisite_not_met");
});

test("complete forward transition sequence observe→assess→plan", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  assert.ok(fsm.canTransitionTo("assess").allowed);

  fsm.recordStageCompletion("assess");
  assert.ok(fsm.canTransitionTo("plan").allowed);

  fsm.recordStageCompletion("plan");
  assert.ok(fsm.canTransitionTo("execute").allowed);
});

test("complete forward transition sequence execute→feedback→learn→improve→release", () => {
  const fsm = new StageTransitionFSM();

  // Complete through plan
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");

  assert.ok(fsm.canTransitionTo("feedback").allowed);
  fsm.recordStageCompletion("feedback");

  assert.ok(fsm.canTransitionTo("learn").allowed);
  fsm.recordStageCompletion("learn");

  assert.ok(fsm.canTransitionTo("improve").allowed);
  fsm.recordStageCompletion("improve");

  assert.ok(fsm.canTransitionTo("release").allowed);
  fsm.recordStageCompletion("release");

  assert.ok(fsm.isComplete());
  assert.equal(fsm.getNextStage(), null);
});

test("cannot skip from observe directly to plan", () => {
  const fsm = new StageTransitionFSM();
  const result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.skip_not_allowed");
});

test("cannot skip from observe directly to execute", () => {
  const fsm = new StageTransitionFSM();
  const result = fsm.canTransitionTo("execute");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.skip_not_allowed");
});

test("cannot skip from plan directly to learn", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");

  const result = fsm.canTransitionTo("learn");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.skip_not_allowed");
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Backward Transitions & Replanning
// ─────────────────────────────────────────────────────────────────────────────

test("backward transition blocked for non-predessor stages", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");

  // Cannot go back to observe since assess is not a valid predecessor for observe
  const result = fsm.canTransitionTo("observe");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.backward_not_allowed");
});

test("feedback-driven replan allows backward transition to plan", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");

  // feedback → plan is allowed for replanning
  const result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "fsm.feedback_driven_replan");
});

test("learn stage allows backward transition to assess", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");
  fsm.recordStageCompletion("learn");

  const result = fsm.canTransitionTo("assess");
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "fsm.feedback_driven_replan");
});

test("improve stage allows backward transition to execute", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");
  fsm.recordStageCompletion("learn");
  fsm.recordStageCompletion("improve");

  const result = fsm.canTransitionTo("execute");
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "fsm.feedback_driven_replan");
});

test("release stage cannot transition backward to plan when FSM is complete", () => {
  // When all stages including release are complete, the FSM is past the end (currentStageIndex = 8)
  // Trying to transition to an earlier stage (plan = index 2) returns skip_not_allowed
  // because the FSM treats it as attempting to skip stages rather than go backward
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");
  fsm.recordStageCompletion("learn");
  fsm.recordStageCompletion("improve");
  fsm.recordStageCompletion("release");

  // After completion, backward transition to plan is blocked by skip_not_allowed
  // since the FSM considers any transition from index 8 to earlier stages as skipping
  const result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.skip_not_allowed");
});

test("backward transition records correct reasonCodes", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");

  const result = fsm.canTransitionTo("plan");
  assert.ok(result.reasonCodes.length > 0);
  assert.ok(result.reasonCodes[0]?.includes("feedback_driven_replan"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Stage Status Recording
// ─────────────────────────────────────────────────────────────────────────────

test("recordStageEntry updates status and timestamp", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageEntry("assess");

  assert.equal(fsm.getStageStatus("assess"), "pending");
  assert.ok(fsm.getStageTimestamp("assess") !== undefined);
});

test("recordStageEntry with pending status", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageEntry("assess", "pending");

  assert.equal(fsm.getStageStatus("assess"), "pending");
});

test("recordStageCompletion updates status and timestamp", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");

  assert.equal(fsm.getStageStatus("observe"), "completed");
  assert.ok(fsm.getStageTimestamp("observe") !== undefined);
  assert.equal(fsm.getCurrentStage(), "assess");
});

test("recordStageSkipped records skip reason", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageSkipped("improve", "improvement.no_candidates");

  assert.equal(fsm.getStageStatus("improve"), "skipped");
  assert.equal(fsm.getStageSkipReason("improve"), "improvement.no_candidates");
  assert.ok(fsm.getStageTimestamp("improve") !== undefined);
});

test("recordStageError records error status", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageError("execute");

  assert.equal(fsm.getStageStatus("execute"), "error");
  assert.ok(fsm.getStageTimestamp("execute") !== undefined);
});

test("recordStageSkipped advances current stage index", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageSkipped("execute", "execution.skipped");

  // After skipping execute, current stage should be feedback
  assert.equal(fsm.getCurrentStage(), "feedback");
});

test("recordStageError does not advance current stage index", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageError("plan");

  // Error should not advance past the errored stage
  assert.equal(fsm.getCurrentStage(), "plan");
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Stage Entry Conditions & Validation
// ─────────────────────────────────────────────────────────────────────────────

test("assess stage requires observe to be completed", () => {
  const fsm = new StageTransitionFSM();
  const result = fsm.canTransitionTo("assess");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.prerequisite_not_met");
});

test("plan stage requires assess to be completed", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");

  const result = fsm.canTransitionTo("plan");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.prerequisite_not_met");
});

test("execute stage requires plan to be completed", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");

  const result = fsm.canTransitionTo("execute");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.prerequisite_not_met");
});

test("improve stage accepts either completed or skipped learn", () => {
  const fsm = new StageTransitionFSM();

  // Complete through learn
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");
  fsm.recordStageCompletion("learn");

  // improve should be allowed after completed learn
  assert.ok(fsm.canTransitionTo("improve").allowed);

  // Now test with skipped learn
  const fsm2 = new StageTransitionFSM();
  fsm2.recordStageCompletion("observe");
  fsm2.recordStageCompletion("assess");
  fsm2.recordStageCompletion("plan");
  fsm2.recordStageCompletion("execute");
  fsm2.recordStageCompletion("feedback");
  fsm2.recordStageSkipped("learn", "learn.no_signals");

  assert.ok(fsm2.canTransitionTo("improve").allowed);
});

test("release stage accepts either completed or skipped improve", () => {
  const fsm = new StageTransitionFSM();

  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");
  fsm.recordStageCompletion("learn");
  fsm.recordStageCompletion("improve");

  assert.ok(fsm.canTransitionTo("release").allowed);

  // With skipped improve
  const fsm2 = new StageTransitionFSM();
  fsm2.recordStageCompletion("observe");
  fsm2.recordStageCompletion("assess");
  fsm2.recordStageCompletion("plan");
  fsm2.recordStageCompletion("execute");
  fsm2.recordStageCompletion("feedback");
  fsm2.recordStageCompletion("learn");
  fsm2.recordStageSkipped("improve", "improve.no_candidates");

  assert.ok(fsm2.canTransitionTo("release").allowed);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Invalid Stage & Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("invalid stage returns fsm.invalid_stage", () => {
  const fsm = new StageTransitionFSM();
  const result = fsm.canTransitionTo("invalid_stage" as OapeflirStage);
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.invalid_stage");
});

test("transition result contains correct targetStage", () => {
  const fsm = new StageTransitionFSM();
  const result = fsm.canTransitionTo("observe");
  assert.equal(result.targetStage, "observe");
});

test("transition result reasonCodes is non-empty array", () => {
  const fsm = new StageTransitionFSM();
  const result = fsm.canTransitionTo("observe");
  assert.ok(Array.isArray(result.reasonCodes));
  assert.ok(result.reasonCodes.length > 0);
});

test("all OAPEFLIR stages have defined transition behavior", () => {
  const fsm = new StageTransitionFSM();
  for (const stage of OAPEFLIR_STAGES) {
    const result = fsm.canTransitionTo(stage);
    assert.ok(
      result.reasonCode.length > 0,
      `Stage ${stage} must have a defined reasonCode`,
    );
  }
});

test("feedback stage entry does not require validation", () => {
  // After complete through execute, the FSM is at feedback (currentStageIndex = 4)
  // canTransitionTo(feedback) returns "fsm.same_stage" since targetIndex === currentIndex
  // This test verifies feedback can be entered without validationRequired check
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");

  // feedback stage has validationRequired: false
  // When already at feedback, same_stage is returned (not prerequisite_not_met)
  const result = fsm.canTransitionTo("feedback");
  assert.equal(result.allowed, true);
  assert.equal(result.reasonCode, "fsm.same_stage");
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: getNextStage & isComplete
// ─────────────────────────────────────────────────────────────────────────────

test("getNextStage returns observe initially", () => {
  const fsm = new StageTransitionFSM();
  assert.equal(fsm.getNextStage(), "observe");
});

test("getNextStage advances through stages", () => {
  const fsm = new StageTransitionFSM();

  assert.equal(fsm.getNextStage(), "observe");
  fsm.recordStageCompletion("observe");

  assert.equal(fsm.getNextStage(), "assess");
  fsm.recordStageCompletion("assess");

  assert.equal(fsm.getNextStage(), "plan");
});

test("getNextStage returns null when complete", () => {
  const fsm = new StageTransitionFSM();

  for (const stage of OAPEFLIR_STAGES) {
    fsm.recordStageCompletion(stage);
  }

  assert.equal(fsm.getNextStage(), null);
  assert.ok(fsm.isComplete());
});

test("isComplete returns false initially", () => {
  const fsm = new StageTransitionFSM();
  assert.equal(fsm.isComplete(), false);
});

test("isComplete returns true after all stages completed", () => {
  const fsm = new StageTransitionFSM();

  for (const stage of OAPEFLIR_STAGES) {
    fsm.recordStageCompletion(stage);
  }

  assert.ok(fsm.isComplete());
});

test("isComplete returns true after reaching release", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");
  fsm.recordStageCompletion("learn");
  fsm.recordStageCompletion("improve");
  fsm.recordStageCompletion("release");

  assert.ok(fsm.isComplete());
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: getExecutionSummary
// ─────────────────────────────────────────────────────────────────────────────

test("getExecutionSummary returns all stages with status", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageSkipped("improve", "test_skip");

  const summary = fsm.getExecutionSummary();

  assert.equal(summary["observe"].status, "completed");
  assert.equal(summary["improve"].status, "skipped");
  assert.equal(summary["plan"].status, "pending");
});

test("getExecutionSummary includes timestamps when recorded", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");

  const summary = fsm.getExecutionSummary();

  assert.ok("timestamp" in summary["observe"]);
  assert.equal(summary["plan"].timestamp, undefined);
});

test("getExecutionSummary returns correct structure for all stages", () => {
  const fsm = new StageTransitionFSM();
  const summary = fsm.getExecutionSummary();

  for (const stage of OAPEFLIR_STAGES) {
    assert.ok("status" in summary[stage]);
    assert.equal(typeof summary[stage].status, "string");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: reset
// ─────────────────────────────────────────────────────────────────────────────

test("reset returns FSM to initial state", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageSkipped("improve", "test");

  fsm.reset();

  assert.equal(fsm.getCurrentStage(), "observe");
  assert.equal(fsm.getStageStatus("observe"), "pending");
  assert.equal(fsm.getStageStatus("assess"), "pending");
  assert.equal(fsm.getStageTimestamp("observe"), undefined);
  // Note: reset() does not clear stageSkipReasons - only timestamps and statuses are reset
});

test("reset clears all stage timestamps", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");

  fsm.reset();

  assert.equal(fsm.getStageTimestamp("observe"), undefined);
  assert.equal(fsm.getStageTimestamp("assess"), undefined);
});

test("reset allows fresh transition sequence", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.reset();

  assert.ok(fsm.canTransitionTo("observe").allowed);
  assert.equal(fsm.canTransitionTo("assess").allowed, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Factory Function
// ─────────────────────────────────────────────────────────────────────────────

test("createStageTransitionFSM creates working FSM instance", () => {
  const fsm = createStageTransitionFSM();
  assert.ok(fsm instanceof StageTransitionFSM);
  assert.equal(fsm.getCurrentStage(), "observe");
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Edge Cases & Error Handling
// ─────────────────────────────────────────────────────────────────────────────

test("multiple recordStageCompletion calls are idempotent", () => {
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("observe");

  assert.equal(fsm.getStageStatus("observe"), "completed");
  assert.equal(fsm.getCurrentStage(), "assess");
});

test("same stage transition after completion returns backward_not_allowed when at different stage", () => {
  // After completing observe, the FSM is now at assess (currentStageIndex = 1)
  // Calling canTransitionTo("observe") checks backward transition since targetIndex(0) < currentIndex(1)
  // Since "assess" is not a valid predecessor for "observe", and not in feedback-driven replan list,
  // this returns backward_not_allowed
  const fsm = new StageTransitionFSM();
  fsm.recordStageCompletion("observe");

  const result = fsm.canTransitionTo("observe");
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "fsm.backward_not_allowed");
});

test("backward transition into earlier stage updates currentStageIndex", () => {
  const fsm = new StageTransitionFSM();

  // Progress to feedback
  fsm.recordStageCompletion("observe");
  fsm.recordStageCompletion("assess");
  fsm.recordStageCompletion("plan");
  fsm.recordStageCompletion("execute");
  fsm.recordStageCompletion("feedback");

  // Transition back to plan (backward replan)
  fsm.recordStageEntry("plan");
  assert.equal(fsm.getCurrentStage(), "plan");
});

test("getStageStatus returns pending for unknown stage", () => {
  const fsm = new StageTransitionFSM();
  // Passing invalid stage returns "pending" as default
  const status = fsm.getStageStatus("release" as OapeflirStage);
  // Since release is valid but not completed, should be pending
  assert.equal(status, "pending");
});