import assert from "node:assert/strict";
import test from "node:test";

import { WorkerRegistryService, type WorkerRegistryHeartbeatInput } from "../../../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { WorkerSnapshotRecord } from "../../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// Mock store and helpers
// ---------------------------------------------------------------------------

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
    listStaleWorkerSnapshots: (_cutoff: string) => [...workers.values()],
  } as unknown as AuthoritativeTaskStore;
}

function createHeartbeat(overrides: Partial<WorkerRegistryHeartbeatInput> = {}): WorkerRegistryHeartbeatInput {
  return {
    workerId: overrides.workerId ?? "worker-1",
    status: overrides.status ?? "idle",
    capabilities: overrides.capabilities ?? [],
    runningExecutionIds: overrides.runningExecutionIds ?? [],
    maxConcurrency: overrides.maxConcurrency ?? 4,
    ...overrides,
  };
}

function createWorkerSnapshot(overrides: Partial<WorkerSnapshotRecord> = {}): WorkerSnapshotRecord {
  const now = new Date().toISOString();
  return {
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
    capabilitiesJson: "[]",
    runningExecutionsJson: "[]",
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
    lastHeartbeatAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Worker Registration tests
// ---------------------------------------------------------------------------

test("WorkerRegistration new worker can register via heartbeat [worker-registration]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ workerId: "new-worker" }));

  assert.equal(view.workerId, "new-worker");
  assert.equal(view.status, "idle");
  assert.equal(view.placement, "local");
  assert.equal(view.trusted, true);
});

test("WorkerRegistration heartbeat creates snapshot if worker does not exist [worker-registration]", () => {
  const workers = new Map<string, WorkerSnapshotRecord>();
  const store = createMockStore(workers);
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "brand-new-worker" }));

  assert.equal(workers.has("brand-new-worker"), true);
});

test("WorkerRegistration remote worker without registration is untrusted [worker-registration]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "remote-worker",
    placement: "remote",
  }));

  assert.equal(view.trusted, false);
  assert.equal(view.placement, "remote");
});

test("WorkerRegistration remote worker with registrationVerifiedAt is trusted [worker-registration]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "remote-worker",
    placement: "remote",
    registrationVerifiedAt: "2026-04-01T00:00:00.000Z",
  }));

  assert.equal(view.trusted, true);
});

test("WorkerRegistration verifyRemoteWorkerRegistration creates trusted remote worker [worker-registration]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.verifyRemoteWorkerRegistration({
    workerId: "remote-worker-1",
    capabilities: ["tool-a", "tool-b"],
    maxConcurrency: 2,
    registrationChallengeId: "challenge-abc",
  });

  assert.equal(view.workerId, "remote-worker-1");
  assert.equal(view.placement, "remote");
  assert.equal(view.trusted, true);
  assert.ok(view.registrationVerifiedAt != null);
  assert.equal(view.registrationChallengeId, "challenge-abc");
});

test("WorkerRegistration verifyRemoteWorkerRegistration sets status to idle if new worker [worker-registration]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.verifyRemoteWorkerRegistration({
    workerId: "remote-worker-new",
    capabilities: [],
    maxConcurrency: 2,
    registrationChallengeId: "challenge-123",
  });

  assert.equal(view.status, "idle");
});

test("WorkerRegistration verifyRemoteWorkerRegistration preserves existing status [worker-registration]", () => {
  const existing = createWorkerSnapshot({
    workerId: "remote-worker-existing",
    status: "busy",
  });
  const workers = new Map([["remote-worker-existing", existing]]);
  const store = createMockStore(workers);
  const service = new WorkerRegistryService(store);

  const view = service.verifyRemoteWorkerRegistration({
    workerId: "remote-worker-existing",
    capabilities: [],
    maxConcurrency: 4,
    registrationChallengeId: "challenge-456",
  });

  assert.equal(view.status, "busy");
});

test("WorkerRegistration verifyRemoteWorkerRegistration preserves existing remote session state [worker-registration]", () => {
  const existing = createWorkerSnapshot({
    workerId: "remote-worker-1",
    remoteSessionStatus: "connected",
    runtimeInstanceId: "runtime-abc",
  });
  const workers = new Map([["remote-worker-1", existing]]);
  const store = createMockStore(workers);
  const service = new WorkerRegistryService(store);

  const view = service.verifyRemoteWorkerRegistration({
    workerId: "remote-worker-1",
    capabilities: [],
    maxConcurrency: 4,
    registrationChallengeId: "challenge-xyz",
  });

  assert.equal(view.remoteSessionStatus, "connected");
  assert.equal(view.runtimeInstanceId, "runtime-abc");
});

// ---------------------------------------------------------------------------
// Worker Heartbeat tests
// ---------------------------------------------------------------------------

test("WorkerHeartbeat updates worker status [worker-registration]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", status: "idle" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", status: "busy" }));

  assert.equal(service.getWorker("worker-1")!.status, "busy");
});

test("WorkerHeartbeat preserves existing telemetry when not provided [worker-registration]", () => {
  const existing = createWorkerSnapshot({
    workerId: "worker-1",
    cpuPct: 45.5,
    memoryMb: 1024,
  });
  const workers = new Map([["worker-1", existing]]);
  const store = createMockStore(workers);
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ workerId: "worker-1" }));

  assert.equal(view.cpuPct, 45.5);
  assert.equal(view.memoryMb, 1024);
});

test("WorkerHeartbeat updates telemetry when provided [worker-registration]", () => {
  const existing = createWorkerSnapshot({
    workerId: "worker-1",
    cpuPct: 45.5,
    memoryMb: 1024,
  });
  const workers = new Map([["worker-1", existing]]);
  const store = createMockStore(workers);
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    cpuPct: 80,
    memoryMb: 2048,
  }));

  assert.equal(view.cpuPct, 80);
  assert.equal(view.memoryMb, 2048);
});

test("WorkerHeartbeat updates lastProgressAt when progressMessage is provided [worker-registration]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1" }));
  const beforeUpdate = new Date().toISOString();

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    progressMessage: "Processing step 3",
  }));

  assert.ok(view.lastProgressAt != null);
  assert.ok(view.lastProgressAt! >= beforeUpdate);
});

test("WorkerHeartbeat does not update lastProgressAt when no progressMessage [worker-registration]", () => {
  const existing = createWorkerSnapshot({
    workerId: "worker-1",
    lastProgressAt: "2026-04-01T00:00:00.000Z",
  });
  const workers = new Map([["worker-1", existing]]);
  const store = createMockStore(workers);
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ workerId: "worker-1" }));

  assert.equal(view.lastProgressAt, "2026-04-01T00:00:00.000Z");
});

test("WorkerHeartbeat normalizes saturation to valid range [worker-registration]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    saturation: 1.5,
  }));

  assert.equal(view.saturation, 1);
});

test("WorkerHeartbeat normalizes negative saturation to 0 [worker-registration]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    saturation: -0.3,
  }));

  assert.equal(view.saturation, 0);
});

test("WorkerHeartbeat normalizes activeLeaseCount to non-negative [worker-registration]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    activeLeaseCount: -10,
  }));

  assert.equal(view.activeLeaseCount, 0);
});

test("WorkerHeartbeat records currentStepId [worker-registration]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    currentStepId: "step-abc-123",
  }));

  assert.equal(view.currentStepId, "step-abc-123");
});

test("WorkerHeartbeat toolBacklogCount is tracked [worker-registration]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    toolBacklogCount: 15,
  }));

  assert.equal(view.toolBacklogCount, 15);
});

test("WorkerHeartbeat remote placement nullifies remote-specific fields for local workers [worker-registration]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    placement: "local",
    remoteSessionStatus: "connected",
  }));

  assert.equal(view.placement, "local");
  assert.equal(view.remoteSessionStatus, null);
});

test("WorkerHeartbeat remote placement preserves remote-specific fields [worker-registration]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    placement: "remote",
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "offset-xyz",
  }));

  assert.equal(view.placement, "remote");
  assert.equal(view.remoteSessionStatus, "connected");
  assert.equal(view.lastAcknowledgedStreamOffset, "offset-xyz");
});

test("WorkerHeartbeat normalizes capabilities (deduplicates, trims, sorts) [worker-registration]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  // Note: normalization is case-sensitive and uses strict equality for deduplication
  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    capabilities: ["  edit  ", "bash", "", "edit"],
  }));

  assert.deepEqual(view.capabilities, ["bash", "edit"]);
});

// ---------------------------------------------------------------------------
// Restart Semantics tests
// ---------------------------------------------------------------------------

test("WorkerRestart runtimeInstanceId change increments restartGeneration [worker-registration]", () => {
  const existing = createWorkerSnapshot({
    workerId: "worker-1",
    runtimeInstanceId: "runtime-old",
    restartGeneration: 1,
  });
  const workers = new Map([["worker-1", existing]]);
  const store = createMockStore(workers);
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    runtimeInstanceId: "runtime-new",
  }));

  assert.equal(view.runtimeInstanceId, "runtime-new");
  assert.equal(view.restartGeneration, 2);
  assert.equal(view.restartedFromRuntimeInstanceId, "runtime-old");
});

test("WorkerRestart same runtimeInstanceId preserves restartGeneration [worker-registration]", () => {
  const existing = createWorkerSnapshot({
    workerId: "worker-1",
    runtimeInstanceId: "runtime-same",
    restartGeneration: 5,
  });
  const workers = new Map([["worker-1", existing]]);
  const store = createMockStore(workers);
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    runtimeInstanceId: "runtime-same",
  }));

  assert.equal(view.restartGeneration, 5);
  assert.equal(view.restartedFromRuntimeInstanceId, null);
});

test("WorkerRestart explicit restartedFromRuntimeInstanceId is preserved [worker-registration]", () => {
  const existing = createWorkerSnapshot({
    workerId: "worker-1",
    runtimeInstanceId: "runtime-old",
    restartGeneration: 1,
  });
  const workers = new Map([["worker-1", existing]]);
  const store = createMockStore(workers);
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    runtimeInstanceId: "runtime-new",
    restartedFromRuntimeInstanceId: "runtime-explicit-source",
  }));

  assert.equal(view.restartedFromRuntimeInstanceId, "runtime-explicit-source");
});

test("WorkerRestart first registration has restartGeneration 0 [worker-registration]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ workerId: "worker-new" }));

  assert.equal(view.restartGeneration, 0);
});

test("WorkerRestart new runtimeId on existing worker with no prior runtimeId is not a restart [worker-registration]", () => {
  const existing = createWorkerSnapshot({
    workerId: "worker-1",
    runtimeInstanceId: null,
    restartGeneration: 0,
  });
  const workers = new Map([["worker-1", existing]]);
  const store = createMockStore(workers);
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    runtimeInstanceId: "runtime-first",
  }));

  // null-to-something is not considered a restart; restartGeneration stays the same
  assert.equal(view.runtimeInstanceId, "runtime-first");
  assert.equal(view.restartGeneration, 0);
});

// ---------------------------------------------------------------------------
// Stale Worker tests
// ---------------------------------------------------------------------------

test("WorkerStale listStaleWorkers returns workers with old heartbeats [worker-registration]", () => {
  const staleTime = "2026-04-02T00:00:00.000Z";
  // Worker with heartbeat BEFORE the cutoff (2026-04-01T00:00:00.000Z < 2026-04-01T00:00:00.000Z cutoff)
  const staleWorker = createWorkerSnapshot({
    workerId: "worker-stale",
    lastHeartbeatAt: "2026-03-31T00:00:00.000Z", // Truly old heartbeat
  });
  const freshWorker = createWorkerSnapshot({
    workerId: "worker-fresh",
    lastHeartbeatAt: "2026-04-02T12:00:00.000Z",
  });
  const workers = new Map([
    ["worker-stale", staleWorker],
    ["worker-fresh", freshWorker],
  ]);
  const storeWithStale = {
    ...createMockStore(workers),
    listStaleWorkerSnapshots: (cutoff: string) =>
      [...workers.values()].filter((w) => w.lastHeartbeatAt < cutoff),
  } as unknown as AuthoritativeTaskStore;
  const service = new WorkerRegistryService(storeWithStale);

  const stale = service.listStaleWorkers(staleTime, 86400000); // 24 hour TTL

  assert.equal(stale.length, 1);
  assert.equal(stale[0]!.workerId, "worker-stale");
});

test("WorkerStale threshold determines staleness [worker-registration]", () => {
  const now = "2026-04-02T12:00:00.000Z";
  const workerJustStale = createWorkerSnapshot({
    workerId: "worker-just-stale",
    lastHeartbeatAt: "2026-04-02T11:00:00.000Z", // 1 hour ago
  });
  const workers = new Map([["worker-just-stale", workerJustStale]]);
  const storeWithStale = {
    ...createMockStore(workers),
    listStaleWorkerSnapshots: (cutoff: string) =>
      [...workers.values()].filter((w) => w.lastHeartbeatAt < cutoff),
  } as unknown as AuthoritativeTaskStore;
  const service = new WorkerRegistryService(storeWithStale);

  // 30 minute threshold - worker is stale (11:00 < 11:30 cutoff)
  const stale30m = service.listStaleWorkers(now, 1800000);
  assert.equal(stale30m.length, 1);

  // 2 hour threshold - worker is not stale
  const stale2h = service.listStaleWorkers(now, 7200000);
  assert.equal(stale2h.length, 0);
});

// ---------------------------------------------------------------------------
// List Workers tests
// ---------------------------------------------------------------------------

test("WorkerList listWorkers returns all registered workers [worker-registration]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-a" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-b" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-c" }));

  const workers = service.listWorkers();
  assert.equal(workers.length, 3);
});

test("WorkerList getWorker returns null for non-existent worker [worker-registration]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.getWorker("non-existent");
  assert.equal(view, null);
});

test("WorkerList multiple registrations of same worker returns single entry [worker-registration]", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1" }));

  const workers = service.listWorkers();
  assert.equal(workers.length, 1);
});
