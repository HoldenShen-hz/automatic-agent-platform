import test from "node:test";
import assert from "node:assert/strict";
import {
  isSessionTerminalStatus,
  isTaskActiveStatus,
  createRecoverySession,
  type SessionTerminalStatus,
  type TaskActiveStatus,
} from "../../../../src/platform/five-plane-execution/execution-engine/session-lifecycle.js";
import type { SessionRecord, TaskRecord } from "../../../../src/platform/five-plane-execution/contracts/types/domain.js";

test("isSessionTerminalStatus returns true for completed", () => {
  assert.equal(isSessionTerminalStatus("completed"), true);
});

test("isSessionTerminalStatus returns true for failed", () => {
  assert.equal(isSessionTerminalStatus("failed"), true);
});

test("isSessionTerminalStatus returns true for cancelled", () => {
  assert.equal(isSessionTerminalStatus("cancelled"), true);
});

test("isSessionTerminalStatus returns false for open", () => {
  assert.equal(isSessionTerminalStatus("open"), false);
});

test("isSessionTerminalStatus returns false for streaming", () => {
  assert.equal(isSessionTerminalStatus("streaming"), false);
});

test("SessionTerminalStatus type is properly exported", () => {
  const status: SessionTerminalStatus = "completed";
  assert.equal(status, "completed");
});

test("isTaskActiveStatus returns true for queued", () => {
  const task = { status: "queued" } as TaskRecord;
  assert.equal(isTaskActiveStatus(task.status), true);
});

test("isTaskActiveStatus returns true for pending", () => {
  const task = { status: "pending" } as TaskRecord;
  assert.equal(isTaskActiveStatus(task.status), true);
});

test("isTaskActiveStatus returns true for in_progress", () => {
  const task = { status: "in_progress" } as TaskRecord;
  assert.equal(isTaskActiveStatus(task.status), true);
});

test("isTaskActiveStatus returns true for awaiting_decision", () => {
  const task = { status: "awaiting_decision" } as TaskRecord;
  assert.equal(isTaskActiveStatus(task.status), true);
});

test("isTaskActiveStatus returns false for done", () => {
  const task = { status: "done" } as TaskRecord;
  assert.equal(isTaskActiveStatus(task.status), false);
});

test("isTaskActiveStatus returns false for failed", () => {
  const task = { status: "failed" } as TaskRecord;
  assert.equal(isTaskActiveStatus(task.status), false);
});

test("TaskActiveStatus type is properly exported", () => {
  const status: TaskActiveStatus = "in_progress";
  assert.equal(status, "in_progress");
});

test("createRecoverySession creates new session with new ID", () => {
  const originalSession: SessionRecord = {
    id: "sess_original",
    taskId: "task_123",
    channel: "cli",
    status: "failed",
    externalSessionId: "ext_456",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const recoverySession = createRecoverySession(originalSession, "2024-01-02T00:00:00.000Z");

  assert.notEqual(recoverySession.id, originalSession.id);
  assert.ok(recoverySession.id.startsWith("sess:"));
  assert.equal(recoverySession.taskId, originalSession.taskId);
  assert.equal(recoverySession.channel, originalSession.channel);
  assert.equal(recoverySession.status, "open");
  assert.equal(recoverySession.externalSessionId, originalSession.externalSessionId);
});

test("createRecoverySession sets createdAt and updatedAt to occurredAt", () => {
  const originalSession: SessionRecord = {
    id: "sess_original",
    taskId: "task_123",
    channel: "cli",
    status: "failed",
    externalSessionId: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const occurredAt = "2024-01-02T00:00:00.000Z";
  const recoverySession = createRecoverySession(originalSession, occurredAt);

  assert.equal(recoverySession.createdAt, occurredAt);
  assert.equal(recoverySession.updatedAt, occurredAt);
});

test("createRecoverySession preserves externalSessionId when null", () => {
  const originalSession: SessionRecord = {
    id: "sess_original",
    taskId: "task_123",
    channel: "cli",
    status: "failed",
    externalSessionId: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const recoverySession = createRecoverySession(originalSession, "2024-01-02T00:00:00.000Z");

  assert.strictEqual(recoverySession.externalSessionId, null);
});

test("createRecoverySession preserves externalSessionId when present", () => {
  const originalSession: SessionRecord = {
    id: "sess_original",
    taskId: "task_123",
    channel: "cli",
    status: "failed",
    externalSessionId: "ext_abc",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const recoverySession = createRecoverySession(originalSession, "2024-01-02T00:00:00.000Z");

  assert.equal(recoverySession.externalSessionId, "ext_abc");
});

test("createRecoverySession works for all terminal session statuses", () => {
  const statuses: SessionTerminalStatus[] = ["completed", "failed", "cancelled"];

  for (const status of statuses) {
    const session: SessionRecord = {
      id: "sess_test",
      taskId: "task_123",
      channel: "web",
      status,
      externalSessionId: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    const recoverySession = createRecoverySession(session, "2024-01-02T00:00:00.000Z");

    assert.equal(recoverySession.status, "open");
    assert.notEqual(recoverySession.id, session.id);
  }
});

test("isSessionTerminalStatus type guard narrows correctly", () => {
  const statuses = ["completed", "failed", "cancelled", "open", "streaming"] as const;

  for (const status of statuses) {
    if (isSessionTerminalStatus(status)) {
      // TypeScript should narrow to SessionTerminalStatus here
      const terminalStatus: SessionTerminalStatus = status;
      assert.ok(["completed", "failed", "cancelled"].includes(terminalStatus));
    }
  }
});

test("isTaskActiveStatus type guard narrows correctly", () => {
  const statuses = ["queued", "pending", "in_progress", "awaiting_decision", "done", "failed", "cancelled"] as const;

  for (const status of statuses) {
    if (isTaskActiveStatus({ status } as TaskRecord)) {
      // TypeScript should narrow to TaskActiveStatus here
      const activeStatus: TaskActiveStatus = status;
      assert.ok(["queued", "pending", "in_progress", "awaiting_decision"].includes(activeStatus));
    }
  }
});
