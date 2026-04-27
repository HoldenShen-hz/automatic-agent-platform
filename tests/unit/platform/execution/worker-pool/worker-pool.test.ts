/**
 * Unit Tests: Worker Pool (WorkerRegistryService)
 *
 * Tests for the worker registry service which is the core worker pool
 * management component. Covers heartbeat recording, worker queries,
 * eligibility filtering, and stale worker detection.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { WorkerRegistryService, type WorkerRegistryHeartbeatInput } from "../../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import type { AuthoritativeTaskStore, WorkerSnapshotRecord } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { WorkerPlacement, WorkerIsolationLevel } from "../../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// Mock store factory
// ---------------------------------------------------------------------------

function createMockStore(workers: Map<string, WorkerSnapshotRecord> = new Map()): AuthoritativeTaskStore {
  return {
    worker: {
      getWorkerSnapshot: (workerId: string) => workers.get(workerId) ?? null,
      listWorkerSnapshots: () => [...workers.values()],
      upsertWorkerSnapshot: (record: WorkerSnapshotRecord) => {
        workers.set(record.workerId, record);
      },
      listStaleWorkerSnapshots: (cutoff: string) => {
        const cutoffTime = new Date(cutoff).getTime();
        return [...workers.values()].filter(
          (w) => new Date(w.lastHeartbeatAt).getTime() < cutoffTime
        );
      },
    },
    listStaleWorkerSnapshots: (cutoff: string) => {
      const cutoffTime = new Date(cutoff).getTime();
      return [...workers.values()].filter(
        (w) => new Date(w.lastHeartbeatAt).getTime() < cutoffTime
      );
    },
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

// ---------------------------------------------------------------------------
// recordHeartbeat tests
// ---------------------------------------------------------------------------

test("recordHeartbeat creates new worker snapshot on first heartbeat", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({ workerId: "new-worker" }));

  assert.equal(view.workerId, "new-worker");
  assert.equal(view.status, "idle");
  assert.equal(view.placement, "local");
  assert.equal(view.trusted, true);
  assert.equal(view.maxConcurrency, 4);
  assert.equal(view.availableSlots, 4);
});

test("recordHeartbeat updates existing worker snapshot", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", status: "idle" }));
  const view = service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", status: "busy" }));

  assert.equal(view.status, "busy");
});

test("recordHeartbeat preserves telemetry when not provided", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    cpuPct: 50,
    memoryMb: 1024,
  }));

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    status: "busy",
    // cpuPct and memoryMb not provided
  }));

  assert.equal(view.cpuPct, 50);
  assert.equal(view.memoryMb, 1024);
});

test("recordHeartbeat updates telemetry when explicitly provided", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    cpuPct: 50,
    memoryMb: 1024,
  }));

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    cpuPct: 80,
    memoryMb: 2048,
  }));

  assert.equal(view.cpuPct, 80);
  assert.equal(view.memoryMb, 2048);
});

test("recordHeartbeat computes availableSlots correctly", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    maxConcurrency: 8,
    runningExecutionIds: ["e1", "e2", "e3"],
  }));

  assert.equal(view.availableSlots, 5);
});

test("recordHeartbeat availableSlots cannot go negative", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    maxConcurrency: 2,
    runningExecutionIds: ["e1", "e2", "e3", "e4", "e5"],
  }));

  assert.equal(view.availableSlots, 0);
});

test("recordHeartbeat normalizes capabilities array", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    capabilities: ["bash", "  edit  ", "bash", "read"],
  }));

  assert.deepEqual(view.capabilities, ["bash", "edit", "read"]);
});

test("recordHeartbeat sets remoteSessionStatus to null for local placement", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    placement: "local",
    remoteSessionStatus: "connected",
  }));

  assert.equal(view.remoteSessionStatus, null);
});

test("recordHeartbeat preserves remoteSessionStatus for remote placement", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    placement: "remote",
    remoteSessionStatus: "connected",
    registrationVerifiedAt: "2026-04-01T00:00:00.000Z",
  }));

  assert.equal(view.remoteSessionStatus, "connected");
});

test("recordHeartbeat marks remote worker as trusted only with registrationVerifiedAt", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const untrustedView = service.recordHeartbeat(createHeartbeat({
    workerId: "remote-untrusted",
    placement: "remote",
  }));
  assert.equal(untrustedView.trusted, false);

  const trustedView = service.recordHeartbeat(createHeartbeat({
    workerId: "remote-trusted",
    placement: "remote",
    registrationVerifiedAt: "2026-04-01T00:00:00.000Z",
  }));
  assert.equal(trustedView.trusted, true);
});

test("recordHeartbeat increments restartGeneration when runtimeInstanceId changes", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    runtimeInstanceId: "instance-a",
  }));
  const afterFirst = service.getWorker("worker-1")!;
  assert.equal(afterFirst.restartGeneration, 0);

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    runtimeInstanceId: "instance-b",
  }));
  const afterRestart = service.getWorker("worker-1")!;
  assert.equal(afterRestart.restartGeneration, 1);
  assert.equal(afterRestart.restartedFromRuntimeInstanceId, "instance-a");
});

test("recordHeartbeat normalizes saturation to [0, 1] range", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view1 = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    saturation: 1.5, // Above range
  }));
  assert.equal(view1.saturation, 1);

  const view2 = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-2",
    saturation: -0.5, // Below range
  }));
  assert.equal(view2.saturation, 0);
});

test("recordHeartbeat updates lastProgressAt only when progressMessage provided", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const initial = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    progressMessage: "Working on step 1",
  }));
  assert.ok(initial.lastProgressAt != null);

  const withoutMessage = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    status: "busy",
    // No progressMessage
  }));
  assert.equal(withoutMessage.lastProgressAt, initial.lastProgressAt);
});

// ---------------------------------------------------------------------------
// getWorker tests
// ---------------------------------------------------------------------------

test("getWorker returns null for non-existent worker", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const worker = service.getWorker("non-existent");
  assert.equal(worker, null);
});

test("getWorker returns worker by ID", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1" }));
  const worker = service.getWorker("worker-1");

  assert.ok(worker != null);
  assert.equal(worker!.workerId, "worker-1");
});

test("getWorker returns null after worker is removed", () => {
  const workers = new Map<string, WorkerSnapshotRecord>();
  const store = createMockStore(workers);
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1" }));
  assert.ok(service.getWorker("worker-1") != null);

  // Remove the worker by clearing the map
  workers.delete("worker-1");
  const worker = service.getWorker("worker-1");
  assert.equal(worker, null);
});

// ---------------------------------------------------------------------------
// listWorkers tests
// ---------------------------------------------------------------------------

test("listWorkers returns empty array when no workers registered", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const workers = service.listWorkers();
  assert.deepEqual(workers, []);
});

test("listWorkers returns all registered workers", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-3" }));

  const workers = service.listWorkers();
  assert.equal(workers.length, 3);
  const ids = workers.map((w) => w.workerId).sort();
  assert.deepEqual(ids, ["worker-1", "worker-2", "worker-3"]);
});

// ---------------------------------------------------------------------------
// listEligibleWorkers tests
// ---------------------------------------------------------------------------

test("listEligibleWorkers excludes unavailable workers", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-idle", status: "idle" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-unavailable", status: "unavailable" }));

  const eligible = service.listEligibleWorkers();
  const ids = eligible.map((w) => w.workerId);

  assert.ok(ids.includes("worker-idle"));
  assert.ok(!ids.includes("worker-unavailable"));
});

test("listEligibleWorkers excludes draining workers", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-idle", status: "idle" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-draining", status: "draining" }));

  const eligible = service.listEligibleWorkers();
  const ids = eligible.map((w) => w.workerId);

  assert.ok(ids.includes("worker-idle"));
  assert.ok(!ids.includes("worker-draining"));
});

test("listEligibleWorkers excludes quarantined workers", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-quarantined", status: "quarantined" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-idle", status: "idle" }));

  const eligible = service.listEligibleWorkers();
  const ids = eligible.map((w) => w.workerId);

  assert.ok(!ids.includes("worker-quarantined"));
});

test("listEligibleWorkers excludes offline workers", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-offline", status: "offline" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-idle", status: "idle" }));

  const eligible = service.listEligibleWorkers();
  const ids = eligible.map((w) => w.workerId);

  assert.ok(!ids.includes("worker-offline"));
});

test("listEligibleWorkers excludes degraded workers by default", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-degraded", status: "degraded" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-idle", status: "idle" }));

  const eligible = service.listEligibleWorkers();
  const ids = eligible.map((w) => w.workerId);

  assert.ok(!ids.includes("worker-degraded"));
  assert.ok(ids.includes("worker-idle"));
});

test("listEligibleWorkers includes degraded workers when includeDegraded is true", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-degraded", status: "degraded" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-idle", status: "idle" }));

  const eligible = service.listEligibleWorkers({ includeDegraded: true });
  const ids = eligible.map((w) => w.workerId);

  assert.ok(ids.includes("worker-degraded"));
  assert.ok(ids.includes("worker-idle"));
});

test("listEligibleWorkers excludes workers at capacity", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-full",
    maxConcurrency: 2,
    runningExecutionIds: ["e1", "e2"],
  }));
  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-available",
    maxConcurrency: 2,
    runningExecutionIds: [],
  }));

  const eligible = service.listEligibleWorkers();
  const ids = eligible.map((w) => w.workerId);

  assert.ok(!ids.includes("worker-full"));
  assert.ok(ids.includes("worker-available"));
});

test("listEligibleWorkers filters by requiredCapabilities", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-bash", capabilities: ["bash"] }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-all", capabilities: ["bash", "edit", "read"] }));

  const eligible = service.listEligibleWorkers({ requiredCapabilities: ["bash", "edit"] });

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]!.workerId, "worker-all");
});

test("listEligibleWorkers includes worker with no queue affinity for any queue filter", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-no-affinity", queueAffinity: null }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-queue-x", queueAffinity: "queue-x" }));

  const eligible = service.listEligibleWorkers({ queueAffinity: "queue-x" });
  const ids = eligible.map((w) => w.workerId);

  assert.ok(ids.includes("worker-no-affinity"));
  assert.ok(ids.includes("worker-queue-x"));
});

test("listEligibleWorkers excludes worker with mismatched queue affinity", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-queue-y", queueAffinity: "queue-y" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-queue-x", queueAffinity: "queue-x" }));

  const eligible = service.listEligibleWorkers({ queueAffinity: "queue-x" });
  const ids = eligible.map((w) => w.workerId);

  assert.ok(!ids.includes("worker-queue-y"));
  assert.ok(ids.includes("worker-queue-x"));
});

test("listEligibleWorkers filters by isolation level", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-standard", isolationLevel: "standard" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-hardened", isolationLevel: "hardened" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-strict", isolationLevel: "strict" }));

  const eligible = service.listEligibleWorkers({ requiredIsolationLevel: "hardened" });
  const ids = eligible.map((w) => w.workerId);

  assert.ok(!ids.includes("worker-standard"));
  assert.ok(ids.includes("worker-hardened"));
  assert.ok(ids.includes("worker-strict")); // strict >= hardened
});

test("listEligibleWorkers includes idle and busy workers", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-idle", status: "idle" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-busy", status: "busy" }));

  const eligible = service.listEligibleWorkers();
  const ids = eligible.map((w) => w.workerId);

  assert.ok(ids.includes("worker-idle"));
  assert.ok(ids.includes("worker-busy"));
});

test("listEligibleWorkers excludes untrusted remote workers", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({
    workerId: "local-worker",
    placement: "local",
    status: "idle",
  }));
  service.recordHeartbeat(createHeartbeat({
    workerId: "remote-trusted",
    placement: "remote",
    status: "idle",
    registrationVerifiedAt: "2026-04-01T00:00:00.000Z",
  }));
  service.recordHeartbeat(createHeartbeat({
    workerId: "remote-untrusted",
    placement: "remote",
    status: "idle",
  }));

  const eligible = service.listEligibleWorkers();
  const ids = eligible.map((w) => w.workerId);

  assert.ok(ids.includes("local-worker"));
  assert.ok(ids.includes("remote-trusted"));
  assert.ok(!ids.includes("remote-untrusted"));
});

// ---------------------------------------------------------------------------
// listStaleWorkers tests
// ---------------------------------------------------------------------------

test("listStaleWorkers returns workers older than cutoff", () => {
  const workers = new Map<string, WorkerSnapshotRecord>();
  const store = createMockStore(workers);
  const service = new WorkerRegistryService(store);

  const now = "2026-04-27T12:00:00.000Z";
  const staleTime = "2026-04-27T11:00:00.000Z"; // 1 hour ago
  const freshTime = "2026-04-27T12:00:00.000Z"; // now

  // Create worker records with specific heartbeat times
  workers.set("worker-stale", {
    workerId: "worker-stale",
    status: "idle",
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
    lastHeartbeatAt: staleTime,
    updatedAt: staleTime,
  } as WorkerSnapshotRecord);

  workers.set("worker-fresh", {
    workerId: "worker-fresh",
    status: "idle",
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
    lastHeartbeatAt: freshTime,
    updatedAt: freshTime,
  } as WorkerSnapshotRecord);

  const staleWorkers = service.listStaleWorkers(now, 30 * 60 * 1000); // 30 min TTL
  const ids = staleWorkers.map((w) => w.workerId);

  assert.ok(ids.includes("worker-stale"));
  assert.ok(!ids.includes("worker-fresh"));
});

// ---------------------------------------------------------------------------
// verifyRemoteWorkerRegistration tests
// ---------------------------------------------------------------------------

test("verifyRemoteWorkerRegistration creates remote worker with trusted status", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.verifyRemoteWorkerRegistration({
    workerId: "remote-worker-1",
    capabilities: ["bash", "edit"],
    maxConcurrency: 4,
    registrationVerifiedAt: "2026-04-01T00:00:00.000Z",
    registrationChallengeId: "challenge-123",
  });

  assert.equal(view.workerId, "remote-worker-1");
  assert.equal(view.placement, "remote");
  assert.equal(view.trusted, true);
  assert.deepEqual(view.capabilities, ["bash", "edit"]);
  assert.equal(view.maxConcurrency, 4);
});

test("verifyRemoteWorkerRegistration updates existing worker", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    status: "idle",
    capabilities: ["bash"],
    maxConcurrency: 2,
  }));

  const view = service.verifyRemoteWorkerRegistration({
    workerId: "worker-1",
    capabilities: ["bash", "edit"],
    maxConcurrency: 4,
    registrationVerifiedAt: "2026-04-01T00:00:00.000Z",
    registrationChallengeId: "challenge-123",
  });

  assert.equal(view.maxConcurrency, 4);
  assert.deepEqual(view.capabilities, ["bash", "edit"]);
});

test("verifyRemoteWorkerRegistration sets registrationVerifiedAt to occurredAt if not provided", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const before = new Date().toISOString();
  const view = service.verifyRemoteWorkerRegistration({
    workerId: "remote-worker-1",
    capabilities: ["bash"],
    maxConcurrency: 4,
    registrationChallengeId: "challenge-123",
  });
  const after = new Date().toISOString();

  assert.ok(view.registrationVerifiedAt != null);
  assert.ok(view.registrationVerifiedAt >= before);
  assert.ok(view.registrationVerifiedAt <= after);
});

test("verifyRemoteWorkerRegistration preserves existing remote session status", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    placement: "remote",
    remoteSessionStatus: "connected",
    registrationVerifiedAt: "2026-04-01T00:00:00.000Z",
  }));

  const view = service.verifyRemoteWorkerRegistration({
    workerId: "worker-1",
    capabilities: ["bash"],
    maxConcurrency: 4,
    registrationChallengeId: "challenge-123",
  });

  assert.equal(view.remoteSessionStatus, "connected");
});

// ---------------------------------------------------------------------------
// Edge cases and integration scenarios
// ---------------------------------------------------------------------------

test("multiple heartbeats with same workerId updates existing record", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    status: "idle",
    capabilities: ["bash"],
    maxConcurrency: 4,
  }));

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    status: "busy",
    runningExecutionIds: ["exec-1"],
  }));

  const worker = service.getWorker("worker-1")!;
  assert.equal(worker.status, "busy");
  assert.equal(worker.runningExecutionIds.length, 1);
  assert.equal(worker.availableSlots, 3);
});

test("worker with zero maxConcurrency has zero capacity", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    maxConcurrency: 0,
    runningExecutionIds: [],
  }));

  assert.equal(view.availableSlots, 0);
});

test("worker isolation level defaults to standard", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    isolationLevel: undefined,
  }));

  assert.equal(view.isolationLevel, "standard");
});

test("strict isolation satisfies hardened requirement", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-strict",
    isolationLevel: "strict",
  }));

  const eligible = service.listEligibleWorkers({ requiredIsolationLevel: "hardened" });
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]!.workerId, "worker-strict");
});

test("empty capabilities array is valid", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    capabilities: [],
  }));

  assert.deepEqual(view.capabilities, []);
});

test("worker scheduling status maps correctly", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "w-idle", status: "idle" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "w-busy", status: "busy" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "w-degraded", status: "degraded" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "w-draining", status: "draining" }));

  assert.equal(service.getWorker("w-idle")!.schedulingStatus, "healthy");
  assert.equal(service.getWorker("w-busy")!.schedulingStatus, "healthy");
  assert.equal(service.getWorker("w-degraded")!.schedulingStatus, "degraded");
  assert.equal(service.getWorker("w-draining")!.schedulingStatus, "draining");
});

test("heartbeat with occurredAt uses provided timestamp", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const customTime = "2026-01-01T00:00:00.000Z";
  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    occurredAt: customTime,
  }));

  assert.equal(view.lastHeartbeatAt, customTime);
});

test("activeLeaseCount defaults to 0", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    activeLeaseCount: undefined,
  }));

  assert.equal(view.activeLeaseCount, 0);
});

test("toolBacklogCount defaults to 0", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    toolBacklogCount: undefined,
  }));

  assert.equal(view.toolBacklogCount, 0);
});

test("runtimeInstanceId preserved on heartbeat without restart", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    runtimeInstanceId: "instance-1",
  }));

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    status: "busy",
    runtimeInstanceId: "instance-1", // Same instance
  }));

  const worker = service.getWorker("worker-1")!;
  assert.equal(worker.restartGeneration, 0);
  assert.equal(worker.runtimeInstanceId, "instance-1");
});

test("worker placement defaults to local", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    placement: undefined,
  }));

  assert.equal(view.placement, "local");
});

test("requiredCapabilities returns empty array when not specified", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", capabilities: ["bash"] }));

  const eligible = service.listEligibleWorkers();
  assert.equal(eligible.length, 1);
});

test("queueAffinity filter with null matches workers with no affinity", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-no-affinity", queueAffinity: null }));

  const eligible = service.listEligibleWorkers({ queueAffinity: null });
  assert.equal(eligible.length, 1);
});

test("saturation null is handled correctly in computation", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    saturation: null,
  }));

  assert.equal(view.saturation, null);
});

test("meanStartupLatencyMs null is preserved", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    meanStartupLatencyMs: null,
  }));

  assert.equal(view.meanStartupLatencyMs, null);
});

test("sandboxSuccessRate normalized correctly", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    sandboxSuccessRate: 0.95,
  }));

  assert.equal(view.sandboxSuccessRate, 0.95);
});

test("repoCacheHitRate null for local placement", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    placement: "local",
    repoCacheHitRate: 0.8,
  }));

  assert.equal(view.repoCacheHitRate, null);
});

test("repoCacheHitRate preserved for remote placement", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const view = service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    placement: "remote",
    registrationVerifiedAt: "2026-04-01T00:00:00.000Z",
    repoCacheHitRate: 0.8,
  }));

  assert.equal(view.repoCacheHitRate, 0.8);
});
