/**
 * AsyncTaskRepository - Async data access for tasks.
 */
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
import { resolveTenantScope } from "../sqlite/authoritative-task-store-types.js";
export class AsyncTaskRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    async insertTask(task) {
        await asyncExecute(this.conn, `INSERT INTO tasks (
        id, parent_id, root_id, division_id, tenant_id, title, status, source, priority,
        input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd,
        error_code, created_at, updated_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`, task.id, task.parentId, task.rootId, task.divisionId, task.tenantId ?? null, task.title, task.status, task.source, task.priority, task.inputJson, task.normalizedInputJson, task.outputJson, task.estimatedCostUsd, task.actualCostUsd, task.errorCode, task.createdAt, task.updatedAt, task.completedAt);
    }
    async getTask(taskId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            const result = await asyncQueryOne(this.conn, `SELECT t.id, t.parent_id AS "parentId", t.root_id AS "rootId", t.division_id AS "divisionId",
          t.tenant_id AS "tenantId", t.title, t.status, t.source, t.priority,
          t.input_json AS "inputJson", t.normalized_input_json AS "normalizedInputJson",
          t.output_json AS "outputJson", t.estimated_cost_usd AS "estimatedCostUsd",
          t.actual_cost_usd AS "actualCostUsd", t.error_code AS "errorCode",
          t.created_at AS "createdAt", t.updated_at AS "updatedAt", t.completed_at AS "completedAt"
         FROM tasks t WHERE t.id = $1 AND t.tenant_id = $2`, taskId, scopedTenantId);
            return result ?? null;
        }
        const result = await asyncQueryOne(this.conn, `SELECT id, parent_id AS "parentId", root_id AS "rootId", division_id AS "divisionId",
          tenant_id AS "tenantId", title, status, source, priority,
          input_json AS "inputJson", normalized_input_json AS "normalizedInputJson",
          output_json AS "outputJson", estimated_cost_usd AS "estimatedCostUsd",
          actual_cost_usd AS "actualCostUsd", error_code AS "errorCode",
          created_at AS "createdAt", updated_at AS "updatedAt", completed_at AS "completedAt"
         FROM tasks WHERE id = $1`, taskId);
        return result ?? null;
    }
    async listTasks(limit, tenantId, cursor) {
        const scopedTenantId = resolveTenantScope(tenantId);
        let sql = `SELECT id, parent_id AS "parentId", root_id AS "rootId", division_id AS "divisionId",
          tenant_id AS "tenantId", title, status, source, priority,
          input_json AS "inputJson", normalized_input_json AS "normalizedInputJson",
          output_json AS "outputJson", estimated_cost_usd AS "estimatedCostUsd",
          actual_cost_usd AS "actualCostUsd", error_code AS "errorCode",
          created_at AS "createdAt", updated_at AS "updatedAt", completed_at AS "completedAt"
         FROM tasks`;
        const params = [];
        if (scopedTenantId !== undefined) {
            sql += ` WHERE tenant_id = $${params.length + 1}`;
            params.push(scopedTenantId);
        }
        if (cursor !== undefined && cursor !== null) {
            if (scopedTenantId !== undefined) {
                sql += ` AND updated_at < $${params.length + 1}`;
            }
            else {
                sql += ` WHERE updated_at < $${params.length + 1}`;
            }
            params.push(cursor);
        }
        sql += ` ORDER BY updated_at DESC, id DESC`;
        if (typeof limit === "number") {
            sql += ` LIMIT $${params.length + 1}`;
            params.push(limit);
        }
        return asyncQueryAll(this.conn, sql, ...params);
    }
    async updateTaskStatus(taskId, status, updatedAt, errorCode, completedAt) {
        await asyncExecute(this.conn, `UPDATE tasks SET status = $1, updated_at = $2, error_code = $3, completed_at = COALESCE($4, completed_at) WHERE id = $5`, status, updatedAt, errorCode, completedAt, taskId);
    }
    async updateTaskStatusCas(taskId, expectedStatus, status, updatedAt, errorCode, completedAt) {
        return asyncExecute(this.conn, `UPDATE tasks SET status = $1, updated_at = $2, error_code = $3, completed_at = COALESCE($4, completed_at) WHERE id = $5 AND status = $6`, status, updatedAt, errorCode, completedAt, taskId, expectedStatus);
    }
    async setTaskState(input) {
        await asyncExecute(this.conn, `UPDATE tasks SET status = $1, updated_at = $2, error_code = $3, completed_at = $4 WHERE id = $5`, input.status, input.updatedAt, input.errorCode, input.completedAt, input.taskId);
    }
    async updateTaskOutput(taskId, outputJson, updatedAt) {
        await asyncExecute(this.conn, `UPDATE tasks SET output_json = $1, updated_at = $2 WHERE id = $3`, outputJson, updatedAt, taskId);
    }
    async updateTaskInput(taskId, inputJson, normalizedInputJson, updatedAt) {
        await asyncExecute(this.conn, `UPDATE tasks SET input_json = $1, normalized_input_json = $2, updated_at = $3 WHERE id = $4`, inputJson, normalizedInputJson, updatedAt, taskId);
    }
    async countQueuedTasks(tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        let sql = `SELECT COUNT(*) AS count FROM tasks WHERE status IN ('queued', 'pending')`;
        const params = [];
        if (scopedTenantId !== undefined) {
            sql += ` AND tenant_id = $${params.length + 1}`;
            params.push(scopedTenantId);
        }
        const result = await asyncQueryOne(this.conn, sql, ...params);
        return result?.count ?? 0;
    }
}
//# sourceMappingURL=task-repository.js.map