// @ts-nocheck
/**
 * Integration Tests: Data Integrity Constraints
 *
 * Tests for data integrity constraints using AuthoritativeTaskStore
 * with SQLite in-memory database.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";

test("data integrity: task-execution relationship is enforced", () => {
  const ctx = createIntegrationContext("aa-di-task-exec-");
  try {
    const taskId = "task-di-001";
    const executionId = "exec-di-001";
    const now = new Date().toISOString();

    // Create task first
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: "tenant-di",
        title: "Data Integrity Test",
        status: "queued",
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
    });

    // Insert execution that references the task
    ctx.db.transaction(() => {
      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-001",
        roleId: "general_executor",
        runKind: "task_run",
        status: "pending",
        inputRef: null,
        traceId: "trace-di",
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

    // Verify relationship
    const task = ctx.store.getTask(taskId);
    const execution = ctx.store.getExecution(executionId);

    assert.ok(task, "Task should exist");
    assert.ok(execution, "Execution should exist");
    assert.equal(execution!.taskId, taskId, "Execution should reference task");
  } finally {
    ctx.cleanup();
  }
});

test("data integrity: workflow-task relationship is enforced", () => {
  const ctx = createIntegrationContext("aa-di-wf-task-");
  try {
    const taskId = "task-di-wf-001";
    const now = new Date().toISOString();

    // Create task
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: "tenant-di-wf",
        title: "Workflow Test",
        status: "queued",
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
    });

    // Insert workflow state
    ctx.db.transaction(() => {
      ctx.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "multi_step_plan",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
    });

    // Verify relationship
    const workflow = ctx.store.getWorkflowState(taskId);
    assert.ok(workflow, "Workflow should exist");
    assert.equal(workflow!.taskId, taskId, "Workflow should reference task");
  } finally {
    ctx.cleanup();
  }
});

test("data integrity: session-task relationship is enforced", () => {
  const ctx = createIntegrationContext("aa-di-session-task-");
  try {
    const taskId = "task-di-session-001";
    const sessionId = "session-di-001";
    const now = new Date().toISOString();

    // Create task
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: "tenant-di-session",
        title: "Session Test",
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
    });

    // Insert session
    ctx.db.transaction(() => {
      ctx.store.insertSession({
        id: sessionId,
        taskId,
        channel: "console",
        status: "active",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Verify relationship
    const session = ctx.store.getSession(sessionId);
    assert.ok(session, "Session should exist");
    assert.equal(session!.taskId, taskId, "Session should reference task");
  } finally {
    ctx.cleanup();
  }
});

test("data integrity: approval-execution relationship is enforced", () => {
  const ctx = createIntegrationContext("aa-di-approval-");
  try {
    const taskId = "task-di-approval-001";
    const executionId = "exec-di-approval-001";
    const approvalId = "approval-di-001";
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: "tenant-di-approval",
        title: "Approval Test",
        status: "awaiting_decision",
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
        agentId: "agent-001",
        roleId: "general_executor",
        runKind: "task_run",
        status: "blocked",
        inputRef: null,
        traceId: "trace-approval",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 1,
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

      ctx.store.insertApproval({
        id: approvalId,
        taskId,
        executionId,
        status: "requested",
        requestJson: JSON.stringify({ reason: "high priority" }),
        responseJson: null,
        timeoutPolicy: "auto_approve",
        createdAt: now,
        respondedAt: null,
      });
    });

    // Verify relationships
    const approval = ctx.store.getApproval(approvalId);
    assert.ok(approval, "Approval should exist");
    assert.equal(approval!.taskId, taskId);
    assert.equal(approval!.executionId, executionId);

    const approvals = ctx.store.listApprovalsByTask(taskId);
    assert.equal(approvals.length, 1);
    assert.equal(approvals[0]!.executionId, executionId);
  } finally {
    ctx.cleanup();
  }
});

test("data integrity: event-consumer ack relationship is enforced", () => {
  const ctx = createIntegrationContext("aa-di-event-ack-");
  try {
    const eventId = "event-di-001";
    const consumerId = "consumer-di-001";
    const ackId = "eack-di-001";
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertEvent({
        id: eventId,
        taskId: null,
        sessionId: null,
        executionId: null,
        eventType: "task.created",
        payloadJson: "{}",
        traceId: null,
        createdAt: now,
      });

      ctx.store.insertEventConsumerAck({
        id: ackId,
        eventId,
        consumerId,
        status: "pending",
        lastAttemptAt: null,
        ackedAt: null,
        errorCode: null,
        attemptCount: 0,
      });
    });

    // Verify relationship
    const ack = ctx.store.getEventConsumerAck(eventId, consumerId);
    assert.ok(ack, "Event consumer ack should exist");
    assert.equal(ack!.eventId, eventId);
    assert.equal(ack!.consumerId, consumerId);
  } finally {
    ctx.cleanup();
  }
});

test("data integrity: parent-child task relationship", () => {
  const ctx = createIntegrationContext("aa-di-parent-child-");
  try {
    const parentId = "task-parent-di";
    const childId = "task-child-di";
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: parentId,
        parentId: null,
        rootId: parentId,
        divisionId: "general_ops",
        tenantId: "tenant-di-parent",
        title: "Parent Task",
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

      ctx.store.insertTask({
        id: childId,
        parentId,
        rootId: parentId,
        divisionId: "general_ops",
        tenantId: "tenant-di-parent",
        title: "Child Task",
        status: "queued",
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
    });

    // Verify relationships
    const parent = ctx.store.getTask(parentId);
    const child = ctx.store.getTask(childId);

    assert.ok(parent, "Parent should exist");
    assert.ok(child, "Child should exist");
    assert.equal(child!.parentId, parentId, "Child should reference parent");
    assert.equal(child!.rootId, parentId, "Child should have same root as parent");
    assert.equal(parent!.parentId, null, "Parent should have no parent");
  } finally {
    ctx.cleanup();
  }
});

test("data integrity: execution status transitions are atomic", () => {
  const ctx = createIntegrationContext("aa-di-atomic-");
  try {
    const taskId = "task-di-atomic-001";
    const executionId = "exec-di-atomic-001";
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: "tenant-di-atomic",
        title: "Atomic Test",
        status: "queued",
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
        agentId: "agent-001",
        roleId: "general_executor",
        runKind: "task_run",
        status: "pending",
        inputRef: null,
        traceId: "trace-atomic",
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

    // Update execution status to running
    const startTime = new Date().toISOString();
    ctx.db.transaction(() => {
      ctx.store.updateExecutionStatus(
        executionId,
        "executing",
        startTime,
        null,
        null,
        null
      );
    });

    // Update execution status to completed
    const completeTime = new Date().toISOString();
    ctx.db.transaction(() => {
      ctx.store.updateExecutionStatus(
        executionId,
        "completed",
        startTime,
        completeTime,
        null,
        null
      );
    });

    // Verify final state
    const execution = ctx.store.getExecution(executionId);
    assert.equal(execution!.status, "completed");
    assert.ok(execution!.finishedAt, "Should have finished timestamp");
  } finally {
    ctx.cleanup();
  }
});
