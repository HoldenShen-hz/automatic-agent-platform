import assert from "node:assert/strict";
import test from "node:test";

import { WorkerDrainProtocol } from "../../../../../src/platform/execution/worker-pool/worker-drain-protocol.js";

test("WorkerDrainProtocol.createReceipt returns drained when no active leases", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [],
  };
  const receipt = protocol.createReceipt(request, "2024-01-01T10:30:00Z");
  assert.equal(receipt.status, "drained");
  assert.equal(receipt.activeLeaseCount, 0);
  assert.deepEqual(receipt.handoverLeaseIds, []);
  assert.equal(receipt.runTerminationCleanupRequired, false);
});

test("WorkerDrainProtocol.createReceipt returns draining when active leases exist", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [
      { leaseId: "lease-1", nodeRunId: "nr-1", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: false },
    ],
  };
  const receipt = protocol.createReceipt(request, "2024-01-01T10:30:00Z");
  assert.equal(receipt.status, "draining");
  assert.equal(receipt.activeLeaseCount, 1);
});

test("WorkerDrainProtocol.createReceipt returns deadline_exceeded when past deadline", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [],
  };
  const receipt = protocol.createReceipt(request, "2024-01-01T12:00:00Z");
  assert.equal(receipt.status, "deadline_exceeded");
});

test("WorkerDrainProtocol.createReceipt identifies handover leases", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [
      { leaseId: "lease-1", nodeRunId: "nr-1", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: true },
      { leaseId: "lease-2", nodeRunId: "nr-2", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: false },
      { leaseId: "lease-3", nodeRunId: "nr-3", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: true },
    ],
  };
  const receipt = protocol.createReceipt(request, "2024-01-01T10:30:00Z");
  assert.deepEqual(receipt.handoverLeaseIds, ["lease-1", "lease-3"]);
  assert.equal(receipt.runTerminationCleanupRequired, true);
});

test("WorkerDrainProtocol.createReceipt sets runTerminationCleanupRequired on deadline exceeded", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [],
  };
  const receipt = protocol.createReceipt(request, "2024-01-01T12:00:00Z");
  assert.equal(receipt.runTerminationCleanupRequired, true);
});

test("WorkerDrainProtocol.createReceipt preserves request metadata", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [],
  };
  const receipt = protocol.createReceipt(request);
  assert.equal(receipt.workerId, "worker-1");
  assert.equal(receipt.requestedBy, "coordinator-1");
  assert.equal(receipt.requestedAt, "2024-01-01T10:00:00Z");
  assert.equal(receipt.deadlineAt, "2024-01-01T11:00:00Z");
});
