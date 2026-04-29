import assert from "node:assert/strict";
import test from "node:test";

import { StateTransitionMachine } from "../../../../../src/platform/execution/state-transition/state-transition-machine.js";
import { WorkflowStateError } from "../../../../../src/platform/contracts/errors.js";

/**
 * TaskStateMachine tests
 *
 * Tests the state machine that governs task lifecycle transitions.
 * Tasks flow through: queued -> pending -> in_progress,
 * then branch to done, failed, cancelled, or awaiting_decision.
 * Terminal states (done, failed, cancelled) have no outgoing transitions.
 */

// Transition map matching TASK_TRANSITIONS from transition-service.ts
const TASK_TRANSITIONS: Record<string, readonly string[]> = {
  queued: ["pending", "in_progress", "cancelled"],
  pending: ["in_progress", "cancelled"],
  in_progress: ["awaiting_decision", "done", "failed", "cancelled"],
  awaiting_decision: ["in_progress", "failed", "cancelled"],
  done: [],
  failed: [],
  cancelled: [],
};

function createTaskStateMachine(): StateTransitionMachine<string> {
  return new StateTransitionMachine("task", TASK_TRANSITIONS);
}

// ---------------------------------------------------------------------------
// Valid transitions from queued
// ---------------------------------------------------------------------------

test("TaskStateMachine: allows queued -> pending", () => {
  const machine = createTaskStateMachine();
  machine.assertTransition("queued", "pending");
});

test("TaskStateMachine: allows queued -> in_progress", () => {
  const machine = createTaskStateMachine();
  machine.assertTransition("queued", "in_progress");
});

test("TaskStateMachine: allows queued -> cancelled", () => {
  const machine = createTaskStateMachine();
  machine.assertTransition("queued", "cancelled");
});

// ---------------------------------------------------------------------------
// Valid transitions from pending
// ---------------------------------------------------------------------------

test("TaskStateMachine: allows pending -> in_progress", () => {
  const machine = createTaskStateMachine();
  machine.assertTransition("pending", "in_progress");
});

test("TaskStateMachine: allows pending -> cancelled", () => {
  const machine = createTaskStateMachine();
  machine.assertTransition("pending", "cancelled");
});

// ---------------------------------------------------------------------------
// Valid transitions from in_progress
// ---------------------------------------------------------------------------

test("TaskStateMachine: allows in_progress -> awaiting_decision", () => {
  const machine = createTaskStateMachine();
  machine.assertTransition("in_progress", "awaiting_decision");
});

test("TaskStateMachine: allows in_progress -> done", () => {
  const machine = createTaskStateMachine();
  machine.assertTransition("in_progress", "done");
});

test("TaskStateMachine: allows in_progress -> failed", () => {
  const machine = createTaskStateMachine();
  machine.assertTransition("in_progress", "failed");
});

test("TaskStateMachine: allows in_progress -> cancelled", () => {
  const machine = createTaskStateMachine();
  machine.assertTransition("in_progress", "cancelled");
});

// ---------------------------------------------------------------------------
// Valid transitions from awaiting_decision
// ---------------------------------------------------------------------------

test("TaskStateMachine: allows awaiting_decision -> in_progress", () => {
  const machine = createTaskStateMachine();
  machine.assertTransition("awaiting_decision", "in_progress");
});

test("TaskStateMachine: allows awaiting_decision -> failed", () => {
  const machine = createTaskStateMachine();
  machine.assertTransition("awaiting_decision", "failed");
});

test("TaskStateMachine: allows awaiting_decision -> cancelled", () => {
  const machine = createTaskStateMachine();
  machine.assertTransition("awaiting_decision", "cancelled");
});

// ---------------------------------------------------------------------------
// Invalid transitions: terminal state done has no outgoing transitions
// ---------------------------------------------------------------------------

test("TaskStateMachine: rejects done -> in_progress", () => {
  const machine = createTaskStateMachine();
  assert.throws(
    () => machine.assertTransition("done", "in_progress"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.invalid_transition",
  );
});

test("TaskStateMachine: rejects done -> failed", () => {
  const machine = createTaskStateMachine();
  assert.throws(
    () => machine.assertTransition("done", "failed"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.invalid_transition",
  );
});

test("TaskStateMachine: rejects done -> cancelled", () => {
  const machine = createTaskStateMachine();
  assert.throws(
    () => machine.assertTransition("done", "cancelled"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.invalid_transition",
  );
});

// ---------------------------------------------------------------------------
// Invalid transitions: terminal state failed has no outgoing transitions
// ---------------------------------------------------------------------------

test("TaskStateMachine: rejects failed -> done", () => {
  const machine = createTaskStateMachine();
  assert.throws(
    () => machine.assertTransition("failed", "done"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.invalid_transition",
  );
});

test("TaskStateMachine: rejects failed -> in_progress", () => {
  const machine = createTaskStateMachine();
  assert.throws(
    () => machine.assertTransition("failed", "in_progress"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.invalid_transition",
  );
});

test("TaskStateMachine: rejects failed -> cancelled", () => {
  const machine = createTaskStateMachine();
  assert.throws(
    () => machine.assertTransition("failed", "cancelled"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.invalid_transition",
  );
});

// ---------------------------------------------------------------------------
// Invalid transitions: terminal state cancelled has no outgoing transitions
// ---------------------------------------------------------------------------

test("TaskStateMachine: rejects cancelled -> in_progress", () => {
  const machine = createTaskStateMachine();
  assert.throws(
    () => machine.assertTransition("cancelled", "in_progress"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.invalid_transition",
  );
});

test("TaskStateMachine: rejects cancelled -> done", () => {
  const machine = createTaskStateMachine();
  assert.throws(
    () => machine.assertTransition("cancelled", "done"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.invalid_transition",
  );
});

test("TaskStateMachine: rejects cancelled -> failed", () => {
  const machine = createTaskStateMachine();
  assert.throws(
    () => machine.assertTransition("cancelled", "failed"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.invalid_transition",
  );
});

// ---------------------------------------------------------------------------
// Invalid transitions: no skip states allowed
// ---------------------------------------------------------------------------

test("TaskStateMachine: rejects queued -> done (skip pending)", () => {
  const machine = createTaskStateMachine();
  assert.throws(
    () => machine.assertTransition("queued", "done"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.invalid_transition",
  );
});

test("TaskStateMachine: rejects queued -> failed (skip states)", () => {
  const machine = createTaskStateMachine();
  assert.throws(
    () => machine.assertTransition("queued", "failed"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.invalid_transition",
  );
});

test("TaskStateMachine: rejects pending -> done (skip in_progress)", () => {
  const machine = createTaskStateMachine();
  assert.throws(
    () => machine.assertTransition("pending", "done"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.invalid_transition",
  );
});

test("TaskStateMachine: rejects pending -> failed (skip in_progress)", () => {
  const machine = createTaskStateMachine();
  assert.throws(
    () => machine.assertTransition("pending", "failed"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.invalid_transition",
  );
});

// ---------------------------------------------------------------------------
// Invalid transitions: backward transitions not allowed
// ---------------------------------------------------------------------------

test("TaskStateMachine: rejects pending -> queued", () => {
  const machine = createTaskStateMachine();
  assert.throws(
    () => machine.assertTransition("pending", "queued"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.invalid_transition",
  );
});

test("TaskStateMachine: rejects in_progress -> pending", () => {
  const machine = createTaskStateMachine();
  assert.throws(
    () => machine.assertTransition("in_progress", "pending"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.invalid_transition",
  );
});

test("TaskStateMachine: rejects in_progress -> queued", () => {
  const machine = createTaskStateMachine();
  assert.throws(
    () => machine.assertTransition("in_progress", "queued"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.invalid_transition",
  );
});

// ---------------------------------------------------------------------------
// No-op transitions are rejected
// ---------------------------------------------------------------------------

test("TaskStateMachine: rejects no-op queued -> queued", () => {
  const machine = createTaskStateMachine();
  assert.throws(
    () => machine.assertTransition("queued", "queued"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.noop_transition_denied",
  );
});

test("TaskStateMachine: rejects no-op in_progress -> in_progress", () => {
  const machine = createTaskStateMachine();
  assert.throws(
    () => machine.assertTransition("in_progress", "in_progress"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.noop_transition_denied",
  );
});

test("TaskStateMachine: rejects no-op done -> done", () => {
  const machine = createTaskStateMachine();
  assert.throws(
    () => machine.assertTransition("done", "done"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.noop_transition_denied",
  );
});

// ---------------------------------------------------------------------------
// WorkflowStateError details are populated correctly
// ---------------------------------------------------------------------------

test("TaskStateMachine: error contains entityKind in details", () => {
  const machine = createTaskStateMachine();
  try {
    machine.assertTransition("done", "in_progress");
    assert.fail("Expected WorkflowStateError to be thrown");
  } catch (err: unknown) {
    assert.ok(err instanceof WorkflowStateError);
    assert.strictEqual(err.details?.entityKind, "task");
  }
});

test("TaskStateMachine: error contains current and next states in details", () => {
  const machine = createTaskStateMachine();
  try {
    machine.assertTransition("queued", "done");
    assert.fail("Expected WorkflowStateError to be thrown");
  } catch (err: unknown) {
    assert.ok(err instanceof WorkflowStateError);
    assert.strictEqual(err.details?.current, "queued");
    assert.strictEqual(err.details?.next, "done");
  }
});
