/**
 * Unit tests for Kernel Modules (StateTransitionMachine)
 */

import assert from "node:assert/strict";
import test from "node:test";

import { StateTransitionMachine } from "../../../../src/platform/execution/state-transition/state-transition-machine.js";
import { WorkflowStateError } from "../../../../src/platform/contracts/errors.js";

// Define task state type for tests
type TaskState = "queued" | "in_progress" | "done" | "failed" | "cancelled";

test("StateTransitionMachine constructor requires entity kind and transitions map", () => {
  const transitions: Record<TaskState, readonly TaskState[]> = {
    queued: ["in_progress", "cancelled"],
    in_progress: ["done", "failed"],
    done: [],
    failed: [],
    cancelled: [],
  };
  const machine = new StateTransitionMachine("task", transitions);

  assert.ok(machine instanceof StateTransitionMachine);
});

test("StateTransitionMachine assertTransition valid transition", () => {
  const transitions: Record<TaskState, readonly TaskState[]> = {
    queued: ["in_progress", "cancelled"],
    in_progress: ["done", "failed", "cancelled"],
    done: [],
    failed: [],
    cancelled: [],
  };
  const machine = new StateTransitionMachine("task", transitions);

  // Should not throw
  machine.assertTransition("queued", "in_progress");
});

test("StateTransitionMachine assertTransition invalid transition throws", () => {
  const transitions: Record<TaskState, readonly TaskState[]> = {
    queued: ["in_progress", "cancelled"],
    in_progress: ["done", "failed", "cancelled"],
    done: [],
    failed: [],
    cancelled: [],
  };
  const machine = new StateTransitionMachine("task", transitions);

  // queued -> done is not allowed
  assert.throws(() => {
    machine.assertTransition("queued", "done");
  }, WorkflowStateError);
});

test("StateTransitionMachine noop transition throws", () => {
  const transitions: Record<TaskState, readonly TaskState[]> = {
    queued: ["in_progress", "cancelled"],
    in_progress: ["done", "failed", "cancelled"],
    done: [],
    failed: [],
    cancelled: [],
  };
  const machine = new StateTransitionMachine("task", transitions);

  // Same state transition is not allowed
  assert.throws(() => {
    machine.assertTransition("queued", "queued");
  }, WorkflowStateError);
});

test("StateTransitionMachine works with workflow entity", () => {
  type WorkflowState = "running" | "paused" | "cancelling" | "cancelled" | "completed" | "failed";
  const transitions: Record<WorkflowState, readonly WorkflowState[]> = {
    running: ["paused", "cancelling", "failed"],
    paused: ["running", "failed"],
    cancelling: ["cancelled"],
    cancelled: [],
    completed: [],
    failed: [],
  };
  const machine = new StateTransitionMachine("workflow", transitions);

  // Valid transition
  machine.assertTransition("running", "paused");

  // Invalid transition - running -> completed is not valid (must go through cancelling)
  assert.throws(() => {
    machine.assertTransition("running", "completed");
  }, WorkflowStateError);
});

test("StateTransitionMachine works with session entity", () => {
  type SessionState = "open" | "streaming" | "completed" | "failed";
  const transitions: Record<SessionState, readonly SessionState[]> = {
    open: ["streaming", "completed"],
    streaming: ["open", "completed", "failed"],
    completed: [],
    failed: [],
  };
  const machine = new StateTransitionMachine("session", transitions);

  // Valid transition
  machine.assertTransition("open", "streaming");

  // Recovery (streaming -> open) is valid
  machine.assertTransition("streaming", "open");
});

test("StateTransitionMachine works with execution entity", () => {
  type ExecutionState = "created" | "prechecking" | "executing" | "succeeded" | "failed" | "cancelled";
  const transitions: Record<ExecutionState, readonly ExecutionState[]> = {
    created: ["prechecking", "cancelled"],
    prechecking: ["executing", "cancelled"],
    executing: ["succeeded", "failed", "cancelled"],
    succeeded: [],
    failed: [],
    cancelled: [],
  };
  const machine = new StateTransitionMachine("execution", transitions);

  // Valid lifecycle transitions
  machine.assertTransition("created", "prechecking");
  machine.assertTransition("prechecking", "executing");
  machine.assertTransition("executing", "succeeded");
});

test("StateTransitionMachine terminal states have no outgoing transitions", () => {
  const transitions: Record<TaskState, readonly TaskState[]> = {
    queued: ["in_progress"],
    in_progress: ["done"],
    done: [],
    failed: [],
    cancelled: [],
  };
  const machine = new StateTransitionMachine("task", transitions);

  // done is terminal - any transition should throw
  assert.throws(() => {
    machine.assertTransition("done", "in_progress");
  }, WorkflowStateError);
});

test("StateTransitionMachine with generic string states", () => {
  type GenericTaskState = "idle" | "running" | "stopped";

  const machine = new StateTransitionMachine<GenericTaskState>("generic-task", {
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
  const transitions: Record<TaskState, readonly TaskState[]> = {
    queued: ["in_progress"],
    in_progress: ["done"],
    done: [],
    failed: [],
    cancelled: [],
  };
  const machine = new StateTransitionMachine("task", transitions);

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
  type ExecState = "created" | "running" | "done" | "failed" | "cancelled";
  const transitions: Record<ExecState, readonly ExecState[]> = {
    created: ["running"],
    running: ["done"],
    done: [],
    failed: [],
    cancelled: [],
  };
  const machine = new StateTransitionMachine("execution", transitions);

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
  type ApprovalState = "pending" | "approved" | "rejected";
  const transitions: Record<ApprovalState, readonly ApprovalState[]> = {
    pending: ["approved", "rejected"],
    approved: [],
    rejected: [],
  };
  const machine = new StateTransitionMachine("approval", transitions);

  // Valid transitions
  machine.assertTransition("pending", "approved");
  machine.assertTransition("pending", "rejected");

  // Terminal - no further transitions
  assert.throws(() => {
    machine.assertTransition("approved", "rejected");
  }, WorkflowStateError);
});

test("StateTransitionMachine with complex workflow transitions", () => {
  type ComplexWorkflowState = "created" | "running" | "pausing" | "paused" | "cancelling" | "cancelled" | "completed" | "failed";
  const transitions: Record<ComplexWorkflowState, readonly ComplexWorkflowState[]> = {
    created: ["running"],
    running: ["paused", "completed", "failed", "cancelling"],
    pausing: ["paused"],
    paused: ["running", "failed"],
    cancelling: ["cancelled"],
    cancelled: [],
    completed: [],
    failed: [],
  };
  const machine = new StateTransitionMachine("workflow", transitions);

  // Valid transitions
  machine.assertTransition("created", "running");
  machine.assertTransition("running", "paused");
  machine.assertTransition("paused", "running");
  machine.assertTransition("running", "cancelling");
  machine.assertTransition("cancelling", "cancelled");
});

test("StateTransitionMachine validates transition existence", () => {
  const transitions: Record<TaskState, readonly TaskState[]> = {
    queued: ["in_progress"],
    in_progress: ["done", "failed"],
    done: [],
    failed: [],
    cancelled: [],
  };
  const machine = new StateTransitionMachine("task", transitions);

  // Transition from non-existent state should throw
  assert.throws(() => {
    machine.assertTransition("done", "in_progress");
  }, WorkflowStateError);
});

test("StateTransitionMachine handles multi-state transitions", () => {
  type MultiTaskState = "queued" | "pending" | "in_progress" | "done" | "failed" | "cancelled";
  const transitions: Record<MultiTaskState, readonly MultiTaskState[]> = {
    queued: ["pending", "in_progress"],
    pending: ["in_progress", "cancelled"],
    in_progress: ["done", "failed", "cancelled"],
    done: [],
    failed: [],
    cancelled: [],
  };
  const machine = new StateTransitionMachine("task", transitions);

  // From queued, can go to pending or in_progress
  machine.assertTransition("queued", "pending");
  machine.assertTransition("queued", "in_progress");

  // But not directly to done
  assert.throws(() => {
    machine.assertTransition("queued", "done");
  }, WorkflowStateError);
});