/**
 * Integration Test: Session Lifecycle Utilities
 *
 * Verifies session lifecycle type guards and recovery session creation
 * for proper session state management in recovery scenarios.
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

test("isSessionTerminalStatus: returns true for terminal statuses", () => {
  assert.equal(isSessionTerminalStatus("completed"), true, "completed should be terminal");
  assert.equal(isSessionTerminalStatus("failed"), true, "failed should be terminal");
  assert.equal(isSessionTerminalStatus("cancelled"), true, "cancelled should be terminal");
});

test("isSessionTerminalStatus: returns false for non-terminal statuses", () => {
  assert.equal(isSessionTerminalStatus("open"), false, "open should not be terminal");
  assert.equal(isSessionTerminalStatus("streaming"), false, "streaming should not be terminal");
  assert.equal(isSessionTerminalStatus("awaiting_user"), false, "awaiting_user should not be terminal");
});

test("isSessionTerminalStatus: narrow type preserves terminal status", () => {
  const status: SessionTerminalStatus = "completed";
  assert.equal(isSessionTerminalStatus(status), true, "Should narrow to true for terminal status");
});

test("isTaskActiveStatus: returns true for active statuses", () => {
  assert.equal(isTaskActiveStatus("queued"), true, "queued should be active");
  assert.equal(isTaskActiveStatus("pending"), true, "pending should be active");
  assert.equal(isTaskActiveStatus("in_progress"), true, "in_progress should be active");
  assert.equal(isTaskActiveStatus("awaiting_decision"), true, "awaiting_decision should be active");
});

test("isTaskActiveStatus: returns false for terminal statuses", () => {
  assert.equal(isTaskActiveStatus("done"), false, "done should not be active");
  assert.equal(isTaskActiveStatus("failed"), false, "failed should not be active");
  assert.equal(isTaskActiveStatus("cancelled"), false, "cancelled should not be active");
});

test("createRecoverySession: creates new session with open status", () => {
  const original = {
    id: "sess_original_123",
    taskId: "task_456",
    channel: "cli" as const,
    status: "failed" as const,
    externalSessionId: "ext_789",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:01:00.000Z",
  };

  const recovery = createRecoverySession(original, "2024-01-02T00:00:00.000Z");

  assert.notEqual(recovery.id, original.id, "Recovery session should have new ID");
  assert.ok(recovery.id.startsWith("sess_"), "Recovery session ID should have correct prefix");
  assert.equal(recovery.taskId, original.taskId, "Should inherit taskId");
  assert.equal(recovery.channel, original.channel, "Should inherit channel");
  assert.equal(recovery.status, "open", "Should have open status");
  assert.equal(recovery.externalSessionId, original.externalSessionId, "Should inherit external session ID");
  assert.equal(recovery.createdAt, "2024-01-02T00:00:00.000Z", "Should use occurredAt as createdAt");
  assert.equal(recovery.updatedAt, "2024-01-02T00:00:00.000Z", "Should use occurredAt as updatedAt");
});

test("createRecoverySession: handles null externalSessionId", () => {
  const original = {
    id: "sess_original",
    taskId: "task_123",
    channel: "api" as const,
    status: "completed" as const,
    externalSessionId: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:01:00.000Z",
  };

  const recovery = createRecoverySession(original, "2024-01-02T00:00:00.000Z");

  assert.equal(recovery.externalSessionId, null, "Should handle null externalSessionId");
});

test("createRecoverySession: preserves channel for different session types", () => {
  const channels = ["cli", "api", "webhook", "websocket"] as const;

  for (const channel of channels) {
    const original = {
      id: `sess_${channel}`,
      taskId: "task_test",
      channel,
      status: "failed" as const,
      externalSessionId: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:01:00.000Z",
    };

    const recovery = createRecoverySession(original, "2024-01-02T00:00:00.000Z");
    assert.equal(recovery.channel, channel, `Should preserve ${channel} channel`);
  }
});

test("isSessionTerminalStatus: works with type narrowing in conditional", () => {
  const statuses = ["completed", "failed", "cancelled", "open", "streaming", "awaiting_user"] as const;

  for (const status of statuses) {
    if (isSessionTerminalStatus(status)) {
      // TypeScript should narrow status to SessionTerminalStatus here
      assert.ok(["completed", "failed", "cancelled"].includes(status), `${status} should be terminal`);
    } else {
      assert.ok(["open", "streaming", "awaiting_user"].includes(status), `${status} should not be terminal`);
    }
  }
});

test("isTaskActiveStatus: works with type narrowing in conditional", () => {
  const statuses = ["queued", "pending", "in_progress", "awaiting_decision", "done", "failed", "cancelled"] as const;

  for (const status of statuses) {
    if (isTaskActiveStatus(status)) {
      assert.ok(["queued", "pending", "in_progress", "awaiting_decision"].includes(status), `${status} should be active`);
    } else {
      assert.ok(["done", "failed", "cancelled"].includes(status), `${status} should not be active`);
    }
  }
});

test("createRecoverySession: generates unique IDs for each recovery", () => {
  const original = {
    id: "sess_original",
    taskId: "task_123",
    channel: "cli" as const,
    status: "failed" as const,
    externalSessionId: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:01:00.000Z",
  };

  const recovery1 = createRecoverySession(original, "2024-01-02T00:00:00.000Z");
  const recovery2 = createRecoverySession(original, "2024-01-02T00:00:01.000Z");
  const recovery3 = createRecoverySession(original, "2024-01-02T00:00:02.000Z");

  assert.notEqual(recovery1.id, recovery2.id, "Each recovery should have unique ID");
  assert.notEqual(recovery2.id, recovery3.id, "Each recovery should have unique ID");
  assert.notEqual(recovery1.id, recovery3.id, "Each recovery should have unique ID");
});

test("isSessionTerminalStatus: handles edge cases", () => {
  // These should all be false for statuses not in the union
  // @ts-expect-error - Testing runtime behavior for invalid status
  assert.equal(isSessionTerminalStatus("unknown"), false, "Unknown status should return false");
});

test("isTaskActiveStatus: handles edge cases", () => {
  // These should all be false for statuses not in the union
  // @ts-expect-error - Testing runtime behavior for invalid status
  assert.equal(isTaskActiveStatus("unknown"), false, "Unknown status should return false");
});
