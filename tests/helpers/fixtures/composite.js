/**
 * Composite Test Fixtures
 *
 * Factory functions for creating complex test states that involve
 * multiple related entities with specific relationships.
 *
 * R6-32 FIX: Added canonical composite fixtures for HarnessRun+PlanGraphBundle+NodeRun.
 */
import { nowIso } from "../../../src/platform/contracts/types/ids.js";
import { createMinimalHarnessRun, createMinimalPlanGraphBundle, createMinimalNodeRun, createMinimalBudgetLedger, createMinimalBudgetReservation, } from "./base.js";
const DEFAULT_NOW = nowIso();
/**
 * Creates a task in blocked_pending_approval status.
 * Use this when testing approval flow scenarios.
 */
export function createBlockedTask(taskId, executionId, overrides = {}) {
    const task = {
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
    const execution = {
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
export function createApprovalRequest(approvalId, taskId, executionId, overrides = {}) {
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
export function createCompletedTask(taskId, executionId, overrides = {}) {
    const completedAt = new Date().toISOString();
    const task = {
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
    const execution = {
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
export function createFailedTask(taskId, executionId, errorCode = "task.execution_failed", overrides = {}) {
    const failedAt = new Date().toISOString();
    const task = {
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
    const execution = {
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
// =============================================================================
// R6-32 FIX: Canonical Model Composite Fixtures
// These replace the deprecated TaskRecord+ExecutionRecord pattern.
// =============================================================================
/**
 * Creates a complete HarnessRun with PlanGraphBundle ready for execution.
 * Use this when testing multi-step orchestration flows.
 */
export function createCompleteHarnessRun(harnessRunId, confirmedTaskSpecId, options = {}) {
    const { status = "created", nodeIds = ["init", "process", "final"] } = options;
    // Build nodes and edges for the graph
    const nodes = nodeIds.map((nodeId, idx) => ({
        nodeId,
        nodeType: "tool",
        inputRefs: idx > 0 ? [nodeIds[idx - 1]] : [],
        outputSchemaRef: "schema://test",
        riskClass: "low",
        budgetIntent: { amount: 100, currency: "USD", resourceKinds: ["token"] },
        sideEffectProfile: { mayCommitExternalEffect: false, reversible: false },
        retryPolicyRef: "retry:default",
        timeoutMs: 30000,
    }));
    const edges = nodeIds.slice(1).map((nodeId, idx) => ({
        edgeId: `edge-${nodeIds[idx]}-${nodeId}`,
        fromNodeId: nodeIds[idx],
        toNodeId: nodeId,
        condition: true,
        dependencyType: "hard",
    }));
    // Build graph directly with the correct structure
    const graph = {
        graphId: `graph-${harnessRunId}`,
        nodes: nodes,
        edges: edges,
        entryNodeIds: [nodeIds[0]],
        terminalNodeIds: [nodeIds[nodeIds.length - 1]],
        joinStrategy: "all",
        graphHash: `hash-${harnessRunId}`,
    };
    const planGraphBundle = createMinimalPlanGraphBundle(harnessRunId);
    const harnessRun = createMinimalHarnessRun({
        harnessRunId,
        confirmedTaskSpecId,
        status,
        planGraphBundleId: planGraphBundle.planGraphBundleId,
    });
    const budgetLedger = createMinimalBudgetLedger(harnessRunId);
    const nodeRuns = nodes.map((node) => createMinimalNodeRun(harnessRunId, planGraphBundle.planGraphBundleId, {
        nodeId: node.nodeId,
    }));
    return {
        harnessRun,
        planGraphBundle: {
            ...planGraphBundle,
            graph,
        },
        budgetLedger,
        nodeRuns,
    };
}
/**
 * Creates a harness run with active budget reservation for a specific node.
 * Use this when testing budget-guarded execution flows.
 */
export function createBudgetReservedHarnessRun(harnessRunId, nodeRunId, options = {}) {
    const { amount = 100, resourceKind = "token" } = options;
    const harnessRun = createMinimalHarnessRun({ harnessRunId, status: "running" });
    const planGraphBundle = createMinimalPlanGraphBundle(harnessRunId);
    const budgetLedger = createMinimalBudgetLedger(harnessRunId, {
        reservedAmount: amount,
        status: "open",
    });
    const budgetReservation = createMinimalBudgetReservation(budgetLedger.budgetLedgerId, harnessRunId, {
        nodeRunId,
        amount,
        resourceKind: resourceKind,
    });
    return { harnessRun, planGraphBundle, budgetLedger, budgetReservation };
}
//# sourceMappingURL=composite.js.map