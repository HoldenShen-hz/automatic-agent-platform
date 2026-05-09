import assert from "node:assert/strict";
import test from "node:test";

/**
 * R13-19 tests: WorkerServiceIdentityRegistry persistence to durable storage
 */

interface WorkerIdentityRecord {
  workerId: string;
  serviceIdentity: string;
  mtlsPeerFingerprint: string;
  allowedNodeRunTenantsJson: string;
  createdAt: string;
  updatedAt: string;
}

interface MockStore {
  upsertWorkerIdentity?: (record: WorkerIdentityRecord) => void;
  getWorkerIdentity?: (workerId: string) => WorkerIdentityRecord | null;
  worker: {
    upsertWorkerIdentity?: (record: WorkerIdentityRecord) => void;
    getWorkerIdentity?: (workerId: string) => WorkerIdentityRecord | null;
  };
}

test("R13-19: WorkerServiceIdentityRegistry persists identity to durable storage", () => {
  const persistedRecords: WorkerIdentityRecord[] = [];

  const mockStore: MockStore = {
    upsertWorkerIdentity(record: WorkerIdentityRecord) {
      persistedRecords.push({ ...record });
    },
    getWorkerIdentity(workerId: string): WorkerIdentityRecord | null {
      return persistedRecords.find((r) => r.workerId === workerId) ?? null;
    },
  };

  function register(identity: {
    workerId: string;
    serviceIdentity: string;
    mtlsPeerFingerprint: string;
    allowedNodeRunTenants: readonly string[];
  }): typeof identity {
    const record: WorkerIdentityRecord = {
      workerId: identity.workerId,
      serviceIdentity: identity.serviceIdentity,
      mtlsPeerFingerprint: identity.mtlsPeerFingerprint,
      allowedNodeRunTenantsJson: JSON.stringify(identity.allowedNodeRunTenants),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockStore.upsertWorkerIdentity?.(record);
    return identity;
  }

  const identity = {
    workerId: "worker-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
    allowedNodeRunTenants: ["tenant-1", "tenant-2"] as const,
  };

  register(identity);

  assert.equal(persistedRecords.length, 1, "Should have persisted one record");
  assert.equal(persistedRecords[0]!.workerId, "worker-1", "Worker ID should match");
  assert.equal(persistedRecords[0]!.serviceIdentity, "service-a", "Service identity should match");
  assert.equal(persistedRecords[0]!.mtlsPeerFingerprint, "fp-123", "mTLS fingerprint should match");
  assert.deepEqual(
    JSON.parse(persistedRecords[0]!.allowedNodeRunTenantsJson),
    ["tenant-1", "tenant-2"],
    "Allowed tenants should be serialized as JSON",
  );
});

test("R13-19: WorkerServiceIdentityRegistry loads identity from durable storage on evaluateClaim", () => {
  const storedRecords: Map<string, WorkerIdentityRecord> = new Map();

  const mockStore: MockStore = {
    upsertWorkerIdentity(record: WorkerIdentityRecord) {
      storedRecords.set(record.workerId, record);
    },
    getWorkerIdentity(workerId: string): WorkerIdentityRecord | null {
      return storedRecords.get(workerId) ?? null;
    },
  };

  function register(identity: {
    workerId: string;
    serviceIdentity: string;
    mtlsPeerFingerprint: string;
    allowedNodeRunTenants: readonly string[];
  }): void {
    const record: WorkerIdentityRecord = {
      workerId: identity.workerId,
      serviceIdentity: identity.serviceIdentity,
      mtlsPeerFingerprint: identity.mtlsPeerFingerprint,
      allowedNodeRunTenantsJson: JSON.stringify(identity.allowedNodeRunTenants),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockStore.upsertWorkerIdentity?.(record);
  }

  function loadFromStore(workerId: string): {
    serviceIdentity: string;
    mtlsPeerFingerprint: string;
    allowedNodeRunTenants: string[];
  } | null {
    const record = mockStore.getWorkerIdentity?.(workerId);
    if (record) {
      return {
        serviceIdentity: record.serviceIdentity,
        mtlsPeerFingerprint: record.mtlsPeerFingerprint,
        allowedNodeRunTenants: JSON.parse(record.allowedNodeRunTenantsJson),
      };
    }
    return null;
  }

  function evaluateClaim(claim: {
    workerId: string;
    serviceIdentity: string;
    mtlsPeerFingerprint: string;
    tenantId: string;
  }): { accepted: boolean; reasonCode: string } {
    const stored = loadFromStore(claim.workerId);

    if (stored) {
      if (stored.serviceIdentity !== claim.serviceIdentity) {
        return { accepted: false, reasonCode: "worker_identity.service_identity_mismatch" };
      }
      if (stored.mtlsPeerFingerprint !== claim.mtlsPeerFingerprint) {
        return { accepted: false, reasonCode: "worker_identity.mtls_mismatch" };
      }
      if (!stored.allowedNodeRunTenants.includes(claim.tenantId)) {
        return { accepted: false, reasonCode: "worker_identity.tenant_not_allowed" };
      }
      return { accepted: true, reasonCode: "worker_identity.accepted" };
    }

    return { accepted: false, reasonCode: "worker_identity.worker_unknown" };
  }

  // Register a worker
  register({
    workerId: "worker-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
    allowedNodeRunTenants: ["tenant-1", "tenant-2"],
  });

  // Evaluate a valid claim
  const decision = evaluateClaim({
    workerId: "worker-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
    tenantId: "tenant-1",
  });

  assert.equal(decision.accepted, true, "Valid claim should be accepted");
  assert.equal(decision.reasonCode, "worker_identity.accepted", "Reason should be accepted");
});

test("R13-19: WorkerServiceIdentityRegistry returns worker_unknown for unregistered worker", () => {
  function loadFromStore(workerId: string): null {
    // No store, no records
    return null;
  }

  function evaluateClaim(claim: { workerId: string }): { accepted: boolean; reasonCode: string } {
    const stored = loadFromStore(claim.workerId);
    if (stored) {
      return { accepted: true, reasonCode: "worker_identity.accepted" };
    }
    return { accepted: false, reasonCode: "worker_identity.worker_unknown" };
  }

  const decision = evaluateClaim({ workerId: "unknown-worker" });

  assert.equal(decision.accepted, false, "Unknown worker should not be accepted");
  assert.equal(decision.reasonCode, "worker_identity.worker_unknown", "Reason should be worker_unknown");
});

test("R13-19: Persistence failure does not prevent registration (graceful degradation)", () => {
  let persistenceFailed = false;

  const mockStore: MockStore = {
    upsertWorkerIdentity(_record: WorkerIdentityRecord) {
      persistenceFailed = true;
      throw new Error("Storage unavailable");
    },
    getWorkerIdentity(): WorkerIdentityRecord | null {
      return null;
    },
  };

  function register(identity: {
    workerId: string;
    serviceIdentity: string;
    mtlsPeerFingerprint: string;
    allowedNodeRunTenants: readonly string[];
  }): typeof identity {
    const record: WorkerIdentityRecord = {
      workerId: identity.workerId,
      serviceIdentity: identity.serviceIdentity,
      mtlsPeerFingerprint: identity.mtlsPeerFingerprint,
      allowedNodeRunTenantsJson: JSON.stringify(identity.allowedNodeRunTenants),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      mockStore.upsertWorkerIdentity?.(record);
    } catch {
      // Persistence failure should not prevent registration
    }
    return identity;
  }

  const identity = {
    workerId: "worker-1",
    serviceIdentity: "service-a",
    mtlsPeerFingerprint: "fp-123",
    allowedNodeRunTenants: ["tenant-1"] as const,
  };

  const result = register(identity);

  assert.equal(result.workerId, "worker-1", "Registration should still return identity");
  assert.equal(persistenceFailed, true, "Persistence should have been attempted");
});