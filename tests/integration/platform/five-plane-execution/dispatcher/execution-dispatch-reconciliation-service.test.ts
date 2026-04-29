/**
 * Execution Dispatch Reconciliation Service Integration Tests
 *
 * Tests poison-pill detection for execution dispatch tickets that can never be
 * dispatched due to orphaned claims or terminal executions.
 *
 * @see R9-05 fix verification
 */

import assert from "node:assert/strict";
import test from "node:test";

import { newId, nowIso } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/contracts/types/ids.js";
import { createIntegrationContext } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/tests/helpers/integration-context.js";
import { ExecutionDispatchReconciliationService } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-execution/dispatcher/execution-dispatch-reconciliation-service.js";

test("reconciliation detects orphan queue claim for ticket with missing active lease", () => {
  const ctx = createIntegrationContext("aa-reconcile-orphan-");
  try {
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");
    const workerId = newId("worker");

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Orphan claim test",
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

      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-test",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: `trace-${executionId}`,
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

      // Create a claimed ticket without an active lease (orphan queue claim)
      ctx.store.worker.insertExecutionTicket({
        id: ticketId,
        executionId,
        taskId,
        priority: "normal",
        queueName: "default",
        dispatchTarget: "any",
        requiredIsolationLevel: "standard",
        requiredRepoVersion: null,
        requiredCapabilitiesJson: "[]",
        dispatchAfter: null,
        attempt: 1,
        status: "claimed",
        assignedWorkerId: workerId,
        leaseId: "lease-orphan-123", // lease doesn't exist
        claimedAt: now,
        consumedAt: null,
        invalidatedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const service = new ExecutionDispatchReconciliationService(ctx.db, ctx.store);
    const issue = service.findIssueByTicketId(ticketId, now);

    assert.ok(issue !== null, "should detect issue for orphan queue claim");
    assert.equal(issue.issueType, "orphan_queue_claim");
    assert.equal(issue.resolutionAction, "requeue_ticket");
    assert.equal(issue.reasonCode, "missing_active_lease");
    assert.equal(issue.ticketId, ticketId);
    assert.equal(issue.executionId, executionId);
    assert.equal(issue.taskId, taskId);
  } finally {
    ctx.cleanup();
  }
});

test("reconciliation detects orphan queue claim for ticket with expired lease", () => {
  const ctx = createIntegrationContext("aa-reconcile-expired-");
  try {
    const now = nowIso();
    const pastTime = new Date(Date.parse(now) - 10 * 60 * 1000).toISOString(); // 10 minutes ago
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");
    const workerId = newId("worker");
    const leaseId = newId("lease");

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Expired lease test",
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

      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-test",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: `trace-${executionId}`,
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

      // Create claimed ticket with an expired lease
      ctx.store.worker.insertExecutionTicket({
        id: ticketId,
        executionId,
        taskId,
        priority: "normal",
        queueName: "default",
        dispatchTarget: "any",
        requiredIsolationLevel: "standard",
        requiredRepoVersion: null,
        requiredCapabilitiesJson: "[]",
        dispatchAfter: null,
        attempt: 1,
        status: "claimed",
        assignedWorkerId: workerId,
        leaseId,
        claimedAt: pastTime,
        consumedAt: null,
        invalidatedAt: null,
        createdAt: pastTime,
        updatedAt: pastTime,
      });

      // Insert an expired lease
      ctx.store.worker.insertExecutionLease({
        id: leaseId,
        executionId,
        workerId,
        attempt: 1,
        fencingToken: 1,
        queueName: "default",
        status: "active", // but expired
        leasedAt: pastTime,
        expiresAt: pastTime, // already expired
        lastHeartbeatAt: pastTime,
        releasedAt: null,
        reasonCode: null,
      });
    });

    const service = new ExecutionDispatchReconciliationService(ctx.db, ctx.store);
    const issue = service.findIssueByTicketId(ticketId, now);

    assert.ok(issue !== null, "should detect issue for expired lease");
    assert.equal(issue.issueType, "orphan_queue_claim");
    assert.equal(issue.reasonCode, "lease_expired_unreclaimed");
  } finally {
    ctx.cleanup();
  }
});

test("reconciliation detects terminal execution ticket issue", () => {
  const ctx = createIntegrationContext("aa-reconcile-terminal-");
  try {
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Terminal execution test",
        status: "completed",
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
        completedAt: now,
      });

      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-test",
        roleId: "general_executor",
        runKind: "task_run",
        status: "succeeded", // terminal status
        inputRef: null,
        traceId: `trace-${executionId}`,
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
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Create a pending ticket for a terminal execution
      ctx.store.worker.insertExecutionTicket({
        id: ticketId,
        executionId,
        taskId,
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
    });

    const service = new ExecutionDispatchReconciliationService(ctx.db, ctx.store);
    const issue = service.findIssueByTicketId(ticketId, now);

    assert.ok(issue !== null, "should detect issue for terminal execution ticket");
    assert.equal(issue.issueType, "terminal_execution_ticket");
    assert.equal(issue.resolutionAction, "invalidate_ticket");
    assert.equal(issue.reasonCode, "execution_terminal");
    assert.equal(issue.executionStatus, "succeeded");
  } finally {
    ctx.cleanup();
  }
});

test("applyIssue with orphan_queue_claim requeues ticket and creates replacement", () => {
  const ctx = createIntegrationContext("aa-apply-orphan-");
  try {
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");
    const workerId = newId("worker");

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Apply orphan test",
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

      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-test",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: `trace-${executionId}`,
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

      ctx.store.worker.insertExecutionTicket({
        id: ticketId,
        executionId,
        taskId,
        priority: "normal",
        queueName: "default",
        dispatchTarget: "any",
        requiredIsolationLevel: "standard",
        requiredRepoVersion: null,
        requiredCapabilitiesJson: "[]",
        dispatchAfter: null,
        attempt: 1,
        status: "claimed",
        assignedWorkerId: workerId,
        leaseId: "lease-orphan-456",
        claimedAt: now,
        consumedAt: null,
        invalidatedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const service = new ExecutionDispatchReconciliationService(ctx.db, ctx.store);
    const repairResult = service.repairTicket(ticketId, now);

    assert.ok(repairResult !== null, "repair should return a result");
    assert.equal(repairResult.applied, true);
    assert.equal(repairResult.issueType, "orphan_queue_claim");
    assert.equal(repairResult.resolutionAction, "requeue_ticket");
    assert.ok(repairResult.replacementTicketId !== null, "should have replacement ticket");

    // Verify original ticket was invalidated
    const originalTicket = ctx.store.worker.getExecutionTicket(ticketId);
    assert.equal(originalTicket?.status, "expired");

    // Verify replacement ticket exists and is pending
    const replacementTicket = ctx.store.worker.getExecutionTicket(repairResult.replacementTicketId!);
    assert.ok(replacementTicket !== null, "replacement ticket should exist");
    assert.equal(replacementTicket?.status, "pending");
  } finally {
    ctx.cleanup();
  }
});

test("applyIssue with terminal_execution_ticket invalidates ticket without creating replacement", () => {
  const ctx = createIntegrationContext("aa-apply-terminal-");
  try {
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Apply terminal test",
        status: "completed",
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
        completedAt: now,
      });

      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-test",
        roleId: "general_executor",
        runKind: "task_run",
        status: "failed", // terminal status
        inputRef: null,
        traceId: `trace-${executionId}`,
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
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      ctx.store.worker.insertExecutionTicket({
        id: ticketId,
        executionId,
        taskId,
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
    });

    const service = new ExecutionDispatchReconciliationService(ctx.db, ctx.store);
    const repairResult = service.repairTicket(ticketId, now);

    assert.ok(repairResult !== null, "repair should return a result");
    assert.equal(repairResult.applied, true);
    assert.equal(repairResult.issueType, "terminal_execution_ticket");
    assert.equal(repairResult.resolutionAction, "invalidate_ticket");
    assert.equal(repairResult.replacementTicketId, null, "should not create replacement for terminal execution");

    // Verify ticket was invalidated
    const invalidatedTicket = ctx.store.worker.getExecutionTicket(ticketId);
    assert.equal(invalidatedTicket?.status, "cancelled");
  } finally {
    ctx.cleanup();
  }
});

test("reconciliation scan finds all issues across all pending and claimed tickets", () => {
  const ctx = createIntegrationContext("aa-scan-all-");
  try {
    const now = nowIso();
    const taskId1 = newId("task");
    const taskId2 = newId("task");
    const executionId1 = newId("exec");
    const executionId2 = newId("exec");
    const ticketId1 = newId("ticket");
    const ticketId2 = newId("ticket");
    const workerId = newId("worker");

    ctx.db.transaction(() => {
      // Task 1 with terminal execution
      ctx.store.insertTask({
        id: taskId1,
        parentId: null,
        rootId: taskId1,
        divisionId: "general_ops",
        tenantId: null,
        title: "Terminal task",
        status: "completed",
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
        completedAt: now,
      });

      ctx.store.insertExecution({
        id: executionId1,
        taskId: taskId1,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-test",
        roleId: "general_executor",
        runKind: "task_run",
        status: "succeeded",
        inputRef: null,
        traceId: `trace-${executionId1}`,
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
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      // Task 2 with active execution but orphan claim
      ctx.store.insertTask({
        id: taskId2,
        parentId: null,
        rootId: taskId2,
        divisionId: "general_ops",
        tenantId: null,
        title: "Orphan claim task",
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

      ctx.store.insertExecution({
        id: executionId2,
        taskId: taskId2,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-test",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: `trace-${executionId2}`,
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

      // Ticket 1: pending for terminal execution
      ctx.store.worker.insertExecutionTicket({
        id: ticketId1,
        executionId: executionId1,
        taskId: taskId1,
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

      // Ticket 2: claimed but no active lease
      ctx.store.worker.insertExecutionTicket({
        id: ticketId2,
        executionId: executionId2,
        taskId: taskId2,
        priority: "normal",
        queueName: "default",
        dispatchTarget: "any",
        requiredIsolationLevel: "standard",
        requiredRepoVersion: null,
        requiredCapabilitiesJson: "[]",
        dispatchAfter: null,
        attempt: 1,
        status: "claimed",
        assignedWorkerId: workerId,
        leaseId: "nonexistent-lease",
        claimedAt: now,
        consumedAt: null,
        invalidatedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const service = new ExecutionDispatchReconciliationService(ctx.db, ctx.store);
    const issues = service.scan(now);

    assert.equal(issues.length, 2, "should find 2 issues");

    const issueTypes = issues.map((i) => i.issueType).sort();
    assert.deepEqual(issueTypes, ["orphan_queue_claim", "terminal_execution_ticket"]);
  } finally {
    ctx.cleanup();
  }
});

test("repair applies all issues and records events", () => {
  const ctx = createIntegrationContext("aa-repair-all-");
  try {
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Repair event test",
        status: "completed",
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
        completedAt: now,
      });

      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-test",
        roleId: "general_executor",
        runKind: "task_run",
        status: "cancelled",
        inputRef: null,
        traceId: `trace-${executionId}`,
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
        finishedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      ctx.store.worker.insertExecutionTicket({
        id: ticketId,
        executionId,
        taskId,
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
    });

    const service = new ExecutionDispatchReconciliationService(ctx.db, ctx.store);
    const { issues, applied } = service.repair(now);

    assert.equal(issues.length, 1);
    assert.equal(applied.length, 1);
    assert.equal(applied[0].applied, true);

    // Verify event was recorded
    const events = ctx.store.event.listEventsByType("dispatch:ticket_reconciled", 10);
    assert.ok(events.length > 0, "should have recorded reconciliation event");

    const reconciliationEvent = events[0];
    const payload = JSON.parse(reconciliationEvent.payloadJson);
    assert.equal(payload.ticketId, ticketId);
    assert.equal(payload.issueType, "terminal_execution_ticket");
    assert.equal(payload.resolutionAction, "invalidate_ticket");
  } finally {
    ctx.cleanup();
  }
});

test("orphan queue claim repair records ticket_requeued event with replacement info", () => {
  const ctx = createIntegrationContext("aa-repair-requeue-");
  try {
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");
    const workerId = newId("worker");

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Requeue event test",
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

      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-test",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: `trace-${executionId}`,
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

      ctx.store.worker.insertExecutionTicket({
        id: ticketId,
        executionId,
        taskId,
        priority: "normal",
        queueName: "default",
        dispatchTarget: "any",
        requiredIsolationLevel: "standard",
        requiredRepoVersion: null,
        requiredCapabilitiesJson: "[]",
        dispatchAfter: null,
        attempt: 1,
        status: "claimed",
        assignedWorkerId: workerId,
        leaseId: "orphan-lease-789",
        claimedAt: now,
        consumedAt: null,
        invalidatedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const service = new ExecutionDispatchReconciliationService(ctx.db, ctx.store);
    const result = service.repairTicket(ticketId, now);

    assert.equal(result?.replacementTicketId !== null, true);

    // Verify ticket_requeued event was recorded
    const events = ctx.store.event.listEventsByType("dispatch:ticket_requeued", 10);
    assert.ok(events.length > 0, "should have recorded ticket_requeued event");

    const requeueEvent = events[0];
    const payload = JSON.parse(requeueEvent.payloadJson);
    assert.equal(payload.previousTicketId, ticketId);
    assert.equal(payload.replacementTicketId, result?.replacementTicketId);
    assert.equal(payload.reasonCode, "missing_active_lease");
  } finally {
    ctx.cleanup();
  }
});

test("repairTicket returns null for ticket with no issue", () => {
  const ctx = createIntegrationContext("aa-no-issue-");
  try {
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");
    const workerId = newId("worker");
    const leaseId = newId("lease");

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "No issue test",
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

      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-test",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: `trace-${executionId}`,
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

      // Create a properly claimed ticket with valid lease
      ctx.store.worker.insertExecutionTicket({
        id: ticketId,
        executionId,
        taskId,
        priority: "normal",
        queueName: "default",
        dispatchTarget: "any",
        requiredIsolationLevel: "standard",
        requiredRepoVersion: null,
        requiredCapabilitiesJson: "[]",
        dispatchAfter: null,
        attempt: 1,
        status: "claimed",
        assignedWorkerId: workerId,
        leaseId,
        claimedAt: now,
        consumedAt: null,
        invalidatedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      // Insert valid active lease
      const futureExpiry = new Date(Date.parse(now) + 5 * 60 * 1000).toISOString(); // 5 minutes from now
      ctx.store.worker.insertExecutionLease({
        id: leaseId,
        executionId,
        workerId,
        attempt: 1,
        fencingToken: 1,
        queueName: "default",
        status: "active",
        leasedAt: now,
        expiresAt: futureExpiry,
        lastHeartbeatAt: now,
        releasedAt: null,
        reasonCode: null,
      });
    });

    const service = new ExecutionDispatchReconciliationService(ctx.db, ctx.store);
    const result = service.repairTicket(ticketId, now);

    assert.equal(result, null, "should return null for ticket with no issue");
  } finally {
    ctx.cleanup();
  }
});

test("findIssueByTicketId returns null for non-existent ticket", () => {
  const ctx = createIntegrationContext("aa-nonexistent-");
  try {
    const service = new ExecutionDispatchReconciliationService(ctx.db, ctx.store);
    const issue = service.findIssueByTicketId("nonexistent-ticket-id", nowIso());

    assert.equal(issue, null);
  } finally {
    ctx.cleanup();
  }
});

test("findIssueByTicketId returns null for consumed ticket", () => {
  const ctx = createIntegrationContext("aa-consumed-");
  try {
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");
    const ticketId = newId("ticket");

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Consumed ticket test",
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

      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-test",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: `trace-${executionId}`,
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

      // Create a consumed ticket (not pending or claimed)
      ctx.store.worker.insertExecutionTicket({
        id: ticketId,
        executionId,
        taskId,
        priority: "normal",
        queueName: "default",
        dispatchTarget: "any",
        requiredIsolationLevel: "standard",
        requiredRepoVersion: null,
        requiredCapabilitiesJson: "[]",
        dispatchAfter: null,
        attempt: 1,
        status: "consumed",
        assignedWorkerId: null,
        leaseId: null,
        claimedAt: now,
        consumedAt: now,
        invalidatedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const service = new ExecutionDispatchReconciliationService(ctx.db, ctx.store);
    const issue = service.findIssueByTicketId(ticketId, now);

    assert.equal(issue, null, "should return null for consumed ticket");
  } finally {
    ctx.cleanup();
  }
});
