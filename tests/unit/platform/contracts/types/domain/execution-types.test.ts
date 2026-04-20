import assert from "node:assert/strict";
import test from "node:test";

import type {
  ExecutionRecord,
  ExecutionPrecheckRecord,
  DeadLetterRecord,
} from "../../../../../../src/platform/contracts/types/domain/execution-types.js";
import type { ExecutionStatus } from "../../../../../../src/platform/contracts/types/status.js";
import type { RunKind } from "../../../../../../src/platform/contracts/types/domain/primitives.js";

test("ExecutionRecord structure is correct", () => {
  const record: ExecutionRecord = {
    id: "exec_123",
    taskId: "task_456",
    workflowId: "workflow_789",
    parentExecutionId: null,
    agentId: "agent_abc",
    roleId: "executor",
    runKind: "task_run",
    status: "executing",
    inputRef: "input_ref_123",
    traceId: "trace_abc",
    attempt: 1,
    timeoutMs: 300000,
    budgetUsdLimit: 1.0,
    requiresApproval: 0,
    sandboxMode: "standard",
    allowedToolsJson: '["read","edit"]',
    allowedPathsJson: '["/workspace"]',
    maxRetries: 3,
    retryBackoff: "exponential",
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: "2026-04-14T00:00:00.000Z",
    finishedAt: null,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:05:00.000Z",
  };
  assert.equal(record.id, "exec_123");
  assert.equal(record.runKind, "task_run");
  assert.equal(record.status, "executing");
});

test("ExecutionRecord allows minimal definition", () => {
  const record: ExecutionRecord = {
    id: "exec_minimal",
    taskId: "task_123",
    workflowId: null,
    parentExecutionId: null,
    agentId: "agent_xyz",
    roleId: null,
    runKind: "tool_call",
    status: "created",
    inputRef: null,
    traceId: "trace_minimal",
    attempt: 1,
    timeoutMs: 60000,
    budgetUsdLimit: null,
    requiresApproval: 0,
    sandboxMode: null,
    allowedToolsJson: null,
    allowedPathsJson: null,
    maxRetries: 0,
    retryBackoff: "none",
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.workflowId, null);
  assert.equal(record.budgetUsdLimit, null);
  assert.equal(record.startedAt, null);
});

test("ExecutionRecord allows parent execution for nested executions", () => {
  const record: ExecutionRecord = {
    id: "exec_child",
    taskId: "task_123",
    workflowId: null,
    parentExecutionId: "exec_parent",
    agentId: "agent_abc",
    roleId: "subagent",
    runKind: "replay",
    status: "executing",
    inputRef: null,
    traceId: "trace_nested",
    attempt: 1,
    timeoutMs: 120000,
    budgetUsdLimit: 0.5,
    requiresApproval: 0,
    sandboxMode: "hardened",
    allowedToolsJson: null,
    allowedPathsJson: null,
    maxRetries: 1,
    retryBackoff: "linear",
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: "2026-04-14T00:00:00.000Z",
    finishedAt: null,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:05:00.000Z",
  };
  assert.equal(record.parentExecutionId, "exec_parent");
  assert.equal(record.runKind, "replay");
});

test("ExecutionRecord allows failed status with error", () => {
  const record: ExecutionRecord = {
    id: "exec_failed",
    taskId: "task_456",
    workflowId: null,
    parentExecutionId: null,
    agentId: "agent_def",
    roleId: "executor",
    runKind: "task_run",
    status: "failed",
    inputRef: null,
    traceId: "trace_failed",
    attempt: 2,
    timeoutMs: 60000,
    budgetUsdLimit: 0.1,
    requiresApproval: 0,
    sandboxMode: null,
    allowedToolsJson: null,
    allowedPathsJson: null,
    maxRetries: 3,
    retryBackoff: "exponential",
    lastErrorCode: "timeout",
    lastErrorMessage: "Execution timed out after 60 seconds",
    startedAt: "2026-04-14T00:00:00.000Z",
    finishedAt: "2026-04-14T00:01:00.000Z",
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:01:00.000Z",
  };
  assert.equal(record.status, "failed");
  assert.equal(record.lastErrorCode, "timeout");
  assert.equal(record.attempt, 2);
});

test("ExecutionRecord requiresApproval is 0 or 1", () => {
  const record1: ExecutionRecord = {
    id: "exec_1",
    taskId: "task_123",
    workflowId: null,
    parentExecutionId: null,
    agentId: "agent_abc",
    roleId: null,
    runKind: "task_run",
    status: "created",
    inputRef: null,
    traceId: "trace_1",
    attempt: 1,
    timeoutMs: 30000,
    budgetUsdLimit: null,
    requiresApproval: 0,
    sandboxMode: null,
    allowedToolsJson: null,
    allowedPathsJson: null,
    maxRetries: 0,
    retryBackoff: "none",
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record1.requiresApproval, 0);

  const record2: ExecutionRecord = {
    id: "exec_2",
    taskId: "task_456",
    workflowId: null,
    parentExecutionId: null,
    agentId: "agent_def",
    roleId: null,
    runKind: "approval_resume",
    status: "created",
    inputRef: null,
    traceId: "trace_2",
    attempt: 1,
    timeoutMs: 30000,
    budgetUsdLimit: null,
    requiresApproval: 1,
    sandboxMode: null,
    allowedToolsJson: null,
    allowedPathsJson: null,
    maxRetries: 0,
    retryBackoff: "none",
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record2.requiresApproval, 1);
});

test("ExecutionPrecheckRecord structure is correct", () => {
  const record: ExecutionPrecheckRecord = {
    id: "precheck_123",
    executionId: "exec_456",
    allowed: 1,
    reasonCode: null,
    resolvedBudgetUsd: 1.0,
    resolvedTimeoutMs: 300000,
    resolvedSandboxMode: "standard",
    resolvedToolsJson: '["read","edit","write"]',
    resolvedPathsJson: '["/workspace","/tmp"]',
    checkedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.allowed, 1);
  assert.equal(record.resolvedTimeoutMs, 300000);
});

test("ExecutionPrecheckRecord allows denied precheck", () => {
  const record: ExecutionPrecheckRecord = {
    id: "precheck_denied",
    executionId: "exec_789",
    allowed: 0,
    reasonCode: "budget_exceeded",
    resolvedBudgetUsd: null,
    resolvedTimeoutMs: 0,
    resolvedSandboxMode: "unknown",
    resolvedToolsJson: null,
    resolvedPathsJson: null,
    checkedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.allowed, 0);
  assert.equal(record.reasonCode, "budget_exceeded");
});

test("ExecutionPrecheckRecord resolved fields can be null when denied", () => {
  const record: ExecutionPrecheckRecord = {
    id: "precheck_blocked",
    executionId: "exec_blocked",
    allowed: 0,
    reasonCode: "tool_not_allowed",
    resolvedBudgetUsd: null,
    resolvedTimeoutMs: 0,
    resolvedSandboxMode: "",
    resolvedToolsJson: null,
    resolvedPathsJson: null,
    checkedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.resolvedBudgetUsd, null);
  assert.equal(record.resolvedToolsJson, null);
});

test("DeadLetterRecord structure is correct", () => {
  const record: DeadLetterRecord = {
    id: "dlq_123",
    executionId: "exec_456",
    taskId: "task_789",
    finalReasonCode: "max_retries_exceeded",
    retryCount: 3,
    lastErrorMessage: "All retry attempts failed",
    movedAt: "2026-04-14T00:30:00.000Z",
  };
  assert.equal(record.finalReasonCode, "max_retries_exceeded");
  assert.equal(record.retryCount, 3);
});

test("DeadLetterRecord allows null lastErrorMessage", () => {
  const record: DeadLetterRecord = {
    id: "dlq_minimal",
    executionId: "exec_noerror",
    taskId: "task_123",
    finalReasonCode: "cancelled",
    retryCount: 0,
    lastErrorMessage: null,
    movedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.lastErrorMessage, null);
  assert.equal(record.retryCount, 0);
});
