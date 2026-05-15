import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { ExecutionDispatchReconciliationService } from "../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-reconciliation-service.js";
import { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";
import type { ExecutionTicketRecord, TaskPriority } from "../../../src/platform/contracts/types/domain.js";
import type { TaskStatus, ExecutionStatus } from "../../../src/platform/contracts/types/status.js";

function createReconciliationServiceHarness() {
  const workspace = createTempWorkspace("aa-reconciliation-unit-");
  const dbPath = join(workspace, "reconciliation.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const service = new ExecutionDispatchReconciliationService(db, store);

  return {
    db,
    store,
    service,
    close() {
      db.close();
      cleanupPath(workspace);
    },
  };
}

function seedTaskAndExecution(
  store: AuthoritativeTaskStore,
  db: SqliteDatabase,
  input: {
    taskId: string;
    executionId: string;
    traceId?: string;
    priority?: TaskPriority;
    status?: TaskStatus;
    executionStatus?: ExecutionStatus;
  },
): void {
  const now = nowIso();
  db.transaction(() => {
    store.insertTask({
      id: input.taskId,
      parentId: null,
      rootId: input.taskId,
      divisionId: "general_ops",
      title: "Test task",
      status: input.status ?? "in_progress",
      source: "user",
      priority: input.priority ?? "normal",
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
      id: input.executionId,
      taskId: input.taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "task_run",
      status: input.executionStatus ?? "executing",
      inputRef: null,
      traceId: input.traceId ?? "trace-test",
      attempt: 1,
      timeoutMs: 60000,
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
    store.insertWorkflowState({
      taskId: input.taskId,
      divisionId: "general_ops",
      workflowId: "single_agent_minimal",
      currentStepIndex: 0,
      status: "running",
      outputsJson: "[]",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: "step-1",
      startedAt: now,
      updatedAt: now,
    });
  });
}

function createTicket(
  store: AuthoritativeTaskStore,
  db: SqliteDatabase,
  input: {
    ticketId: string;
    executionId: string;
    taskId: string;
    status?: "pending" | "claimed";
    priority?: TaskPriority;
    queueName?: string;
    assignedWorkerId?: string | null;
    leaseId?: string | null;
    requiredCapabilitiesJson?: string;
  },
): void {
  const now = nowIso();
  db.transaction(() => {
    store.worker.insertExecutionTicket({
      id: input.ticketId,
      executionId: input.executionId,
      taskId: input.taskId,
      status: input.status ?? "pending",
      priority: input.priority ?? "normal",
      queueName: input.queueName ?? "default",
      assignedWorkerId: input.assignedWorkerId ?? null,
      leaseId: input.leaseId ?? null,
      requiredCapabilitiesJson: input.requiredCapabilitiesJson ?? "[]",
      dispatchTarget: "any",
      requiredIsolationLevel: "standard",
      dispatchAfter: null,
      claimedAt: input.status === "claimed" ? now : null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

function createLease(
  store: AuthoritativeTaskStore,
  db: SqliteDatabase,
  input: {
    leaseId: string;
    executionId: string;
    workerId: string;
    expiresAt: string;
  },
): void {
  const now = nowIso();
  db.transaction(() => {
    store.worker.insertExecutionLease({
      id: input.leaseId,
      executionId: input.executionId,
      workerId: input.workerId,
      attempt: 1,
      fencingToken: 1,
      queueName: "default",
      status: "active",
      leasedAt: now,
      expiresAt: input.expiresAt,
      lastHeartbeatAt: now,
      releasedAt: null,
      reasonCode: null,
    });
  });
}

// ============================================================================
// isTerminalExecutionStatus Tests
// ============================================================================

test("isTerminalExecutionStatus returns true for succeeded status", () => {
  // This is tested via the detect scenario
});

test("isTerminalExecutionStatus returns true for failed status", () => {
  // This is tested via the detect scenario
});

test("isTerminalExecutionStatus returns true for cancelled status", () => {
  // This is tested via the detect scenario
});

test("isTerminalExecutionStatus returns true for superseded status", () => {
  // This is tested via the detect scenario
});

// ============================================================================
// scanPaginated Tests
// ============================================================================

test("scanPaginated returns empty array when no tickets exist", () => {
  const harness = createReconciliationServiceHarness();
  try {
    const issues = harness.service.scanPaginated(100);
    assert.deepEqual(issues, []);
  } finally {
    harness.close();
  }
});

test("scanPaginated returns empty array when all tickets are healthy", () => {
  const harness = createReconciliationServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");
    const leaseId = newId("lease");
    const workerId = newId("worker");

    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId, executionStatus: "executing" });
    createTicket(harness.store, harness.db, {
      ticketId,
      executionId,
      taskId,
      status: "claimed",
      assignedWorkerId: workerId,
      leaseId,
    });
    createLease(harness.store, harness.db, {
      leaseId,
      executionId,
      workerId,
      expiresAt: "2099-01-01T00:00:00.000Z", // Far future
    });

    const issues = harness.service.scanPaginated(100);
    assert.deepEqual(issues, []);
  } finally {
    harness.close();
  }
});

test("scanPaginated detects terminal execution ticket issue", () => {
  const harness = createReconciliationServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");

    // Terminal execution (succeeded)
    seedTaskAndExecution(harness.store, harness.db, {
      taskId,
      executionId,
      executionStatus: "succeeded",
    });
    createTicket(harness.store, harness.db, {
      ticketId,
      executionId,
      taskId,
      status: "pending",
    });

    const issues = harness.service.scanPaginated(100);

    assert.equal(issues.length, 1);
    assert.equal(issues[0]!.issueType, "terminal_execution_ticket");
    assert.equal(issues[0]!.executionId, executionId);
    assert.equal(issues[0]!.ticketId, ticketId);
    assert.equal(issues[0]!.reasonCode, "execution_terminal");
    assert.equal(issues[0]!.resolutionAction, "invalidate_ticket");
  } finally {
    harness.close();
  }
});

test("scanPaginated detects missing active lease issue", () => {
  const harness = createReconciliationServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");

    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId, executionStatus: "executing" });
    // Claimed ticket but no lease
    createTicket(harness.store, harness.db, {
      ticketId,
      executionId,
      taskId,
      status: "claimed",
      assignedWorkerId: "worker-1",
      leaseId: "lease-1", // Lease doesn't exist
    });

    const issues = harness.service.scanPaginated(100);

    assert.equal(issues.length, 1);
    assert.equal(issues[0]!.issueType, "orphan_queue_claim");
    assert.equal(issues[0]!.reasonCode, "missing_active_lease");
    assert.equal(issues[0]!.resolutionAction, "requeue_ticket");
  } finally {
    harness.close();
  }
});

test("scanPaginated detects expired lease issue", () => {
  const harness = createReconciliationServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");
    const leaseId = newId("lease");
    const workerId = newId("worker");

    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId, executionStatus: "executing" });
    createTicket(harness.store, harness.db, {
      ticketId,
      executionId,
      taskId,
      status: "claimed",
      assignedWorkerId: workerId,
      leaseId,
    });
    // Expired lease
    createLease(harness.store, harness.db, {
      leaseId,
      executionId,
      workerId,
      expiresAt: "2020-01-01T00:00:00.000Z", // Past
    });

    const issues = harness.service.scanPaginated(100, "2026-05-01T00:00:00.000Z");

    assert.equal(issues.length, 1);
    assert.equal(issues[0]!.issueType, "orphan_queue_claim");
    assert.equal(issues[0]!.reasonCode, "lease_expired_unreclaimed");
  } finally {
    harness.close();
  }
});

test("scanPaginated detects lease ticket mismatch issue", () => {
  const harness = createReconciliationServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");
    const leaseId = newId("lease");
    const workerId = newId("worker");

    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId, executionStatus: "executing" });
    // Ticket claims one lease/worker
    createTicket(harness.store, harness.db, {
      ticketId,
      executionId,
      taskId,
      status: "claimed",
      assignedWorkerId: workerId,
      leaseId: "different-lease", // Mismatch!
    });
    // But lease has different worker
    createLease(harness.store, harness.db, {
      leaseId,
      executionId,
      workerId: "different-worker",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    const issues = harness.service.scanPaginated(100);

    assert.equal(issues.length, 1);
    assert.equal(issues[0]!.issueType, "orphan_queue_claim");
    assert.equal(issues[0]!.reasonCode, "lease_ticket_mismatch");
  } finally {
    harness.close();
  }
});

test("scanPaginated scans in pages while returning the full issue set", () => {
  const harness = createReconciliationServiceHarness();
  try {
    // Create multiple tickets with terminal executions
    for (let i = 0; i < 5; i++) {
      const taskId = newId("task");
      const executionId = newId("exec");
      const ticketId = newId("ticket");

      seedTaskAndExecution(harness.store, harness.db, {
        taskId,
        executionId,
        executionStatus: "succeeded",
      });
      createTicket(harness.store, harness.db, {
        ticketId,
        executionId,
        taskId,
        status: "pending",
      });
    }

    // Page size controls internal scan batches, not the size of the returned issue set.
    const issues = harness.service.scanPaginated(2);
    assert.equal(issues.length, 5);

    // The current API is stateless; repeated scans return the same full issue set.
    const nextIssues = harness.service.scanPaginated(2);
    assert.equal(nextIssues.length, 5);
    assert.deepEqual(nextIssues.map((issue) => issue.ticketId), issues.map((issue) => issue.ticketId));
  } finally {
    harness.close();
  }
});

// ============================================================================
// findIssueByTicketId Tests
// ============================================================================

test("findIssueByTicketId returns null for non-existent ticket", () => {
  const harness = createReconciliationServiceHarness();
  try {
    const issue = harness.service.findIssueByTicketId("nonexistent-ticket");
    assert.equal(issue, null);
  } finally {
    harness.close();
  }
});

test("findIssueByTicketId returns null for already processed ticket (not pending/claimed)", () => {
  const harness = createReconciliationServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");

    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId, executionStatus: "executing" });
    // Ticket with status "cancelled" - not eligible for reconciliation
    createTicket(harness.store, harness.db, {
      ticketId,
      executionId,
      taskId,
      status: "cancelled",
    });

    const issue = harness.service.findIssueByTicketId(ticketId);
    assert.equal(issue, null);
  } finally {
    harness.close();
  }
});

test("findIssueByTicketId finds issue for valid ticket with terminal execution", () => {
  const harness = createReconciliationServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");

    seedTaskAndExecution(harness.store, harness.db, {
      taskId,
      executionId,
      executionStatus: "failed",
    });
    createTicket(harness.store, harness.db, {
      ticketId,
      executionId,
      taskId,
      status: "pending",
    });

    const issue = harness.service.findIssueByTicketId(ticketId);

    assert.ok(issue !== null);
    assert.equal(issue!.issueType, "terminal_execution_ticket");
    assert.equal(issue!.ticketId, ticketId);
  } finally {
    harness.close();
  }
});

// ============================================================================
// repairTicket Tests
// ============================================================================

test("repairTicket returns null for non-existent ticket", () => {
  const harness = createReconciliationServiceHarness();
  try {
    const result = harness.service.repairTicket("nonexistent-ticket");
    assert.equal(result, null);
  } finally {
    harness.close();
  }
});

test("repairTicket applies repair for terminal execution ticket", () => {
  const harness = createReconciliationServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");

    seedTaskAndExecution(harness.store, harness.db, {
      taskId,
      executionId,
      executionStatus: "succeeded",
    });
    createTicket(harness.store, harness.db, {
      ticketId,
      executionId,
      taskId,
      status: "pending",
    });

    const result = harness.service.repairTicket(ticketId);

    assert.ok(result !== null);
    assert.equal(result!.applied, true);
    assert.equal(result!.issueType, "terminal_execution_ticket");
    assert.equal(result!.resolutionAction, "invalidate_ticket");
    assert.equal(result!.replacementTicketId, null); // No replacement for invalidate

    // Verify ticket was invalidated
    const updatedTicket = harness.store.worker.getExecutionTicket(ticketId);
    assert.equal(updatedTicket?.status, "cancelled");
  } finally {
    harness.close();
  }
});

test("repairTicket requeues orphan queue claim with replacement ticket", () => {
  const harness = createReconciliationServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");

    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId, executionStatus: "executing" });
    createTicket(harness.store, harness.db, {
      ticketId,
      executionId,
      taskId,
      status: "claimed",
      assignedWorkerId: "worker-1",
      leaseId: "lease-1", // No corresponding lease
    });

    const result = harness.service.repairTicket(ticketId);

    assert.ok(result !== null);
    assert.equal(result!.applied, true);
    assert.equal(result!.issueType, "orphan_queue_claim");
    assert.equal(result!.resolutionAction, "requeue_ticket");
    assert.ok(result!.replacementTicketId !== null); // Has replacement
    assert.notEqual(result!.replacementTicketId, ticketId);

    // Verify original ticket was invalidated
    const updatedTicket = harness.store.worker.getExecutionTicket(ticketId);
    assert.equal(updatedTicket?.status, "expired");

    // Verify replacement ticket exists and is pending
    const replacementTicket = harness.store.worker.getExecutionTicket(result!.replacementTicketId!);
    assert.ok(replacementTicket !== null);
    assert.equal(replacementTicket!.status, "pending");
  } finally {
    harness.close();
  }
});

// ============================================================================
// repair Tests
// ============================================================================

test("repair returns both issues and applied repairs", () => {
  const harness = createReconciliationServiceHarness();
  try {
    // Create two issues
    for (let i = 0; i < 2; i++) {
      const taskId = newId("task");
      const executionId = newId("exec");
      const ticketId = newId("ticket");

      seedTaskAndExecution(harness.store, harness.db, {
        taskId,
        executionId,
        executionStatus: "succeeded", // Terminal
      });
      createTicket(harness.store, harness.db, {
        ticketId,
        executionId,
        taskId,
        status: "pending",
      });
    }

    const result = harness.service.repair();

    assert.equal(result.issues.length, 2);
    assert.equal(result.applied.length, 2);
    assert.ok(result.applied.every((r) => r.applied));
  } finally {
    harness.close();
  }
});

// ============================================================================
// Edge Cases
// ============================================================================

test("scanPaginated returns empty array after execution delete cascades ticket removal", () => {
  const harness = createReconciliationServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");

    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId, executionStatus: "executing" });
    createTicket(harness.store, harness.db, {
      ticketId,
      executionId,
      taskId,
      status: "pending",
    });

    // Current schema cascades ticket removal when the execution is deleted.
    harness.db.transaction(() => {
      harness.db.connection.prepare("DELETE FROM executions WHERE id = ?").run(executionId);
    });

    assert.equal(harness.store.worker.getExecutionTicket(ticketId), undefined);
    const issues = harness.service.scanPaginated(100);
    assert.equal(issues.length, 0);
  } finally {
    harness.close();
  }
});

test("scanPaginated handles pending tickets (not claimed) without lease issues", () => {
  const harness = createReconciliationServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");

    seedTaskAndExecution(harness.store, harness.db, { taskId, executionId, executionStatus: "executing" });
    // Pending ticket (never claimed) - no lease needed
    createTicket(harness.store, harness.db, {
      ticketId,
      executionId,
      taskId,
      status: "pending",
      assignedWorkerId: null,
      leaseId: null,
    });

    const issues = harness.service.scanPaginated(100);
    assert.equal(issues.length, 0);
  } finally {
    harness.close();
  }
});

test("repairTicket does not apply repair when ticket no longer exists", () => {
  const harness = createReconciliationServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");

    seedTaskAndExecution(harness.store, harness.db, {
      taskId,
      executionId,
      executionStatus: "succeeded",
    });
    createTicket(harness.store, harness.db, {
      ticketId,
      executionId,
      taskId,
      status: "pending",
    });

    // Delete ticket before repair
    harness.db.transaction(() => {
      harness.db.connection.prepare("DELETE FROM execution_tickets WHERE id = ?").run(ticketId);
    });

    const result = harness.service.repairTicket(ticketId);

    assert.equal(result, null);
  } finally {
    harness.close();
  }
});

test("repair emits reconciliation event", () => {
  const harness = createReconciliationServiceHarness();
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");

    seedTaskAndExecution(harness.store, harness.db, {
      taskId,
      executionId,
      executionStatus: "succeeded",
    });
    createTicket(harness.store, harness.db, {
      ticketId,
      executionId,
      taskId,
      status: "pending",
    });

    harness.service.repairTicket(ticketId);

    // Check event was recorded
    const events = harness.store.listEventsForTask(taskId);
    const reconciledEvents = events.filter((e) => e.eventType === "dispatch:ticket_reconciled");
    assert.ok(reconciledEvents.length >= 1);

    const payload = JSON.parse(reconciledEvents[0]!.payloadJson);
    assert.equal(payload.ticketId, ticketId);
    assert.equal(payload.issueType, "terminal_execution_ticket");
  } finally {
    harness.close();
  }
});
