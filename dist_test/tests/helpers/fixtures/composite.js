/**
 * Composite Test Fixtures
 *
 * Factory functions for creating complex test states that involve
 * multiple related entities with specific relationships.
 */
import { nowIso } from "../../../src/platform/contracts/types/ids.js";
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
//# sourceMappingURL=composite.js.map