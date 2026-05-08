/**
 * Base Test Fixtures
 *
 * Minimal factories for creating valid test entities.
 * These create the smallest possible valid records for testing.
 */

import { nowIso } from "../../../src/platform/contracts/types/ids.js";
import type {
  TaskRecord,
  ExecutionRecord,
  ApprovalRecord,
} from "../../../src/platform/contracts/types/domain.js";

const DEFAULT_NOW = nowIso();

/**
 * Creates a minimal valid TaskRecord with required fields populated.
 * Optional fields are set to safe defaults.
 */
export function createMinimalTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "task-test-001",
    parentId: null,
    rootId: "task-test-001",
    divisionId: "general_ops",
    tenantId: null,
    title: "Test task",
    status: "queued",
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: DEFAULT_NOW,
    updatedAt: DEFAULT_NOW,
    completedAt: null,
    ...overrides,
  };
}

/**
 * Creates a minimal valid ExecutionRecord with required fields populated.
 * Requires a valid taskId that references an existing task.
 */
export function createMinimalExecution(
  taskId: string,
  overrides: Partial<ExecutionRecord> = {},
): ExecutionRecord {
  return {
    id: "exec-test-001",
    taskId,
    workflowId: "single_agent_minimal",
    parentExecutionId: null,
    agentId: "agent-test-001",
    roleId: "general_executor",
    runKind: "task_run",
    status: "executing",
    inputRef: null,
    traceId: "trace-test-001",
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
    startedAt: DEFAULT_NOW,
    finishedAt: null,
    createdAt: DEFAULT_NOW,
    updatedAt: DEFAULT_NOW,
    ...overrides,
  };
}

/**
 * Creates a minimal valid ApprovalRecord.
 */
export function createMinimalApproval(overrides: Partial<ApprovalRecord> = {}): ApprovalRecord {
  return {
    id: "approval-test-001",
    taskId: "task-test-001",
    executionId: null,
    status: "requested",
    requestJson: '{"reason":"test"}',
    responseJson: null,
    timeoutPolicy: "remain_pending",
    createdAt: DEFAULT_NOW,
    respondedAt: null,
    ...overrides,
  };
}
