/**
 * State Transition Machine Unit Tests
 *
 * Tests for the generic StateTransitionMachine class that validates
 * entity state transitions against an allowed transition map.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowStateError } from "../../../../src/platform/contracts/errors.js";
import { StateTransitionMachine } from "../../../../src/platform/execution/state-transition/state-transition-machine.js";

// ---------------------------------------------------------------------------
// StateTransitionMachine Tests
// ---------------------------------------------------------------------------

test("StateTransitionMachine: accepts valid transitions", () => {
  const transitions: Record<string, readonly string[]> = {
    pending: ["in_progress", "done", "failed"],
    in_progress: ["done", "failed", "cancelled"],
    done: [],
    failed: [],
    cancelled: [],
  };

  const machine = new StateTransitionMachine("task", transitions);

  // Valid transitions should not throw
  machine.assertTransition("pending", "in_progress");
  machine.assertTransition("pending", "done");
  machine.assertTransition("pending", "failed");
  machine.assertTransition("in_progress", "done");
  machine.assertTransition("in_progress", "failed");
  machine.assertTransition("in_progress", "cancelled");
});

test("StateTransitionMachine: rejects invalid transitions", () => {
  const transitions: Record<string, readonly string[]> = {
    pending: ["in_progress", "done", "failed"],
    in_progress: ["done", "failed", "cancelled"],
    done: [],
    failed: [],
    cancelled: [],
  };

  const machine = new StateTransitionMachine("task", transitions);

  // Invalid transitions should throw WorkflowStateError
  assert.throws(
    () => machine.assertTransition("done", "in_progress"),
    WorkflowStateError,
    "Should reject transition from terminal state"
  );

  assert.throws(
    () => machine.assertTransition("pending", "cancelled"),
    WorkflowStateError,
    "Should reject pending -> cancelled (not in allowed list)"
  );

  assert.throws(
    () => machine.assertTransition("failed", "done"),
    WorkflowStateError,
    "Should reject transition from failed state"
  );
});

test("StateTransitionMachine: allows no-op transitions", () => {
  const transitions: Record<string, readonly string[]> = {
    pending: ["in_progress"],
    in_progress: ["done"],
    done: [],
  };

  const machine = new StateTransitionMachine("task", transitions);

  // No-op transitions (same state) are allowed because assertTransition is idempotent
  // It returns without error when current === next
  machine.assertTransition("pending", "pending");

  // Note: self-transition on terminal state (done -> done) is also allowed
  machine.assertTransition("done", "done");
});

test("StateTransitionMachine: uses entity kind in error messages", () => {
  const transitions: Record<string, readonly string[]> = {
    open: ["closed"],
    closed: [],
  };

  const machine = new StateTransitionMachine("workflow", transitions);

  let error: unknown;
  try {
    machine.assertTransition("closed", "open");
    assert.fail("Expected error was not thrown");
  } catch (e) {
    error = e;
  }

  assert.ok(error instanceof WorkflowStateError, "Expected WorkflowStateError to be thrown");
  assert.ok(error.message.includes("workflow"));
  assert.ok(error.code.includes("workflow"));
});

test("StateTransitionMachine: different entity kinds have independent state machines", () => {
  // Task transitions
  const taskTransitions: Record<string, readonly string[]> = {
    pending: ["in_progress"],
    in_progress: ["done"],
    done: [],
  };
  const taskMachine = new StateTransitionMachine("task", taskTransitions);

  // Workflow transitions (different structure)
  const workflowTransitions: Record<string, readonly string[]> = {
    created: ["running", "cancelled"],
    running: ["completed", "failed", "cancelled"],
    completed: [],
    failed: [],
    cancelled: [],
  };
  const workflowMachine = new StateTransitionMachine("workflow", workflowTransitions);

  // Task: valid transition
  taskMachine.assertTransition("pending", "in_progress");

  // Workflow: different valid transitions
  workflowMachine.assertTransition("created", "running");
  workflowMachine.assertTransition("created", "cancelled");

  // Workflow: running -> cancelled is valid
  workflowMachine.assertTransition("running", "cancelled");

  // Task: in_progress -> cancelled is NOT valid
  assert.throws(
    () => taskMachine.assertTransition("in_progress", "cancelled"),
    WorkflowStateError
  );
});

test("StateTransitionMachine: empty allowed transitions means no valid outgoing transitions", () => {
  const transitions: Record<string, readonly string[]> = {
    active: [],
    stopped: [],
  };

  const machine = new StateTransitionMachine("resource", transitions);

  // From terminal state - any transition should fail
  assert.throws(
    () => machine.assertTransition("active", "stopped"),
    WorkflowStateError
  );
});

test("StateTransitionMachine: handles single-state transitions", () => {
  const transitions: Record<string, readonly string[]> = {
    running: ["succeeded", "failed"],
    succeeded: [],
    failed: [],
  };

  const machine = new StateTransitionMachine("execution", transitions);

  machine.assertTransition("running", "succeeded");
  machine.assertTransition("running", "failed");

  // Failed is terminal - no further transitions
  assert.throws(
    () => machine.assertTransition("failed", "running"),
    WorkflowStateError
  );
});

test("StateTransitionMachine: error details include current and next state", () => {
  const transitions: Record<string, readonly string[]> = {
    init: ["ready"],
    ready: [],
  };

  const machine = new StateTransitionMachine("process", transitions);

  // Test with an invalid transition (init -> unknown)
  const error = assert.throws(
    () => machine.assertTransition("init", "unknown"),
    WorkflowStateError
  );

  // The error should have details with current and next state
  if (error instanceof WorkflowStateError) {
    assert.deepStrictEqual(error.details, {
      entityKind: "process",
      current: "init",
      next: "unknown",
    });
  }
});

test("StateTransitionMachine: generic type works with various state string types", () => {
  type TaskState = "created" | "running" | "completed";

  const transitions: Record<TaskState, readonly TaskState[]> = {
    created: ["running"],
    running: ["completed"],
    completed: [],
  };

  const machine = new StateTransitionMachine<TaskState>("task", transitions);

  // Should compile and work correctly
  machine.assertTransition("created", "running");
  machine.assertTransition("running", "completed");

  assert.throws(
    () => machine.assertTransition("completed", "created"),
    WorkflowStateError
  );
});