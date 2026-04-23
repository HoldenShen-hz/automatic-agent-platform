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
import { queryAll, queryOne, execute } from "../query-helper.js";
import { resolveTenantScope } from "../authoritative-task-store-types.js";
export class ExecutionRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    // === Execution Records ===
    insertExecution(execution) {
        this.conn
            .prepare(`INSERT INTO executions (
          id, task_id, workflow_id, parent_execution_id, agent_id, role_id, run_kind, status,
          input_ref, trace_id, attempt, timeout_ms, budget_usd_limit, requires_approval,
          sandbox_mode, allowed_tools_json, allowed_paths_json, max_retries, retry_backoff,
          last_error_code, last_error_message, started_at, finished_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(execution.id, execution.taskId, execution.workflowId, execution.parentExecutionId, execution.agentId, execution.roleId, execution.runKind, execution.status, execution.inputRef, execution.traceId, execution.attempt, execution.timeoutMs, execution.budgetUsdLimit, execution.requiresApproval, execution.sandboxMode, execution.allowedToolsJson, execution.allowedPathsJson, execution.maxRetries, execution.retryBackoff, execution.lastErrorCode, execution.lastErrorMessage, execution.startedAt, execution.finishedAt, execution.createdAt, execution.updatedAt);
    }
    getExecution(executionId) {
        return queryOne(this.conn, `SELECT
        id, task_id AS taskId, workflow_id AS workflowId, parent_execution_id AS parentExecutionId,
        agent_id AS agentId, role_id AS roleId, run_kind AS runKind, status,
        input_ref AS inputRef, trace_id AS traceId, attempt, timeout_ms AS timeoutMs,
        budget_usd_limit AS budgetUsdLimit, requires_approval AS requiresApproval,
        sandbox_mode AS sandboxMode, allowed_tools_json AS allowedToolsJson,
        allowed_paths_json AS allowedPathsJson, max_retries AS maxRetries,
        retry_backoff AS retryBackoff, last_error_code AS lastErrorCode,
        last_error_message AS lastErrorMessage, started_at AS startedAt,
        finished_at AS finishedAt, created_at AS createdAt, updated_at AS updatedAt
       FROM executions WHERE id = ?`, executionId);
    }
    listExecutionsByTask(taskId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        const tenantJoin = scopedTenantId !== undefined ? "INNER JOIN tasks t ON t.id = e.task_id" : "";
        const tenantClause = scopedTenantId !== undefined ? "AND t.tenant_id = ?" : "";
        const sql = `SELECT
        e.id, e.task_id AS taskId, e.workflow_id AS workflowId, e.parent_execution_id AS parentExecutionId,
        e.agent_id AS agentId, e.role_id AS roleId, e.run_kind AS runKind, e.status,
        e.input_ref AS inputRef, e.trace_id AS traceId, e.attempt, e.timeout_ms AS timeoutMs,
        e.budget_usd_limit AS budgetUsdLimit, e.requires_approval AS requiresApproval,
        e.sandbox_mode AS sandboxMode, e.allowed_tools_json AS allowedToolsJson,
        e.allowed_paths_json AS allowedPathsJson, e.max_retries AS maxRetries,
        e.retry_backoff AS retryBackoff, e.last_error_code AS lastErrorCode,
        e.last_error_message AS lastErrorMessage, e.started_at AS startedAt,
        e.finished_at AS finishedAt, e.created_at AS createdAt, e.updated_at AS updatedAt
       FROM executions e
       ${tenantJoin}
       WHERE e.task_id = ?
       ${tenantClause}
       ORDER BY e.created_at ASC`;
        return queryAll(this.conn, sql, ...(scopedTenantId !== undefined ? [taskId, scopedTenantId] : [taskId]));
    }
    listExecutionsByStatuses(statuses, limit, cursor) {
        if (statuses.length === 0) {
            return [];
        }
        const placeholders = statuses.map(() => "?").join(",");
        let sql = `SELECT
        id, task_id AS taskId, workflow_id AS workflowId, parent_execution_id AS parentExecutionId,
        agent_id AS agentId, role_id AS roleId, run_kind AS runKind, status,
        input_ref AS inputRef, trace_id AS traceId, attempt, timeout_ms AS timeoutMs,
        budget_usd_limit AS budgetUsdLimit, requires_approval AS requiresApproval,
        sandbox_mode AS sandboxMode, allowed_tools_json AS allowedToolsJson,
        allowed_paths_json AS allowedPathsJson, max_retries AS maxRetries,
        retry_backoff AS retryBackoff, last_error_code AS lastErrorCode,
        last_error_message AS lastErrorMessage, started_at AS startedAt,
        finished_at AS finishedAt, created_at AS createdAt, updated_at AS updatedAt
       FROM executions WHERE status IN (${placeholders})`;
        const params = [...statuses];
        if (cursor !== undefined && cursor !== null) {
            sql += ` AND created_at < ?`;
            params.push(cursor);
        }
        sql += ` ORDER BY created_at DESC, id DESC`;
        if (typeof limit === "number") {
            sql += ` LIMIT ${limit}`;
            params.push(limit);
        }
        return queryAll(this.conn, sql, ...params);
    }
    updateExecutionStatus(executionId, status, updatedAt, startedAt = null, finishedAt = null, lastErrorCode = null) {
        execute(this.conn, `UPDATE executions
       SET status = ?, updated_at = ?, started_at = COALESCE(?, started_at),
           finished_at = COALESCE(?, finished_at), last_error_code = ?
       WHERE id = ?`, status, updatedAt, startedAt, finishedAt, lastErrorCode, executionId);
    }
    /**
     * Updates execution status with CAS (Compare-And-Swap) semantics.
     * Only updates if the current status matches the expected status.
     * @returns Number of rows affected (1 if successful, 0 if CAS failed)
     */
    updateExecutionStatusCas(executionId, expectedStatus, status, updatedAt, startedAt = null, finishedAt = null, lastErrorCode = null) {
        const result = execute(this.conn, `UPDATE executions
       SET status = ?, updated_at = ?, started_at = COALESCE(?, started_at),
           finished_at = COALESCE(?, finished_at), last_error_code = ?
       WHERE id = ? AND status = ?`, status, updatedAt, startedAt, finishedAt, lastErrorCode, executionId, expectedStatus);
        return result;
    }
    updateExecutionFailure(input) {
        execute(this.conn, `UPDATE executions
       SET status = ?, updated_at = ?, finished_at = COALESCE(?, finished_at),
           last_error_code = ?, last_error_message = ?
       WHERE id = ?`, input.status, input.updatedAt, input.finishedAt, input.lastErrorCode, input.lastErrorMessage, input.executionId);
    }
    updateExecutionAgent(executionId, agentId, updatedAt) {
        execute(this.conn, `UPDATE executions
       SET agent_id = ?, updated_at = ?
       WHERE id = ?`, agentId, updatedAt, executionId);
    }
    countActiveExecutions() {
        const result = queryOne(this.conn, `SELECT COUNT(*) AS count FROM executions WHERE status IN ('executing', 'prechecking')`);
        return result?.count ?? 0;
    }
    // === Execution Precheck Records ===
    insertExecutionPrecheck(precheck) {
        this.conn
            .prepare(`INSERT INTO execution_prechecks (
          id, execution_id, allowed, reason_code, resolved_budget_usd,
          resolved_timeout_ms, resolved_sandbox_mode, resolved_tools_json,
          resolved_paths_json, checked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(precheck.id, precheck.executionId, precheck.allowed, precheck.reasonCode, precheck.resolvedBudgetUsd, precheck.resolvedTimeoutMs, precheck.resolvedSandboxMode, precheck.resolvedToolsJson, precheck.resolvedPathsJson, precheck.checkedAt);
    }
    getExecutionPrecheck(executionId) {
        return queryOne(this.conn, `SELECT
        id, execution_id AS executionId, allowed, reason_code AS reasonCode,
        resolved_budget_usd AS resolvedBudgetUsd, resolved_timeout_ms AS resolvedTimeoutMs,
        resolved_sandbox_mode AS resolvedSandboxMode, resolved_tools_json AS resolvedToolsJson,
        resolved_paths_json AS resolvedPathsJson, checked_at AS checkedAt
       FROM execution_prechecks WHERE execution_id = ?`, executionId);
    }
    // === Dead Letter Records ===
    insertDeadLetter(deadLetter) {
        this.conn
            .prepare(`INSERT INTO dead_letters (
          id, task_id, execution_id, final_reason_code, retry_count,
          last_error_message, moved_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .run(deadLetter.id, deadLetter.taskId, deadLetter.executionId, deadLetter.finalReasonCode, deadLetter.retryCount, deadLetter.lastErrorMessage, deadLetter.movedAt);
    }
    getDeadLetterByExecutionId(executionId) {
        return queryOne(this.conn, `SELECT
        id, task_id AS taskId, execution_id AS executionId, final_reason_code AS finalReasonCode,
        retry_count AS retryCount, last_error_message AS lastErrorMessage, moved_at AS movedAt
       FROM dead_letters WHERE execution_id = ?`, executionId);
    }
    listDeadLettersByTask(taskId) {
        return queryAll(this.conn, `SELECT
        id, task_id AS taskId, execution_id AS executionId, final_reason_code AS finalReasonCode,
        retry_count AS retryCount, last_error_message AS lastErrorMessage, moved_at AS movedAt
       FROM dead_letters WHERE task_id = ? ORDER BY moved_at DESC`, taskId);
    }
}
//# sourceMappingURL=execution-repository.js.map