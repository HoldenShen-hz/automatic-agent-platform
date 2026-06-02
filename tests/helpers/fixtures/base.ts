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
import {
  createSideEffectRecord as createCanonicalSideEffectRecord,
} from "../../../src/platform/contracts/executable-contracts/index.js";
import {
  createMinimalBudgetLedger as createCanonicalBudgetLedger,
  createMinimalBudgetReservation as createCanonicalBudgetReservation,
  createMinimalHarnessRun as createCanonicalHarnessRun,
  createMinimalNodeRun as createCanonicalNodeRun,
  createMinimalPlanEdge as createCanonicalPlanEdge,
  createMinimalPlanGraphBundle as createCanonicalPlanGraphBundle,
  createMinimalPlanNode as createCanonicalPlanNode,
} from "./canonical.js";
import type {
  BudgetLedger,
  BudgetReservation,
  HarnessRun,
  NodeRun,
  PlanEdge,
  PlanGraphBundle,
  PlanNode,
} from "../../../src/platform/contracts/executable-contracts/index.js";

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
    divisionId: "general-ops",
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
    harnessRunId: null,
    agentId: "agent-test-001",
    roleId: "general_executor",
    runKind: "task_run",
    status: "executing",
    inputRef: null,
    traceId: "trace-test-001",
    attempt: 1,
    timeoutMs: 60000,
    budgetUsdLimit: 1.0,
    budgetReservationId: null,
    budgetLedgerId: null,
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

export { createCanonicalSideEffectRecord as createSideEffectRecord };

export function createMinimalHarnessRun(overrides: Partial<HarnessRun> = {}): HarnessRun {
  return createCanonicalHarnessRun({
    tenantId: "tenant-test-001",
    budgetLedgerId: overrides.budgetLedgerId ?? "bledger-test-001",
    overrides: {
      harnessRunId: "hrun-test-001",
      currentSeq: 0,
      ...overrides,
    },
  });
}

export function createMinimalPlanNode(nodeId: string, overrides: Partial<PlanNode> = {}): PlanNode {
  return createCanonicalPlanNode({
    nodeId,
    timeoutMs: 30000,
    overrides,
  });
}

export function createMinimalPlanEdge(
  edgeId: string,
  fromNodeId: string,
  toNodeId: string,
  overrides: Partial<PlanEdge> = {},
): PlanEdge {
  return createCanonicalPlanEdge({
    edgeId,
    fromNodeId,
    toNodeId,
    condition: overrides.condition ?? true,
    dependencyType: overrides.dependencyType ?? "hard",
  });
}

export function createMinimalPlanGraphBundle(
  harnessRunId: string,
  overrides: Partial<PlanGraphBundle> = {},
): PlanGraphBundle {
  const nodes = overrides.graph?.nodes ?? [
    createMinimalPlanNode("init"),
    createMinimalPlanNode("process"),
  ];
  const edges = overrides.graph?.edges ?? [
    createMinimalPlanEdge("edge-init-process", nodes[0]!.nodeId, nodes[1]!.nodeId),
  ];
  return createCanonicalPlanGraphBundle({
    harnessRunId,
    planGraphBundleId: overrides.planGraphBundleId ?? "pgb-test-001",
    graphVersion: overrides.graphVersion ?? 1,
    graph: {
      graphId: overrides.graph?.graphId ?? "graph-test-001",
      nodes,
      edges,
      entryNodeIds: overrides.graph?.entryNodeIds ?? [nodes[0]!.nodeId],
      terminalNodeIds: overrides.graph?.terminalNodeIds ?? [nodes[nodes.length - 1]!.nodeId],
      joinStrategy: overrides.graph?.joinStrategy ?? "all",
      graphHash: overrides.graph?.graphHash ?? "sha256:test-graph",
    },
    overrides,
  });
}

export function createMinimalNodeRun(
  harnessRunId: string,
  planGraphBundleId: string,
  overrides: Partial<NodeRun> = {},
): NodeRun {
  return createCanonicalNodeRun({
    harnessRunId,
    planGraphBundleId,
    nodeId: overrides.nodeId ?? "node-test-001",
    nodeRunId: overrides.nodeRunId ?? "nrun-test-001",
    status: overrides.status ?? "created",
    attemptCount: overrides.attemptCount ?? 0,
    currentSeq: overrides.currentSeq ?? 0,
    overrides,
  });
}

export function createMinimalBudgetLedger(
  harnessRunId: string,
  overrides: Partial<BudgetLedger> = {},
): BudgetLedger {
  return createCanonicalBudgetLedger({
    harnessRunId,
    budgetLedgerId: overrides.budgetLedgerId ?? "bledger-test-001",
    hardCap: overrides.hardCap ?? 1000,
    reservedAmount: overrides.reservedAmount ?? 0,
    overrides,
  });
}

export function createMinimalBudgetReservation(
  budgetLedgerId: string,
  harnessRunId: string,
  overrides: Partial<BudgetReservation> = {},
): BudgetReservation {
  return createCanonicalBudgetReservation({
    budgetLedgerId,
    harnessRunId,
    budgetReservationId: overrides.budgetReservationId ?? "bresv-test-001",
    amount: overrides.amount ?? 100,
    resourceKind: overrides.resourceKind ?? "token",
    status: overrides.status ?? "reserved",
    ...(overrides.nodeRunId != null ? { nodeRunId: overrides.nodeRunId } : {}),
    overrides,
  });
}
