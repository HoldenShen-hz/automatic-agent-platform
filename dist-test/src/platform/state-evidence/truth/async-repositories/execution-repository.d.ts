/**
 * AsyncExecutionRepository - Async data access for executions and related entities.
 *
 * This is the async PostgreSQL-compatible version of ExecutionRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */
import type { ExecutionRecord, ExecutionPrecheckRecord, DeadLetterRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncExecutionRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    insertExecution(execution: ExecutionRecord): Promise<void>;
    getExecution(executionId: string): Promise<ExecutionRecord | null>;
    listExecutionsByTask(taskId: string, tenantId?: string | null): Promise<ExecutionRecord[]>;
    listExecutionsByStatuses(statuses: string[], limit?: number, cursor?: string | null): Promise<ExecutionRecord[]>;
    updateExecutionStatus(executionId: string, status: string, updatedAt: string, startedAt?: string | null, finishedAt?: string | null, lastErrorCode?: string | null): Promise<number>;
    updateExecutionFailure(input: {
        executionId: string;
        status: ExecutionRecord["status"];
        updatedAt: string;
        finishedAt: string | null;
        lastErrorCode: string | null;
        lastErrorMessage: string | null;
    }): Promise<number>;
    updateExecutionAgent(executionId: string, agentId: string, updatedAt: string): Promise<number>;
    countActiveExecutions(): Promise<number>;
    insertExecutionPrecheck(precheck: ExecutionPrecheckRecord): Promise<void>;
    getExecutionPrecheck(executionId: string): Promise<ExecutionPrecheckRecord | null>;
    insertDeadLetter(deadLetter: DeadLetterRecord): Promise<void>;
    getDeadLetterByExecutionId(executionId: string): Promise<DeadLetterRecord | null>;
    listDeadLettersByTask(taskId: string): Promise<DeadLetterRecord[]>;
}
