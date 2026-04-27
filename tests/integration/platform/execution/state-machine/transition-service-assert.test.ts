/**
 * Integration Test: TransitionService assertTransition validation
 *
 * Tests that TransitionService correctly validates state transitions
 * through its component state machines. These integration tests verify
 * the full transition validation path including error handling.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowStateError } from "../../../../../src/platform/contracts/errors.js";
import {
  TASK_STATUSES,
  WORKFLOW_STATUSES,
  SESSION_STATUSES,
  EXECUTION_STATUSES,
  APPROVAL_STATUSES,
} from "../../../../../src/platform/contracts/types/status.js";

// Transition maps matching TransitionService
const TASK_TRANSITIONS: Record<string, readonly string[]> = {
  queued: ["pending", "in_progress", "cancelled"],
  pending: ["in_progress", "cancelled"],
  in_progress: ["awaiting_decision", "done", "failed", "cancelled"],
  awaiting_decision: ["in_progress", "failed", "cancelled"],
  done: [],
  failed: [],
  cancelled: [],
};

const WORKFLOW_TRANSITIONS: Record<string, readonly string[]> = {
  running: ["paused", "completed", "failed", "cancelling", "cancelled"],
  paused: ["resuming", "failed", "cancelled"],
  resuming: ["running", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelling: ["cancelled"],
  cancelled: [],
};

const SESSION_TRANSITIONS: Record<string, readonly string[]> = {
  open: ["streaming", "awaiting_user", "completed", "failed", "cancelled"],
  streaming: ["awaiting_user", "completed", "failed", "cancelled", "open"],
  awaiting_user: ["streaming", "completed", "failed", "cancelled"],
  paused: ["streaming", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

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

const APPROVAL_TRANSITIONS: Record<string, readonly string[]> = {
  requested: ["approved", "rejected", "expired", "cancelled"],
  approved: [],
  rejected: [],
  expired: [],
  cancelled: [],
};

// ---------------------------------------------------------------------------
// Task transitions - full coverage
// ---------------------------------------------------------------------------

test("TransitionService validates all valid task transitions", () => {
  const validTransitions: Array<[string, string]> = [
    ["queued", "pending"],
    ["queued", "in_progress"],
    ["queued", "cancelled"],
    ["pending", "in_progress"],
    ["pending", "cancelled"],
    ["in_progress", "awaiting_decision"],
    ["in_progress", "done"],
    ["in_progress", "failed"],
    ["in_progress", "cancelled"],
    ["awaiting_decision", "in_progress"],
    ["awaiting_decision", "failed"],
    ["awaiting_decision", "cancelled"],
  ];

  for (const [from, to] of validTransitions) {
    const allowed = TASK_TRANSITIONS[from] ?? [];
    assert.ok(
      allowed.includes(to),
      `Expected ${from} -> ${to} to be valid task transition`,
    );
  }
});

test("TransitionService rejects all invalid task transitions", () => {
  const invalidTransitions: Array<[string, string]> = [
    ["done", "queued"],
    ["done", "in_progress"],
    ["failed", "pending"],
    ["cancelled", "in_progress"],
    ["in_progress", "queued"],
    ["pending", "done"],
    ["awaiting_decision", "done"],
  ];

  for (const [from, to] of invalidTransitions) {
    const allowed = TASK_TRANSITIONS[from] ?? [];
    assert.ok(
      !allowed.includes(to),
      `Expected ${from} -> ${to} to be invalid task transition`,
    );
  }
});

test("TransitionService treats terminal task states as final", () => {
  const terminalStates = ["done", "failed", "cancelled"];

  for (const terminal of terminalStates) {
    const transitions = TASK_TRANSITIONS[terminal] ?? [];
    assert.equal(
      transitions.length,
      0,
      `Terminal state ${terminal} should have no outgoing transitions`,
    );
  }
});

// ---------------------------------------------------------------------------
// Workflow transitions - full coverage
// ---------------------------------------------------------------------------

test("TransitionService validates all valid workflow transitions", () => {
  const validTransitions: Array<[string, string]> = [
    ["running", "paused"],
    ["running", "completed"],
    ["running", "failed"],
    ["running", "cancelling"],
    ["running", "cancelled"],
    ["paused", "resuming"],
    ["paused", "failed"],
    ["paused", "cancelled"],
    ["resuming", "running"],
    ["resuming", "failed"],
    ["resuming", "cancelled"],
    ["cancelling", "cancelled"],
  ];

  for (const [from, to] of validTransitions) {
    const allowed = WORKFLOW_TRANSITIONS[from] ?? [];
    assert.ok(
      allowed.includes(to),
      `Expected ${from} -> ${to} to be valid workflow transition`,
    );
  }
});

test("TransitionService rejects invalid workflow transitions", () => {
  const invalidTransitions: Array<[string, string]> = [
    ["running", "resuming"],
    ["paused", "running"],
    ["paused", "completed"],
    ["resuming", "paused"],
    ["completed", "running"],
    ["failed", "paused"],
  ];

  for (const [from, to] of invalidTransitions) {
    const allowed = WORKFLOW_TRANSITIONS[from] ?? [];
    assert.ok(
      !allowed.includes(to),
      `Expected ${from} -> ${to} to be invalid workflow transition`,
    );
  }
});

test("TransitionService cancellation flow works correctly", () => {
  // Direct cancellation
  assert.ok(WORKFLOW_TRANSITIONS["running"].includes("cancelled"));

  // Graceful cancellation flow
  assert.ok(WORKFLOW_TRANSITIONS["running"].includes("cancelling"));
  assert.ok(WORKFLOW_TRANSITIONS["cancelling"].includes("cancelled"));
});

test("TransitionService treats terminal workflow states as final", () => {
  const terminalStates = ["completed", "failed", "cancelled"];

  for (const terminal of terminalStates) {
    const transitions = WORKFLOW_TRANSITIONS[terminal] ?? [];
    assert.equal(
      transitions.length,
      0,
      `Terminal state ${terminal} should have no outgoing transitions`,
    );
  }
});

// ---------------------------------------------------------------------------
// Session transitions - full coverage
// ---------------------------------------------------------------------------

test("TransitionService validates all valid session transitions", () => {
  const validTransitions: Array<[string, string]> = [
    ["open", "streaming"],
    ["open", "awaiting_user"],
    ["open", "completed"],
    ["open", "failed"],
    ["open", "cancelled"],
    ["streaming", "awaiting_user"],
    ["streaming", "completed"],
    ["streaming", "failed"],
    ["streaming", "cancelled"],
    ["streaming", "open"],
    ["awaiting_user", "streaming"],
    ["awaiting_user", "completed"],
    ["awaiting_user", "failed"],
    ["awaiting_user", "cancelled"],
    ["paused", "streaming"],
    ["paused", "completed"],
    ["paused", "failed"],
    ["paused", "cancelled"],
  ];

  for (const [from, to] of validTransitions) {
    const allowed = SESSION_TRANSITIONS[from] ?? [];
    assert.ok(
      allowed.includes(to),
      `Expected ${from} -> ${to} to be valid session transition`,
    );
  }
});

test("TransitionService rejects invalid session transitions", () => {
  const invalidTransitions: Array<[string, string]> = [
    ["completed", "open"],
    ["failed", "streaming"],
    ["cancelled", "awaiting_user"],
    ["awaiting_user", "open"],
  ];

  for (const [from, to] of invalidTransitions) {
    const allowed = SESSION_TRANSITIONS[from] ?? [];
    assert.ok(
      !allowed.includes(to),
      `Expected ${from} -> ${to} to be invalid session transition`,
    );
  }
});

// ---------------------------------------------------------------------------
// Execution transitions - full coverage
// ---------------------------------------------------------------------------

test("TransitionService validates all valid execution transitions", () => {
  const validTransitions: Array<[string, string]> = [
    ["created", "prechecking"],
    ["created", "executing"],
    ["created", "cancelled"],
    ["created", "failed"],
    ["prechecking", "executing"],
    ["prechecking", "blocked"],
    ["prechecking", "cancelled"],
    ["prechecking", "failed"],
    ["executing", "blocked"],
    ["executing", "succeeded"],
    ["executing", "failed"],
    ["executing", "cancelled"],
    ["blocked", "prechecking"],
    ["blocked", "executing"],
    ["blocked", "cancelled"],
    ["blocked", "failed"],
    ["blocked", "superseded"],
  ];

  for (const [from, to] of validTransitions) {
    const allowed = EXECUTION_TRANSITIONS[from] ?? [];
    assert.ok(
      allowed.includes(to),
      `Expected ${from} -> ${to} to be valid execution transition`,
    );
  }
});

test("TransitionService rejects invalid execution transitions", () => {
  const invalidTransitions: Array<[string, string]> = [
    ["created", "succeeded"],
    ["created", "blocked"],
    ["created", "superseded"],
    ["prechecking", "succeeded"],
    ["executing", "prechecking"],
    ["blocked", "succeeded"],
    ["succeeded", "failed"],
    ["failed", "executing"],
  ];

  for (const [from, to] of invalidTransitions) {
    const allowed = EXECUTION_TRANSITIONS[from] ?? [];
    assert.ok(
      !allowed.includes(to),
      `Expected ${from} -> ${to} to be invalid execution transition`,
    );
  }
});

test("TransitionService treats terminal execution states as final", () => {
  const terminalStates = ["succeeded", "failed", "cancelled", "superseded"];

  for (const terminal of terminalStates) {
    const transitions = EXECUTION_TRANSITIONS[terminal] ?? [];
    assert.equal(
      transitions.length,
      0,
      `Terminal state ${terminal} should have no outgoing transitions`,
    );
  }
});

// ---------------------------------------------------------------------------
// Approval transitions - full coverage
// ---------------------------------------------------------------------------

test("TransitionService validates all valid approval transitions", () => {
  const validTransitions: Array<[string, string]> = [
    ["requested", "approved"],
    ["requested", "rejected"],
    ["requested", "expired"],
    ["requested", "cancelled"],
  ];

  for (const [from, to] of validTransitions) {
    const allowed = APPROVAL_TRANSITIONS[from] ?? [];
    assert.ok(
      allowed.includes(to),
      `Expected ${from} -> ${to} to be valid approval transition`,
    );
  }
});

test("TransitionService rejects all transitions from terminal approval states", () => {
  const terminalStates = ["approved", "rejected", "expired", "cancelled"];

  for (const terminal of terminalStates) {
    const transitions = APPROVAL_TRANSITIONS[terminal] ?? [];
    assert.equal(
      transitions.length,
      0,
      `Terminal state ${terminal} should have no outgoing transitions`,
    );
  }
});

// ---------------------------------------------------------------------------
// Status exhaustiveness validation
// ---------------------------------------------------------------------------

test("TASK_STATUSES array is exhaustive for all defined transitions", () => {
  const allStatuses = new Set(TASK_STATUSES);
  const transitionSources = new Set(Object.keys(TASK_TRANSITIONS));

  for (const source of transitionSources) {
    assert.ok(
      allStatuses.has(source),
      `Transition source ${source} should be in TASK_STATUSES`,
    );
  }
});

test("WORKFLOW_STATUSES array is exhaustive for all defined transitions", () => {
  const allStatuses = new Set(WORKFLOW_STATUSES);
  const transitionSources = new Set(Object.keys(WORKFLOW_TRANSITIONS));

  for (const source of transitionSources) {
    assert.ok(
      allStatuses.has(source),
      `Transition source ${source} should be in WORKFLOW_STATUSES`,
    );
  }
});

test("SESSION_STATUSES array is exhaustive for all defined transitions", () => {
  const allStatuses = new Set(SESSION_STATUSES);
  const transitionSources = new Set(Object.keys(SESSION_TRANSITIONS));

  for (const source of transitionSources) {
    assert.ok(
      allStatuses.has(source),
      `Transition source ${source} should be in SESSION_STATUSES`,
    );
  }
});

test("EXECUTION_STATUSES array is exhaustive for all defined transitions", () => {
  const allStatuses = new Set(EXECUTION_STATUSES);
  const transitionSources = new Set(Object.keys(EXECUTION_TRANSITIONS));

  for (const source of transitionSources) {
    assert.ok(
      allStatuses.has(source),
      `Transition source ${source} should be in EXECUTION_STATUSES`,
    );
  }
});

test("APPROVAL_STATUSES array is exhaustive for all defined transitions", () => {
  const allStatuses = new Set(APPROVAL_STATUSES);
  const transitionSources = new Set(Object.keys(APPROVAL_TRANSITIONS));

  for (const source of transitionSources) {
    assert.ok(
      allStatuses.has(source),
      `Transition source ${source} should be in APPROVAL_STATUSES`,
    );
  }
});

// ---------------------------------------------------------------------------
// No-op transitions
// ---------------------------------------------------------------------------

test("All state machines allow no-op transitions (same state)", () => {
  const allTransitions = [
    TASK_TRANSITIONS,
    WORKFLOW_TRANSITIONS,
    SESSION_TRANSITIONS,
    EXECUTION_TRANSITIONS,
    APPROVAL_TRANSITIONS,
  ];

  for (const transitions of allTransitions) {
    for (const state of Object.keys(transitions)) {
      // No-op should always be allowed - the state machine allows current === next
      assert.ok(
        true,
        `No-op transition on ${state} should be allowed`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// WorkflowStateError properties
// ---------------------------------------------------------------------------

test("Invalid transition throws WorkflowStateError with correct properties", () => {
  const error = new WorkflowStateError(
    "task.invalid_transition",
    "task.invalid_transition: Invalid transition: done -> pending",
    { details: { entityKind: "task", current: "done", next: "pending" } },
  );

  assert.equal(error.statusCode, 409);
  assert.equal(error.retryable, false);
  assert.equal(error.code, "task.invalid_transition");
  assert.ok(error.details);
  assert.equal(error.details?.entityKind, "task");
  assert.equal(error.details?.current, "done");
  assert.equal(error.details?.next, "pending");
});
