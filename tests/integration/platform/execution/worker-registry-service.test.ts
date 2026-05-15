import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { WorkerRegistryService } from "../../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("worker registry service filters workers by capability, queue affinity, and free capacity", () => {
  const workspace = createTempWorkspace("aa-worker-registry-");
  const dbPath = join(workspace, "worker-registry.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const registry = new WorkerRegistryService(store);

    registry.recordHeartbeat({
      workerId: "worker-a",
      status: "idle",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-worker-a-1",
      repoVersion: "repo-main@abc123",
      cpuPct: 22.5,
      memoryMb: 128,
      toolBacklogCount: 3,
      currentStepId: "step-edit",
      lastProgressAt: "2026-04-03T10:00:00.000Z",
      occurredAt: "2026-04-03T10:00:00.000Z",
    });
    registry.recordHeartbeat({
      workerId: "worker-b",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-b-1"],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-03T10:00:00.000Z",
    });
    registry.recordHeartbeat({
      workerId: "worker-c",
      status: "degraded",
      placement: "remote",
      registrationVerifiedAt: "2026-04-03T09:59:59.000Z",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "stream:42",
      streamResumeSuccessRate: 0.98,
      credentialRefreshSuccessRate: 0.97,
      sessionConsistencyCheckStatus: "passed",
      sessionConsistencyCheckedAt: "2026-04-03T10:00:00.000Z",
      saturation: 0.75,
      activeLeaseCount: 1,
      meanStartupLatencyMs: 420,
      sandboxSuccessRate: 0.99,
      repoCacheHitRate: 0.88,
      capabilities: ["bash", "read"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "research",
      occurredAt: "2026-04-03T10:00:00.000Z",
    });
    registry.recordHeartbeat({
      workerId: "worker-draining",
      status: "draining",
      capabilities: ["bash", "edit"],
      runningExecutionIds: ["exec-draining-1"],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: "2026-04-03T10:00:00.000Z",
    });

    const eligibleDefault = registry.listEligibleWorkers({
      requiredCapabilities: ["bash"],
      queueAffinity: "default",
    });
    const eligibleResearch = registry.listEligibleWorkers({
      requiredCapabilities: ["bash"],
      queueAffinity: "research",
      includeDegraded: true,
    });
    const drainingWorker = registry.getWorker("worker-draining");
    db.close();

    assert.deepEqual(
      eligibleDefault.map((worker) => worker.workerId),
      ["worker-a"],
    );
    assert.equal(eligibleDefault[0]?.cpuPct, 22.5);
    assert.equal(eligibleDefault[0]?.memoryMb, 128);
    assert.equal(eligibleDefault[0]?.toolBacklogCount, 3);
    assert.equal(eligibleDefault[0]?.currentStepId, "step-edit");
    assert.equal(eligibleDefault[0]?.lastProgressAt, "2026-04-03T10:00:00.000Z");
    assert.equal(eligibleDefault[0]?.runtimeInstanceId, "runtime-worker-a-1");
    assert.equal(eligibleDefault[0]?.repoVersion, "repo-main@abc123");
    assert.equal(eligibleDefault[0]?.restartGeneration, 0);
    assert.equal(eligibleDefault[0]?.placement, "local");
    assert.equal(eligibleDefault[0]?.schedulingStatus, "healthy");
    assert.equal(drainingWorker?.status, "draining");
    assert.equal(drainingWorker?.schedulingStatus, "draining");
    assert.deepEqual(
      eligibleResearch.map((worker) => worker.workerId),
      ["worker-c"],
    );
    assert.equal(eligibleResearch[0]?.placement, "remote");
    assert.equal(eligibleResearch[0]?.schedulingStatus, "degraded");
    assert.equal(eligibleResearch[0]?.remoteSessionStatus, "connected");
    assert.equal(eligibleResearch[0]?.lastAcknowledgedStreamOffset, "stream:42");
    assert.equal(eligibleResearch[0]?.streamResumeSuccessRate, 0.98);
    assert.equal(eligibleResearch[0]?.credentialRefreshSuccessRate, 0.97);
    assert.equal(eligibleResearch[0]?.sessionConsistencyCheckStatus, "passed");
    assert.equal(eligibleResearch[0]?.saturation, 0.75);
    assert.equal(eligibleResearch[0]?.activeLeaseCount, 1);
    assert.equal(eligibleResearch[0]?.meanStartupLatencyMs, 420);
    assert.equal(eligibleResearch[0]?.sandboxSuccessRate, 0.99);
    assert.equal(eligibleResearch[0]?.repoCacheHitRate, 0.88);
    assert.equal(eligibleDefault[0]?.availableSlots, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("worker registry service tracks runtime instance restarts per logical worker", () => {
  const workspace = createTempWorkspace("aa-worker-registry-");
  const dbPath = join(workspace, "worker-restart.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const registry = new WorkerRegistryService(store);

    registry.recordHeartbeat({
      workerId: "worker-restart",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-1"],
      maxConcurrency: 1,
      runtimeInstanceId: "runtime-1",
      occurredAt: "2026-04-03T10:00:00.000Z",
    });
    const restarted = registry.recordHeartbeat({
      workerId: "worker-restart",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-1"],
      maxConcurrency: 1,
      runtimeInstanceId: "runtime-2",
      occurredAt: "2026-04-03T10:05:00.000Z",
    });
    db.close();

    assert.equal(restarted.workerId, "worker-restart");
    assert.equal(restarted.runtimeInstanceId, "runtime-2");
    assert.equal(restarted.restartedFromRuntimeInstanceId, "runtime-1");
    assert.equal(restarted.restartGeneration, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("worker registry service reports stale workers by heartbeat age", () => {
  const workspace = createTempWorkspace("aa-worker-registry-");
  const dbPath = join(workspace, "worker-stale.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const registry = new WorkerRegistryService(store);

    registry.recordHeartbeat({
      workerId: "worker-old",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      occurredAt: "2026-04-03T10:00:00.000Z",
    });
    registry.recordHeartbeat({
      workerId: "worker-fresh",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      occurredAt: "2026-04-03T10:09:30.000Z",
    });

    const staleWorkers = registry.listStaleWorkers("2026-04-03T10:10:00.000Z", 2 * 60 * 1000);
    db.close();

    assert.deepEqual(
      staleWorkers.map((worker) => worker.workerId),
      ["worker-old"],
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("worker registry service enforces required isolation levels with stronger workers satisfying weaker requirements", () => {
  const workspace = createTempWorkspace("aa-worker-registry-");
  const dbPath = join(workspace, "worker-isolation.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const registry = new WorkerRegistryService(store);

    registry.recordHeartbeat({
      workerId: "worker-standard",
      status: "idle",
      isolationLevel: "standard",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      occurredAt: "2026-04-03T11:00:00.000Z",
    });
    registry.recordHeartbeat({
      workerId: "worker-strict",
      status: "idle",
      isolationLevel: "strict",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      occurredAt: "2026-04-03T11:00:00.000Z",
    });

    const hardenedEligible = registry.listEligibleWorkers({
      requiredCapabilities: ["bash"],
      requiredIsolationLevel: "hardened",
    });
    const standardEligible = registry.listEligibleWorkers({
      requiredCapabilities: ["bash"],
      requiredIsolationLevel: "standard",
    });
    db.close();

    assert.deepEqual(
      hardenedEligible.map((worker) => worker.workerId),
      ["worker-strict"],
    );
    assert.equal(hardenedEligible[0]?.isolationLevel, "strict");
    assert.deepEqual(
      standardEligible.map((worker) => worker.workerId),
      ["worker-standard", "worker-strict"],
    );
  } finally {
    cleanupPath(workspace);
  }
});
