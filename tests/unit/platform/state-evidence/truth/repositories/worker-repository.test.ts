import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { WorkerRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/worker-repository.js";
import { TaskRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/task-repository.js";
import { ExecutionRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/execution-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import type { ExecutionTicketRecord, ExecutionLeaseRecord, WorkerSnapshotRecord } from "../../../../../../src/platform/contracts/types/domain.js";

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

test("WorkerRepository upsertWorkerSnapshot inserts new snapshot", () => {
  const workspace = createTempWorkspace("aa-worker-repo-");
  const dbPath = join(workspace, "worker-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const snapshot: WorkerSnapshotRecord = {
      workerId: "worker-1",
      status: "idle",
      repoVersion: "v1.0.0",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "100",
      streamResumeSuccessRate: 0.95,
      credentialRefreshSuccessRate: 1.0,
      sessionConsistencyCheckStatus: "passed",
      sessionConsistencyCheckedAt: now,
      workspaceSyncStatus: "aligned",
      workspaceSyncCheckedAt: now,
      saturation: 0.5,
      activeLeaseCount: 3,
      meanStartupLatencyMs: 150,
      sandboxSuccessRate: 0.98,
      repoCacheHitRate: 0.85,
      capabilitiesJson: '["code_edit"]',
      runningExecutionsJson: '["exec-1"]',
      maxConcurrency: 10,
      queueAffinity: null,
      runtimeInstanceId: null,
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: null,
      memoryMb: null,
      toolBacklogCount: 0,
      currentStepId: null,
      lastProgressAt: null,
      lastHeartbeatAt: now,
      updatedAt: now,
    };

    repo.upsertWorkerSnapshot(snapshot);

    const result = repo.getWorkerSnapshot("worker-1");
    assert.ok(result);
    assert.equal(result.workerId, "worker-1");
    assert.equal(result.status, "idle");
    assert.equal(result.activeLeaseCount, 3);
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkerRepository getWorkerSnapshot returns undefined for non-existent", () => {
  const workspace = createTempWorkspace("aa-worker-repo-");
  const dbPath = join(workspace, "worker-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    const result = repo.getWorkerSnapshot("nonexistent");
    assert.strictEqual(result, undefined);
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkerRepository insertExecutionTicket works", () => {
  const workspace = createTempWorkspace("aa-worker-repo-");
  const dbPath = join(workspace, "worker-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestExecution(db, "exec-ticket-1", "task-ticket-1", now);

    const ticket: ExecutionTicketRecord = {
      id: "ticket-1",
      executionId: "exec-ticket-1",
      taskId: "task-ticket-1",
      priority: "high",
      queueName: "default",
      requiredCapabilitiesJson: "[]",
      dispatchAfter: now,
      attempt: 1,
      status: "pending",
      assignedWorkerId: null,
      leaseId: null,
      claimedAt: null,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    repo.insertExecutionTicket(ticket);

    const result = repo.getExecutionTicket("ticket-1");
    assert.ok(result);
    assert.equal(result.id, "ticket-1");
    assert.equal(result.status, "pending");
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkerRepository insertExecutionTicket rejects non-existent task_id FK", () => {
  const workspace = createTempWorkspace("aa-worker-repo-");
  const dbPath = join(workspace, "worker-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    const now = new Date().toISOString();

    // Attempt to insert ticket with non-existent task_id
    assert.throws(
      () => {
        repo.insertExecutionTicket({
          id: "ticket-fk-task",
          executionId: "nonexistent-exec",
          taskId: "nonexistent-task",
          priority: "high",
          queueName: "default",
          requiredCapabilitiesJson: "[]",
          dispatchAfter: now,
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
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        return message.includes("FOREIGN KEY") || message.includes("constraint");
      },
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkerRepository listPendingExecutionTickets works", () => {
  const workspace = createTempWorkspace("aa-worker-repo-");
  const dbPath = join(workspace, "worker-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    // Use dates in SQLite-compatible format (space separator, no timezone)
    // SQLite's datetime comparison requires consistent format
    const nowDate = new Date(Date.now() - 3600000); // 1 hour ago
    const now = nowDate.toISOString().replace("T", " ").replace("Z", "");
    const pastDate = new Date(Date.now() - 7200000); // 2 hours ago
    const past = pastDate.toISOString().replace("T", " ").replace("Z", "");
    createTestExecution(db, "exec-pending-1", "task-pending-1", now);

    const ticket: ExecutionTicketRecord = {
      id: "ticket-pending-1",
      executionId: "exec-pending-1",
      taskId: "task-pending-1",
      priority: "high",
      queueName: "default",
      requiredCapabilitiesJson: "[]",
      dispatchAfter: past,
      attempt: 1,
      status: "pending",
      assignedWorkerId: null,
      leaseId: null,
      claimedAt: null,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    repo.insertExecutionTicket(ticket);

    const results = repo.listPendingExecutionTickets();
    assert.equal(results.length, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkerRepository insertExecutionLease and getActiveExecutionLease work", () => {
  const workspace = createTempWorkspace("aa-worker-repo-");
  const dbPath = join(workspace, "worker-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    // Use dynamic future dates relative to test execution time
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
    createTestExecution(db, "exec-lease-1", "task-lease-1", now);

    const lease: ExecutionLeaseRecord = {
      id: "lease-1",
      executionId: "exec-lease-1",
      workerId: "worker-1",
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

    repo.insertExecutionLease(lease);

    const result = repo.getActiveExecutionLease("exec-lease-1");
    assert.ok(result);
    assert.equal(result.id, "lease-1");
    assert.equal(result.status, "active");
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkerRepository insertExecutionLease violates primary key constraint throws error", () => {
  const workspace = createTempWorkspace("aa-worker-repo-");
  const dbPath = join(workspace, "worker-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    const now = new Date().toISOString();
    const future = new Date(Date.now() + 3600000).toISOString();
    createTestExecution(db, "exec-lease-dup", "task-lease-dup", now);

    repo.insertExecutionLease({
      id: "lease-dup-id",
      executionId: "exec-lease-dup",
      workerId: "worker-1",
      attempt: 1,
      fencingToken: 1,
      queueName: "default",
      status: "active",
      leasedAt: now,
      expiresAt: future,
      lastHeartbeatAt: now,
      releasedAt: null,
      reasonCode: null,
    });

    assert.throws(() => {
      repo.insertExecutionLease({
        id: "lease-dup-id",
        executionId: "exec-lease-dup",
        workerId: "worker-2",
        attempt: 1,
        fencingToken: 2,
        queueName: "default",
        status: "active",
        leasedAt: now,
        expiresAt: future,
        lastHeartbeatAt: now,
        releasedAt: null,
        reasonCode: null,
      });
    }, /UNIQUE.*lease-dup-id|UNIQUE constraint failed/i);
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkerRepository upsertWorkerSnapshot preserves runtime and registration fields", () => {
  const workspace = createTempWorkspace("aa-worker-repo-");
  const dbPath = join(workspace, "worker-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    repo.upsertWorkerSnapshot({
      workerId: "worker-rich",
      status: "busy",
      placement: "remote",
      isolationLevel: "strict",
      repoVersion: "repo-v2",
      remoteSessionStatus: "connected",
      lastAcknowledgedStreamOffset: "42",
      streamResumeSuccessRate: 0.9,
      credentialRefreshSuccessRate: 0.8,
      sessionConsistencyCheckStatus: "passed",
      sessionConsistencyCheckedAt: now,
      workspaceSyncStatus: "aligned",
      workspaceSyncCheckedAt: now,
      saturation: 0.6,
      activeLeaseCount: 2,
      meanStartupLatencyMs: 150,
      sandboxSuccessRate: 0.99,
      repoCacheHitRate: 0.75,
      registrationVerifiedAt: now,
      registrationChallengeId: "challenge-1",
      capabilitiesJson: "[\"code_edit\"]",
      runningExecutionsJson: "[\"exec-1\"]",
      maxConcurrency: 8,
      queueAffinity: "default",
      runtimeInstanceId: "runtime-1",
      restartedFromRuntimeInstanceId: "runtime-0",
      restartGeneration: 3,
      cpuPct: 12.5,
      memoryMb: 256,
      toolBacklogCount: 4,
      currentStepId: "step-2",
      lastProgressAt: now,
      lastHeartbeatAt: now,
      updatedAt: now,
    });

    const snapshot = repo.getWorkerSnapshot("worker-rich");
    assert.equal(snapshot?.placement, "remote");
    assert.equal(snapshot?.isolationLevel, "strict");
    assert.equal(snapshot?.registrationChallengeId, "challenge-1");
    assert.equal(snapshot?.runtimeInstanceId, "runtime-1");
    assert.equal(snapshot?.restartGeneration, 3);
    assert.equal(snapshot?.toolBacklogCount, 4);
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkerRepository ticket query helpers expose active and dispatchable tickets", () => {
  const workspace = createTempWorkspace("aa-worker-repo-");
  const dbPath = join(workspace, "worker-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const past = "2026-04-14T09:55:00.000Z";
    createTestExecution(db, "exec-ticket-query", "task-ticket-query", now);

    repo.insertExecutionTicket({
      id: "ticket-query-1",
      executionId: "exec-ticket-query",
      taskId: "task-ticket-query",
      priority: "urgent",
      queueName: "default",
      dispatchTarget: "any",
      requiredIsolationLevel: "standard",
      requiredRepoVersion: "repo-v2",
      requiredCapabilitiesJson: "[\"code_edit\"]",
      dispatchAfter: past,
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

    const dispatchable = repo.listDispatchableExecutionTickets(now, "default");
    assert.equal(dispatchable.length, 1);
    assert.equal(dispatchable[0]?.requiredRepoVersion, "repo-v2");

    repo.claimExecutionTicket({
      ticketId: "ticket-query-1",
      assignedWorkerId: "worker-claim",
      leaseId: "lease-claim",
      claimedAt: now,
    });

    const activeTicket = repo.getActiveExecutionTicket("exec-ticket-query", 1);
    const tickets = repo.listExecutionTicketsByStatuses(["pending", "claimed"]);
    assert.equal(activeTicket?.assignedWorkerId, "worker-claim");
    assert.equal(activeTicket?.leaseId, "lease-claim");
    assert.equal(tickets.length, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("WorkerRepository lease query helpers expose latest fencing token and expired leases", () => {
  const workspace = createTempWorkspace("aa-worker-repo-");
  const dbPath = join(workspace, "worker-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const expiredAt = "2026-04-14T09:59:00.000Z";
    const future = "2026-04-14T10:10:00.000Z";
    createTestExecution(db, "exec-lease-query", "task-lease-query", now);

    repo.insertExecutionLease({
      id: "lease-query-1",
      executionId: "exec-lease-query",
      workerId: "worker-1",
      attempt: 1,
      fencingToken: 1,
      queueName: "default",
      status: "expired",
      leasedAt: now,
      expiresAt: expiredAt,
      lastHeartbeatAt: now,
      releasedAt: now,
      reasonCode: "handover",
    });
    repo.insertExecutionLease({
      id: "lease-query-2",
      executionId: "exec-lease-query",
      workerId: "worker-2",
      attempt: 2,
      fencingToken: 2,
      queueName: "default",
      status: "active",
      leasedAt: now,
      expiresAt: future,
      lastHeartbeatAt: now,
      releasedAt: null,
      reasonCode: null,
    });

    repo.renewExecutionLease("lease-query-2", future, now);

    const latestLease = repo.getLatestExecutionLease("exec-lease-query");
    const activeLease = repo.getActiveExecutionLease("exec-lease-query");
    const expiredLeases = repo.listExpiredExecutionLeases(now);

    assert.equal(repo.getLatestFencingToken("exec-lease-query"), 2);
    assert.equal(latestLease?.id, "lease-query-2");
    assert.equal(activeLease?.id, "lease-query-2");
    assert.equal(expiredLeases.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});
