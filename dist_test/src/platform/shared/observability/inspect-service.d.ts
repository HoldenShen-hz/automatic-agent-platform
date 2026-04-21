/**
 * Inspect Service
 */
export * from "./inspect-service-support.js";
import type { CompactionRecord, FileLockRecord, MessageRecord, RemoteLogRecord } from "../../contracts/types/domain.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { type ApprovalInspectView, type DecisionInspectQuery, type DecisionInspectSummary, type ExecutionInspectView, type TaskInspectQuery, type TaskInspectSummary, type TaskInspectView, type WorkerInspectQuery, type WorkerInspectSummary, type WorkflowInspectQuery, type WorkflowInspectSummary } from "./inspect-service-support.js";
export declare class InspectService {
    private readonly store;
    private readonly runtimeRecovery;
    constructor(store: AuthoritativeTaskStore);
    /**
     * Builds a comprehensive inspect view for a task, including all related records.
     * The recovery summary indicates whether there's an active execution and if the
     * task has reached a terminal state.
     * @param taskId - The ID of the task to inspect
     * @param tenantId - Optional tenant ID for tenant-scoped access control
     * @returns Complete task inspect view with all associated records
     */
    getTaskInspectView(taskId: string, tenantId?: string | null): TaskInspectView;
    /**
     * Builds a comprehensive inspect view for a specific execution, including
     * the execution record, all executions for the task, and all related records.
     * @param executionId - The ID of the execution to inspect
     * @returns Complete execution inspect view
     * @throws Error if execution not found
     */
    getExecutionInspectView(executionId: string): ExecutionInspectView;
    /**
     * Builds a focused inspect view for a specific approval, including the approval
     * record and relevant context for approval review.
     * @param approvalId - The ID of the approval to inspect
     * @returns Approval inspect view with context
     * @throws Error if approval not found
     */
    getApprovalInspectView(approvalId: string): ApprovalInspectView;
    queryTaskInspectSummaries(query?: TaskInspectQuery): TaskInspectSummary[];
    queryWorkflowInspectSummaries(query?: WorkflowInspectQuery): WorkflowInspectSummary[];
    queryDecisionInspectSummaries(query?: DecisionInspectQuery): DecisionInspectSummary[];
    queryWorkerInspectSummaries(query?: WorkerInspectQuery): WorkerInspectSummary[];
    /**
     * Lists all session messages for a task by finding the session and fetching
     * its messages from the store.
     * @param taskId - The ID of the task whose session messages to list
     * @returns Array of message records for the task's session
     */
    listSessionMessages(taskId: string): MessageRecord[];
    /**
     * Lists all compaction records for a task's session.
     * @param taskId - The ID of the task whose compaction records to list
     * @returns Array of compaction records for the task's session
     */
    listSessionCompactionRecords(taskId: string): CompactionRecord[];
    /**
     * Lists all file locks currently held by a task.
     * @param taskId - The ID of the task whose file locks to list
     * @returns Array of file lock records for the task
     */
    listFileLocksByTask(taskId: string): FileLockRecord[];
    listRemoteLogsByTask(taskId: string): RemoteLogRecord[];
    private buildTaskInspectSummary;
    private buildWorkflowInspectSummary;
    private buildDecisionSummariesForTask;
}
