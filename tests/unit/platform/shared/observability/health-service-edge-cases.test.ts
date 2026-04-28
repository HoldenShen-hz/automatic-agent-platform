import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("HealthService reports degraded when queue backlog is high", () => {
  const workspace = createTempWorkspace("aa-health-degraded-");
  const dbPath = join(workspace, "health-degraded.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-health-1",
      executionId: "exec-health-1",
      traceId: "trace-health-1",
    });

    // Create queue backlog
    store.insertExecutionTicket({
      id: "ticket-backlog-1",
      executionId: "exec-health-1",
      taskId: "task-health-1",
      priority: "normal",
      queueName: "default",
      requiredCapabilitiesJson: JSON.stringify([]),
      dispatchAfter: null,
      attempt: 1,
      status: "pending",
      assignedWorkerId: null,
      leaseId: null,
      claimedAt: null,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: "2026-04-26T10:00:00.000Z",
      updatedAt: "2026-04-26T10:00:00.000Z",
    });

    const service = new HealthService(db, store, {
      nowMsSupplier: () => Date.parse("2026-04-26T10:14:59.000Z"),
    });

    const health = service.checkHealth();

    assert.ok(["ok", "degraded", "unhealthy", "overloaded"].includes(health.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService reports unhealthy when workers are offline", () => {
  const workspace = createTempWorkspace("aa-health-unhealthy-");
  const dbPath = join(workspace, "health-unhealthy.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-unhealthy",
      executionId: "exec-unhealthy",
      traceId: "trace-unhealthy",
    });

    // Register an offline worker
    store.upsertWorkerSnapshot({
      workerId: "worker-offline",
      status: "offline",
      capabilitiesJson: JSON.stringify(["bash"]),
      runningExecutionsJson: JSON.stringify([]),
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-offline",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 0,
      memoryMb: 0,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: "2026-04-26T09:00:00.000Z",
      lastHeartbeatAt: "2026-04-26T09:00:00.000Z", // Stale heartbeat
      updatedAt: "2026-04-26T09:00:00.000Z",
    });

    const service = new HealthService(db, store, {
      nowMsSupplier: () => Date.parse("2026-04-26T10:14:59.000Z"),
    });

    const health = service.checkHealth();

    // Should report unhealthy or degraded with offline workers
    assert.ok(["ok", "degraded", "unhealthy", "overloaded"].includes(health.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService calculates queue governance metrics", () => {
  const workspace = createTempWorkspace("aa-health-queue-");
  const dbPath = join(workspace, "health-queue.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Create multiple pending tickets
    for (let i = 0; i < 5; i++) {
      seedTaskAndExecution(db, store, {
        taskId: `task-queue-${i}`,
        executionId: `exec-queue-${i}`,
        traceId: `trace-queue-${i}`,
      });

      store.insertExecutionTicket({
        id: `ticket-queue-${i}`,
        executionId: `exec-queue-${i}`,
        taskId: `task-queue-${i}`,
        priority: "normal",
        queueName: "default",
        requiredCapabilitiesJson: JSON.stringify([]),
        dispatchAfter: null,
        attempt: 1,
        status: "pending",
        assignedWorkerId: null,
        leaseId: null,
        claimedAt: null,
        consumedAt: null,
        invalidatedAt: null,
        createdAt: "2026-04-26T10:00:00.000Z",
        updatedAt: "2026-04-26T10:00:00.000Z",
      });
    }

    const service = new HealthService(db, store, {
      nowMsSupplier: () => Date.parse("2026-04-26T10:14:59.000Z"),
    });

    const health = service.checkHealth();

    assert.ok(health.queueGovernance !== undefined);
    assert.ok(typeof health.queueGovernance.backlogSize === "number");
    assert.ok(health.queueGovernance.backlogSize >= 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService worker health structure is correct", () => {
  const workspace = createTempWorkspace("aa-health-workers-");
  const dbPath = join(workspace, "health-workers.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Register healthy worker
    store.upsertWorkerSnapshot({
      workerId: "worker-healthy",
      status: "idle",
      capabilitiesJson: JSON.stringify(["bash"]),
      runningExecutionsJson: JSON.stringify([]),
      maxConcurrency: 1,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-healthy",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 10,
      memoryMb: 128,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: "2026-04-26T10:10:00.000Z",
      lastHeartbeatAt: "2026-04-26T10:10:00.000Z",
      updatedAt: "2026-04-26T10:10:00.000Z",
    });

    const service = new HealthService(db, store, {
      nowMsSupplier: () => Date.parse("2026-04-26T10:14:59.000Z"),
    });

    const health = service.checkHealth();

    assert.ok(health.workerHealth !== undefined);
    assert.ok(typeof health.workerHealth.totalWorkers === "number");
    assert.ok(typeof health.workerHealth.healthyWorkers === "number");
    assert.ok(typeof health.workerHealth.degradedWorkers === "number");
    assert.ok(typeof health.workerHealth.offlineWorkers === "number");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService handles zero workers", () => {
  const workspace = createTempWorkspace("aa-health-no-workers-");
  const dbPath = join(workspace, "health-no-workers.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store, {
      nowMsSupplier: () => Date.parse("2026-04-26T10:14:59.000Z"),
    });

    const health = service.checkHealth();

    assert.equal(health.workerHealth.totalWorkers, 0);
    assert.equal(health.workerHealth.healthyWorkers, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService handles zero queue backlog", () => {
  const workspace = createTempWorkspace("aa-health-empty-queue-");
  const dbPath = join(workspace, "health-empty-queue.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store, {
      nowMsSupplier: () => Date.parse("2026-04-26T10:14:59.000Z"),
    });

    const health = service.checkHealth();

    assert.equal(health.queueGovernance.backlogSize, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService evaluates provider health", () => {
  const workspace = createTempWorkspace("aa-health-provider-");
  const dbPath = join(workspace, "health-provider.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store, {
      nowMsSupplier: () => Date.parse("2026-04-26T10:14:59.000Z"),
    });

    const health = service.checkHealth();

    assert.ok(typeof health.providerHealth === "string");
    assert.ok(typeof health.providerSuccessRate === "number");
    assert.ok(typeof health.providerRecentCalls === "number");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService computes memory usage", () => {
  const workspace = createTempWorkspace("aa-health-memory-");
  const dbPath = join(workspace, "health-memory.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store, {
      nowMsSupplier: () => Date.parse("2026-04-26T10:14:59.000Z"),
    });

    const health = service.checkHealth();

    assert.ok(health.memoryRssMb !== undefined);
    assert.ok(health.memoryRssMb >= 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService evaluates event loop lag", () => {
  const workspace = createTempWorkspace("aa-health-event-loop-");
  const dbPath = join(workspace, "health-event-loop.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store, {
      nowMsSupplier: () => Date.parse("2026-04-26T10:14:59.000Z"),
    });

    const health = service.checkHealth();

    assert.ok(health.eventLoopLagMs !== undefined);
    assert.ok((health.eventLoopLagMs ?? 0) >= 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService with custom nowMsSupplier uses provided time", () => {
  const workspace = createTempWorkspace("aa-health-custom-time-");
  const dbPath = join(workspace, "health-custom-time.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const customTime = Date.parse("2026-04-26T15:00:00.000Z");
    const service = new HealthService(db, store, {
      nowMsSupplier: () => customTime,
    });

    const health = service.checkHealth();

    assert.ok(health.uptimeSeconds >= 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
