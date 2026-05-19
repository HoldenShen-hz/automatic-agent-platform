/**
 * Composite Test Fixtures
 *
 * Factory functions for creating complex test states that involve
 * multiple related entities with specific relationships.
 *
 * R6-32 FIX: Added canonical composite fixtures for HarnessRun+PlanGraphBundle+NodeRun.
 */
import type { TaskRecord, ExecutionRecord, ApprovalRecord } from "../../../src/platform/contracts/types/domain.js";
import type { HarnessRun, PlanGraphBundle, NodeRun, BudgetLedger, BudgetReservation } from "../../../src/platform/contracts/executable-contracts/index.js";
/**
 * Creates a task in blocked_pending_approval status.
 * Use this when testing approval flow scenarios.
 */
export declare function createBlockedTask(taskId: string, executionId: string, overrides?: Partial<TaskRecord>): {
    task: TaskRecord;
    execution: ExecutionRecord;
};
/**
 * Creates an approval request linked to a task and execution.
 */
export declare function createApprovalRequest(approvalId: string, taskId: string, executionId: string, overrides?: Partial<ApprovalRecord>): ApprovalRecord;
/**
 * Creates a completed task with successful execution.
 */
export declare function createCompletedTask(taskId: string, executionId: string, overrides?: Partial<TaskRecord>): {
    task: TaskRecord;
    execution: ExecutionRecord;
};
/**
 * Creates a failed task with error details.
 */
export declare function createFailedTask(taskId: string, executionId: string, errorCode?: string, overrides?: Partial<TaskRecord>): {
    task: TaskRecord;
    execution: ExecutionRecord;
};
/**
 * Creates a complete HarnessRun with PlanGraphBundle ready for execution.
 * Use this when testing multi-step orchestration flows.
 */
export declare function createCompleteHarnessRun(harnessRunId: string, confirmedTaskSpecId: string, options?: {
    status?: "created" | "admitted" | "planning" | "ready" | "running";
    nodeIds?: string[];
}): {
    harnessRun: HarnessRun;
    planGraphBundle: PlanGraphBundle;
    budgetLedger: BudgetLedger;
    nodeRuns: NodeRun[];
};
/**
 * Creates a harness run with active budget reservation for a specific node.
 * Use this when testing budget-guarded execution flows.
 */
export declare function createBudgetReservedHarnessRun(harnessRunId: string, nodeRunId: string, options?: {
    amount?: number;
    resourceKind?: "token" | "tool" | "api" | "compute";
}): {
    harnessRun: HarnessRun;
    planGraphBundle: PlanGraphBundle;
    budgetLedger: BudgetLedger;
    budgetReservation: BudgetReservation;
};
