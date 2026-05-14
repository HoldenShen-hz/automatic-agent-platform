import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowStateError } from "../../../../../src/platform/contracts/errors.js";
import { StateTransitionMachine } from "../../../../../src/platform/execution/state-transition/state-transition-machine.js";

/**
 * SessionStateMachine tests
 *
 * Tests the state machine that governs session lifecycle transitions.
 * Sessions represent streaming interactions with states:
 * - created: initial state when session is created
 * - streaming: session is actively streaming response
 * - paused: session is paused (e.g., awaiting user input)
 * - completed: session completed normally
 * - failed: session encountered an error
 * - cancelled: session was cancelled
 */

// Transition map for session states
const SESSION_TRANSITIONS: Record<string, readonly string[]> = {
  created: ["streaming", "cancelled"],
  streaming: ["paused", "completed", "failed", "cancelled"],
  paused: ["streaming", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

function createSessionStateMachine(): StateTransitionMachine<string> {
  return new StateTransitionMachine("session", SESSION_TRANSITIONS);
}

// ---------------------------------------------------------------------------
// Valid transitions
// ---------------------------------------------------------------------------

test("SessionStateMachine: allows valid transition from created to streaming", () => {
  const machine = createSessionStateMachine();
  machine.assertTransition("created", "streaming");
});

test("SessionStateMachine: allows valid transition from streaming to completed", () => {
  const machine = createSessionStateMachine();
  machine.assertTransition("streaming", "completed");
});

test("SessionStateMachine: allows valid transition from streaming to paused", () => {
  const machine = createSessionStateMachine();
  machine.assertTransition("streaming", "paused");
});

test("SessionStateMachine: allows valid transition from paused to streaming", () => {
  const machine = createSessionStateMachine();
  machine.assertTransition("paused", "streaming");
});

test("SessionStateMachine: allows valid transition from streaming to failed", () => {
  const machine = createSessionStateMachine();
  machine.assertTransition("streaming", "failed");
});

test("SessionStateMachine: allows valid transition from created to cancelled", () => {
  const machine = createSessionStateMachine();
  machine.assertTransition("created", "cancelled");
});

test("SessionStateMachine: allows valid transition from paused to cancelled", () => {
  const machine = createSessionStateMachine();
  machine.assertTransition("paused", "cancelled");
});

// ---------------------------------------------------------------------------
// Invalid transitions
// ---------------------------------------------------------------------------

test("SessionStateMachine: rejects invalid transition from completed to streaming", () => {
  const machine = createSessionStateMachine();
  assert.throws(
    () => machine.assertTransition("completed", "streaming"),
    WorkflowStateError,
  );
});

test("SessionStateMachine: rejects invalid transition from failed to completed", () => {
  const machine = createSessionStateMachine();
  assert.throws(
    () => machine.assertTransition("failed", "completed"),
    WorkflowStateError,
  );
});

test("SessionStateMachine: rejects invalid transition from created to completed", () => {
  const machine = createSessionStateMachine();
  assert.throws(
    () => machine.assertTransition("created", "completed"),
    WorkflowStateError,
  );
});

test("SessionStateMachine: rejects invalid transition from paused to created", () => {
  const machine = createSessionStateMachine();
  assert.throws(
    () => machine.assertTransition("paused", "created"),
    WorkflowStateError,
  );
});

test("SessionStateMachine: rejects invalid transition from completed to failed", () => {
  const machine = createSessionStateMachine();
  assert.throws(
    () => machine.assertTransition("completed", "failed"),
    WorkflowStateError,
  );
});

test("SessionStateMachine: rejects invalid transition from cancelled to streaming", () => {
  const machine = createSessionStateMachine();
  assert.throws(
    () => machine.assertTransition("cancelled", "streaming"),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// No-op transitions are idempotent and allowed by the generic transition machine.
// ---------------------------------------------------------------------------

test("SessionStateMachine: allows no-op transition on streaming", () => {
  const machine = createSessionStateMachine();
  machine.assertTransition("streaming", "streaming");
});

test("SessionStateMachine: allows no-op transition on completed", () => {
  const machine = createSessionStateMachine();
  machine.assertTransition("completed", "completed");
});

test("SessionStateMachine: allows no-op transition on failed", () => {
  const machine = createSessionStateMachine();
  machine.assertTransition("failed", "failed");
});

test("SessionStateMachine: allows no-op transition on cancelled", () => {
  const machine = createSessionStateMachine();
  machine.assertTransition("cancelled", "cancelled");
});

// ---------------------------------------------------------------------------
// Terminal states have no outgoing transitions
// ---------------------------------------------------------------------------

test("SessionStateMachine: terminal state completed has no outgoing transitions", () => {
  const machine = createSessionStateMachine();
  const nonTerminalStates = ["created", "streaming", "paused", "failed", "cancelled"];

  for (const target of nonTerminalStates) {
    assert.throws(
      () => machine.assertTransition("completed", target),
      WorkflowStateError,
      `Expected completed -> ${target} to be rejected`,
    );
  }
});

test("SessionStateMachine: terminal state failed has no outgoing transitions", () => {
  const machine = createSessionStateMachine();
  const nonTerminalStates = ["created", "streaming", "paused", "completed", "cancelled"];

  for (const target of nonTerminalStates) {
    assert.throws(
      () => machine.assertTransition("failed", target),
      WorkflowStateError,
      `Expected failed -> ${target} to be rejected`,
    );
  }
});

test("SessionStateMachine: terminal state cancelled has no outgoing transitions", () => {
  const machine = createSessionStateMachine();
  const nonTerminalStates = ["created", "streaming", "paused", "completed", "failed"];

  for (const target of nonTerminalStates) {
    assert.throws(
      () => machine.assertTransition("cancelled", target),
      WorkflowStateError,
      `Expected cancelled -> ${target} to be rejected`,
    );
  }
});

test("SessionStateMachine: all terminal states together cannot transition to any other state", () => {
  const machine = createSessionStateMachine();
  const terminalStates = ["completed", "failed", "cancelled"];
  const allStates = ["created", "streaming", "paused", "completed", "failed", "cancelled"];

  for (const terminal of terminalStates) {
    for (const target of allStates) {
      if (terminal !== target) {
        assert.throws(
          () => machine.assertTransition(terminal, target),
          WorkflowStateError,
          `Expected ${terminal} -> ${target} to be rejected`,
        );
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Streaming to completed transition works correctly
// ---------------------------------------------------------------------------

test("SessionStateMachine: streaming to completed is valid terminal transition", () => {
  const machine = createSessionStateMachine();
  machine.assertTransition("streaming", "completed");
});

test("SessionStateMachine: streaming to completed is the normal termination path", () => {
  const machine = createSessionStateMachine();

  // This is a valid transition
  machine.assertTransition("streaming", "completed");

  // But completed is terminal - cannot go back to streaming
  assert.throws(
    () => machine.assertTransition("completed", "streaming"),
    WorkflowStateError,
  );
});

test("SessionStateMachine: streaming can also fail or be cancelled", () => {
  const machine = createSessionStateMachine();

  // These are all valid terminal paths from streaming
  machine.assertTransition("streaming", "failed");
  machine.assertTransition("streaming", "cancelled");
});

// ---------------------------------------------------------------------------
// Error details
// ---------------------------------------------------------------------------

test("SessionStateMachine: WorkflowStateError contains correct entityKind", () => {
  const machine = createSessionStateMachine();

  try {
    machine.assertTransition("completed", "streaming");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError & { details?: { entityKind: string; current: string; next: string } };
    assert.equal(error.details?.entityKind, "session");
    assert.equal(error.details?.current, "completed");
    assert.equal(error.details?.next, "streaming");
  }
});

test("SessionStateMachine: no-op transition does not throw WorkflowStateError", () => {
  const machine = createSessionStateMachine();
  machine.assertTransition("streaming", "streaming");
});

test("SessionStateMachine: WorkflowStateError has statusCode 409", () => {
  const machine = createSessionStateMachine();

  try {
    machine.assertTransition("completed", "streaming");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError;
    assert.equal(error.statusCode, 409);
  }
});

test("SessionStateMachine: WorkflowStateError is not retryable", () => {
  const machine = createSessionStateMachine();

  try {
    machine.assertTransition("completed", "streaming");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError;
    assert.equal(error.retryable, false);
  }
});

test("SessionStateMachine: WorkflowStateError category is workflow", () => {
  const machine = createSessionStateMachine();

  try {
    machine.assertTransition("completed", "streaming");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError;
    assert.equal(error.category, "workflow");
  }
});

test("SessionStateMachine: WorkflowStateError source is workflow", () => {
  const machine = createSessionStateMachine();

  try {
    machine.assertTransition("completed", "streaming");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError;
    assert.equal(error.source, "workflow");
  }
});

// ---------------------------------------------------------------------------
// Error message format
// ---------------------------------------------------------------------------

test("SessionStateMachine: invalid transition error message contains invalid_transition code", () => {
  const machine = createSessionStateMachine();

  try {
    machine.assertTransition("completed", "streaming");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    assert.ok(err.message.includes("session.invalid_transition"));
  }
});

test("SessionStateMachine: noop transition is accepted as idempotent", () => {
  const machine = createSessionStateMachine();
  machine.assertTransition("streaming", "streaming");
});

// ---------------------------------------------------------------------------
// Unknown source state
// ---------------------------------------------------------------------------

test("SessionStateMachine: rejects unknown source state", () => {
  const machine = createSessionStateMachine();

  assert.throws(
    () => machine.assertTransition("unknown_status", "streaming"),
    WorkflowStateError,
  );
});

test("SessionStateMachine: rejects unknown target state from valid source", () => {
  const machine = createSessionStateMachine();

  assert.throws(
    () => machine.assertTransition("streaming", "unknown_status"),
    WorkflowStateError,
  );
});
