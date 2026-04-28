/**
 * Base Test Fixtures
 *
 * Minimal factories for creating valid test entities.
 * These create the smallest possible valid records for testing.
 *
 * R6-32 FIX: Added canonical fixture factories for HarnessRun/NodeRun/PlanGraphBundle/BudgetReservation.
 */

import { nowIso } from "../../../src/platform/contracts/types/ids.js";
import type {
  TaskRecord,
  ExecutionRecord,
  ApprovalRecord,
} from "../../../src/platform/contracts/types/domain.js";
import type {
  HarnessRun,
  HarnessRunStatus,
  PlanGraphBundle,
  PlanNode,
  PlanEdge,
  NodeRun,
  NodeRunStatus,
  BudgetLedger,
  BudgetReservation,
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

// =============================================================================
// R6-32 FIX: Canonical Model Fixture Factories
// These replace the deprecated TaskRecord+ExecutionRecord pattern.
// =============================================================================

/**
 * Creates a minimal valid HarnessRun with required fields populated.
 * This is the canonical replacement for ExecutionRecord-based fixtures.
 */
export function createMinimalHarnessRun(overrides: Partial<HarnessRun> = {}): HarnessRun {
  return {
    harnessRunId: "hrun-test-001",
    tenantId: "tenant-test-001",
    confirmedTaskSpecId: "ctspec-test-001",
    requestEnvelopeId: "request-test-001",
    requestHash: "hash-test-001",
    status: "created" as HarnessRunStatus,
    constraintPackRef: "constraints:test",
    versionLockId: "vlock-test-001",
    budgetLedgerId: "bledger-test-001",
    currentSeq: 0,
    createdAt: DEFAULT_NOW,
    updatedAt: DEFAULT_NOW,
    ...overrides,
  };
}

/**
 * Creates a minimal PlanNode for use in PlanGraphBundle fixtures.
 */
export function createMinimalPlanNode(nodeId: string, overrides: Partial<PlanNode> = {}): PlanNode {
  return {
    nodeId,
    nodeType: "tool",
    inputRefs: [],
    outputSchemaRef: "schema://test",
    riskClass: "low",
    budgetIntent: { amount: 100, currency: "USD", resourceKinds: ["token"] },
    sideEffectProfile: { mayCommitExternalEffect: false, reversible: false },
    retryPolicyRef: "retry:default",
    timeoutMs: 30000,
    ...overrides,
  };
}

/**
 * Creates a minimal PlanEdge for connecting nodes in a PlanGraph.
 */
export function createMinimalPlanEdge(
  edgeId: string,
  fromNodeId: string,
  toNodeId: string,
  overrides: Partial<PlanEdge> = {},
): PlanEdge {
  return {
    edgeId,
    fromNodeId,
    toNodeId,
    condition: true,
    dependencyType: "hard",
    ...overrides,
  };
}

/**
 * Creates a minimal PlanGraphBundle for testing.
 * This is the canonical replacement for ExecutionPlan-based fixtures.
 */
export function createMinimalPlanGraphBundle(harnessRunId: string, overrides: Partial<PlanGraphBundle> = {}): PlanGraphBundle {
  const initNode = createMinimalPlanNode("init");
  const processNode = createMinimalPlanNode("process");
  const edge = createMinimalPlanEdge("edge-init-process", "init", "process");

  return {
    planGraphBundleId: "pgb-test-001",
    harnessRunId,
    graphVersion: 1,
    graph: {
      graphId: "graph-test-001",
      nodes: [initNode, processNode],
      edges: [edge],
      entryNodeIds: ["init"],
      terminalNodeIds: ["process"],
      joinStrategy: "all",
      graphHash: "hash-test-001",
    },
    schedulerPolicy: { policyId: "default", strategy: "deterministic_fifo" },
    budgetPlanRef: "budget-plan:test",
    riskProfile: { riskClass: "low", reasons: [] },
    validationReport: { valid: true, findings: [] },
    artifactRefs: [],
    createdAt: DEFAULT_NOW,
    ...overrides,
  };
}

/**
 * Creates a minimal valid NodeRun with required fields populated.
 * This represents a single node execution within a HarnessRun.
 */
export function createMinimalNodeRun(harnessRunId: string, planGraphBundleId: string, overrides: Partial<NodeRun> = {}): NodeRun {
  return {
    nodeRunId: "nrun-test-001",
    harnessRunId,
    planGraphBundleId,
    graphVersion: 1,
    nodeId: "test-node",
    status: "created" as NodeRunStatus,
    attemptCount: 0,
    currentSeq: 0,
    createdAt: DEFAULT_NOW,
    updatedAt: DEFAULT_NOW,
    ...overrides,
  };
}

/**
 * Creates a minimal valid BudgetLedger for testing.
 * BudgetLedger tracks the overall budget for a HarnessRun.
 */
export function createMinimalBudgetLedger(harnessRunId: string, overrides: Partial<BudgetLedger> = {}): BudgetLedger {
  return {
    budgetLedgerId: "bledger-test-001",
    tenantId: "tenant-test-001",
    harnessRunId,
    currency: "USD",
    hardCap: 1000,
    reservedAmount: 0,
    settledAmount: 0,
    releasedAmount: 0,
    status: "open",
    version: 0,
    ...overrides,
  };
}

/**
 * Creates a minimal valid BudgetReservation for testing.
 * BudgetReservation tracks reserved budget for a specific NodeRun within a HarnessRun.
 */
export function createMinimalBudgetReservation(
  budgetLedgerId: string,
  harnessRunId: string,
  overrides: Partial<BudgetReservation> = {},
): BudgetReservation {
  return {
    budgetReservationId: "bresv-test-001",
    budgetLedgerId,
    harnessRunId,
    amount: 100,
    resourceKind: "token",
    status: "reserved",
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    createdAt: DEFAULT_NOW,
    ...overrides,
  };
}
