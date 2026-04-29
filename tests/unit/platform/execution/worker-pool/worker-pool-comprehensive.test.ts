import assert from "node:assert/strict";
import test from "node:test";

import { WorkerDrainProtocol, WorkerDrainPhase, DEFAULT_DRAIN_CONFIG } from "../../../../../src/platform/execution/worker-pool/worker-drain-protocol.js";

test("WorkerDrainProtocol beginDrain returns DRAIN phase receipt", () => {
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

  const receipt = protocol.beginDrain(request);

  assert.equal(receipt.workerId, "worker-1");
  assert.equal(receipt.phase, WorkerDrainPhase.DRAIN);
  assert.equal(receipt.status, "draining");
  assert.equal(receipt.activeLeaseCount, 1);
  assert.equal(receipt.completedLeaseCount, 0);
  assert.ok(Array.isArray(receipt.phaseHistory));
  assert.equal(receipt.phaseHistory.length, 1);
  assert.equal(receipt.phaseHistory[0]?.phase, WorkerDrainPhase.DRAIN);
});

test("WorkerDrainProtocol advancePhase transitions from DRAIN to QUIESCE", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [],
  };

  const initialReceipt = protocol.beginDrain(request);
  const advancedReceipt = protocol.advancePhase(initialReceipt, "2024-01-01T10:30:00Z");

  assert.equal(advancedReceipt.phase, WorkerDrainPhase.QUIESCE);
  assert.equal(advancedReceipt.status, "quiescing");
  assert.ok(advancedReceipt.phaseHistory.length >= 1);
});

test("WorkerDrainProtocol advancePhase transitions from QUIESCE to TERMINATE", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [],
  };

  const initialReceipt = protocol.beginDrain(request);
  const drainReceipt = protocol.advancePhase(initialReceipt, "2024-01-01T10:30:00Z");
  const terminateReceipt = protocol.advancePhase(drainReceipt, "2024-01-01T11:00:00Z");

  assert.equal(terminateReceipt.phase, WorkerDrainPhase.TERMINATE);
  assert.ok(terminateReceipt.status === "terminated" || terminateReceipt.status === "deadline_exceeded");
});

test("WorkerDrainProtocol advancePhase returns current receipt for TERMINATE phase", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [],
  };

  const initialReceipt = protocol.beginDrain(request);
  const drainReceipt = protocol.advancePhase(initialReceipt, "2024-01-01T10:30:00Z");
  const terminateReceipt = protocol.advancePhase(drainReceipt, "2024-01-01T11:00:00Z");
  const againReceipt = protocol.advancePhase(terminateReceipt, "2024-01-01T11:30:00Z");

  // Should return the same receipt when already in TERMINATE
  assert.equal(againReceipt, terminateReceipt);
});

test("WorkerDrainProtocol isDrainComplete returns true when all leases completed", () => {
  const protocol = new WorkerDrainProtocol();
  const receipt = {
    workerId: "worker-1",
    status: "drained" as const,
    phase: WorkerDrainPhase.TERMINATE,
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeaseCount: 5,
    completedLeaseCount: 5,
    handoverLeaseIds: [],
    runTerminationCleanupRequired: false,
    forcedHandoffCount: 0,
    phaseHistory: [],
  };

  assert.equal(protocol.isDrainComplete(receipt), true);
});

test("WorkerDrainProtocol isDrainComplete returns true when in TERMINATE phase", () => {
  const protocol = new WorkerDrainProtocol();
  const receipt = {
    workerId: "worker-1",
    status: "terminated" as const,
    phase: WorkerDrainPhase.TERMINATE,
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeaseCount: 5,
    completedLeaseCount: 2,
    handoverLeaseIds: [],
    runTerminationCleanupRequired: true,
    forcedHandoffCount: 3,
    phaseHistory: [],
  };

  assert.equal(protocol.isDrainComplete(receipt), true);
});

test("WorkerDrainProtocol isDrainComplete returns false when leases pending", () => {
  const protocol = new WorkerDrainProtocol();
  const receipt = {
    workerId: "worker-1",
    status: "draining" as const,
    phase: WorkerDrainPhase.DRAIN,
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeaseCount: 5,
    completedLeaseCount: 2,
    handoverLeaseIds: [],
    runTerminationCleanupRequired: false,
    forcedHandoffCount: 0,
    phaseHistory: [],
  };

  assert.equal(protocol.isDrainComplete(receipt), false);
});

test("WorkerDrainProtocol isDeadlineExceeded returns true when past deadline", () => {
  const protocol = new WorkerDrainProtocol();
  const receipt = {
    workerId: "worker-1",
    status: "draining" as const,
    phase: WorkerDrainPhase.DRAIN,
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeaseCount: 0,
    completedLeaseCount: 0,
    handoverLeaseIds: [],
    runTerminationCleanupRequired: false,
    forcedHandoffCount: 0,
    phaseHistory: [],
  };

  assert.equal(protocol.isDeadlineExceeded(receipt, "2024-01-01T12:00:00Z"), true);
});

test("WorkerDrainProtocol isDeadlineExceeded returns false when before deadline", () => {
  const protocol = new WorkerDrainProtocol();
  const receipt = {
    workerId: "worker-1",
    status: "draining" as const,
    phase: WorkerDrainPhase.DRAIN,
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeaseCount: 0,
    completedLeaseCount: 0,
    handoverLeaseIds: [],
    runTerminationCleanupRequired: false,
    forcedHandoffCount: 0,
    phaseHistory: [],
  };

  assert.equal(protocol.isDeadlineExceeded(receipt, "2024-01-01T10:30:00Z"), false);
});

test("WorkerDrainProtocol createReceipt with custom config", () => {
  const protocol = new WorkerDrainProtocol({
    drainTimeoutMs: 5000,
    quiesceTimeoutMs: 10000,
    checkIntervalMs: 500,
  });
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [],
  };

  const receipt = protocol.createReceipt(request, "2024-01-01T10:00:01Z");

  assert.equal(receipt.status, "draining");
  assert.equal(receipt.phase, WorkerDrainPhase.DRAIN);
});

test("WorkerDrainProtocol createReceipt determines QUIESCE phase correctly", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [{ leaseId: "lease-1", nodeRunId: "nr-1", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: false }],
  };

  // After drain timeout (10s) but before quiesce timeout (30s)
  const receipt = protocol.createReceipt(request, "2024-01-01T10:00:11Z");

  assert.equal(receipt.phase, WorkerDrainPhase.QUIESCE);
  assert.equal(receipt.status, "quiescing");
});

test("WorkerDrainProtocol createReceipt determines TERMINATE phase correctly", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T10:30:00Z", // Short deadline for testing
    activeLeases: [],
  };

  // After drain + quiesce timeout
  const receipt = protocol.createReceipt(request, "2024-01-01T10:00:41Z");

  assert.equal(receipt.phase, WorkerDrainPhase.TERMINATE);
});

test("DEFAULT_DRAIN_CONFIG has expected values", () => {
  assert.equal(DEFAULT_DRAIN_CONFIG.drainTimeoutMs, 10_000);
  assert.equal(DEFAULT_DRAIN_CONFIG.quiesceTimeoutMs, 30_000);
  assert.equal(DEFAULT_DRAIN_CONFIG.checkIntervalMs, 1_000);
});

test("WorkerDrainPhase enum has expected values", () => {
  assert.equal(WorkerDrainPhase.DRAIN, "drain");
  assert.equal(WorkerDrainPhase.QUIESCE, "quiesce");
  assert.equal(WorkerDrainPhase.TERMINATE, "terminate");
});

test("WorkerDrainProtocol tracks phase history correctly", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [],
  };

  // Advance through phases
  const drainReceipt = protocol.advancePhase(protocol.beginDrain(request), "2024-01-01T10:30:00Z");
  const quiesceReceipt = protocol.advancePhase(drainReceipt, "2024-01-01T11:00:00Z");

  assert.ok(quiesceReceipt.phaseHistory.length >= 2);
});

test("WorkerDrainProtocol handles handover lease IDs", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [
      { leaseId: "lease-handover-1", nodeRunId: "nr-1", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: true },
      { leaseId: "lease-handover-2", nodeRunId: "nr-2", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: true },
      { leaseId: "lease-no-handover", nodeRunId: "nr-3", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: false },
    ],
  };

  const receipt = protocol.beginDrain(request);

  assert.equal(receipt.handoverLeaseIds.length, 2);
  assert.ok(receipt.handoverLeaseIds.includes("lease-handover-1"));
  assert.ok(receipt.handoverLeaseIds.includes("lease-handover-2"));
  assert.ok(!receipt.handoverLeaseIds.includes("lease-no-handover"));
});

test("WorkerDrainProtocol forcedHandoffCount when deadline exceeded", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T10:30:00Z",
    activeLeases: [
      { leaseId: "lease-1", nodeRunId: "nr-1", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: false },
      { leaseId: "lease-2", nodeRunId: "nr-2", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: false },
    ],
  };

  const receipt = protocol.createReceipt(request, "2024-01-01T10:00:50Z");

  assert.equal(receipt.forcedHandoffCount > 0 || receipt.runTerminationCleanupRequired, true);
});

test("WorkerDrainProtocol beginDrain with empty activeLeases", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-empty",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [],
  };

  const receipt = protocol.beginDrain(request);

  assert.equal(receipt.activeLeaseCount, 0);
  assert.equal(receipt.completedLeaseCount, 0);
  assert.deepEqual(receipt.handoverLeaseIds, []);
  assert.equal(receipt.runTerminationCleanupRequired, false);
});

test("WorkerDrainProtocol with drainReason in request", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [],
    drainReason: "graceful_shutdown",
  };

  const receipt = protocol.beginDrain(request);

  assert.equal(receipt.workerId, "worker-1");
  // drainReason is not copied to receipt directly but the request is preserved
});
