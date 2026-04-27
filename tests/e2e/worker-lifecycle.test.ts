/**
 * E2E Worker Lifecycle Tests
 *
 * Tests worker registration, heartbeat, and status transitions
 * through the WorkerRegistryService.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { WorkerRegistryService, type WorkerRegistryHeartbeatInput } from "../../src/platform/execution/worker-pool/worker/worker-registry-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";

function createE2eHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e-worker-lifecycle.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const workerRegistry = new WorkerRegistryService(store);

  return { workspace, db, store, workerRegistry };
}

test("E2E: worker registers via heartbeat and can be retrieved", () => {
  const h = createE2eHarness("e2e-worker-reg-");

  try {
    const workerId = newId("worker");
    const heartbeat: WorkerRegistryHeartbeatInput = {
      workerId,
      status: "idle",
      capabilities: ["code-execution", "file-read", "file-write"],
      runningExecutionIds: [],
      maxConcurrency: 10,
      cpuPct: 25,
      memoryMb: 512,
      occurredAt: nowIso(),
    };

    // Record heartbeat - this registers the worker
    const worker = h.workerRegistry.recordHeartbeat(heartbeat);

    assert.ok(worker, "Worker should be registered");
    assert.equal(worker.workerId, workerId, "Worker ID should match");
    assert.equal(worker.status, "idle", "Worker status should be idle");
    assert.deepEqual(worker.capabilities, ["code-execution", "file-read", "file-write"], "Capabilities should match");
    assert.equal(worker.maxConcurrency, 10, "Max concurrency should match");
    assert.equal(worker.availableSlots, 10, "Available slots should equal maxConcurrency when no executions running");

    // Verify worker can be retrieved by ID
    const retrieved = h.workerRegistry.getWorker(workerId);
    assert.ok(retrieved, "Worker should be retrievable");
    assert.equal(retrieved!.workerId, workerId, "Retrieved worker ID should match");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("E2E: worker status transitions from idle to busy", () => {
  const h = createE2eHarness("e2e-worker-status-");

  try {
    const workerId = newId("worker");
    const executionId = newId("exec");

    // Register worker as idle
    h.workerRegistry.recordHeartbeat({
      workerId,
      status: "idle",
      capabilities: ["code-execution"],
      runningExecutionIds: [],
      maxConcurrency: 5,
      occurredAt: nowIso(),
    });

    // Worker starts executing a task
    const updated = h.workerRegistry.recordHeartbeat({
      workerId,
      status: "busy",
      capabilities: ["code-execution"],
      runningExecutionIds: [executionId],
      maxConcurrency: 5,
      occurredAt: nowIso(),
    });

    assert.equal(updated.status, "busy", "Worker status should be busy");
    assert.equal(updated.runningExecutionIds.length, 1, "Should have 1 running execution");
    assert.ok(updated.runningExecutionIds.includes(executionId), "Execution ID should be in running list");
    assert.equal(updated.availableSlots, 4, "Available slots should decrease by 1");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("E2E: worker at capacity is excluded from eligible workers", () => {
  const h = createE2eHarness("e2e-worker-capacity-");

  try {
    const workerId = newId("worker");

    // Register worker at full capacity
    h.workerRegistry.recordHeartbeat({
      workerId,
      status: "busy",
      capabilities: ["code-execution"],
      runningExecutionIds: ["exec-1", "exec-2", "exec-3", "exec-4", "exec-5"],
      maxConcurrency: 5,
      occurredAt: nowIso(),
    });

    // List eligible workers - worker at capacity should be excluded
    const eligible = h.workerRegistry.listEligibleWorkers({
      requiredCapabilities: ["code-execution"],
    });

    assert.ok(!eligible.find(w => w.workerId === workerId), "Worker at capacity should not be eligible");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("E2E: worker with queue affinity matches correctly", () => {
  const h = createE2eHarness("e2e-worker-queue-");

  try {
    const workerId = newId("worker");

    // Register worker with queue affinity
    h.workerRegistry.recordHeartbeat({
      workerId,
      status: "idle",
      capabilities: ["code-execution"],
      runningExecutionIds: [],
      maxConcurrency: 5,
      queueAffinity: "priority-queue",
      occurredAt: nowIso(),
    });

    // Query with matching queue affinity
    const matchingQueue = h.workerRegistry.listEligibleWorkers({
      queueAffinity: "priority-queue",
    });
    assert.ok(matchingQueue.find(w => w.workerId === workerId), "Worker should match with affinity");

    // Query with different queue affinity
    const differentQueue = h.workerRegistry.listEligibleWorkers({
      queueAffinity: "general-queue",
    });
    assert.ok(!differentQueue.find(w => w.workerId === workerId), "Worker should not match different queue");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("E2E: worker isolation level requirements are enforced", () => {
  const h = createE2eHarness("e2e-worker-isolation-");

  try {
    const workerId = newId("worker");

    // Register worker with hardened isolation
    h.workerRegistry.recordHeartbeat({
      workerId,
      status: "idle",
      isolationLevel: "hardened",
      capabilities: ["code-execution"],
      runningExecutionIds: [],
      maxConcurrency: 5,
      occurredAt: nowIso(),
    });

    // Query with standard isolation requirement - should match
    const standardReq = h.workerRegistry.listEligibleWorkers({
      requiredIsolationLevel: "standard",
    });
    assert.ok(standardReq.find(w => w.workerId === workerId), "Hardened worker should meet standard requirement");

    // Query with hardened isolation requirement - should match
    const hardenedReq = h.workerRegistry.listEligibleWorkers({
      requiredIsolationLevel: "hardened",
    });
    assert.ok(hardenedReq.find(w => w.workerId === workerId), "Hardened worker should meet hardened requirement");

    // Query with strict isolation requirement - should NOT match
    const strictReq = h.workerRegistry.listEligibleWorkers({
      requiredIsolationLevel: "strict",
    });
    assert.ok(!strictReq.find(w => w.workerId === workerId), "Hardened worker should not meet strict requirement");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("E2E: degraded workers are excluded unless explicitly included", () => {
  const h = createE2eHarness("e2e-worker-degraded-");

  try {
    const workerId = newId("worker");

    // Register degraded worker
    h.workerRegistry.recordHeartbeat({
      workerId,
      status: "degraded",
      capabilities: ["code-execution"],
      runningExecutionIds: [],
      maxConcurrency: 5,
      occurredAt: nowIso(),
    });

    // Default - degraded excluded
    const defaultList = h.workerRegistry.listEligibleWorkers({
      requiredCapabilities: ["code-execution"],
    });
    assert.ok(!defaultList.find(w => w.workerId === workerId), "Degraded worker should be excluded by default");

    // Explicitly include degraded
    const includeDegraded = h.workerRegistry.listEligibleWorkers({
      requiredCapabilities: ["code-execution"],
      includeDegraded: true,
    });
    assert.ok(includeDegraded.find(w => w.workerId === workerId), "Degraded worker should be included when requested");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("E2E: worker telemetry is preserved across heartbeats", () => {
  const h = createE2eHarness("e2e-worker-telemetry-");

  try {
    const workerId = newId("worker");

    // Initial heartbeat with telemetry
    h.workerRegistry.recordHeartbeat({
      workerId,
      status: "idle",
      capabilities: ["code-execution"],
      runningExecutionIds: [],
      maxConcurrency: 5,
      cpuPct: 50,
      memoryMb: 1024,
      toolBacklogCount: 3,
      occurredAt: nowIso(),
    });

    // Follow-up heartbeat without explicit telemetry values
    const updated = h.workerRegistry.recordHeartbeat({
      workerId,
      status: "idle",
      capabilities: ["code-execution"],
      runningExecutionIds: [],
      maxConcurrency: 5,
      occurredAt: nowIso(),
    });

    // Telemetry should be preserved from previous heartbeat
    assert.equal(updated.cpuPct, 50, "CPU percentage should be preserved");
    assert.equal(updated.memoryMb, 1024, "Memory should be preserved");
    assert.equal(updated.toolBacklogCount, 3, "Tool backlog count should be preserved");
  } finally {
    cleanupPath(h.workspace);
  }
});

test("E2E: multiple workers can be registered and listed", () => {
  const h = createE2eHarness("e2e-worker-multi-");

  try {
    const workerIds = [newId("worker"), newId("worker"), newId("worker")];

    // Register multiple workers
    for (const workerId of workerIds) {
      h.workerRegistry.recordHeartbeat({
        workerId,
        status: "idle",
        capabilities: ["code-execution"],
        runningExecutionIds: [],
        maxConcurrency: 5,
        occurredAt: nowIso(),
      });
    }

    // List all workers
    const workers = h.workerRegistry.listWorkers();
    assert.equal(workers.length, 3, "Should have 3 workers registered");

    // All registered worker IDs should be present
    for (const workerId of workerIds) {
      assert.ok(workers.find(w => w.workerId === workerId), `Worker ${workerId} should be in list`);
    }
  } finally {
    cleanupPath(h.workspace);
  }
});
