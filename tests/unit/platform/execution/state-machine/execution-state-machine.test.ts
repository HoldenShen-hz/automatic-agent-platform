import assert from "node:assert/strict";
import test from "node:test";

import { StateTransitionMachine } from "../../../../../src/platform/five-plane-execution/state-transition/state-transition-machine.js";
import { WorkflowStateError } from "../../../../../src/platform/contracts/errors.js";

/**
 * ExecutionStateMachine tests
 *
 * Tests the state machine that governs execution lifecycle transitions.
 * Executions represent individual work attempts with states:
 * - created: initial state when execution is initialized
 * - prechecking: validating resources and preconditions
 * - executing: actual work being performed
 * - blocked: awaiting approval or external input
 * - succeeded/failed/cancelled/superseded: terminal states
 */

// Transition map matching EXECUTION_TRANSITIONS from transition-service.ts
const EXECUTION_TRANSITIONS: Record<string, readonly string[]> = {
  created: ["prechecking", "executing", "cancelled", "failed"],
  prechecking: ["executing", "blocked", "cancelled", "failed"],
  executing: ["blocked", "succeeded", "failed", "cancelled"],
  blocked: ["prechecking", "executing", "cancelled", "failed", "superseded"],
  succeeded: [],
  failed: [],
  cancelled: [],
  superseded: [],
};

function createExecutionStateMachine(): StateTransitionMachine<string> {
  return new StateTransitionMachine("execution", EXECUTION_TRANSITIONS);
}

// ---------------------------------------------------------------------------
// Valid transitions
// ---------------------------------------------------------------------------

test("ExecutionStateMachine: allows created -> prechecking [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("created", "prechecking");
});

test("ExecutionStateMachine: allows created -> executing [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("created", "executing");
});

test("ExecutionStateMachine: allows created -> cancelled [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("created", "cancelled");
});

test("ExecutionStateMachine: allows created -> failed [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("created", "failed");
});

test("ExecutionStateMachine: allows prechecking -> executing [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("prechecking", "executing");
});

test("ExecutionStateMachine: allows prechecking -> blocked [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("prechecking", "blocked");
});

test("ExecutionStateMachine: allows prechecking -> cancelled [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("prechecking", "cancelled");
});

test("ExecutionStateMachine: allows prechecking -> failed [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("prechecking", "failed");
});

test("ExecutionStateMachine: allows executing -> blocked [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("executing", "blocked");
});

test("ExecutionStateMachine: allows executing -> succeeded [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("executing", "succeeded");
});

test("ExecutionStateMachine: allows executing -> failed [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("executing", "failed");
});

test("ExecutionStateMachine: allows executing -> cancelled [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("executing", "cancelled");
});

test("ExecutionStateMachine: allows blocked -> prechecking [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("blocked", "prechecking");
});

test("ExecutionStateMachine: allows blocked -> executing [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("blocked", "executing");
});

test("ExecutionStateMachine: allows blocked -> cancelled [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("blocked", "cancelled");
});

test("ExecutionStateMachine: allows blocked -> failed [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("blocked", "failed");
});

test("ExecutionStateMachine: allows blocked -> superseded [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  machine.assertTransition("blocked", "superseded");
});

// ---------------------------------------------------------------------------
// Invalid transitions
// ---------------------------------------------------------------------------

test("ExecutionStateMachine: rejects created -> succeeded [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  assert.throws(
    () => machine.assertTransition("created", "succeeded"),
    WorkflowStateError,
  );
});

test("ExecutionStateMachine: rejects created -> blocked [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  assert.throws(
    () => machine.assertTransition("created", "blocked"),
    WorkflowStateError,
  );
});

test("ExecutionStateMachine: rejects created -> superseded [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  assert.throws(
    () => machine.assertTransition("created", "superseded"),
    WorkflowStateError,
  );
});

test("ExecutionStateMachine: rejects prechecking -> succeeded [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  assert.throws(
    () => machine.assertTransition("prechecking", "succeeded"),
    WorkflowStateError,
  );
});

test("ExecutionStateMachine: rejects executing -> prechecking [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  assert.throws(
    () => machine.assertTransition("executing", "prechecking"),
    WorkflowStateError,
  );
});

test("ExecutionStateMachine: rejects blocked -> succeeded [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  assert.throws(
    () => machine.assertTransition("blocked", "succeeded"),
    WorkflowStateError,
  );
});

test("ExecutionStateMachine: rejects any transition from terminal states [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  const terminalStates = ["succeeded", "failed", "cancelled", "superseded"];

  for (const terminal of terminalStates) {
    for (const target of ["created", "prechecking", "executing", "blocked"]) {
      assert.throws(
        () => machine.assertTransition(terminal, target),
        WorkflowStateError,
        `Expected ${terminal} -> ${target} to be rejected`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// No-op transitions
// ---------------------------------------------------------------------------

test("ExecutionStateMachine: allows no-op transition on same state [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();
  const states = ["created", "prechecking", "executing", "blocked", "succeeded", "failed", "cancelled", "superseded"];

  for (const state of states) {
    machine.assertTransition(state, state);
  }
});

// ---------------------------------------------------------------------------
// Error details
// ---------------------------------------------------------------------------

test("ExecutionStateMachine: WorkflowStateError contains correct entityKind [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();

  try {
    machine.assertTransition("created", "succeeded");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError & { details?: { entityKind: string; current: string; next: string } };
    assert.equal(error.details?.entityKind, "execution");
    assert.equal(error.details?.current, "created");
    assert.equal(error.details?.next, "succeeded");
  }
});

test("ExecutionStateMachine: WorkflowStateError has statusCode 409 [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();

  try {
    machine.assertTransition("created", "succeeded");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError;
    assert.equal(error.statusCode, 409);
  }
});

test("ExecutionStateMachine: WorkflowStateError is not retryable [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();

  try {
    machine.assertTransition("created", "succeeded");
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

test("ExecutionStateMachine: error message contains invalid_transition code [execution-state-machine]", () => {
  const machine = createExecutionStateMachine();

  try {
    machine.assertTransition("created", "invalid");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    assert.ok(err.message.includes("execution.invalid_transition"));
  }
});
