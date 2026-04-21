/**
 * AsyncTaskRepository - Async data access for tasks.
 */
import type { TaskRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncTaskRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    insertTask(task: TaskRecord): Promise<void>;
    getTask(taskId: string, tenantId?: string | null): Promise<TaskRecord | null>;
    listTasks(limit?: number, tenantId?: string | null): Promise<TaskRecord[]>;
    updateTaskStatus(taskId: string, status: string, updatedAt: string, errorCode: string | null, completedAt: string | null): Promise<void>;
    updateTaskStatusCas(taskId: string, expectedStatus: string, status: string, updatedAt: string, errorCode: string | null, completedAt: string | null): Promise<number>;
    setTaskState(input: {
        taskId: string;
        status: string;
        updatedAt: string;
        errorCode: string | null;
        completedAt: string | null;
    }): Promise<void>;
    updateTaskOutput(taskId: string, outputJson: string, updatedAt: string): Promise<void>;
    updateTaskInput(taskId: string, inputJson: string, normalizedInputJson: string, updatedAt: string): Promise<void>;
    countQueuedTasks(tenantId?: string | null): Promise<number>;
}
