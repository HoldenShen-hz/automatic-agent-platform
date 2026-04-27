import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ExecutionTicketRepository } from "../../../../../../../src/platform/state-evidence/truth/sqlite/repositories/execution-ticket-repository.js";
import { TaskRepository } from "../../../../../../../src/platform/state-evidence/truth/sqlite/repositories/task-repository.js";
import { ExecutionRepository } from "../../../../../../../src/platform/state-evidence/truth/sqlite/repositories/execution-repository.js";
import { SqliteDatabase } from "../../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../../helpers/fs.js";
import type { ExecutionTicketRecord, ExecutionLeaseRecord, WorkerRegistrationChallengeRecord } from "../../../../../../../src/platform/contracts/types/domain.js";

function createTestTask(
  db: SqliteDatabase,
  taskId: string,
  now = "2026-04-14T10:00:00.000Z",
): void {
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

function createTestExecution(
  db: SqliteDatabase,
  execId: string,
  taskId: string,
  now = "2026-04-14T10:00:00.000Z",
): void {
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

test("ExecutionTicketRepository insertWorkerRegistrationChallenge works", () => {
  const workspace = createTempWorkspace("aa-ticket-repo-");
  const dbPath = join(workspace, "ticket.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    const challenge: WorkerRegistrationChallengeRecord = {
      id: "challenge-1",
      workerId: "worker-1",
      challengeTokenHash: "hash-abc123",
      allowedCapabilitiesJson: '["code_edit"]',
      expiresAt: now,
      usedAt: null,
      createdAt: now,
    };

    repo.insertWorkerRegistrationChallenge(challenge);

    const result = repo.getWorkerRegistrationChallenge("challenge-1");
    assert.ok(result);
    assert.equal(result.id, "challenge-1");
    assert.equal(result.workerId, "worker-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository getWorkerRegistrationChallenge returns undefined for non-existent", () => {
  const workspace = createTempWorkspace("aa-ticket-repo-");
  const dbPath = join(workspace, "ticket.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);

    const result = repo.getWorkerRegistrationChallenge("nonexistent");
    assert.strictEqual(result, undefined);
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository consumeWorkerRegistrationChallenge updates used_at", () => {
  const workspace = createTempWorkspace("aa-ticket-repo-");
  const dbPath = join(workspace, "ticket.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";
    const usedAt = "2026-04-14T10:05:00.000Z";

    repo.insertWorkerRegistrationChallenge({
      id: "challenge-consume-1",
      workerId: "worker-1",
      challengeTokenHash: "hash-xyz",
      allowedCapabilitiesJson: "[]",
      expiresAt: now,
      usedAt: null,
      createdAt: now,
    });

    repo.consumeWorkerRegistrationChallenge("challenge-consume-1", usedAt);

    const result = repo.getWorkerRegistrationChallenge("challenge-consume-1");
    assert.ok(result);
    assert.equal(result.usedAt, usedAt);
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository insertExecutionTicket and getExecutionTicket work", () => {
  const workspace = createTempWorkspace("aa-ticket-repo-");
  const dbPath = join(workspace, "ticket.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestExecution(db, "exec-ticket-1", "task-ticket-1", now);

    const ticket: ExecutionTicketRecord = {
      id: "ticket-get-1",
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

    const result = repo.getExecutionTicket("ticket-get-1");
    assert.ok(result);
    assert.equal(result.id, "ticket-get-1");
    assert.equal(result.status, "pending");
    assert.equal(result.priority, "high");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository claimExecutionTicket updates status to claimed", () => {
  const workspace = createTempWorkspace("aa-ticket-repo-");
  const dbPath = join(workspace, "ticket.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestExecution(db, "exec-claim-1", "task-claim-1", now);

    repo.insertExecutionTicket({
      id: "ticket-claim-1",
      executionId: "exec-claim-1",
      taskId: "task-claim-1",
      priority: "normal",
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

    repo.claimExecutionTicket("ticket-claim-1", "worker-1", now);

    const result = repo.getExecutionTicket("ticket-claim-1");
    assert.ok(result);
    assert.equal(result.status, "claimed");
    assert.equal(result.assignedWorkerId, "worker-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository consumeExecutionTicket updates status to consumed", () => {
  const workspace = createTempWorkspace("aa-ticket-repo-");
  const dbPath = join(workspace, "ticket.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestExecution(db, "exec-consume-1", "task-consume-1", now);

    repo.insertExecutionTicket({
      id: "ticket-consume-1",
      executionId: "exec-consume-1",
      taskId: "task-consume-1",
      priority: "normal",
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

    repo.consumeExecutionTicket("ticket-consume-1", now);

    const result = repo.getExecutionTicket("ticket-consume-1");
    assert.ok(result);
    assert.equal(result.status, "consumed");
    assert.ok(result.consumedAt);
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository invalidateExecutionTicket updates status to cancelled", () => {
  const workspace = createTempWorkspace("aa-ticket-repo-");
  const dbPath = join(workspace, "ticket.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";

    createTestExecution(db, "exec-invalidate-1", "task-invalidate-1", now);

    repo.insertExecutionTicket({
      id: "ticket-invalidate-1",
      executionId: "exec-invalidate-1",
      taskId: "task-invalidate-1",
      priority: "normal",
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

    repo.invalidateExecutionTicket("ticket-invalidate-1", now);

    const result = repo.getExecutionTicket("ticket-invalidate-1");
    assert.ok(result);
    assert.equal(result.status, "cancelled");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository listPendingExecutionTickets returns pending tickets", () => {
  const workspace = createTempWorkspace("aa-ticket-repo-");
  const dbPath = join(workspace, "ticket.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";
    const past = "2026-04-14T09:00:00.000Z";

    createTestExecution(db, "exec-pending-1", "task-pending-1", now);
    createTestExecution(db, "exec-pending-2", "task-pending-2", now);

    repo.insertExecutionTicket({
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
    });

    repo.insertExecutionTicket({
      id: "ticket-pending-2",
      executionId: "exec-pending-2",
      taskId: "task-pending-2",
      priority: "normal",
      queueName: "default",
      requiredCapabilitiesJson: "[]",
      dispatchAfter: past,
      attempt: 1,
      status: "consumed", // already consumed
      assignedWorkerId: null,
      leaseId: null,
      claimedAt: null,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const results = repo.listPendingExecutionTickets();
    assert.equal(results.length, 1);
    assert.equal(results[0].id, "ticket-pending-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository insertExecutionLease and getExecutionLease work", () => {
  const workspace = createTempWorkspace("aa-ticket-repo-");
  const dbPath = join(workspace, "ticket.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";
    const future = "2026-04-14T11:00:00.000Z";

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

    const result = repo.getExecutionLease("lease-1");
    assert.ok(result);
    assert.equal(result.id, "lease-1");
    assert.equal(result.status, "active");
    assert.equal(result.fencingToken, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository getActiveExecutionLease returns active lease", () => {
  const workspace = createTempWorkspace("aa-ticket-repo-");
  const dbPath = join(workspace, "ticket.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";
    const future = "2026-04-14T11:00:00.000Z";

    createTestExecution(db, "exec-active-lease-1", "task-active-lease-1", now);

    repo.insertExecutionLease({
      id: "lease-active-1",
      executionId: "exec-active-lease-1",
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

    const result = repo.getActiveExecutionLease("exec-active-lease-1");
    assert.ok(result);
    assert.equal(result.status, "active");
    assert.equal(result.id, "lease-active-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository listExpiredExecutionLeases returns expired leases", () => {
  const workspace = createTempWorkspace("aa-ticket-repo-");
  const dbPath = join(workspace, "ticket.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";
    const past = "2026-04-14T09:00:00.000Z"; // expired

    createTestExecution(db, "exec-expired-1", "task-expired-1", now);

    repo.insertExecutionLease({
      id: "lease-expired-1",
      executionId: "exec-expired-1",
      workerId: "worker-1",
      attempt: 1,
      fencingToken: 1,
      queueName: "default",
      status: "active",
      leasedAt: past,
      expiresAt: past, // already expired
      lastHeartbeatAt: past,
      releasedAt: null,
      reasonCode: null,
    });

    const results = repo.listExpiredExecutionLeases(now);
    assert.equal(results.length, 1);
    assert.equal(results[0].id, "lease-expired-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository getLatestFencingToken returns max token", () => {
  const workspace = createTempWorkspace("aa-ticket-repo-");
  const dbPath = join(workspace, "ticket.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);
    const now = "2026-04-14T10:00:00.000Z";
    const future = "2026-04-14T11:00:00.000Z";

    // Use different execution IDs since leases may have unique constraints
    createTestExecution(db, "exec-fencing-1", "task-fencing-1", now);
    createTestExecution(db, "exec-fencing-2", "task-fencing-2", now);

    repo.insertExecutionLease({
      id: "lease-fencing-1",
      executionId: "exec-fencing-1",
      workerId: "worker-1",
      attempt: 1,
      fencingToken: 1,
      queueName: "default",
      status: "released",
      leasedAt: now,
      expiresAt: now,
      lastHeartbeatAt: now,
      releasedAt: now,
      reasonCode: "completed",
    });

    repo.insertExecutionLease({
      id: "lease-fencing-2",
      executionId: "exec-fencing-2",
      workerId: "worker-2",
      attempt: 2,
      fencingToken: 5, // highest
      queueName: "default",
      status: "active",
      leasedAt: now,
      expiresAt: future,
      lastHeartbeatAt: now,
      releasedAt: null,
      reasonCode: null,
    });

    const token = repo.getLatestFencingToken("exec-fencing-2");
    assert.equal(token, 5);
  } finally {
    cleanupPath(workspace);
  }
});
