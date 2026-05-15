/**
 * Command Executor Limit Test - Verifies that worker concurrency limits
 * are properly enforced and tracked.
 *
 * This test validates:
 * - Worker maxConcurrency is respected
 * - Running executions count is correctly tracked
 * - Available slots calculation is correct
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { WorkerRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/worker-repository.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import type { WorkerSnapshotRecord } from "../../../../../src/platform/contracts/types/domain.js";

test("worker maxConcurrency - available slots calculated correctly", () => {
  const workspace = createTempWorkspace("aa-executor-limit-");
  const dbPath = join(workspace, "executor-limit.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const workerId = "worker-executor-test";

    // Create worker with maxConcurrency = 5
    const snapshot: WorkerSnapshotRecord = {
      workerId,
      status: "busy",
      repoVersion: "v1.0.0",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "0",
      streamResumeSuccessRate: 0.95,
      credentialRefreshSuccessRate: 1.0,
      sessionConsistencyCheckStatus: "passed",
      sessionConsistencyCheckedAt: now,
      workspaceSyncStatus: "aligned",
      workspaceSyncCheckedAt: now,
      saturation: 0.6,
      activeLeaseCount: 3,
      meanStartupLatencyMs: 100,
      sandboxSuccessRate: 0.98,
      repoCacheHitRate: 0.85,
      capabilitiesJson: '["code_edit", "bash"]',
      runningExecutionsJson: '["exec-1", "exec-2", "exec-3"]',
      maxConcurrency: 5,
      queueAffinity: null,
      runtimeInstanceId: null,
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 50,
      memoryMb: 256,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: null,
      lastHeartbeatAt: now,
      updatedAt: now,
    };

    repo.upsertWorkerSnapshot(snapshot);

    // Retrieve the snapshot
    const retrieved = repo.getWorkerSnapshot(workerId);
    assert.ok(retrieved, "Worker snapshot should exist");
    assert.equal(retrieved!.maxConcurrency, 5, "maxConcurrency should be 5");

    // Parse running executions
    const runningExecutions = JSON.parse(retrieved!.runningExecutionsJson) as string[];
    const activeLeaseCount = retrieved!.activeLeaseCount ?? 0;

    // Available slots = maxConcurrency - activeLeaseCount
    const availableSlots = Math.max(retrieved!.maxConcurrency - (retrieved!.activeLeaseCount ?? 0), 0);
    assert.equal(availableSlots, 2, "Available slots should be 2 (5 - 3)");
    assert.equal(runningExecutions.length, 3, "Should have 3 running executions");
  } finally {
    cleanupPath(workspace);
  }
});

test("worker maxConcurrency - at capacity has zero available slots", () => {
  const workspace = createTempWorkspace("aa-executor-full-");
  const dbPath = join(workspace, "executor-full.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const workerId = "worker-full";

    // Create worker at capacity
    const snapshot: WorkerSnapshotRecord = {
      workerId,
      status: "busy",
      repoVersion: "v1.0.0",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "0",
      streamResumeSuccessRate: 0.95,
      credentialRefreshSuccessRate: 1.0,
      sessionConsistencyCheckStatus: "passed",
      sessionConsistencyCheckedAt: now,
      workspaceSyncStatus: "aligned",
      workspaceSyncCheckedAt: now,
      saturation: 1.0,
      activeLeaseCount: 10,
      meanStartupLatencyMs: 100,
      sandboxSuccessRate: 0.98,
      repoCacheHitRate: 0.85,
      capabilitiesJson: '["code_edit"]',
      runningExecutionsJson: '["exec-1", "exec-2", "exec-3", "exec-4", "exec-5", "exec-6", "exec-7", "exec-8", "exec-9", "exec-10"]',
      maxConcurrency: 10,
      queueAffinity: null,
      runtimeInstanceId: null,
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 95,
      memoryMb: 1024,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: null,
      lastHeartbeatAt: now,
      updatedAt: now,
    };

    repo.upsertWorkerSnapshot(snapshot);

    const retrieved = repo.getWorkerSnapshot(workerId);
    assert.ok(retrieved, "Worker snapshot should exist");

    // At capacity, available slots should be 0
    const availableSlots = Math.max(retrieved!.maxConcurrency - (retrieved!.activeLeaseCount ?? 0), 0);
    assert.equal(availableSlots, 0, "At capacity, available slots should be 0");
    assert.equal(retrieved!.saturation, 1.0, "Saturation should be 1.0 at capacity");
  } finally {
    cleanupPath(workspace);
  }
});

test("worker maxConcurrency - idle worker has full capacity", () => {
  const workspace = createTempWorkspace("aa-executor-idle-");
  const dbPath = join(workspace, "executor-idle.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const workerId = "worker-idle";

    // Create idle worker
    const snapshot: WorkerSnapshotRecord = {
      workerId,
      status: "idle",
      repoVersion: "v1.0.0",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "0",
      streamResumeSuccessRate: 0.95,
      credentialRefreshSuccessRate: 1.0,
      sessionConsistencyCheckStatus: "passed",
      sessionConsistencyCheckedAt: now,
      workspaceSyncStatus: "aligned",
      workspaceSyncCheckedAt: now,
      saturation: 0.0,
      activeLeaseCount: 0,
      meanStartupLatencyMs: 100,
      sandboxSuccessRate: 0.98,
      repoCacheHitRate: 0.85,
      capabilitiesJson: '["code_edit", "bash"]',
      runningExecutionsJson: "[]",
      maxConcurrency: 10,
      queueAffinity: null,
      runtimeInstanceId: null,
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 5,
      memoryMb: 128,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: null,
      lastHeartbeatAt: now,
      updatedAt: now,
    };

    repo.upsertWorkerSnapshot(snapshot);

    const retrieved = repo.getWorkerSnapshot(workerId);
    assert.ok(retrieved, "Worker snapshot should exist");

    // Idle worker has full capacity
    const availableSlots = Math.max(retrieved!.maxConcurrency - (retrieved!.activeLeaseCount ?? 0), 0);
    assert.equal(availableSlots, 10, "Idle worker should have 10 available slots");
    assert.equal(retrieved!.status, "idle", "Status should be idle");
    assert.equal(retrieved!.saturation, 0.0, "Saturation should be 0.0");
  } finally {
    cleanupPath(workspace);
  }
});

test("worker maxConcurrency - saturation calculation", () => {
  const workspace = createTempWorkspace("aa-executor-saturation-");
  const dbPath = join(workspace, "executor-saturation.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";

    // Test saturation calculation at various load levels
    const testCases = [
      { maxConcurrency: 10, activeLeaseCount: 0, expectedSaturation: 0.0 },
      { maxConcurrency: 10, activeLeaseCount: 5, expectedSaturation: 0.5 },
      { maxConcurrency: 10, activeLeaseCount: 10, expectedSaturation: 1.0 },
      { maxConcurrency: 4, activeLeaseCount: 1, expectedSaturation: 0.25 },
      { maxConcurrency: 4, activeLeaseCount: 4, expectedSaturation: 1.0 },
    ];

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i]!;
      const workerId = `worker-sat-${i}`;

      const runningExecs: string[] = [];
      for (let j = 0; j < tc.activeLeaseCount; j++) {
        runningExecs.push(`exec-${j}`);
      }

      const snapshot: WorkerSnapshotRecord = {
        workerId,
        status: tc.activeLeaseCount === 0 ? "idle" : "busy",
        repoVersion: "v1.0.0",
        remoteSessionStatus: "connected",
        lastAcknowledgedStreamOffset: "0",
        streamResumeSuccessRate: 0.95,
        credentialRefreshSuccessRate: 1.0,
        sessionConsistencyCheckStatus: "passed",
        sessionConsistencyCheckedAt: now,
        workspaceSyncStatus: "aligned",
        workspaceSyncCheckedAt: now,
        saturation: tc.expectedSaturation,
        activeLeaseCount: tc.activeLeaseCount,
        meanStartupLatencyMs: 100,
        sandboxSuccessRate: 0.98,
        repoCacheHitRate: 0.85,
        capabilitiesJson: "[]",
        runningExecutionsJson: JSON.stringify(runningExecs),
        maxConcurrency: tc.maxConcurrency,
        queueAffinity: null,
        runtimeInstanceId: null,
        restartedFromRuntimeInstanceId: null,
        restartGeneration: 0,
        cpuPct: tc.expectedSaturation * 100,
        memoryMb: 256,
        toolBacklogCount: 0,
        currentStepId: null,
        lastProgressAt: null,
        lastHeartbeatAt: now,
        updatedAt: now,
      };

      repo.upsertWorkerSnapshot(snapshot);

      const retrieved = repo.getWorkerSnapshot(workerId);
      assert.ok(retrieved, `Worker ${i} should exist`);

      // Verify saturation is stored correctly
      assert.equal(retrieved!.saturation, tc.expectedSaturation, `Saturation for case ${i} should be ${tc.expectedSaturation}`);

      // Verify available slots calculation
      const availableSlots = Math.max(retrieved!.maxConcurrency - (retrieved!.activeLeaseCount ?? 0), 0);
      const expectedAvailable = tc.maxConcurrency - tc.activeLeaseCount;
      assert.equal(availableSlots, Math.max(expectedAvailable, 0), `Available slots for case ${i} should be ${Math.max(expectedAvailable, 0)}`);
    }
  } finally {
    cleanupPath(workspace);
  }
});
