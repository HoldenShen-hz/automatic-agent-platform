/**
 * AsyncTaskRepository - Async data access for tasks.
 */

import type { TaskRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
import { resolveTenantScope } from "../sqlite/authoritative-task-store-types.js";

export class AsyncTaskRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  public async insertTask(task: TaskRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO tasks (
        id, parent_id, root_id, division_id, tenant_id, title, status, source, priority,
        input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd,
        error_code, created_at, updated_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
      task.id, task.parentId, task.rootId, task.divisionId, task.tenantId ?? null,
      task.title, task.status, task.source, task.priority,
      task.inputJson, task.normalizedInputJson, task.outputJson,
      task.estimatedCostUsd, task.actualCostUsd, task.errorCode,
      task.createdAt, task.updatedAt, task.completedAt,
    );
  }

  public async getTask(taskId: string, tenantId?: string | null): Promise<TaskRecord | null> {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      const result = await asyncQueryOne<TaskRecord>(
        this.conn,
        `SELECT t.id, t.parent_id AS "parentId", t.root_id AS "rootId", t.division_id AS "divisionId",
          t.tenant_id AS "tenantId", t.title, t.status, t.source, t.priority,
          t.input_json AS "inputJson", t.normalized_input_json AS "normalizedInputJson",
          t.output_json AS "outputJson", t.estimated_cost_usd AS "estimatedCostUsd",
          t.actual_cost_usd AS "actualCostUsd", t.error_code AS "errorCode",
          t.created_at AS "createdAt", t.updated_at AS "updatedAt", t.completed_at AS "completedAt"
         FROM tasks t WHERE t.id = $1 AND t.tenant_id = $2`,
        taskId, scopedTenantId,
      );
      return result ?? null;
    }
    const result = await asyncQueryOne<TaskRecord>(
      this.conn,
      `SELECT id, parent_id AS "parentId", root_id AS "rootId", division_id AS "divisionId",
          tenant_id AS "tenantId", title, status, source, priority,
          input_json AS "inputJson", normalized_input_json AS "normalizedInputJson",
          output_json AS "outputJson", estimated_cost_usd AS "estimatedCostUsd",
          actual_cost_usd AS "actualCostUsd", error_code AS "errorCode",
          created_at AS "createdAt", updated_at AS "updatedAt", completed_at AS "completedAt"
         FROM tasks WHERE id = $1`,
      taskId,
    );
    return result ?? null;
  }

  public async listTasks(limit?: number, tenantId?: string | null, cursor?: string | null): Promise<TaskRecord[]> {
    const scopedTenantId = resolveTenantScope(tenantId);
    let sql = `SELECT id, parent_id AS "parentId", root_id AS "rootId", division_id AS "divisionId",
          tenant_id AS "tenantId", title, status, source, priority,
          input_json AS "inputJson", normalized_input_json AS "normalizedInputJson",
          output_json AS "outputJson", estimated_cost_usd AS "estimatedCostUsd",
          actual_cost_usd AS "actualCostUsd", error_code AS "errorCode",
          created_at AS "createdAt", updated_at AS "updatedAt", completed_at AS "completedAt"
         FROM tasks`;
    const params: unknown[] = [];
    if (scopedTenantId !== undefined) {
      sql += ` WHERE tenant_id = $${params.length + 1}`;
      params.push(scopedTenantId);
    }
    if (cursor !== undefined && cursor !== null) {
      if (scopedTenantId !== undefined) {
        sql += ` AND updated_at < $${params.length + 1}`;
      } else {
        sql += ` WHERE updated_at < $${params.length + 1}`;
      }
      params.push(cursor);
    }
    sql += ` ORDER BY updated_at DESC, id DESC`;
    if (typeof limit === "number") {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }
    return asyncQueryAll<TaskRecord>(this.conn, sql, ...params);
  }

  public async updateTaskStatus(
    taskId: string, status: string, updatedAt: string, errorCode: string | null, completedAt: string | null,
  ): Promise<void> {
    await asyncExecute(
      this.conn,
      `UPDATE tasks SET status = $1, updated_at = $2, error_code = $3, completed_at = COALESCE($4, completed_at) WHERE id = $5`,
      status, updatedAt, errorCode, completedAt, taskId,
    );
  }

  public async updateTaskStatusCas(
    taskId: string, expectedStatus: string, status: string, updatedAt: string, errorCode: string | null, completedAt: string | null,
  ): Promise<number> {
    return asyncExecute(
      this.conn,
      `UPDATE tasks SET status = $1, updated_at = $2, error_code = $3, completed_at = COALESCE($4, completed_at) WHERE id = $5 AND status = $6`,
      status, updatedAt, errorCode, completedAt, taskId, expectedStatus,
    );
  }

  public async setTaskState(input: { taskId: string; status: string; updatedAt: string; errorCode: string | null; completedAt: string | null }): Promise<void> {
    await asyncExecute(
      this.conn,
      `UPDATE tasks SET status = $1, updated_at = $2, error_code = $3, completed_at = $4 WHERE id = $5`,
      input.status, input.updatedAt, input.errorCode, input.completedAt, input.taskId,
    );
  }

  public async updateTaskOutput(taskId: string, outputJson: string, updatedAt: string): Promise<void> {
    await asyncExecute(this.conn, `UPDATE tasks SET output_json = $1, updated_at = $2 WHERE id = $3`, outputJson, updatedAt, taskId);
  }

  public async updateTaskInput(taskId: string, inputJson: string, normalizedInputJson: string, updatedAt: string): Promise<void> {
    await asyncExecute(
      this.conn,
      `UPDATE tasks SET input_json = $1, normalized_input_json = $2, updated_at = $3 WHERE id = $4`,
      inputJson, normalizedInputJson, updatedAt, taskId,
    );
  }

  public async countQueuedTasks(tenantId?: string | null): Promise<number> {
    const scopedTenantId = resolveTenantScope(tenantId);
    let sql = `SELECT COUNT(*) AS count FROM tasks WHERE status IN ('queued', 'pending')`;
    const params: unknown[] = [];
    if (scopedTenantId !== undefined) {
      sql += ` AND tenant_id = $${params.length + 1}`;
      params.push(scopedTenantId);
    }
    const result = await asyncQueryOne<{ count: number }>(this.conn, sql, ...params);
    return result?.count ?? 0;
  }
}
