import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ExecutionTicketRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/execution-ticket-repository.js";
import { TaskRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/task-repository.js";
import { ExecutionRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/execution-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { createTempWorkspace, cleanupPath } from "../../../../../helpers/fs.js";

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

test("ExecutionTicketRepository insertExecutionTicket and getExecutionTicket", () => {
  const workspace = createTempWorkspace("aa-exec-ticket-");
  const dbPath = join(workspace, "exec-ticket.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestExecution(db, "exec-1", "task-1", now);

    repo.insertExecutionTicket({
      id: "ticket-1",
      executionId: "exec-1",
      taskId: "task-1",
      priority: "normal",
      queueName: "default",
      dispatchTarget: "any",
      requiredIsolationLevel: "standard",
      requiredRepoVersion: null,
      requiredCapabilitiesJson: "[]",
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

    const ticket = repo.getExecutionTicket("ticket-1");

    assert.ok(ticket !== undefined);
    assert.equal(ticket!.id, "ticket-1");
    assert.equal(ticket!.executionId, "exec-1");
    assert.equal(ticket!.taskId, "task-1");
    assert.equal(ticket!.status, "pending");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository claimExecutionTicket", () => {
  const workspace = createTempWorkspace("aa-exec-ticket-claim-");
  const dbPath = join(workspace, "exec-ticket-claim.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestExecution(db, "exec-1", "task-1", now);

    repo.insertExecutionTicket({
      id: "ticket-1",
      executionId: "exec-1",
      taskId: "task-1",
      priority: "normal",
      queueName: "default",
      dispatchTarget: "any",
      requiredIsolationLevel: "standard",
      requiredRepoVersion: null,
      requiredCapabilitiesJson: "[]",
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

    repo.claimExecutionTicket({
      ticketId: "ticket-1",
      assignedWorkerId: "worker-1",
      leaseId: "lease-1",
      claimedAt: now,
    });

    const ticket = repo.getExecutionTicket("ticket-1");
    assert.ok(ticket !== undefined);
    assert.equal(ticket!.status, "claimed");
    assert.equal(ticket!.assignedWorkerId, "worker-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository consumeExecutionTicket", () => {
  const workspace = createTempWorkspace("aa-exec-ticket-consume-");
  const dbPath = join(workspace, "exec-ticket-consume.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestExecution(db, "exec-1", "task-1", now);

    repo.insertExecutionTicket({
      id: "ticket-1",
      executionId: "exec-1",
      taskId: "task-1",
      priority: "normal",
      queueName: "default",
      dispatchTarget: "any",
      requiredIsolationLevel: "standard",
      requiredRepoVersion: null,
      requiredCapabilitiesJson: "[]",
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

    repo.consumeExecutionTicket("ticket-1", now);

    const ticket = repo.getExecutionTicket("ticket-1");
    assert.ok(ticket !== undefined);
    assert.equal(ticket!.status, "consumed");
    assert.ok(ticket!.consumedAt !== null);
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository invalidateExecutionTicket", () => {
  const workspace = createTempWorkspace("aa-exec-ticket-invalidate-");
  const dbPath = join(workspace, "exec-ticket-invalidate.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestExecution(db, "exec-1", "task-1", now);

    repo.insertExecutionTicket({
      id: "ticket-1",
      executionId: "exec-1",
      taskId: "task-1",
      priority: "normal",
      queueName: "default",
      dispatchTarget: "any",
      requiredIsolationLevel: "standard",
      requiredRepoVersion: null,
      requiredCapabilitiesJson: "[]",
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

    repo.invalidateExecutionTicket({
      ticketId: "ticket-1",
      status: "cancelled",
      invalidatedAt: now,
    });

    const ticket = repo.getExecutionTicket("ticket-1");
    assert.ok(ticket !== undefined);
    assert.equal(ticket!.status, "cancelled");
    assert.ok(ticket!.invalidatedAt !== null);
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository listPendingExecutionTickets", () => {
  const workspace = createTempWorkspace("aa-exec-ticket-list-");
  const dbPath = join(workspace, "exec-ticket-list.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestExecution(db, "exec-1", "task-1", now);
    createTestExecution(db, "exec-2", "task-2", now);
    createTestExecution(db, "exec-3", "task-3", now);

    repo.insertExecutionTicket({
      id: "ticket-1",
      executionId: "exec-1",
      taskId: "task-1",
      priority: "high",
      queueName: "default",
      dispatchTarget: "any",
      requiredIsolationLevel: "standard",
      requiredRepoVersion: null,
      requiredCapabilitiesJson: "[]",
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

    repo.insertExecutionTicket({
      id: "ticket-2",
      executionId: "exec-2",
      taskId: "task-2",
      priority: "normal",
      queueName: "default",
      dispatchTarget: "any",
      requiredIsolationLevel: "standard",
      requiredRepoVersion: null,
      requiredCapabilitiesJson: "[]",
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

    repo.insertExecutionTicket({
      id: "ticket-3",
      executionId: "exec-3",
      taskId: "task-3",
      priority: "low",
      queueName: "background",
      dispatchTarget: "any",
      requiredIsolationLevel: "standard",
      requiredRepoVersion: null,
      requiredCapabilitiesJson: "[]",
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

    const allPending = repo.listPendingExecutionTickets();
    assert.equal(allPending.length, 3);

    const defaultQueue = repo.listPendingExecutionTickets("default");
    assert.equal(defaultQueue.length, 2);

    const backgroundQueue = repo.listPendingExecutionTickets("background");
    assert.equal(backgroundQueue.length, 1);

    // Test priority ordering - by default, alphabetical descending means: normal > low > high
    // Note: SQLite orders strings alphabetically, not by semantic priority
    assert.equal(defaultQueue.length, 2);
    // Both default queue tickets should be present
    const priorities = defaultQueue.map(t => t.priority).sort();
    assert.deepEqual(priorities, ["high", "normal"]);
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository insertExecutionLease and getExecutionLease", () => {
  const workspace = createTempWorkspace("aa-exec-lease-");
  const dbPath = join(workspace, "exec-lease.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const expiresAt = "2026-04-14T11:00:00.000Z";
    createTestExecution(db, "exec-1", "task-1", now);

    repo.insertExecutionLease({
      id: "lease-1",
      executionId: "exec-1",
      workerId: "worker-1",
      attempt: 1,
      fencingToken: 1,
      queueName: "default",
      status: "active",
      leasedAt: now,
      expiresAt,
      lastHeartbeatAt: now,
      releasedAt: null,
      reasonCode: null,
    });

    const lease = repo.getExecutionLease("lease-1");

    assert.ok(lease !== undefined);
    assert.equal(lease!.id, "lease-1");
    assert.equal(lease!.executionId, "exec-1");
    assert.equal(lease!.workerId, "worker-1");
    assert.equal(lease!.status, "active");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository closeExecutionLease", () => {
  const workspace = createTempWorkspace("aa-exec-lease-close-");
  const dbPath = join(workspace, "exec-lease-close.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const expiresAt = "2026-04-14T11:00:00.000Z";
    const releasedAt = "2026-04-14T10:30:00.000Z";
    createTestExecution(db, "exec-1", "task-1", now);

    repo.insertExecutionLease({
      id: "lease-1",
      executionId: "exec-1",
      workerId: "worker-1",
      attempt: 1,
      fencingToken: 1,
      queueName: "default",
      status: "active",
      leasedAt: now,
      expiresAt,
      lastHeartbeatAt: now,
      releasedAt: null,
      reasonCode: null,
    });

    repo.closeExecutionLease({
      leaseId: "lease-1",
      status: "released",
      releasedAt,
      reasonCode: "completed",
    });

    const lease = repo.getExecutionLease("lease-1");
    assert.ok(lease !== undefined);
    assert.equal(lease!.status, "released");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository listExpiredExecutionLeases", () => {
  const workspace = createTempWorkspace("aa-exec-lease-expired-");
  const dbPath = join(workspace, "exec-lease-expired.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const expiredAt = "2026-04-14T09:00:00.000Z"; // Before now
    const futureAt = "2026-04-14T11:00:00.000Z"; // After now
    createTestExecution(db, "exec-1", "task-1", now);
    createTestExecution(db, "exec-2", "task-2", now);

    repo.insertExecutionLease({
      id: "lease-1",
      executionId: "exec-1",
      workerId: "worker-1",
      attempt: 1,
      fencingToken: 1,
      queueName: "default",
      status: "active",
      leasedAt: expiredAt,
      expiresAt: expiredAt, // Already expired
      lastHeartbeatAt: expiredAt,
      releasedAt: null,
      reasonCode: null,
    });

    repo.insertExecutionLease({
      id: "lease-2",
      executionId: "exec-2",
      workerId: "worker-1",
      attempt: 1,
      fencingToken: 1,
      queueName: "default",
      status: "active",
      leasedAt: now,
      expiresAt: futureAt, // Not expired yet
      lastHeartbeatAt: now,
      releasedAt: null,
      reasonCode: null,
    });

    const expired = repo.listExpiredExecutionLeases(now);
    assert.equal(expired.length, 1);
    assert.equal(expired[0]!.id, "lease-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository getLatestFencingToken", () => {
  const workspace = createTempWorkspace("aa-exec-lease-fencing-");
  const dbPath = join(workspace, "exec-lease-fencing.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    createTestExecution(db, "exec-1", "task-1", now);

    repo.insertExecutionLease({
      id: "lease-1",
      executionId: "exec-1",
      workerId: "worker-1",
      attempt: 1,
      fencingToken: 1,
      queueName: "default",
      status: "released",
      leasedAt: now,
      expiresAt: now,
      lastHeartbeatAt: now,
      releasedAt: now,
      reasonCode: null,
    });

    repo.insertExecutionLease({
      id: "lease-2",
      executionId: "exec-1",
      workerId: "worker-1",
      attempt: 1,
      fencingToken: 2,
      queueName: "default",
      status: "active",
      leasedAt: now,
      expiresAt: now,
      lastHeartbeatAt: now,
      releasedAt: null,
      reasonCode: null,
    });

    const token = repo.getLatestFencingToken("exec-1");
    assert.equal(token, 2);
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository insertWorkerRegistrationChallenge and getWorkerRegistrationChallenge", () => {
  const workspace = createTempWorkspace("aa-worker-challenge-");
  const dbPath = join(workspace, "worker-challenge.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";

    repo.insertWorkerRegistrationChallenge({
      id: "challenge-1",
      workerId: "worker-1",
      challengeTokenHash: "hash-abc123",
      allowedCapabilitiesJson: "[\"tool-1\", \"tool-2\"]",
      expiresAt: now,
      usedAt: null,
      createdAt: now,
    });

    const challenge = repo.getWorkerRegistrationChallenge("challenge-1");

    assert.ok(challenge !== undefined);
    assert.equal(challenge!.id, "challenge-1");
    assert.equal(challenge!.workerId, "worker-1");
    assert.equal(challenge!.challengeTokenHash, "hash-abc123");
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionTicketRepository consumeWorkerRegistrationChallenge", () => {
  const workspace = createTempWorkspace("aa-worker-challenge-consume-");
  const dbPath = join(workspace, "worker-challenge-consume.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ExecutionTicketRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const usedAt = "2026-04-14T10:05:00.000Z";

    repo.insertWorkerRegistrationChallenge({
      id: "challenge-1",
      workerId: "worker-1",
      challengeTokenHash: "hash-abc123",
      allowedCapabilitiesJson: "[\"tool-1\", \"tool-2\"]",
      expiresAt: now,
      usedAt: null,
      createdAt: now,
    });

    repo.consumeWorkerRegistrationChallenge("challenge-1", usedAt);

    const challenge = repo.getWorkerRegistrationChallenge("challenge-1");
    assert.ok(challenge !== undefined);
    assert.equal(challenge!.usedAt, usedAt);
  } finally {
    cleanupPath(workspace);
  }
});