/**
 * Composite Test Fixtures
 *
 * Factory functions for creating complex test states that involve
 * multiple related entities with specific relationships.
 */
import type { TaskRecord, ExecutionRecord, ApprovalRecord } from "../../../src/platform/contracts/types/domain.js";
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
