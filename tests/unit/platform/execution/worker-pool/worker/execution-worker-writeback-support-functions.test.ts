/**
 * @fileoverview Unit tests for execution worker writeback support functions
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  parseJsonArray,
  removeExecutionId,
  toWorkerStatus,
  toExecutionTerminalStatus,
} from "../../../../../src/platform/five-plane-execution/worker-pool/worker/execution-worker-writeback-support.js";

import type { WorkerSnapshotRecord } from "../../../../../src/platform/contracts/types/domain.js";

function makeSnapshot(overrides: Partial<WorkerSnapshotRecord> = {}): WorkerSnapshotRecord {
  return {
    workerId: "worker_1",
    status: "idle",
    version: 1,
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as WorkerSnapshotRecord;
}

test("parseJsonArray parses valid JSON array", () => {
  const result = parseJsonArray('["a", "b", "c"]');
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("parseJsonArray returns empty array for invalid JSON", () => {
  const result = parseJsonArray("not json");
  assert.deepEqual(result, []);
});

test("parseJsonArray returns empty array for non-array JSON", () => {
  const result = parseJsonArray('{"key": "value"}');
  assert.deepEqual(result, []);
});

test("parseJsonArray filters non-string elements", () => {
  const result = parseJsonArray('["a", 123, true, null, "b"]');
  assert.deepEqual(result, ["a", "b"]);
});

test("parseJsonArray handles empty JSON array", () => {
  const result = parseJsonArray("[]");
  assert.deepEqual(result, []);
});

test("parseJsonArray handles empty string", () => {
  const result = parseJsonArray("");
  assert.deepEqual(result, []);
});

test("removeExecutionId removes the specified execution ID", () => {
  const existing = ["exec_1", "exec_2", "exec_3"];
  const result = removeExecutionId(existing, "exec_2");

  assert.deepEqual(result, ["exec_1", "exec_3"]);
});

test("removeExecutionId returns sorted array", () => {
  const existing = ["exec_3", "exec_1", "exec_2"];
  const result = removeExecutionId(existing, "exec_2");

  assert.deepEqual(result, ["exec_1", "exec_3"]);
});

test("removeExecutionId handles non-existent execution ID", () => {
  const existing = ["exec_1", "exec_2"];
  const result = removeExecutionId(existing, "exec_999");

  assert.deepEqual(result, ["exec_1", "exec_2"]);
});

test("removeExecutionId handles empty array", () => {
  const result = removeExecutionId([], "exec_1");
  assert.deepEqual(result, []);
});

test("removeExecutionId handles single element array", () => {
  const result = removeExecutionId(["exec_1"], "exec_1");
  assert.deepEqual(result, []);
});

test("toWorkerStatus returns unavailable when snapshot status is unavailable", () => {
  const snapshot = makeSnapshot({ status: "unavailable" });
  const result = toWorkerStatus(snapshot, []);

  assert.equal(result, "unavailable");
});

test("toWorkerStatus returns quarantined when snapshot status is quarantined", () => {
  const snapshot = makeSnapshot({ status: "quarantined" });
  const result = toWorkerStatus(snapshot, []);

  assert.equal(result, "quarantined");
});

test("toWorkerStatus returns offline when snapshot status is offline", () => {
  const snapshot = makeSnapshot({ status: "offline" });
  const result = toWorkerStatus(snapshot, []);

  assert.equal(result, "offline");
});

test("toWorkerStatus returns draining when snapshot status is draining", () => {
  const snapshot = makeSnapshot({ status: "draining" });
  const result = toWorkerStatus(snapshot, []);

  assert.equal(result, "draining");
});

test("toWorkerStatus returns degraded when snapshot status is degraded", () => {
  const snapshot = makeSnapshot({ status: "degraded" });
  const result = toWorkerStatus(snapshot, []);

  assert.equal(result, "degraded");
});

test("toWorkerStatus returns busy when running executions exist", () => {
  const snapshot = makeSnapshot({ status: "idle" });
  const result = toWorkerStatus(snapshot, ["exec_1", "exec_2"]);

  assert.equal(result, "busy");
});

test("toWorkerStatus returns idle when no running executions and status is idle", () => {
  const snapshot = makeSnapshot({ status: "idle" });
  const result = toWorkerStatus(snapshot, []);

  assert.equal(result, "idle");
});

test("toExecutionTerminalStatus returns succeeded for done status", () => {
  const result = toExecutionTerminalStatus("done");
  assert.equal(result, "succeeded");
});

test("toExecutionTerminalStatus returns failed for failed status", () => {
  const result = toExecutionTerminalStatus("failed");
  assert.equal(result, "failed");
});

test("toExecutionTerminalStatus returns cancelled for cancelled status", () => {
  const result = toExecutionTerminalStatus("cancelled");
  assert.equal(result, "cancelled");
});