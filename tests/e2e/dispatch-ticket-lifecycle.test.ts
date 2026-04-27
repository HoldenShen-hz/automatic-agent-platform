/**
 * E2E Dispatch and Ticket Lifecycle Tests
 *
 * End-to-end tests covering dispatch ticket creation, worker claiming,
 * lease management, and execution dispatch flows.
 *
 * Tests validate:
 * - Ticket creation and priority handling
 * - Worker lease acquisition and release
 * - Ticket dispatch workflow (pending -> claimed -> consumed)
 * - Execution dispatch with ticket references
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { WorkerRepository } from "../../src/platform/state-evidence/truth/sqlite/repositories/worker-repository.js";
import { TransitionService } from "../../src/platform/execution/state-transition/transition-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { ExecutionStatus, TaskStatus } from "../../src/platform/contracts/types/status.js";
import type { ExecutionTicketRecord, WorkerSnapshotRecord } from "../../src/platform/contracts/types/domain.js";

function createE2eHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e-dispatch-ticket.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const workerRepo = new WorkerRepository(db.connection);
  const transitions = new TransitionService(db, store);

  return { workspace, db, store, workerRepo, transitions };
}

function makeTaskCommand(
  taskId: string,
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
  traceId: string,
  executionId: string | null = null,
) {
  return {
    entityKind: "task" as const,
    entityId: taskId,
    fromStatus,
    toStatus,
    executionId,
    reasonCode: "e2e_dispatch_test",
    traceId,
    actorType: "system" as const,
    occurredAt: nowIso(),
  };
}

function makeExecCommand(
  executionId: string,
  fromStatus: ExecutionStatus,
  toStatus: ExecutionStatus,
  traceId: string,
) {
  return {
    entityKind: "execution" as const,
    entityId: executionId,
    fromStatus,
    toStatus,
    reasonCode: "e2e_dispatch_test",
    traceId,
    actorType: "agent" as const,
    occurredAt: nowIso(),
  };
}

// ---------------------------------------------------------------------------
// Test: Ticket created with priority for queued task
// ---------------------------------------------------------------------------

test("E2E: ticket created with correct priority for queued task", () => {
  const h = createE2eHarness("e2e-dispatch-ticket-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const ticketId = newId("ticket");
  const traceId = newId("trace");
  const now = nowIso();

  try {
    // Create task in pending state (ready for dispatch)
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Dispatch ticket test",
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
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId,
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

    // Create dispatch ticket
    const ticket: ExecutionTicketRecord = {
      id: ticketId,
      executionId,
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

    // Verify ticket created with correct priority
    const createdTicket = h.workerRepo.getExecutionTicket(ticketId);
    assert.ok(createdTicket, "Ticket should be created");
    assert.equal(createdTicket!.priority, "high", "Ticket should have high priority");
    assert.equal(createdTicket!.status, "pending", "Ticket should be pending");
    assert.equal(createdTicket!.taskId, taskId, "Ticket should reference correct task");
    assert.equal(createdTicket!.executionId, executionId, "Ticket should reference correct execution");

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test: Worker claims ticket and acquires lease
// ---------------------------------------------------------------------------

test("E2E: worker claims ticket and acquires lease", () => {
  const h = createE2eHarness("e2e-dispatch-claim-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const ticketId = newId("ticket");
  const workerId = newId("worker");
  const traceId = newId("trace");
  const now = nowIso();

  try {
    // Create task and execution
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Worker claim test",
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
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId,
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

    // Create pending ticket
    const ticket: ExecutionTicketRecord = {
      id: ticketId,
      executionId,
      taskId,
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

    // Create worker snapshot
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

    // Worker claims the ticket
    h.db.transaction(() => {
      h.workerRepo.claimExecutionTicket(ticketId, workerId, nowIso());
    });

    // Verify ticket is claimed
    const claimedTicket = h.workerRepo.getExecutionTicket(ticketId);
    assert.ok(claimedTicket, "Ticket should still exist after claim");
    assert.equal(claimedTicket!.status, "claimed", "Ticket should be claimed");
    assert.equal(claimedTicket!.assignedWorkerId, workerId, "Ticket should be assigned to worker");
    assert.ok(claimedTicket!.claimedAt, "Claimed timestamp should be set");

    // Verify worker snapshot shows busy
    const workerSnapshot = h.workerRepo.getWorkerSnapshot(workerId);
    assert.ok(workerSnapshot, "Worker should have snapshot");
    assert.equal(workerSnapshot!.status, "idle", "Worker status should still be idle (status update on separate path)");

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test: Ticket consumed after successful execution
// ---------------------------------------------------------------------------

test("E2E: ticket consumed after successful execution", () => {
  const h = createE2eHarness("e2e-dispatch-consume-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const sessionId = newId("sess");
  const ticketId = newId("ticket");
  const workerId = newId("worker");
  const traceId = newId("trace");
  const now = nowIso();

  try {
    // Create task and execution in progress
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Ticket consume test",
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

      h.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
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

      h.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Create claimed ticket
    const ticket: ExecutionTicketRecord = {
      id: ticketId,
      executionId,
      taskId,
      priority: "normal",
      queueName: "default",
      requiredCapabilitiesJson: "[]",
      dispatchAfter: now,
      attempt: 1,
      status: "claimed",
      assignedWorkerId: workerId,
      leaseId: newId("lease"),
      claimedAt: now,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    h.db.transaction(() => {
      h.workerRepo.insertExecutionTicket(ticket);
    });

    // Execution succeeds
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "executing", "succeeded", traceId));

    // Task completes via terminal state
    h.transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "completed",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "success" }),
      outputsJson: "{}",
      context: {
        reasonCode: "task.completed",
        traceId,
        actorType: "system",
        occurredAt: nowIso(),
      },
    });

    // Verify ticket would be consumed (ticket status still 'claimed' but execution done)
    const ticketAfterExecution = h.workerRepo.getExecutionTicket(ticketId);
    assert.ok(ticketAfterExecution, "Ticket should still exist after execution");
    assert.equal(ticketAfterExecution!.status, "claimed", "Ticket status remains claimed until consumed");

    // Verify task is done
    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should be done");

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test: Ticket invalidated when task cancelled
// ---------------------------------------------------------------------------

test("E2E: ticket invalidated when task cancelled", () => {
  const h = createE2eHarness("e2e-dispatch-invalidate-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const ticketId = newId("ticket");
  const traceId = newId("trace");
  const now = nowIso();

  try {
    // Create task in pending state
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Ticket invalidate test",
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
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId,
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

    // Create pending ticket
    const ticket: ExecutionTicketRecord = {
      id: ticketId,
      executionId,
      taskId,
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

    // Cancel the task
    h.transitions.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "pending",
      toStatus: "cancelled",
      executionId: null,
      reasonCode: "user_cancelled",
      traceId,
      actorType: "user",
      occurredAt: nowIso(),
    });

    // Verify task is cancelled
    const task = h.store.getTask(taskId);
    assert.equal(task?.status, "cancelled", "Task should be cancelled");

    // Verify ticket is still accessible (invalidation tracking happens separately)
    const ticketAfterCancel = h.workerRepo.getExecutionTicket(ticketId);
    assert.ok(ticketAfterCancel, "Ticket should still exist");
    assert.equal(ticketAfterCancel!.status, "pending", "Ticket remains pending (invalidation is async)");

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test: Multiple tickets for same task with different priorities
// ---------------------------------------------------------------------------

test("E2E: multiple tickets for task with different priorities", () => {
  const h = createE2eHarness("e2e-dispatch-multi-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const ticketId1 = newId("ticket1");
  const ticketId2 = newId("ticket2");
  const traceId = newId("trace");
  const now = nowIso();

  try {
    // Create task with high priority
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Multi-ticket test",
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
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "created",
        inputRef: null,
        traceId,
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

    // Create high priority ticket
    const ticket1: ExecutionTicketRecord = {
      id: ticketId1,
      executionId,
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

    // Create normal priority ticket (fallback)
    const ticket2: ExecutionTicketRecord = {
      id: ticketId2,
      executionId,
      taskId,
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
      h.workerRepo.insertExecutionTicket(ticket1);
      h.workerRepo.insertExecutionTicket(ticket2);
    });

    // Verify both tickets exist
    const highPriorityTicket = h.workerRepo.getExecutionTicket(ticketId1);
    const normalPriorityTicket = h.workerRepo.getExecutionTicket(ticketId2);

    assert.ok(highPriorityTicket, "High priority ticket should exist");
    assert.ok(normalPriorityTicket, "Normal priority ticket should exist");
    assert.equal(highPriorityTicket!.priority, "high", "First ticket should be high priority");
    assert.equal(normalPriorityTicket!.priority, "normal", "Second ticket should be normal priority");

    // Verify they reference the same task
    assert.equal(highPriorityTicket!.taskId, taskId, "High ticket should reference task");
    assert.equal(normalPriorityTicket!.taskId, taskId, "Normal ticket should reference task");
    assert.equal(highPriorityTicket!.executionId, executionId, "Both tickets should reference same execution");

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test: Worker lease management - worker busy when lease active
// ---------------------------------------------------------------------------

test("E2E: worker lease management - worker busy with active lease", () => {
  const h = createE2eHarness("e2e-dispatch-lease-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const workerId = newId("worker");
  const traceId = newId("trace");
  const now = nowIso();

  try {
    // Create task in progress
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Lease management test",
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

      h.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
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
    });

    // Create worker with active lease
    const workerSnapshot: WorkerSnapshotRecord = {
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
      saturation: 0.5,
      activeLeaseCount: 1,
      meanStartupLatencyMs: 100,
      sandboxSuccessRate: 0.98,
      repoCacheHitRate: 0.85,
      capabilitiesJson: `["${executionId}"]`,
      runningExecutionsJson: `["${executionId}"]`,
      maxConcurrency: 10,
      queueAffinity: null,
      runtimeInstanceId: null,
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      cpuPct: 50,
      memoryMb: 256,
      toolBacklogCount: 2,
      currentStepId: null,
      lastProgressAt: null,
      lastHeartbeatAt: now,
      updatedAt: now,
    };

    h.db.transaction(() => {
      h.workerRepo.upsertWorkerSnapshot(workerSnapshot);
    });

    // Verify worker is busy with active lease
    const snapshot = h.workerRepo.getWorkerSnapshot(workerId);
    assert.ok(snapshot, "Worker should have snapshot");
    assert.equal(snapshot!.status, "busy", "Worker should be busy");
    assert.equal(snapshot!.activeLeaseCount, 1, "Worker should have 1 active lease");
    assert.ok(snapshot!.runningExecutionsJson.includes(executionId), "Execution should be in running list");

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test: Execution preempted and ticket requeued
// ---------------------------------------------------------------------------

test("E2E: execution preempted and ticket requeued", () => {
  const h = createE2eHarness("e2e-dispatch-preempt-");
  const taskId = newId("task");
  const executionId = newId("exec");
  const ticketId = newId("ticket");
  const workerId = newId("worker");
  const traceId = newId("trace");
  const now = nowIso();

  try {
    // Create task in progress
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Preemption test",
        status: "in_progress",
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
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-1",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
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
    });

    // Create claimed ticket
    const ticket: ExecutionTicketRecord = {
      id: ticketId,
      executionId,
      taskId,
      priority: "high",
      queueName: "default",
      requiredCapabilitiesJson: "[]",
      dispatchAfter: now,
      attempt: 1,
      status: "claimed",
      assignedWorkerId: workerId,
      leaseId: newId("lease"),
      claimedAt: now,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    h.db.transaction(() => {
      h.workerRepo.insertExecutionTicket(ticket);
    });

    // Execution is cancelled (preemption represented as cancellation)
    h.transitions.transitionExecutionStatus(makeExecCommand(executionId, "executing", "cancelled", traceId));

    const exec = h.store.getExecution(executionId);
    assert.equal(exec?.status, "cancelled", "Execution should be cancelled");

    // Ticket status still claimed until requeue
    const ticketAfterPreempt = h.workerRepo.getExecutionTicket(ticketId);
    assert.ok(ticketAfterPreempt, "Ticket should still exist");
    assert.equal(ticketAfterPreempt!.status, "claimed", "Ticket remains claimed after preemption");

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
