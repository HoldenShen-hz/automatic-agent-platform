import assert from "node:assert/strict";
import test from "node:test";

import {
  parseJsonArray,
  mergeExecutionIds,
  toWorkerStatus,
  normalizeLeaseReason,
  recordRejectedEvent,
} from "../../../../src/platform/five-plane-execution/worker-pool/worker/execution-worker-handshake-support.js";
import type { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { WorkerSnapshotRecord } from "../../../../src/platform/contracts/types/domain.js";
import type { WorkerRemoteLogInput } from "../../../../src/platform/five-plane-execution/worker-pool/execution-worker-writeback-service.js";

// ---------------------------------------------------------------------------
// parseJsonArray
// ---------------------------------------------------------------------------

test("parseJsonArray parses valid JSON array [execution-worker-handshake-support]", () => {
  const result = parseJsonArray('["alpha", "beta", "gamma"]');
  assert.deepStrictEqual(result, ["alpha", "beta", "gamma"]);
});

test("parseJsonArray filters non-string elements [execution-worker-handshake-support]", () => {
  const result = parseJsonArray('["a", 123, true, null, "b"]');
  assert.deepStrictEqual(result, ["a", "b"]);
});

test("parseJsonArray returns empty array for invalid JSON [execution-worker-handshake-support]", () => {
  const result = parseJsonArray("not json");
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray returns empty array for non-array JSON [execution-worker-handshake-support]", () => {
  const result = parseJsonArray('{"key": "value"}');
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray returns empty array for empty string [execution-worker-handshake-support]", () => {
  const result = parseJsonArray("");
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray handles empty JSON array [execution-worker-handshake-support]", () => {
  const result = parseJsonArray("[]");
  assert.deepStrictEqual(result, []);
});

test("parseJsonArray handles nested arrays as strings [execution-worker-handshake-support]", () => {
  const result = parseJsonArray('["[nested]", "value"]');
  assert.deepStrictEqual(result, ["[nested]", "value"]);
});

test("parseJsonArray handles JSON array with escaped characters [execution-worker-handshake-support]", () => {
  const result = parseJsonArray('["a\\"b", "c\\nd"]');
  assert.deepEqual(result, ["a\"b", "c\nd"]);
});

test("parseJsonArray handles unicode characters [execution-worker-handshake-support]", () => {
  const result = parseJsonArray('["hello", "你好", "🎉"]');
  assert.deepEqual(result, ["hello", "你好", "🎉"]);
});

test("parseJsonArray handles whitespace-only strings [execution-worker-handshake-support]", () => {
  const result = parseJsonArray('["  ", "a"]');
  assert.ok(result.includes("  "));
});

test("parseJsonArray handles JSON number strings [execution-worker-handshake-support]", () => {
  const result = parseJsonArray('["123", "456"]');
  assert.deepEqual(result, ["123", "456"]);
});

// ---------------------------------------------------------------------------
// mergeExecutionIds
// ---------------------------------------------------------------------------

test("mergeExecutionIds combines and sorts unique IDs [execution-worker-handshake-support]", () => {
  const result = mergeExecutionIds(["a", "c"], "b");
  assert.deepStrictEqual(result, ["a", "b", "c"]);
});

test("mergeExecutionIds does not duplicate existing IDs [execution-worker-handshake-support]", () => {
  const result = mergeExecutionIds(["a", "b"], "b");
  assert.deepStrictEqual(result, ["a", "b"]);
});

test("mergeExecutionIds handles empty existing array [execution-worker-handshake-support]", () => {
  const result = mergeExecutionIds([], "a");
  assert.deepStrictEqual(result, ["a"]);
});

test("mergeExecutionIds inserts at correct sorted position [execution-worker-handshake-support]", () => {
  const result = mergeExecutionIds(["a", "d", "z"], "m");
  assert.deepStrictEqual(result, ["a", "d", "m", "z"]);
});

test("mergeExecutionIds handles single element existing array [execution-worker-handshake-support]", () => {
  const result = mergeExecutionIds(["x"], "y");
  assert.deepStrictEqual(result, ["x", "y"]);
});

test("mergeExecutionIds preserves sort order with multiple additions [execution-worker-handshake-support]", () => {
  const existing = ["b", "d"];
  const result = mergeExecutionIds(existing, "a");
  assert.deepStrictEqual(result, ["a", "b", "d"]);
});

// ---------------------------------------------------------------------------
// toWorkerStatus
// ---------------------------------------------------------------------------

test("toWorkerStatus returns unavailable when snapshot status is unavailable [execution-worker-handshake-support]", () => {
  const snapshot = { status: "unavailable" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "unavailable");
});

test("toWorkerStatus returns quarantined when snapshot status is quarantined [execution-worker-handshake-support]", () => {
  const snapshot = { status: "quarantined" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "quarantined");
});

test("toWorkerStatus returns offline when snapshot status is offline [execution-worker-handshake-support]", () => {
  const snapshot = { status: "offline" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "offline");
});

test("toWorkerStatus returns draining when snapshot status is draining [execution-worker-handshake-support]", () => {
  const snapshot = { status: "draining" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "draining");
});

test("toWorkerStatus returns degraded when snapshot status is degraded [execution-worker-handshake-support]", () => {
  const snapshot = { status: "degraded" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "degraded");
});

test("toWorkerStatus returns busy when running executions exist even if status is idle [execution-worker-handshake-support]", () => {
  const snapshot = { status: "idle" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, ["exec_1", "exec_2"]), "busy");
});

test("toWorkerStatus returns idle when no running executions and status is idle [execution-worker-handshake-support]", () => {
  const snapshot = { status: "idle" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "idle");
});

test("toWorkerStatus returns busy when single running execution exists [execution-worker-handshake-support]", () => {
  const snapshot = { status: "idle" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, ["exec_1"]), "busy");
});

test("toWorkerStatus returns idle for unknown status with no running executions [execution-worker-handshake-support]", () => {
  const snapshot = { status: "idle" } as WorkerSnapshotRecord;
  assert.equal(toWorkerStatus(snapshot, []), "idle");
});

// ---------------------------------------------------------------------------
// normalizeLeaseReason
// ---------------------------------------------------------------------------

test("normalizeLeaseReason returns lease_not_found as-is [execution-worker-handshake-support]", () => {
  assert.equal(normalizeLeaseReason("lease_not_found"), "lease_not_found");
});

test("normalizeLeaseReason returns lease_not_active as-is [execution-worker-handshake-support]", () => {
  assert.equal(normalizeLeaseReason("lease_not_active"), "lease_not_active");
});

test("normalizeLeaseReason returns lease_expired as-is [execution-worker-handshake-support]", () => {
  assert.equal(normalizeLeaseReason("lease_expired"), "lease_expired");
});

test("normalizeLeaseReason returns worker_mismatch as-is [execution-worker-handshake-support]", () => {
  assert.equal(normalizeLeaseReason("worker_mismatch"), "worker_mismatch");
});

test("normalizeLeaseReason returns no_active_lease as-is [execution-worker-handshake-support]", () => {
  assert.equal(normalizeLeaseReason("no_active_lease"), "no_active_lease");
});

test("normalizeLeaseReason returns stale_fencing_token as-is [execution-worker-handshake-support]", () => {
  assert.equal(normalizeLeaseReason("stale_fencing_token"), "stale_fencing_token");
});

test("normalizeLeaseReason returns null for arbitrary unknown reason codes [execution-worker-handshake-support]", () => {
  assert.equal(normalizeLeaseReason("unknown_code"), null);
  assert.equal(normalizeLeaseReason("something_else"), null);
});

test("normalizeLeaseReason returns null for null input [execution-worker-handshake-support]", () => {
  assert.equal(normalizeLeaseReason(null), null);
});

test("normalizeLeaseReason handles mixed case reason codes [execution-worker-handshake-support]", () => {
  assert.equal(normalizeLeaseReason("Lease_Not_Found"), null);
});

// ---------------------------------------------------------------------------
// recordRejectedEvent
// ---------------------------------------------------------------------------

test("recordRejectedEvent inserts event with correct fields [execution-worker-handshake-support]", () => {
  const insertedEvents: any[] = [];
  const store = {
    dispatch: {
      getExecution: (_executionId: string) => ({ traceId: "trace-123" }),
    },
    event: {
      insertEvent: (event: any) => insertedEvents.push(event),
    },
  } as unknown as AuthoritativeTaskStore;

  recordRejectedEvent(store, "worker:claim_rejected", "task-1", "exec-1", "2026-04-01T00:00:00.000Z", {
    reason: "test",
  });

  assert.equal(insertedEvents.length, 1);
  assert.equal(insertedEvents[0].taskId, "task-1");
  assert.equal(insertedEvents[0].executionId, "exec-1");
  assert.equal(insertedEvents[0].eventType, "worker:claim_rejected");
  assert.equal(insertedEvents[0].eventTier, "tier_2");
});

test("recordRejectedEvent handles worker:heartbeat_rejected event type [execution-worker-handshake-support]", () => {
  const insertedEvents: any[] = [];
  const store = {
    dispatch: {
      getExecution: (_executionId: string) => ({ traceId: "trace-123" }),
    },
    event: {
      insertEvent: (event: any) => insertedEvents.push(event),
    },
  } as unknown as AuthoritativeTaskStore;

  recordRejectedEvent(store, "worker:heartbeat_rejected", "task-2", "exec-2", "2026-04-01T00:00:00.000Z", {
    reason: "test heartbeat",
  });

  assert.equal(insertedEvents.length, 1);
  assert.equal(insertedEvents[0].eventType, "worker:heartbeat_rejected");
});

test("recordRejectedEvent uses traceId from execution [execution-worker-handshake-support]", () => {
  const insertedEvents: any[] = [];
  const store = {
    dispatch: {
      getExecution: (_executionId: string) => ({ traceId: "custom-trace-id" }),
    },
    event: {
      insertEvent: (event: any) => insertedEvents.push(event),
    },
  } as unknown as AuthoritativeTaskStore;

  recordRejectedEvent(store, "worker:claim_rejected", "task-1", "exec-1", "2026-04-01T00:00:00.000Z", {});

  assert.equal(insertedEvents[0].traceId, "custom-trace-id");
});

test("recordRejectedEvent handles missing execution with null traceId [execution-worker-handshake-support]", () => {
  const insertedEvents: any[] = [];
  const store = {
    dispatch: {
      getExecution: (_executionId: string) => null,
    },
    event: {
      insertEvent: (event: any) => insertedEvents.push(event),
    },
  } as unknown as AuthoritativeTaskStore;

  recordRejectedEvent(store, "worker:claim_rejected", "task-1", "exec-1", "2026-04-01T00:00:00.000Z", {});

  assert.equal(insertedEvents[0].traceId, null);
});

test("recordRejectedEvent serializes payload to JSON [execution-worker-handshake-support]", () => {
  const insertedEvents: any[] = [];
  const store = {
    dispatch: {
      getExecution: (_executionId: string) => ({ traceId: "trace-123" }),
    },
    event: {
      insertEvent: (event: any) => insertedEvents.push(event),
    },
  } as unknown as AuthoritativeTaskStore;

  recordRejectedEvent(store, "worker:claim_rejected", "task-1", "exec-1", "2026-04-01T00:00:00.000Z", {
    workerId: "worker-1",
    reason: "capacity_exceeded",
    currentLoad: 0.95,
  });

  const payload = JSON.parse(insertedEvents[0].payloadJson);
  assert.equal(payload.workerId, "worker-1");
  assert.equal(payload.reason, "capacity_exceeded");
  assert.equal(payload.currentLoad, 0.95);
});
