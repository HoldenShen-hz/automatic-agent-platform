import assert from "node:assert/strict";
import test from "node:test";

import { StateTransitionMachine } from "../../../../../src/platform/five-plane-execution/state-transition/state-transition-machine.js";
import { WorkflowStateError } from "../../../../../src/platform/contracts/errors.js";

/**
 * ApprovalStateMachine tests
 *
 * Tests the state machine that governs approval lifecycle transitions.
 * Approvals track human authorization decisions with states:
 * - requested: initial state when approval is requested
 * - approved: human approved the request
 * - rejected: human rejected the request
 * - expired: approval request timed out
 * - cancelled: approval was cancelled
 */

// Transition map matching APPROVAL_TRANSITIONS from transition-service.ts
const APPROVAL_TRANSITIONS: Record<string, readonly string[]> = {
  requested: ["approved", "rejected", "expired", "cancelled"],
  approved: [],
  rejected: [],
  expired: [],
  cancelled: [],
};

function createApprovalStateMachine(): StateTransitionMachine<string> {
  return new StateTransitionMachine("approval", APPROVAL_TRANSITIONS);
}

// ---------------------------------------------------------------------------
// Valid transitions from requested
// ---------------------------------------------------------------------------

test("ApprovalStateMachine: allows requested -> approved [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  machine.assertTransition("requested", "approved");
});

test("ApprovalStateMachine: allows requested -> rejected [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  machine.assertTransition("requested", "rejected");
});

test("ApprovalStateMachine: allows requested -> expired [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  machine.assertTransition("requested", "expired");
});

test("ApprovalStateMachine: allows requested -> cancelled [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  machine.assertTransition("requested", "cancelled");
});

// ---------------------------------------------------------------------------
// Invalid transitions from approved (terminal)
// ---------------------------------------------------------------------------

test("ApprovalStateMachine: rejects approved -> rejected [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  assert.throws(
    () => machine.assertTransition("approved", "rejected"),
    WorkflowStateError,
  );
});

test("ApprovalStateMachine: rejects approved -> expired [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  assert.throws(
    () => machine.assertTransition("approved", "expired"),
    WorkflowStateError,
  );
});

test("ApprovalStateMachine: rejects approved -> cancelled [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  assert.throws(
    () => machine.assertTransition("approved", "cancelled"),
    WorkflowStateError,
  );
});

test("ApprovalStateMachine: rejects approved -> requested [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  assert.throws(
    () => machine.assertTransition("approved", "requested"),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// Invalid transitions from rejected (terminal)
// ---------------------------------------------------------------------------

test("ApprovalStateMachine: rejects rejected -> approved [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  assert.throws(
    () => machine.assertTransition("rejected", "approved"),
    WorkflowStateError,
  );
});

test("ApprovalStateMachine: rejects rejected -> expired [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  assert.throws(
    () => machine.assertTransition("rejected", "expired"),
    WorkflowStateError,
  );
});

test("ApprovalStateMachine: rejects rejected -> cancelled [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  assert.throws(
    () => machine.assertTransition("rejected", "cancelled"),
    WorkflowStateError,
  );
});

test("ApprovalStateMachine: rejects rejected -> requested [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  assert.throws(
    () => machine.assertTransition("rejected", "requested"),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// Invalid transitions from expired (terminal)
// ---------------------------------------------------------------------------

test("ApprovalStateMachine: rejects expired -> approved [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  assert.throws(
    () => machine.assertTransition("expired", "approved"),
    WorkflowStateError,
  );
});

test("ApprovalStateMachine: rejects expired -> rejected [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  assert.throws(
    () => machine.assertTransition("expired", "rejected"),
    WorkflowStateError,
  );
});

test("ApprovalStateMachine: rejects expired -> cancelled [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  assert.throws(
    () => machine.assertTransition("expired", "cancelled"),
    WorkflowStateError,
  );
});

test("ApprovalStateMachine: rejects expired -> requested [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  assert.throws(
    () => machine.assertTransition("expired", "requested"),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// Invalid transitions from cancelled (terminal)
// ---------------------------------------------------------------------------

test("ApprovalStateMachine: rejects cancelled -> approved [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  assert.throws(
    () => machine.assertTransition("cancelled", "approved"),
    WorkflowStateError,
  );
});

test("ApprovalStateMachine: rejects cancelled -> rejected [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  assert.throws(
    () => machine.assertTransition("cancelled", "rejected"),
    WorkflowStateError,
  );
});

test("ApprovalStateMachine: rejects cancelled -> expired [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  assert.throws(
    () => machine.assertTransition("cancelled", "expired"),
    WorkflowStateError,
  );
});

test("ApprovalStateMachine: rejects cancelled -> requested [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  assert.throws(
    () => machine.assertTransition("cancelled", "requested"),
    WorkflowStateError,
  );
});

// ---------------------------------------------------------------------------
// All terminal states
// ---------------------------------------------------------------------------

test("ApprovalStateMachine: all terminal states cannot transition to any other state [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  const terminalStates = ["approved", "rejected", "expired", "cancelled"];
  const allStates = ["requested", "approved", "rejected", "expired", "cancelled"];

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
// No-op transitions
// ---------------------------------------------------------------------------

test("ApprovalStateMachine: allows no-op transition on same state for requested [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  machine.assertTransition("requested", "requested");
});

test("ApprovalStateMachine: allows no-op transition on same state for approved [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  machine.assertTransition("approved", "approved");
});

test("ApprovalStateMachine: allows no-op transition on same state for rejected [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  machine.assertTransition("rejected", "rejected");
});

test("ApprovalStateMachine: allows no-op transition on same state for expired [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  machine.assertTransition("expired", "expired");
});

test("ApprovalStateMachine: allows no-op transition on same state for cancelled [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();
  machine.assertTransition("cancelled", "cancelled");
});

// ---------------------------------------------------------------------------
// Error details
// ---------------------------------------------------------------------------

test("ApprovalStateMachine: WorkflowStateError contains correct entityKind [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();

  try {
    machine.assertTransition("approved", "rejected");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError & { details?: { entityKind: string; current: string; next: string } };
    assert.equal(error.details?.entityKind, "approval");
    assert.equal(error.details?.current, "approved");
    assert.equal(error.details?.next, "rejected");
  }
});

test("ApprovalStateMachine: WorkflowStateError has statusCode 409 [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();

  try {
    machine.assertTransition("approved", "rejected");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError;
    assert.equal(error.statusCode, 409);
  }
});

test("ApprovalStateMachine: WorkflowStateError is not retryable [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();

  try {
    machine.assertTransition("approved", "rejected");
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

test("ApprovalStateMachine: error message contains invalid_transition code [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();

  try {
    machine.assertTransition("approved", "requested");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    assert.ok(err.message.includes("approval.invalid_transition"));
  }
});

// ---------------------------------------------------------------------------
// Unknown source state
// ---------------------------------------------------------------------------

test("ApprovalStateMachine: rejects unknown source state [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();

  assert.throws(
    () => machine.assertTransition("unknown_status", "approved"),
    WorkflowStateError,
  );
});

test("ApprovalStateMachine: rejects unknown target state from requested [approval-state-machine]", () => {
  const machine = createApprovalStateMachine();

  assert.throws(
    () => machine.assertTransition("requested", "unknown_status"),
    WorkflowStateError,
  );
});
