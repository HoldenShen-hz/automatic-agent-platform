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
import { queryAll, queryOne, execute } from "../query-helper.js";
import { resolveTenantScope } from "../authoritative-task-store-types.js";
export class TaskRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    /**
     * Insert a new task record.
     * Maps TaskRecord camelCase properties to snake_case column names.
     */
    insertTask(task) {
        this.conn
            .prepare(`INSERT INTO tasks (
          id, parent_id, root_id, division_id, tenant_id, title, status, source, priority,
          input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd,
          error_code, created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(task.id, task.parentId, task.rootId, task.divisionId, task.tenantId ?? null, task.title, task.status, task.source, task.priority, task.inputJson, task.normalizedInputJson, task.outputJson, task.estimatedCostUsd, task.actualCostUsd, task.errorCode, task.createdAt, task.updatedAt, task.completedAt);
    }
    /**
     * Get a task by ID with optional tenant scoping.
     */
    getTask(taskId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return queryOne(this.conn, `SELECT
          t.id, t.parent_id AS parentId, t.root_id AS rootId, t.division_id AS divisionId,
          t.tenant_id AS tenantId, t.title, t.status, t.source, t.priority,
          t.input_json AS inputJson, t.normalized_input_json AS normalizedInputJson,
          t.output_json AS outputJson, t.estimated_cost_usd AS estimatedCostUsd,
          t.actual_cost_usd AS actualCostUsd, t.error_code AS errorCode,
          t.created_at AS createdAt, t.updated_at AS updatedAt, t.completed_at AS completedAt
         FROM tasks t
         WHERE t.id = ? AND t.tenant_id = ?`, taskId, scopedTenantId);
        }
        return queryOne(this.conn, `SELECT
          id, parent_id AS parentId, root_id AS rootId, division_id AS divisionId,
          tenant_id AS tenantId, title, status, source, priority,
          input_json AS inputJson, normalized_input_json AS normalizedInputJson,
          output_json AS outputJson, estimated_cost_usd AS estimatedCostUsd,
          actual_cost_usd AS actualCostUsd, error_code AS errorCode,
          created_at AS createdAt, updated_at AS updatedAt, completed_at AS completedAt
         FROM tasks WHERE id = ?`, taskId);
    }
    /**
     * List tasks with optional limit and tenant filtering.
     */
    listTasks(limit, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        let sql = `SELECT
          id, parent_id AS parentId, root_id AS rootId, division_id AS divisionId,
          tenant_id AS tenantId, title, status, source, priority,
          input_json AS inputJson, normalized_input_json AS normalizedInputJson,
          output_json AS outputJson, estimated_cost_usd AS estimatedCostUsd,
          actual_cost_usd AS actualCostUsd, error_code AS errorCode,
          created_at AS createdAt, updated_at AS updatedAt, completed_at AS completedAt
         FROM tasks`;
        const params = [];
        if (scopedTenantId !== undefined) {
            sql += ` WHERE tenant_id = ?`;
            params.push(scopedTenantId);
        }
        sql += ` ORDER BY updated_at DESC`;
        if (typeof limit === "number") {
            sql += ` LIMIT ?`;
            params.push(limit);
        }
        return queryAll(this.conn, sql, ...params);
    }
    /**
     * Update task status.
     */
    updateTaskStatus(taskId, status, updatedAt, errorCode, completedAt) {
        execute(this.conn, `UPDATE tasks
       SET status = ?, updated_at = ?, error_code = ?, completed_at = COALESCE(?, completed_at)
       WHERE id = ?`, status, updatedAt, errorCode, completedAt, taskId);
    }
    updateTaskStatusCas(taskId, expectedStatus, status, updatedAt, errorCode, completedAt) {
        return execute(this.conn, `UPDATE tasks
       SET status = ?, updated_at = ?, error_code = ?, completed_at = COALESCE(?, completed_at)
       WHERE id = ? AND status = ?`, status, updatedAt, errorCode, completedAt, taskId, expectedStatus);
    }
    setTaskState(input) {
        execute(this.conn, `UPDATE tasks
       SET status = ?, updated_at = ?, error_code = ?, completed_at = ?
       WHERE id = ?`, input.status, input.updatedAt, input.errorCode, input.completedAt, input.taskId);
    }
    /**
     * Update task output.
     */
    updateTaskOutput(taskId, outputJson, updatedAt) {
        execute(this.conn, `UPDATE tasks SET output_json = ?, updated_at = ? WHERE id = ?`, outputJson, updatedAt, taskId);
    }
    updateTaskInput(taskId, inputJson, normalizedInputJson, updatedAt) {
        execute(this.conn, `UPDATE tasks
       SET input_json = ?, normalized_input_json = ?, updated_at = ?
       WHERE id = ?`, inputJson, normalizedInputJson, updatedAt, taskId);
    }
    /**
     * Count queued tasks.
     */
    countQueuedTasks(tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        let sql = `SELECT COUNT(*) AS count FROM tasks WHERE status IN ('queued', 'pending')`;
        const params = [];
        if (scopedTenantId !== undefined) {
            sql += ` AND tenant_id = ?`;
            params.push(scopedTenantId);
        }
        const result = queryOne(this.conn, sql, ...params);
        return result?.count ?? 0;
    }
}
//# sourceMappingURL=task-repository.js.map