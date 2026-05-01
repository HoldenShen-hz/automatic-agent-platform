import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOfflineExecutionRecord,
  completeOfflineExecution,
  type OfflineExecutionRecord,
} from "../../../src/ops-maturity/edge-runtime/edge-executor/index.js";

test("buildOfflineExecutionRecord creates queued record", () => {
  const record = buildOfflineExecutionRecord("node_1", "task_1", "2026-04-20T00:00:00.000Z");

  assert.strictEqual(record.edgeNodeId, "node_1");
  assert.strictEqual(record.taskId, "task_1");
  assert.strictEqual(record.createdAt, "2026-04-20T00:00:00.000Z");
  assert.strictEqual(record.syncRequired, true);
  assert.strictEqual(record.status, "queued");
  assert.strictEqual(record.completedAt, undefined);
});

test("completeOfflineExecution transitions to completed", () => {
  const original = buildOfflineExecutionRecord("node_1", "task_1", "2026-04-20T00:00:00.000Z");
  const completed = completeOfflineExecution(original, "2026-04-20T00:05:00.000Z");

  assert.strictEqual(completed.edgeNodeId, original.edgeNodeId);
  assert.strictEqual(completed.taskId, original.taskId);
  assert.strictEqual(completed.createdAt, original.createdAt);
  assert.strictEqual(completed.syncRequired, original.syncRequired);
  assert.strictEqual(completed.status, "completed");
  assert.strictEqual(completed.completedAt, "2026-04-20T00:05:00.000Z");
});

test("completeOfflineExecution preserves original record fields", () => {
  const original = buildOfflineExecutionRecord("node_2", "task_2", "2026-04-20T01:00:00.000Z");
  const completed = completeOfflineExecution(original, "2026-04-20T01:10:00.000Z");

  assert.deepStrictEqual(completed, {
    edgeNodeId: "node_2",
    taskId: "task_2",
    createdAt: "2026-04-20T01:00:00.000Z",
    syncRequired: true,
    status: "completed",
    completedAt: "2026-04-20T01:10:00.000Z",
  });
});