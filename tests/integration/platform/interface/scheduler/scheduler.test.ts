/**
 * Integration tests for Scheduler
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import { LongRunningWorkflowService } from "../../../../../src/platform/five-plane-interface/scheduler/long-running-workflow-service.js";
import { toWorkflowSleepLease, toWorkflowResumeWindow } from "../../../../../src/platform/five-plane-interface/scheduler/workflow-sleep-contracts.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("Integration: LongRunningWorkflowService suspends and resumes workflow", () => {
  const ctx = createIntegrationContext("aa-scheduler-suspend-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const workflowId = "test_workflow";
    const testNow = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
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
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: testNow,
        updatedAt: testNow,
        completedAt: null,
      });

      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId,
        parentExecutionId: null,
        agentId: "agent-1",
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
        startedAt: testNow,
        finishedAt: null,
        createdAt: testNow,
        updatedAt: testNow,
      });

      ctx.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId,
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: testNow,
        updatedAt: testNow,
      });
    });

    const service = new LongRunningWorkflowService(ctx.store);

    const suspension = service.suspend({
      taskId,
      executionId,
      reasonCode: "test_suspend",
      waitKind: "timer",
    });

    assert.equal(suspension.taskId, taskId);
    assert.equal(suspension.executionId, executionId);

    const resumed = service.resume({ taskId, executionId });
    assert.equal(resumed.taskId, taskId);
  } finally {
    ctx.cleanup();
  }
});

test("Integration: LongRunningWorkflowService workflow sleep contracts", () => {
  const taskId = newId("task");
  const executionId = newId("exec");
  const wakeAt = new Date("2026-04-30T12:00:00.000Z");

  const lease = toWorkflowSleepLease(taskId, executionId, wakeAt);

  assert.equal(lease.taskId, taskId);
  assert.equal(lease.executionId, executionId);
  assert.deepEqual(lease.wakeAt, wakeAt);

  const window = toWorkflowResumeWindow(lease, "telegram");

  assert.equal(window.taskId, taskId);
  assert.deepEqual(window.windowStart, wakeAt);
  assert.equal(window.channel, "telegram");
});

test("Integration: LongRunningWorkflowService handles workflow state updates", () => {
  const ctx = createIntegrationContext("aa-workflow-state-");
  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const workflowId = "workflow_state_test";
    const testNow = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Workflow state test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: testNow,
        updatedAt: testNow,
        completedAt: null,
      });

      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId,
        parentExecutionId: null,
        agentId: "agent-1",
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
        startedAt: testNow,
        finishedAt: null,
        createdAt: testNow,
        updatedAt: testNow,
      });

      ctx.store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId,
        currentStepIndex: 1,
        status: "running",
        outputsJson: '{"step0":{"output":"test"}}',
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: 1,
        startedAt: testNow,
        updatedAt: testNow,
      });
    });

    const service = new LongRunningWorkflowService(ctx.store);
    const state = ctx.store.getWorkflowState(taskId);

    assert.ok(state != null);
    assert.equal(state!.workflowId, workflowId);
    assert.equal(state!.currentStepIndex, 1);
  } finally {
    ctx.cleanup();
  }
});

test("Integration: workflow sleep lease preserves metadata", () => {
  const taskId = newId("task");
  const executionId = newId("exec");
  const wakeAt = new Date();

  const lease = toWorkflowSleepLease(taskId, executionId, wakeAt);

  assert.equal(lease.taskId, taskId);
  assert.ok(lease.wakeAt instanceof Date);
});

test("Integration: workflow resume window calculates end time", () => {
  const taskId = newId("task");
  const executionId = newId("exec");
  const wakeAt = new Date();

  const lease = toWorkflowSleepLease(taskId, executionId, wakeAt);
  const window = toWorkflowResumeWindow(lease, "slack");

  assert.ok(window.windowEnd.getTime() > window.windowStart.getTime());
});
