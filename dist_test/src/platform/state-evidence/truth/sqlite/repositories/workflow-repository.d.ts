/**
 * WorkflowRepository - Data access for workflow state records.
 *
 * This repository handles all data access for:
 * - WorkflowStateRecord (workflow_state table)
 *
 * All SQL queries use proper column aliasing to match the camelCase domain types.
 */
import type { StepOutputRecord, WorkflowStateRecord } from "../../../../contracts/types/domain.js";
import type { SqliteConnection } from "../query-helper.js";
export declare class WorkflowRepository {
    private readonly conn;
    constructor(conn: SqliteConnection);
    insertWorkflowState(workflow: WorkflowStateRecord): void;
    insertStepOutput(stepOutput: StepOutputRecord): void;
    /**
     * Get workflow state for a task.
     */
    getWorkflowState(taskId: string, tenantId?: string | null): WorkflowStateRecord | null;
    /**
     * List all workflow states.
     */
    listWorkflowStates(tenantId?: string | null): WorkflowStateRecord[];
    updateWorkflowState(taskId: string, status: string, currentStepIndex: number, outputsJson: string, updatedAt: string, resumableFromStep?: string | null): void;
    updateWorkflowRecoveryState(input: {
        taskId: string;
        status: string;
        currentStepIndex: number;
        outputsJson: string;
        updatedAt: string;
        resumableFromStep: string | null;
        retryCount: number;
        lastErrorCode: string | null;
    }): void;
}
