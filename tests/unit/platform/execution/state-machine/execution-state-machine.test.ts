import assert from "node:assert/strict";
import test from "node:test";

import { StateTransitionMachine } from "../../../../../src/platform/execution/state-transition/state-transition-machine.js";
import { WorkflowStateError } from "../../../../../src/platform/contracts/errors.js";

/**
 * ExecutionStateMachine tests
 *
 * Tests the state machine that governs execution lifecycle transitions.
 * Executions represent individual work attempts with 15 states (R9-04):
 * - created: initial state when execution is initialized
 * - queued: waiting to be dispatched
 * - dispatching: being assigned to a worker
 * - prechecking: validating resources and preconditions
 * - ready: resources allocated, waiting to start
 * - executing: actual work being performed
 * - paused: execution paused
 * - resuming: resuming from pause
 * - recovering: recovering from a failure
 * - timed_out: execution timed out
 * - blocked: awaiting approval or external input
 * - succeeded/failed/cancelled/superseded: terminal states
 *
 * @see EXECUTION_TRANSITIONS in transition-service.ts for authoritative transition map
 * @see R9-04 for state transition requirements
 */

// ---------------------------------------------------------------------------
// Execution transitions map matching transition-service.ts (15 states)
// ---------------------------------------------------------------------------

const EXECUTION_TRANSITIONS: Record<string, readonly string[]> = {
  created: ["queued", "prechecking", "executing", "dispatching", "ready", "cancelled", "failed"],
  queued: ["dispatching", "prechecking", "executing", "cancelled", "failed"],
  dispatching: ["prechecking", "executing", "paused", "recovering", "cancelled", "failed"],
  prechecking: ["executing", "blocked", "paused", "recovering", "cancelled", "failed"],
  executing: ["blocked", "succeeded", "failed", "cancelled", "paused", "recovering"],
  paused: ["resuming", "recovering", "timed_out", "failed", "cancelled"],
  resuming: ["executing", "failed", "cancelled"],
  ready: ["executing", "failed", "cancelled"],
  recovering: ["ready", "executing", "failed", "cancelled", "timed_out"],
  timed_out: ["resuming", "failed", "cancelled"],
  blocked: ["prechecking", "executing", "cancelled", "failed", "superseded"],
  succeeded: [],
  failed: [],
  cancelled: [],
  superseded: [],
};

// All 15 execution states
const ALL_EXECUTION_STATES = [
  "created",
  "queued",
  "dispatching",
  "prechecking",
  "ready",
  "executing",
  "paused",
  "resuming",
  "recovering",
  "timed_out",
  "blocked",
  "succeeded",
  "failed",
  "cancelled",
  "superseded",
] as const;

// Terminal states - these have no outgoing transitions
const TERMINAL_STATES = ["succeeded", "failed", "cancelled", "superseded"] as const;

function createExecutionStateMachine(): StateTransitionMachine<string> {
  return new StateTransitionMachine("execution", EXECUTION_TRANSITIONS);
}

// ---------------------------------------------------------------------------
// Test: assertTransition allows valid execution state transitions
// ---------------------------------------------------------------------------

test("assertTransition allows valid transitions from created", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("created", "queued");
  machine.assertTransition("created", "prechecking");
  machine.assertTransition("created", "executing");
  machine.assertTransition("created", "dispatching");
  machine.assertTransition("created", "cancelled");
  machine.assertTransition("created", "failed");
});

test("assertTransition allows valid transitions from queued", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("queued", "dispatching");
  machine.assertTransition("queued", "prechecking");
  machine.assertTransition("queued", "executing");
  machine.assertTransition("queued", "cancelled");
  machine.assertTransition("queued", "failed");
});

test("assertTransition allows valid transitions from dispatching", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("dispatching", "prechecking");
  machine.assertTransition("dispatching", "executing");
  machine.assertTransition("dispatching", "paused");
  machine.assertTransition("dispatching", "recovering");
  machine.assertTransition("dispatching", "cancelled");
  machine.assertTransition("dispatching", "failed");
});

test("assertTransition allows valid transitions from prechecking", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("prechecking", "executing");
  machine.assertTransition("prechecking", "blocked");
  machine.assertTransition("prechecking", "paused");
  machine.assertTransition("prechecking", "recovering");
  machine.assertTransition("prechecking", "cancelled");
  machine.assertTransition("prechecking", "failed");
});

test("assertTransition allows valid transitions from executing", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("executing", "blocked");
  machine.assertTransition("executing", "succeeded");
  machine.assertTransition("executing", "failed");
  machine.assertTransition("executing", "cancelled");
  machine.assertTransition("executing", "paused");
  machine.assertTransition("executing", "recovering");
});

test("assertTransition allows valid transitions from paused", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("paused", "resuming");
  machine.assertTransition("paused", "recovering");
  machine.assertTransition("paused", "timed_out");
  machine.assertTransition("paused", "failed");
  machine.assertTransition("paused", "cancelled");
});

test("assertTransition allows valid transitions from recovering", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("recovering", "ready");
  machine.assertTransition("recovering", "executing");
  machine.assertTransition("recovering", "failed");
  machine.assertTransition("recovering", "cancelled");
  machine.assertTransition("recovering", "timed_out");
});

test("assertTransition allows valid transitions from timed_out", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("timed_out", "resuming");
  machine.assertTransition("timed_out", "failed");
  machine.assertTransition("timed_out", "cancelled");
});

test("assertTransition allows valid transitions from resuming", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("resuming", "executing");
  machine.assertTransition("resuming", "failed");
  machine.assertTransition("resuming", "cancelled");
});

test("assertTransition allows valid transitions from ready", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("ready", "executing");
  machine.assertTransition("ready", "failed");
  machine.assertTransition("ready", "cancelled");
});

test("assertTransition allows valid transitions from blocked", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("blocked", "prechecking");
  machine.assertTransition("blocked", "executing");
  machine.assertTransition("blocked", "cancelled");
  machine.assertTransition("blocked", "failed");
  machine.assertTransition("blocked", "superseded");
});

// ---------------------------------------------------------------------------
// Test: assertTransition rejects invalid transitions for all 15 states (R9-04)
// ---------------------------------------------------------------------------

test("assertTransition rejects invalid transitions from created", () => {
  const machine = createExecutionStateMachine();
  assert.throws(() => machine.assertTransition("created", "succeeded"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("created", "blocked"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("created", "paused"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("created", "recovering"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("created", "timed_out"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("created", "resuming"), WorkflowStateError);
  // Note: created -> ready is valid (ready is a pre-execution state)
});

test("assertTransition rejects invalid transitions from queued", () => {
  const machine = createExecutionStateMachine();
  assert.throws(() => machine.assertTransition("queued", "succeeded"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("queued", "blocked"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("queued", "created"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("queued", "paused"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("queued", "recovering"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("queued", "timed_out"), WorkflowStateError);
});

test("assertTransition rejects invalid transitions from dispatching", () => {
  const machine = createExecutionStateMachine();
  assert.throws(() => machine.assertTransition("dispatching", "succeeded"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("dispatching", "blocked"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("dispatching", "queued"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("dispatching", "ready"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("dispatching", "resuming"), WorkflowStateError);
});

test("assertTransition rejects invalid transitions from prechecking", () => {
  const machine = createExecutionStateMachine();
  assert.throws(() => machine.assertTransition("prechecking", "succeeded"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("prechecking", "queued"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("prechecking", "dispatching"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("prechecking", "ready"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("prechecking", "resuming"), WorkflowStateError);
});

test("assertTransition rejects invalid transitions from executing", () => {
  const machine = createExecutionStateMachine();
  assert.throws(() => machine.assertTransition("executing", "queued"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("executing", "prechecking"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("executing", "dispatching"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("executing", "ready"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("executing", "resuming"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("executing", "timed_out"), WorkflowStateError);
});

test("assertTransition rejects invalid transitions from paused", () => {
  const machine = createExecutionStateMachine();
  assert.throws(() => machine.assertTransition("paused", "executing"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("paused", "prechecking"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("paused", "succeeded"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("paused", "blocked"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("paused", "queued"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("paused", "dispatching"), WorkflowStateError);
});

test("assertTransition rejects invalid transitions from recovering", () => {
  const machine = createExecutionStateMachine();
  assert.throws(() => machine.assertTransition("recovering", "succeeded"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("recovering", "blocked"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("recovering", "paused"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("recovering", "queued"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("recovering", "dispatching"), WorkflowStateError);
  // Note: recovering -> ready is valid (ready is a pre-execution state)
});

test("assertTransition rejects invalid transitions from timed_out", () => {
  const machine = createExecutionStateMachine();
  assert.throws(() => machine.assertTransition("timed_out", "executing"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("timed_out", "succeeded"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("timed_out", "blocked"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("timed_out", "paused"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("timed_out", "prechecking"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("timed_out", "ready"), WorkflowStateError);
});

test("assertTransition rejects invalid transitions from resuming", () => {
  const machine = createExecutionStateMachine();
  assert.throws(() => machine.assertTransition("resuming", "succeeded"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("resuming", "blocked"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("resuming", "paused"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("resuming", "queued"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("resuming", "dispatching"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("resuming", "prechecking"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("resuming", "ready"), WorkflowStateError);
});

test("assertTransition rejects invalid transitions from ready", () => {
  const machine = createExecutionStateMachine();
  assert.throws(() => machine.assertTransition("ready", "succeeded"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("ready", "blocked"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("ready", "paused"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("ready", "queued"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("ready", "dispatching"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("ready", "prechecking"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("ready", "resuming"), WorkflowStateError);
});

test("assertTransition rejects invalid transitions from blocked", () => {
  const machine = createExecutionStateMachine();
  assert.throws(() => machine.assertTransition("blocked", "paused"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("blocked", "succeeded"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("blocked", "recovering"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("blocked", "timed_out"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("blocked", "queued"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("blocked", "dispatching"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("blocked", "resuming"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("blocked", "ready"), WorkflowStateError);
});

// ---------------------------------------------------------------------------
// Test: Terminal states have no outgoing transitions
// ---------------------------------------------------------------------------

test("terminal states have no outgoing transitions - succeeded", () => {
  const machine = createExecutionStateMachine();
  for (const state of ALL_EXECUTION_STATES) {
    assert.throws(
      () => machine.assertTransition("succeeded", state as string),
      WorkflowStateError,
      `succeeded -> ${state} should be rejected`,
    );
  }
});

test("terminal states have no outgoing transitions - failed", () => {
  const machine = createExecutionStateMachine();
  for (const state of ALL_EXECUTION_STATES) {
    assert.throws(
      () => machine.assertTransition("failed", state as string),
      WorkflowStateError,
      `failed -> ${state} should be rejected`,
    );
  }
});

test("terminal states have no outgoing transitions - cancelled", () => {
  const machine = createExecutionStateMachine();
  for (const state of ALL_EXECUTION_STATES) {
    assert.throws(
      () => machine.assertTransition("cancelled", state as string),
      WorkflowStateError,
      `cancelled -> ${state} should be rejected`,
    );
  }
});

test("terminal states have no outgoing transitions - superseded", () => {
  const machine = createExecutionStateMachine();
  for (const state of ALL_EXECUTION_STATES) {
    assert.throws(
      () => machine.assertTransition("superseded", state as string),
      WorkflowStateError,
      `superseded -> ${state} should be rejected`,
    );
  }
});

test("all terminal states verified as truly terminal", () => {
  const machine = createExecutionStateMachine();
  for (const terminalState of TERMINAL_STATES) {
    // Each terminal state should have an empty transitions list
    assert.deepStrictEqual(EXECUTION_TRANSITIONS[terminalState], []);
    // And attempting any transition should throw
    assert.throws(
      () => machine.assertTransition(terminalState, "created"),
      WorkflowStateError,
      `${terminalState} should be terminal with no outgoing transitions`,
    );
  }
});

// ---------------------------------------------------------------------------
// Test: Transition from executing to blocked and back works correctly
// ---------------------------------------------------------------------------

test("transition from executing to blocked works", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("executing", "blocked");
});

test("transition from blocked to executing works", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("blocked", "executing");
});

test("executing to blocked to executing round-trip works", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("executing", "blocked");
  machine.assertTransition("blocked", "executing");
});

test("executing can also transition to other states from blocked", () => {
  const machine = createExecutionStateMachine();
  // From blocked, can go to prechecking
  machine.assertTransition("blocked", "prechecking");
  // Then continue to executing
  machine.assertTransition("prechecking", "executing");
});

test("executing to blocked then to failed works", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("executing", "blocked");
  machine.assertTransition("blocked", "failed");
});

test("executing to blocked then to cancelled works", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("executing", "blocked");
  machine.assertTransition("blocked", "cancelled");
});

test("executing to blocked then to superseded works", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("executing", "blocked");
  machine.assertTransition("blocked", "superseded");
});

// ---------------------------------------------------------------------------
// Test: No-op transitions are rejected
// ---------------------------------------------------------------------------

test("assertTransition rejects no-op transition for executing", () => {
  const machine = createExecutionStateMachine();
  assert.throws(() => machine.assertTransition("executing", "executing"), WorkflowStateError);
});

test("assertTransition rejects no-op transition for all states including terminal", () => {
  const machine = createExecutionStateMachine();
  for (const state of ALL_EXECUTION_STATES) {
    assert.throws(
      () => machine.assertTransition(state as string, state as string),
      WorkflowStateError,
      `No-op transition should be rejected for ${state}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Test: Error details contain correct information
// ---------------------------------------------------------------------------

test("WorkflowStateError contains correct entityKind for execution", () => {
  const machine = createExecutionStateMachine();
  try {
    machine.assertTransition("executing", "invalid_state");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError & { details?: { entityKind: string; current: string; next: string } };
    assert.equal(error.details?.entityKind, "execution");
    assert.equal(error.details?.current, "executing");
    assert.equal(error.details?.next, "invalid_state");
  }
});

test("WorkflowStateError has correct error code format", () => {
  const machine = createExecutionStateMachine();
  try {
    machine.assertTransition("executing", "unknown");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    assert.ok(err.message.includes("execution.invalid_transition"));
  }
});

test("WorkflowStateError for no-op has correct error code", () => {
  const machine = createExecutionStateMachine();
  try {
    machine.assertTransition("executing", "executing");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    assert.ok(err.message.includes("noop_transition_denied"));
  }
});

// ---------------------------------------------------------------------------
// Test: WorkflowStateError properties
// ---------------------------------------------------------------------------

test("WorkflowStateError is not retryable", () => {
  const machine = createExecutionStateMachine();
  try {
    machine.assertTransition("executing", "invalid");
    assert.fail("Expected error");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError;
    assert.equal(error.retryable, false);
  }
});

test("WorkflowStateError has statusCode 409 (Conflict)", () => {
  const machine = createExecutionStateMachine();
  try {
    machine.assertTransition("executing", "invalid");
    assert.fail("Expected error");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError;
    assert.equal(error.statusCode, 409);
  }
});

// ---------------------------------------------------------------------------
// Test: Unknown source state throws error
// ---------------------------------------------------------------------------

test("assertTransition rejects unknown source state", () => {
  const machine = createExecutionStateMachine();
  assert.throws(() => machine.assertTransition("unknown_state", "executing"), WorkflowStateError);
});
