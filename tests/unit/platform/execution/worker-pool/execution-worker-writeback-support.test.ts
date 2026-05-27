import assert from "node:assert/strict";
import test from "node:test";

import {
  parseJsonArray,
  removeExecutionId,
  toWorkerStatus,
  toExecutionTerminalStatus,
} from "../../../../../src/platform/five-plane-execution/worker-pool/execution-worker-writeback-support.js";
import type { WorkerSnapshotRecord } from "../../../../../src/platform/contracts/types/domain.js";

test("parseJsonArray parses valid JSON array [execution-worker-writeback-support]", () => {
  const result = parseJsonArray('["a", "b", "c"]');
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("parseJsonArray returns empty array for invalid JSON [execution-worker-writeback-support]", () => {
  const result = parseJsonArray("not json");
  assert.deepEqual(result, []);
});

test("parseJsonArray returns empty array for non-array JSON [execution-worker-writeback-support]", () => {
  const result = parseJsonArray('{"key": "value"}');
  assert.deepEqual(result, []);
});

test("parseJsonArray filters out non-string items [execution-worker-writeback-support]", () => {
  const result = parseJsonArray('["a", 123, true, null, "b"]');
  assert.deepEqual(result, ["a", "b"]);
});

test("parseJsonArray handles empty array [execution-worker-writeback-support]", () => {
  const result = parseJsonArray("[]");
  assert.deepEqual(result, []);
});

test("parseJsonArray handles empty string [execution-worker-writeback-support]", () => {
  const result = parseJsonArray("");
  assert.deepEqual(result, []);
});

test("removeExecutionId removes the specified ID [execution-worker-writeback-support]", () => {
  const result = removeExecutionId(["a", "b", "c"], "b");
  assert.deepEqual(result, ["a", "c"]);
});

test("removeExecutionId handles ID not in array [execution-worker-writeback-support]", () => {
  const result = removeExecutionId(["a", "c"], "b");
  assert.deepEqual(result, ["a", "c"]);
});

test("removeExecutionId returns sorted result [execution-worker-writeback-support]", () => {
  const result = removeExecutionId(["c", "a", "b"], "b");
  assert.deepEqual(result, ["a", "c"]);
});

test("toWorkerStatus returns unavailable when snapshot is unavailable [execution-worker-writeback-support]", () => {
  const snapshot = { status: "unavailable" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "unavailable");
});

test("toWorkerStatus returns quarantined when snapshot is quarantined [execution-worker-writeback-support]", () => {
  const snapshot = { status: "quarantined" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "quarantined");
});

test("toWorkerStatus returns offline when snapshot is offline [execution-worker-writeback-support]", () => {
  const snapshot = { status: "offline" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "offline");
});

test("toWorkerStatus returns draining when snapshot is draining [execution-worker-writeback-support]", () => {
  const snapshot = { status: "draining" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "draining");
});

test("toWorkerStatus returns degraded when snapshot is degraded [execution-worker-writeback-support]", () => {
  const snapshot = { status: "degraded" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "degraded");
});

test("toWorkerStatus returns busy when running executions exist [execution-worker-writeback-support]", () => {
  const snapshot = { status: "idle" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, ["exec_1", "exec_2"]), "busy");
});

test("toWorkerStatus returns idle when no running executions [execution-worker-writeback-support]", () => {
  const snapshot = { status: "idle" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "idle");
});

test("toExecutionTerminalStatus maps done to succeeded [execution-worker-writeback-support]", () => {
  assert.equal(toExecutionTerminalStatus("done"), "succeeded");
});

test("toExecutionTerminalStatus maps failed to failed [execution-worker-writeback-support]", () => {
  assert.equal(toExecutionTerminalStatus("failed"), "failed");
});

test("toExecutionTerminalStatus maps cancelled to cancelled [execution-worker-writeback-support]", () => {
  assert.equal(toExecutionTerminalStatus("cancelled"), "cancelled");
});
