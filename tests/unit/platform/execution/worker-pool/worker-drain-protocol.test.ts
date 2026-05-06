import assert from "node:assert/strict";
import test from "node:test";

import { WorkerDrainProtocol } from "../../../../../src/platform/execution/worker-pool/worker-drain-protocol.js";

function makeRequest(overrides: Partial<{
  workerId: string;
  requestedBy: string;
  requestedAt: string;
  deadlineAt: string;
  drainReason: string;
  activeLeases: Array<{ leaseId: string; nodeRunId: string; expiresAt: string; handoverRequired: boolean }>;
}> = {}) {
  return {
    workerId: overrides.workerId ?? "worker-1",
    requestedBy: overrides.requestedBy ?? "coordinator-1",
    requestedAt: overrides.requestedAt ?? "2024-01-01T10:00:00Z",
    deadlineAt: overrides.deadlineAt ?? "2024-01-01T11:00:00Z",
    drainReason: overrides.drainReason ?? "graceful_shutdown",
    activeLeases: overrides.activeLeases ?? [],
  };
}

test("WorkerDrainProtocol.beginDrain requires enriched request contract and emits forced handoff metadata", () => {
  const protocol = new WorkerDrainProtocol();
  const request = makeRequest({
    activeLeases: [
      { leaseId: "lease-1", nodeRunId: "nr-1", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: true },
      { leaseId: "lease-2", nodeRunId: "nr-2", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: false },
      { leaseId: "lease-3", nodeRunId: "nr-3", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: true },
    ],
  });

  const receipt = protocol.beginDrain(request);

  assert.equal(request.drainReason, "graceful_shutdown");
  assert.deepEqual(receipt.handoverLeaseIds, ["lease-1", "lease-3"]);
  assert.equal(receipt.forcedHandoffCount, 0);
  assert.equal(receipt.cleanupResult, undefined);
  assert.equal("cleanupResult" in receipt, true);
});

test("WorkerDrainProtocol.createReceipt uses numeric timestamps instead of lexicographic ISO ordering", () => {
  const protocol = new WorkerDrainProtocol();
  const request = makeRequest({
    requestedAt: "2024-01-01T02:00:00Z",
    deadlineAt: "2024-01-01T11:00:00+08:00",
    activeLeases: [
      { leaseId: "lease-1", nodeRunId: "nr-1", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: false },
    ],
  });

  const receipt = protocol.createReceipt(request, "2024-01-01T03:30:00Z");

  assert.equal(receipt.status, "deadline_exceeded");
  assert.equal(protocol.isDeadlineExceeded(receipt, "2024-01-01T03:30:00Z"), true);
});

test("WorkerDrainProtocol.createReceipt identifies handover leases and cleanup requirement", () => {
  const protocol = new WorkerDrainProtocol();
  const request = makeRequest({
    activeLeases: [
      { leaseId: "lease-1", nodeRunId: "nr-1", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: true },
      { leaseId: "lease-2", nodeRunId: "nr-2", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: false },
    ],
  });

  const receipt = protocol.createReceipt(request, "2024-01-01T10:00:05Z");

  assert.deepEqual(receipt.handoverLeaseIds, ["lease-1"]);
  assert.equal(receipt.runTerminationCleanupRequired, true);
});

test("WorkerDrainProtocol.advancePhase preserves cleanup contract fields", () => {
  const protocol = new WorkerDrainProtocol();
  const request = makeRequest();
  const initial = protocol.beginDrain(request);
  const next = protocol.advancePhase(initial, "2024-01-01T10:00:15Z");

  assert.equal(next.phase, "quiesce");
  assert.equal(next.forcedHandoffCount, 0);
  assert.equal(next.cleanupResult, undefined);
  assert.equal("cleanupResult" in next, true);
});

test("WorkerDrainProtocol.createReceipt marks cleanup required on deadline exceeded", () => {
  const protocol = new WorkerDrainProtocol();
  const request = makeRequest({
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
  });
  const receipt = protocol.createReceipt(request, "2024-01-01T12:00:00Z");
  assert.equal(receipt.runTerminationCleanupRequired, true);
  assert.equal(typeof receipt.forcedHandoffCount, "number");
});

test("WorkerDrainProtocol.createReceipt preserves request metadata", () => {
  const protocol = new WorkerDrainProtocol();
  const request = makeRequest();
  const receipt = protocol.createReceipt(request);
  assert.equal(receipt.workerId, "worker-1");
  assert.equal(receipt.requestedBy, "coordinator-1");
  assert.equal(receipt.requestedAt, "2024-01-01T10:00:00Z");
  assert.equal(receipt.deadlineAt, "2024-01-01T11:00:00Z");
});
