/**
 * @fileoverview Unit tests for Session Lifecycle utilities.
 */

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

// ---------------------------------------------------------------------------
// isSessionTerminalStatus
// ---------------------------------------------------------------------------

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

test("isSessionTerminalStatus returns false for in_progress", () => {
  assert.equal(isSessionTerminalStatus("in_progress"), false);
});

test("isSessionTerminalStatus returns false for pending", () => {
  assert.equal(isSessionTerminalStatus("pending"), false);
});

test("isSessionTerminalStatus narrows type correctly", () => {
  const status = "completed" as const;
  if (isSessionTerminalStatus(status)) {
    // TypeScript should narrow status to SessionTerminalStatus here
    const terminalStatus: SessionTerminalStatus = status;
    assert.ok(terminalStatus);
  }
});

// ---------------------------------------------------------------------------
// isTaskActiveStatus
// ---------------------------------------------------------------------------

test("isTaskActiveStatus returns true for queued", () => {
  assert.equal(isTaskActiveStatus("queued"), true);
});

test("isTaskActiveStatus returns true for pending", () => {
  assert.equal(isTaskActiveStatus("pending"), true);
});

test("isTaskActiveStatus returns true for in_progress", () => {
  assert.equal(isTaskActiveStatus("in_progress"), true);
});

test("isTaskActiveStatus returns true for awaiting_decision", () => {
  assert.equal(isTaskActiveStatus("awaiting_decision"), true);
});

test("isTaskActiveStatus returns false for completed", () => {
  assert.equal(isTaskActiveStatus("completed"), false);
});

test("isTaskActiveStatus returns false for failed", () => {
  assert.equal(isTaskActiveStatus("failed"), false);
});

test("isTaskActiveStatus returns false for cancelled", () => {
  assert.equal(isTaskActiveStatus("cancelled"), false);
});

test("isTaskActiveStatus narrows type correctly", () => {
  const status = "in_progress" as const;
  if (isTaskActiveStatus(status)) {
    // TypeScript should narrow status to TaskActiveStatus here
    const activeStatus: TaskActiveStatus = status;
    assert.ok(activeStatus);
  }
});

test("isTaskActiveStatus works with TaskRecord status field", () => {
  const task: TaskRecord = {
    id: "task-1",
    title: "Test",
    status: "in_progress",
    source: "user",
    priority: "normal",
    parentId: null,
    rootId: "task-1",
    divisionId: null,
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };

  assert.equal(isTaskActiveStatus(task.status), true);
});

test("isTaskActiveStatus returns false for completed task", () => {
  const task: TaskRecord = {
    id: "task-1",
    title: "Test",
    status: "completed",
    source: "user",
    priority: "normal",
    parentId: null,
    rootId: "task-1",
    divisionId: null,
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };

  assert.equal(isTaskActiveStatus(task.status), false);
});

// ---------------------------------------------------------------------------
// createRecoverySession
// ---------------------------------------------------------------------------

test("createRecoverySession creates new session with new id", () => {
  const original: SessionRecord = {
    id: "session-original",
    taskId: "task-1",
    channel: "test-channel",
    status: "completed",
    externalSessionId: "ext-123",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const recovery = createRecoverySession(original, "2024-01-02T00:00:00.000Z");

  assert.notEqual(recovery.id, original.id);
  assert.ok(recovery.id.startsWith("sess_"));
  assert.equal(recovery.taskId, original.taskId);
  assert.equal(recovery.channel, original.channel);
  assert.equal(recovery.externalSessionId, original.externalSessionId);
});

test("createRecoverySession sets status to open", () => {
  const original: SessionRecord = {
    id: "session-original",
    taskId: "task-1",
    channel: "test-channel",
    status: "failed",
    externalSessionId: "ext-123",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const recovery = createRecoverySession(original, "2024-01-02T00:00:00.000Z");

  assert.equal(recovery.status, "open");
});

test("createRecoverySession uses provided occurredAt for timestamps", () => {
  const original: SessionRecord = {
    id: "session-original",
    taskId: "task-1",
    channel: "test-channel",
    status: "completed",
    externalSessionId: "ext-123",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const occurredAt = "2024-06-15T12:30:00.000Z";
  const recovery = createRecoverySession(original, occurredAt);

  assert.equal(recovery.createdAt, occurredAt);
  assert.equal(recovery.updatedAt, occurredAt);
});

test("createRecoverySession preserves externalSessionId from original", () => {
  const original: SessionRecord = {
    id: "session-original",
    taskId: "task-1",
    channel: "test-channel",
    status: "completed",
    externalSessionId: "external-session-id-xyz",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const recovery = createRecoverySession(original, "2024-01-02T00:00:00.000Z");

  assert.equal(recovery.externalSessionId, "external-session-id-xyz");
});

test("createRecoverySession preserves taskId from original", () => {
  const original: SessionRecord = {
    id: "session-original",
    taskId: "task-specific-123",
    channel: "test-channel",
    status: "completed",
    externalSessionId: "ext-123",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const recovery = createRecoverySession(original, "2024-01-02T00:00:00.000Z");

  assert.equal(recovery.taskId, "task-specific-123");
});

test("createRecoverySession preserves channel from original", () => {
  const original: SessionRecord = {
    id: "session-original",
    taskId: "task-1",
    channel: "chatbot",
    status: "completed",
    externalSessionId: "ext-123",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const recovery = createRecoverySession(original, "2024-01-02T00:00:00.000Z");

  assert.equal(recovery.channel, "chatbot");
});

test("createRecoverySession works with different original statuses", () => {
  const statuses: SessionRecord["status"][] = ["open", "in_progress", "completed", "failed", "cancelled"];

  for (const status of statuses) {
    const original: SessionRecord = {
      id: "session-original",
      taskId: "task-1",
      channel: "test",
      status,
      externalSessionId: "ext",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    const recovery = createRecoverySession(original, "2024-01-02T00:00:00.000Z");

    assert.equal(recovery.status, "open", `Failed for original status: ${status}`);
    assert.ok(recovery.id !== original.id);
  }
});

test("createRecoverySession generates unique IDs for multiple recoveries", () => {
  const original: SessionRecord = {
    id: "session-original",
    taskId: "task-1",
    channel: "test",
    status: "failed",
    externalSessionId: "ext",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const recovery1 = createRecoverySession(original, "2024-01-02T00:00:00.000Z");
  const recovery2 = createRecoverySession(original, "2024-01-03T00:00:00.000Z");

  assert.notEqual(recovery1.id, recovery2.id);
});

test("createRecoverySession returns valid SessionRecord structure", () => {
  const original: SessionRecord = {
    id: "session-original",
    taskId: "task-1",
    channel: "test",
    status: "completed",
    externalSessionId: "ext-123",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const recovery = createRecoverySession(original, "2024-01-02T00:00:00.000Z");

  // Verify all required fields are present
  assert.ok(recovery.id);
  assert.ok(recovery.taskId);
  assert.ok(recovery.channel);
  assert.ok(recovery.status);
  assert.ok(recovery.externalSessionId);
  assert.ok(recovery.createdAt);
  assert.ok(recovery.updatedAt);
});

test("createRecoverySession works with various externalSessionId formats", () => {
  const externalIds = ["simple", "with-dashes", "with_underscores", "123456", "a/b/c"];

  for (const externalId of externalIds) {
    const original: SessionRecord = {
      id: "session-original",
      taskId: "task-1",
      channel: "test",
      status: "completed",
      externalSessionId: externalId,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    const recovery = createRecoverySession(original, "2024-01-02T00:00:00.000Z");

    assert.equal(recovery.externalSessionId, externalId);
  }
});

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

test("SessionTerminalStatus type is exported and usable", () => {
  // Type-level test - if this compiles, the type is correct
  const status: SessionTerminalStatus = "completed";
  assert.ok(status);
});

test("TaskActiveStatus type is exported and usable", () => {
  // Type-level test
  const status: TaskActiveStatus = "in_progress";
  assert.ok(status);
});
