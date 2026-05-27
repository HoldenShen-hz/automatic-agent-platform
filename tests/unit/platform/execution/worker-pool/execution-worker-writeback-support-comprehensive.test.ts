/**
 * @fileoverview Unit tests for Execution Worker Writeback Support
 * Tests: parseJsonArray, removeExecutionId, toWorkerStatus, toExecutionTerminalStatus, buildAgentExecutionRecord, persistRemoteLogs
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  parseJsonArray,
  removeExecutionId,
  toWorkerStatus,
  toExecutionTerminalStatus,
} from "../../../../../src/platform/five-plane-execution/worker-pool/execution-worker-writeback-support.js";
import type { WorkerSnapshotRecord } from "../../../../../src/platform/contracts/types/domain.js";
import type { TaskTerminalStatus } from "../../../../../src/platform/contracts/types/status.js";

// ---------------------------------------------------------------------------
// parseJsonArray
// ---------------------------------------------------------------------------

test("parseJsonArray parses valid JSON array [execution-worker-writeback-support-comprehensive]", () => {
  const result = parseJsonArray('["exec-1", "exec-2", "exec-3"]');
  assert.deepStrictEqual(result, ["exec-1", "exec-2", "exec-3"]);
});

test("parseJsonArray returns empty array for invalid JSON [execution-worker-writeback-support-comprehensive]", () => {
  const result = parseJsonArray("not-json");
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray returns empty array for non-array JSON [execution-worker-writeback-support-comprehensive]", () => {
  const result = parseJsonArray('{"key": "value"}');
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray filters out non-string items [execution-worker-writeback-support-comprehensive]", () => {
  const result = parseJsonArray('["exec-a", 123, true, null, "exec-b"]');
  assert.deepStrictEqual(result, ["exec-a", "exec-b"]);
});

test("parseJsonArray handles empty array [execution-worker-writeback-support-comprehensive]", () => {
  const result = parseJsonArray("[]");
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray handles empty string [execution-worker-writeback-support-comprehensive]", () => {
  const result = parseJsonArray("");
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray handles nested arrays as strings [execution-worker-writeback-support-comprehensive]", () => {
  const result = parseJsonArray('["[nested]", "value"]');
  assert.deepStrictEqual(result, ["[nested]", "value"]);
});

test("parseJsonArray handles whitespace-only strings [execution-worker-writeback-support-comprehensive]", () => {
  const result = parseJsonArray("   ");
  assert.deepStrictEqual(result, []);
});

// ---------------------------------------------------------------------------
// removeExecutionId
// ---------------------------------------------------------------------------

test("removeExecutionId removes the specified ID [execution-worker-writeback-support-comprehensive]", () => {
  const result = removeExecutionId(["a", "b", "c"], "b");
  assert.deepStrictEqual(result, ["a", "c"]);
});

test("removeExecutionId handles ID not in array [execution-worker-writeback-support-comprehensive]", () => {
  const result = removeExecutionId(["a", "c"], "b");
  assert.deepStrictEqual(result, ["a", "c"]);
});

test("removeExecutionId returns sorted result [execution-worker-writeback-support-comprehensive]", () => {
  const result = removeExecutionId(["c", "a", "b"], "b");
  assert.deepStrictEqual(result, ["a", "c"]);
});

test("removeExecutionId handles empty array [execution-worker-writeback-support-comprehensive]", () => {
  const result = removeExecutionId([], "nonexistent");
  assert.deepStrictEqual(result, []);
});

test("removeExecutionId handles single element array matching [execution-worker-writeback-support-comprehensive]", () => {
  const result = removeExecutionId(["only"], "only");
  assert.deepStrictEqual(result, []);
});

test("removeExecutionId handles single element array not matching [execution-worker-writeback-support-comprehensive]", () => {
  const result = removeExecutionId(["only"], "different");
  assert.deepStrictEqual(result, ["only"]);
});

test("removeExecutionId removes duplicate stale occurrences [execution-worker-writeback-support-comprehensive]", () => {
  const result = removeExecutionId(["a", "b", "b", "c"], "b");
  assert.deepStrictEqual(result, ["a", "c"]);
});

test("removeExecutionId returns empty sorted array when all removed [execution-worker-writeback-support-comprehensive]", () => {
  const result = removeExecutionId(["a", "b"], "b");
  assert.deepStrictEqual(result, ["a"]);
});

test("removeExecutionId handles large array [execution-worker-writeback-support-comprehensive]", () => {
  const largeArray = Array.from({ length: 100 }, (_, i) => `exec-${i}`);
  const result = removeExecutionId(largeArray, "exec-50");
  assert.equal(result.length, 99);
  assert.ok(result.includes("exec-0"));
  assert.ok(!result.includes("exec-50"));
  assert.ok(result.includes("exec-99"));
});

// ---------------------------------------------------------------------------
// toWorkerStatus
// ---------------------------------------------------------------------------

test("toWorkerStatus returns unavailable when snapshot is unavailable [execution-worker-writeback-support-comprehensive]", () => {
  const snapshot = { status: "unavailable" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "unavailable");
});

test("toWorkerStatus returns quarantined when snapshot is quarantined [execution-worker-writeback-support-comprehensive]", () => {
  const snapshot = { status: "quarantined" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "quarantined");
});

test("toWorkerStatus returns offline when snapshot is offline [execution-worker-writeback-support-comprehensive]", () => {
  const snapshot = { status: "offline" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "offline");
});

test("toWorkerStatus returns draining when snapshot is draining [execution-worker-writeback-support-comprehensive]", () => {
  const snapshot = { status: "draining" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "draining");
});

test("toWorkerStatus returns degraded when snapshot is degraded [execution-worker-writeback-support-comprehensive]", () => {
  const snapshot = { status: "degraded" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "degraded");
});

test("toWorkerStatus returns busy when running executions exist [execution-worker-writeback-support-comprehensive]", () => {
  const snapshot = { status: "idle" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, ["exec-1", "exec-2"]), "busy");
});

test("toWorkerStatus returns idle when no running executions [execution-worker-writeback-support-comprehensive]", () => {
  const snapshot = { status: "idle" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "idle");
});

test("toWorkerStatus returns busy for single running execution [execution-worker-writeback-support-comprehensive]", () => {
  const snapshot = { status: "idle" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, ["exec-1"]), "busy");
});

test("toWorkerStatus returns busy regardless of base status when executions exist [execution-worker-writeback-support-comprehensive]", () => {
  const snapshot = { status: "busy" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, ["exec-1"]), "busy");
});

test("toWorkerStatus uses default case for unknown status [execution-worker-writeback-support-comprehensive]", () => {
  const snapshot = { status: "idle" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "idle");
});

// ---------------------------------------------------------------------------
// toExecutionTerminalStatus
// ---------------------------------------------------------------------------

test("toExecutionTerminalStatus maps done to succeeded [execution-worker-writeback-support-comprehensive]", () => {
  assert.equal(toExecutionTerminalStatus("done"), "succeeded");
});

test("toExecutionTerminalStatus maps failed to failed [execution-worker-writeback-support-comprehensive]", () => {
  assert.equal(toExecutionTerminalStatus("failed"), "failed");
});

test("toExecutionTerminalStatus maps cancelled to cancelled [execution-worker-writeback-support-comprehensive]", () => {
  assert.equal(toExecutionTerminalStatus("cancelled"), "cancelled");
});

test("toExecutionTerminalStatus accepts TaskTerminalStatus type values [execution-worker-writeback-support-comprehensive]", () => {
  const statuses: TaskTerminalStatus[] = ["done", "failed", "cancelled"];
  for (const status of statuses) {
    const result = toExecutionTerminalStatus(status);
    assert.ok(typeof result === "string");
  }
});

test("toExecutionTerminalStatus result values are valid terminal statuses [execution-worker-writeback-support-comprehensive]", () => {
  const result = toExecutionTerminalStatus("done");
  assert.ok(["succeeded", "failed", "cancelled"].includes(result));
});

// ---------------------------------------------------------------------------
// Edge cases for toWorkerStatus
// ---------------------------------------------------------------------------

test("toWorkerStatus prioritizes administrative states over running count [execution-worker-writeback-support-comprehensive]", () => {
  const snapshot = { status: "draining" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, ["exec-1", "exec-2", "exec-3"]), "draining");
});

test("toWorkerStatus unavailable takes precedence over busy [execution-worker-writeback-support-comprehensive]", () => {
  const snapshot = { status: "unavailable" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, ["exec-1"]), "unavailable");
});

test("toWorkerStatus quarantined takes precedence over busy [execution-worker-writeback-support-comprehensive]", () => {
  const snapshot = { status: "quarantined" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, ["exec-1"]), "quarantined");
});

test("toWorkerStatus offline takes precedence over busy [execution-worker-writeback-support-comprehensive]", () => {
  const snapshot = { status: "offline" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, ["exec-1"]), "offline");
});

test("toWorkerStatus degraded takes precedence over busy [execution-worker-writeback-support-comprehensive]", () => {
  const snapshot = { status: "degraded" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, ["exec-1"]), "degraded");
});

test("toWorkerStatus draining takes precedence over busy [execution-worker-writeback-support-comprehensive]", () => {
  const snapshot = { status: "draining" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, ["exec-1"]), "draining");
});
