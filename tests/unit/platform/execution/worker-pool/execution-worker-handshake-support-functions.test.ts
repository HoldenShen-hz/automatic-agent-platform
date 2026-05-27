/**
 * @fileoverview Unit tests for Execution Worker Handshake Support Functions
 * Tests: mergeExecutionIds, recordRejectedEvent, normalizeLeaseReason
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeExecutionIds,
  recordRejectedEvent,
  normalizeLeaseReason,
} from "../../../../../src/platform/five-plane-execution/worker-pool/execution-worker-handshake-support.js";
import type { WorkerHandshakeDecision } from "../../../../../src/platform/five-plane-execution/worker-pool/execution-worker-handshake-types.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

// ---------------------------------------------------------------------------
// Mock store factory
// ---------------------------------------------------------------------------

function createMockStore(overrides: Partial<AuthoritativeTaskStore> = {}): AuthoritativeTaskStore {
  return {
    dispatch: {
      getExecution: () => null,
    },
    event: {
      insertEvent: () => {},
    },
    ...overrides,
  } as unknown as AuthoritativeTaskStore;
}

// ---------------------------------------------------------------------------
// mergeExecutionIds
// ---------------------------------------------------------------------------

test("mergeExecutionIds adds new execution ID to existing array [execution-worker-handshake-support-functions]", () => {
  const result = mergeExecutionIds(["exec-1", "exec-2"], "exec-3");
  assert.deepEqual(result, ["exec-1", "exec-2", "exec-3"]);
});

test("mergeExecutionIds does not duplicate existing ID [execution-worker-handshake-support-functions]", () => {
  const result = mergeExecutionIds(["exec-1", "exec-2"], "exec-1");
  assert.deepEqual(result, ["exec-1", "exec-2"]);
});

test("mergeExecutionIds returns sorted result [execution-worker-handshake-support-functions]", () => {
  const result = mergeExecutionIds(["exec-3", "exec-1"], "exec-2");
  assert.deepEqual(result, ["exec-1", "exec-2", "exec-3"]);
});

test("mergeExecutionIds handles empty array [execution-worker-handshake-support-functions]", () => {
  const result = mergeExecutionIds([], "exec-1");
  assert.deepEqual(result, ["exec-1"]);
});

test("mergeExecutionIds handles single element array [execution-worker-handshake-support-functions]", () => {
  const result = mergeExecutionIds(["exec-1"], "exec-2");
  assert.deepEqual(result, ["exec-1", "exec-2"]);
});

test("mergeExecutionIds removes duplicates from existing array [execution-worker-handshake-support-functions]", () => {
  const result = mergeExecutionIds(["exec-1", "exec-1", "exec-2"], "exec-3");
  assert.deepEqual(result, ["exec-1", "exec-2", "exec-3"]);
});

test("mergeExecutionIds returns empty sorted when all duplicates [execution-worker-handshake-support-functions]", () => {
  const result = mergeExecutionIds(["exec-1", "exec-1"], "exec-1");
  assert.deepEqual(result, ["exec-1"]);
});

test("mergeExecutionIds handles large arrays [execution-worker-handshake-support-functions]", () => {
  const existing = Array.from({ length: 100 }, (_, i) => `exec-${i}`);
  const result = mergeExecutionIds(existing, "exec-new");
  assert.equal(result.length, 101);
  assert.ok(result.includes("exec-new"));
});

// ---------------------------------------------------------------------------
// recordRejectedEvent
// ---------------------------------------------------------------------------

test("recordRejectedEvent inserts event with worker:claim_rejected type [execution-worker-handshake-support-functions]", () => {
  let insertedEvent: { eventType: string; taskId: string; executionId: string; payloadJson: string } | null = null;

  const store = createMockStore({
    dispatch: {
      getExecution: () => ({ traceId: "trace-123" }),
    },
    event: {
      insertEvent: (event: { id: string; taskId: string; executionId: string; eventType: string; eventTier: string; payloadJson: string; traceId: string | null; createdAt: string }) => {
        insertedEvent = event as typeof insertedEvent;
      },
    },
  } as unknown as AuthoritativeTaskStore);

  recordRejectedEvent(store, "worker:claim_rejected", "task-123", "exec-456", "2024-01-01T00:00:00.000Z", { reason: "test" });

  assert.ok(insertedEvent !== null);
  assert.equal(insertedEvent!.eventType, "worker:claim_rejected");
  assert.equal(insertedEvent!.taskId, "task-123");
  assert.equal(insertedEvent!.executionId, "exec-456");
});

test("recordRejectedEvent inserts event with worker:heartbeat_rejected type [execution-worker-handshake-support-functions]", () => {
  let insertedEvent: { eventType: string } | null = null;

  const store = createMockStore({
    event: {
      insertEvent: (event: { eventType: string }) => {
        insertedEvent = event as typeof insertedEvent;
      },
    },
  } as unknown as AuthoritativeTaskStore);

  recordRejectedEvent(store, "worker:heartbeat_rejected", "task-123", "exec-456", "2024-01-01T00:00:00.000Z", {});

  assert.ok(insertedEvent !== null);
  assert.equal(insertedEvent!.eventType, "worker:heartbeat_rejected");
});

test("recordRejectedEvent uses traceId from execution when available [execution-worker-handshake-support-functions]", () => {
  let insertedEvent: { traceId: string | null } | null = null;

  const store = createMockStore({
    dispatch: {
      getExecution: () => ({ traceId: "trace-abc" }),
    },
    event: {
      insertEvent: (event: { traceId: string | null }) => {
        insertedEvent = event as typeof insertedEvent;
      },
    },
  } as unknown as AuthoritativeTaskStore);

  recordRejectedEvent(store, "worker:claim_rejected", "task-123", "exec-456", "2024-01-01T00:00:00.000Z", {});

  assert.ok(insertedEvent !== null);
  assert.equal(insertedEvent!.traceId, "trace-abc");
});

test("recordRejectedEvent uses null traceId when execution not found [execution-worker-handshake-support-functions]", () => {
  let insertedEvent: { traceId: string | null } | null = null;

  const store = createMockStore({
    dispatch: {
      getExecution: () => null,
    },
    event: {
      insertEvent: (event: { traceId: string | null }) => {
        insertedEvent = event as typeof insertedEvent;
      },
    },
  } as unknown as AuthoritativeTaskStore);

  recordRejectedEvent(store, "worker:claim_rejected", "task-123", "exec-456", "2024-01-01T00:00:00.000Z", {});

  assert.ok(insertedEvent !== null);
  assert.equal(insertedEvent!.traceId, null);
});

test("recordRejectedEvent serializes payload to JSON [execution-worker-handshake-support-functions]", () => {
  let insertedEvent: { payloadJson: string } | null = null;

  const store = createMockStore({
    event: {
      insertEvent: (event: { payloadJson: string }) => {
        insertedEvent = event as typeof insertedEvent;
      },
    },
  } as unknown as AuthoritativeTaskStore);

  recordRejectedEvent(store, "worker:claim_rejected", "task-123", "exec-456", "2024-01-01T00:00:00.000Z", {
    workerId: "worker-1",
    reason: "lease_not_found",
    details: { expectedLease: "lease-abc" },
  });

  assert.ok(insertedEvent !== null);
  const payload = JSON.parse(insertedEvent!.payloadJson);
  assert.equal(payload.workerId, "worker-1");
  assert.equal(payload.reason, "lease_not_found");
});

// ---------------------------------------------------------------------------
// normalizeLeaseReason
// ---------------------------------------------------------------------------

test("normalizeLeaseReason returns lease_not_found as-is [execution-worker-handshake-support-functions]", () => {
  const result = normalizeLeaseReason("lease_not_found");
  assert.equal(result, "lease_not_found");
});

test("normalizeLeaseReason returns lease_not_active as-is [execution-worker-handshake-support-functions]", () => {
  const result = normalizeLeaseReason("lease_not_active");
  assert.equal(result, "lease_not_active");
});

test("normalizeLeaseReason returns lease_expired as-is [execution-worker-handshake-support-functions]", () => {
  const result = normalizeLeaseReason("lease_expired");
  assert.equal(result, "lease_expired");
});

test("normalizeLeaseReason returns worker_mismatch as-is [execution-worker-handshake-support-functions]", () => {
  const result = normalizeLeaseReason("worker_mismatch");
  assert.equal(result, "worker_mismatch");
});

test("normalizeLeaseReason returns no_active_lease as-is [execution-worker-handshake-support-functions]", () => {
  const result = normalizeLeaseReason("no_active_lease");
  assert.equal(result, "no_active_lease");
});

test("normalizeLeaseReason returns stale_fencing_token as-is [execution-worker-handshake-support-functions]", () => {
  const result = normalizeLeaseReason("stale_fencing_token");
  assert.equal(result, "stale_fencing_token");
});

test("normalizeLeaseReason returns null for unknown reason codes [execution-worker-handshake-support-functions]", () => {
  const result = normalizeLeaseReason("unknown_reason");
  assert.equal(result, null);
});

test("normalizeLeaseReason returns null for empty string [execution-worker-handshake-support-functions]", () => {
  const result = normalizeLeaseReason(null);
  assert.equal(result, null);
});

test("normalizeLeaseReason handles various invalid reason codes [execution-worker-handshake-support-functions]", () => {
  assert.equal(normalizeLeaseReason(""), null);
  assert.equal(normalizeLeaseReason("invalid"), null);
  assert.equal(normalizeLeaseReason("some_other_reason"), null);
});

test("normalizeLeaseReason return type matches WorkerHandshakeDecision reasonCode [execution-worker-handshake-support-functions]", () => {
  const validReasons: WorkerHandshakeDecision["reasonCode"][] = [
    "lease_not_found",
    "lease_not_active",
    "lease_expired",
    "worker_mismatch",
    "no_active_lease",
    "stale_fencing_token",
  ];

  for (const reason of validReasons) {
    const result = normalizeLeaseReason(reason);
    assert.equal(result, reason);
  }
});