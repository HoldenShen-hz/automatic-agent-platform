import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOfflineExecutionRecord,
  completeOfflineExecution,
  type OfflineExecutionRecord,
} from "../../../../src/ops-maturity/edge-runtime/edge-executor/index.js";

test("buildOfflineExecutionRecord creates record with correct fields", () => {
  const record = buildOfflineExecutionRecord("node_1", "task_abc", "2026-04-25T10:00:00Z");

  assert.equal(record.edgeNodeId, "node_1");
  assert.equal(record.taskId, "task_abc");
  assert.equal(record.createdAt, "2026-04-25T10:00:00Z");
  assert.equal(record.syncRequired, true);
  assert.equal(record.status, "queued");
  assert.equal(record.completedAt, undefined);
});

test("buildOfflineExecutionRecord marks syncRequired as true", () => {
  const record = buildOfflineExecutionRecord("node_2", "task_xyz", "2026-04-25T12:00:00Z");
  assert.equal(record.syncRequired, true);
});

test("buildOfflineExecutionRecord defaults status to queued", () => {
  const record = buildOfflineExecutionRecord("node_1", "task_123", "2026-04-25T10:00:00Z");
  assert.equal(record.status, "queued");
});

test("buildOfflineExecutionRecord does not set completedAt", () => {
  const record = buildOfflineExecutionRecord("node_1", "task_123", "2026-04-25T10:00:00Z");
  assert.equal(record.completedAt, undefined);
});

test("completeOfflineExecution updates status to completed", () => {
  const original = buildOfflineExecutionRecord("node_1", "task_abc", "2026-04-25T10:00:00Z");
  const completed = completeOfflineExecution(original, "2026-04-25T11:00:00Z");

  assert.equal(completed.status, "completed");
  assert.equal(completed.completedAt, "2026-04-25T11:00:00Z");
});

test("completeOfflineExecution preserves original fields", () => {
  const original = buildOfflineExecutionRecord("node_1", "task_abc", "2026-04-25T10:00:00Z");
  const completed = completeOfflineExecution(original, "2026-04-25T11:00:00Z");

  assert.equal(completed.edgeNodeId, "node_1");
  assert.equal(completed.taskId, "task_abc");
  assert.equal(completed.createdAt, "2026-04-25T10:00:00Z");
  assert.equal(completed.syncRequired, true);
});

test("completeOfflineExecution does not modify original record", () => {
  const original = buildOfflineExecutionRecord("node_1", "task_abc", "2026-04-25T10:00:00Z");
  completeOfflineExecution(original, "2026-04-25T11:00:00Z");

  assert.equal(original.status, "queued");
  assert.equal(original.completedAt, undefined);
});

test("OfflineExecutionRecord type shape is correct", () => {
  const record: OfflineExecutionRecord = {
    edgeNodeId: "node_x",
    taskId: "task_y",
    createdAt: "2026-04-25T10:00:00Z",
    syncRequired: true,
    status: "running",
    completedAt: undefined,
  };

  assert.equal(record.edgeNodeId, "node_x");
  assert.equal(record.taskId, "task_y");
  assert.equal(record.status, "running");
});

test("OfflineExecutionRecord completed status includes completedAt", () => {
  const record: OfflineExecutionRecord = {
    edgeNodeId: "node_x",
    taskId: "task_y",
    createdAt: "2026-04-25T10:00:00Z",
    syncRequired: true,
    status: "completed",
    completedAt: "2026-04-25T11:00:00Z",
  };

  assert.equal(record.status, "completed");
  assert.equal(record.completedAt, "2026-04-25T11:00:00Z");
});

test("OfflineExecutionRecord status can be running", () => {
  const record: OfflineExecutionRecord = {
    edgeNodeId: "node_running",
    taskId: "task_running",
    createdAt: "2026-04-25T10:00:00Z",
    syncRequired: true,
    status: "running",
  };

  assert.equal(record.status, "running");
  assert.equal(record.completedAt, undefined);
});
