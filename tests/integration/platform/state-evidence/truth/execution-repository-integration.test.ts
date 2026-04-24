// @ts-nocheck
/**
 * Integration Tests: Execution Repository Operations
 *
 * Tests for execution CRUD operations using AuthoritativeTaskStore
 * with SQLite in-memory database.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";

test("execution repository persists and retrieves execution", () => {
  const ctx = createIntegrationContext("aa-exec-repo-");
  try {
    const taskId = "task-exec-001";
    const executionId = "exec-001";
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: "tenant-exec",
        title: "Execution Test Task",
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
        traceId: "trace-exec-001",
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

    const execution = ctx.store.getExecution(executionId);

    assert.ok(execution, "Execution should be retrieved");
    assert.equal(execution!.id, executionId);
    assert.equal(execution!.taskId, taskId);
    assert.equal(execution!.status, "pending");
    assert.equal(execution!.attempt, 1);
  } finally {
    ctx.cleanup();
  }
});

test("execution repository returns null for non-existent execution", () => {
  const ctx = createIntegrationContext("aa-exec-notfound-");
  try {
    const result = ctx.store.getExecution("non-existent-exec");
    assert.equal(result, null);
  } finally {
    ctx.cleanup();
  }
});

test("execution repository updates execution status", () => {
  const ctx = createIntegrationContext("aa-exec-update-");
  try {
    const taskId = "task-exec-update";
    const executionId = "exec-update-001";
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: "tenant-exec-update",
        title: "Update Execution Test",
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
        traceId: "trace-update",
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

    const startTime = new Date().toISOString();
    ctx.db.transaction(() => {
      ctx.store.updateExecutionStatus(executionId, "executing", startTime, null, null, null);
    });

    const updated = ctx.store.getExecution(executionId);
    assert.equal(updated!.status, "executing");
  } finally {
    ctx.cleanup();
  }
});

test("execution repository records execution failure", () => {
  const ctx = createIntegrationContext("aa-exec-failure-");
  try {
    const taskId = "task-exec-fail";
    const executionId = "exec-fail-001";
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: "tenant-exec-fail",
        title: "Failure Test Task",
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
        status: "executing",
        inputRef: null,
        traceId: "trace-fail",
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

    const failTime = new Date().toISOString();
    ctx.db.transaction(() => {
      ctx.store.updateExecutionFailure({
        executionId,
        status: "failed",
        updatedAt: failTime,
        finishedAt: failTime,
        lastErrorCode: "ERR_TIMEOUT",
        lastErrorMessage: "Execution timed out after 60 seconds",
      });
    });

    const failed = ctx.store.getExecution(executionId);
    assert.equal(failed!.status, "failed");
    assert.equal(failed!.lastErrorCode, "ERR_TIMEOUT");
    assert.equal(failed!.lastErrorMessage, "Execution timed out after 60 seconds");
  } finally {
    ctx.cleanup();
  }
});

test("execution repository tracks multiple executions per task", () => {
  const ctx = createIntegrationContext("aa-exec-multi-");
  try {
    const taskId = "task-exec-multi";
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: "tenant-exec-multi",
        title: "Multi Execution Test",
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

      // Insert multiple executions with different attempts
      for (let i = 1; i <= 3; i++) {
        ctx.store.insertExecution({
          id: `exec-multi-${i}`,
          taskId,
          workflowId: "single_agent_minimal",
          parentExecutionId: null,
          agentId: "agent-001",
          roleId: "general_executor",
          runKind: "task_run",
          status: i === 3 ? "executing" : "failed",
          inputRef: null,
          traceId: `trace-multi-${i}`,
          attempt: i,
          timeoutMs: 60000,
          budgetUsdLimit: 1,
          requiresApproval: 0,
          sandboxMode: "workspace_write",
          allowedToolsJson: "[]",
          allowedPathsJson: "[]",
          maxRetries: 0,
          retryBackoff: "none",
          lastErrorCode: i < 3 ? "ERR_RETRY" : null,
          lastErrorMessage: i < 3 ? "Retry attempt" : null,
          startedAt: now,
          finishedAt: i < 3 ? now : null,
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    const executions = ctx.store.listExecutionsByTask(taskId);
    assert.equal(executions.length, 3);
  } finally {
    ctx.cleanup();
  }
});
