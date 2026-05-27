import assert from "node:assert/strict";
import test from "node:test";

import {
  parseJsonArray,
  removeExecutionId,
  toWorkerStatus,
  toExecutionTerminalStatus,
} from "../../../../../src/platform/five-plane-execution/worker-pool/execution-worker-writeback-support.js";
import type { WorkerSnapshotRecord } from "../../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// parseJsonArray tests
// ---------------------------------------------------------------------------

test("parseJsonArray parses valid JSON array [writeback-index]", () => {
  const result = parseJsonArray('["a", "b", "c"]');
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("parseJsonArray returns empty array for invalid JSON [writeback-index]", () => {
  const result = parseJsonArray("not json");
  assert.deepEqual(result, []);
});

test("parseJsonArray returns empty array for non-array JSON [writeback-index]", () => {
  const result = parseJsonArray('{"key": "value"}');
  assert.deepEqual(result, []);
});

test("parseJsonArray filters out non-string items [writeback-index]", () => {
  const result = parseJsonArray('["a", 123, true, null, "b"]');
  assert.deepEqual(result, ["a", "b"]);
});

test("parseJsonArray handles empty array [writeback-index]", () => {
  const result = parseJsonArray("[]");
  assert.deepEqual(result, []);
});

test("parseJsonArray handles empty string [writeback-index]", () => {
  const result = parseJsonArray("");
  assert.deepEqual(result, []);
});

// ---------------------------------------------------------------------------
// removeExecutionId tests
// ---------------------------------------------------------------------------

test("removeExecutionId removes the specified ID [writeback-index]", () => {
  const result = removeExecutionId(["a", "b", "c"], "b");
  assert.deepEqual(result, ["a", "c"]);
});

test("removeExecutionId handles ID not in array [writeback-index]", () => {
  const result = removeExecutionId(["a", "c"], "b");
  assert.deepEqual(result, ["a", "c"]);
});

test("removeExecutionId returns sorted result [writeback-index]", () => {
  const result = removeExecutionId(["c", "a", "b"], "b");
  assert.deepEqual(result, ["a", "c"]);
});

test("removeExecutionId handles empty array [writeback-index]", () => {
  const result = removeExecutionId([], "a");
  assert.deepEqual(result, []);
});

test("removeExecutionId handles single element removal [writeback-index]", () => {
  const result = removeExecutionId(["only"], "only");
  assert.deepEqual(result, []);
});

// ---------------------------------------------------------------------------
// toWorkerStatus tests
// ---------------------------------------------------------------------------

test("toWorkerStatus returns unavailable when snapshot is unavailable [writeback-index]", () => {
  const snapshot = { status: "unavailable" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "unavailable");
});

test("toWorkerStatus returns quarantined when snapshot is quarantined [writeback-index]", () => {
  const snapshot = { status: "quarantined" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "quarantined");
});

test("toWorkerStatus returns offline when snapshot is offline [writeback-index]", () => {
  const snapshot = { status: "offline" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "offline");
});

test("toWorkerStatus returns draining when snapshot is draining [writeback-index]", () => {
  const snapshot = { status: "draining" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "draining");
});

test("toWorkerStatus returns degraded when snapshot is degraded [writeback-index]", () => {
  const snapshot = { status: "degraded" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "degraded");
});

test("toWorkerStatus returns busy when running executions exist [writeback-index]", () => {
  const snapshot = { status: "idle" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, ["exec_1", "exec_2"]), "busy");
});

test("toWorkerStatus returns idle when no running executions [writeback-index]", () => {
  const snapshot = { status: "idle" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "idle");
});

test("toWorkerStatus returns busy for idle worker with one execution [writeback-index]", () => {
  const snapshot = { status: "idle" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, ["exec_1"]), "busy");
});

// ---------------------------------------------------------------------------
// toExecutionTerminalStatus tests
// ---------------------------------------------------------------------------

test("toExecutionTerminalStatus maps done to succeeded [writeback-index]", () => {
  assert.equal(toExecutionTerminalStatus("done"), "succeeded");
});

test("toExecutionTerminalStatus maps failed to failed [writeback-index]", () => {
  assert.equal(toExecutionTerminalStatus("failed"), "failed");
});

test("toExecutionTerminalStatus maps cancelled to cancelled [writeback-index]", () => {
  assert.equal(toExecutionTerminalStatus("cancelled"), "cancelled");
});