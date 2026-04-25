/**
 * E2E Scaling Flow Tests
 *
 * End-to-end tests for scaling under load scenarios covering:
 * - Resource pool allocation under high concurrency
 * - Fair scheduling under load with multiple tenants
 * - Worker scaling and load balancing
 * - Queue throughput under load
 * - SLA tier preservation during scaling events
 * - Preemption decisions under resource pressure
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import {
  FairSchedulingService,
  type FairSchedulingRequest,
  type ResourceClaim,
  type SchedulingClass,
} from "../../src/scale-ecosystem/resource-manager/fair-scheduling-service.js";
import {
  ResourcePoolService,
  type ResourcePool,
} from "../../src/scale-ecosystem/resource-manager/resource-pool-service.js";
import { runConcurrentInvariant, type ConcurrentRunnerOptions } from "../helpers/concurrent-runner.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { TaskStatus, ExecutionStatus, WorkerStatus } from "../../src/platform/contracts/types/status.js";
import type { FairQueueItem } from "../../src/scale-ecosystem/resource-manager/fair-queue/index.js";
import type { PreemptionCandidate } from "../../src/scale-ecosystem/resource-manager/preemption/index.js";

// ---------------------------------------------------------------------------
// Test Harness
// ---------------------------------------------------------------------------

function createScalingHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = `${workspace}/scaling-flow.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  return { workspace, dbPath, db, store, cleanup: () => {
    db.close();
    cleanupPath(workspace);
  }};
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createSchedulingClass(overrides: Partial<SchedulingClass> = {}): SchedulingClass {
  return {
    tenantId: overrides.tenantId ?? "tenant-001",
    orgNodeId: overrides.orgNodeId ?? null,
    domainId: overrides.domainId ?? "general_ops",
    slaTierId: overrides.slaTierId ?? "standard",
    priority: overrides.priority ?? 50,
    ...overrides,
  };
}

function createResourceClaim(overrides: Partial<ResourceClaim> = {}): ResourceClaim {
  return {
    claimId: overrides.claimId ?? newId("claim"),
    schedulingClass: overrides.schedulingClass ?? createSchedulingClass(),
    requestedUnits: overrides.requestedUnits ?? 1,
    ...overrides,
  };
}

function createFairQueueItem(itemId: string, tenantId: string, ageMs: number, priority: number): FairQueueItem {
  return {
    itemId,
    tenantId,
    priority,
    ageMs,
  };
}

function seedTask(
  store: AuthoritativeTaskStore,
  db: SqliteDatabase,
  taskId: string,
  status: TaskStatus,
  tenantId: string = "tenant-001",
  createdAt: string = nowIso(),
): void {
  db.transaction(() => {
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      tenantId,
      title: `Task ${taskId}`,
      status,
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt,
      updatedAt: createdAt,
      completedAt: status === "done" || status === "failed" || status === "cancelled" ? createdAt : null,
    });
  });
}

function seedExecution(
  store: AuthoritativeTaskStore,
  db: SqliteDatabase,
  executionId: string,
  taskId: string,
  status: ExecutionStatus,
  attempt: number = 1,
): void {
  db.transaction(() => {
    store.insertExecution({
      id: executionId,
      taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent_1",
      roleId: "general_executor",
      runKind: "task_run",
      status,
      inputRef: null,
      traceId: `trace-${executionId}`,
      attempt,
      timeoutMs: 60000,
      budgetUsdLimit: 1,
      requiresApproval: 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries: 0,
      retryBackoff: "none",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: nowIso(),
      finishedAt: status === "succeeded" || status === "failed" || status === "superseded" ? nowIso() : null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  });
}

function seedWorker(
  store: AuthoritativeTaskStore,
  db: SqliteDatabase,
  workerId: string,
  status: WorkerStatus = "idle",
): void {
  db.transaction(() => {
    store.worker.upsertWorkerSnapshot({
      workerId,
      agentId: `agent-${workerId}`,
      poolId: "default",
      regionId: "us-east-1",
      status,
      currentTaskId: status === "busy" ? `task-${workerId}` : null,
      currentExecutionId: status === "busy" ? `exec-${workerId}` : null,
      lastHeartbeatAt: nowIso(),
      registeredAt: nowIso(),
      version: "1.0.0",
      slotCount: 4,
      usedSlotCount: status === "busy" ? 1 : 0,
    });
  });
}

// ---------------------------------------------------------------------------
// Tests: Resource Pool Service Under Load
// ---------------------------------------------------------------------------

test("E2E Scaling: resource pool allocates units up to capacity", (t) => {
  const service = new ResourcePoolService();

  service.registerPool({
    poolId: "compute",
    resourceType: "cpu",
    capacityUnits: 10,
    allocatedUnits: 0,
    burstUnits: 2,
  });

  // Allocate 8 units
  const result1 = service.allocate("compute", "consumer-1", 8);
  assert.equal(result1.granted, true, "Should be granted");
  assert.deepEqual(result1.reasonCodes, ["resource_pool.allocated"]);

  // Verify pool state
  const pool = service.getPool("compute");
  assert.equal(pool!.allocatedUnits, 8);

  // Allocate 2 more units (should reach capacity)
  const result2 = service.allocate("compute", "consumer-2", 2);
  assert.equal(result2.granted, true);
  assert.equal(pool!.allocatedUnits, 10);

  // Allocate 1 more unit (should fail - over capacity)
  const result3 = service.allocate("compute", "consumer-3", 1);
  assert.equal(result3.granted, false);
  assert.ok(result3.reasonCodes.includes("resource_pool.capacity_exceeded"));
});

test("E2E Scaling: resource pool uses burst capacity", (t) => {
  const service = new ResourcePoolService();

  service.registerPool({
    poolId: "burst-compute",
    resourceType: "cpu",
    capacityUnits: 5,
    allocatedUnits: 5,
    burstUnits: 3,
  });

  // Should still be able to allocate from burst
  const result = service.allocate("burst-compute", "burst-consumer", 2);
  assert.equal(result.granted, true);

  const pool = service.getPool("burst-compute");
  assert.equal(pool!.allocatedUnits, 7); // 5 regular + 2 burst
});

test("E2E Scaling: resource pool releases units correctly", (t) => {
  const service = new ResourcePoolService();

  service.registerPool({
    poolId: "release-pool",
    resourceType: "cpu",
    capacityUnits: 10,
    allocatedUnits: 6,
    burstUnits: 0,
  });

  const updated = service.release("release-pool", 3);

  assert.equal(updated.allocatedUnits, 3);

  // Can now allocate 3 more units
  const result = service.allocate("release-pool", "new-consumer", 3);
  assert.equal(result.granted, true);
});

test("E2E Scaling: resource pool prevents over-release", (t) => {
  const service = new ResourcePoolService();

  service.registerPool({
    poolId: "over-release-pool",
    resourceType: "cpu",
    capacityUnits: 10,
    allocatedUnits: 3,
    burstUnits: 0,
  });

  // Try to release more than allocated
  const updated = service.release("over-release-pool", 10);

  // Should clamp to 0, not go negative
  assert.equal(updated.allocatedUnits, 0);
});

test("E2E Scaling: concurrent allocations are handled correctly", async (t) => {
  const service = new ResourcePoolService();

  service.registerPool({
    poolId: "concurrent-pool",
    resourceType: "cpu",
    capacityUnits: 100,
    allocatedUnits: 0,
    burstUnits: 0,
  });

  const options: ConcurrentRunnerOptions = { concurrency: 20 };
  const result = await runConcurrentInvariant(async (workerId) => {
    return service.allocate("concurrent-pool", `consumer-${workerId}`, 5);
  }, options);

  assert.equal(result.success, true, "All allocations should succeed without errors");
  assert.equal(result.values.length, 20);

  // 20 workers * 5 units = 100 units should be allocated
  const pool = service.getPool("concurrent-pool");
  assert.equal(pool!.allocatedUnits, 100);
});

// ---------------------------------------------------------------------------
// Tests: Fair Scheduling Under Load
// ---------------------------------------------------------------------------

test("E2E Scaling: fair scheduling orders by priority and age", (t) => {
  const service = new FairSchedulingService();

  const queueItems: FairQueueItem[] = [
    createFairQueueItem("item-1", "tenant-001", 60_000, 30),  // Younger, lower priority
    createFairQueueItem("item-2", "tenant-001", 120_000, 50), // Older, medium priority
    createFairQueueItem("item-3", "tenant-001", 30_000, 80),  // Younger, higher priority
  ];

  const claim = createResourceClaim({ requestedUnits: 1 });

  const request: FairSchedulingRequest = {
    quotaPolicy: { scopeId: "tenant-001", hardLimit: 10, currentUsage: 0 },
    claim,
    queueItems,
    preemptionCandidates: [],
  };

  const decision = service.schedule(request);

  assert.equal(decision.queue.orderedItemIds.length, 3);
  // item-3 has highest priority, should be first despite being youngest
  assert.equal(decision.queue.orderedItemIds[0], "item-3");
});

test("E2E Scaling: fair scheduling identifies starved items", (t) => {
  const service = new FairSchedulingService();

  const queueItems: FairQueueItem[] = [
    createFairQueueItem("item-1", "tenant-001", 10_000, 50),   // Not starved (< 15 min)
    createFairQueueItem("item-2", "tenant-001", 900_000, 50),  // Starved (> 15 min)
    createFairQueueItem("item-3", "tenant-001", 1_200_000, 30), // Starved (> 15 min)
  ];

  const claim = createResourceClaim();

  const request: FairSchedulingRequest = {
    quotaPolicy: { scopeId: "tenant-001", hardLimit: 10, currentUsage: 0 },
    claim,
    queueItems,
    preemptionCandidates: [],
  };

  const decision = service.schedule(request);

  assert.equal(decision.queue.starvedItemIds.length, 2);
  assert.ok(decision.queue.starvedItemIds.includes("item-2"));
  assert.ok(decision.queue.starvedItemIds.includes("item-3"));
});

test("E2E Scaling: fair scheduling triggers preemption when quota exceeded", (t) => {
  const service = new FairSchedulingService();

  const queueItems: FairQueueItem[] = [
    createFairQueueItem("victim", "tenant-001", 900_000, 20),
    createFairQueueItem("winner", "tenant-001", 30_000, 80),
  ];

  const claim = createResourceClaim({ requestedUnits: 5 });

  const preemptionCandidates: PreemptionCandidate[] = [
    {
      executionId: "exec-victim",
      priority: 20,
      progressPercent: 50,
    },
  ];

  const request: FairSchedulingRequest = {
    quotaPolicy: { scopeId: "tenant-001", hardLimit: 3, currentUsage: 3 },
    claim,
    queueItems,
    preemptionCandidates,
  };

  const decision = service.schedule(request);

  assert.equal(decision.queue.quotaExceeded, true);
  assert.equal(decision.preemption.shouldPreempt, true);
  assert.equal(decision.preemption.victimExecutionId, "exec-victim");
  assert.ok(decision.preemption.reason?.includes("quota_exceeded"));
});

test("E2E Scaling: fair scheduling does not preempt when quota not exceeded", (t) => {
  const service = new FairSchedulingService();

  const queueItems: FairQueueItem[] = [createFairQueueItem("item-1", "tenant-001", 30_000, 50)];

  const claim = createResourceClaim({ requestedUnits: 1 });

  const request: FairSchedulingRequest = {
    quotaPolicy: { scopeId: "tenant-001", hardLimit: 10, currentUsage: 5 },
    claim,
    queueItems,
    preemptionCandidates: [],
  };

  const decision = service.schedule(request);

  assert.equal(decision.queue.quotaExceeded, false);
  assert.equal(decision.preemption.shouldPreempt, false);
  assert.equal(decision.preemption.victimExecutionId, null);
});

test("E2E Scaling: fair scheduling handles multiple priority tiers", (t) => {
  const service = new FairSchedulingService();

  const queueItems: FairQueueItem[] = [
    createFairQueueItem("low-pri", "tenant-001", 60_000, 10),
    createFairQueueItem("med-pri", "tenant-001", 60_000, 50),
    createFairQueueItem("high-pri", "tenant-001", 60_000, 90),
    createFairQueueItem("critical-pri", "tenant-001", 60_000, 100),
  ];

  const claim = createResourceClaim();

  const request: FairSchedulingRequest = {
    quotaPolicy: { scopeId: "tenant-001", hardLimit: 10, currentUsage: 0 },
    claim,
    queueItems,
    preemptionCandidates: [],
  };

  const decision = service.schedule(request);

  // Should be ordered by priority descending
  assert.equal(decision.queue.orderedItemIds[0], "critical-pri");
  assert.equal(decision.queue.orderedItemIds[1], "high-pri");
  assert.equal(decision.queue.orderedItemIds[2], "med-pri");
  assert.equal(decision.queue.orderedItemIds[3], "low-pri");
});

// ---------------------------------------------------------------------------
// Tests: Multi-Tenant Scaling
// ---------------------------------------------------------------------------

test("E2E Scaling: different tenants get fair share", (t) => {
  const service = new ResourcePoolService();

  service.registerPool({
    poolId: "multi-tenant-pool",
    resourceType: "cpu",
    capacityUnits: 30,
    allocatedUnits: 0,
    burstUnits: 0,
  });

  // Three tenants each requesting 10 units
  const result1 = service.allocate("multi-tenant-pool", "tenant-a", 10);
  const result2 = service.allocate("multi-tenant-pool", "tenant-b", 10);
  const result3 = service.allocate("multi-tenant-pool", "tenant-c", 10);

  assert.equal(result1.granted, true);
  assert.equal(result2.granted, true);
  assert.equal(result3.granted, true);

  const pool = service.getPool("multi-tenant-pool");
  assert.equal(pool!.allocatedUnits, 30);

  // Fourth tenant should be blocked
  const result4 = service.allocate("multi-tenant-pool", "tenant-d", 1);
  assert.equal(result4.granted, false);
});

test("E2E Scaling: SLA tiers preserve priority during scheduling", (t) => {
  const service = new FairSchedulingService();

  const queueItems: FairQueueItem[] = [
    createFairQueueItem("standard-task", "tenant-001", 30_000, 50),
    createFairQueueItem("premium-task", "tenant-001", 30_000, 80),
  ];

  // Premium claim
  const premiumClaim = createResourceClaim({
    schedulingClass: createSchedulingClass({ slaTierId: "premium", priority: 80 }),
  });

  const request: FairSchedulingRequest = {
    quotaPolicy: { scopeId: "tenant-001", hardLimit: 10, currentUsage: 0 },
    claim: premiumClaim,
    queueItems,
    preemptionCandidates: [],
  };

  const decision = service.schedule(request);

  // Premium task (higher priority) should be selected first
  assert.equal(decision.queue.orderedItemIds[0], "premium-task");
});

// ---------------------------------------------------------------------------
// Tests: Worker Scaling
// ---------------------------------------------------------------------------

test("E2E Scaling: worker snapshots track scaling state", (t) => {
  const h = createScalingHarness("e2e-scaling-workers-");

  try {
    // Seed workers in different states
    seedWorker(h.store, h.db, "worker-001", "idle");
    seedWorker(h.store, h.db, "worker-002", "busy");
    seedWorker(h.store, h.db, "worker-003", "busy");
    seedWorker(h.store, h.db, "worker-004", "draining");
    seedWorker(h.store, h.db, "worker-005", "offline");

    const workers = h.store.worker.listWorkerSnapshots();

    assert.equal(workers.length, 5);

    const idleWorkers = workers.filter(w => w.status === "idle");
    const busyWorkers = workers.filter(w => w.status === "busy");
    const drainingWorkers = workers.filter(w => w.status === "draining");
    const offlineWorkers = workers.filter(w => w.status === "offline");

    assert.equal(idleWorkers.length, 1);
    assert.equal(busyWorkers.length, 2);
    assert.equal(drainingWorkers.length, 1);
    assert.equal(offlineWorkers.length, 1);
  } finally {
    h.cleanup();
  }
});

test("E2E Scaling: worker load balancing considers busy workers", (t) => {
  const h = createScalingHarness("e2e-scaling-load-");

  try {
    const now = nowIso();

    // Create tasks
    for (let i = 0; i < 10; i++) {
      seedTask(h.store, h.db, `task-${i}`, "queued", "tenant-001", now);
    }

    // Seed workers with varying states
    seedWorker(h.store, h.db, "worker-001", "idle");
    seedWorker(h.store, h.db, "worker-002", "idle");
    seedWorker(h.store, h.db, "worker-003", "busy");
    seedWorker(h.store, h.db, "worker-004", "draining");

    const workers = h.store.worker.listWorkerSnapshots();
    const availableWorkers = workers.filter(w => w.status === "idle" || w.status === "draining");

    // Should have 3 available workers (2 idle + 1 draining)
    assert.equal(availableWorkers.length, 3);

    const busyWorkers = workers.filter(w => w.status === "busy");
    assert.equal(busyWorkers.length, 1);
  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Tests: Throughput Under Load
// ---------------------------------------------------------------------------

test("E2E Scaling: high task volume handled correctly", (t) => {
  const h = createScalingHarness("e2e-scaling-volume-");

  try {
    const now = nowIso();

    // Create 50 tasks rapidly
    for (let i = 0; i < 50; i++) {
      seedTask(h.store, h.db, `task-vol-${i}`, "queued", "tenant-001", now);
    }

    const allTasks = h.store.listTasks();
    assert.equal(allTasks.length, 50);

    const queuedTasks = allTasks.filter(t => t.status === "queued");
    assert.equal(queuedTasks.length, 50);
  } finally {
    h.cleanup();
  }
});

test("E2E Scaling: execution state consistent under load", (t) => {
  const h = createScalingHarness("e2e-scaling-exec-");

  try {
    const now = nowIso();

    // Create task-execution pairs
    for (let i = 0; i < 20; i++) {
      const taskId = `task-exec-${i}`;
      const execId = `exec-${i}`;
      seedTask(h.store, h.db, taskId, "in_progress", "tenant-001", now);
      seedExecution(h.store, h.db, execId, taskId, "executing", 1);
    }

    const allTasks = h.store.listTasks();
    const allExecutions = h.store.dispatch.listExecutionsByStatuses(["executing"]);

    assert.equal(allTasks.length, 20);
    assert.equal(allExecutions.length, 20);

    // All executions should be executing
    const executingExecs = allExecutions.filter(e => e.status === "executing");
    assert.equal(executingExecs.length, 20);
  } finally {
    h.cleanup();
  }
});

test("E2E Scaling: mixed task statuses tracked correctly", (t) => {
  const h = createScalingHarness("e2e-scaling-mixed-");

  try {
    const now = nowIso();

    // Create tasks with different statuses
    const statuses: TaskStatus[] = ["queued", "in_progress", "in_progress", "done", "failed", "cancelled"];

    for (let i = 0; i < statuses.length; i++) {
      seedTask(h.store, h.db, `task-mixed-${i}`, statuses[i], "tenant-001", now);
    }

    const allTasks = h.store.listTasks();
    assert.equal(allTasks.length, statuses.length);

    const queuedCount = allTasks.filter(t => t.status === "queued").length;
    const inProgressCount = allTasks.filter(t => t.status === "in_progress").length;
    const doneCount = allTasks.filter(t => t.status === "done").length;
    const failedCount = allTasks.filter(t => t.status === "failed").length;
    const cancelledCount = allTasks.filter(t => t.status === "cancelled").length;

    assert.equal(queuedCount, 1);
    assert.equal(inProgressCount, 2);
    assert.equal(doneCount, 1);
    assert.equal(failedCount, 1);
    assert.equal(cancelledCount, 1);
  } finally {
    h.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Tests: Concurrent Scaling Scenarios
// ---------------------------------------------------------------------------

test("E2E Scaling: concurrent resource allocations maintain consistency", async (t) => {
  const service = new ResourcePoolService();

  service.registerPool({
    poolId: "concurrent-consistency",
    resourceType: "cpu",
    capacityUnits: 50,
    allocatedUnits: 0,
    burstUnits: 0,
  });

  const options: ConcurrentRunnerOptions = { concurrency: 10 };
  const result = await runConcurrentInvariant(async (workerId) => {
    // Each worker allocates 5 units
    const allocResult = service.allocate("concurrent-consistency", `consumer-${workerId}`, 5);
    return { workerId, granted: allocResult.granted, allocatedUnits: service.getPool("concurrent-consistency")!.allocatedUnits };
  }, options);

  assert.equal(result.success, true);

  // 10 workers * 5 units = 50 units should be allocated
  const pool = service.getPool("concurrent-consistency");
  assert.equal(pool!.allocatedUnits, 50);
});

test("E2E Scaling: concurrent releases maintain consistency", async (t) => {
  const service = new ResourcePoolService();

  service.registerPool({
    poolId: "concurrent-release",
    resourceType: "cpu",
    capacityUnits: 100,
    allocatedUnits: 50,
    burstUnits: 0,
  });

  // Pre-allocate to 50 units
  for (let i = 0; i < 10; i++) {
    service.allocate("concurrent-release", `pre-consumer-${i}`, 5);
  }

  const options: ConcurrentRunnerOptions = { concurrency: 10 };
  const result = await runConcurrentInvariant(async (workerId) => {
    service.release("concurrent-release", 5);
    return service.getPool("concurrent-release")!.allocatedUnits;
  }, options);

  assert.equal(result.success, true);

  const pool = service.getPool("concurrent-release");
  assert.equal(pool!.allocatedUnits, 0);
});

// ---------------------------------------------------------------------------
// Tests: Resource Pressure and Preemption
// ---------------------------------------------------------------------------

test("E2E Scaling: preemption selects lowest priority victim", (t) => {
  const service = new FairSchedulingService();

  const queueItems: FairQueueItem[] = [
    createFairQueueItem("low", "tenant-001", 900_000, 10),
    createFairQueueItem("med", "tenant-001", 600_000, 50),
    createFairQueueItem("high", "tenant-001", 300_000, 90),
  ];

  const claim = createResourceClaim({ requestedUnits: 5 });

  const preemptionCandidates: PreemptionCandidate[] = [
    { executionId: "exec-low", priority: 10, progressPercent: 50 },
    { executionId: "exec-med", priority: 50, progressPercent: 50 },
    { executionId: "exec-high", priority: 90, progressPercent: 50 },
  ];

  const request: FairSchedulingRequest = {
    quotaPolicy: { scopeId: "tenant-001", hardLimit: 2, currentUsage: 2 },
    claim,
    queueItems,
    preemptionCandidates,
  };

  const decision = service.schedule(request);

  assert.equal(decision.preemption.shouldPreempt, true);
  assert.equal(decision.preemption.victimExecutionId, "exec-low");
});

test("E2E Scaling: starvation detection works correctly", (t) => {
  const service = new FairSchedulingService();

  const queueItems: FairQueueItem[] = [
    createFairQueueItem("not-starved", "tenant-001", 5 * 60_000, 50),  // 5 minutes - not starved
    createFairQueueItem("starved-1", "tenant-001", 16 * 60 * 1000, 50), // 16 minutes - starved
    createFairQueueItem("starved-2", "tenant-001", 20 * 60 * 1000, 30), // 20 minutes - starved (lower priority)
  ];

  const claim = createResourceClaim();

  const request: FairSchedulingRequest = {
    quotaPolicy: { scopeId: "tenant-001", hardLimit: 10, currentUsage: 0 },
    claim,
    queueItems,
    preemptionCandidates: [],
  };

  const decision = service.schedule(request);

  assert.equal(decision.queue.starvedItemIds.length, 2);
  assert.ok(!decision.queue.starvedItemIds.includes("not-starved"));
  assert.ok(decision.queue.starvedItemIds.includes("starved-1"));
  assert.ok(decision.queue.starvedItemIds.includes("starved-2"));
});

// ---------------------------------------------------------------------------
// Tests: End-to-End Scaling with Database
// ---------------------------------------------------------------------------

test("E2E Scaling: full scaling pipeline with task lifecycle", (t) => {
  const h = createScalingHarness("e2e-scaling-pipeline-");

  try {
    const now = nowIso();

    // Phase 1: Ingest tasks
    for (let i = 0; i < 15; i++) {
      seedTask(h.store, h.db, `pipeline-task-${i}`, "queued", "tenant-001", now);
    }

    // Phase 2: Start executions
    const startedTasks = h.store.listTasks().slice(0, 10);
    for (const task of startedTasks) {
      h.db.transaction(() => {
        h.store.updateTaskStatus(task.id, "in_progress");
      });
      seedExecution(h.store, h.db, `exec-${task.id}`, task.id, "executing", 1);
    }

    // Phase 3: Complete some tasks
    h.db.transaction(() => {
      h.store.updateTaskStatus("pipeline-task-0", "done");
    });
    h.db.transaction(() => {
      h.store.updateTaskStatus("pipeline-task-1", "done");
    });

    // Verify final state
    const allTasks = h.store.listTasks();
    const queuedCount = allTasks.filter(t => t.status === "queued").length;
    const inProgressCount = allTasks.filter(t => t.status === "in_progress").length;
    const doneCount = allTasks.filter(t => t.status === "done").length;

    assert.equal(allTasks.length, 15);
    assert.equal(queuedCount, 5);
    assert.equal(inProgressCount, 8);
    assert.equal(doneCount, 2);

    const allExecutions = h.store.dispatch.listExecutionsByStatuses(["executing"]);
    assert.equal(allExecutions.length, 10);
  } finally {
    h.cleanup();
  }
});

test("E2E Scaling: resource pool and scheduling integration", (t) => {
  const poolService = new ResourcePoolService();
  const schedulingService = new FairSchedulingService();

  poolService.registerPool({
    poolId: "integration-pool",
    resourceType: "execution-slot",
    capacityUnits: 20,
    allocatedUnits: 0,
    burstUnits: 5,
  });

  // Simulate scheduling requests
  const queueItems: FairQueueItem[] = [
    createFairQueueItem("req-1", "tenant-001", 30_000, 70),
    createFairQueueItem("req-2", "tenant-001", 30_000, 50),
    createFairQueueItem("req-3", "tenant-001", 30_000, 30),
  ];

  let scheduled = 0;
  for (const item of queueItems) {
    const claim = createResourceClaim({
      claimId: item.itemId,
      schedulingClass: createSchedulingClass({ tenantId: item.tenantId, priority: item.priority }),
      requestedUnits: 1,
    });

    const request: FairSchedulingRequest = {
      quotaPolicy: { scopeId: "tenant-001", hardLimit: 20, currentUsage: scheduled },
      claim,
      queueItems,
      preemptionCandidates: [],
    };

    const decision = schedulingService.schedule(request);
    const allocResult = poolService.allocate("integration-pool", item.itemId, 1);

    if (allocResult.granted) {
      scheduled += 1;
    }
  }

  assert.equal(scheduled, 3);
  const pool = poolService.getPool("integration-pool");
  assert.equal(pool!.allocatedUnits, 3);
});
