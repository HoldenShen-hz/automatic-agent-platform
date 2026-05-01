/**
 * State Transition Machine Unit Tests
 *
 * Tests state transition validation, no-op rejection,
 * and invalid transition detection.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { StateTransitionMachine } from "../../../../../src/platform/five-plane-execution/state-transition/state-transition-machine.js";
import { WorkflowStateError } from "../../../../../src/platform/contracts/errors.js";

// ---------------------------------------------------------------------------
// Test Fixtures & Helpers
// ---------------------------------------------------------------------------

type TaskState = "queued" | "pending" | "in_progress" | "done" | "failed" | "cancelled";

const taskTransitions: Record<TaskState, readonly TaskState[]> = {
  queued: ["pending", "in_progress", "cancelled"],
  pending: ["in_progress", "cancelled"],
  in_progress: ["done", "failed", "cancelled"],
  done: [],
  failed: [],
  cancelled: [],
};

function createTaskStateMachine(): StateTransitionMachine<TaskState> {
  return new StateTransitionMachine<TaskState>("task", taskTransitions);
}

// ---------------------------------------------------------------------------
// Tests: Valid Transitions
// ---------------------------------------------------------------------------

test("assertTransition() allows valid transition from queued to pending", () => {
  const machine = createTaskStateMachine();

  // Should not throw
  machine.assertTransition("queued", "pending");
});

test("assertTransition() allows valid transition from queued to in_progress", () => {
  const machine = createTaskStateMachine();

  machine.assertTransition("queued", "in_progress");
});

test("assertTransition() allows valid transition from queued to cancelled", () => {
  const machine = createTaskStateMachine();

  machine.assertTransition("queued", "cancelled");
});

test("assertTransition() allows valid transition from pending to in_progress", () => {
  const machine = createTaskStateMachine();

  machine.assertTransition("pending", "in_progress");
});

test("assertTransition() allows valid transition from in_progress to done", () => {
  const machine = createTaskStateMachine();

  machine.assertTransition("in_progress", "done");
});

test("assertTransition() allows valid transition from in_progress to failed", () => {
  const machine = createTaskStateMachine();

  machine.assertTransition("in_progress", "failed");
});

// ---------------------------------------------------------------------------
// Tests: No-op Transitions
// ---------------------------------------------------------------------------

test("assertTransition() rejects no-op transition to same state", () => {
  const machine = createTaskStateMachine();

  assert.throws(
    () => machine.assertTransition("queued", "queued"),
    (err: unknown) =>
      err instanceof WorkflowStateError &&
      err.message.includes("noop_transition_denied"),
    "Should throw WorkflowStateError for no-op transition",
  );
});

test("assertTransition() rejects no-op transition for terminal states", () => {
  const machine = createTaskStateMachine();

  assert.throws(
    () => machine.assertTransition("done", "done"),
    (err: unknown) =>
      err instanceof WorkflowStateError &&
      err.message.includes("noop_transition_denied"),
  );

  assert.throws(
    () => machine.assertTransition("failed", "failed"),
    (err: unknown) =>
      err instanceof WorkflowStateError &&
      err.message.includes("noop_transition_denied"),
  );

  assert.throws(
    () => machine.assertTransition("cancelled", "cancelled"),
    (err: unknown) =>
      err instanceof WorkflowStateError &&
      err.message.includes("noop_transition_denied"),
  );
});

// ---------------------------------------------------------------------------
// Tests: Invalid Transitions
// ---------------------------------------------------------------------------

test("assertTransition() rejects invalid transition from queued to done", () => {
  const machine = createTaskStateMachine();

  assert.throws(
    () => machine.assertTransition("queued", "done"),
    (err: unknown) =>
      err instanceof WorkflowStateError &&
      err.message.includes("invalid_transition"),
  );
});

test("assertTransition() rejects invalid transition from pending to done", () => {
  const machine = createTaskStateMachine();

  assert.throws(
    () => machine.assertTransition("pending", "done"),
    (err: unknown) =>
      err instanceof WorkflowStateError &&
      err.message.includes("invalid_transition"),
  );
});

test("assertTransition() rejects backward transition from done to in_progress", () => {
  const machine = createTaskStateMachine();

  assert.throws(
    () => machine.assertTransition("done", "in_progress"),
    (err: unknown) =>
      err instanceof WorkflowStateError &&
      err.message.includes("invalid_transition"),
  );
});

test("assertTransition() rejects transition from terminal state failed to any state", () => {
  const machine = createTaskStateMachine();

  assert.throws(
    () => machine.assertTransition("failed", "pending"),
    (err: unknown) =>
      err instanceof WorkflowStateError &&
      err.message.includes("invalid_transition"),
  );

  assert.throws(
    () => machine.assertTransition("failed", "in_progress"),
    (err: unknown) =>
      err instanceof WorkflowStateError &&
      err.message.includes("invalid_transition"),
  );
});

test("assertTransition() rejects transition from terminal state cancelled to any state", () => {
  const machine = createTaskStateMachine();

  assert.throws(
    () => machine.assertTransition("cancelled", "pending"),
    (err: unknown) =>
      err instanceof WorkflowStateError &&
      err.message.includes("invalid_transition"),
  );
});

// ---------------------------------------------------------------------------
// Tests: Error Details
// ---------------------------------------------------------------------------

test("WorkflowStateError contains entity kind in details", () => {
  const machine = createTaskStateMachine();

  try {
    machine.assertTransition("queued", "done");
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    assert.deepEqual((err as WorkflowStateError).details, {
      entityKind: "task",
      current: "queued",
      next: "done",
    });
  }
});

test("WorkflowStateError for no-op contains entity kind in details", () => {
  const machine = createTaskStateMachine();

  try {
    machine.assertTransition("pending", "pending");
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    assert.deepEqual((err as WorkflowStateError).details, {
      entityKind: "task",
      current: "pending",
      next: "pending",
    });
  }
});

// ---------------------------------------------------------------------------
// Tests: Custom Entity Kind
// ---------------------------------------------------------------------------

test("StateTransitionMachine uses custom entity kind in error messages", () => {
  type SessionState = "active" | "idle" | "closed";
  const sessionTransitions: Record<SessionState, readonly SessionState[]> = {
    active: ["idle", "closed"],
    idle: ["active", "closed"],
    closed: [],
  };
  const sessionMachine = new StateTransitionMachine<SessionState>(
    "session",
    sessionTransitions,
  );

  // "closed" -> "active" is invalid since closed is terminal
  assert.throws(
    () => sessionMachine.assertTransition("closed", "active"),
    (err: unknown) =>
      err instanceof WorkflowStateError &&
      err.message.includes("session") &&
      err.message.includes("invalid_transition"),
  );
});

// ---------------------------------------------------------------------------
// Tests: Empty Transitions Map
// ---------------------------------------------------------------------------

test("StateTransitionMachine handles terminal state with no outgoing transitions", () => {
  type OrderState = "open" | "fulfilled" | "cancelled";
  const orderTransitions: Record<OrderState, readonly OrderState[]> = {
    open: ["fulfilled", "cancelled"],
    fulfilled: [],
    cancelled: [],
  };
  const orderMachine = new StateTransitionMachine<OrderState>("order", orderTransitions);

  // Can transition to terminal state
  orderMachine.assertTransition("open", "fulfilled");

  // Cannot transition from terminal state
  assert.throws(
    () => orderMachine.assertTransition("fulfilled", "open"),
    (err: unknown) =>
      err instanceof WorkflowStateError &&
      err.message.includes("invalid_transition"),
  );
});

// ---------------------------------------------------------------------------
// Tests: Complex Workflow States
// ---------------------------------------------------------------------------

test("StateTransitionMachine supports complex workflow with many states", () => {
  type WorkflowState =
    | "created"
    | "validated"
    | "planning"
    | "executing"
    | "paused"
    | "waiting_approval"
    | "completed"
    | "failed"
    | "cancelled";

  const workflowTransitions: Record<WorkflowState, readonly WorkflowState[]> = {
    created: ["validated", "cancelled"],
    validated: ["planning", "cancelled"],
    planning: ["executing", "paused", "cancelled"],
    executing: ["completed", "failed", "waiting_approval", "paused", "cancelled"],
    paused: ["executing", "cancelled"],
    waiting_approval: ["executing", "cancelled"],
    completed: [],
    failed: [],
    cancelled: [],
  };

  const wfMachine = new StateTransitionMachine<WorkflowState>(
    "workflow",
    workflowTransitions,
  );

  // Valid complex path
  wfMachine.assertTransition("created", "validated");
  wfMachine.assertTransition("validated", "planning");
  wfMachine.assertTransition("planning", "executing");
  wfMachine.assertTransition("executing", "waiting_approval");
  wfMachine.assertTransition("waiting_approval", "executing");
  wfMachine.assertTransition("executing", "completed");

  // Invalid transitions
  assert.throws(
    () => wfMachine.assertTransition("completed", "executing"),
    (err: unknown) => err instanceof WorkflowStateError,
  );

  assert.throws(
    () => wfMachine.assertTransition("failed", "planning"),
    (err: unknown) => err instanceof WorkflowStateError,
  );
});
