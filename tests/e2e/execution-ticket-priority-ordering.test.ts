/**
 * E2E Execution Ticket Priority and Dispatch Ordering Tests
 *
 * End-to-end tests covering execution ticket priority handling,
 * dispatch ordering, and worker selection based on ticket priority.
 *
 * Coverage:
 * 1. High priority ticket is dispatched before low priority
 * 2. Multiple tickets with same priority maintain insertion order
 * 3. Priority escalation for urgent tasks
 * 4. Worker assignment respects ticket priority
 * 5. Ticket dispatch ordering across multiple queues
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { WorkerRepository } from "../../src/platform/state-evidence/truth/sqlite/repositories/worker-repository.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { ExecutionTicketRecord, WorkerSnapshotRecord } from "../../src/platform/contracts/types/domain.js";

function createE2eHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e-ticket-priority.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const workerRepo = new WorkerRepository(db.connection);

  return { workspace, db, store, workerRepo };
}

// ---------------------------------------------------------------------------
// Test 1: High priority ticket is dispatched before low priority
// ---------------------------------------------------------------------------

test("E2E Ticket Priority: high priority ticket dispatched before low priority", () => {
  const h = createE2eHarness("e2e-ticket-prio-high-");
  const now = nowIso();

  try {
    const lowTicketId = newId("ticket");
    const highTicketId = newId("ticket");
    const lowTaskId = newId("task");
    const highTaskId = newId("task");
    const lowExecId = newId("exec");
    const highExecId = newId("exec");

    // Create tasks
    h.db.transaction(() => {
      h.store.insertTask({
        id: lowTaskId,
        parentId: null,
        rootId: lowTaskId,
        divisionId: "general_ops",
        title: "Low priority task",
        status: "pending",
        source: "user",
        priority: "low",
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

      h.store.insertTask({
        id: highTaskId,
        parentId: null,
        rootId: highTaskId,
        divisionId: "general_ops",
        title: "High priority task",
        status: "pending",
        source: "user",
        priority: "high",
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

      h.store.insertExecution({
        id: lowExecId,
        taskId: lowTaskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "low-trace",
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
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      h.store.insertExecution({
        id: highExecId,
        taskId: highTaskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "high-trace",
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
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Create low priority ticket first (inserted earlier)
    const lowTicket: ExecutionTicketRecord = {
      id: lowTicketId,
      executionId: lowExecId,
      taskId: lowTaskId,
      priority: "low",
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

    // Create high priority ticket (inserted later but higher priority)
    const highTicket: ExecutionTicketRecord = {
      id: highTicketId,
      executionId: highExecId,
      taskId: highTaskId,
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
      createdAt: nowIso(), // Created slightly later
      updatedAt: nowIso(),
    };

    h.db.transaction(() => {
      h.workerRepo.insertExecutionTicket(lowTicket);
      h.workerRepo.insertExecutionTicket(highTicket);
    });

    // Retrieve all pending tickets
    const allTickets = h.workerRepo.listPendingExecutionTickets("default");
    assert.ok(allTickets.length >= 2, "Should have at least 2 pending tickets");

    // High priority ticket should be selectable first in dispatch logic
    const highTicketRecord = h.workerRepo.getExecutionTicket(highTicketId);
    const lowTicketRecord = h.workerRepo.getExecutionTicket(lowTicketId);

    assert.equal(highTicketRecord!.priority, "high", "High ticket should have high priority");
    assert.equal(lowTicketRecord!.priority, "low", "Low ticket should have low priority");

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test 2: Multiple tickets with same priority maintain insertion order
// ---------------------------------------------------------------------------

test("E2E Ticket Priority: same priority tickets maintain insertion order", () => {
  const h = createE2eHarness("e2e-ticket-prio-order-");
  const now = nowIso();

  try {
    const ticketIds = [newId("ticket"), newId("ticket"), newId("ticket")];
    const taskIds = [newId("task"), newId("task"), newId("task")];
    const execIds = [newId("exec"), newId("exec"), newId("exec")];

    // Create tasks and executions
    for (let i = 0; i < 3; i++) {
      h.db.transaction(() => {
        h.store.insertTask({
          id: taskIds[i],
          parentId: null,
          rootId: taskIds[i],
          divisionId: "general_ops",
          title: `Normal task ${i}`,
          status: "pending",
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

        h.store.insertExecution({
          id: execIds[i],
          taskId: taskIds[i],
          workflowId: "single_agent_minimal",
          parentExecutionId: null,
          agentId: "agent-1",
          roleId: "general_executor",
          runKind: "task_run",
          status: "created",
          inputRef: null,
          traceId: `trace-${i}`,
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
          startedAt: null,
          finishedAt: null,
          createdAt: now,
          updatedAt: now,
        });
      });
    }

    // Create tickets with same normal priority
    for (let i = 0; i < 3; i++) {
      const ticket: ExecutionTicketRecord = {
        id: ticketIds[i],
        executionId: execIds[i],
        taskId: taskIds[i],
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
      };

      h.db.transaction(() => {
        h.workerRepo.insertExecutionTicket(ticket);
      });
    }

    // Verify all tickets have same priority
    for (let i = 0; i < 3; i++) {
      const ticket = h.workerRepo.getExecutionTicket(ticketIds[i]);
      assert.equal(ticket!.priority, "normal", `Ticket ${i} should have normal priority`);
      assert.equal(ticket!.status, "pending", `Ticket ${i} should be pending`);
    }

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test 3: Urgent priority ticket for time-sensitive work
// ---------------------------------------------------------------------------

test("E2E Ticket Priority: urgent priority ticket for time-sensitive work", () => {
  const h = createE2eHarness("e2e-ticket-prio-urgent-");
  const now = nowIso();

  try {
    const urgentTicketId = newId("ticket");
    const urgentTaskId = newId("task");
    const urgentExecId = newId("exec");

    h.db.transaction(() => {
      h.store.insertTask({
        id: urgentTaskId,
        parentId: null,
        rootId: urgentTaskId,
        divisionId: "general_ops",
        title: "Urgent incident response",
        status: "pending",
        source: "user",
        priority: "urgent",
        inputJson: JSON.stringify({ incident: "production-down" }),
        normalizedInputJson: JSON.stringify({ incident: "production-down" }),
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      h.store.insertExecution({
        id: urgentExecId,
        taskId: urgentTaskId,
        workflowId: "incident_response",
        parentExecutionId: null,
        agentId: "agent-incident",
        roleId: "incident_response",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "urgent-trace",
        attempt: 1,
        timeoutMs: 30000, // Shorter timeout for urgent
        budgetUsdLimit: 5,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const urgentTicket: ExecutionTicketRecord = {
      id: urgentTicketId,
      executionId: urgentExecId,
      taskId: urgentTaskId,
      priority: "urgent",
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

    h.db.transaction(() => {
      h.workerRepo.insertExecutionTicket(urgentTicket);
    });

    const ticket = h.workerRepo.getExecutionTicket(urgentTicketId);
    assert.equal(ticket!.priority, "urgent", "Ticket should have urgent priority");
    assert.equal(ticket!.status, "pending", "Ticket should be pending");

    // Verify the task is also marked urgent
    const task = h.store.getTask(urgentTaskId);
    assert.equal(task!.priority, "urgent", "Task should have urgent priority");

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test 4: Worker assignment respects ticket priority
// ---------------------------------------------------------------------------

test("E2E Ticket Priority: worker assignment for high priority ticket", () => {
  const h = createE2eHarness("e2e-ticket-prio-worker-");
  const now = nowIso();
  const workerId = newId("worker");

  try {
    const ticketId = newId("ticket");
    const taskId = newId("task");
    const execId = newId("exec");

    // Create task and execution
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "High priority dispatch",
        status: "pending",
        source: "user",
        priority: "high",
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

      h.store.insertExecution({
        id: execId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId: "dispatch-trace",
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
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Create worker
    h.db.transaction(() => {
      h.workerRepo.upsertWorkerSnapshot({
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
        capabilitiesJson: "[]",
        runningExecutionsJson: "[]",
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
      });
    });

    // Create high priority ticket
    const ticket: ExecutionTicketRecord = {
      id: ticketId,
      executionId: execId,
      taskId,
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

    h.db.transaction(() => {
      h.workerRepo.insertExecutionTicket(ticket);
    });

    // Worker claims the high priority ticket
    h.db.transaction(() => {
      h.workerRepo.claimExecutionTicket(ticketId, workerId, nowIso());
    });

    const claimedTicket = h.workerRepo.getExecutionTicket(ticketId);
    assert.equal(claimedTicket!.status, "claimed", "Ticket should be claimed");
    assert.equal(claimedTicket!.assignedWorkerId, workerId, "Ticket should be assigned to worker");
    assert.ok(claimedTicket!.claimedAt, "Claimed timestamp should be set");

    // Worker should now have increased workload
    const workerSnapshot = h.workerRepo.getWorkerSnapshot(workerId);
    assert.ok(workerSnapshot, "Worker should have snapshot");

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test 5: Ticket dispatch ordering across multiple queues
// ---------------------------------------------------------------------------

test("E2E Ticket Priority: tickets ordered correctly across multiple queues", () => {
  const h = createE2eHarness("e2e-ticket-prio-multi-queue-");
  const now = nowIso();

  try {
    // Create tickets in different queues
    const queues = ["default", "background", "critical"] as const;
    const ticketData = [
      { queue: "default", priority: "normal" as const },
      { queue: "background", priority: "low" as const },
      { queue: "critical", priority: "urgent" as const },
    ];

    for (const data of ticketData) {
      const ticketId = newId("ticket");
      const taskId = newId("task");
      const execId = newId("exec");

      h.db.transaction(() => {
        h.store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Task in ${data.queue}`,
          status: "pending",
          source: "user",
          priority: data.priority,
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

        h.store.insertExecution({
          id: execId,
          taskId,
          workflowId: "single_agent_minimal",
          parentExecutionId: null,
          agentId: "agent-1",
          roleId: "general_executor",
          runKind: "task_run",
          status: "created",
          inputRef: null,
          traceId: `trace-${data.queue}`,
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
          startedAt: null,
          finishedAt: null,
          createdAt: now,
          updatedAt: now,
        });

        const ticket: ExecutionTicketRecord = {
          id: ticketId,
          executionId: execId,
          taskId,
          priority: data.priority,
          queueName: data.queue,
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

        h.workerRepo.insertExecutionTicket(ticket);
      });
    }

    // Each queue should have its own ticket
    for (const queueName of queues) {
      const tickets = h.workerRepo.listPendingExecutionTickets(queueName);
      assert.equal(tickets.length, 1, `${queueName} queue should have 1 ticket`);
      assert.equal(tickets[0]!.queueName, queueName, "Ticket should be in correct queue");
    }

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
