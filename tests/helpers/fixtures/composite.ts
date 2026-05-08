/**
 * Composite Test Fixtures
 *
 * Factory functions for creating complex test states that involve
 * multiple related entities with specific relationships.
 */

import { nowIso } from "../../../src/platform/contracts/types/ids.js";
import type {
  TaskRecord,
  ExecutionRecord,
  ApprovalRecord,
} from "../../../src/platform/contracts/types/domain.js";
import type {
  BudgetLedger,
  BudgetReservation,
  HarnessRun,
  NodeRun,
  PlanGraphBundle,
} from "../../../src/platform/contracts/executable-contracts/index.js";
import {
  createMinimalBudgetLedger,
  createMinimalBudgetReservation,
  createMinimalHarnessRun,
  createMinimalNodeRun,
  createMinimalPlanGraphBundle,
} from "./canonical.js";

const DEFAULT_NOW = nowIso();

/**
 * Creates a task in blocked_pending_approval status.
 * Use this when testing approval flow scenarios.
 */
export function createBlockedTask(
  taskId: string,
  executionId: string,
  overrides: Partial<TaskRecord> = {},
): { task: TaskRecord; execution: ExecutionRecord } {
  const task: TaskRecord = {
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general_ops",
    tenantId: null,
    title: "Blocked task",
    status: "pending",
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

  const execution: ExecutionRecord = {
    id: executionId,
    taskId,
    workflowId: "single_agent_minimal",
    parentExecutionId: null,
    agentId: "agent-blocked-001",
    roleId: "general_executor",
    runKind: "task_run",
    status: "executing",
    inputRef: null,
    traceId: `trace-${executionId}`,
    attempt: 1,
    timeoutMs: 60000,
    budgetUsdLimit: 1.0,
    requiresApproval: 1,
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
  };

  return { task, execution };
}

/**
 * Creates an approval request linked to a task and execution.
 */
export function createApprovalRequest(
  approvalId: string,
  taskId: string,
  executionId: string,
  overrides: Partial<ApprovalRecord> = {},
): ApprovalRecord {
  return {
    id: approvalId,
    taskId,
    executionId,
    status: "requested",
    requestJson: '{"reason":"test approval","riskLevel":"low"}',
    responseJson: null,
    timeoutPolicy: "remain_pending",
    createdAt: DEFAULT_NOW,
    respondedAt: null,
    ...overrides,
  };
}

/**
 * Creates a completed task with successful execution.
 */
export function createCompletedTask(
  taskId: string,
  executionId: string,
  overrides: Partial<TaskRecord> = {},
): { task: TaskRecord; execution: ExecutionRecord } {
  const completedAt = new Date().toISOString();

  const task: TaskRecord = {
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general_ops",
    tenantId: null,
    title: "Completed task",
    status: "done",
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: '{"result":"success"}',
    estimatedCostUsd: null,
    actualCostUsd: 0.05,
    errorCode: null,
    createdAt: DEFAULT_NOW,
    updatedAt: completedAt,
    completedAt,
    ...overrides,
  };

  const execution: ExecutionRecord = {
    id: executionId,
    taskId,
    workflowId: "single_agent_minimal",
    parentExecutionId: null,
    agentId: "agent-success-001",
    roleId: "general_executor",
    runKind: "task_run",
    status: "succeeded",
    inputRef: null,
    traceId: `trace-${executionId}`,
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
    finishedAt: completedAt,
    createdAt: DEFAULT_NOW,
    updatedAt: completedAt,
  };

  return { task, execution };
}

/**
 * Creates a failed task with error details.
 */
export function createFailedTask(
  taskId: string,
  executionId: string,
  errorCode: string = "task.execution_failed",
  overrides: Partial<TaskRecord> = {},
): { task: TaskRecord; execution: ExecutionRecord } {
  const failedAt = new Date().toISOString();

  const task: TaskRecord = {
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general_ops",
    tenantId: null,
    title: "Failed task",
    status: "failed",
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0.02,
    errorCode,
    createdAt: DEFAULT_NOW,
    updatedAt: failedAt,
    completedAt: failedAt,
    ...overrides,
  };

  const execution: ExecutionRecord = {
    id: executionId,
    taskId,
    workflowId: "single_agent_minimal",
    parentExecutionId: null,
    agentId: "agent-failed-001",
    roleId: "general_executor",
    runKind: "task_run",
    status: "failed",
    inputRef: null,
    traceId: `trace-${executionId}`,
    attempt: 1,
    timeoutMs: 60000,
    budgetUsdLimit: 1.0,
    requiresApproval: 0,
    sandboxMode: "workspace_write",
    allowedToolsJson: "[]",
    allowedPathsJson: "[]",
    maxRetries: 0,
    retryBackoff: "none",
    lastErrorCode: errorCode,
    lastErrorMessage: "Execution failed",
    startedAt: DEFAULT_NOW,
    finishedAt: failedAt,
    createdAt: DEFAULT_NOW,
    updatedAt: failedAt,
  };

  return { task, execution };
}

export function createCompleteHarnessRun(
  harnessRunId: string,
  confirmedTaskSpecId: string,
  overrides: {
    nodeIds?: readonly string[];
    status?: HarnessRun["status"];
  } = {},
): {
  harnessRun: HarnessRun;
  planGraphBundle: PlanGraphBundle;
  budgetLedger: BudgetLedger;
  nodeRuns: NodeRun[];
} {
  const nodeIds = overrides.nodeIds ?? ["init", "process", "final"];
  const planGraphBundle = createMinimalPlanGraphBundle({
    harnessRunId,
    graph: {
      graphId: "graph-test-001",
      nodes: nodeIds.map((nodeId) => ({
        nodeId,
        nodeType: "tool",
        inputRefs: [],
        outputSchemaRef: "test://schema/output",
        riskClass: "low",
        budgetIntent: { amount: 100, currency: "USD", resourceKinds: ["token"] },
        sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
        retryPolicyRef: "test-retry-policy",
        timeoutMs: 30000,
      })),
      edges: nodeIds.slice(1).map((nodeId, index) => ({
        edgeId: `edge-${index}`,
        fromNodeId: nodeIds[index]!,
        toNodeId: nodeId,
        condition: true,
        dependencyType: "hard",
      })),
      entryNodeIds: [nodeIds[0]!],
      terminalNodeIds: [nodeIds[nodeIds.length - 1]!],
      joinStrategy: "all",
      graphHash: "sha256:test-graph",
    },
  });
  const budgetLedger = createMinimalBudgetLedger({ harnessRunId });
  const harnessRun = createMinimalHarnessRun({
    confirmedTaskSpecId,
    planGraphBundleId: planGraphBundle.planGraphBundleId,
    budgetLedgerId: budgetLedger.budgetLedgerId,
    status: overrides.status ?? "created",
    overrides: {
      harnessRunId,
    },
  });
  const nodeRuns = nodeIds.map((nodeId) =>
    createMinimalNodeRun({
      harnessRunId,
      planGraphBundleId: planGraphBundle.planGraphBundleId,
      nodeId,
    }),
  );

  return { harnessRun, planGraphBundle, budgetLedger, nodeRuns };
}

export function createBudgetReservedHarnessRun(
  harnessRunId: string,
  nodeRunId: string,
  overrides: {
    amount?: number;
    resourceKind?: BudgetReservation["resourceKind"];
  } = {},
): {
  harnessRun: HarnessRun;
  planGraphBundle: PlanGraphBundle;
  budgetLedger: BudgetLedger;
  budgetReservation: BudgetReservation;
} {
  const complete = createCompleteHarnessRun(harnessRunId, "ctspec-test-001", {
    status: "running",
  });
  const budgetLedger = createMinimalBudgetLedger({
    harnessRunId,
    budgetLedgerId: complete.budgetLedger.budgetLedgerId,
    reservedAmount: overrides.amount ?? 100,
  });
  const budgetReservation = createMinimalBudgetReservation({
    budgetLedgerId: budgetLedger.budgetLedgerId,
    harnessRunId,
    nodeRunId,
    amount: overrides.amount ?? 100,
    resourceKind: overrides.resourceKind ?? "token",
  });

  return {
    harnessRun: {
      ...complete.harnessRun,
      status: "running",
      budgetLedgerId: budgetLedger.budgetLedgerId,
    },
    planGraphBundle: complete.planGraphBundle,
    budgetLedger,
    budgetReservation,
  };
}
