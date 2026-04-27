import assert from "node:assert/strict";
import test from "node:test";

import {
  isSessionTerminalStatus,
  createRecoverySession,
  type SessionRecord,
} from "../../../../../src/platform/contracts/types/status.js";

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

test("isSessionTerminalStatus returns false for awaiting_user", () => {
  assert.equal(isSessionTerminalStatus("awaiting_user"), false);
});

test("isSessionTerminalStatus returns false for paused", () => {
  assert.equal(isSessionTerminalStatus("paused"), false);
});

test("createRecoverySession creates new session with fresh id", () => {
  const originalSession: SessionRecord = {
    id: "sess_original_123",
    taskId: "task_456",
    channel: "telegram",
    status: "completed",
    externalSessionId: "ext_789",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:10:00.000Z",
  };

  const recoverySession = createRecoverySession(originalSession, "2026-04-01T00:15:00.000Z");

  assert.notEqual(recoverySession.id, originalSession.id);
  assert.ok(recoverySession.id.startsWith("sess_"));
  assert.equal(recoverySession.taskId, originalSession.taskId);
  assert.equal(recoverySession.channel, originalSession.channel);
  assert.equal(recoverySession.status, "open");
  assert.equal(recoverySession.externalSessionId, originalSession.externalSessionId);
  assert.equal(recoverySession.createdAt, "2026-04-01T00:15:00.000Z");
  assert.equal(recoverySession.updatedAt, "2026-04-01T00:15:00.000Z");
});

test("createRecoverySession uses occurredAt for timestamps", () => {
  const originalSession: SessionRecord = {
    id: "sess_original_123",
    taskId: "task_456",
    channel: "slack",
    status: "failed",
    externalSessionId: "ext_789",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:10:00.000Z",
  };

  const recoverySession = createRecoverySession(originalSession, "2026-04-01T00:20:00.000Z");

  assert.equal(recoverySession.createdAt, "2026-04-01T00:20:00.000Z");
  assert.equal(recoverySession.updatedAt, "2026-04-01T00:20:00.000Z");
});

test("createRecoverySession inherits channel and externalSessionId from original", () => {
  const originalSession: SessionRecord = {
    id: "sess_original_123",
    taskId: "task_456",
    channel: "webhook",
    status: "cancelled",
    externalSessionId: "webhook_abc",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:10:00.000Z",
  };

  const recoverySession = createRecoverySession(originalSession, "2026-04-01T00:15:00.000Z");

  assert.equal(recoverySession.channel, "webhook");
  assert.equal(recoverySession.externalSessionId, "webhook_abc");
});

test("createRecoverySession always sets status to open regardless of original status", () => {
  const statuses: SessionRecord["status"][] = ["open", "streaming", "awaiting_user", "paused", "completed", "failed", "cancelled"];

  for (const originalStatus of statuses) {
    const originalSession: SessionRecord = {
      id: "sess_original",
      taskId: "task_456",
      channel: "telegram",
      status: originalStatus,
      externalSessionId: "ext_789",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:10:00.000Z",
    };

    const recoverySession = createRecoverySession(originalSession, "2026-04-01T00:15:00.000Z");
    assert.equal(recoverySession.status, "open", `Original status ${originalStatus} should result in "open" recovery session`);
  }
});
