/**
 * TaskRepository - Data access for tasks, workflows, executions, and related entities.
 *
 * This repository handles all data access for:
 * - TaskRecord (tasks table)
 * - WorkflowStateRecord (workflow_state table)
 * - ExecutionRecord (executions table)
 * - ExecutionPrecheckRecord (execution_precheck table)
 * - DeadLetterRecord (dead_letters table)
 *
 * All SQL queries use proper column aliasing to match the camelCase domain types.
 * The query helper functions centralize `as unknown as T` type casts.
 */
import type { TaskRecord } from "../../../../contracts/types/domain.js";
import type { SqliteConnection } from "../query-helper.js";
export declare class TaskRepository {
    private readonly conn;
    constructor(conn: SqliteConnection);
    /**
     * Insert a new task record.
     * Maps TaskRecord camelCase properties to snake_case column names.
     */
    insertTask(task: TaskRecord): void;
    /**
     * Get a task by ID with optional tenant scoping.
     */
    getTask(taskId: string, tenantId?: string | null): TaskRecord | undefined;
    /**
     * List tasks with optional limit and tenant filtering.
     */
    listTasks(limit?: number, tenantId?: string | null): TaskRecord[];
    /**
     * Update task status.
     */
    updateTaskStatus(taskId: string, status: string, updatedAt: string, errorCode: string | null, completedAt: string | null): void;
    updateTaskStatusCas(taskId: string, expectedStatus: string, status: string, updatedAt: string, errorCode: string | null, completedAt: string | null): number;
    setTaskState(input: {
        taskId: string;
        status: string;
        updatedAt: string;
        errorCode: string | null;
        completedAt: string | null;
    }): void;
    /**
     * Update task output.
     */
    updateTaskOutput(taskId: string, outputJson: string, updatedAt: string): void;
    updateTaskInput(taskId: string, inputJson: string, normalizedInputJson: string, updatedAt: string): void;
    /**
     * Count queued tasks.
     */
    countQueuedTasks(tenantId?: string | null): number;
}
