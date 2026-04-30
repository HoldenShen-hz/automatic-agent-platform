/**
 * E2E State Transition Machine Tests
 *
 * End-to-end tests for the generic state transition machine.
 * Tests cover:
 * 1. Valid transitions
 * 2. Invalid transitions
 * 3. No-op transitions (self-loops)
 * 4. Terminal states with no outgoing transitions
 */

import assert from "node:assert/strict";
import test from "node:test";

import { StateTransitionMachine } from "../../src/platform/execution/state-transition/state-transition-machine.js";
import { WorkflowStateError } from "../../src/platform/contracts/errors.js";

// ============================================================================
// Test Suite 1: Valid Transitions
// ============================================================================

test("E2E StateMachine: allows valid transition from queued to in_progress", () => {
  const machine = createTaskStateMachine();

  machine.assertTransition("queued", "in_progress"); // should not throw
});

test("E2E StateMachine: allows valid transition from queued to pending", () => {
  const machine = createTaskStateMachine();

  machine.assertTransition("queued", "pending"); // should not throw
});

test("E2E StateMachine: allows valid transition from queued to cancelled", () => {
  const machine = createTaskStateMachine();

  machine.assertTransition("queued", "cancelled"); // should not throw
});

test("E2E StateMachine: allows valid transition from in_progress to done", () => {
  const machine = createTaskStateMachine();

  machine.assertTransition("in_progress", "done"); // should not throw
});

test("E2E StateMachine: allows valid transition from in_progress to failed", () => {
  const machine = createTaskStateMachine();

  machine.assertTransition("in_progress", "failed"); // should not throw
});

test("E2E StateMachine: allows valid transition from in_progress to awaiting_decision", () => {
  const machine = createTaskStateMachine();

  machine.assertTransition("in_progress", "awaiting_decision"); // should not throw
});

test("E2E StateMachine: allows valid transition from awaiting_decision to in_progress", () => {
  const machine = createTaskStateMachine();

  machine.assertTransition("awaiting_decision", "in_progress"); // should not throw
});

test("E2E StateMachine: allows valid transition from paused to resuming", () => {
  const machine = createWorkflowStateMachine();

  machine.assertTransition("paused", "resuming"); // should not throw
});

test("E2E StateMachine: allows valid transition from resuming to running", () => {
  const machine = createWorkflowStateMachine();

  machine.assertTransition("resuming", "running"); // should not throw
});

// ============================================================================
// Test Suite 2: Invalid Transitions
// ============================================================================

test("E2E StateMachine: rejects invalid transition from queued to done", () => {
  const machine = createTaskStateMachine();

  assert.throws(
    () => machine.assertTransition("queued", "done"),
    WorkflowStateError,
  );
});

test("E2E StateMachine: rejects invalid transition from done to in_progress", () => {
  const machine = createTaskStateMachine();

  assert.throws(
    () => machine.assertTransition("done", "in_progress"),
    WorkflowStateError,
  );
});

test("E2E StateMachine: rejects invalid transition from failed to done", () => {
  const machine = createTaskStateMachine();

  assert.throws(
    () => machine.assertTransition("failed", "done"),
    WorkflowStateError,
  );
});

test("E2E StateMachine: rejects invalid transition from cancelled to pending", () => {
  const machine = createTaskStateMachine();

  assert.throws(
    () => machine.assertTransition("cancelled", "pending"),
    WorkflowStateError,
  );
});

test("E2E StateMachine: rejects invalid workflow transition from completed to running", () => {
  const machine = createWorkflowStateMachine();

  assert.throws(
    () => machine.assertTransition("completed", "running"),
    WorkflowStateError,
  );
});

test("E2E StateMachine: rejects invalid workflow transition from running to pending", () => {
  const machine = createWorkflowStateMachine();

  assert.throws(
    () => machine.assertTransition("running", "pending"),
    WorkflowStateError,
  );
});

// ============================================================================
// Test Suite 3: No-op Transitions (Self-loops)
// ============================================================================

test("E2E StateMachine: rejects no-op transition queued to queued", () => {
  const machine = createTaskStateMachine();

  assert.throws(
    () => machine.assertTransition("queued", "queued"),
    /noop_transition/i,
  );
});

test("E2E StateMachine: rejects no-op transition in_progress to in_progress", () => {
  const machine = createTaskStateMachine();

  assert.throws(
    () => machine.assertTransition("in_progress", "in_progress"),
    /noop_transition/i,
  );
});

test("E2E StateMachine: rejects no-op transition done to done", () => {
  const machine = createTaskStateMachine();

  assert.throws(
    () => machine.assertTransition("done", "done"),
    /noop_transition/i,
  );
});

test("E2E StateMachine: rejects no-op transition failed to failed", () => {
  const machine = createTaskStateMachine();

  assert.throws(
    () => machine.assertTransition("failed", "failed"),
    /noop_transition/i,
  );
});

// ============================================================================
// Test Suite 4: Terminal States
// ============================================================================

test("E2E StateMachine: done has no outgoing transitions", () => {
  const machine = createTaskStateMachine();

  assert.throws(
    () => machine.assertTransition("done", "queued"),
    /invalid_transition/i,
  );
  assert.throws(
    () => machine.assertTransition("done", "in_progress"),
    /invalid_transition/i,
  );
  assert.throws(
    () => machine.assertTransition("done", "failed"),
    /invalid_transition/i,
  );
});

test("E2E StateMachine: failed has no outgoing transitions", () => {
  const machine = createTaskStateMachine();

  assert.throws(
    () => machine.assertTransition("failed", "queued"),
    /invalid_transition/i,
  );
  assert.throws(
    () => machine.assertTransition("failed", "in_progress"),
    /invalid_transition/i,
  );
});

test("E2E StateMachine: cancelled has no outgoing transitions", () => {
  const machine = createTaskStateMachine();

  assert.throws(
    () => machine.assertTransition("cancelled", "queued"),
    /invalid_transition/i,
  );
  assert.throws(
    () => machine.assertTransition("cancelled", "in_progress"),
    /invalid_transition/i,
  );
});

test("E2E StateMachine: completed has no outgoing transitions", () => {
  const machine = createWorkflowStateMachine();

  assert.throws(
    () => machine.assertTransition("completed", "running"),
    /invalid_transition/i,
  );
  assert.throws(
    () => machine.assertTransition("completed", "paused"),
    /invalid_transition/i,
  );
});

// ============================================================================
// Test Suite 5: Error Details
// ============================================================================

test("E2E StateMachine: error includes entity kind in message", () => {
  const machine = createTaskStateMachine();

  try {
    machine.assertTransition("queued", "done");
    assert.fail("Should have thrown");
  } catch (error) {
    assert.ok(error instanceof WorkflowStateError);
    assert.ok(error.message.includes("task"));
    assert.ok(error.message.includes("queued"));
    assert.ok(error.message.includes("done"));
  }
});

test("E2E StateMachine: error includes details for debugging", () => {
  const machine = createTaskStateMachine();

  try {
    machine.assertTransition("queued", "done");
    assert.fail("Should have thrown");
  } catch (error) {
    assert.ok(error instanceof WorkflowStateError);
    assert.deepEqual(error.details, {
      entityKind: "task",
      current: "queued",
      next: "done",
    });
  }
});

// ============================================================================
// Test Suite 6: Workflow-specific transitions
// ============================================================================

test("E2E StateMachine: workflow allows cancelling transition", () => {
  const machine = createWorkflowStateMachine();

  machine.assertTransition("running", "cancelling"); // should not throw
});

test("E2E StateMachine: workflow allows cancelling to cancelled transition", () => {
  const machine = createWorkflowStateMachine();

  machine.assertTransition("cancelling", "cancelled"); // should not throw
});

test("E2E StateMachine: workflow rejects cancelling from completed", () => {
  const machine = createWorkflowStateMachine();

  assert.throws(
    () => machine.assertTransition("completed", "cancelling"),
    WorkflowStateError,
  );
});

// ============================================================================
// Test Suite 7: Session State Transitions
// ============================================================================

test("E2E StateMachine: session allows open to streaming", () => {
  const machine = createSessionStateMachine();

  machine.assertTransition("open", "streaming"); // should not throw
});

test("E2E StateMachine: session allows streaming to awaiting_user", () => {
  const machine = createSessionStateMachine();

  machine.assertTransition("streaming", "awaiting_user"); // should not throw
});

test("E2E StateMachine: session allows open to completed", () => {
  const machine = createSessionStateMachine();

  machine.assertTransition("open", "completed"); // should not throw
});

// ============================================================================
// Test Suite 8: Execution State Transitions
// ============================================================================

test("E2E StateMachine: execution allows created to queued", () => {
  const machine = createExecutionStateMachine();

  machine.assertTransition("created", "queued"); // should not throw
});

test("E2E StateMachine: execution allows executing to succeeded", () => {
  const machine = createExecutionStateMachine();

  machine.assertTransition("executing", "succeeded"); // should not throw
});

test("E2E StateMachine: execution allows executing to failed", () => {
  const machine = createExecutionStateMachine();

  machine.assertTransition("executing", "failed"); // should not throw
});

test("E2E StateMachine: execution rejects created to succeeded", () => {
  const machine = createExecutionStateMachine();

  assert.throws(
    () => machine.assertTransition("created", "succeeded"),
    WorkflowStateError,
  );
});

test("E2E StateMachine: execution allows superseded terminal state", () => {
  const machine = createExecutionStateMachine();

  machine.assertTransition("blocked", "superseded"); // should not throw
  assert.throws(
    () => machine.assertTransition("superseded", "executing"),
    WorkflowStateError,
  );
});

// ============================================================================
// Test Suite 9: Generic Type Safety
// ============================================================================

test("E2E StateMachine: works with string literal types", () => {
  type Status = "active" | "inactive" | "deleted";
  const transitions: Record<Status, readonly Status[]> = {
    active: ["inactive", "deleted"],
    inactive: ["active", "deleted"],
    deleted: [],
  };
  const machine = new StateTransitionMachine("status", transitions);

  machine.assertTransition("active", "inactive"); // should not throw
  machine.assertTransition("active", "deleted"); // should not throw (deleted is in allowed list)
  assert.throws(
    () => machine.assertTransition("deleted", "active"),
    WorkflowStateError,
  );
});

// ============================================================================
// Helper Functions - Create State Machines
// ============================================================================

function createTaskStateMachine(): StateTransitionMachine<string> {
  const transitions: Record<string, readonly string[]> = {
    queued: ["pending", "in_progress", "cancelled"],
    pending: ["in_progress", "cancelled"],
    in_progress: ["awaiting_decision", "done", "failed", "cancelled"],
    awaiting_decision: ["in_progress", "failed", "cancelled"],
    done: [],
    failed: [],
    cancelled: [],
  };
  return new StateTransitionMachine("task", transitions);
}

function createWorkflowStateMachine(): StateTransitionMachine<string> {
  const transitions: Record<string, readonly string[]> = {
    running: ["paused", "completed", "failed", "cancelling", "cancelled"],
    paused: ["resuming", "failed", "cancelled"],
    resuming: ["running", "failed", "cancelled"],
    completed: [],
    failed: [],
    cancelling: ["cancelled"],
    cancelled: [],
  };
  return new StateTransitionMachine("workflow", transitions);
}

function createSessionStateMachine(): StateTransitionMachine<string> {
  const transitions: Record<string, readonly string[]> = {
    open: ["streaming", "awaiting_user", "completed", "failed", "cancelled"],
    streaming: ["awaiting_user", "completed", "failed", "cancelled", "open"],
    awaiting_user: ["streaming", "completed", "failed", "cancelled"],
    paused: ["streaming", "completed", "failed", "cancelled"],
    completed: [],
    failed: [],
    cancelled: [],
  };
  return new StateTransitionMachine("session", transitions);
}

function createExecutionStateMachine(): StateTransitionMachine<string> {
  const transitions: Record<string, readonly string[]> = {
    created: ["queued", "prechecking", "executing", "dispatching", "cancelled", "failed"],
    queued: ["dispatching", "prechecking", "executing", "cancelled", "failed"],
    dispatching: ["prechecking", "executing", "paused", "recovering", "cancelled", "failed"],
    prechecking: ["executing", "blocked", "paused", "recovering", "cancelled", "failed"],
    executing: ["blocked", "succeeded", "failed", "cancelled", "paused", "recovering"],
    paused: ["resuming", "recovering", "timed_out", "failed", "cancelled"],
    recovering: ["ready", "executing", "failed", "cancelled", "timed_out"],
    timed_out: ["resuming", "failed", "cancelled"],
    blocked: ["prechecking", "executing", "cancelled", "failed", "superseded"],
    succeeded: [],
    failed: [],
    cancelled: [],
    superseded: [],
  };
  return new StateTransitionMachine("execution", transitions);
}
