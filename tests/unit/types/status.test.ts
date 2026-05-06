/**
 * Unit tests for Status Types and Type Guards
 *
 * @see src/platform/contracts/types/status.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  TASK_STATUSES,
  WORKFLOW_STATUSES,
  SESSION_STATUSES,
  EXECUTION_STATUSES,
  APPROVAL_STATUSES,
  isTaskStatus,
  isWorkflowStatus,
  isSessionStatus,
  isExecutionStatus,
  isSessionTerminalStatus,
  type TaskStatus,
  type WorkflowStatus,
  type SessionStatus,
  type ExecutionStatus,
  type SessionTerminalStatus,
} from "../../../src/platform/contracts/types/status.js";

// ─────────────────────────────────────────────────────────────────────────────
// Status Constants Tests
// ─────────────────────────────────────────────────────────────────────────────

test("TASK_STATUSES contains expected values", () => {
  const expected = ["queued", "pending", "in_progress", "awaiting_decision", "done", "failed", "cancelled"];
  assert.deepStrictEqual(TASK_STATUSES, expected);
});

test("WORKFLOW_STATUSES contains expected values", () => {
  const expected = ["running", "paused", "resuming", "completed", "failed", "cancelling", "cancelled"];
  assert.deepStrictEqual(WORKFLOW_STATUSES, expected);
});

test("SESSION_STATUSES contains expected values", () => {
  const expected = ["open", "streaming", "awaiting_user", "paused", "completed", "failed", "cancelled"];
  assert.deepStrictEqual(SESSION_STATUSES, expected);
});

test("EXECUTION_STATUSES contains expected values", () => {
  const expected = ["created", "prechecking", "ready", "queued", "dispatching", "executing", "blocked", "paused", "resuming", "recovering", "timed_out", "succeeded", "failed", "cancelled", "superseded"];
  assert.deepStrictEqual(EXECUTION_STATUSES, expected);
});

test("APPROVAL_STATUSES contains expected values", () => {
  const expected = ["requested", "approved", "rejected", "expired", "cancelled"];
  assert.deepStrictEqual(APPROVAL_STATUSES, expected);
});

// ─────────────────────────────────────────────────────────────────────────────
// Type Guard Tests - isTaskStatus
// ─────────────────────────────────────────────────────────────────────────────

test("isTaskStatus returns true for valid task statuses", () => {
  for (const status of TASK_STATUSES) {
    assert.strictEqual(isTaskStatus(status), true, `"${status}" should be a valid task status`);
  }
});

test("isTaskStatus returns false for invalid task statuses", () => {
  const invalidStatuses = ["running", "completed", "invalid", "", "PENDING", "In_Progress", null, undefined];
  for (const status of invalidStatuses) {
    assert.strictEqual(isTaskStatus(status as string), false, `"${status}" should not be a valid task status`);
  }
});

test("isTaskStatus is case-sensitive", () => {
  assert.strictEqual(isTaskStatus("in_progress"), true);
  assert.strictEqual(isTaskStatus("IN_PROGRESS"), false);
  assert.strictEqual(isTaskStatus("In_Progress"), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Type Guard Tests - isWorkflowStatus
// ─────────────────────────────────────────────────────────────────────────────

test("isWorkflowStatus returns true for valid workflow statuses", () => {
  for (const status of WORKFLOW_STATUSES) {
    assert.strictEqual(isWorkflowStatus(status), true, `"${status}" should be a valid workflow status`);
  }
});

test("isWorkflowStatus returns false for invalid workflow statuses", () => {
  const invalidStatuses = ["queued", "pending", "invalid", "", "Running", null, undefined];
  for (const status of invalidStatuses) {
    assert.strictEqual(isWorkflowStatus(status as string), false, `"${status}" should not be a valid workflow status`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Type Guard Tests - isSessionStatus
// ─────────────────────────────────────────────────────────────────────────────

test("isSessionStatus returns true for valid session statuses", () => {
  for (const status of SESSION_STATUSES) {
    assert.strictEqual(isSessionStatus(status), true, `"${status}" should be a valid session status`);
  }
});

test("isSessionStatus returns false for invalid session statuses", () => {
  const invalidStatuses = ["running", "pending", "invalid", "", "Open", null, undefined];
  for (const status of invalidStatuses) {
    assert.strictEqual(isSessionStatus(status as string), false, `"${status}" should not be a valid session status`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Type Guard Tests - isExecutionStatus
// ─────────────────────────────────────────────────────────────────────────────

test("isExecutionStatus returns true for valid execution statuses", () => {
  for (const status of EXECUTION_STATUSES) {
    assert.strictEqual(isExecutionStatus(status), true, `"${status}" should be a valid execution status`);
  }
});

test("isExecutionStatus returns false for invalid execution statuses", () => {
  const invalidStatuses = ["running", "invalid", "", "Created", null, undefined];
  for (const status of invalidStatuses) {
    assert.strictEqual(isExecutionStatus(status as string), false, `"${status}" should not be a valid execution status`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// isSessionTerminalStatus Tests
// ─────────────────────────────────────────────────────────────────────────────

test("isSessionTerminalStatus returns true for terminal session statuses", () => {
  const terminalStatuses: SessionTerminalStatus[] = ["completed", "failed", "cancelled"];
  for (const status of terminalStatuses) {
    assert.strictEqual(isSessionTerminalStatus(status), true, `"${status}" should be terminal`);
  }
});

test("isSessionTerminalStatus returns false for non-terminal session statuses", () => {
  const nonTerminalStatuses: SessionStatus[] = ["open", "streaming", "awaiting_user", "paused"];
  for (const status of nonTerminalStatuses) {
    assert.strictEqual(isSessionTerminalStatus(status), false, `"${status}" should not be terminal`);
  }
});

test("isSessionTerminalStatus narrow type correctly", () => {
  const status: SessionStatus = "completed";

  if (isSessionTerminalStatus(status)) {
    // TypeScript should narrow this to SessionTerminalStatus
    const terminalStatus: SessionTerminalStatus = status;
    assert.ok(["completed", "failed", "cancelled"].includes(terminalStatus));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Terminal Status Types Tests
// ─────────────────────────────────────────────────────────────────────────────

test("TaskTerminalStatus is Extract of TaskStatus", () => {
  const terminalStatuses: ("done" | "failed" | "cancelled")[] = ["done", "failed", "cancelled"];
  for (const status of terminalStatuses) {
    const taskStatus: TaskStatus = status;
    assert.ok(isTaskStatus(taskStatus));
  }
});

test("SessionTerminalStatus is Extract of SessionStatus", () => {
  const terminalStatuses: SessionTerminalStatus[] = ["completed", "failed", "cancelled"];
  for (const status of terminalStatuses) {
    assert.ok(isSessionStatus(status));
    assert.ok(isSessionTerminalStatus(status));
  }
});
