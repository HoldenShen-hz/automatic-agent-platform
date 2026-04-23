/**
 * ExecutionRepository - Data access for executions and related entities.
 *
 * This repository handles:
 * - ExecutionRecord (executions table)
 * - ExecutionPrecheckRecord (execution_prechecks table)
 * - DeadLetterRecord (dead_letters table)
 *
 * All SQL queries use proper column aliasing to match camelCase domain types.
 */
import type { ExecutionRecord, ExecutionPrecheckRecord, DeadLetterRecord } from "../../../../contracts/types/domain.js";
import type { SqliteConnection } from "../query-helper.js";
export declare class ExecutionRepository {
    private readonly conn;
    constructor(conn: SqliteConnection);
    insertExecution(execution: ExecutionRecord): void;
    getExecution(executionId: string): ExecutionRecord | undefined;
    listExecutionsByTask(taskId: string, tenantId?: string | null): ExecutionRecord[];
    listExecutionsByStatuses(statuses: string[], limit?: number, cursor?: string | null): ExecutionRecord[];
    updateExecutionStatus(executionId: string, status: string, updatedAt: string, startedAt?: string | null, finishedAt?: string | null, lastErrorCode?: string | null): void;
    /**
     * Updates execution status with CAS (Compare-And-Swap) semantics.
     * Only updates if the current status matches the expected status.
     * @returns Number of rows affected (1 if successful, 0 if CAS failed)
     */
    updateExecutionStatusCas(executionId: string, expectedStatus: string, status: string, updatedAt: string, startedAt?: string | null, finishedAt?: string | null, lastErrorCode?: string | null): number;
    updateExecutionFailure(input: {
        executionId: string;
        status: ExecutionRecord["status"];
        updatedAt: string;
        finishedAt: string | null;
        lastErrorCode: string | null;
        lastErrorMessage: string | null;
    }): void;
    updateExecutionAgent(executionId: string, agentId: string, updatedAt: string): void;
    countActiveExecutions(): number;
    insertExecutionPrecheck(precheck: ExecutionPrecheckRecord): void;
    getExecutionPrecheck(executionId: string): ExecutionPrecheckRecord | undefined;
    insertDeadLetter(deadLetter: DeadLetterRecord): void;
    getDeadLetterByExecutionId(executionId: string): DeadLetterRecord | undefined;
    listDeadLettersByTask(taskId: string): DeadLetterRecord[];
}
