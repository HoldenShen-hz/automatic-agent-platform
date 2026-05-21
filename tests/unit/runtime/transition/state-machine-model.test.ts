import test from "node:test";
import assert from "node:assert/strict";

import {
  taskStateMachine,
  workflowStateMachine,
  sessionStateMachine,
  executionStateMachine,
  approvalStateMachine,
} from "../../../../src/platform/five-plane-execution/state-transition/transition-service-model.js";

// =============================================================================
// TASK STATE MACHINE TESTS
// =============================================================================

test("taskStateMachine allows valid task status transitions", () => {
  // From queued
  taskStateMachine.assertTransition("queued", "pending");
  taskStateMachine.assertTransition("queued", "in_progress");
  taskStateMachine.assertTransition("queued", "cancelled");

  // From pending
  taskStateMachine.assertTransition("pending", "in_progress");
  taskStateMachine.assertTransition("pending", "cancelled");

  // From in_progress
  taskStateMachine.assertTransition("in_progress", "awaiting_decision");
  taskStateMachine.assertTransition("in_progress", "done");
  taskStateMachine.assertTransition("in_progress", "failed");
  taskStateMachine.assertTransition("in_progress", "cancelled");

  // From awaiting_decision
  taskStateMachine.assertTransition("awaiting_decision", "in_progress");
  taskStateMachine.assertTransition("awaiting_decision", "failed");
  taskStateMachine.assertTransition("awaiting_decision", "cancelled");
});

test("taskStateMachine rejects invalid task status transitions", () => {
  // Cannot go back from terminal states
  assert.throws(() => taskStateMachine.assertTransition("done", "in_progress"), /invalid_transition/);
  assert.throws(() => taskStateMachine.assertTransition("failed", "in_progress"), /invalid_transition/);
  assert.throws(() => taskStateMachine.assertTransition("cancelled", "in_progress"), /invalid_transition/);

  // Cannot skip to done from queued
  assert.throws(() => taskStateMachine.assertTransition("queued", "done"), /invalid_transition/);

  // Cannot transition from done
  assert.throws(() => taskStateMachine.assertTransition("done", "failed"), /invalid_transition/);
  assert.throws(() => taskStateMachine.assertTransition("done", "cancelled"), /invalid_transition/);
});

test("taskStateMachine allows same-state no-op transitions", () => {
  taskStateMachine.assertTransition("queued", "queued");
  taskStateMachine.assertTransition("pending", "pending");
  taskStateMachine.assertTransition("in_progress", "in_progress");
  taskStateMachine.assertTransition("awaiting_decision", "awaiting_decision");
});

// =============================================================================
// WORKFLOW STATE MACHINE TESTS
// =============================================================================

test("workflowStateMachine allows valid workflow status transitions", () => {
  // From created
  workflowStateMachine.assertTransition("created", "running");
  workflowStateMachine.assertTransition("created", "failed");
  workflowStateMachine.assertTransition("created", "cancelled");

  // From running
  workflowStateMachine.assertTransition("running", "paused");
  workflowStateMachine.assertTransition("running", "completed");
  workflowStateMachine.assertTransition("running", "failed");
  workflowStateMachine.assertTransition("running", "cancelling");
  workflowStateMachine.assertTransition("running", "cancelled");

  // From paused
  workflowStateMachine.assertTransition("paused", "resuming");
  workflowStateMachine.assertTransition("paused", "failed");
  workflowStateMachine.assertTransition("paused", "cancelled");

  // From resuming
  workflowStateMachine.assertTransition("resuming", "running");
  workflowStateMachine.assertTransition("resuming", "failed");
  workflowStateMachine.assertTransition("resuming", "cancelled");

  // From cancelling
  workflowStateMachine.assertTransition("cancelling", "cancelled");
});

test("workflowStateMachine rejects invalid workflow status transitions", () => {
  // Cannot transition from terminal states
  assert.throws(() => workflowStateMachine.assertTransition("completed", "running"), /invalid_transition/);
  assert.throws(() => workflowStateMachine.assertTransition("failed", "running"), /invalid_transition/);
  assert.throws(() => workflowStateMachine.assertTransition("cancelled", "running"), /invalid_transition/);

  // Cannot go directly to completed from created
  assert.throws(() => workflowStateMachine.assertTransition("created", "completed"), /invalid_transition/);

  // Paused cannot go directly to completed
  assert.throws(() => workflowStateMachine.assertTransition("paused", "completed"), /invalid_transition/);
});

test("workflowStateMachine allows same-state no-op transitions", () => {
  workflowStateMachine.assertTransition("created", "created");
  workflowStateMachine.assertTransition("running", "running");
  workflowStateMachine.assertTransition("paused", "paused");
  workflowStateMachine.assertTransition("resuming", "resuming");
  workflowStateMachine.assertTransition("completed", "completed");
});

// =============================================================================
// SESSION STATE MACHINE TESTS
// =============================================================================

test("sessionStateMachine allows valid session status transitions", () => {
  // From open
  sessionStateMachine.assertTransition("open", "streaming");
  sessionStateMachine.assertTransition("open", "awaiting_user");
  sessionStateMachine.assertTransition("open", "completed");
  sessionStateMachine.assertTransition("open", "failed");
  sessionStateMachine.assertTransition("open", "cancelled");

  // From streaming
  sessionStateMachine.assertTransition("streaming", "awaiting_user");
  sessionStateMachine.assertTransition("streaming", "completed");
  sessionStateMachine.assertTransition("streaming", "failed");
  sessionStateMachine.assertTransition("streaming", "cancelled");
  sessionStateMachine.assertTransition("streaming", "open");

  // From awaiting_user
  sessionStateMachine.assertTransition("awaiting_user", "streaming");
  sessionStateMachine.assertTransition("awaiting_user", "completed");
  sessionStateMachine.assertTransition("awaiting_user", "failed");
  sessionStateMachine.assertTransition("awaiting_user", "cancelled");

  // From paused
  sessionStateMachine.assertTransition("paused", "streaming");
  sessionStateMachine.assertTransition("paused", "completed");
  sessionStateMachine.assertTransition("paused", "failed");
  sessionStateMachine.assertTransition("paused", "cancelled");
  sessionStateMachine.assertTransition("paused", "open");
});

test("sessionStateMachine rejects invalid session status transitions", () => {
  // Cannot transition from terminal states
  assert.throws(() => sessionStateMachine.assertTransition("completed", "streaming"), /invalid_transition/);
  assert.throws(() => sessionStateMachine.assertTransition("failed", "streaming"), /invalid_transition/);
  assert.throws(() => sessionStateMachine.assertTransition("cancelled", "streaming"), /invalid_transition/);

  // Cannot go to paused from open directly
  assert.throws(() => sessionStateMachine.assertTransition("open", "paused"), /invalid_transition/);
});

test("sessionStateMachine allows same-state no-op transitions", () => {
  sessionStateMachine.assertTransition("open", "open");
  sessionStateMachine.assertTransition("streaming", "streaming");
  sessionStateMachine.assertTransition("awaiting_user", "awaiting_user");
  sessionStateMachine.assertTransition("paused", "paused");
});

// =============================================================================
// EXECUTION STATE MACHINE TESTS
// =============================================================================

test("executionStateMachine allows valid execution status transitions", () => {
  // From created
  executionStateMachine.assertTransition("created", "prechecking");
  executionStateMachine.assertTransition("created", "executing");
  executionStateMachine.assertTransition("created", "cancelled");
  executionStateMachine.assertTransition("created", "failed");

  // From prechecking
  executionStateMachine.assertTransition("prechecking", "executing");
  executionStateMachine.assertTransition("prechecking", "blocked");
  executionStateMachine.assertTransition("prechecking", "cancelled");
  executionStateMachine.assertTransition("prechecking", "failed");

  // From ready
  executionStateMachine.assertTransition("ready", "queued");
  executionStateMachine.assertTransition("ready", "cancelled");
  executionStateMachine.assertTransition("ready", "failed");

  // From queued
  executionStateMachine.assertTransition("queued", "dispatching");
  executionStateMachine.assertTransition("queued", "cancelled");
  executionStateMachine.assertTransition("queued", "failed");

  // From dispatching
  executionStateMachine.assertTransition("dispatching", "executing");
  executionStateMachine.assertTransition("dispatching", "cancelled");
  executionStateMachine.assertTransition("dispatching", "failed");

  // From executing
  executionStateMachine.assertTransition("executing", "blocked");
  executionStateMachine.assertTransition("executing", "succeeded");
  executionStateMachine.assertTransition("executing", "failed");
  executionStateMachine.assertTransition("executing", "cancelled");

  // From blocked
  executionStateMachine.assertTransition("blocked", "prechecking");
  executionStateMachine.assertTransition("blocked", "executing");
  executionStateMachine.assertTransition("blocked", "cancelled");
  executionStateMachine.assertTransition("blocked", "failed");
  executionStateMachine.assertTransition("blocked", "superseded");

  // From paused
  executionStateMachine.assertTransition("paused", "resuming");
  executionStateMachine.assertTransition("paused", "executing");
  executionStateMachine.assertTransition("paused", "cancelled");
  executionStateMachine.assertTransition("paused", "failed");

  // From resuming
  executionStateMachine.assertTransition("resuming", "executing");
  executionStateMachine.assertTransition("resuming", "cancelled");
  executionStateMachine.assertTransition("resuming", "failed");

  // From recovering
  executionStateMachine.assertTransition("recovering", "executing");
  executionStateMachine.assertTransition("recovering", "cancelled");
  executionStateMachine.assertTransition("recovering", "failed");
  executionStateMachine.assertTransition("recovering", "timed_out");

  // From timed_out
  executionStateMachine.assertTransition("timed_out", "executing");
  executionStateMachine.assertTransition("timed_out", "cancelled");
  executionStateMachine.assertTransition("timed_out", "failed");
});

test("executionStateMachine rejects invalid execution status transitions", () => {
  // Cannot skip states arbitrarily
  assert.throws(() => executionStateMachine.assertTransition("created", "succeeded"), /invalid_transition/);
  assert.throws(() => executionStateMachine.assertTransition("created", "queued"), /invalid_transition/);
  assert.throws(() => executionStateMachine.assertTransition("executing", "queued"), /invalid_transition/);
  assert.throws(() => executionStateMachine.assertTransition("executing", "dispatching"), /invalid_transition/);

  // Cannot recover from terminal states
  assert.throws(() => executionStateMachine.assertTransition("succeeded", "executing"), /invalid_transition/);
  assert.throws(() => executionStateMachine.assertTransition("failed", "executing"), /invalid_transition/);
  assert.throws(() => executionStateMachine.assertTransition("cancelled", "executing"), /invalid_transition/);
  assert.throws(() => executionStateMachine.assertTransition("superseded", "executing"), /invalid_transition/);
});

test("executionStateMachine allows same-state no-op transitions", () => {
  executionStateMachine.assertTransition("created", "created");
  executionStateMachine.assertTransition("executing", "executing");
  executionStateMachine.assertTransition("blocked", "blocked");
  executionStateMachine.assertTransition("succeeded", "succeeded");
});

// =============================================================================
// APPROVAL STATE MACHINE TESTS
// =============================================================================

test("approvalStateMachine allows valid approval status transitions", () => {
  approvalStateMachine.assertTransition("requested", "approved");
  approvalStateMachine.assertTransition("requested", "rejected");
  approvalStateMachine.assertTransition("requested", "expired");
  approvalStateMachine.assertTransition("requested", "cancelled");
});

test("approvalStateMachine rejects invalid approval status transitions", () => {
  // Cannot transition from terminal states
  assert.throws(() => approvalStateMachine.assertTransition("approved", "rejected"), /invalid_transition/);
  assert.throws(() => approvalStateMachine.assertTransition("approved", "cancelled"), /invalid_transition/);
  assert.throws(() => approvalStateMachine.assertTransition("rejected", "approved"), /invalid_transition/);
  assert.throws(() => approvalStateMachine.assertTransition("expired", "approved"), /invalid_transition/);
  assert.throws(() => approvalStateMachine.assertTransition("cancelled", "approved"), /invalid_transition/);

  // Cannot transition from requested to anything except terminal
  assert.throws(() => approvalStateMachine.assertTransition("requested", "requested"), /invalid_transition/);
});

test("approvalStateMachine rejects all transitions from terminal states", () => {
  const terminalStates = ["approved", "rejected", "expired", "cancelled"] as const;
  for (const from of terminalStates) {
    for (const to of ["approved", "rejected", "expired", "cancelled", "requested"] as const) {
      if (from !== to) {
        assert.throws(
          () => approvalStateMachine.assertTransition(from, to),
          /invalid_transition/,
          `Should reject ${from} -> ${to}`
        );
      }
    }
  }
});

// =============================================================================
// CROSS-MACHINE ISOLATION TESTS
// =============================================================================

test("each state machine is isolated and entity-specific", () => {
  // Task transitions don't affect workflow machine
  assert.throws(
    () => workflowStateMachine.assertTransition("created", "completed"),
    /invalid_transition/
  );

  // Workflow transitions don't affect execution machine
  assert.throws(
    () => executionStateMachine.assertTransition("created", "succeeded"),
    /invalid_transition/
  );

  // Execution transitions don't affect approval machine
  assert.throws(
    () => approvalStateMachine.assertTransition("requested", "cancelled"),
    /invalid_transition/
  );
});

// =============================================================================
// EDGE CASES
// =============================================================================

test("workflowStateMachine cancelling is only transition from cancelling", () => {
  workflowStateMachine.assertTransition("cancelling", "cancelled");

  // Cannot go back to running from cancelling
  assert.throws(
    () => workflowStateMachine.assertTransition("cancelling", "running"),
    /invalid_transition/
  );
});

test("executionStateMachine blocked can go to superseded", () => {
  executionStateMachine.assertTransition("blocked", "superseded");
});

test("sessionStateMachine allows open to streaming and back", () => {
  sessionStateMachine.assertTransition("open", "streaming");
  sessionStateMachine.assertTransition("streaming", "open");
});