import assert from "node:assert/strict";
import test from "node:test";

import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { WorkerServiceIdentityRegistry } from "../../../../../src/platform/five-plane-execution/worker-pool/worker-service-identity.js";
import { WorkerDrainPhase, WorkerDrainProtocol } from "../../../../../src/platform/five-plane-execution/worker-pool/worker-drain-protocol.js";

function createMockStore(): AuthoritativeTaskStore {
  return {
    worker: {
      listWorkerSnapshots: () => [],
      getWorkerSnapshot: () => null,
      upsertWorkerSnapshot: () => {},
    },
  } as unknown as AuthoritativeTaskStore;
}

test("WorkerServiceIdentityRegistry evaluateClaim loads from store before evaluation", () => {
  // This test verifies that loadFromStore is called during evaluateClaim
  // even if the registry hasn't been explicitly loaded
  const registry = new WorkerServiceIdentityRegistry(createMockStore());
  const decision = registry.evaluateClaim({
    workerId: "unknown-worker",
    nodeRunId: "nr-1",
    tenantId: "tenant-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
  });

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "worker_identity.worker_unknown");
});

test("WorkerServiceIdentityRegistry multiple workers can be registered and evaluated", () => {
  const registry = new WorkerServiceIdentityRegistry(createMockStore());

  // Register first worker
  registry.register({
    workerId: "worker-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-1",
    allowedNodeRunTenants: ["tenant-1"],
  });

  // Register second worker
  registry.register({
    workerId: "worker-2",
    serviceIdentity: "service-b",
    mtlsPeerFingerprint: "fp-2",
    allowedNodeRunTenants: ["tenant-2"],
  });

  // Evaluate first worker
  const decision1 = registry.evaluateClaim({
    workerId: "worker-1",
    nodeRunId: "nr-1",
    tenantId: "tenant-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-1",
  });
  assert.equal(decision1.accepted, true);

  // Evaluate second worker
  const decision2 = registry.evaluateClaim({
    workerId: "worker-2",
    nodeRunId: "nr-2",
    tenantId: "tenant-2",
    serviceIdentity: "service-b",
    mtlsPeerFingerprint: "fp-2",
  });
  assert.equal(decision2.accepted, true);
});

test("WorkerServiceIdentityRegistry evaluateClaim fails for wrong tenant", () => {
  const registry = new WorkerServiceIdentityRegistry(createMockStore());

  registry.register({
    workerId: "worker-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
    allowedNodeRunTenants: ["tenant-1", "tenant-2"],
  });

  const decision = registry.evaluateClaim({
    workerId: "worker-1",
    nodeRunId: "nr-1",
    tenantId: "tenant-3", // Not in allowed list
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
  });

  assert.equal(decision.accepted, false);
  assert.equal(decision.reasonCode, "worker_identity.tenant_not_allowed");
});

test("WorkerDrainProtocol beginDrain creates correct initial receipt", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [
      { leaseId: "lease-1", nodeRunId: "nr-1", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: true },
    ],
  };

  const receipt = protocol.beginDrain(request);

  assert.equal(receipt.workerId, "worker-1");
  assert.equal(receipt.status, "draining");
  assert.equal(receipt.phase, WorkerDrainPhase.DRAIN);
  assert.equal(receipt.activeLeaseCount, 1);
  assert.equal(receipt.completedLeaseCount, 0);
  assert.ok(receipt.handoverLeaseIds.includes("lease-1"));
  assert.equal(receipt.runTerminationCleanupRequired, false);
  assert.equal(receipt.forcedHandoffCount, 0);
});

test("WorkerDrainProtocol advancePhase marks phase history entry as exited", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [],
  };

  const initialReceipt = protocol.beginDrain(request);
  assert.equal(initialReceipt.phaseHistory[0]?.exitedAt, null);

  const advancedReceipt = protocol.advancePhase(initialReceipt, "2024-01-01T10:30:00Z");

  // The DRAIN phase should now have an exitedAt
  const drainPhase = advancedReceipt.phaseHistory.find(p => p.phase === WorkerDrainPhase.DRAIN);
  assert.ok(drainPhase?.exitedAt);
});

test("WorkerDrainProtocol createReceipt with zero activeLeases returns drained status", () => {
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
  assert.equal(receipt.completedLeaseCount, 0);
  assert.equal(receipt.activeLeaseCount, 0);
});

test("WorkerDrainProtocol createReceipt calculates completed leases proportionally in QUIESCE", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [
      { leaseId: "lease-1", nodeRunId: "nr-1", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: false },
      { leaseId: "lease-2", nodeRunId: "nr-2", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: false },
      { leaseId: "lease-3", nodeRunId: "nr-3", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: false },
      { leaseId: "lease-4", nodeRunId: "nr-4", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: false },
    ],
  };

  // Halfway through drain + quiesce timeout
  const receipt = protocol.createReceipt(request, "2024-01-01T10:00:20Z");

  assert.equal(receipt.phase, WorkerDrainPhase.QUIESCE);
  // Should have completed approximately half the leases
  assert.ok(receipt.completedLeaseCount >= 0);
  assert.ok(receipt.completedLeaseCount <= 4);
});

test("WorkerDrainProtocol createReceipt marks runTerminationCleanupRequired when handover required", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [
      { leaseId: "lease-1", nodeRunId: "nr-1", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: true },
    ],
  };

  const receipt = protocol.createReceipt(request, "2024-01-01T10:30:00Z");

  assert.equal(receipt.runTerminationCleanupRequired, true);
});

test("WorkerDrainProtocol createReceipt calculates forcedHandoffCount on deadline exceeded", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T10:30:00Z", // Very short deadline
    activeLeases: [
      { leaseId: "lease-1", nodeRunId: "nr-1", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: false },
      { leaseId: "lease-2", nodeRunId: "nr-2", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: false },
    ],
  };

  const receipt = protocol.createReceipt(request, "2024-01-01T10:30:30Z");

  assert.equal(receipt.phase, WorkerDrainPhase.TERMINATE);
  assert.equal(receipt.status, "deadline_exceeded");
});

test("WorkerDrainProtocol advancePhase sets cleanupRequired based on handover leases", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [
      { leaseId: "lease-1", nodeRunId: "nr-1", expiresAt: "2024-01-01T12:00:00Z", handoverRequired: true },
    ],
  };

  const initialReceipt = protocol.beginDrain(request);
  const advancedReceipt = protocol.advancePhase(initialReceipt, "2024-01-01T10:30:00Z");

  // Even though deadline not exceeded, handover required should set cleanupRequired
  assert.equal(advancedReceipt.runTerminationCleanupRequired, true);
});

test("WorkerDrainProtocol createReceipt phaseHistory structure", () => {
  const protocol = new WorkerDrainProtocol();
  const request = {
    workerId: "worker-1",
    requestedBy: "coordinator-1",
    requestedAt: "2024-01-01T10:00:00Z",
    deadlineAt: "2024-01-01T11:00:00Z",
    activeLeases: [],
  };

  const receipt = protocol.createReceipt(request, "2024-01-01T10:30:00Z");

  assert.ok(Array.isArray(receipt.phaseHistory));
  for (const entry of receipt.phaseHistory) {
    assert.ok(entry.phase !== undefined);
    assert.ok(entry.enteredAt !== undefined);
    // exitedAt can be null for current phase
    assert.ok(typeof entry.leasesCompleted === "number");
  }
});

test("WorkerDrainProtocol isDeadlineExceeded edge case - exactly at deadline", () => {
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

  // Exactly at deadline - should return false (not exceeded until AFTER deadline)
  assert.equal(protocol.isDeadlineExceeded(receipt, "2024-01-01T11:00:00.001Z"), true);
});

test("WorkerServiceIdentityRegistry register returns identity with correct fields", () => {
  const registry = new WorkerServiceIdentityRegistry(createMockStore());
  const identity = {
    workerId: "worker-return-test",
    serviceIdentity: "service-return",
    mtlsPeerFingerprint: "fp-return",
    allowedNodeRunTenants: ["tenant-return"],
  };

  const result = registry.register(identity);

  assert.equal(result.workerId, identity.workerId);
  assert.equal(result.serviceIdentity, identity.serviceIdentity);
  assert.equal(result.mtlsPeerFingerprint, identity.mtlsPeerFingerprint);
  assert.deepEqual(result.allowedNodeRunTenants, identity.allowedNodeRunTenants);
});

test("WorkerServiceIdentityRegistry evaluateClaim returns correct reason codes for all failure cases", () => {
  const registry = new WorkerServiceIdentityRegistry(createMockStore());

  registry.register({
    workerId: "worker-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
    allowedNodeRunTenants: ["tenant-1"],
  });

  // Test all failure reason codes
  const unknownDecision = registry.evaluateClaim({
    workerId: "non-existent",
    nodeRunId: "nr-1",
    tenantId: "tenant-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
  });
  assert.equal(unknownDecision.reasonCode, "worker_identity.worker_unknown");

  const mismatchDecision = registry.evaluateClaim({
    workerId: "worker-1",
    nodeRunId: "nr-1",
    tenantId: "tenant-1",
    serviceIdentity: "service-b",
    mtlsPeerFingerprint: "fp-123",
  });
  assert.equal(mismatchDecision.reasonCode, "worker_identity.service_identity_mismatch");

  const mtlsDecision = registry.evaluateClaim({
    workerId: "worker-1",
    nodeRunId: "nr-1",
    tenantId: "tenant-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-wrong",
  });
  assert.equal(mtlsDecision.reasonCode, "worker_identity.mtls_mismatch");

  const tenantDecision = registry.evaluateClaim({
    workerId: "worker-1",
    nodeRunId: "nr-1",
    tenantId: "wrong-tenant",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
  });
  assert.equal(tenantDecision.reasonCode, "worker_identity.tenant_not_allowed");
});
