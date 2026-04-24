// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import {
  parseJsonArray,
  mergeExecutionIds,
  toWorkerStatus,
  normalizeLeaseReason,
} from "../../../../../src/platform/execution/worker-pool/execution-worker-handshake-support.js";
import type { WorkerSnapshotRecord } from "../../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// parseJsonArray
// ---------------------------------------------------------------------------

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

test("parseJsonArray filters out non-string items", () => {
  const result = parseJsonArray('["a", 123, true, null, "b"]');
  assert.deepEqual(result, ["a", "b"]);
});

test("parseJsonArray handles empty array", () => {
  const result = parseJsonArray("[]");
  assert.deepEqual(result, []);
});

test("parseJsonArray handles empty string", () => {
  const result = parseJsonArray("");
  assert.deepEqual(result, []);
});

// ---------------------------------------------------------------------------
// mergeExecutionIds
// ---------------------------------------------------------------------------

test("mergeExecutionIds combines and sorts unique IDs", () => {
  const result = mergeExecutionIds(["a", "c"], "b");
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("mergeExecutionIds does not duplicate existing IDs", () => {
  const result = mergeExecutionIds(["a", "b"], "b");
  assert.deepEqual(result, ["a", "b"]);
});

test("mergeExecutionIds handles empty existing array", () => {
  const result = mergeExecutionIds([], "a");
  assert.deepEqual(result, ["a"]);
});

// ---------------------------------------------------------------------------
// toWorkerStatus
// ---------------------------------------------------------------------------

test("toWorkerStatus returns unavailable when snapshot is unavailable", () => {
  const snapshot = { status: "unavailable" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "unavailable");
});

test("toWorkerStatus returns quarantined when snapshot is quarantined", () => {
  const snapshot = { status: "quarantined" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "quarantined");
});

test("toWorkerStatus returns offline when snapshot is offline", () => {
  const snapshot = { status: "offline" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "offline");
});

test("toWorkerStatus returns draining when snapshot is draining", () => {
  const snapshot = { status: "draining" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "draining");
});

test("toWorkerStatus returns degraded when snapshot is degraded", () => {
  const snapshot = { status: "degraded" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "degraded");
});

test("toWorkerStatus returns busy when running executions exist", () => {
  const snapshot = { status: "idle" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, ["exec_1", "exec_2"]), "busy");
});

test("toWorkerStatus returns idle when no running executions", () => {
  const snapshot = { status: "idle" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "idle");
});

// ---------------------------------------------------------------------------
// normalizeLeaseReason
// ---------------------------------------------------------------------------

test("normalizeLeaseReason returns lease_not_found as-is", () => {
  assert.equal(normalizeLeaseReason("lease_not_found"), "lease_not_found");
});

test("normalizeLeaseReason returns lease_not_active as-is", () => {
  assert.equal(normalizeLeaseReason("lease_not_active"), "lease_not_active");
});

test("normalizeLeaseReason returns lease_expired as-is", () => {
  assert.equal(normalizeLeaseReason("lease_expired"), "lease_expired");
});

test("normalizeLeaseReason returns worker_mismatch as-is", () => {
  assert.equal(normalizeLeaseReason("worker_mismatch"), "worker_mismatch");
});

test("normalizeLeaseReason returns no_active_lease as-is", () => {
  assert.equal(normalizeLeaseReason("no_active_lease"), "no_active_lease");
});

test("normalizeLeaseReason returns stale_fencing_token as-is", () => {
  assert.equal(normalizeLeaseReason("stale_fencing_token"), "stale_fencing_token");
});

test("normalizeLeaseReason returns null for unknown reason codes", () => {
  assert.equal(normalizeLeaseReason("unknown_code"), null);
});

test("normalizeLeaseReason returns null for null input", () => {
  assert.equal(normalizeLeaseReason(null), null);
});