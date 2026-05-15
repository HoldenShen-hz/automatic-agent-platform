import assert from "node:assert/strict";
import test from "node:test";

import { StateTransitionMachine } from "../../../../../src/platform/five-plane-execution/state-transition/state-transition-machine.js";
import { WorkflowStateError } from "../../../../../src/platform/contracts/errors.js";

// ---------------------------------------------------------------------------
// StateTransitionMachine - basic construction
// ---------------------------------------------------------------------------

test("StateTransitionMachine accepts valid entity kind and transitions map", () => {
  const transitions: Record<string, readonly string[]> = { a: ["b"], b: [] };
  const machine = new StateTransitionMachine("test", transitions);
  assert.ok(machine);
});

test("StateTransitionMachine works with empty transitions map for terminal states", () => {
  const transitions: Record<string, readonly string[]> = { a: [], b: [] };
  const machine = new StateTransitionMachine("test", transitions);
  // a is terminal - cannot transition to anything
  machine.assertTransition("a", "a"); // no-op is ok
  assert.throws(() => machine.assertTransition("a", "b"), WorkflowStateError);
});

// ---------------------------------------------------------------------------
// StateTransitionMachine - assertTransition validation
// ---------------------------------------------------------------------------

test("assertTransition allows valid transition", () => {
  const transitions: Record<string, readonly string[]> = { queued: ["pending", "failed"], pending: [], failed: [] };
  const machine = new StateTransitionMachine("task", transitions);
  machine.assertTransition("queued", "pending"); // should not throw
});

test("assertTransition allows no-op transition (same state)", () => {
  const transitions: Record<string, readonly string[]> = { a: ["b"], b: [] };
  const machine = new StateTransitionMachine("test", transitions);
  machine.assertTransition("a", "a"); // should not throw
});

test("assertTransition rejects invalid transition", () => {
  const transitions: Record<string, readonly string[]> = { a: ["c"], b: [] };
  const machine = new StateTransitionMachine("test", transitions);
  assert.throws(
    () => machine.assertTransition("a", "b"),
    (err: unknown) => err instanceof WorkflowStateError && err.message.includes("invalid_transition"),
  );
});

test("assertTransition rejects transition from terminal state", () => {
  const transitions: Record<string, readonly string[]> = { active: ["done"], done: [] };
  const machine = new StateTransitionMachine("execution", transitions);
  assert.throws(() => machine.assertTransition("done", "active"), WorkflowStateError);
});

test("assertTransition rejects unknown source state", () => {
  const transitions: Record<string, readonly string[]> = { a: ["b"], b: [] };
  const machine = new StateTransitionMachine("test", transitions);
  assert.throws(() => machine.assertTransition("unknown", "a"), WorkflowStateError);
});

// ---------------------------------------------------------------------------
// StateTransitionMachine - WorkflowStateError details
// ---------------------------------------------------------------------------

test("WorkflowStateError contains entityKind in details", () => {
  const transitions: Record<string, readonly string[]> = { a: ["b"], b: [] };
  const machine = new StateTransitionMachine("my_entity", transitions);

  try {
    machine.assertTransition("a", "c");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError & { details?: { entityKind: string; current: string; next: string } };
    assert.equal(error.details?.entityKind, "my_entity");
    assert.equal(error.details?.current, "a");
    assert.equal(error.details?.next, "c");
  }
});

test("WorkflowStateError has correct error code format", () => {
  const transitions: Record<string, readonly string[]> = { a: ["b"], b: [] };
  const machine = new StateTransitionMachine("workflow", transitions);

  try {
    machine.assertTransition("a", "invalid");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    assert.ok(err.message.includes("workflow.invalid_transition"));
  }
});

// ---------------------------------------------------------------------------
// StateTransitionMachine - generic type handling
// ---------------------------------------------------------------------------

test("StateTransitionMachine works with string literal types", () => {
  type Status = "idle" | "running" | "stopped";
  const transitions: Record<Status, readonly Status[]> = {
    idle: ["running"],
    running: ["stopped"],
    stopped: [],
  };
  const machine = new StateTransitionMachine<Status>("process", transitions);
  machine.assertTransition("idle", "running");
  machine.assertTransition("running", "stopped");
});

test("StateTransitionMachine works with union string types", () => {
  // Biome/biome states
  const transitions: Record<string, readonly string[]> = {
    pending: ["running", "cancelled"],
    running: ["completed", "failed", "cancelled"],
    completed: [],
    failed: [],
    cancelled: [],
  };
  const machine = new StateTransitionMachine("biome", transitions);

  machine.assertTransition("pending", "running");
  machine.assertTransition("running", "completed");
  assert.throws(() => machine.assertTransition("completed", "running"), WorkflowStateError);
});

// ---------------------------------------------------------------------------
// StateTransitionMachine - complex transition maps
// ---------------------------------------------------------------------------

test("StateTransitionMachine handles branching transitions", () => {
  // Simulating execution states with multiple possible next states
  const transitions: Record<string, readonly string[]> = {
    created: ["running", "failed", "cancelled"],
    running: ["completed", "failed", "waiting", "cancelled"],
    waiting: ["running", "failed", "cancelled"],
    completed: [],
    failed: [],
    cancelled: [],
  };
  const machine = new StateTransitionMachine("job", transitions);

  // Valid branching paths
  machine.assertTransition("created", "running");
  machine.assertTransition("created", "failed");
  machine.assertTransition("running", "waiting");
  machine.assertTransition("waiting", "running");

  // Invalid branching
  assert.throws(() => machine.assertTransition("completed", "running"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("waiting", "completed"), WorkflowStateError);
});

test("StateTransitionMachine handles cyclical transitions", () => {
  // Session states with streaming/awaiting cycle
  const transitions: Record<string, readonly string[]> = {
    open: ["streaming"],
    streaming: ["awaiting_user", "open"],
    awaiting_user: ["streaming", "completed"],
    completed: [],
  };
  const machine = new StateTransitionMachine("session", transitions);

  // Valid cycle
  machine.assertTransition("open", "streaming");
  machine.assertTransition("streaming", "awaiting_user");
  machine.assertTransition("awaiting_user", "streaming");
  machine.assertTransition("streaming", "open");

  // Cannot cycle back to open from awaiting_user directly
  assert.throws(() => machine.assertTransition("awaiting_user", "open"), WorkflowStateError);
});

test("StateTransitionMachine handles self-loops via no-op", () => {
  // Some states might want to allow same-state transitions
  const transitions: Record<string, readonly string[]> = {
    active: ["active", "idle", "stopped"], // active can transition to itself
    idle: ["active"],
    stopped: [],
  };
  const machine = new StateTransitionMachine("worker", transitions);

  // Self-loop is allowed (no-op passes)
  machine.assertTransition("active", "active");
  machine.assertTransition("idle", "idle");

  // Normal transitions still work
  machine.assertTransition("active", "idle");
});

// ---------------------------------------------------------------------------
// StateTransitionMachine - error properties
// ---------------------------------------------------------------------------

test("WorkflowStateError is not retryable by default", () => {
  const transitions: Record<string, readonly string[]> = { a: ["b"], b: [] };
  const machine = new StateTransitionMachine("test", transitions);

  try {
    machine.assertTransition("a", "c");
    assert.fail("Expected error");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError;
    assert.equal(error.retryable, false);
  }
});

test("WorkflowStateError has statusCode 409 Conflict", () => {
  const transitions: Record<string, readonly string[]> = { a: ["b"], b: [] };
  const machine = new StateTransitionMachine("test", transitions);

  try {
    machine.assertTransition("a", "c");
    assert.fail("Expected error");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError;
    assert.equal(error.statusCode, 409);
  }
});

// ---------------------------------------------------------------------------
// StateTransitionMachine - validation rules
// ---------------------------------------------------------------------------

test("assertTransition validates all allowed transitions for task states", () => {
  const transitions: Record<string, readonly string[]> = {
    queued: ["pending", "in_progress", "cancelled"],
    pending: ["in_progress", "cancelled"],
    in_progress: ["awaiting_decision", "done", "failed", "cancelled"],
    awaiting_decision: ["in_progress", "failed", "cancelled"],
    done: [],
    failed: [],
    cancelled: [],
  };
  const machine = new StateTransitionMachine("task", transitions);

  // Valid transitions from queued
  machine.assertTransition("queued", "pending");
  machine.assertTransition("queued", "in_progress");
  machine.assertTransition("queued", "cancelled");

  // Invalid transitions from queued
  assert.throws(() => machine.assertTransition("queued", "done"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("queued", "failed"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("queued", "awaiting_decision"), WorkflowStateError);
});

test("assertTransition validates all allowed transitions for workflow states", () => {
  const transitions: Record<string, readonly string[]> = {
    running: ["paused", "completed", "failed", "cancelling", "cancelled"],
    paused: ["resuming", "failed", "cancelled"],
    resuming: ["running", "failed", "cancelled"],
    completed: [],
    failed: [],
    cancelling: ["cancelled"],
    cancelled: [],
  };
  const machine = new StateTransitionMachine("workflow", transitions);

  // Valid transitions from running
  machine.assertTransition("running", "paused");
  machine.assertTransition("running", "completed");
  machine.assertTransition("running", "failed");
  machine.assertTransition("running", "cancelling");
  machine.assertTransition("running", "cancelled");

  // Invalid transitions from paused
  assert.throws(() => machine.assertTransition("paused", "running"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("paused", "completed"), WorkflowStateError);
});

test("assertTransition validates all allowed transitions for execution states", () => {
  const transitions: Record<string, readonly string[]> = {
    created: ["prechecking", "cancelled", "failed"],
    prechecking: ["executing", "blocked", "cancelled", "failed"],
    executing: ["blocked", "succeeded", "failed", "cancelled"],
    blocked: ["prechecking", "executing", "cancelled", "failed", "superseded"],
    succeeded: [],
    failed: [],
    cancelled: [],
    superseded: [],
  };
  const machine = new StateTransitionMachine("execution", transitions);

  // Valid transitions from blocked
  machine.assertTransition("blocked", "prechecking");
  machine.assertTransition("blocked", "executing");
  machine.assertTransition("blocked", "cancelled");
  machine.assertTransition("blocked", "failed");
  machine.assertTransition("blocked", "superseded");

  // Invalid transitions from succeeded
  assert.throws(() => machine.assertTransition("succeeded", "executing"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("succeeded", "failed"), WorkflowStateError);
});

test("assertTransition validates all allowed transitions for approval states", () => {
  const transitions: Record<string, readonly string[]> = {
    requested: ["approved", "rejected", "expired", "cancelled"],
    approved: [],
    rejected: [],
    expired: [],
    cancelled: [],
  };
  const machine = new StateTransitionMachine("approval", transitions);

  // Valid transitions from requested
  machine.assertTransition("requested", "approved");
  machine.assertTransition("requested", "rejected");
  machine.assertTransition("requested", "expired");
  machine.assertTransition("requested", "cancelled");

  // All terminal states block further transitions
  assert.throws(() => machine.assertTransition("approved", "rejected"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("rejected", "approved"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("expired", "cancelled"), WorkflowStateError);
});

// ---------------------------------------------------------------------------
// StateTransitionMachine - transition guards
// ---------------------------------------------------------------------------

test("assertTransition guards against backward transitions in linear flow", () => {
  const transitions: Record<string, readonly string[]> = {
    step1: ["step2"],
    step2: ["step3"],
    step3: ["step4"],
    step4: [],
  };
  const machine = new StateTransitionMachine("pipeline", transitions);

  // Cannot go backward
  assert.throws(() => machine.assertTransition("step3", "step2"), WorkflowStateError);
  assert.throws(() => machine.assertTransition("step4", "step1"), WorkflowStateError);

  // Can go forward
  machine.assertTransition("step1", "step2");
  machine.assertTransition("step2", "step3");
  machine.assertTransition("step3", "step4");
});

test("assertTransition guards against skipping states", () => {
  const transitions: Record<string, readonly string[]> = {
    initial: ["middle"],
    middle: ["final"],
    final: [],
  };
  const machine = new StateTransitionMachine("process", transitions);

  // Cannot skip middle
  assert.throws(() => machine.assertTransition("initial", "final"), WorkflowStateError);
});

test("assertTransition guards allow specific paths in diamond pattern", () => {
  // Diamond pattern: top -> left/right -> bottom
  const transitions: Record<string, readonly string[]> = {
    top: ["left", "right"],
    left: ["bottom"],
    right: ["bottom"],
    bottom: [],
  };
  const machine = new StateTransitionMachine("diamond", transitions);

  // Both paths to bottom are valid
  machine.assertTransition("top", "left");
  machine.assertTransition("top", "right");
  machine.assertTransition("left", "bottom");
  machine.assertTransition("right", "bottom");

  // Cannot skip bottom
  assert.throws(() => machine.assertTransition("left", "right"), WorkflowStateError);
});

// ---------------------------------------------------------------------------
// StateTransitionMachine - event emission readiness
// ---------------------------------------------------------------------------

test("assertTransition does not throw for valid transition enables event emission", () => {
  const transitions: Record<string, readonly string[]> = {
    created: ["active"],
    active: ["completed"],
    completed: [],
  };
  const machine = new StateTransitionMachine("eventable", transitions);

  // This should not throw, meaning event emission is enabled
  machine.assertTransition("created", "active");
  machine.assertTransition("active", "completed");

  // Both transitions were valid, events could be emitted
});

test("assertTransition throws for invalid transition preventing event emission", () => {
  const transitions: Record<string, readonly string[]> = {
    created: ["active"],
    active: ["completed"],
    completed: [],
  };
  const machine = new StateTransitionMachine("eventable", transitions);

  // This should throw, preventing event emission for invalid transition
  assert.throws(() => machine.assertTransition("completed", "active"), WorkflowStateError);
});

// ---------------------------------------------------------------------------
// StateTransitionMachine - performance edge cases
// ---------------------------------------------------------------------------

test("assertTransition handles transitions with many allowed next states", () => {
  // Create a transition map with many possible next states
  const transitions: Record<string, readonly string[]> = {};
  const allowedTargets = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
  transitions["start"] = allowedTargets;
  for (const target of allowedTargets) {
    transitions[target] = [];
  }

  const machine = new StateTransitionMachine("many_targets", transitions);

  // All allowed transitions should work
  for (const target of allowedTargets) {
    machine.assertTransition("start", target);
  }

  // Invalid transition should still throw
  assert.throws(() => machine.assertTransition("start", "unknown"), WorkflowStateError);
});

test("assertTransition handles deeply nested transition chains", () => {
  // Create a long chain: 0 -> 1 -> 2 -> ... -> 99 -> terminal
  const transitions: Record<string, readonly string[]> = {};
  for (let i = 0; i < 99; i++) {
    transitions[`state_${i}`] = [`state_${i + 1}`];
  }
  transitions["state_99"] = ["terminal"];
  transitions["terminal"] = [];

  const machine = new StateTransitionMachine("chain", transitions);

  // Walk the chain
  for (let i = 0; i < 99; i++) {
    machine.assertTransition(`state_${i}`, `state_${i + 1}`);
  }
  machine.assertTransition("state_99", "terminal");

  // Cannot go backwards
  assert.throws(() => machine.assertTransition("state_50", "state_49"), WorkflowStateError);
});
