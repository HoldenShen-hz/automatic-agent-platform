import assert from "node:assert/strict";
import test from "node:test";

import {
  isSessionTerminalStatus,
  isTaskActiveStatus,
  createRecoverySession,
  type SessionTerminalStatus,
  type TaskActiveStatus,
} from "../../../../../src/platform/five-plane-execution/execution-engine/session-lifecycle.js";

import type { SessionRecord, TaskRecord } from "../../../../../src/platform/contracts/types/domain.js";
import type { SessionStatus, TaskStatus } from "../../../../../src/platform/contracts/types/status.js";

test("isSessionTerminalStatus returns true for completed [session-lifecycle]", () => {
  assert.equal(isSessionTerminalStatus("completed"), true, "completed should be terminal");
});

test("isSessionTerminalStatus returns true for failed [session-lifecycle]", () => {
  assert.equal(isSessionTerminalStatus("failed"), true, "failed should be terminal");
});

test("isSessionTerminalStatus returns true for cancelled [session-lifecycle]", () => {
  assert.equal(isSessionTerminalStatus("cancelled"), true, "cancelled should be terminal");
});

test("isSessionTerminalStatus returns false for open [session-lifecycle]", () => {
  assert.equal(isSessionTerminalStatus("open"), false, "open should not be terminal");
});

test("isSessionTerminalStatus returns false for streaming [session-lifecycle]", () => {
  assert.equal(isSessionTerminalStatus("streaming"), false, "streaming should not be terminal");
});

test("isSessionTerminalStatus returns false for paused [session-lifecycle]", () => {
  assert.equal(isSessionTerminalStatus("paused"), false, "paused should not be terminal");
});

test("isTaskActiveStatus returns true for queued [session-lifecycle]", () => {
  assert.equal(isTaskActiveStatus("queued"), true, "queued should be active");
});

test("isTaskActiveStatus returns true for pending [session-lifecycle]", () => {
  assert.equal(isTaskActiveStatus("pending"), true, "pending should be active");
});

test("isTaskActiveStatus returns true for in_progress [session-lifecycle]", () => {
  assert.equal(isTaskActiveStatus("in_progress"), true, "in_progress should be active");
});

test("isTaskActiveStatus returns true for awaiting_decision [session-lifecycle]", () => {
  assert.equal(isTaskActiveStatus("awaiting_decision"), true, "awaiting_decision should be active");
});

test("isTaskActiveStatus returns false for done [session-lifecycle]", () => {
  assert.equal(isTaskActiveStatus("done"), false, "done should not be active");
});

test("isTaskActiveStatus returns false for failed [session-lifecycle]", () => {
  assert.equal(isTaskActiveStatus("failed"), false, "failed should not be active");
});

test("isTaskActiveStatus returns false for cancelled [session-lifecycle]", () => {
  assert.equal(isTaskActiveStatus("cancelled"), false, "cancelled should not be active");
});

test("createRecoverySession creates new session with open status [session-lifecycle]", () => {
  const originalSession: SessionRecord = {
    id: "sess_original_123",
    taskId: "task_123",
    channel: "cli",
    status: "failed",
    externalSessionId: "ext_123",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const occurredAt = "2024-01-02T00:00:00.000Z";
  const recoverySession = createRecoverySession(originalSession, occurredAt);

  assert.notEqual(recoverySession.id, originalSession.id, "recovery session should have new ID");
  assert.equal(recoverySession.taskId, originalSession.taskId, "taskId should be preserved");
  assert.equal(recoverySession.channel, originalSession.channel, "channel should be preserved");
  assert.equal(recoverySession.status, "open", "status should be open");
  assert.equal(recoverySession.externalSessionId, originalSession.externalSessionId, "externalSessionId should be preserved");
  assert.equal(recoverySession.createdAt, occurredAt, "createdAt should be occurrence time");
  assert.equal(recoverySession.updatedAt, occurredAt, "updatedAt should be occurrence time");
});

test("createRecoverySession generates valid session ID [session-lifecycle]", () => {
  const session: SessionRecord = {
    id: "sess_abc",
    taskId: "task_123",
    channel: "api",
    status: "failed",
    externalSessionId: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const recoverySession = createRecoverySession(session, "2024-01-02T00:00:00.000Z");

  assert.ok(recoverySession.id.startsWith("sess_"), "recovery session ID should start with sess_");
});

test("createRecoverySession preserves channel for different channels [session-lifecycle]", () => {
  const channels = ["cli", "api", "webhook", "websocket"] as const;

  for (const channel of channels) {
    const session: SessionRecord = {
      id: "sess_test",
      taskId: "task_test",
      channel,
      status: "failed",
      externalSessionId: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    const recoverySession = createRecoverySession(session, "2024-01-02T00:00:00.000Z");
    assert.equal(recoverySession.channel, channel, `channel ${channel} should be preserved`);
  }
});

test("SessionTerminalStatus type correctly extracts terminal statuses [session-lifecycle]", () => {
  const terminalStatuses: SessionTerminalStatus[] = ["completed", "failed", "cancelled"];

  for (const status of terminalStatuses) {
    const result = isSessionTerminalStatus(status);
    assert.equal(result, true, `${status} should be detected as terminal`);
  }
});

test("TaskActiveStatus type correctly extracts active statuses [session-lifecycle]", () => {
  const activeStatuses: TaskActiveStatus[] = ["queued", "pending", "in_progress", "awaiting_decision"];

  for (const status of activeStatuses) {
    const result = isTaskActiveStatus(status);
    assert.equal(result, true, `${status} should be detected as active`);
  }
});

test("isSessionTerminalStatus handles all SessionStatus values [session-lifecycle]", () => {
  const allStatuses: SessionStatus[] = ["open", "streaming", "paused", "completed", "failed", "cancelled"];

  for (const status of allStatuses) {
    const result = isSessionTerminalStatus(status);
    if (status === "completed" || status === "failed" || status === "cancelled") {
      assert.equal(result, true, `${status} should be terminal`);
    } else {
      assert.equal(result, false, `${status} should not be terminal`);
    }
  }
});

test("isTaskActiveStatus handles all TaskStatus values [session-lifecycle]", () => {
  const allStatuses: TaskStatus[] = ["queued", "pending", "in_progress", "awaiting_decision", "done", "failed", "cancelled"];

  for (const status of allStatuses) {
    const result = isTaskActiveStatus(status);
    if (status === "queued" || status === "pending" || status === "in_progress" || status === "awaiting_decision") {
      assert.equal(result, true, `${status} should be active`);
    } else {
      assert.equal(result, false, `${status} should not be active`);
    }
  }
});

test("createRecoverySession with different original statuses [session-lifecycle]", () => {
  const statuses = ["failed", "cancelled", "completed"] as const;

  for (const status of statuses) {
    const session: SessionRecord = {
      id: "sess_original",
      taskId: "task_123",
      channel: "cli",
      status,
      externalSessionId: "ext_456",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    const recoverySession = createRecoverySession(session, "2024-01-02T00:00:00.000Z");

    assert.equal(recoverySession.status, "open", `recovery session from ${status} should have open status`);
    assert.notEqual(recoverySession.id, session.id, "recovery session should have different ID");
  }
});

test("createRecoverySession handles null externalSessionId [session-lifecycle]", () => {
  const session: SessionRecord = {
    id: "sess_original",
    taskId: "task_123",
    channel: "cli",
    status: "failed",
    externalSessionId: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const recoverySession = createRecoverySession(session, "2024-01-02T00:00:00.000Z");

  assert.equal(recoverySession.externalSessionId, null, "null externalSessionId should be preserved");
});

test("isSessionTerminalStatus is a type guard [session-lifecycle]", () => {
  function checkTerminal(status: SessionStatus): boolean {
    if (isSessionTerminalStatus(status)) {
      // Within this block, TypeScript should know status is SessionTerminalStatus
      return true;
    }
    return false;
  }

  assert.equal(checkTerminal("completed"), true);
  assert.equal(checkTerminal("failed"), true);
  assert.equal(checkTerminal("cancelled"), true);
  assert.equal(checkTerminal("open"), false);
});

test("isTaskActiveStatus is a type guard [session-lifecycle]", () => {
  function checkActive(status: TaskStatus): boolean {
    if (isTaskActiveStatus(status)) {
      // Within this block, TypeScript should know status is TaskActiveStatus
      return true;
    }
    return false;
  }

  assert.equal(checkActive("in_progress"), true);
  assert.equal(checkActive("queued"), true);
  assert.equal(checkActive("done"), false);
  assert.equal(checkActive("failed"), false);
});
