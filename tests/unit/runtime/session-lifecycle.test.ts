import test from "node:test";
import assert from "node:assert/strict";
import type { SessionStatus, TaskStatus } from "../../../src/platform/contracts/types/status.js";
import type { SessionRecord } from "../../../src/platform/contracts/types/domain.js";
import {
  isSessionTerminalStatus,
  isTaskActiveStatus,
  createRecoverySession,
} from "../../../src/platform/five-plane-execution/execution-engine/session-lifecycle.js";

test("isSessionTerminalStatus returns true for terminal statuses", () => {
  assert.equal(isSessionTerminalStatus("completed"), true);
  assert.equal(isSessionTerminalStatus("failed"), true);
  assert.equal(isSessionTerminalStatus("cancelled"), true);
});

test("isSessionTerminalStatus returns false for non-terminal statuses", () => {
  assert.equal(isSessionTerminalStatus("open"), false);
  assert.equal(isSessionTerminalStatus("closed" as SessionStatus), false);
});

test("isTaskActiveStatus returns true for active task statuses", () => {
  assert.equal(isTaskActiveStatus("queued"), true);
  assert.equal(isTaskActiveStatus("pending"), true);
  assert.equal(isTaskActiveStatus("in_progress"), true);
  assert.equal(isTaskActiveStatus("awaiting_decision"), true);
});

test("isTaskActiveStatus returns false for non-active statuses", () => {
  assert.equal(isTaskActiveStatus("done"), false);
  assert.equal(isTaskActiveStatus("failed" as TaskStatus), false);
  assert.equal(isTaskActiveStatus("cancelled" as TaskStatus), false);
});

test("createRecoverySession generates new id and sets status to open", () => {
  const original: SessionRecord = {
    id: "sess_old",
    taskId: "task_abc",
    channel: "test",
    status: "completed",
    externalSessionId: "ext_123",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const recovery = createRecoverySession(original, "2024-01-02T00:00:00.000Z");

  assert.ok(recovery.id.startsWith("sess_"));
  assert.notEqual(recovery.id, "sess_old");
  assert.equal(recovery.taskId, "task_abc");
  assert.equal(recovery.channel, "test");
  assert.equal(recovery.status, "open");
  assert.equal(recovery.externalSessionId, "ext_123");
  assert.equal(recovery.createdAt, "2024-01-02T00:00:00.000Z");
  assert.equal(recovery.updatedAt, "2024-01-02T00:00:00.000Z");
});

test("createRecoverySession preserves all session fields except id/status/dates", () => {
  const original: SessionRecord = {
    id: "sess_original",
    taskId: "task_xyz",
    channel: "cli",
    status: "completed",
    externalSessionId: "ext_456",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  const recovery = createRecoverySession(original, "2024-02-01T12:00:00.000Z");

  assert.equal(recovery.taskId, "task_xyz");
  assert.equal(recovery.channel, "cli");
  assert.equal(recovery.externalSessionId, "ext_456");
});

test("isSessionTerminalStatus handles unknown status gracefully", () => {
  // Unknown statuses should return false
  assert.equal(isSessionTerminalStatus("unknown" as any), false);
});

test("isTaskActiveStatus handles unknown status gracefully", () => {
  // Unknown statuses should return false
  assert.equal(isTaskActiveStatus("unknown" as any), false);
});
