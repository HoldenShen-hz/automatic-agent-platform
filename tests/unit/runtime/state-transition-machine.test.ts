import assert from "node:assert/strict";
import test from "node:test";

import { StateTransitionMachine } from "../../../src/platform/five-plane-execution/state-transition/state-transition-machine.js";
import { WorkflowStateError } from "../../../src/platform/contracts/errors.js";

test("StateTransitionMachine constructor sets entity kind and transitions", () => {
  const machine = new StateTransitionMachine<string>("task", {
    queued: ["pending", "in_progress"],
    pending: ["in_progress"],
    in_progress: ["done", "failed"],
  });
  assert.equal((machine as any).entityKind, "task");
});

test("StateTransitionMachine assertTransition allows valid transitions", () => {
  const machine = new StateTransitionMachine<string>("task", {
    queued: ["pending", "in_progress"],
    pending: ["in_progress"],
    in_progress: ["done", "failed"],
  });

  // Should not throw
  machine.assertTransition("queued", "pending");
  machine.assertTransition("queued", "in_progress");
  machine.assertTransition("pending", "in_progress");
  machine.assertTransition("in_progress", "done");
  machine.assertTransition("in_progress", "failed");
});

test("StateTransitionMachine assertTransition throws on invalid transitions", () => {
  const machine = new StateTransitionMachine<string>("task", {
    queued: ["pending", "in_progress"],
    pending: ["in_progress"],
    in_progress: ["done", "failed"],
  });

  assert.throws(
    () => machine.assertTransition("queued", "done"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.invalid_transition"
  );
});

test("StateTransitionMachine assertTransition rejects no-op transitions", () => {
  const machine = new StateTransitionMachine<string>("task", {
    queued: ["pending", "in_progress"],
    pending: ["in_progress"],
  });

  assert.throws(
    () => machine.assertTransition("queued", "queued"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.noop_transition_denied"
  );
  assert.throws(
    () => machine.assertTransition("pending", "pending"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.noop_transition_denied"
  );
});

test("StateTransitionMachine assertTransition throws WorkflowStateError with details", () => {
  const machine = new StateTransitionMachine<string>("execution", {
    pending: ["running"],
    running: ["completed", "failed"],
  });

  try {
    machine.assertTransition("pending", "completed");
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError;
    assert.equal(error.code, "execution.invalid_transition");
    assert.deepEqual(error.details, { entityKind: "execution", current: "pending", next: "completed" });
  }
});

test("StateTransitionMachine works with different entity kinds", () => {
  const taskMachine = new StateTransitionMachine<string>("task", {
    created: ["running"],
    running: ["completed"],
  });

  const sessionMachine = new StateTransitionMachine<string>("session", {
    active: ["idle", "closed"],
    idle: ["active", "closed"],
  });

  // Task transitions
  taskMachine.assertTransition("created", "running");
  taskMachine.assertTransition("running", "completed");

  // Session transitions
  sessionMachine.assertTransition("active", "idle");
  sessionMachine.assertTransition("idle", "closed");

  // Cross-machine - task transitions shouldn't affect session
  assert.throws(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (sessionMachine as any).assertTransition("active", "completed"),
    WorkflowStateError
  );
});

test("StateTransitionMachine handles empty transitions map", () => {
  const machine = new StateTransitionMachine<string>("empty", {});

  // No transitions allowed from any state
  assert.throws(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => (machine as any).assertTransition("any", "other"),
    WorkflowStateError
  );
});

test("StateTransitionMachine rejects same-state transitions even when configured", () => {
  const machine = new StateTransitionMachine<string>("task", {
    running: ["running", "completed"], // includes self-transition
    completed: ["running"], // can restart
  });

  assert.throws(
    () => machine.assertTransition("running", "running"),
    (err: unknown) => err instanceof WorkflowStateError && err.code === "task.noop_transition_denied"
  );

  // Valid transitions
  machine.assertTransition("running", "completed");
  machine.assertTransition("completed", "running");
});
