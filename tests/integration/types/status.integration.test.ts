/**
 * Integration tests for Status Types with Session Management
 *
 * @see src/platform/contracts/types/status.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  TASK_STATUSES,
  SESSION_STATUSES,
  EXECUTION_STATUSES,
  isTaskStatus,
  isSessionStatus,
  isSessionTerminalStatus,
  type SessionStatus,
} from "../../../src/platform/contracts/types/status.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";

// ─────────────────────────────────────────────────────────────────────────────
// Session Status Transitions Integration
// ─────────────────────────────────────────────────────────────────────────────

test("integration: session status transitions follow expected lifecycle", () => {
  // Session starts as open
  let status: SessionStatus = "open";
  assert.ok(isSessionStatus(status));
  assert.ok(!isSessionTerminalStatus(status));

  // Transitions to streaming
  status = "streaming";
  assert.ok(isSessionStatus(status));
  assert.ok(!isSessionTerminalStatus(status));

  // Transitions to awaiting_user
  status = "awaiting_user";
  assert.ok(isSessionStatus(status));
  assert.ok(!isSessionTerminalStatus(status));

  // Could return to streaming or go to terminal
  status = "completed";
  assert.ok(isSessionStatus(status));
  assert.ok(isSessionTerminalStatus(status));
});

test("integration: session can transition to paused then resume", () => {
  let status: SessionStatus = "open";
  assert.ok(!isSessionTerminalStatus(status));

  status = "streaming";
  assert.ok(!isSessionTerminalStatus(status));

  status = "paused";
  assert.ok(!isSessionTerminalStatus(status));

  status = "streaming";
  assert.ok(!isSessionTerminalStatus(status));
});

test("integration: failed session is terminal", () => {
  const status: SessionStatus = "failed";
  assert.ok(isSessionTerminalStatus(status));
});

test("integration: cancelled session is terminal", () => {
  const status: SessionStatus = "cancelled";
  assert.ok(isSessionTerminalStatus(status));
});

// ─────────────────────────────────────────────────────────────────────────────
// Task and Session Status Co-existence
// ─────────────────────────────────────────────────────────────────────────────

test("integration: task and session statuses are independent", () => {
  // A task can be in_progress while a session is paused
  const taskStatuses = TASK_STATUSES;
  const sessionStatuses = SESSION_STATUSES;

  // Find non-terminal statuses
  const activeTaskStatus = "in_progress";
  const activeSessionStatus = "streaming";

  assert.ok(isTaskStatus(activeTaskStatus));
  assert.ok(isSessionStatus(activeSessionStatus));
  assert.ok(!isSessionTerminalStatus(activeSessionStatus as SessionStatus));

  // They don't interfere with each other
  const terminalSessionStatus: SessionStatus = "completed";
  assert.ok(isSessionStatus(terminalSessionStatus));
  assert.ok(isSessionTerminalStatus(terminalSessionStatus));
});

// ─────────────────────────────────────────────────────────────────────────────
// Status Validation with Real Data Structures
// ─────────────────────────────────────────────────────────────────────────────

test("integration: status guards work with record creation", () => {
  const session = {
    id: newId("sess"),
    taskId: newId("task"),
    status: "open" as SessionStatus,
    channel: "api",
    externalSessionId: newId("ext"),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  // Validate initial status
  assert.ok(isSessionStatus(session.status));
  assert.ok(!isSessionTerminalStatus(session.status));

  // Simulate status update
  session.status = "streaming";
  assert.ok(isSessionStatus(session.status));
  assert.ok(!isSessionTerminalStatus(session.status));

  // Simulate terminal status
  session.status = "completed";
  assert.ok(isSessionStatus(session.status));
  assert.ok(isSessionTerminalStatus(session.status));
});

test("integration: execution and task statuses can coexist", () => {
  const executionStatuses = EXECUTION_STATUSES;
  const taskStatuses = TASK_STATUSES;

  // Verify both have terminal states
  const terminalExecStatuses = executionStatuses.filter((s) =>
    ["succeeded", "failed", "cancelled", "superseded"].includes(s)
  );
  const terminalTaskStatuses = taskStatuses.filter((s) =>
    ["done", "failed", "cancelled"].includes(s)
  );

  assert.ok(terminalExecStatuses.length > 0);
  assert.ok(terminalTaskStatuses.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Status Consistency with External Representations
// ─────────────────────────────────────────────────────────────────────────────

test("integration: status strings can be serialized and deserialized", () => {
  const originalStatus: SessionStatus = "streaming";
  const serialized = JSON.stringify(originalStatus);
  const deserialized = JSON.parse(serialized) as SessionStatus;

  assert.strictEqual(deserialized, originalStatus);
  assert.ok(isSessionStatus(deserialized));
});

test("integration: multiple statuses can be serialized as array", () => {
  const statuses: SessionStatus[] = ["open", "streaming", "awaiting_user", "completed"];
  const serialized = JSON.stringify(statuses);
  const deserialized = JSON.parse(serialized) as SessionStatus[];

  assert.deepStrictEqual(deserialized, statuses);
  for (const status of deserialized) {
    assert.ok(isSessionStatus(status));
  }
});
