// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { WorkerRegistryService, type WorkerRegistryHeartbeatInput } from "../../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { WorkerSnapshotRecord } from "../../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// Helper types and builders
// ---------------------------------------------------------------------------

function createMockWorkerSnapshot(overrides: Partial<WorkerSnapshotRecord> = {}): WorkerSnapshotRecord {
  return {
    workerId: "worker-test-001",
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
    lastHeartbeatAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockStore(
  workerSnapshots: Map<string, WorkerSnapshotRecord> = new Map(),
): AuthoritativeTaskStore {
  return {
    worker: {
      getWorkerSnapshot: (workerId: string) => workerSnapshots.get(workerId) ?? undefined,
      upsertWorkerSnapshot: (snapshot: WorkerSnapshotRecord) => {
        workerSnapshots.set(snapshot.workerId, snapshot);
      },
      listWorkerSnapshots: () => Array.from(workerSnapshots.values()),
      listStaleWorkerSnapshots: (heartbeatBefore: string) => Array.from(workerSnapshots.values()).filter(
        (s) => s.lastHeartbeatAt < heartbeatBefore
      ),
    },
    listStaleWorkerSnapshots: (heartbeatBefore: string) => Array.from(workerSnapshots.values()).filter(
      (s) => s.lastHeartbeatAt < heartbeatBefore
    ),
  } as unknown as AuthoritativeTaskStore;
}

function makeHeartbeat(overrides: Partial<WorkerRegistryHeartbeatInput> = {}): WorkerRegistryHeartbeatInput {
  return {
    workerId: "worker-test-001",
    status: "idle",
    capabilities: [],
    runningExecutionIds: [],
    maxConcurrency: 4,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// recordHeartbeat
// ---------------------------------------------------------------------------

test("WorkerRegistryService recordHeartbeat creates snapshot for new worker", () => {
  const snapshots = new Map<string, WorkerSnapshotRecord>();
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(makeHeartbeat({ workerId: "worker-new" }));

  assert.equal(view.workerId, "worker-new");
  assert.equal(view.status, "idle");
  assert.equal(snapshots.has("worker-new"), true);
});

test("WorkerRegistryService recordHeartbeat updates existing snapshot", () => {
  const existing = createMockWorkerSnapshot({ workerId: "worker-1", status: "idle", cpuPct: 10 });
  const snapshots = new Map([["worker-1", existing]]);
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(makeHeartbeat({ workerId: "worker-1", status: "busy", cpuPct: 50 }));

  assert.equal(view.status, "busy");
  assert.equal(view.cpuPct, 50);
});

test("WorkerRegistryService recordHeartbeat preserves existing telemetry when not provided", () => {
  const existing = createMockWorkerSnapshot({ workerId: "worker-1", cpuPct: 30, memoryMb: 512 });
  const snapshots = new Map([["worker-1", existing]]);
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(makeHeartbeat({ workerId: "worker-1" }));

  assert.equal(view.cpuPct, 30);
  assert.equal(view.memoryMb, 512);
});

test("WorkerRegistryService recordHeartbeat merges running execution IDs", () => {
  const existing = createMockWorkerSnapshot({ workerId: "worker-1", runningExecutionsJson: '["exec-1"]' });
  const snapshots = new Map([["worker-1", existing]]);
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(makeHeartbeat({ workerId: "worker-1", runningExecutionIds: ["exec-1", "exec-2"] }));

  assert.deepEqual(view.runningExecutionIds, ["exec-1", "exec-2"]);
  assert.ok(view.runningExecutionIds.includes("exec-1"));
  assert.ok(view.runningExecutionIds.includes("exec-2"));
});

test("WorkerRegistryService recordHeartbeat normalizes capabilities", () => {
  const snapshots = new Map<string, WorkerSnapshotRecord>();
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(makeHeartbeat({
    workerId: "worker-1",
    capabilities: ["  tool_a  ", "tool_b", "", "  tool_a  "],
  }));

  assert.deepEqual(view.capabilities, ["tool_a", "tool_b"]);
});

test("WorkerRegistryService recordHeartbeat handles remote placement", () => {
  const snapshots = new Map<string, WorkerSnapshotRecord>();
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(makeHeartbeat({
    workerId: "worker-remote",
    placement: "remote",
    remoteSessionStatus: "connected",
    lastAcknowledgedStreamOffset: "offset-123",
  }));

  assert.equal(view.placement, "remote");
  assert.equal(view.remoteSessionStatus, "connected");
  assert.equal(view.lastAcknowledgedStreamOffset, "offset-123");
});

test("WorkerRegistryService recordHeartbeat computes availableSlots", () => {
  const existing = createMockWorkerSnapshot({
    workerId: "worker-1",
    maxConcurrency: 4,
    runningExecutionsJson: '["exec-1", "exec-2"]',
  });
  const snapshots = new Map([["worker-1", existing]]);
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(makeHeartbeat({
    workerId: "worker-1",
    runningExecutionIds: ["exec-1", "exec-2"],
  }));

  assert.equal(view.availableSlots, 2);
});

test("WorkerRegistryService recordHeartbeat increments restartGeneration on runtime change", () => {
  const existing = createMockWorkerSnapshot({
    workerId: "worker-1",
    runtimeInstanceId: "old-runtime",
    restartGeneration: 1,
  });
  const snapshots = new Map([["worker-1", existing]]);
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(makeHeartbeat({
    workerId: "worker-1",
    runtimeInstanceId: "new-runtime",
  }));

  assert.equal(view.runtimeInstanceId, "new-runtime");
  assert.equal(view.restartGeneration, 2);
  assert.equal(view.restartedFromRuntimeInstanceId, "old-runtime");
});

test("WorkerRegistryService recordHeartbeat updates lastProgressAt when progressMessage provided", () => {
  const existing = createMockWorkerSnapshot({ workerId: "worker-1", lastProgressAt: null });
  const snapshots = new Map([["worker-1", existing]]);
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);
  const beforeRecord = new Date().toISOString();

  const view = service.recordHeartbeat(makeHeartbeat({
    workerId: "worker-1",
    progressMessage: "working on task",
  }));

  assert.ok(view.lastProgressAt != null);
  assert.ok(view.lastProgressAt! >= beforeRecord);
});

test("WorkerRegistryService recordHeartbeat normalizes rate values", () => {
  const snapshots = new Map<string, WorkerSnapshotRecord>();
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(makeHeartbeat({
    workerId: "worker-1",
    saturation: 1.5,
    sandboxSuccessRate: -0.5,
  }));

  assert.equal(view.saturation, 1);
  assert.equal(view.sandboxSuccessRate, 0);
});

test("WorkerRegistryService recordHeartbeat normalizes activeLeaseCount", () => {
  const snapshots = new Map<string, WorkerSnapshotRecord>();
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(makeHeartbeat({
    workerId: "worker-1",
    activeLeaseCount: -5,
  }));

  assert.equal(view.activeLeaseCount, 0);
});

// ---------------------------------------------------------------------------
// verifyRemoteWorkerRegistration
// ---------------------------------------------------------------------------

test("WorkerRegistryService verifyRemoteWorkerRegistration creates remote worker", () => {
  const snapshots = new Map<string, WorkerSnapshotRecord>();
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const view = service.verifyRemoteWorkerRegistration({
    workerId: "remote-worker-1",
    capabilities: ["cap-a"],
    maxConcurrency: 2,
    registrationChallengeId: "challenge-123",
  });

  assert.equal(view.workerId, "remote-worker-1");
  assert.equal(view.placement, "remote");
  assert.equal(view.trusted, true);
  assert.ok(view.registrationVerifiedAt != null);
});

test("WorkerRegistryService verifyRemoteWorkerRegistration sets registrationVerifiedAt", () => {
  const snapshots = new Map<string, WorkerSnapshotRecord>();
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const before = new Date().toISOString();
  const view = service.verifyRemoteWorkerRegistration({
    workerId: "remote-worker-1",
    capabilities: [],
    maxConcurrency: 2,
    registrationChallengeId: "challenge-1",
  });
  const after = new Date().toISOString();

  assert.ok(view.registrationVerifiedAt != null);
  assert.ok(view.registrationVerifiedAt! >= before);
  assert.ok(view.registrationVerifiedAt! <= after);
});

test("WorkerRegistryService verifyRemoteWorkerRegistration preserves existing state", () => {
  const existing = createMockWorkerSnapshot({
    workerId: "remote-worker-1",
    placement: "remote",
    runtimeInstanceId: "existing-runtime",
    saturation: 0.5,
  });
  const snapshots = new Map([["remote-worker-1", existing]]);
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const view = service.verifyRemoteWorkerRegistration({
    workerId: "remote-worker-1",
    capabilities: [],
    maxConcurrency: 4,
    registrationChallengeId: "new-challenge",
  });

  assert.equal(view.runtimeInstanceId, "existing-runtime");
  assert.equal(view.saturation, 0.5);
});

// ---------------------------------------------------------------------------
// getWorker
// ---------------------------------------------------------------------------

test("WorkerRegistryService getWorker returns worker view when exists", () => {
  const existing = createMockWorkerSnapshot({ workerId: "worker-1" });
  const snapshots = new Map([["worker-1", existing]]);
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const view = service.getWorker("worker-1");

  assert.ok(view != null);
  assert.equal(view!.workerId, "worker-1");
});

test("WorkerRegistryService getWorker returns null when not exists", () => {
  const snapshots = new Map<string, WorkerSnapshotRecord>();
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const view = service.getWorker("nonexistent");

  assert.equal(view, null);
});

// ---------------------------------------------------------------------------
// listWorkers
// ---------------------------------------------------------------------------

test("WorkerRegistryService listWorkers returns all workers", () => {
  const snapshots = new Map([
    ["worker-1", createMockWorkerSnapshot({ workerId: "worker-1" })],
    ["worker-2", createMockWorkerSnapshot({ workerId: "worker-2" })],
  ]);
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const workers = service.listWorkers();

  assert.equal(workers.length, 2);
});

// ---------------------------------------------------------------------------
// listEligibleWorkers
// ---------------------------------------------------------------------------

test("WorkerRegistryService listEligibleWorkers excludes unavailable workers", () => {
  const snapshots = new Map([
    ["worker-available", createMockWorkerSnapshot({ workerId: "worker-available", status: "idle", maxConcurrency: 4 })],
    ["worker-unavailable", createMockWorkerSnapshot({ workerId: "worker-unavailable", status: "unavailable", maxConcurrency: 4 })],
  ]);
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const eligible = service.listEligibleWorkers();

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]!.workerId, "worker-available");
});

test("WorkerRegistryService listEligibleWorkers excludes draining workers", () => {
  const snapshots = new Map([
    ["worker-idle", createMockWorkerSnapshot({ workerId: "worker-idle", status: "idle", maxConcurrency: 4 })],
    ["worker-draining", createMockWorkerSnapshot({ workerId: "worker-draining", status: "draining", maxConcurrency: 4 })],
  ]);
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const eligible = service.listEligibleWorkers();

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]!.workerId, "worker-idle");
});

test("WorkerRegistryService listEligibleWorkers excludes workers at capacity", () => {
  const snapshots = new Map([
    ["worker-capacity", createMockWorkerSnapshot({
      workerId: "worker-capacity",
      status: "busy",
      maxConcurrency: 2,
      runningExecutionsJson: '["exec-1", "exec-2"]',
    })],
    ["worker-slot", createMockWorkerSnapshot({
      workerId: "worker-slot",
      status: "busy",
      maxConcurrency: 4,
      runningExecutionsJson: '["exec-1"]',
    })],
  ]);
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const eligible = service.listEligibleWorkers();

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]!.workerId, "worker-slot");
});

test("WorkerRegistryService listEligibleWorkers excludes untrusted remote workers", () => {
  const snapshots = new Map([
    ["local-worker", createMockWorkerSnapshot({
      workerId: "local-worker",
      status: "idle",
      placement: "local",
      maxConcurrency: 4,
    })],
    ["remote-trusted", createMockWorkerSnapshot({
      workerId: "remote-trusted",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: new Date().toISOString(),
      maxConcurrency: 4,
    })],
    ["remote-untrusted", createMockWorkerSnapshot({
      workerId: "remote-untrusted",
      status: "idle",
      placement: "remote",
      registrationVerifiedAt: null,
      maxConcurrency: 4,
    })],
  ]);
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const eligible = service.listEligibleWorkers();

  assert.equal(eligible.length, 2);
  assert.ok(eligible.some((w) => w.workerId === "local-worker"));
  assert.ok(eligible.some((w) => w.workerId === "remote-trusted"));
  assert.ok(!eligible.some((w) => w.workerId === "remote-untrusted"));
});

test("WorkerRegistryService listEligibleWorkers excludes degraded workers by default", () => {
  const snapshots = new Map([
    ["worker-healthy", createMockWorkerSnapshot({ workerId: "worker-healthy", status: "idle", maxConcurrency: 4 })],
    ["worker-degraded", createMockWorkerSnapshot({ workerId: "worker-degraded", status: "degraded", maxConcurrency: 4 })],
  ]);
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const eligible = service.listEligibleWorkers();

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]!.workerId, "worker-healthy");
});

test("WorkerRegistryService listEligibleWorkers includes degraded workers when requested", () => {
  const snapshots = new Map([
    ["worker-healthy", createMockWorkerSnapshot({ workerId: "worker-healthy", status: "idle", maxConcurrency: 4 })],
    ["worker-degraded", createMockWorkerSnapshot({ workerId: "worker-degraded", status: "degraded", maxConcurrency: 4 })],
  ]);
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const eligible = service.listEligibleWorkers({ includeDegraded: true });

  assert.equal(eligible.length, 2);
});

test("WorkerRegistryService listEligibleWorkers filters by required capabilities", () => {
  const snapshots = new Map([
    ["worker-cap-a", createMockWorkerSnapshot({
      workerId: "worker-cap-a",
      status: "idle",
      capabilitiesJson: '["cap_a", "cap_b"]',
      maxConcurrency: 4,
    })],
    ["worker-cap-b", createMockWorkerSnapshot({
      workerId: "worker-cap-b",
      status: "idle",
      capabilitiesJson: '["cap_b"]',
      maxConcurrency: 4,
    })],
  ]);
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const eligible = service.listEligibleWorkers({ requiredCapabilities: ["cap_a"] });

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]!.workerId, "worker-cap-a");
});

test("WorkerRegistryService listEligibleWorkers respects isolation level requirement", () => {
  const snapshots = new Map([
    ["worker-standard", createMockWorkerSnapshot({
      workerId: "worker-standard",
      status: "idle",
      isolationLevel: "standard",
      maxConcurrency: 4,
    })],
    ["worker-hardened", createMockWorkerSnapshot({
      workerId: "worker-hardened",
      status: "idle",
      isolationLevel: "hardened",
      maxConcurrency: 4,
    })],
  ]);
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const eligible = service.listEligibleWorkers({ requiredIsolationLevel: "hardened" });

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]!.workerId, "worker-hardened");
});

test("WorkerRegistryService listEligibleWorkers filters by queue affinity", () => {
  const snapshots = new Map([
    ["worker-queue-a", createMockWorkerSnapshot({
      workerId: "worker-queue-a",
      status: "idle",
      queueAffinity: "queue_a",
      maxConcurrency: 4,
    })],
    ["worker-queue-b", createMockWorkerSnapshot({
      workerId: "worker-queue-b",
      status: "idle",
      queueAffinity: "queue_b",
      maxConcurrency: 4,
    })],
  ]);
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const eligible = service.listEligibleWorkers({ queueAffinity: "queue_a" });

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]!.workerId, "worker-queue-a");
});

// ---------------------------------------------------------------------------
// listStaleWorkers
// ---------------------------------------------------------------------------

test("WorkerRegistryService listStaleWorkers returns workers with old heartbeats", () => {
  const staleTime = new Date(Date.now() - 60000).toISOString();
  const freshTime = new Date().toISOString();
  const snapshots = new Map([
    ["worker-stale", createMockWorkerSnapshot({
      workerId: "worker-stale",
      lastHeartbeatAt: new Date(Date.now() - 120000).toISOString(),
    })],
    ["worker-fresh", createMockWorkerSnapshot({
      workerId: "worker-fresh",
      lastHeartbeatAt: freshTime,
    })],
  ]);
  const store = createMockStore(snapshots);
  const service = new WorkerRegistryService(store);

  const stale = service.listStaleWorkers(staleTime, 30000);

  assert.equal(stale.length, 1);
  assert.equal(stale[0]!.workerId, "worker-stale");
});