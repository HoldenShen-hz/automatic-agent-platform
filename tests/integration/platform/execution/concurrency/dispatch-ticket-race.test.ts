/**
 * Dispatch Ticket Race Test - Verifies that only one worker can claim
 * the same execution ticket under concurrent contention.
 *
 * This test validates:
 * - Multiple workers racing to claim the same ticket → only one succeeds
 * - Claimed ticket status changes to 'claimed'
 * - Other workers receive no lease
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { WorkerRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/worker-repository.js";
import { TaskRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/task-repository.js";
import { ExecutionRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/execution-repository.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import type { ExecutionTicketRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createTestTask(db: SqliteDatabase, taskId: string, now: string): void {
  const taskRepo = new TaskRepository(db.connection);
  taskRepo.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general-ops",
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

test("concurrent ticket claim - only first claim wins", () => {
  const workspace = createTempWorkspace("aa-ticket-race-");
  const dbPath = join(workspace, "ticket-race.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const past = "2020-01-01T00:00:00.000Z";
    const execId = "exec-ticket-race-1";
    const taskId = "task-ticket-race-1";

    createTestExecution(db, execId, taskId, now);

    // Create a pending ticket
    const ticket: ExecutionTicketRecord = {
      id: "ticket-shared",
      executionId: execId,
      taskId,
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

    // Simulate 4 workers claiming - all will call UPDATE but only first wins
    // The claimExecutionTicket doesn't throw - it just silently skip if not pending
    const workerIds = ["worker-a", "worker-b", "worker-c", "worker-d"];

    for (const workerId of workerIds) {
      repo.claimExecutionTicket("ticket-shared", workerId, now);
    }

    // All 4 calls succeed (no exception) but only first actually changes the record
    // Verify the ticket is claimed
    const claimedTicket = repo.getExecutionTicket("ticket-shared");
    assert.ok(claimedTicket, "Ticket should exist");
    assert.equal(claimedTicket!.status, "claimed", "Ticket status should be 'claimed'");

    // The first worker in the loop (worker-a) wins
    assert.ok(claimedTicket!.assignedWorkerId, "Assigned worker should be set");
    assert.equal(claimedTicket!.assignedWorkerId, "worker-a", "First worker should own the claim");
  } finally {
    cleanupPath(workspace);
  }
});

test("concurrent ticket claim - second claim silently ignored", () => {
  const workspace = createTempWorkspace("aa-ticket-second-");
  const dbPath = join(workspace, "ticket-second.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const past = "2020-01-01T00:00:00.000Z";
    const execId = "exec-ticket-second-1";
    const taskId = "task-ticket-second-1";

    createTestExecution(db, execId, taskId, now);

    // Create a pending ticket
    const ticket: ExecutionTicketRecord = {
      id: "ticket-second",
      executionId: execId,
      taskId,
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

    // First worker claims successfully
    repo.claimExecutionTicket("ticket-second", "worker-first", now);

    // Second worker calls claim - it doesn't throw but silently ignores since status is no longer 'pending'
    repo.claimExecutionTicket("ticket-second", "worker-second", now);

    // Verify ticket still belongs to first worker
    const claimedTicket = repo.getExecutionTicket("ticket-second");
    assert.equal(claimedTicket!.assignedWorkerId, "worker-first", "First worker should still own the claim");
    assert.equal(claimedTicket!.status, "claimed", "Status should still be claimed");
  } finally {
    cleanupPath(workspace);
  }
});

test("concurrent ticket claim - multiple tickets each claimed by different workers", () => {
  const workspace = createTempWorkspace("aa-ticket-multi-");
  const dbPath = join(workspace, "ticket-multi.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new WorkerRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const past = "2020-01-01T00:00:00.000Z";

    // Create 3 executions with tickets
    for (let i = 1; i <= 3; i++) {
      const execId = `exec-multi-${i}`;
      const taskId = `task-multi-${i}`;
      createTestExecution(db, execId, taskId, now);

      const ticket: ExecutionTicketRecord = {
        id: `ticket-multi-${i}`,
        executionId: execId,
        taskId,
        priority: "normal",
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
    }

    // Each ticket should be claimable by a different worker
    for (let i = 1; i <= 3; i++) {
      repo.claimExecutionTicket(`ticket-multi-${i}`, `worker-${i}`, now);
    }

    // Verify all tickets are claimed by different workers
    for (let i = 1; i <= 3; i++) {
      const ticket = repo.getExecutionTicket(`ticket-multi-${i}`);
      assert.equal(ticket!.status, "claimed", `Ticket ${i} should be claimed`);
      assert.equal(ticket!.assignedWorkerId, `worker-${i}`, `Worker ${i} should own ticket ${i}`);
    }
  } finally {
    cleanupPath(workspace);
  }
});
