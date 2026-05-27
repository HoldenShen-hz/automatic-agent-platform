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
} from "../../../../../../src/platform/five-plane-execution/worker-pool/worker/execution-worker-writeback-support.js";

import type { WorkerSnapshotRecord } from "../../../../../../src/platform/contracts/types/domain.js";

function makeSnapshot(overrides: Partial<WorkerSnapshotRecord> = {}): WorkerSnapshotRecord {
  return {
    workerId: "worker_1",
    status: "idle",
    version: 1,
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as WorkerSnapshotRecord;
}

test("parseJsonArray parses valid JSON array [execution-worker-writeback-support-functions]", () => {
  const result = parseJsonArray('["a", "b", "c"]');
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("parseJsonArray returns empty array for invalid JSON [execution-worker-writeback-support-functions]", () => {
  const result = parseJsonArray("not json");
  assert.deepEqual(result, []);
});

test("parseJsonArray returns empty array for non-array JSON [execution-worker-writeback-support-functions]", () => {
  const result = parseJsonArray('{"key": "value"}');
  assert.deepEqual(result, []);
});

test("parseJsonArray filters non-string elements [execution-worker-writeback-support-functions]", () => {
  const result = parseJsonArray('["a", 123, true, null, "b"]');
  assert.deepEqual(result, ["a", "b"]);
});

test("parseJsonArray handles empty JSON array [execution-worker-writeback-support-functions]", () => {
  const result = parseJsonArray("[]");
  assert.deepEqual(result, []);
});

test("parseJsonArray handles empty string [execution-worker-writeback-support-functions]", () => {
  const result = parseJsonArray("");
  assert.deepEqual(result, []);
});

test("removeExecutionId removes the specified execution ID [execution-worker-writeback-support-functions]", () => {
  const existing = ["exec_1", "exec_2", "exec_3"];
  const result = removeExecutionId(existing, "exec_2");

  assert.deepEqual(result, ["exec_1", "exec_3"]);
});

test("removeExecutionId returns sorted array [execution-worker-writeback-support-functions]", () => {
  const existing = ["exec_3", "exec_1", "exec_2"];
  const result = removeExecutionId(existing, "exec_2");

  assert.deepEqual(result, ["exec_1", "exec_3"]);
});

test("removeExecutionId handles non-existent execution ID [execution-worker-writeback-support-functions]", () => {
  const existing = ["exec_1", "exec_2"];
  const result = removeExecutionId(existing, "exec_999");

  assert.deepEqual(result, ["exec_1", "exec_2"]);
});

test("removeExecutionId handles empty array [execution-worker-writeback-support-functions]", () => {
  const result = removeExecutionId([], "exec_1");
  assert.deepEqual(result, []);
});

test("removeExecutionId handles single element array [execution-worker-writeback-support-functions]", () => {
  const result = removeExecutionId(["exec_1"], "exec_1");
  assert.deepEqual(result, []);
});

test("toWorkerStatus returns unavailable when snapshot status is unavailable [execution-worker-writeback-support-functions]", () => {
  const snapshot = makeSnapshot({ status: "unavailable" });
  const result = toWorkerStatus(snapshot, []);

  assert.equal(result, "unavailable");
});

test("toWorkerStatus returns quarantined when snapshot status is quarantined [execution-worker-writeback-support-functions]", () => {
  const snapshot = makeSnapshot({ status: "quarantined" });
  const result = toWorkerStatus(snapshot, []);

  assert.equal(result, "quarantined");
});

test("toWorkerStatus returns offline when snapshot status is offline [execution-worker-writeback-support-functions]", () => {
  const snapshot = makeSnapshot({ status: "offline" });
  const result = toWorkerStatus(snapshot, []);

  assert.equal(result, "offline");
});

test("toWorkerStatus returns draining when snapshot status is draining [execution-worker-writeback-support-functions]", () => {
  const snapshot = makeSnapshot({ status: "draining" });
  const result = toWorkerStatus(snapshot, []);

  assert.equal(result, "draining");
});

test("toWorkerStatus returns degraded when snapshot status is degraded [execution-worker-writeback-support-functions]", () => {
  const snapshot = makeSnapshot({ status: "degraded" });
  const result = toWorkerStatus(snapshot, []);

  assert.equal(result, "degraded");
});

test("toWorkerStatus returns busy when running executions exist [execution-worker-writeback-support-functions]", () => {
  const snapshot = makeSnapshot({ status: "idle" });
  const result = toWorkerStatus(snapshot, ["exec_1", "exec_2"]);

  assert.equal(result, "busy");
});

test("toWorkerStatus returns idle when no running executions and status is idle [execution-worker-writeback-support-functions]", () => {
  const snapshot = makeSnapshot({ status: "idle" });
  const result = toWorkerStatus(snapshot, []);

  assert.equal(result, "idle");
});

test("toExecutionTerminalStatus returns succeeded for done status [execution-worker-writeback-support-functions]", () => {
  const result = toExecutionTerminalStatus("done");
  assert.equal(result, "succeeded");
});

test("toExecutionTerminalStatus returns failed for failed status [execution-worker-writeback-support-functions]", () => {
  const result = toExecutionTerminalStatus("failed");
  assert.equal(result, "failed");
});

test("toExecutionTerminalStatus returns cancelled for cancelled status [execution-worker-writeback-support-functions]", () => {
  const result = toExecutionTerminalStatus("cancelled");
  assert.equal(result, "cancelled");
});