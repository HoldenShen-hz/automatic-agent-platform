import assert from "node:assert/strict";
import test from "node:test";

import { WorkerRegistryService, type WorkerRegistryHeartbeatInput, type WorkerSelectionOptions, type VerifyRemoteWorkerRegistrationInput } from "../../../../src/platform/five-plane-execution/worker-pool/worker/worker-registry-service.js";
import type { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { WorkerSnapshotRecord } from "../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function createMockStore(workers: Map<string, WorkerSnapshotRecord> = new Map()): AuthoritativeTaskStore {
  return {
    listStaleWorkerSnapshots: (_cutoff: string) => [...workers.values()],
    worker: {
      getWorkerSnapshot: (workerId: string) => workers.get(workerId) ?? null,
      listWorkerSnapshots: () => [...workers.values()],
      upsertWorkerSnapshot: (record: WorkerSnapshotRecord) => {
        workers.set(record.workerId, record);
      },
      listStaleWorkerSnapshots: (_cutoff: string) => [...workers.values()],
    },
  } as unknown as AuthoritativeTaskStore;
}

function createHeartbeat(overrides: Partial<WorkerRegistryHeartbeatInput> = {}): WorkerRegistryHeartbeatInput {
  return {
    workerId: overrides.workerId ?? "worker-1",
    status: overrides.status ?? "idle",
    capabilities: overrides.capabilities ?? ["bash", "edit"],
    runningExecutionIds: overrides.runningExecutionIds ?? [],
    maxConcurrency: overrides.maxConcurrency ?? 4,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

test("WorkerRegistryService constructor accepts store [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  assert.ok(service);
});

// ---------------------------------------------------------------------------
// recordHeartbeat - basic functionality
// ---------------------------------------------------------------------------

test("WorkerRegistryService recordHeartbeat creates new worker view [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  const heartbeat = createHeartbeat({ workerId: "worker-new" });

  const view = service.recordHeartbeat(heartbeat);

  assert.equal(view.workerId, "worker-new");
  assert.equal(view.status, "idle");
  assert.deepEqual(view.capabilities, ["bash", "edit"]);
  assert.equal(view.maxConcurrency, 4);
  assert.equal(view.availableSlots, 4);
  assert.ok(view.lastHeartbeatAt != null);
});

test("WorkerRegistryService recordHeartbeat preserves existing state on update [worker-registry-service]", () => {
  const existingRecord: WorkerSnapshotRecord = {
    workerId: "worker-1",
    status: "idle",
    placement: "local",
    isolationLevel: "standard",
    repoVersion: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckStatus: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncStatus: null,
    workspaceSyncCheckedAt: null,
    saturation: null,
    activeLeaseCount: 0,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
    capabilitiesJson: JSON.stringify(["bash"]),
    runningExecutionsJson: JSON.stringify([]),
    maxConcurrency: 4,
    queueAffinity: null,
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: null,
    memoryMb: null,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    version: 1,
  };
  const store = createMockStore(new Map([["worker-1", existingRecord]]));
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", status: "busy" }));

  assert.equal(view.workerId, "worker-1");
  assert.equal(view.status, "busy");
  assert.deepEqual(view.capabilities, ["bash", "edit"]);
});

test("WorkerRegistryService recordHeartbeat updates running executions [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    maxConcurrency: 4,
    runningExecutionIds: ["exec-1", "exec-2"],
  }));

  assert.equal(view.availableSlots, 2);
  assert.deepEqual(view.runningExecutionIds, ["exec-1", "exec-2"]);
});

test("WorkerRegistryService recordHeartbeat sets availableSlots to zero when over capacity [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    maxConcurrency: 2,
    runningExecutionIds: ["exec-1", "exec-2", "exec-3", "exec-4"],
  }));

  assert.equal(view.availableSlots, 0);
});

// ---------------------------------------------------------------------------
// recordHeartbeat - capability normalization
// ---------------------------------------------------------------------------

test("WorkerRegistryService recordHeartbeat normalizes capabilities with whitespace [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    capabilities: ["  bash  ", "edit", "bash", "  EDIT  "],
  }));

  assert.deepEqual(view.capabilities, ["EDIT", "bash", "edit"]);
});

test("WorkerRegistryService recordHeartbeat removes empty capabilities [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    capabilities: ["bash", "", "  ", "edit"],
  }));

  assert.deepEqual(view.capabilities, ["bash", "edit"]);
});

// ---------------------------------------------------------------------------
// recordHeartbeat - placement handling
// ---------------------------------------------------------------------------

test("WorkerRegistryService recordHeartbeat defaults placement to local [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat());

  assert.equal(view.placement, "local");
});

test("WorkerRegistryService recordHeartbeat preserves remote placement [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ placement: "remote" }));

  assert.equal(view.placement, "remote");
});

test("WorkerRegistryService recordHeartbeat preserves existing placement [worker-registry-service]", () => {
  const existingRecord: WorkerSnapshotRecord = {
    workerId: "worker-1",
    status: "idle",
    placement: "remote",
    isolationLevel: "standard",
    repoVersion: null,
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: null,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckStatus: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncStatus: null,
    workspaceSyncCheckedAt: null,
    saturation: null,
    activeLeaseCount: 0,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
    capabilitiesJson: JSON.stringify(["bash"]),
    runningExecutionsJson: JSON.stringify([]),
    maxConcurrency: 4,
    queueAffinity: null,
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: null,
    memoryMb: null,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    version: 1,
  };
  const store = createMockStore(new Map([["worker-1", existingRecord]]));
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ workerId: "worker-1" }));

  assert.equal(view.placement, "remote");
});

// ---------------------------------------------------------------------------
// recordHeartbeat - isolation level handling
// ---------------------------------------------------------------------------

test("WorkerRegistryService recordHeartbeat defaults isolationLevel to standard [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat());

  assert.equal(view.isolationLevel, "standard");
});

test("WorkerRegistryService recordHeartbeat accepts hardened isolationLevel [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ isolationLevel: "hardened" }));

  assert.equal(view.isolationLevel, "hardened");
});

test("WorkerRegistryService recordHeartbeat accepts strict isolationLevel [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ isolationLevel: "strict" }));

  assert.equal(view.isolationLevel, "strict");
});

test("WorkerRegistryService recordHeartbeat normalizes invalid isolationLevel to standard [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ isolationLevel: "invalid" as any }));

  assert.equal(view.isolationLevel, "standard");
});

// ---------------------------------------------------------------------------
// recordHeartbeat - saturation normalization
// ---------------------------------------------------------------------------

test("WorkerRegistryService recordHeartbeat normalizes saturation above 1 to 1 [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ saturation: 1.5 }));

  assert.equal(view.saturation, 1);
});

test("WorkerRegistryService recordHeartbeat normalizes negative saturation to 0 [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ saturation: -0.5 }));

  assert.equal(view.saturation, 0);
});

test("WorkerRegistryService recordHeartbeat preserves null saturation [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ saturation: null as any }));

  assert.equal(view.saturation, null);
});

test("WorkerRegistryService recordHeartbeat normalizes infinite saturation to null [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ saturation: Infinity }));

  assert.equal(view.saturation, null);
});

// ---------------------------------------------------------------------------
// recordHeartbeat - trusted status
// ---------------------------------------------------------------------------

test("WorkerRegistryService recordHeartbeat sets trusted true for local workers [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ placement: "local" }));

  assert.equal(view.trusted, true);
});

test("WorkerRegistryService recordHeartbeat sets trusted false for remote without registration [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ placement: "remote" }));

  assert.equal(view.trusted, false);
});

test("WorkerRegistryService recordHeartbeat sets trusted true for remote with registration [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    placement: "remote",
    registrationVerifiedAt: "2026-04-01T00:00:00.000Z",
  }));

  assert.equal(view.trusted, true);
});

// ---------------------------------------------------------------------------
// recordHeartbeat - remote session status
// ---------------------------------------------------------------------------

test("WorkerRegistryService recordHeartbeat records remoteSessionStatus for remote workers [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    placement: "remote",
    remoteSessionStatus: "connected",
  }));

  assert.equal(view.remoteSessionStatus, "connected");
});

test("WorkerRegistryService recordHeartbeat nullifies remoteSessionStatus for local workers [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    placement: "local",
    remoteSessionStatus: "connected",
  }));

  assert.equal(view.remoteSessionStatus, null);
});

test("WorkerRegistryService recordHeartbeat accepts all valid remoteSessionStatus values [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  const statuses = ["connecting", "connected", "reconnecting", "degraded", "failed", "viewer_only"] as const;

  for (const status of statuses) {
    const view = service.recordHeartbeat(createHeartbeat({ placement: "remote", remoteSessionStatus: status }));
    assert.equal(view.remoteSessionStatus, status, `Expected ${status}`);
  }
});

test("WorkerRegistryService recordHeartbeat normalizes invalid remoteSessionStatus to null [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    placement: "remote",
    remoteSessionStatus: "invalid" as any,
  }));

  assert.equal(view.remoteSessionStatus, null);
});

// ---------------------------------------------------------------------------
// recordHeartbeat - session consistency check status
// ---------------------------------------------------------------------------

test("WorkerRegistryService recordHeartbeat accepts valid sessionConsistencyCheckStatus [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    placement: "remote",
    sessionConsistencyCheckStatus: "passed",
  }));

  assert.equal(view.sessionConsistencyCheckStatus, "passed");
});

test("WorkerRegistryService recordHeartbeat normalizes invalid sessionConsistencyCheckStatus to null [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    placement: "remote",
    sessionConsistencyCheckStatus: "invalid" as any,
  }));

  assert.equal(view.sessionConsistencyCheckStatus, null);
});

// ---------------------------------------------------------------------------
// recordHeartbeat - workspace sync status
// ---------------------------------------------------------------------------

test("WorkerRegistryService recordHeartbeat accepts valid workspaceSyncStatus [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    placement: "remote",
    workspaceSyncStatus: "aligned",
  }));

  assert.equal(view.workspaceSyncStatus, "aligned");
});

test("WorkerRegistryService recordHeartbeat normalizes invalid workspaceSyncStatus to null [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    placement: "remote",
    workspaceSyncStatus: "invalid" as any,
  }));

  assert.equal(view.workspaceSyncStatus, null);
});

// ---------------------------------------------------------------------------
// recordHeartbeat - telemetry merging
// ---------------------------------------------------------------------------

test("WorkerRegistryService recordHeartbeat merges cpuPct when not provided [worker-registry-service]", () => {
  const existingRecord: WorkerSnapshotRecord = {
    workerId: "worker-1",
    status: "idle",
    placement: "local",
    isolationLevel: "standard",
    repoVersion: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckStatus: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncStatus: null,
    workspaceSyncCheckedAt: null,
    saturation: null,
    activeLeaseCount: 0,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
    capabilitiesJson: JSON.stringify(["bash"]),
    runningExecutionsJson: JSON.stringify([]),
    maxConcurrency: 4,
    queueAffinity: null,
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: 50,
    memoryMb: 1024,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    version: 1,
  };
  const store = createMockStore(new Map([["worker-1", existingRecord]]));
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ workerId: "worker-1" }));

  assert.equal(view.cpuPct, 50);
  assert.equal(view.memoryMb, 1024);
});

test("WorkerRegistryService recordHeartbeat updates cpuPct when provided [worker-registry-service]", () => {
  const existingRecord: WorkerSnapshotRecord = {
    workerId: "worker-1",
    status: "idle",
    placement: "local",
    isolationLevel: "standard",
    repoVersion: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckStatus: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncStatus: null,
    workspaceSyncCheckedAt: null,
    saturation: null,
    activeLeaseCount: 0,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
    capabilitiesJson: JSON.stringify(["bash"]),
    runningExecutionsJson: JSON.stringify([]),
    maxConcurrency: 4,
    queueAffinity: null,
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: 50,
    memoryMb: 1024,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    version: 1,
  };
  const store = createMockStore(new Map([["worker-1", existingRecord]]));
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", cpuPct: 75, memoryMb: 2048 }));

  assert.equal(view.cpuPct, 75);
  assert.equal(view.memoryMb, 2048);
});

// ---------------------------------------------------------------------------
// recordHeartbeat - restart semantics
// ---------------------------------------------------------------------------

test("WorkerRegistryService recordHeartbeat increments restartGeneration on restart [worker-registry-service]", () => {
  const existingRecord: WorkerSnapshotRecord = {
    workerId: "worker-1",
    status: "idle",
    placement: "local",
    isolationLevel: "standard",
    repoVersion: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckStatus: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncStatus: null,
    workspaceSyncCheckedAt: null,
    saturation: null,
    activeLeaseCount: 0,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
    capabilitiesJson: JSON.stringify(["bash"]),
    runningExecutionsJson: JSON.stringify([]),
    maxConcurrency: 4,
    queueAffinity: null,
    runtimeInstanceId: "runtime-old",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: null,
    memoryMb: null,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    version: 1,
  };
  const store = createMockStore(new Map([["worker-1", existingRecord]]));
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    runtimeInstanceId: "runtime-new",
  }));

  assert.equal(view.restartGeneration, 1);
  assert.equal(view.runtimeInstanceId, "runtime-new");
  assert.equal(view.restartedFromRuntimeInstanceId, "runtime-old");
});

test("WorkerRegistryService recordHeartbeat preserves restartGeneration when no restart detected [worker-registry-service]", () => {
  const existingRecord: WorkerSnapshotRecord = {
    workerId: "worker-1",
    status: "idle",
    placement: "local",
    isolationLevel: "standard",
    repoVersion: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckStatus: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncStatus: null,
    workspaceSyncCheckedAt: null,
    saturation: null,
    activeLeaseCount: 0,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
    capabilitiesJson: JSON.stringify(["bash"]),
    runningExecutionsJson: JSON.stringify([]),
    maxConcurrency: 4,
    queueAffinity: null,
    runtimeInstanceId: "runtime-same",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 3,
    cpuPct: null,
    memoryMb: null,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    version: 1,
  };
  const store = createMockStore(new Map([["worker-1", existingRecord]]));
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    runtimeInstanceId: "runtime-same",
  }));

  assert.equal(view.restartGeneration, 3);
});

// ---------------------------------------------------------------------------
// getWorker
// ---------------------------------------------------------------------------

test("WorkerRegistryService getWorker returns worker view for existing worker [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1" }));

  const view = service.getWorker("worker-1");

  assert.ok(view != null);
  assert.equal(view!.workerId, "worker-1");
});

test("WorkerRegistryService getWorker returns null for missing worker [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.getWorker("nonexistent");

  assert.equal(view, null);
});

// ---------------------------------------------------------------------------
// listWorkers
// ---------------------------------------------------------------------------

test("WorkerRegistryService listWorkers returns all registered workers [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-3" }));

  const workers = service.listWorkers();

  assert.equal(workers.length, 3);
});

test("WorkerRegistryService listWorkers returns empty array when no workers registered [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const workers = service.listWorkers();

  assert.equal(workers.length, 0);
});

// ---------------------------------------------------------------------------
// listEligibleWorkers - status filtering
// ---------------------------------------------------------------------------

test("WorkerRegistryService listEligibleWorkers excludes unavailable workers [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", status: "idle" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", status: "unavailable" }));

  const eligible = service.listEligibleWorkers();

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]!.workerId, "worker-1");
});

test("WorkerRegistryService listEligibleWorkers excludes offline workers [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", status: "idle" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", status: "offline" }));

  const eligible = service.listEligibleWorkers();

  assert.equal(eligible.length, 1);
});

test("WorkerRegistryService listEligibleWorkers excludes draining workers [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", status: "idle" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", status: "draining" }));

  const eligible = service.listEligibleWorkers();

  assert.equal(eligible.length, 1);
});

test("WorkerRegistryService listEligibleWorkers excludes quarantined workers [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", status: "idle" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", status: "quarantined" }));

  const eligible = service.listEligibleWorkers();

  assert.equal(eligible.length, 1);
});

test("WorkerRegistryService listEligibleWorkers excludes degraded workers by default [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", status: "idle" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", status: "degraded" }));

  const eligible = service.listEligibleWorkers();

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]!.workerId, "worker-1");
});

test("WorkerRegistryService listEligibleWorkers includes degraded workers when includeDegraded is true [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", status: "idle" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", status: "degraded" }));

  const eligible = service.listEligibleWorkers({ includeDegraded: true });

  assert.equal(eligible.length, 2);
});

// ---------------------------------------------------------------------------
// listEligibleWorkers - capacity filtering
// ---------------------------------------------------------------------------

test("WorkerRegistryService listEligibleWorkers excludes workers at capacity [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    maxConcurrency: 4,
    runningExecutionIds: ["e1", "e2", "e3", "e4"],
  }));

  const eligible = service.listEligibleWorkers();

  assert.equal(eligible.length, 0);
});

test("WorkerRegistryService listEligibleWorkers includes workers with available slots [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    maxConcurrency: 4,
    runningExecutionIds: ["e1"],
  }));

  const eligible = service.listEligibleWorkers();

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]!.availableSlots, 3);
});

// ---------------------------------------------------------------------------
// listEligibleWorkers - capability filtering
// ---------------------------------------------------------------------------

test("WorkerRegistryService listEligibleWorkers filters by required capabilities [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", capabilities: ["bash"] }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", capabilities: ["bash", "edit"] }));

  const eligible = service.listEligibleWorkers({ requiredCapabilities: ["bash", "edit"] });

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]!.workerId, "worker-2");
});

test("WorkerRegistryService listEligibleWorkers excludes workers missing required capabilities [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", capabilities: ["bash"] }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", capabilities: ["edit"] }));

  const eligible = service.listEligibleWorkers({ requiredCapabilities: ["bash", "edit"] });

  assert.equal(eligible.length, 0);
});

// ---------------------------------------------------------------------------
// listEligibleWorkers - queue affinity filtering
// ---------------------------------------------------------------------------

test("WorkerRegistryService listEligibleWorkers filters by queue affinity [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", queueAffinity: "queue-a" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", queueAffinity: "queue-b" }));

  const eligible = service.listEligibleWorkers({ queueAffinity: "queue-a" });

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]!.workerId, "worker-1");
});

test("WorkerRegistryService listEligibleWorkers allows workers without queue affinity [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", queueAffinity: null }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", queueAffinity: "queue-a" }));

  const eligible = service.listEligibleWorkers({ queueAffinity: "queue-a" });

  assert.equal(eligible.length, 2);
  assert.ok(eligible.some((worker) => worker.workerId === "worker-1"));
  assert.ok(eligible.some((worker) => worker.workerId === "worker-2"));
});

// ---------------------------------------------------------------------------
// listEligibleWorkers - isolation level filtering
// ---------------------------------------------------------------------------

test("WorkerRegistryService listEligibleWorkers filters by required isolation level [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", isolationLevel: "standard" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", isolationLevel: "hardened" }));

  const eligible = service.listEligibleWorkers({ requiredIsolationLevel: "hardened" });

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]!.workerId, "worker-2");
});

test("WorkerRegistryService listEligibleWorkers hardened workers meet standard requirement [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", isolationLevel: "hardened" }));

  const eligible = service.listEligibleWorkers({ requiredIsolationLevel: "standard" });

  assert.equal(eligible.length, 1);
});

test("WorkerRegistryService listEligibleWorkers strict isolation satisfies hardened requirement [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", isolationLevel: "strict" }));

  const eligible = service.listEligibleWorkers({ requiredIsolationLevel: "hardened" });

  assert.equal(eligible.length, 1);
});

test("WorkerRegistryService listEligibleWorkers standard isolation does not satisfy hardened requirement [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", isolationLevel: "standard" }));

  const eligible = service.listEligibleWorkers({ requiredIsolationLevel: "hardened" });

  assert.equal(eligible.length, 0);
});

// ---------------------------------------------------------------------------
// listEligibleWorkers - remote worker trust filtering
// ---------------------------------------------------------------------------

test("WorkerRegistryService listEligibleWorkers excludes untrusted remote workers [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", placement: "remote" }));

  const eligible = service.listEligibleWorkers();

  assert.equal(eligible.length, 0);
});

test("WorkerRegistryService listEligibleWorkers includes trusted remote workers [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    placement: "remote",
    registrationVerifiedAt: "2026-04-01T00:00:00.000Z",
  }));

  const eligible = service.listEligibleWorkers();

  assert.equal(eligible.length, 1);
});

// ---------------------------------------------------------------------------
// listStaleWorkers
// ---------------------------------------------------------------------------

test("WorkerRegistryService listStaleWorkers returns stale workers [worker-registry-service]", () => {
  const existingRecord: WorkerSnapshotRecord = {
    workerId: "worker-1",
    status: "idle",
    placement: "local",
    isolationLevel: "standard",
    repoVersion: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckStatus: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncStatus: null,
    workspaceSyncCheckedAt: null,
    saturation: null,
    activeLeaseCount: 0,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
    capabilitiesJson: JSON.stringify(["bash"]),
    runningExecutionsJson: JSON.stringify([]),
    maxConcurrency: 4,
    queueAffinity: null,
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: null,
    memoryMb: null,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    version: 1,
  };
  const store = createMockStore(new Map([["worker-1", existingRecord]]));
  const storeWithStale = {
    ...store,
    listStaleWorkerSnapshots: (_cutoff: string) => [existingRecord],
  } as unknown as AuthoritativeTaskStore;
  const service = new WorkerRegistryService(storeWithStale);

  const stale = service.listStaleWorkers("2026-04-02T00:00:00.000Z", 86400000);

  assert.equal(stale.length, 1);
  assert.equal(stale[0]!.workerId, "worker-1");
});

test("WorkerRegistryService listStaleWorkers returns empty when no stale workers [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const stale = service.listStaleWorkers("2026-04-02T00:00:00.000Z", 86400000);

  assert.equal(stale.length, 0);
});

// ---------------------------------------------------------------------------
// verifyRemoteWorkerRegistration
// ---------------------------------------------------------------------------

test("WorkerRegistryService verifyRemoteWorkerRegistration creates worker with registration [worker-registry-service]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.verifyRemoteWorkerRegistration({
    workerId: "worker-remote",
    capabilities: ["bash", "edit"],
    maxConcurrency: 4,
    registrationChallengeId: "challenge-123",
  });

  assert.equal(view.workerId, "worker-remote");
  assert.equal(view.placement, "remote");
  assert.equal(view.trusted, true);
  assert.ok(view.registrationVerifiedAt != null);
  assert.equal(view.registrationChallengeId, "challenge-123");
});

test("WorkerRegistryService verifyRemoteWorkerRegistration updates existing worker [worker-registry-service]", () => {
  const existingRecord: WorkerSnapshotRecord = {
    workerId: "worker-remote",
    status: "idle",
    placement: "remote",
    isolationLevel: "standard",
    repoVersion: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckStatus: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncStatus: null,
    workspaceSyncCheckedAt: null,
    saturation: null,
    activeLeaseCount: 0,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
    capabilitiesJson: JSON.stringify(["bash"]),
    runningExecutionsJson: JSON.stringify([]),
    maxConcurrency: 4,
    queueAffinity: null,
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: null,
    memoryMb: null,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    version: 1,
  };
  const store = createMockStore(new Map([["worker-remote", existingRecord]]));
  const service = new WorkerRegistryService(store);

  const view = service.verifyRemoteWorkerRegistration({
    workerId: "worker-remote",
    capabilities: ["bash", "edit", "mcp"],
    maxConcurrency: 8,
    registrationChallengeId: "challenge-456",
  });

  assert.equal(view.placement, "remote");
  assert.equal(view.maxConcurrency, 8);
  assert.equal(view.registrationChallengeId, "challenge-456");
  assert.deepEqual(view.capabilities, ["bash", "edit", "mcp"]);
});
