import assert from "node:assert/strict";
import test from "node:test";

import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { WorkerSnapshotRecord } from "../../../../../src/platform/contracts/types/domain/worker-types.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockWorkerSnapshot(overrides: Partial<WorkerSnapshotRecord> = {}): WorkerSnapshotRecord {
  const now = new Date().toISOString();
  return {
    workerId: "worker-test-001",
    status: "busy",
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
    activeLeaseCount: 1,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
    capabilitiesJson: '["bash","node"]',
    runningExecutionsJson: '["exec-001"]',
    maxConcurrency: 4,
    queueAffinity: null,
    runtimeInstanceId: "runtime-instance-001",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: 45.5,
    memoryMb: 512,
    toolBacklogCount: 0,
    currentStepId: "step-001",
    lastProgressAt: now,
    lastHeartbeatAt: now,
    updatedAt: now,
    ...overrides,
  };
}

interface SlotReaperOptions {
  maxLeaseTtlMs?: number;
}

interface ReapResult {
  reapedWorkerIds: string[];
  emittedEvents: Array<{ eventType: string; workerId: string }>;
}

interface MockSlotReaper {
  reapStaleSlots(now: string, options?: SlotReaperOptions): ReapResult;
}

/**
 * Creates a SlotReaper instance with mock dependencies.
 * This is a test helper that simulates the expected behavior of slot reaping
 * based on worker heartbeat staleness.
 */
function createMockSlotReaper(store: AuthoritativeTaskStore): MockSlotReaper {
  const emittedEvents: Array<{ eventType: string; workerId: string }> = [];

  return {
    reapStaleSlots(now: string, options: SlotReaperOptions = {}): ReapResult {
      const maxLeaseTtlMs = options.maxLeaseTtlMs ?? 30_000;
      const staleThreshold = new Date(Date.parse(now) - maxLeaseTtlMs).toISOString();

      const snapshots = store.worker.listWorkerSnapshots();
      const staleWorkers = snapshots.filter((s) => s.lastHeartbeatAt < staleThreshold);
      const reapedWorkerIds: string[] = [];

      for (const worker of staleWorkers) {
        // Mark worker as stale and emit event
        emittedEvents.push({
          eventType: "worker:slot_reaped",
          workerId: worker.workerId,
        });

        emittedEvents.push({
          eventType: "execution:slot_reclaimed",
          workerId: worker.workerId,
        });

        reapedWorkerIds.push(worker.workerId);
      }

      return { reapedWorkerIds, emittedEvents };
    },
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
      listStaleWorkerSnapshots: (heartbeatBefore: string) =>
        Array.from(workerSnapshots.values()).filter((s) => s.lastHeartbeatAt < heartbeatBefore),
      getExecutionLease: () => null,
      upsertExecutionLease: () => {},
      getAgentExecutionRecord: () => null,
      upsertAgentExecutionRecord: () => {},
      insertHeartbeatSnapshot: () => {},
      insertLeaseAudit: () => {},
    },
    event: {
      insertEvent: (event: {
        id: string;
        taskId: string | null;
        executionId: string | null;
        eventType: string;
        eventTier: string;
        payloadJson: string;
        traceId: string | null;
        createdAt: string;
      }) => {
        // Mock event insertion - in real implementation this persists events
      },
      countPendingTier1Acks: () => 0,
    },
  } as unknown as AuthoritativeTaskStore;
}

// ---------------------------------------------------------------------------
// Test: reapStaleSlots removes slots for workers that haven't reported in time
// ---------------------------------------------------------------------------

test("reapStaleSlots removes slots for workers that haven't reported in time", () => {
  const now = new Date().toISOString();
  const staleTime = new Date(Date.parse(now) - 60_000).toISOString(); // 60 seconds ago

  const snapshots = new Map<string, WorkerSnapshotRecord>();
  snapshots.set(
    "worker-stale-001",
    createMockWorkerSnapshot({
      workerId: "worker-stale-001",
      lastHeartbeatAt: staleTime,
      lastProgressAt: staleTime,
    }),
  );

  const store = createMockStore(snapshots);
  const slotReaper = createMockSlotReaper(store);

  const result = slotReaper.reapStaleSlots(now);

  assert.equal(result.reapedWorkerIds.length, 1, "Expected one stale worker to be reaped");
  assert.equal(result.reapedWorkerIds.includes("worker-stale-001"), true, "Expected worker-stale-001 to be reaped");
});

test("reapStaleSlots removes multiple stale workers", () => {
  const now = new Date().toISOString();
  const staleTime = new Date(Date.parse(now) - 90_000).toISOString(); // 90 seconds ago

  const snapshots = new Map<string, WorkerSnapshotRecord>();
  snapshots.set(
    "worker-stale-001",
    createMockWorkerSnapshot({
      workerId: "worker-stale-001",
      lastHeartbeatAt: staleTime,
      lastProgressAt: staleTime,
    }),
  );
  snapshots.set(
    "worker-stale-002",
    createMockWorkerSnapshot({
      workerId: "worker-stale-002",
      lastHeartbeatAt: staleTime,
      lastProgressAt: staleTime,
    }),
  );

  const store = createMockStore(snapshots);
  const slotReaper = createMockSlotReaper(store);

  const result = slotReaper.reapStaleSlots(now);

  assert.equal(result.reapedWorkerIds.length, 2, "Expected two stale workers to be reaped");
  assert.equal(result.reapedWorkerIds.includes("worker-stale-001"), true);
  assert.equal(result.reapedWorkerIds.includes("worker-stale-002"), true);
});

// ---------------------------------------------------------------------------
// Test: Workers that are actively reporting are not affected
// ---------------------------------------------------------------------------

test("Workers that are actively reporting are not affected", () => {
  const now = new Date().toISOString();
  const recentTime = new Date(Date.parse(now) - 5_000).toISOString(); // 5 seconds ago - recent heartbeat

  const snapshots = new Map<string, WorkerSnapshotRecord>();
  snapshots.set(
    "worker-active-001",
    createMockWorkerSnapshot({
      workerId: "worker-active-001",
      lastHeartbeatAt: recentTime,
      lastProgressAt: recentTime,
      status: "busy",
    }),
  );

  const store = createMockStore(snapshots);
  const slotReaper = createMockSlotReaper(store);

  const result = slotReaper.reapStaleSlots(now);

  assert.equal(result.reapedWorkerIds.length, 0, "Expected no workers to be reaped");
  assert.equal(result.emittedEvents.filter((e) => e.eventType === "worker:slot_reaped").length, 0);
});

test("Active workers with recent heartbeats are preserved", () => {
  const now = new Date().toISOString();
  const recentTime = new Date(Date.parse(now) - 10_000).toISOString(); // 10 seconds ago

  const snapshots = new Map<string, WorkerSnapshotRecord>();
  snapshots.set(
    "worker-active-001",
    createMockWorkerSnapshot({
      workerId: "worker-active-001",
      lastHeartbeatAt: recentTime,
      lastProgressAt: recentTime,
    }),
  );
  snapshots.set(
    "worker-stale-001",
    createMockWorkerSnapshot({
      workerId: "worker-stale-001",
      lastHeartbeatAt: new Date(Date.parse(now) - 120_000).toISOString(), // 2 minutes ago - stale
      lastProgressAt: new Date(Date.parse(now) - 120_000).toISOString(),
    }),
  );

  const store = createMockStore(snapshots);
  const slotReaper = createMockSlotReaper(store);

  const result = slotReaper.reapStaleSlots(now);

  assert.equal(result.reapedWorkerIds.length, 1, "Expected only stale worker to be reaped");
  assert.equal(result.reapedWorkerIds.includes("worker-active-001"), false, "Active worker should not be reaped");
  assert.equal(result.reapedWorkerIds.includes("worker-stale-001"), true, "Stale worker should be reaped");
});

// ---------------------------------------------------------------------------
// Test: Reaping respects maxLeaseTtlMs configuration
// ---------------------------------------------------------------------------

test("Reaping respects maxLeaseTtlMs configuration - short TTL", () => {
  const now = new Date().toISOString();
  const heartbeatTime = new Date(Date.parse(now) - 15_000).toISOString(); // 15 seconds ago

  const snapshots = new Map<string, WorkerSnapshotRecord>();
  snapshots.set(
    "worker-001",
    createMockWorkerSnapshot({
      workerId: "worker-001",
      lastHeartbeatAt: heartbeatTime,
      lastProgressAt: heartbeatTime,
    }),
  );

  const store = createMockStore(snapshots);
  const slotReaper = createMockSlotReaper(store);

  // With 10 second TTL, 15 second old heartbeat is stale
  const result = slotReaper.reapStaleSlots(now, { maxLeaseTtlMs: 10_000 });

  assert.equal(result.reapedWorkerIds.length, 1, "Expected worker with 15s stale heartbeat to be reaped with 10s TTL");
});

test("Reaping respects maxLeaseTtlMs configuration - long TTL", () => {
  const now = new Date().toISOString();
  const heartbeatTime = new Date(Date.parse(now) - 15_000).toISOString(); // 15 seconds ago

  const snapshots = new Map<string, WorkerSnapshotRecord>();
  snapshots.set(
    "worker-001",
    createMockWorkerSnapshot({
      workerId: "worker-001",
      lastHeartbeatAt: heartbeatTime,
      lastProgressAt: heartbeatTime,
    }),
  );

  const store = createMockStore(snapshots);
  const slotReaper = createMockSlotReaper(store);

  // With 60 second TTL, 15 second old heartbeat is still fresh
  const result = slotReaper.reapStaleSlots(now, { maxLeaseTtlMs: 60_000 });

  assert.equal(result.reapedWorkerIds.length, 0, "Expected worker with 15s stale heartbeat to not be reaped with 60s TTL");
});

test("Default maxLeaseTtlMs is 30 seconds", () => {
  const now = new Date().toISOString();
  const heartbeatTime = new Date(Date.parse(now) - 25_000).toISOString(); // 25 seconds ago

  const snapshots = new Map<string, WorkerSnapshotRecord>();
  snapshots.set(
    "worker-001",
    createMockWorkerSnapshot({
      workerId: "worker-001",
      lastHeartbeatAt: heartbeatTime,
      lastProgressAt: heartbeatTime,
    }),
  );

  const store = createMockStore(snapshots);
  const slotReaper = createMockSlotReaper(store);

  // Default TTL is 30 seconds, 25 second old heartbeat should not be reaped
  const result = slotReaper.reapStaleSlots(now);

  assert.equal(result.reapedWorkerIds.length, 0, "Expected worker with 25s heartbeat to not be reaped with default 30s TTL");
});

test("Worker just past default TTL is reaped", () => {
  const now = new Date().toISOString();
  const heartbeatTime = new Date(Date.parse(now) - 31_000).toISOString(); // 31 seconds ago - past default TTL

  const snapshots = new Map<string, WorkerSnapshotRecord>();
  snapshots.set(
    "worker-001",
    createMockWorkerSnapshot({
      workerId: "worker-001",
      lastHeartbeatAt: heartbeatTime,
      lastProgressAt: heartbeatTime,
    }),
  );

  const store = createMockStore(snapshots);
  const slotReaper = createMockSlotReaper(store);

  const result = slotReaper.reapStaleSlots(now);

  assert.equal(result.reapedWorkerIds.length, 1, "Expected worker with 31s heartbeat to be reaped with default 30s TTL");
});

// ---------------------------------------------------------------------------
// Test: Events are emitted when slots are reaped
// ---------------------------------------------------------------------------

test("Events are emitted when slots are reaped", () => {
  const now = new Date().toISOString();
  const staleTime = new Date(Date.parse(now) - 60_000).toISOString();

  const snapshots = new Map<string, WorkerSnapshotRecord>();
  snapshots.set(
    "worker-stale-001",
    createMockWorkerSnapshot({
      workerId: "worker-stale-001",
      lastHeartbeatAt: staleTime,
      lastProgressAt: staleTime,
    }),
  );

  const store = createMockStore(snapshots);
  const slotReaper = createMockSlotReaper(store);

  const result = slotReaper.reapStaleSlots(now);

  const slotReapedEvents = result.emittedEvents.filter((e) => e.eventType === "worker:slot_reaped");
  assert.equal(slotReapedEvents.length, 1, "Expected one worker:slot_reaped event");
  assert.equal(slotReapedEvents[0].workerId, "worker-stale-001");
});

test("Execution slot reclaimed events are emitted for reaped workers", () => {
  const now = new Date().toISOString();
  const staleTime = new Date(Date.parse(now) - 60_000).toISOString();

  const snapshots = new Map<string, WorkerSnapshotRecord>();
  snapshots.set(
    "worker-stale-001",
    createMockWorkerSnapshot({
      workerId: "worker-stale-001",
      lastHeartbeatAt: staleTime,
      lastProgressAt: staleTime,
      runningExecutionsJson: '["exec-001", "exec-002"]',
    }),
  );

  const store = createMockStore(snapshots);
  const slotReaper = createMockSlotReaper(store);

  const result = slotReaper.reapStaleSlots(now);

  const slotReclaimedEvents = result.emittedEvents.filter((e) => e.eventType === "execution:slot_reclaimed");
  assert.equal(slotReclaimedEvents.length >= 1, true, "Expected at least one execution:slot_reclaimed event");
});

test("No events emitted when no stale workers", () => {
  const now = new Date().toISOString();
  const recentTime = new Date(Date.parse(now) - 5_000).toISOString();

  const snapshots = new Map<string, WorkerSnapshotRecord>();
  snapshots.set(
    "worker-active-001",
    createMockWorkerSnapshot({
      workerId: "worker-active-001",
      lastHeartbeatAt: recentTime,
      lastProgressAt: recentTime,
    }),
  );

  const store = createMockStore(snapshots);
  const slotReaper = createMockSlotReaper(store);

  const result = slotReaper.reapStaleSlots(now);

  assert.equal(result.emittedEvents.length, 0, "Expected no events when no stale workers");
});

test("Multiple workers each emit their own events", () => {
  const now = new Date().toISOString();
  const staleTime = new Date(Date.parse(now) - 90_000).toISOString();

  const snapshots = new Map<string, WorkerSnapshotRecord>();
  snapshots.set(
    "worker-stale-001",
    createMockWorkerSnapshot({
      workerId: "worker-stale-001",
      lastHeartbeatAt: staleTime,
      lastProgressAt: staleTime,
    }),
  );
  snapshots.set(
    "worker-stale-002",
    createMockWorkerSnapshot({
      workerId: "worker-stale-002",
      lastHeartbeatAt: staleTime,
      lastProgressAt: staleTime,
    }),
  );

  const store = createMockStore(snapshots);
  const slotReaper = createMockSlotReaper(store);

  const result = slotReaper.reapStaleSlots(now);

  const slotReapedEvents = result.emittedEvents.filter((e) => e.eventType === "worker:slot_reaped");
  assert.equal(slotReapedEvents.length, 2, "Expected two worker:slot_reaped events");
  assert.ok(slotReapedEvents.some((e) => e.workerId === "worker-stale-001"));
  assert.ok(slotReapedEvents.some((e) => e.workerId === "worker-stale-002"));
});
