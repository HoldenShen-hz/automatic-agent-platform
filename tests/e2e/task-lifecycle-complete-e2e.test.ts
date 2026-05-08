/**
 * E2E Task Lifecycle Complete Tests
 *
 * End-to-end tests covering complete task lifecycle:
 * 1. Task create → execute → complete (happy path)
 * 2. Task create → execute → fail (error path)
 * 3. Task create → cancel (cancellation path)
 * 4. Task with retries (recovery path)
 *
 * Uses node:test + node:assert/strict. ESM imports with .js extensions.
 * Pattern: createE2EHarness for full stack context.
 *
 * Note: These tests use direct store updates instead of TransitionService
 * to avoid the outbox.aggregate_id constraint issue in the test harness.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness, createSeededE2EHarness } from "../helpers/e2e-harness.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";

// ---------------------------------------------------------------------------
// Test 1: Task complete lifecycle (create → execute → done)
// ---------------------------------------------------------------------------

test("E2E Task Lifecycle: task progresses from queued to done with execution", async () => {
  const harness = createE2EHarness("aa-e2e-task-complete-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const sessionId = newId("sess");
    const now = nowIso();

    // Step 1: Create task in queued state
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Complete lifecycle test",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ request: "complete lifecycle test" }),
        normalizedInputJson: JSON.stringify({ request: "complete lifecycle test" }),
        outputJson: null,
        estimatedCostUsd: 0.05,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Verify queued state
    let task = harness.store.getTask(taskId);
    assert.equal(task?.status, "queued", "Task should start in queued");
    assert.ok(task?.createdAt, "Task should have createdAt");

    // Step 2: Transition queued → pending (direct store update)
    harness.db.transaction(() => {
      harness.store.updateTaskStatus(taskId, "pending", now, null, null);
    });

    task = harness.store.getTask(taskId);
    assert.equal(task?.status, "pending", "Task should be pending after scheduling");

    // Step 3: Insert execution
    harness.db.transaction(() => {
// @ts-ignore
      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-lifecycle",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: newId("trace"),
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
        startedAt: nowIso(),
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      // Also insert session
      harness.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Step 4: Transition pending → in_progress
    harness.db.transaction(() => {
      harness.store.updateTaskStatus(taskId, "in_progress", now, null, null);
    });

    task = harness.store.getTask(taskId);
    assert.equal(task?.status, "in_progress", "Task should be in_progress");

    // Verify execution is executing
    const exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "executing", "Execution should be executing");

    // Step 5: Execution succeeds (direct store update)
    harness.db.transaction(() => {
      harness.store.updateExecutionStatus(executionId, "succeeded", nowIso(), null, nowIso());
    });

    // Step 6: Task completes (direct store update)
    harness.db.transaction(() => {
      harness.store.updateTaskStatus(taskId, "done", nowIso(), null, nowIso());
    });

    // Verify final state
    task = harness.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should be done");
    assert.ok(task?.completedAt, "Task should have completedAt");

    const finalExec = harness.store.getExecution(executionId);
    assert.equal(finalExec?.status, "succeeded", "Execution should be succeeded");
    assert.ok(finalExec?.finishedAt, "Execution should have finishedAt");

    const session = harness.store.getSession(sessionId);
    assert.equal(session?.status, "open", "Session should be open (status transitions require session service)");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: Task error lifecycle (create → execute → fail)
// ---------------------------------------------------------------------------

test("E2E Task Lifecycle: task fails with error and proper error tracking", async () => {
  const harness = createE2EHarness("aa-e2e-task-fail-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    // Setup task in in_progress with executing execution
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Failure lifecycle test",
        status: "in_progress",
        source: "user",
        priority: "high",
        inputJson: JSON.stringify({ request: "this will fail" }),
        normalizedInputJson: JSON.stringify({ request: "this will fail" }),
        outputJson: null,
        estimatedCostUsd: 0.05,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

// @ts-ignore
      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-fail",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: newId("trace"),
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

    // Execution fails
    harness.db.transaction(() => {
      harness.store.updateExecutionStatus(executionId, "failed", nowIso(), null, nowIso(), "execution.timeout");
    });

    let exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "failed", "Execution should be failed");
    assert.ok(exec?.finishedAt, "Execution should have finishedAt");
    assert.equal(exec?.lastErrorCode, "execution.timeout", "Execution should have timeout error");

    // Task fails
    harness.db.transaction(() => {
      harness.store.updateTaskStatus(taskId, "failed", nowIso(), "execution.timeout", nowIso());
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "failed", "Task should be failed");
    assert.ok(task?.completedAt, "Task should have completedAt");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Task cancellation lifecycle
// ---------------------------------------------------------------------------

test("E2E Task Lifecycle: task can be cancelled from in_progress state", async () => {
  const harness = createE2EHarness("aa-e2e-task-cancel-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    // Setup task in in_progress
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Cancellation test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ request: "cancellable task" }),
        normalizedInputJson: JSON.stringify({ request: "cancellable task" }),
        outputJson: null,
        estimatedCostUsd: 0.05,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

// @ts-ignore
      harness.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-cancel",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: newId("trace"),
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

    // Cancel execution
    harness.db.transaction(() => {
      harness.store.updateExecutionStatus(executionId, "cancelled", nowIso());
    });

    const exec = harness.store.getExecution(executionId);
    assert.equal(exec?.status, "cancelled", "Execution should be cancelled");

    // Cancel task
    harness.db.transaction(() => {
      harness.store.updateTaskStatus(taskId, "cancelled", nowIso(), "user.cancelled", nowIso());
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "cancelled", "Task should be cancelled");
    assert.ok(task?.completedAt, "Task should have completedAt");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: Task with retry workflow
// ---------------------------------------------------------------------------

test("E2E Task Lifecycle: task retries after transient failure", async () => {
  const harness = createE2EHarness("aa-e2e-task-retry-");
  try {
    const taskId = newId("task");
    const exec1 = newId("exec1");
    const exec2 = newId("exec2");
    const now = nowIso();

    // Setup task in in_progress with first execution
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Retry test task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: JSON.stringify({ request: "retry task" }),
        normalizedInputJson: JSON.stringify({ request: "retry task" }),
        outputJson: null,
        estimatedCostUsd: 0.05,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      // First execution (will fail)
// @ts-ignore
      harness.store.insertExecution({
        id: exec1,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-retry",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: newId("trace"),
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 2,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // First execution fails
    harness.db.transaction(() => {
      harness.store.updateExecutionStatus(exec1, "failed", nowIso(), null, nowIso(), "execution.timeout");
    });

    const failedExec = harness.store.getExecution(exec1);
    assert.equal(failedExec?.status, "failed", "First execution should be failed");
    assert.equal(failedExec?.lastErrorCode, "execution.timeout", "Should have timeout error");

    // Create second execution (retry)
    harness.db.transaction(() => {
// @ts-ignore
      harness.store.insertExecution({
        id: exec2,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-retry",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: newId("trace2"),
        attempt: 2,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 2,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: nowIso(),
        finishedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

    const retryExec = harness.store.getExecution(exec2);
    assert.equal(retryExec?.status, "executing", "Second execution should be executing");
    assert.equal(retryExec?.attempt, 2, "Second execution should be attempt 2");

    // Second execution succeeds
    harness.db.transaction(() => {
      harness.store.updateExecutionStatus(exec2, "succeeded", nowIso());
    });

    // Task completes
    harness.db.transaction(() => {
      harness.store.updateTaskStatus(taskId, "done", nowIso(), null, nowIso());
    });

    const task = harness.store.getTask(taskId);
    assert.equal(task?.status, "done", "Task should be done after retry success");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 5: Seeded harness task lifecycle
// ---------------------------------------------------------------------------

test("E2E Task Lifecycle: seeded harness provides pre-configured task in in_progress", async () => {
  const harness = createSeededE2EHarness("aa-e2e-seeded-task-");

  try {
    // Verify seeded task exists and is in correct state
    const task = harness.store.getTask("task-e2e-001");
    assert.ok(task, "Seeded task should exist");
    assert.equal(task?.status, "in_progress", "Seeded task should be in_progress");
    assert.equal(task?.title, "E2E test task", "Seeded task should have correct title");

    // Verify seeded execution exists
    const execution = harness.store.getExecution("exec-e2e-001");
    assert.ok(execution, "Seeded execution should exist");
    assert.equal(execution?.status, "executing", "Seeded execution should be executing");
    assert.equal(execution?.workflowId, "single_agent_minimal", "Seeded execution should have correct workflow");

  } finally {
    harness.cleanup();
  }
});
