/**
 * AsyncWorkflowRepository - Async data access for workflow state records.
 */
import type { StepOutputRecord, WorkflowStateRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncWorkflowRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    insertWorkflowState(workflow: WorkflowStateRecord): Promise<void>;
    insertStepOutput(stepOutput: StepOutputRecord): Promise<void>;
    getWorkflowState(taskId: string, tenantId?: string | null): Promise<WorkflowStateRecord | null>;
    listWorkflowStates(tenantId?: string | null): Promise<WorkflowStateRecord[]>;
    updateWorkflowState(taskId: string, status: string, currentStepIndex: number, outputsJson: string, updatedAt: string, resumableFromStep?: string | null): Promise<void>;
    updateWorkflowRecoveryState(input: {
        taskId: string;
        status: string;
        currentStepIndex: number;
        outputsJson: string;
        updatedAt: string;
        resumableFromStep: string | null;
        retryCount: number;
        lastErrorCode: string | null;
    }): Promise<void>;
}
