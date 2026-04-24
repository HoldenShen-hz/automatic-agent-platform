import assert from "node:assert/strict";
import test from "node:test";

import { WorkerRegistryService, type WorkerRegistryHeartbeatInput, type WorkerSelectionOptions } from "../../../../../../src/platform/execution/worker-pool/worker/worker-registry-service.js";
import type { AuthoritativeTaskStore } from "../../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { WorkerSnapshotRecord } from "../../../../../../src/platform/contracts/types/domain.js";

function createMockStore(workers: Map<string, WorkerSnapshotRecord> = new Map()): AuthoritativeTaskStore {
  return {
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

test("WorkerRegistryService records heartbeat for new worker", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  const heartbeat = createHeartbeat({ workerId: "worker-1" });

  const view = service.recordHeartbeat(heartbeat);

  assert.equal(view.workerId, "worker-1");
  assert.equal(view.status, "idle");
  assert.deepEqual(view.capabilities, ["bash", "edit"]);
  assert.equal(view.maxConcurrency, 4);
  assert.equal(view.availableSlots, 4);
});

test("WorkerRegistryService updates existing worker heartbeat", () => {
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
  };
  const store = createMockStore(new Map([["worker-1", existingRecord]]));
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", status: "busy" }));

  assert.equal(view.workerId, "worker-1");
  assert.equal(view.status, "busy");
});

test("WorkerRegistryService computes availableSlots correctly", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    maxConcurrency: 4,
    runningExecutionIds: ["exec-1", "exec-2"],
  }));

  assert.equal(view.availableSlots, 2);
});

test("WorkerRegistryService availableSlots cannot be negative", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    maxConcurrency: 2,
    runningExecutionIds: ["exec-1", "exec-2", "exec-3", "exec-4"],
  }));

  assert.equal(view.availableSlots, 0);
});

test("WorkerRegistryService normalizes capabilities", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    capabilities: ["  bash  ", "edit", "bash", "  EDIT  "],
  }));

  assert.deepEqual(view.capabilities, ["bash", "edit"]);
});

test("WorkerRegistryService defaults placement to local", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat());

  assert.equal(view.placement, "local");
});

test("WorkerRegistryService records remote placement correctly", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ placement: "remote" }));

  assert.equal(view.placement, "remote");
});

test("WorkerRegistryService defaults isolationLevel to standard", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat());

  assert.equal(view.isolationLevel, "standard");
});

test("WorkerRegistryService records hardened isolationLevel", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ isolationLevel: "hardened" }));

  assert.equal(view.isolationLevel, "hardened");
});

test("WorkerRegistryService records strict isolationLevel", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ isolationLevel: "strict" }));

  assert.equal(view.isolationLevel, "strict");
});

test("WorkerRegistryService normalizes saturation to 0-1 range", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ saturation: 1.5 }));

  assert.equal(view.saturation, 1);
});

test("WorkerRegistryService normalizes negative saturation to 0", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ saturation: -0.5 }));

  assert.equal(view.saturation, 0);
});

test("WorkerRegistryService sets trusted true for local workers", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ placement: "local" }));

  assert.equal(view.trusted, true);
});

test("WorkerRegistryService sets trusted false for remote without registration", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ placement: "remote" }));

  assert.equal(view.trusted, false);
});

test("WorkerRegistryService sets trusted true for remote with registration", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    placement: "remote",
    registrationVerifiedAt: "2026-04-01T00:00:00.000Z",
  }));

  assert.equal(view.trusted, true);
});

test("WorkerRegistryService records remoteSessionStatus for remote workers", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    placement: "remote",
    remoteSessionStatus: "connected",
  }));

  assert.equal(view.remoteSessionStatus, "connected");
});

test("WorkerRegistryService nullifies remoteSessionStatus for local workers", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    placement: "local",
    remoteSessionStatus: "connected",
  }));

  assert.equal(view.remoteSessionStatus, null);
});

test("WorkerRegistryService getWorker returns worker view", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1" }));

  const view = service.getWorker("worker-1");

  assert.ok(view != null);
  assert.equal(view!.workerId, "worker-1");
});

test("WorkerRegistryService getWorker returns null for missing worker", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.getWorker("nonexistent");

  assert.equal(view, null);
});

test("WorkerRegistryService listWorkers returns all workers", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2" }));

  const workers = service.listWorkers();

  assert.equal(workers.length, 2);
});

test("WorkerRegistryService listEligibleWorkers filters unavailable workers", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", status: "idle" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", status: "unavailable" }));

  const eligible = service.listEligibleWorkers();

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].workerId, "worker-1");
});

test("WorkerRegistryService listEligibleWorkers filters offline workers", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", status: "idle" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", status: "offline" }));

  const eligible = service.listEligibleWorkers();

  assert.equal(eligible.length, 1);
});

test("WorkerRegistryService listEligibleWorkers filters draining workers", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", status: "idle" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", status: "draining" }));

  const eligible = service.listEligibleWorkers();

  assert.equal(eligible.length, 1);
});

test("WorkerRegistryService listEligibleWorkers filters quarantined workers", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", status: "idle" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", status: "quarantined" }));

  const eligible = service.listEligibleWorkers();

  assert.equal(eligible.length, 1);
});

test("WorkerRegistryService listEligibleWorkers filters degraded workers by default", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", status: "idle" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", status: "degraded" }));

  const eligible = service.listEligibleWorkers();

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].workerId, "worker-1");
});

test("WorkerRegistryService listEligibleWorkers includes degraded when requested", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", status: "idle" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", status: "degraded" }));

  const eligible = service.listEligibleWorkers({ includeDegraded: true });

  assert.equal(eligible.length, 2);
});

test("WorkerRegistryService listEligibleWorkers filters workers at capacity", () => {
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

test("WorkerRegistryService listEligibleWorkers filters by required capabilities", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", capabilities: ["bash"] }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", capabilities: ["bash", "edit"] }));

  const eligible = service.listEligibleWorkers({ requiredCapabilities: ["bash", "edit"] });

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].workerId, "worker-2");
});

test("WorkerRegistryService listEligibleWorkers filters by queue affinity", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", queueAffinity: "queue-a" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", queueAffinity: "queue-b" }));

  const eligible = service.listEligibleWorkers({ queueAffinity: "queue-a" });

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].workerId, "worker-1");
});

test("WorkerRegistryService listEligibleWorkers filters by isolation level", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", isolationLevel: "standard" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", isolationLevel: "hardened" }));

  const eligible = service.listEligibleWorkers({ requiredIsolationLevel: "hardened" });

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].workerId, "worker-2");
});

test("WorkerRegistryService listEligibleWorkers hardened workers meet standard requirement", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", isolationLevel: "hardened" }));

  const eligible = service.listEligibleWorkers({ requiredIsolationLevel: "standard" });

  assert.equal(eligible.length, 1);
});

test("WorkerRegistryService listEligibleWorkers strict does not meet hardened requirement", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", isolationLevel: "strict" }));

  const eligible = service.listEligibleWorkers({ requiredIsolationLevel: "hardened" });

  assert.equal(eligible.length, 0);
});

test("WorkerRegistryService listStaleWorkers returns stale workers", () => {
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
  };
  const store = createMockStore(new Map([["worker-1", existingRecord]]));
  const storeWithStale = {
    ...store,
    listStaleWorkerSnapshots: (_cutoff: string) => [existingRecord],
  } as unknown as AuthoritativeTaskStore;
  const service = new WorkerRegistryService(storeWithStale);

  const stale = service.listStaleWorkers("2026-04-02T00:00:00.000Z", 86400000);

  assert.equal(stale.length, 1);
  assert.equal(stale[0].workerId, "worker-1");
});
