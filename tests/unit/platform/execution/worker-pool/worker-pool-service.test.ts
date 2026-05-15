import assert from "node:assert/strict";
import test from "node:test";

import { WorkerRegistryService, type WorkerRegistryHeartbeatInput } from "../../../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import {
  computeWorkerLoadScore,
  summarizeWorkerLoadSkew,
  type WorkerLoadSignal,
} from "../../../../../src/platform/five-plane-execution/worker-pool/worker-load-balancing.js";
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

// ---------------------------------------------------------------------------
// Task Assignment tests
// ---------------------------------------------------------------------------

test("WorkerPool selects worker with highest availableSlots when load is equal", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-a", maxConcurrency: 4, runningExecutionIds: ["exec-1"] }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-b", maxConcurrency: 4, runningExecutionIds: [] }));

  const eligible = service.listEligibleWorkers();
  assert.equal(eligible.length, 2);
  // worker-b has more available slots (4 vs 3)
  const selected = eligible.sort((a, b) => b.availableSlots - a.availableSlots)[0]!;
  assert.equal(selected.workerId, "worker-b");
});

test("WorkerPool assigns task to worker with matching queue affinity", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-a", queueAffinity: "queue-x" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-b", queueAffinity: "queue-y" }));
  // Workers with no queue affinity (null) also match any queue filter
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-c", queueAffinity: null }));

  const eligible = service.listEligibleWorkers({ queueAffinity: "queue-x" });
  // worker-a matches exactly, worker-c has no affinity so it matches any filter
  assert.equal(eligible.length, 2);
  const ids = eligible.map((w) => w.workerId);
  assert.ok(ids.includes("worker-a"));
  assert.ok(ids.includes("worker-c"));
});

test("WorkerPool excludes workers at max capacity from task assignment", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-full",
    maxConcurrency: 2,
    runningExecutionIds: ["exec-1", "exec-2"],
  }));
  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-available",
    maxConcurrency: 2,
    runningExecutionIds: [],
  }));

  const eligible = service.listEligibleWorkers();
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]!.workerId, "worker-available");
});

test("WorkerPool assigns task based on required capabilities", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-1", capabilities: ["bash"] }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-2", capabilities: ["bash", "edit", "read"] }));

  const eligible = service.listEligibleWorkers({ requiredCapabilities: ["bash", "edit"] });
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]!.workerId, "worker-2");
});

test("WorkerPool assigns to hardened isolation worker when required", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-std", isolationLevel: "standard" }));
  service.recordHeartbeat(createHeartbeat({ workerId: "worker-hrd", isolationLevel: "hardened" }));

  const eligible = service.listEligibleWorkers({ requiredIsolationLevel: "hardened" });
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]!.workerId, "worker-hrd");
});

test("WorkerPool strict isolation satisfies hardened requirement", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({ workerId: "worker-strict", isolationLevel: "strict" }));

  // strict (2) >= hardened (1), so strict satisfies hardened requirement
  const eligible = service.listEligibleWorkers({ requiredIsolationLevel: "hardened" });
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]!.workerId, "worker-strict");
});

test("WorkerPool excludes unavailable, offline, quarantined, draining workers", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  const statuses = ["idle", "busy", "draining", "degraded", "unavailable", "quarantined", "offline"] as const;
  for (const status of statuses) {
    service.recordHeartbeat(createHeartbeat({ workerId: `worker-${status}`, status }));
  }

  const eligible = service.listEligibleWorkers();
  // Only idle and busy (which map to healthy) should be eligible
  // Degraded is excluded by default unless includeDegraded is true
  const eligibleIds = eligible.map((w) => w.workerId);
  assert.ok(eligibleIds.includes("worker-idle"), "idle should be eligible");
  assert.ok(eligibleIds.includes("worker-busy"), "busy should be eligible");
  assert.ok(!eligibleIds.includes("worker-degraded"), "degraded should NOT be eligible by default");
  assert.ok(!eligibleIds.includes("worker-draining"), "draining should not be eligible");
  assert.ok(!eligibleIds.includes("worker-unavailable"), "unavailable should not be eligible");
  assert.ok(!eligibleIds.includes("worker-quarantined"), "quarantined should not be eligible");
  assert.ok(!eligibleIds.includes("worker-offline"), "offline should not be eligible");
});

// ---------------------------------------------------------------------------
// Worker Capacity tests
// ---------------------------------------------------------------------------

test("WorkerPool availableSlots is maxConcurrency minus running executions", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    maxConcurrency: 8,
    runningExecutionIds: ["e1", "e2", "e3"],
  }));

  const worker = service.getWorker("worker-1");
  assert.equal(worker!.availableSlots, 5);
});

test("WorkerPool availableSlots cannot go negative", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    maxConcurrency: 2,
    runningExecutionIds: ["e1", "e2", "e3", "e4", "e5"],
  }));

  const worker = service.getWorker("worker-1");
  assert.equal(worker!.availableSlots, 0);
});

test("WorkerPool capacity reflects updated running execution count", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    maxConcurrency: 4,
    runningExecutionIds: ["e1"],
  }));

  assert.equal(service.getWorker("worker-1")!.availableSlots, 3);

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    maxConcurrency: 4,
    runningExecutionIds: ["e1", "e2", "e3"],
  }));

  assert.equal(service.getWorker("worker-1")!.availableSlots, 1);
});

test("WorkerPool zero maxConcurrency means zero capacity", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    maxConcurrency: 0,
    runningExecutionIds: [],
  }));

  const worker = service.getWorker("worker-1");
  assert.equal(worker!.availableSlots, 0);
});

test("WorkerPool worker with no running executions has full capacity", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-1",
    maxConcurrency: 10,
    runningExecutionIds: [],
  }));

  const worker = service.getWorker("worker-1");
  assert.equal(worker!.availableSlots, 10);
});

// ---------------------------------------------------------------------------
// Load Balancing tests
// ---------------------------------------------------------------------------

test("WorkerPool load score is higher for worker with more active leases", () => {
  const signal1: WorkerLoadSignal = {
    workerId: "worker-1",
    queueAffinity: null,
    maxConcurrency: 4,
    availableSlots: 2,
    activeLeaseCount: 3,
    runningExecutionCount: 3,
    saturation: null,
    toolBacklogCount: 0,
    cpuPct: null,
  };

  const signal2: WorkerLoadSignal = {
    workerId: "worker-2",
    queueAffinity: null,
    maxConcurrency: 4,
    availableSlots: 2,
    activeLeaseCount: 1,
    runningExecutionCount: 1,
    saturation: null,
    toolBacklogCount: 0,
    cpuPct: null,
  };

  const score1 = computeWorkerLoadScore(signal1);
  const score2 = computeWorkerLoadScore(signal2);
  assert.ok(score1 > score2, "Worker with more active leases should have higher load score");
});

test("WorkerPool load score increases with saturation", () => {
  const noSaturation: WorkerLoadSignal = {
    workerId: "worker-1",
    queueAffinity: null,
    maxConcurrency: 4,
    availableSlots: 2,
    activeLeaseCount: 1,
    runningExecutionCount: 1,
    saturation: null,
    toolBacklogCount: 0,
    cpuPct: null,
  };

  const highSaturation: WorkerLoadSignal = {
    workerId: "worker-2",
    queueAffinity: null,
    maxConcurrency: 4,
    availableSlots: 2,
    activeLeaseCount: 1,
    runningExecutionCount: 1,
    saturation: 0.9,
    toolBacklogCount: 0,
    cpuPct: null,
  };

  const scoreLow = computeWorkerLoadScore(noSaturation);
  const scoreHigh = computeWorkerLoadScore(highSaturation);
  assert.ok(scoreHigh > scoreLow, "Worker with higher saturation should have higher load score");
});

test("WorkerPool load score accounts for tool backlog", () => {
  const noBacklog: WorkerLoadSignal = {
    workerId: "worker-1",
    queueAffinity: null,
    maxConcurrency: 4,
    availableSlots: 2,
    activeLeaseCount: 2,
    runningExecutionCount: 2,
    saturation: null,
    toolBacklogCount: 0,
    cpuPct: null,
  };

  const highBacklog: WorkerLoadSignal = {
    workerId: "worker-2",
    queueAffinity: null,
    maxConcurrency: 4,
    availableSlots: 2,
    activeLeaseCount: 2,
    runningExecutionCount: 2,
    saturation: null,
    toolBacklogCount: 10,
    cpuPct: null,
  };

  const scoreNoBacklog = computeWorkerLoadScore(noBacklog);
  const scoreHighBacklog = computeWorkerLoadScore(highBacklog);
  assert.ok(scoreHighBacklog > scoreNoBacklog, "Worker with backlog should have higher load score");
});

test("WorkerPool load score accounts for CPU usage", () => {
  const noCpu: WorkerLoadSignal = {
    workerId: "worker-1",
    queueAffinity: null,
    maxConcurrency: 4,
    availableSlots: 2,
    activeLeaseCount: 2,
    runningExecutionCount: 2,
    saturation: null,
    toolBacklogCount: 0,
    cpuPct: null,
  };

  const highCpu: WorkerLoadSignal = {
    workerId: "worker-2",
    queueAffinity: null,
    maxConcurrency: 4,
    availableSlots: 2,
    activeLeaseCount: 2,
    runningExecutionCount: 2,
    saturation: null,
    toolBacklogCount: 0,
    cpuPct: 90,
  };

  const scoreNoCpu = computeWorkerLoadScore(noCpu);
  const scoreHighCpu = computeWorkerLoadScore(highCpu);
  assert.ok(scoreHighCpu > scoreNoCpu, "Worker with high CPU should have higher load score");
});

test("WorkerPool load skew not detected when load is balanced", () => {
  const signals: WorkerLoadSignal[] = [
    {
      workerId: "worker-1",
      queueAffinity: null,
      maxConcurrency: 4,
      availableSlots: 2,
      activeLeaseCount: 2,
      runningExecutionCount: 2,
      saturation: null,
      toolBacklogCount: 0,
      cpuPct: null,
    },
    {
      workerId: "worker-2",
      queueAffinity: null,
      maxConcurrency: 4,
      availableSlots: 2,
      activeLeaseCount: 2,
      runningExecutionCount: 2,
      saturation: null,
      toolBacklogCount: 0,
      cpuPct: null,
    },
  ];

  const summary = summarizeWorkerLoadSkew(signals);
  assert.equal(summary.detected, false);
  assert.equal(summary.dominantWorkerId, null);
});

test("WorkerPool load skew detected when one worker has disproportionate load", () => {
  const signals: WorkerLoadSignal[] = [
    {
      workerId: "worker-1",
      queueAffinity: null,
      maxConcurrency: 4,
      availableSlots: 0,
      activeLeaseCount: 4,
      runningExecutionCount: 4,
      saturation: null,
      toolBacklogCount: 0,
      cpuPct: null,
    },
    {
      workerId: "worker-2",
      queueAffinity: null,
      maxConcurrency: 4,
      availableSlots: 4,
      activeLeaseCount: 0,
      runningExecutionCount: 0,
      saturation: null,
      toolBacklogCount: 0,
      cpuPct: null,
    },
  ];

  const summary = summarizeWorkerLoadSkew(signals);
  assert.equal(summary.detected, true);
  assert.equal(summary.dominantWorkerId, "worker-1");
  assert.ok(summary.dominantWorkerShare != null);
  assert.ok(summary.dominantWorkerShare! > 0.6);
});

test("WorkerPool load skew not detected when alternative worker also has load", () => {
  const signals: WorkerLoadSignal[] = [
    {
      workerId: "worker-1",
      queueAffinity: null,
      maxConcurrency: 4,
      availableSlots: 0,
      activeLeaseCount: 4,
      runningExecutionCount: 4,
      saturation: null,
      toolBacklogCount: 0,
      cpuPct: null,
    },
    {
      workerId: "worker-2",
      queueAffinity: null,
      maxConcurrency: 4,
      availableSlots: 1,
      activeLeaseCount: 3,
      runningExecutionCount: 3,
      saturation: null,
      toolBacklogCount: 0,
      cpuPct: null,
    },
  ];

  const summary = summarizeWorkerLoadSkew(signals);
  // Even though worker-1 has more leases, worker-2 also has significant load
  // So the load isn't disproportionately skewed to one worker with alternative capacity
  assert.equal(summary.detected, false);
});

test("WorkerPool empty worker list returns no skew", () => {
  const summary = summarizeWorkerLoadSkew([]);
  assert.equal(summary.detected, false);
  assert.equal(summary.totalActiveLeaseCount, 0);
});

test("WorkerPool single worker with high load does not trigger skew detection", () => {
  const signals: WorkerLoadSignal[] = [
    {
      workerId: "worker-1",
      queueAffinity: null,
      maxConcurrency: 4,
      availableSlots: 0,
      activeLeaseCount: 4,
      runningExecutionCount: 4,
      saturation: null,
      toolBacklogCount: 0,
      cpuPct: null,
    },
  ];

  const summary = summarizeWorkerLoadSkew(signals);
  assert.equal(summary.detected, false);
});

// ---------------------------------------------------------------------------
// Combined Selection and Load Balancing
// ---------------------------------------------------------------------------

test("WorkerPool listEligibleWorkers returns eligible workers (order not guaranteed)", () => {
  const store = createMockStore();
  const service = new WorkerRegistryService(store);

  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-low",
    maxConcurrency: 2,
    runningExecutionIds: ["e1"],
  }));
  service.recordHeartbeat(createHeartbeat({
    workerId: "worker-high",
    maxConcurrency: 8,
    runningExecutionIds: [],
  }));

  const eligible = service.listEligibleWorkers();
  assert.equal(eligible.length, 2);
  // Both workers should be eligible; order is not guaranteed
  const ids = eligible.map((w) => w.workerId);
  assert.ok(ids.includes("worker-low"));
  assert.ok(ids.includes("worker-high"));
  // Verify worker-high has more available slots
  const highWorker = eligible.find((w) => w.workerId === "worker-high");
  assert.equal(highWorker!.availableSlots, 8);
});

test("WorkerPool untrusted remote workers excluded from eligible list", () => {
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
  assert.equal(eligible.length, 2);
  const ids = eligible.map((w) => w.workerId);
  assert.ok(ids.includes("local-worker"));
  assert.ok(ids.includes("remote-trusted"));
  assert.ok(!ids.includes("remote-untrusted"));
});
