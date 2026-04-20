/**
 * AsyncExecutionRepository - Async data access for executions and related entities.
 *
 * This is the async PostgreSQL-compatible version of ExecutionRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */

import type { ExecutionRecord, ExecutionPrecheckRecord, DeadLetterRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
import { resolveTenantScope } from "../sqlite/authoritative-task-store-types.js";

export class AsyncExecutionRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  // === Execution Records ===

  public async insertExecution(execution: ExecutionRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO executions (
        id, task_id, workflow_id, parent_execution_id, agent_id, role_id, run_kind, status,
        input_ref, trace_id, attempt, timeout_ms, budget_usd_limit, requires_approval,
        sandbox_mode, allowed_tools_json, allowed_paths_json, max_retries, retry_backoff,
        last_error_code, last_error_message, started_at, finished_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
      execution.id,
      execution.taskId,
      execution.workflowId,
      execution.parentExecutionId,
      execution.agentId,
      execution.roleId,
      execution.runKind,
      execution.status,
      execution.inputRef,
      execution.traceId,
      execution.attempt,
      execution.timeoutMs,
      execution.budgetUsdLimit,
      execution.requiresApproval,
      execution.sandboxMode,
      execution.allowedToolsJson,
      execution.allowedPathsJson,
      execution.maxRetries,
      execution.retryBackoff,
      execution.lastErrorCode,
      execution.lastErrorMessage,
      execution.startedAt,
      execution.finishedAt,
      execution.createdAt,
      execution.updatedAt,
    );
  }

  public async getExecution(executionId: string): Promise<ExecutionRecord | null> {
    const result = await asyncQueryOne<ExecutionRecord>(
      this.conn,
      `SELECT
        id, task_id AS "taskId", workflow_id AS "workflowId", parent_execution_id AS "parentExecutionId",
        agent_id AS "agentId", role_id AS "roleId", run_kind AS "runKind", status,
        input_ref AS "inputRef", trace_id AS "traceId", attempt, timeout_ms AS "timeoutMs",
        budget_usd_limit AS "budgetUsdLimit", requires_approval AS "requiresApproval",
        sandbox_mode AS "sandboxMode", allowed_tools_json AS "allowedToolsJson",
        allowed_paths_json AS "allowedPathsJson", max_retries AS "maxRetries",
        retry_backoff AS "retryBackoff", last_error_code AS "lastErrorCode",
        last_error_message AS "lastErrorMessage", started_at AS "startedAt",
        finished_at AS "finishedAt", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM executions WHERE id = $1`,
      executionId,
    );
    return result ?? null;
  }

  public async listExecutionsByTask(taskId: string, tenantId?: string | null): Promise<ExecutionRecord[]> {
    const scopedTenantId = resolveTenantScope(tenantId);
    const tenantJoin = scopedTenantId !== undefined ? "INNER JOIN tasks t ON t.id = e.task_id" : "";
    const tenantClause = scopedTenantId !== undefined ? "AND t.tenant_id = $2" : "";
    const sql = `SELECT
        e.id, e.task_id AS "taskId", e.workflow_id AS "workflowId", e.parent_execution_id AS "parentExecutionId",
        e.agent_id AS "agentId", e.role_id AS "roleId", e.run_kind AS "runKind", e.status,
        e.input_ref AS "inputRef", e.trace_id AS "traceId", e.attempt, e.timeout_ms AS "timeoutMs",
        e.budget_usd_limit AS "budgetUsdLimit", e.requires_approval AS "requiresApproval",
        e.sandbox_mode AS "sandboxMode", e.allowed_tools_json AS "allowedToolsJson",
        e.allowed_paths_json AS "allowedPathsJson", e.max_retries AS "maxRetries",
        e.retry_backoff AS "retryBackoff", e.last_error_code AS "lastErrorCode",
        e.last_error_message AS "lastErrorMessage", e.started_at AS "startedAt",
        e.finished_at AS "finishedAt", e.created_at AS "createdAt", e.updated_at AS "updatedAt"
       FROM executions e
       ${tenantJoin}
       WHERE e.task_id = $1
       ${tenantClause}
       ORDER BY e.created_at ASC`;
    return asyncQueryAll<ExecutionRecord>(
      this.conn,
      sql,
      ...(scopedTenantId !== undefined ? [taskId, scopedTenantId] : [taskId]),
    );
  }

  public async listExecutionsByStatuses(statuses: string[], limit?: number): Promise<ExecutionRecord[]> {
    if (statuses.length === 0) {
      return [];
    }
    const placeholders = statuses.map((_, i) => `$${1 + i}`).join(",");
    const limitClause = limit ? ` LIMIT ${limit}` : "";
    const sql = `SELECT
        id, task_id AS "taskId", workflow_id AS "workflowId", parent_execution_id AS "parentExecutionId",
        agent_id AS "agentId", role_id AS "roleId", run_kind AS "runKind", status,
        input_ref AS "inputRef", trace_id AS "traceId", attempt, timeout_ms AS "timeoutMs",
        budget_usd_limit AS "budgetUsdLimit", requires_approval AS "requiresApproval",
        sandbox_mode AS "sandboxMode", allowed_tools_json AS "allowedToolsJson",
        allowed_paths_json AS "allowedPathsJson", max_retries AS "maxRetries",
        retry_backoff AS "retryBackoff", last_error_code AS "lastErrorCode",
        last_error_message AS "lastErrorMessage", started_at AS "startedAt",
        finished_at AS "finishedAt", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM executions WHERE status IN (${placeholders}) ORDER BY created_at DESC${limitClause}`;
    return asyncQueryAll<ExecutionRecord>(this.conn, sql, ...statuses);
  }

  public async updateExecutionStatus(
    executionId: string,
    status: string,
    updatedAt: string,
    startedAt: string | null = null,
    finishedAt: string | null = null,
    lastErrorCode: string | null = null,
  ): Promise<number> {
    return asyncExecute(
      this.conn,
      `UPDATE executions
       SET status = $1, updated_at = $2, started_at = COALESCE($3, started_at),
           finished_at = COALESCE($4, finished_at), last_error_code = $5
       WHERE id = $6`,
      status,
      updatedAt,
      startedAt,
      finishedAt,
      lastErrorCode,
      executionId,
    );
  }

  public async updateExecutionFailure(input: {
    executionId: string;
    status: ExecutionRecord["status"];
    updatedAt: string;
    finishedAt: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
  }): Promise<number> {
    return asyncExecute(
      this.conn,
      `UPDATE executions
       SET status = $1, updated_at = $2, finished_at = COALESCE($3, finished_at),
           last_error_code = $4, last_error_message = $5
       WHERE id = $6`,
      input.status,
      input.updatedAt,
      input.finishedAt,
      input.lastErrorCode,
      input.lastErrorMessage,
      input.executionId,
    );
  }

  public async updateExecutionAgent(executionId: string, agentId: string, updatedAt: string): Promise<number> {
    return asyncExecute(
      this.conn,
      `UPDATE executions
       SET agent_id = $1, updated_at = $2
       WHERE id = $3`,
      agentId,
      updatedAt,
      executionId,
    );
  }

  public async countActiveExecutions(): Promise<number> {
    const result = await asyncQueryOne<{ count: number }>(
      this.conn,
      `SELECT COUNT(*) AS count FROM executions WHERE status IN ('executing', 'prechecking')`,
    );
    return result?.count ?? 0;
  }

  // === Execution Precheck Records ===

  public async insertExecutionPrecheck(precheck: ExecutionPrecheckRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO execution_prechecks (
        id, execution_id, allowed, reason_code, resolved_budget_usd,
        resolved_timeout_ms, resolved_sandbox_mode, resolved_tools_json,
        resolved_paths_json, checked_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      precheck.id,
      precheck.executionId,
      precheck.allowed,
      precheck.reasonCode,
      precheck.resolvedBudgetUsd,
      precheck.resolvedTimeoutMs,
      precheck.resolvedSandboxMode,
      precheck.resolvedToolsJson,
      precheck.resolvedPathsJson,
      precheck.checkedAt,
    );
  }

  public async getExecutionPrecheck(executionId: string): Promise<ExecutionPrecheckRecord | null> {
    const result = await asyncQueryOne<ExecutionPrecheckRecord>(
      this.conn,
      `SELECT
        id, execution_id AS "executionId", allowed, reason_code AS "reasonCode",
        resolved_budget_usd AS "resolvedBudgetUsd", resolved_timeout_ms AS "resolvedTimeoutMs",
        resolved_sandbox_mode AS "resolvedSandboxMode", resolved_tools_json AS "resolvedToolsJson",
        resolved_paths_json AS "resolvedPathsJson", checked_at AS "checkedAt"
       FROM execution_prechecks WHERE execution_id = $1`,
      executionId,
    );
    return result ?? null;
  }

  // === Dead Letter Records ===

  public async insertDeadLetter(deadLetter: DeadLetterRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO dead_letters (
        id, task_id, execution_id, final_reason_code, retry_count,
        last_error_message, moved_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      deadLetter.id,
      deadLetter.taskId,
      deadLetter.executionId,
      deadLetter.finalReasonCode,
      deadLetter.retryCount,
      deadLetter.lastErrorMessage,
      deadLetter.movedAt,
    );
  }

  public async getDeadLetterByExecutionId(executionId: string): Promise<DeadLetterRecord | null> {
    const result = await asyncQueryOne<DeadLetterRecord>(
      this.conn,
      `SELECT
        id, task_id AS "taskId", execution_id AS "executionId", final_reason_code AS "finalReasonCode",
        retry_count AS "retryCount", last_error_message AS "lastErrorMessage", moved_at AS "movedAt"
       FROM dead_letters WHERE execution_id = $1`,
      executionId,
    );
    return result ?? null;
  }

  public async listDeadLettersByTask(taskId: string): Promise<DeadLetterRecord[]> {
    return asyncQueryAll<DeadLetterRecord>(
      this.conn,
      `SELECT
        id, task_id AS "taskId", execution_id AS "executionId", final_reason_code AS "finalReasonCode",
        retry_count AS "retryCount", last_error_message AS "lastErrorMessage", moved_at AS "movedAt"
       FROM dead_letters WHERE task_id = $1 ORDER BY moved_at DESC`,
      taskId,
    );
  }
}
