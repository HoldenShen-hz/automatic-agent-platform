/**
 * Lease Contention Test - Verifies that only one worker can acquire a lease
 * for a given execution under concurrent contention.
 *
 * This test validates:
 * - Multiple workers racing to insert leases → only one succeeds (UNIQUE constraint)
 * - Fencing token is monotonically increasing per execution
 * - No two active leases exist simultaneously for the same execution
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { WorkerRepository } from "../../../../../src/platform/state-evidence/truth/sqlite/repositories/worker-repository.js";
import { TaskRepository } from "../../../../../src/platform/state-evidence/truth/sqlite/repositories/task-repository.js";
import { ExecutionRepository } from "../../../../../src/platform/state-evidence/truth/sqlite/repositories/execution-repository.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import type { ExecutionLeaseRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createTestTask(db: SqliteDatabase, taskId: string, now: string): void {
  const taskRepo = new TaskRepository(db.connection);
  taskRepo.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general_ops",
    tenantId: null,
    title: "Test task",
    status: "in_progress",
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });
}

function createTestExecution(db: SqliteDatabase, execId: string, taskId: string, now: string): void {
  const execRepo = new ExecutionRepository(db.connection);
  createTestTask(db, taskId, now);
  execRepo.insertExecution({
    id: execId,
    taskId,
    workflowId: "single_agent_minimal",
    parentExecutionId: null,
    agentId: "agent-1",
    roleId: "general_executor",
    runKind: "task_run",
    status: "executing",
    inputRef: null,
    traceId: `trace-${execId}`,
    attempt: 1,
    timeoutMs: 60000,
    budgetUsdLimit: 1.0,
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

test("concurrent lease acquisition - only one worker succeeds", () => {
  const workspace = createTempWorkspace("aa-lease-contention-");
  const dbPath = join(workspace, "lease-contention.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    // Use dynamic dates - future date relative to when test runs
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
    const execId = "exec-lease-race-1";
    const taskId = "task-lease-race-1";

    createTestExecution(db, execId, taskId, now);

    // Simulate 4 workers racing to acquire the same lease
    const workerIds = ["worker-a", "worker-b", "worker-c", "worker-d"];
    const results: Array<{ workerId: string; success: boolean; leaseId: string | null }> = [];

    for (const workerId of workerIds) {
      const leaseId = `lease-${workerId}`;
      const lease: ExecutionLeaseRecord = {
        id: leaseId,
        executionId: execId,
        workerId,
        attempt: 1,
        fencingToken: 1,
        queueName: "default",
        status: "active",
        leasedAt: now,
        expiresAt: future,
        lastHeartbeatAt: now,
        releasedAt: null,
        reasonCode: null,
      };

      try {
        repo.insertExecutionLease(lease);
        results.push({ workerId, success: true, leaseId });
      } catch {
        results.push({ workerId, success: false, leaseId: null });
      }
    }

    // Only ONE insert should succeed
    const successCount = results.filter((r) => r.success).length;
    assert.equal(successCount, 1, "Only one worker should acquire the lease");

    // The active lease should exist
    const activeLease = repo.getActiveExecutionLease(execId);
    assert.ok(activeLease, "An active lease should exist");
    assert.equal(activeLease!.status, "active", "Lease status should be active");
  } finally {
    cleanupPath(workspace);
  }
});

test("concurrent lease acquisition - fencing token increases", () => {
  const workspace = createTempWorkspace("aa-lease-fencing-");
  const dbPath = join(workspace, "lease-fencing.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    // Use dynamic dates - future date relative to when test runs
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
    const execId = "exec-fencing-1";
    const taskId = "task-fencing-1";

    createTestExecution(db, execId, taskId, now);

    // First worker acquires lease with fencing token 1
    const lease1: ExecutionLeaseRecord = {
      id: "lease-first",
      executionId: execId,
      workerId: "worker-first",
      attempt: 1,
      fencingToken: 1,
      queueName: "default",
      status: "active",
      leasedAt: now,
      expiresAt: future,
      lastHeartbeatAt: now,
      releasedAt: null,
      reasonCode: null,
    };

    repo.insertExecutionLease(lease1);

    // Second worker tries with higher fencing token - should fail due to UNIQUE constraint
    const lease2: ExecutionLeaseRecord = {
      id: "lease-second",
      executionId: execId,
      workerId: "worker-second",
      attempt: 1,
      fencingToken: 2,
      queueName: "default",
      status: "active",
      leasedAt: now,
      expiresAt: future,
      lastHeartbeatAt: now,
      releasedAt: null,
      reasonCode: null,
    };

    let secondAcquired = false;
    try {
      repo.insertExecutionLease(lease2);
      secondAcquired = true;
    } catch {
      secondAcquired = false;
    }

    assert.equal(secondAcquired, false, "Second lease acquisition should fail due to UNIQUE constraint");

    // First lease should still be active
    const activeLease = repo.getActiveExecutionLease(execId);
    assert.ok(activeLease, "First lease should still be active");
    assert.equal(activeLease!.workerId, "worker-first", "First worker should own the lease");
    assert.equal(activeLease!.fencingToken, 1, "Fencing token should be 1");
  } finally {
    cleanupPath(workspace);
  }
});

test("concurrent lease acquisition - release and re-acquire", () => {
  const workspace = createTempWorkspace("aa-lease-release-");
  const dbPath = join(workspace, "lease-release.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    // Use dynamic dates - future date relative to when test runs
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
    const past = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    const execId = "exec-release-1";
    const taskId = "task-release-1";

    createTestExecution(db, execId, taskId, now);

    // First worker acquires lease
    const lease1: ExecutionLeaseRecord = {
      id: "lease-original",
      executionId: execId,
      workerId: "worker-first",
      attempt: 1,
      fencingToken: 1,
      queueName: "default",
      status: "active",
      leasedAt: past,
      expiresAt: future,
      lastHeartbeatAt: past,
      releasedAt: null,
      reasonCode: null,
    };

    repo.insertExecutionLease(lease1);

    // Release the lease
    repo.closeExecutionLease("lease-original", now);

    // Verify lease is no longer active
    const activeLease = repo.getActiveExecutionLease(execId);
    assert.equal(activeLease, undefined, "No active lease after release");

    // Second worker should now be able to acquire
    const lease2: ExecutionLeaseRecord = {
      id: "lease-second",
      executionId: execId,
      workerId: "worker-second",
      attempt: 1,
      fencingToken: 2,
      queueName: "default",
      status: "active",
      leasedAt: now,
      expiresAt: future,
      lastHeartbeatAt: now,
      releasedAt: null,
      reasonCode: null,
    };

    repo.insertExecutionLease(lease2);

    const newActiveLease = repo.getActiveExecutionLease(execId);
    assert.ok(newActiveLease, "Second worker should acquire lease after release");
    assert.equal(newActiveLease!.workerId, "worker-second", "Second worker should own the lease");
    assert.equal(newActiveLease!.fencingToken, 2, "Fencing token should be 2");
  } finally {
    cleanupPath(workspace);
  }
});
