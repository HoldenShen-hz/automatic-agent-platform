import assert from "node:assert/strict";
import test from "node:test";

import { StateTransitionMachine } from "../../../../../src/platform/execution/state-transition/state-transition-machine.js";
import { WorkflowStateError } from "../../../../../src/platform/contracts/errors.js";
import type {
  TaskStatus,
  WorkflowStatus,
  ExecutionStatus,
  SessionStatus,
  ApprovalStatus,
} from "../../../../../src/platform/contracts/types/status.js";

// ---------------------------------------------------------------------------
// Transition maps extracted from transition-service.ts
// ---------------------------------------------------------------------------

const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  queued: ["pending", "in_progress", "cancelled"],
  pending: ["in_progress", "cancelled"],
  in_progress: ["awaiting_decision", "done", "failed", "cancelled"],
  awaiting_decision: ["in_progress", "failed", "cancelled"],
  done: [],
  failed: [],
  cancelled: [],
};

const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, readonly WorkflowStatus[]> = {
  running: ["paused", "completed", "failed", "cancelling", "cancelled"],
  paused: ["resuming", "failed", "cancelled"],
  resuming: ["running", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelling: ["cancelled"],
  cancelled: [],
};

const EXECUTION_TRANSITIONS: Record<ExecutionStatus, readonly ExecutionStatus[]> = {
  created: ["prechecking", "cancelled", "failed"],
  prechecking: ["executing", "blocked", "cancelled", "failed"],
  executing: ["blocked", "succeeded", "failed", "cancelled"],
  blocked: ["prechecking", "executing", "cancelled", "failed", "superseded"],
  succeeded: [],
  failed: [],
  cancelled: [],
  superseded: [],
};

const SESSION_TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  open: ["streaming", "awaiting_user", "completed", "failed", "cancelled"],
  streaming: ["awaiting_user", "completed", "failed", "cancelled", "open"],
  awaiting_user: ["streaming", "completed", "failed", "cancelled"],
  paused: ["streaming", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

const APPROVAL_TRANSITIONS: Record<ApprovalStatus, readonly ApprovalStatus[]> = {
  requested: ["approved", "rejected", "expired", "cancelled"],
  approved: [],
  rejected: [],
  expired: [],
  cancelled: [],
};

// ---------------------------------------------------------------------------
// Task State Validator Tests
// ---------------------------------------------------------------------------

test("TaskStateValidator - valid linear progression", () => {
  const validator = new StateTransitionMachine("task", TASK_TRANSITIONS);

  validator.assertTransition("queued", "pending");
  validator.assertTransition("pending", "in_progress");
  validator.assertTransition("in_progress", "awaiting_decision");
  validator.assertTransition("awaiting_decision", "in_progress");
  validator.assertTransition("in_progress", "done");
});

test("TaskStateValidator - cancelled from early states", () => {
  const validator = new StateTransitionMachine("task", TASK_TRANSITIONS);

  validator.assertTransition("queued", "cancelled");
  validator.assertTransition("pending", "cancelled");
  validator.assertTransition("in_progress", "cancelled");
  validator.assertTransition("awaiting_decision", "cancelled");
});

test("TaskStateValidator - failed from in_progress", () => {
  const validator = new StateTransitionMachine("task", TASK_TRANSITIONS);

  validator.assertTransition("in_progress", "failed");
});

test("TaskStateValidator - rejects skip transitions", () => {
  const validator = new StateTransitionMachine("task", TASK_TRANSITIONS);

  assert.throws(() => validator.assertTransition("queued", "done"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("queued", "failed"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("pending", "done"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("pending", "awaiting_decision"), WorkflowStateError);
});

test("TaskStateValidator - rejects backward transitions", () => {
  const validator = new StateTransitionMachine("task", TASK_TRANSITIONS);

  assert.throws(() => validator.assertTransition("in_progress", "pending"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("pending", "queued"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("awaiting_decision", "pending"), WorkflowStateError);
});

test("TaskStateValidator - terminal states block all transitions", () => {
  const validator = new StateTransitionMachine("task", TASK_TRANSITIONS);

  // done is terminal
  assert.throws(() => validator.assertTransition("done", "failed"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("done", "in_progress"), WorkflowStateError);

  // failed is terminal
  assert.throws(() => validator.assertTransition("failed", "done"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("failed", "in_progress"), WorkflowStateError);

  // cancelled is terminal
  assert.throws(() => validator.assertTransition("cancelled", "in_progress"), WorkflowStateError);
});

test("TaskStateValidator - no-op transitions always pass", () => {
  const validator = new StateTransitionMachine("task", TASK_TRANSITIONS);

  validator.assertTransition("queued", "queued");
  validator.assertTransition("pending", "pending");
  validator.assertTransition("in_progress", "in_progress");
  validator.assertTransition("awaiting_decision", "awaiting_decision");
  validator.assertTransition("done", "done");
  validator.assertTransition("failed", "failed");
  validator.assertTransition("cancelled", "cancelled");
});

// ---------------------------------------------------------------------------
// Workflow State Validator Tests
// ---------------------------------------------------------------------------

test("WorkflowStateValidator - valid pause/resume cycle", () => {
  const validator = new StateTransitionMachine("workflow", WORKFLOW_TRANSITIONS);

  validator.assertTransition("running", "paused");
  validator.assertTransition("paused", "resuming");
  validator.assertTransition("resuming", "running");
});

test("WorkflowStateValidator - valid cancellation flow", () => {
  const validator = new StateTransitionMachine("workflow", WORKFLOW_TRANSITIONS);

  validator.assertTransition("running", "cancelling");
  validator.assertTransition("cancelling", "cancelled");
});

test("WorkflowStateValidator - terminal states block all transitions", () => {
  const validator = new StateTransitionMachine("workflow", WORKFLOW_TRANSITIONS);

  // completed is terminal
  assert.throws(() => validator.assertTransition("completed", "running"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("completed", "failed"), WorkflowStateError);

  // failed is terminal
  assert.throws(() => validator.assertTransition("failed", "completed"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("failed", "running"), WorkflowStateError);

  // cancelled is terminal
  assert.throws(() => validator.assertTransition("cancelled", "running"), WorkflowStateError);
});

test("WorkflowStateValidator - cannot cancel completed workflow", () => {
  const validator = new StateTransitionMachine("workflow", WORKFLOW_TRANSITIONS);

  assert.throws(() => validator.assertTransition("completed", "cancelling"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("failed", "cancelling"), WorkflowStateError);
});

test("WorkflowStateValidator - no-op transitions pass", () => {
  const validator = new StateTransitionMachine("workflow", WORKFLOW_TRANSITIONS);

  validator.assertTransition("running", "running");
  validator.assertTransition("completed", "completed");
  validator.assertTransition("failed", "failed");
  validator.assertTransition("cancelled", "cancelled");
});

// ---------------------------------------------------------------------------
// Execution State Validator Tests
// ---------------------------------------------------------------------------

test("ExecutionStateValidator - happy path", () => {
  const validator = new StateTransitionMachine("execution", EXECUTION_TRANSITIONS);

  validator.assertTransition("created", "prechecking");
  validator.assertTransition("prechecking", "executing");
  validator.assertTransition("executing", "succeeded");
});

test("ExecutionStateValidator - blocked path", () => {
  const validator = new StateTransitionMachine("execution", EXECUTION_TRANSITIONS);

  validator.assertTransition("created", "prechecking");
  validator.assertTransition("prechecking", "blocked");
  validator.assertTransition("blocked", "executing");
  validator.assertTransition("executing", "succeeded");
});

test("ExecutionStateValidator - can resume from blocked", () => {
  const validator = new StateTransitionMachine("execution", EXECUTION_TRANSITIONS);

  validator.assertTransition("blocked", "prechecking");
  validator.assertTransition("blocked", "executing");
  validator.assertTransition("blocked", "cancelled");
  validator.assertTransition("blocked", "failed");
  validator.assertTransition("blocked", "superseded");
});

test("ExecutionStateValidator - all terminal states block transitions", () => {
  const validator = new StateTransitionMachine("execution", EXECUTION_TRANSITIONS);

  assert.throws(() => validator.assertTransition("succeeded", "executing"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("succeeded", "failed"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("failed", "succeeded"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("failed", "executing"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("cancelled", "executing"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("superseded", "executing"), WorkflowStateError);
});

test("ExecutionStateValidator - no-op transitions pass", () => {
  const validator = new StateTransitionMachine("execution", EXECUTION_TRANSITIONS);

  validator.assertTransition("created", "created");
  validator.assertTransition("executing", "executing");
  validator.assertTransition("succeeded", "succeeded");
  validator.assertTransition("superseded", "superseded");
});

// ---------------------------------------------------------------------------
// Session State Validator Tests
// ---------------------------------------------------------------------------

test("SessionStateValidator - open to streaming to awaiting_user", () => {
  const validator = new StateTransitionMachine("session", SESSION_TRANSITIONS);

  validator.assertTransition("open", "streaming");
  validator.assertTransition("streaming", "awaiting_user");
});

test("SessionStateValidator - streaming can return to open for recovery", () => {
  const validator = new StateTransitionMachine("session", SESSION_TRANSITIONS);

  validator.assertTransition("streaming", "open");
});

test("SessionStateValidator - awaiting_user can go to streaming", () => {
  const validator = new StateTransitionMachine("session", SESSION_TRANSITIONS);

  validator.assertTransition("awaiting_user", "streaming");
});

test("SessionStateValidator - paused can resume to streaming", () => {
  const validator = new StateTransitionMachine("session", SESSION_TRANSITIONS);

  validator.assertTransition("paused", "streaming");
});

test("SessionStateValidator - terminal states block all transitions", () => {
  const validator = new StateTransitionMachine("session", SESSION_TRANSITIONS);

  assert.throws(() => validator.assertTransition("completed", "streaming"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("failed", "streaming"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("cancelled", "streaming"), WorkflowStateError);
});

test("SessionStateValidator - no-op transitions pass", () => {
  const validator = new StateTransitionMachine("session", SESSION_TRANSITIONS);

  validator.assertTransition("open", "open");
  validator.assertTransition("streaming", "streaming");
  validator.assertTransition("awaiting_user", "awaiting_user");
  validator.assertTransition("completed", "completed");
});

// ---------------------------------------------------------------------------
// Approval State Validator Tests
// ---------------------------------------------------------------------------

test("ApprovalStateValidator - requested to approved", () => {
  const validator = new StateTransitionMachine("approval", APPROVAL_TRANSITIONS);

  validator.assertTransition("requested", "approved");
});

test("ApprovalStateValidator - requested to rejected", () => {
  const validator = new StateTransitionMachine("approval", APPROVAL_TRANSITIONS);

  validator.assertTransition("requested", "rejected");
});

test("ApprovalStateValidator - requested to expired", () => {
  const validator = new StateTransitionMachine("approval", APPROVAL_TRANSITIONS);

  validator.assertTransition("requested", "expired");
});

test("ApprovalStateValidator - requested to cancelled", () => {
  const validator = new StateTransitionMachine("approval", APPROVAL_TRANSITIONS);

  validator.assertTransition("requested", "cancelled");
});

test("ApprovalStateValidator - terminal states block all transitions", () => {
  const validator = new StateTransitionMachine("approval", APPROVAL_TRANSITIONS);

  assert.throws(() => validator.assertTransition("approved", "rejected"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("approved", "expired"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("rejected", "approved"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("expired", "cancelled"), WorkflowStateError);
  assert.throws(() => validator.assertTransition("cancelled", "approved"), WorkflowStateError);
});

test("ApprovalStateValidator - no-op transitions pass", () => {
  const validator = new StateTransitionMachine("approval", APPROVAL_TRANSITIONS);

  validator.assertTransition("requested", "requested");
  validator.assertTransition("approved", "approved");
  validator.assertTransition("rejected", "rejected");
  validator.assertTransition("expired", "expired");
  validator.assertTransition("cancelled", "cancelled");
});

// ---------------------------------------------------------------------------
// WorkflowStateError Properties
// ---------------------------------------------------------------------------

test("WorkflowStateError contains correct entityKind in details", () => {
  const validator = new StateTransitionMachine("task", TASK_TRANSITIONS);

  try {
    validator.assertTransition("queued", "done");
    assert.fail("Expected error");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    const error = err as WorkflowStateError & { details?: { entityKind: string; current: string; next: string } };
    assert.equal(error.details?.entityKind, "task");
    assert.equal(error.details?.current, "queued");
    assert.equal(error.details?.next, "done");
  }
});

test("WorkflowStateError has correct error code format", () => {
  const validator = new StateTransitionMachine("execution", EXECUTION_TRANSITIONS);

  try {
    validator.assertTransition("succeeded", "executing");
    assert.fail("Expected error");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    assert.ok(err.message.includes("execution.invalid_transition"));
  }
});

test("WorkflowStateError is not retryable by default", () => {
  const validator = new StateTransitionMachine("task", TASK_TRANSITIONS);

  try {
    validator.assertTransition("done", "in_progress");
    assert.fail("Expected error");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    assert.equal((err as WorkflowStateError).retryable, false);
  }
});

test("WorkflowStateError has 409 Conflict status code", () => {
  const validator = new StateTransitionMachine("task", TASK_TRANSITIONS);

  try {
    validator.assertTransition("done", "in_progress");
    assert.fail("Expected error");
  } catch (err) {
    assert.ok(err instanceof WorkflowStateError);
    assert.equal((err as WorkflowStateError).statusCode, 409);
  }
});

// ---------------------------------------------------------------------------
// Terminal State Cascade Mapping Tests
// ---------------------------------------------------------------------------

test("Task terminal 'done' maps to correct terminal states for cascade", () => {
  const taskValidator = new StateTransitionMachine("task", TASK_TRANSITIONS);
  const workflowValidator = new StateTransitionMachine("workflow", WORKFLOW_TRANSITIONS);
  const sessionValidator = new StateTransitionMachine("session", SESSION_TRANSITIONS);
  const executionValidator = new StateTransitionMachine("execution", EXECUTION_TRANSITIONS);

  // Task done -> workflow completed, session completed, execution succeeded
  taskValidator.assertTransition("in_progress", "done");
  workflowValidator.assertTransition("running", "completed");
  sessionValidator.assertTransition("streaming", "completed");
  executionValidator.assertTransition("executing", "succeeded");
});

test("Task terminal 'failed' maps to correct terminal states for cascade", () => {
  const taskValidator = new StateTransitionMachine("task", TASK_TRANSITIONS);
  const workflowValidator = new StateTransitionMachine("workflow", WORKFLOW_TRANSITIONS);
  const sessionValidator = new StateTransitionMachine("session", SESSION_TRANSITIONS);
  const executionValidator = new StateTransitionMachine("execution", EXECUTION_TRANSITIONS);

  // Task failed -> workflow failed, session failed, execution failed
  taskValidator.assertTransition("in_progress", "failed");
  workflowValidator.assertTransition("running", "failed");
  sessionValidator.assertTransition("streaming", "failed");
  executionValidator.assertTransition("executing", "failed");
});

test("Task terminal 'cancelled' maps to correct terminal states for cascade", () => {
  const taskValidator = new StateTransitionMachine("task", TASK_TRANSITIONS);
  const workflowValidator = new StateTransitionMachine("workflow", WORKFLOW_TRANSITIONS);
  const sessionValidator = new StateTransitionMachine("session", SESSION_TRANSITIONS);
  const executionValidator = new StateTransitionMachine("execution", EXECUTION_TRANSITIONS);

  // Task cancelled -> workflow cancelled, session cancelled, execution cancelled
  taskValidator.assertTransition("in_progress", "cancelled");
  workflowValidator.assertTransition("running", "cancelled");
  sessionValidator.assertTransition("streaming", "cancelled");
  executionValidator.assertTransition("executing", "cancelled");
});
