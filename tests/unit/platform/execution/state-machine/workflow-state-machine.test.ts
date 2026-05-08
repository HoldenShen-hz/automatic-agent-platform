import assert from "node:assert/strict";
import test from "node:test";

import { StateTransitionMachine } from "../../../../../src/platform/execution/state-transition/state-transition-machine.js";
import { WorkflowStateError } from "../../../../../src/platform/contracts/errors.js";

/**
 * WorkflowStateMachine tests
 *
 * Tests the state machine that governs workflow lifecycle transitions.
 * Workflows represent multi-step execution plans with states:
 * - running: workflow is actively executing steps
 * - paused: workflow is paused waiting for resources or approval
 * - resuming: workflow is transitioning from paused back to running
 * - completed/failed/cancelled: terminal states
 * - cancelling: transient state during graceful cancellation
 */

// Transition map matching WORKFLOW_TRANSITIONS from transition-service.ts
const WORKFLOW_TRANSITIONS: Record<string, readonly string[]> = {
  running: ["paused", "completed", "failed", "cancelling", "cancelled"],
  paused: ["resuming", "failed", "cancelled"],
  resuming: ["running", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelling: ["cancelled"],
  cancelled: [],
};

function createWorkflowStateMachine(): StateTransitionMachine<string> {
  return new StateTransitionMachine("workflow", WORKFLOW_TRANSITIONS);
}

// ---------------------------------------------------------------------------
// Valid transitions from running
// ---------------------------------------------------------------------------

test("WorkflowStateMachine: allows running -> paused", () => {
  const machine = createWorkflowStateMachine();
  machine.assertTransition("running", "paused");
});

test("WorkflowStateMachine: allows running -> completed", () => {
  const machine = createWorkflowStateMachine();
  machine.assertTransition("running", "completed");
});

test("WorkflowStateMachine: allows running -> failed", () => {
  const machine = createWorkflowStateMachine();
  machine.assertTransition("running", "failed");
});

test("WorkflowStateMachine: allows running -> cancelling", () => {
  const machine = createWorkflowStateMachine();
  machine.assertTransition("running", "cancelling");
});

test("WorkflowStateMachine: allows running -> cancelled", () => {
  const machine = createWorkflowStateMachine();
  machine.assertTransition("running", "cancelled");
});

// ---------------------------------------------------------------------------
// Valid transitions from paused
// ---------------------------------------------------------------------------

test("WorkflowStateMachine: allows paused -> resuming", () => {
  const machine = createWorkflowStateMachine();
  machine.assertTransition("paused", "resuming");
});

test("WorkflowStateMachine: allows paused -> failed", () => {
  const machine = createWorkflowStateMachine();
  machine.assertTransition("paused", "failed");
});

test("WorkflowStateMachine: allows paused -> cancelled", () => {
  const machine = createWorkflowStateMachine();
  machine.assertTransition("paused", "cancelled");
});

// ---------------------------------------------------------------------------
// Valid transitions from resuming
// ---------------------------------------------------------------------------

test("WorkflowStateMachine: allows resuming -> running", () => {
  const machine = createWorkflowStateMachine();
  machine.assertTransition("resuming", "running");
});

test("WorkflowStateMachine: allows resuming -> failed", () => {
  const machine = createWorkflowStateMachine();
  machine.assertTransition("resuming", "failed");
});

test("WorkflowStateMachine: allows resuming -> cancelled", () => {
  const machine = createWorkflowStateMachine();
  machine.assertTransition("resuming", "cancelled");
});

// ---------------------------------------------------------------------------
// Valid transitions from cancelling
// ---------------------------------------------------------------------------

test("WorkflowStateMachine: allows cancelling -> cancelled", () => {
  const machine = createWorkflowStateMachine();
  machine.assertTransition("cancelling", "cancelled");
});

// ---------------------------------------------------------------------------
// Invalid transitions from running
// ---------------------------------------------------------------------------

test("WorkflowStateMachine: rejects running -> resuming", () => {
  const machine = createWorkflowStateMachine();
  assert.throws(
    () => machine.assertTransition("running", "resuming"),
    WorkflowStateError,
  );
});

test("WorkflowStateMachine: rejects running -> open (non-existent)", () => {
  const machine = createWorkflowStateMachine();
  assert.throws(
    () => machine.assertTransition("running", "open"),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// Invalid transitions from paused
// ---------------------------------------------------------------------------

test("WorkflowStateMachine: rejects paused -> running", () => {
  const machine = createWorkflowStateMachine();
  assert.throws(
    () => machine.assertTransition("paused", "running"),
    WorkflowStateError,
  );
});

test("WorkflowStateMachine: rejects paused -> completed", () => {
  const machine = createWorkflowStateMachine();
  assert.throws(
    () => machine.assertTransition("paused", "completed"),
    WorkflowStateError,
  );
});

test("WorkflowStateMachine: rejects paused -> cancelling", () => {
  const machine = createWorkflowStateMachine();
  assert.throws(
    () => machine.assertTransition("paused", "cancelling"),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// Invalid transitions from resuming
// ---------------------------------------------------------------------------

test("WorkflowStateMachine: rejects resuming -> paused", () => {
  const machine = createWorkflowStateMachine();
  assert.throws(
    () => machine.assertTransition("resuming", "paused"),
    WorkflowStateError,
  );
});

test("WorkflowStateMachine: rejects resuming -> completed", () => {
  const machine = createWorkflowStateMachine();
  assert.throws(
    () => machine.assertTransition("resuming", "completed"),
    WorkflowStateError,
  );
});

test("WorkflowStateMachine: rejects resuming -> cancelling", () => {
  const machine = createWorkflowStateMachine();
  assert.throws(
    () => machine.assertTransition("resuming", "cancelling"),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// Terminal state transitions
// ---------------------------------------------------------------------------

test("WorkflowStateMachine: rejects transitions from completed", () => {
  const machine = createWorkflowStateMachine();
  const validTargets = ["running", "paused", "resuming", "failed", "cancelling", "cancelled"];

  for (const target of validTargets) {
    assert.throws(
      () => machine.assertTransition("completed", target),
      WorkflowStateError,
      `Expected completed -> ${target} to be rejected`,
    );
  }
});

test("WorkflowStateMachine: rejects transitions from failed", () => {
  const machine = createWorkflowStateMachine();
  const validTargets = ["running", "paused", "resuming", "completed", "cancelling", "cancelled"];

  for (const target of validTargets) {
    assert.throws(
      () => machine.assertTransition("failed", target),
      WorkflowStateError,
      `Expected failed -> ${target} to be rejected`,
    );
  }
});

test("WorkflowStateMachine: rejects transitions from cancelled", () => {
  const machine = createWorkflowStateMachine();
  const validTargets = ["running", "paused", "resuming", "completed", "failed", "cancelling"];

  for (const target of validTargets) {
    assert.throws(
      () => machine.assertTransition("cancelled", target),
      WorkflowStateError,
      `Expected cancelled -> ${target} to be rejected`,
    );
  }
});

// ---------------------------------------------------------------------------
// No-op transitions
// ---------------------------------------------------------------------------

test("WorkflowStateMachine: allows no-op transition on same state", () => {
  const machine = createWorkflowStateMachine();
  const states = ["running", "paused", "resuming", "completed", "failed", "cancelling", "cancelled"];

  for (const state of states) {
    machine.assertTransition(state, state);
  }
});

// ---------------------------------------------------------------------------
// Error details
// ---------------------------------------------------------------------------

test("WorkflowStateMachine: WorkflowStateError contains correct entityKind", () => {
  const machine = createWorkflowStateMachine();

  try {
    machine.assertTransition("running", "resuming");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError & { details?: { entityKind: string; current: string; next: string } };
    assert.equal(error.details?.entityKind, "workflow");
    assert.equal(error.details?.current, "running");
    assert.equal(error.details?.next, "resuming");
  }
});

test("WorkflowStateMachine: WorkflowStateError has statusCode 409", () => {
  const machine = createWorkflowStateMachine();

  try {
    machine.assertTransition("paused", "running");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError;
    assert.equal(error.statusCode, 409);
  }
});

test("WorkflowStateMachine: WorkflowStateError is not retryable", () => {
  const machine = createWorkflowStateMachine();

  try {
    machine.assertTransition("paused", "running");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError;
    assert.equal(error.retryable, false);
  }
});

// ---------------------------------------------------------------------------
// Error message format
// ---------------------------------------------------------------------------

test("WorkflowStateMachine: error message contains invalid_transition code", () => {
  const machine = createWorkflowStateMachine();

  try {
    machine.assertTransition("completed", "running");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    assert.ok(err.message.includes("workflow.invalid_transition"));
  }
});

// ---------------------------------------------------------------------------
// Cancellation flow
// ---------------------------------------------------------------------------

test("WorkflowStateMachine: supports graceful cancellation flow (running -> cancelling -> cancelled)", () => {
  const machine = createWorkflowStateMachine();

  // running -> cancelling is valid
  machine.assertTransition("running", "cancelling");

  // cancelling -> cancelled is valid
  machine.assertTransition("cancelling", "cancelled");
});

test("WorkflowStateMachine: supports immediate cancellation (running -> cancelled)", () => {
  const machine = createWorkflowStateMachine();
  machine.assertTransition("running", "cancelled");
});

// ---------------------------------------------------------------------------
// Pause/Resume cycle
// ---------------------------------------------------------------------------

test("WorkflowStateMachine: supports pause/resume cycle (running -> paused -> resuming -> running)", () => {
  const machine = createWorkflowStateMachine();

  machine.assertTransition("running", "paused");
  machine.assertTransition("paused", "resuming");
  machine.assertTransition("resuming", "running");
});
