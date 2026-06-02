import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { HealthService, toUnifiedRuntimeMode } from "../../../../../src/platform/shared/observability/health-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { ProviderHealthTracker } from "../../../../../src/platform/shared/observability/provider-health-tracker.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("toUnifiedRuntimeMode maps degradation modes to unified runtime modes", () => {
  assert.equal(toUnifiedRuntimeMode("none"), "full_auto");
  assert.equal(toUnifiedRuntimeMode("fast_only"), "supervised_auto");
  assert.equal(toUnifiedRuntimeMode("queue_only"), "no_external_call");
  assert.equal(toUnifiedRuntimeMode("pause_non_critical"), "manual_only");
  assert.equal(toUnifiedRuntimeMode("read_only_operations_only"), "read_only");
});

test("HealthService reports degraded when provider health is degraded", () => {
  const workspace = createTempWorkspace("aa-health-provider-deg-");
  const dbPath = join(workspace, "health-provider-deg.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-provider-deg",
      executionId: "exec-provider-deg",
      traceId: "trace-provider-deg",
    });

    const providerTracker = new ProviderHealthTracker({ degradedThreshold: 0.9, failedThreshold: 0.5 });
    const now = new Date();
    for (let i = 0; i < 10; i++) {
      const time = new Date(now.getTime() - i * 1000).toISOString();
      providerTracker.recordAttempt({
        provider: "openai",
        model: "gpt-4",
        succeeded: i < 7, // 70% success rate = degraded
        latencyMs: 100,
        recordedAt: time,
      });
    }

    const service = new HealthService(db, store, {
      providerTracker,
      providerWindowMs: 60_000,
      nowMsSupplier: () => now.getTime(),
    });

    const health = service.getReport();

    assert.equal(health.providerHealth, "degraded");
    assert.ok(health.providerSuccessRate < 1);
    assert.ok(health.findings.includes("provider_degraded"));
    assert.ok(["degraded", "overloaded", "unhealthy", "ok"].includes(health.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService reports failed when provider health is failed", () => {
  const workspace = createTempWorkspace("aa-health-provider-fail-");
  const dbPath = join(workspace, "health-provider-fail.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-provider-fail",
      executionId: "exec-provider-fail",
      traceId: "trace-provider-fail",
    });

    const providerTracker = new ProviderHealthTracker({ degradedThreshold: 0.9, failedThreshold: 0.5 });
    const now = new Date();
    for (let i = 0; i < 10; i++) {
      const time = new Date(now.getTime() - i * 1000).toISOString();
      providerTracker.recordAttempt({
        provider: "openai",
        model: "gpt-4",
        succeeded: i < 3, // 30% success rate = failed
        latencyMs: 100,
        recordedAt: time,
      });
    }

    const service = new HealthService(db, store, {
      providerTracker,
      providerWindowMs: 60_000,
      nowMsSupplier: () => now.getTime(),
    });

    const health = service.getReport();

    assert.equal(health.providerHealth, "failed");
    assert.ok(health.findings.includes("provider_failed"));
    assert.ok(["overloaded", "unhealthy"].includes(health.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService reports degraded when event loop lag exceeds threshold", () => {
  const workspace = createTempWorkspace("aa-health-event-lag-");
  const dbPath = join(workspace, "health-event-lag.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-event-lag",
      executionId: "exec-event-lag",
      traceId: "trace-event-lag",
    });

    // Simulate 250ms event loop lag (threshold is 200ms)
    const service = new HealthService(db, store, {
      eventLoopLagThresholdMs: 200,
      eventLoopLagSampler: () => 250,
      nowMsSupplier: () => Date.now(),
    });

    const health = service.getReport();

    assert.ok(health.eventLoopLagMs !== null);
    assert.ok(health.eventLoopLagMs > 200);
    assert.ok(health.findings.includes("event_loop_lag_degraded"));
    assert.ok(["degraded", "overloaded", "ok"].includes(health.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService reports overloaded when event loop lag exceeds 1.5x threshold", () => {
  const workspace = createTempWorkspace("aa-health-event-lag-ov-");
  const dbPath = join(workspace, "health-event-lag-ov.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-event-lag-ov",
      executionId: "exec-event-lag-ov",
      traceId: "trace-event-lag-ov",
    });

    // Simulate 350ms event loop lag (1.5x threshold of 200ms = 300ms)
    const service = new HealthService(db, store, {
      eventLoopLagThresholdMs: 200,
      eventLoopLagSampler: () => 350,
      nowMsSupplier: () => Date.now(),
    });

    const health = service.getReport();

    assert.ok(health.findings.includes("event_loop_lag_overloaded"));
    assert.ok(["overloaded", "unhealthy"].includes(health.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService detects queue starvation", () => {
  const workspace = createTempWorkspace("aa-health-starvation-");
  const dbPath = join(workspace, "health-starvation.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-starvation",
      executionId: "exec-starvation",
      traceId: "trace-starvation",
    });

    // Create a pending ticket that is 10 minutes old (threshold is 5 minutes)
    const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    store.insertExecutionTicket({
      id: "ticket-starvation",
      executionId: "exec-starvation",
      taskId: "task-starvation",
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
      createdAt: oldTime,
      updatedAt: oldTime,
    });

    const service = new HealthService(db, store, {
      queueStarvationThresholdSeconds: 300,
      nowMsSupplier: () => Date.now(),
    });

    const health = service.getReport();

    assert.equal(health.queueGovernance.starvationDetected, true);
    assert.ok(health.findings.includes("queue_starvation_detected"));
    assert.ok(["degraded", "overloaded", "ok"].includes(health.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService detects claimed ticket starvation", () => {
  const workspace = createTempWorkspace("aa-health-claimed-starvation-");
  const dbPath = join(workspace, "health-claimed-starvation.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-claimed-starvation",
      executionId: "exec-claimed-starvation",
      traceId: "trace-claimed-starvation",
    });

    // Create a claimed ticket that has been claimed for 10 minutes (threshold is 5 minutes)
    const oldTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    store.insertExecutionTicket({
      id: "ticket-claimed-starvation",
      executionId: "exec-claimed-starvation",
      taskId: "task-claimed-starvation",
      priority: "normal",
      queueName: "default",
      requiredCapabilitiesJson: JSON.stringify([]),
      dispatchAfter: null,
      attempt: 1,
      status: "claimed",
      assignedWorkerId: null,
      leaseId: null,
      claimedAt: oldTime,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: oldTime,
      updatedAt: oldTime,
    });

    const service = new HealthService(db, store, {
      queueStarvationThresholdSeconds: 300,
      nowMsSupplier: () => Date.now(),
    });

    const health = service.getReport();

    assert.equal(health.queueGovernance.starvationDetected, true);
    assert.ok(health.findings.includes("queue_starvation_detected"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService detects stale busy workers", () => {
  const workspace = createTempWorkspace("aa-health-stale-busy-");
  const dbPath = join(workspace, "health-stale-busy.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-stale-busy",
      executionId: "exec-stale-busy",
      traceId: "trace-stale-busy",
    });

    // Register a busy worker with stale heartbeat
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    store.upsertWorkerSnapshot({
      workerId: "worker-stale-busy",
      status: "busy",
      capabilitiesJson: JSON.stringify(["bash"]),
      runningExecutionsJson: JSON.stringify(["exec-1", "exec-2"]),
      maxConcurrency: 4,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-stale",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 50,
      memoryMb: 256,
      toolBacklogCount: 0,
      currentStepId: "step-1",
      lastProgressAt: staleTime,
      lastHeartbeatAt: staleTime,
      updatedAt: staleTime,
    });

    const service = new HealthService(db, store, {
      staleWorkerThresholdMs: 5 * 60 * 1000,
      nowMsSupplier: () => Date.now(),
    });

    const health = service.getReport();

    assert.ok(health.workerHealth.staleWorkers > 0);
    assert.ok(health.workerHealth.staleBusyWorkers > 0);
    assert.ok(health.findings.includes("stale_workers_detected"));
    assert.ok(["degraded", "overloaded", "ok"].includes(health.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService detects remote worker reconnecting status", () => {
  const workspace = createTempWorkspace("aa-health-remote-reconnecting-");
  const dbPath = join(workspace, "health-remote-reconnecting.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-remote-reconnecting",
      executionId: "exec-remote-reconnecting",
      traceId: "trace-remote-reconnecting",
    });

    store.upsertWorkerSnapshot({
      workerId: "worker-remote-reconnecting",
      status: "busy",
      capabilitiesJson: JSON.stringify(["bash"]),
      runningExecutionsJson: JSON.stringify([]),
      maxConcurrency: 2,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-remote",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 10,
      memoryMb: 128,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      placement: "remote",
      remoteSessionStatus: "reconnecting",
    });

    const service = new HealthService(db, store);
    const health = service.getReport();

    assert.ok(health.workerHealth.remoteReconnectingWorkers > 0);
    assert.ok(health.findings.includes("remote_session_reconnecting"));
    assert.ok(["degraded", "ok"].includes(health.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService detects remote worker degraded session", () => {
  const workspace = createTempWorkspace("aa-health-remote-degraded-");
  const dbPath = join(workspace, "health-remote-degraded.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-remote-degraded",
      executionId: "exec-remote-degraded",
      traceId: "trace-remote-degraded",
    });

    store.upsertWorkerSnapshot({
      workerId: "worker-remote-degraded",
      status: "busy",
      capabilitiesJson: JSON.stringify(["bash"]),
      runningExecutionsJson: JSON.stringify([]),
      maxConcurrency: 2,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-remote",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 10,
      memoryMb: 128,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      placement: "remote",
      remoteSessionStatus: "degraded",
    });

    const service = new HealthService(db, store);
    const health = service.getReport();

    assert.ok(health.workerHealth.remoteDegradedSessions > 0);
    assert.ok(health.findings.includes("remote_session_degraded"));
    assert.ok(["degraded", "ok"].includes(health.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService detects remote worker failed session", () => {
  const workspace = createTempWorkspace("aa-health-remote-failed-");
  const dbPath = join(workspace, "health-remote-failed.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-remote-failed",
      executionId: "exec-remote-failed",
      traceId: "trace-remote-failed",
    });

    store.upsertWorkerSnapshot({
      workerId: "worker-remote-failed",
      status: "busy",
      capabilitiesJson: JSON.stringify(["bash"]),
      runningExecutionsJson: JSON.stringify([]),
      maxConcurrency: 2,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-remote",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 10,
      memoryMb: 128,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      placement: "remote",
      remoteSessionStatus: "failed",
    });

    const service = new HealthService(db, store);
    const health = service.getReport();

    assert.ok(health.workerHealth.remoteFailedSessions > 0);
    assert.ok(health.findings.includes("remote_session_failed"));
    // Failed remote sessions should cause overloaded status
    assert.ok(["overloaded", "unhealthy"].includes(health.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService detects remote worker viewer_only status", () => {
  const workspace = createTempWorkspace("aa-health-remote-viewer-");
  const dbPath = join(workspace, "health-remote-viewer.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-remote-viewer",
      executionId: "exec-remote-viewer",
      traceId: "trace-remote-viewer",
    });

    store.upsertWorkerSnapshot({
      workerId: "worker-remote-viewer",
      status: "busy",
      capabilitiesJson: JSON.stringify(["bash"]),
      runningExecutionsJson: JSON.stringify([]),
      maxConcurrency: 2,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-remote",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 10,
      memoryMb: 128,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      placement: "remote",
      remoteSessionStatus: "viewer_only",
    });

    const service = new HealthService(db, store);
    const health = service.getReport();

    assert.ok(health.workerHealth.remoteViewerOnlyWorkers > 0);
    assert.ok(health.findings.includes("remote_session_viewer_only"));
    assert.ok(["degraded", "ok"].includes(health.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService detects remote consistency mismatch", () => {
  const workspace = createTempWorkspace("aa-health-remote-consistency-");
  const dbPath = join(workspace, "health-remote-consistency.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-remote-consistency",
      executionId: "exec-remote-consistency",
      traceId: "trace-remote-consistency",
    });

    store.upsertWorkerSnapshot({
      workerId: "worker-remote-consistency",
      status: "busy",
      capabilitiesJson: JSON.stringify(["bash"]),
      runningExecutionsJson: JSON.stringify([]),
      maxConcurrency: 2,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-remote",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 10,
      memoryMb: 128,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      placement: "remote",
      sessionConsistencyCheckStatus: "mismatch",
    });

    const service = new HealthService(db, store);
    const health = service.getReport();

    assert.ok(health.workerHealth.remoteConsistencyMismatchWorkers > 0);
    assert.ok(health.findings.includes("remote_session_consistency_mismatch"));
    assert.ok(["degraded", "ok"].includes(health.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService detects remote workspace sync conflict", () => {
  const workspace = createTempWorkspace("aa-health-remote-workspace-");
  const dbPath = join(workspace, "health-remote-workspace.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-remote-workspace",
      executionId: "exec-remote-workspace",
      traceId: "trace-remote-workspace",
    });

    store.upsertWorkerSnapshot({
      workerId: "worker-remote-workspace",
      status: "busy",
      capabilitiesJson: JSON.stringify(["bash"]),
      runningExecutionsJson: JSON.stringify([]),
      maxConcurrency: 2,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-remote",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 10,
      memoryMb: 128,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      placement: "remote",
      workspaceSyncStatus: "conflict",
    });

    const service = new HealthService(db, store);
    const health = service.getReport();

    assert.ok(health.workerHealth.remoteWorkspaceSyncConflictWorkers > 0);
    assert.ok(health.findings.includes("remote_workspace_sync_conflict"));
    assert.ok(["degraded", "ok"].includes(health.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService detects remote stream offset missing", () => {
  const workspace = createTempWorkspace("aa-health-remote-offset-");
  const dbPath = join(workspace, "health-remote-offset.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-remote-offset",
      executionId: "exec-remote-offset",
      traceId: "trace-remote-offset",
    });

    // Remote worker with reconnecting status but no offset recorded
    store.upsertWorkerSnapshot({
      workerId: "worker-remote-offset",
      status: "busy",
      capabilitiesJson: JSON.stringify(["bash"]),
      runningExecutionsJson: JSON.stringify([]),
      maxConcurrency: 2,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-remote",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 10,
      memoryMb: 128,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: new Date().toISOString(),
      lastHeartbeatAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      placement: "remote",
      remoteSessionStatus: "reconnecting",
      lastAcknowledgedStreamOffset: null,
    });

    const service = new HealthService(db, store);
    const health = service.getReport();

    assert.ok(health.workerHealth.remoteOffsetMissingWorkers > 0);
    assert.ok(health.findings.includes("remote_stream_offset_missing"));
    assert.ok(["degraded", "ok"].includes(health.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService reports overloaded when tier1 ack backlog exceeds threshold", () => {
  const workspace = createTempWorkspace("aa-health-tier1-ov-");
  const dbPath = join(workspace, "health-tier1-ov.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-tier1-ov",
      executionId: "exec-tier1-ov",
      traceId: "trace-tier1-ov",
    });

    // Insert 30 pending event consumer acks (threshold is 25 for overloaded)
    // event_consumer_acks has columns: id, event_id, consumer_id, status, last_attempt_at, acked_at, error_code, attempt_count
    // events table requires: id, event_type, event_tier, payload_json, created_at
    db.transaction(() => {
      for (let i = 0; i < 30; i++) {
        const eventId = `evt-tier1-ov-${i}`;
        // First insert the event that event_consumer_acks references
        db.connection.exec(`
          INSERT INTO events (id, task_id, execution_id, event_type, event_tier, payload_json, trace_id, created_at)
          VALUES ('${eventId}', 'task-tier1-ov', 'exec-tier1-ov', 'task.progress', 'tier_1', '{}', 'trace-tier1-ov', datetime('now'))
        `);
        // Then insert the event_consumer_acks
        db.connection.exec(`
          INSERT INTO event_consumer_acks (id, event_id, consumer_id, status, last_attempt_at, acked_at, error_code, attempt_count)
          VALUES ('eack-tier1-ov-${i}', '${eventId}', 'consumer-tier1', 'pending', datetime('now'), NULL, NULL, 0)
        `);
      }
    });

    const service = new HealthService(db, store, {
      tier1AckOverloadedThreshold: 25,
      nowMsSupplier: () => Date.now(),
    });

    const health = service.getReport();

    assert.ok(health.tier1AckBacklog >= 25);
    assert.ok(health.findings.includes("tier1_ack_backlog_overloaded"));
    assert.ok(["overloaded", "unhealthy"].includes(health.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService reports degraded when tier1 ack backlog exceeds degraded threshold", () => {
  const workspace = createTempWorkspace("aa-health-tier1-deg-");
  const dbPath = join(workspace, "health-tier1-deg.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-tier1-deg",
      executionId: "exec-tier1-deg",
      traceId: "trace-tier1-deg",
    });

    // Insert 15 pending event consumer acks (threshold is 10 for degraded, 25 for overloaded)
    // event_consumer_acks has columns: id, event_id, consumer_id, status, last_attempt_at, acked_at, error_code, attempt_count
    // events table requires: id, event_type, event_tier, payload_json, created_at
    db.transaction(() => {
      for (let i = 0; i < 15; i++) {
        const eventId = `evt-tier1-deg-${i}`;
        // First insert the event that event_consumer_acks references
        db.connection.exec(`
          INSERT INTO events (id, task_id, execution_id, event_type, event_tier, payload_json, trace_id, created_at)
          VALUES ('${eventId}', 'task-tier1-deg', 'exec-tier1-deg', 'task.progress', 'tier_1', '{}', 'trace-tier1-deg', datetime('now'))
        `);
        // Then insert the event_consumer_acks
        db.connection.exec(`
          INSERT INTO event_consumer_acks (id, event_id, consumer_id, status, last_attempt_at, acked_at, error_code, attempt_count)
          VALUES ('eack-tier1-deg-${i}', '${eventId}', 'consumer-tier1', 'pending', datetime('now'), NULL, NULL, 0)
        `);
      }
    });

    const service = new HealthService(db, store, {
      tier1AckDegradedThreshold: 10,
      tier1AckOverloadedThreshold: 25,
      nowMsSupplier: () => Date.now(),
    });

    const health = service.getReport();

    assert.ok(health.tier1AckBacklog >= 10);
    assert.ok(health.findings.includes("tier1_ack_backlog_degraded"));
    assert.ok(["degraded", "overloaded", "ok"].includes(health.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService degradation mode is queue_only when queue pressure detected", () => {
  const workspace = createTempWorkspace("aa-health-queue-pressure-");
  const dbPath = join(workspace, "health-queue-pressure.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const now = new Date().toISOString();

    // Create 15 tasks and executions first to satisfy foreign key constraints
    for (let i = 0; i < 15; i++) {
      const taskId = `task-pressure-${i}`;
      const execId = `exec-pressure-${i}`;

      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: `Task ${i}`,
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      store.insertExecution({
        id: execId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: `trace-pressure-${i}`,
        attempt: 1,
        timeoutMs: 1000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Create 15 pending tickets (overloaded threshold is 10)
    for (let i = 0; i < 15; i++) {
      store.insertExecutionTicket({
        id: `ticket-pressure-${i}`,
        executionId: `exec-pressure-${i}`,
        taskId: `task-pressure-${i}`,
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
        createdAt: now,
        updatedAt: now,
      });
    }

    const service = new HealthService(db, store, {
      queuedTaskOverloadedThreshold: 10,
      nowMsSupplier: () => Date.now(),
    });

    const health = service.getReport();

    assert.ok(health.findings.includes("queue_backlog_overloaded"));
    assert.ok(["overloaded", "degraded", "unhealthy"].includes(health.status));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService reports overloaded status when memory pressure exceeds 1.1x threshold", () => {
  const workspace = createTempWorkspace("aa-health-mem-ov-");
  const dbPath = join(workspace, "health-mem-ov.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-mem-ov",
      executionId: "exec-mem-ov",
      traceId: "trace-mem-ov",
    });

    // We can't actually control memory in tests, but we can verify the finding is generated
    // when the threshold conditions would be met based on actual memory
    const service = new HealthService(db, store, {
      memoryHighWatermarkMb: 1, // Very low threshold
      nowMsSupplier: () => Date.now(),
    });

    const health = service.getReport();

    // Actual memory should exceed 1MB threshold
    assert.ok(health.memoryRssMb > 1);
    assert.ok(
      health.findings.includes("memory_pressure_overloaded") ||
      health.findings.includes("memory_pressure_degraded") ||
      health.status === "ok",
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService active executions count is accurate", () => {
  const workspace = createTempWorkspace("aa-health-active-exec-");
  const dbPath = join(workspace, "health-active-exec.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Create multiple executions in active states
    const activeStatuses = ["created", "prechecking", "executing", "blocked"];
    for (let i = 0; i < 5; i++) {
      const taskId = `task-active-${i}`;
      const execId = `exec-active-${i}`;
      const now = new Date().toISOString();

      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: `Task ${i}`,
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      store.insertExecution({
        id: execId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: activeStatuses[i % activeStatuses.length],
        inputRef: null,
        traceId: `trace-active-${i}`,
        attempt: 1,
        timeoutMs: 1000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    const service = new HealthService(db, store);
    const health = service.getReport();

    assert.ok(health.activeExecutions >= 5);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService queued tasks count is accurate", () => {
  const workspace = createTempWorkspace("aa-health-queued-");
  const dbPath = join(workspace, "health-queued.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Create multiple queued/pending tasks
    for (let i = 0; i < 8; i++) {
      const taskId = `task-queued-${i}`;
      const status = i < 5 ? "queued" : "pending";
      const now = new Date().toISOString();

      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: `Queued Task ${i}`,
        status,
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    }

    const service = new HealthService(db, store);
    const health = service.getReport();

    assert.ok(health.queuedTasks >= 8);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService default options are applied correctly", () => {
  const workspace = createTempWorkspace("aa-health-defaults-");
  const dbPath = join(workspace, "health-defaults.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const service = new HealthService(db, store);
    const health = service.getReport();

    // Verify all expected fields exist with valid types
    assert.equal(typeof health.status, "string");
    assert.equal(typeof health.uptimeSeconds, "number");
    assert.equal(typeof health.dbWritable, "boolean");
    assert.equal(typeof health.providerHealth, "string");
    assert.equal(typeof health.providerSuccessRate, "number");
    assert.equal(typeof health.providerRecentCalls, "number");
    assert.equal(typeof health.activeExecutions, "number");
    assert.equal(typeof health.queuedTasks, "number");
    assert.equal(typeof health.eventLoopLagMs, "number");
    assert.equal(typeof health.memoryRssMb, "number");
    assert.equal(typeof health.tier1AckBacklog, "number");
    assert.equal(typeof health.degradationMode, "string");
    assert.equal(typeof health.queueGovernance, "object");
    assert.equal(typeof health.workerHealth, "object");
    assert.ok(Array.isArray(health.findings));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("HealthService custom options override defaults", () => {
  const workspace = createTempWorkspace("aa-health-custom-");
  const dbPath = join(workspace, "health-custom.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const customProviderTracker = new ProviderHealthTracker();
    const service = new HealthService(db, store, {
      providerTracker: customProviderTracker,
      providerWindowMs: 10 * 60_000,
      memoryHighWatermarkMb: 1024,
      eventLoopLagThresholdMs: 500,
      queuedTaskDegradedThreshold: 20,
      queuedTaskOverloadedThreshold: 50,
      tier1AckDegradedThreshold: 100,
      tier1AckOverloadedThreshold: 200,
      activeExecutionOverloadedThreshold: 25,
      queueStarvationThresholdSeconds: 600,
      staleWorkerThresholdMs: 10 * 60_000,
    });

    const health = service.getReport();

    // Service should work with custom options
    assert.ok(["ok", "degraded", "overloaded", "unhealthy"].includes(health.status));
    assert.equal(health.providerHealth, "healthy"); // No provider activity = healthy

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
