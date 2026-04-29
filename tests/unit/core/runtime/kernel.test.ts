/**
 * Unit tests for Kernel Modules (StateTransitionMachine)
 */

import assert from "node:assert/strict";
import test from "node:test";

import { StateTransitionMachine } from "../../../../src/platform/execution/state-transition/state-transition-machine.js";
import { WorkflowStateError } from "../../../../src/platform/contracts/errors.js";

test("StateTransitionMachine constructor requires entity kind and transitions map", () => {
  const machine = new StateTransitionMachine("task", {
    queued: ["in_progress", "cancelled"],
    in_progress: ["done", "failed"],
    done: [],
    failed: [],
    cancelled: [],
  });

  assert.ok(machine instanceof StateTransitionMachine);
});

test("StateTransitionMachine assertTransition valid transition", () => {
  const machine = new StateTransitionMachine("task", {
    queued: ["in_progress", "cancelled"],
    in_progress: ["done", "failed", "cancelled"],
    done: [],
    failed: [],
    cancelled: [],
  });

  // Should not throw
  machine.assertTransition("queued", "in_progress");
});

test("StateTransitionMachine assertTransition invalid transition throws", () => {
  const machine = new StateTransitionMachine("task", {
    queued: ["in_progress", "cancelled"],
    in_progress: ["done", "failed", "cancelled"],
    done: [],
    failed: [],
    cancelled: [],
  });

  // queued -> done is not allowed
  assert.throws(() => {
    machine.assertTransition("queued", "done");
  }, WorkflowStateError);
});

test("StateTransitionMachine noop transition throws", () => {
  const machine = new StateTransitionMachine("task", {
    queued: ["in_progress", "cancelled"],
    in_progress: ["done", "failed", "cancelled"],
    done: [],
    failed: [],
    cancelled: [],
  });

  // Same state transition is not allowed
  assert.throws(() => {
    machine.assertTransition("queued", "queued");
  }, WorkflowStateError);
});

test("StateTransitionMachine works with workflow entity", () => {
  const machine = new StateTransitionMachine("workflow", {
    running: ["paused", "cancelling", "failed"],
    paused: ["running", "failed"],
    cancelling: ["cancelled"],
    cancelled: [],
    completed: [],
    failed: [],
  });

  // Valid transition
  machine.assertTransition("running", "paused");

  // Invalid transition - running -> completed is not valid (must go through cancelling)
  assert.throws(() => {
    machine.assertTransition("running", "completed");
  }, WorkflowStateError);
});

test("StateTransitionMachine works with session entity", () => {
  const machine = new StateTransitionMachine("session", {
    open: ["streaming", "completed"],
    streaming: ["open", "completed", "failed"],
    completed: [],
    failed: [],
  });

  // Valid transition
  machine.assertTransition("open", "streaming");

  // Recovery (streaming -> open) is valid
  machine.assertTransition("streaming", "open");
});

test("StateTransitionMachine works with execution entity", () => {
  const machine = new StateTransitionMachine("execution", {
    created: ["prechecking", "cancelled"],
    prechecking: ["executing", "cancelled"],
    executing: ["succeeded", "failed", "cancelled"],
    succeeded: [],
    failed: [],
    cancelled: [],
  });

  // Valid lifecycle transitions
  machine.assertTransition("created", "prechecking");
  machine.assertTransition("prechecking", "executing");
  machine.assertTransition("executing", "succeeded");
});

test("StateTransitionMachine terminal states have no outgoing transitions", () => {
  const machine = new StateTransitionMachine("task", {
    queued: ["in_progress"],
    in_progress: ["done"],
    done: [],
    failed: [],
    cancelled: [],
  });

  // done is terminal - any transition should throw
  assert.throws(() => {
    machine.assertTransition("done", "in_progress");
  }, WorkflowStateError);
});

test("StateTransitionMachine with generic string states", () => {
  type TaskState = "idle" | "running" | "stopped";

  const machine = new StateTransitionMachine<TaskState>("generic-task", {
    idle: ["running"],
    running: ["stopped"],
    stopped: [],
  });

  machine.assertTransition("idle", "running");
  machine.assertTransition("running", "stopped");

  // stopped is terminal
  assert.throws(() => {
    machine.assertTransition("stopped", "idle");
  }, WorkflowStateError);
});

test("StateTransitionMachine reports entity kind in error", () => {
  const machine = new StateTransitionMachine("task", {
    queued: ["in_progress"],
    in_progress: ["done"],
    done: [],
    failed: [],
    cancelled: [],
  });

  try {
    machine.assertTransition("queued", "done");
    assert.fail("Should have thrown");
  } catch (error) {
    if (error instanceof WorkflowStateError) {
      assert.ok(error.message.includes("task"));
      assert.ok(error.code.includes("task"));
    } else {
      throw error;
    }
  }
});

test("StateTransitionMachine.errorCode in WorkflowStateError", () => {
  const machine = new StateTransitionMachine("execution", {
    created: ["running"],
    running: ["done"],
    done: [],
    failed: [],
    cancelled: [],
  });

  try {
    machine.assertTransition("created", "done");
    assert.fail("Should have thrown");
  } catch (error) {
    if (error instanceof WorkflowStateError) {
      assert.ok(error.code.includes("execution"));
      assert.ok(error.code.includes("invalid_transition"));
    } else {
      throw error;
    }
  }
});

test("StateTransitionMachine with approval entity", () => {
  const machine = new StateTransitionMachine("approval", {
    pending: ["approved", "rejected"],
    approved: [],
    rejected: [],
  });

  // Valid transitions
  machine.assertTransition("pending", "approved");
  machine.assertTransition("pending", "rejected");

  // Terminal - no further transitions
  assert.throws(() => {
    machine.assertTransition("approved", "rejected");
  }, WorkflowStateError);
});

test("StateTransitionMachine with complex workflow transitions", () => {
  const machine = new StateTransitionMachine("workflow", {
    created: ["running"],
    running: ["paused", "completed", "failed", "cancelling"],
    pausing: ["paused"],
    paused: ["running", "failed"],
    cancelling: ["cancelled"],
    cancelled: [],
    completed: [],
    failed: [],
  });

  // Valid transitions
  machine.assertTransition("created", "running");
  machine.assertTransition("running", "paused");
  machine.assertTransition("paused", "running");
  machine.assertTransition("running", "cancelling");
  machine.assertTransition("cancelling", "cancelled");
});

test("StateTransitionMachine validates transition existence", () => {
  const machine = new StateTransitionMachine("task", {
    queued: ["in_progress"],
    in_progress: ["done", "failed"],
    done: [],
    failed: [],
    cancelled: [],
  });

  // Transition from non-existent state should throw
  assert.throws(() => {
    machine.assertTransition("done", "in_progress");
  }, WorkflowStateError);
});

test("StateTransitionMachine handles multi-state transitions", () => {
  const machine = new StateTransitionMachine("task", {
    queued: ["pending", "in_progress"],
    pending: ["in_progress", "cancelled"],
    in_progress: ["done", "failed", "cancelled"],
    done: [],
    failed: [],
    cancelled: [],
  });

  // From queued, can go to pending or in_progress
  machine.assertTransition("queued", "pending");
  machine.assertTransition("queued", "in_progress");

  // But not directly to done
  assert.throws(() => {
    machine.assertTransition("queued", "done");
  }, WorkflowStateError);
});