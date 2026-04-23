/**
 * ApprovalRepository - Data access for approvals and takeover sessions.
 *
 * This repository handles all data access for:
 * - ApprovalRecord (approvals table)
 * - TakeoverSessionRecord (takeover_sessions table)
 * - OperatorActionRecord (operator_actions table)
 *
 * All SQL queries use proper column aliasing to match the camelCase domain types.
 * The query helper functions centralize `as unknown as T` type casts.
 */
import { queryAll, queryOne, execute } from "../query-helper.js";
import { resolveTenantScope } from "../authoritative-task-store-types.js";
export class ApprovalRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    /**
     * List approvals for a task.
     */
    listApprovalsByTask(taskId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return queryAll(this.conn, `SELECT
          a.id,
          a.task_id AS taskId,
          a.execution_id AS executionId,
          a.status,
          a.request_json AS requestJson,
          a.response_json AS responseJson,
          a.timeout_policy AS timeoutPolicy,
          a.created_at AS createdAt,
          a.responded_at AS respondedAt
         FROM approvals a
         INNER JOIN tasks t ON t.id = a.task_id
         WHERE a.task_id = ?
           AND t.tenant_id = ?
         ORDER BY a.created_at ASC`, taskId, scopedTenantId);
        }
        return queryAll(this.conn, `SELECT
        id,
        task_id AS taskId,
        execution_id AS executionId,
        status,
        request_json AS requestJson,
        response_json AS responseJson,
        timeout_policy AS timeoutPolicy,
        created_at AS createdAt,
        responded_at AS respondedAt
       FROM approvals
       WHERE task_id = ?
       ORDER BY created_at ASC`, taskId);
    }
    /**
     * Get an approval by ID with optional tenant scoping.
     */
    getApproval(approvalId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return queryOne(this.conn, `SELECT
          a.id,
          a.task_id AS taskId,
          a.execution_id AS executionId,
          a.status,
          a.request_json AS requestJson,
          a.response_json AS responseJson,
          a.timeout_policy AS timeoutPolicy,
          a.created_at AS createdAt,
          a.responded_at AS respondedAt
         FROM approvals a
         INNER JOIN tasks t ON t.id = a.task_id
         WHERE a.id = ?
           AND t.tenant_id = ?`, approvalId, scopedTenantId) ?? null;
        }
        return queryOne(this.conn, `SELECT
        id,
        task_id AS taskId,
        execution_id AS executionId,
        status,
        request_json AS requestJson,
        response_json AS responseJson,
        timeout_policy AS timeoutPolicy,
        created_at AS createdAt,
        responded_at AS respondedAt
       FROM approvals
       WHERE id = ?`, approvalId) ?? null;
    }
    /**
     * Insert a new approval record.
     */
    insertApproval(approval) {
        execute(this.conn, `INSERT INTO approvals (
        id, task_id, execution_id, status, request_json, response_json,
        timeout_policy, created_at, responded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, approval.id, approval.taskId, approval.executionId, approval.status, approval.requestJson, approval.responseJson, approval.timeoutPolicy, approval.createdAt, approval.respondedAt);
    }
    /**
       * Update approval decision.
       */
    updateApprovalDecision(input) {
        execute(this.conn, `UPDATE approvals
       SET status = ?, response_json = ?, responded_at = ?
       WHERE id = ?`, input.status, input.responseJson, input.respondedAt, input.approvalId);
    }
    /**
     * Updates approval decision with CAS (Compare-And-Swap) semantics.
     * Only updates if the current status matches the expected status.
     * @returns Number of rows affected (1 if successful, 0 if CAS failed)
     */
    updateApprovalDecisionCas(input) {
        return execute(this.conn, `UPDATE approvals
       SET status = ?, response_json = ?, responded_at = ?
       WHERE id = ? AND status = ?`, input.status, input.responseJson, input.respondedAt, input.approvalId, input.expectedStatus);
    }
    /**
     * Update approval request JSON.
     */
    updateApprovalRequest(input) {
        execute(this.conn, `UPDATE approvals
       SET request_json = ?
       WHERE id = ?`, input.requestJson, input.id);
    }
    /**
     * List approvals by status.
     */
    listApprovalsByStatus(status) {
        return queryAll(this.conn, `SELECT
        id,
        task_id AS taskId,
        execution_id AS executionId,
        status,
        request_json AS requestJson,
        response_json AS responseJson,
        timeout_policy AS timeoutPolicy,
        created_at AS createdAt,
        responded_at AS respondedAt
       FROM approvals
       WHERE status = ?
       ORDER BY created_at ASC`, status);
    }
    /**
     * List takeover sessions for a task.
     */
    listTakeoverSessionsByTask(taskId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return queryAll(this.conn, `SELECT
          x.id,
          x.task_id AS taskId,
          x.execution_id AS executionId,
          x.operator_id AS operatorId,
          x.status,
          x.reason_code AS reasonCode,
          x.started_at AS startedAt,
          x.closed_at AS closedAt
         FROM takeover_sessions x
         INNER JOIN tasks t ON t.id = x.task_id
         WHERE x.task_id = ?
           AND t.tenant_id = ?
         ORDER BY x.started_at ASC`, taskId, scopedTenantId);
        }
        return queryAll(this.conn, `SELECT
        id,
        task_id AS taskId,
        execution_id AS executionId,
        operator_id AS operatorId,
        status,
        reason_code AS reasonCode,
        started_at AS startedAt,
        closed_at AS closedAt
       FROM takeover_sessions
       WHERE task_id = ?
       ORDER BY started_at ASC`, taskId);
    }
    insertTakeoverSession(session) {
        execute(this.conn, `INSERT INTO takeover_sessions (
        id, task_id, execution_id, operator_id, status, reason_code, started_at, closed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, session.id, session.taskId, session.executionId, session.operatorId, session.status, session.reasonCode, session.startedAt, session.closedAt);
    }
    /**
     * Get a takeover session by ID.
     */
    getTakeoverSession(sessionId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return queryOne(this.conn, `SELECT
          x.id,
          x.task_id AS taskId,
          x.execution_id AS executionId,
          x.operator_id AS operatorId,
          x.status,
          x.reason_code AS reasonCode,
          x.started_at AS startedAt,
          x.closed_at AS closedAt
         FROM takeover_sessions x
         INNER JOIN tasks t ON t.id = x.task_id
         WHERE x.id = ?
           AND t.tenant_id = ?`, sessionId, scopedTenantId) ?? null;
        }
        return queryOne(this.conn, `SELECT
        id,
        task_id AS taskId,
        execution_id AS executionId,
        operator_id AS operatorId,
        status,
        reason_code AS reasonCode,
        started_at AS startedAt,
        closed_at AS closedAt
       FROM takeover_sessions
       WHERE id = ?`, sessionId) ?? null;
    }
    /**
     * Close a takeover session.
     */
    closeTakeoverSession(sessionId, closedAt) {
        execute(this.conn, `UPDATE takeover_sessions SET status = 'closed', closed_at = ? WHERE id = ?`, closedAt, sessionId);
    }
    /**
     * Insert an operator action record.
     */
    insertOperatorAction(action) {
        execute(this.conn, `INSERT INTO operator_actions (
        id, takeover_session_id, task_id, execution_id, operator_id, action_type, reason_code,
        action_payload_json, before_state_json, after_state_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, action.id, action.takeoverSessionId, action.taskId, action.executionId, action.operatorId, action.actionType, action.reasonCode, action.actionPayloadJson, action.beforeStateJson, action.afterStateJson, action.createdAt);
    }
    /**
     * List operator actions for a task.
     */
    listOperatorActionsByTask(taskId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return queryAll(this.conn, `SELECT
          o.id,
          o.takeover_session_id AS takeoverSessionId,
          o.task_id AS taskId,
          o.execution_id AS executionId,
          o.operator_id AS operatorId,
          o.action_type AS actionType,
          o.reason_code AS reasonCode,
          o.action_payload_json AS actionPayloadJson,
          o.before_state_json AS beforeStateJson,
          o.after_state_json AS afterStateJson,
          o.created_at AS createdAt
         FROM operator_actions o
         INNER JOIN tasks t ON t.id = o.task_id
         WHERE o.task_id = ?
           AND t.tenant_id = ?
         ORDER BY o.created_at ASC`, taskId, scopedTenantId);
        }
        return queryAll(this.conn, `SELECT
        id,
        takeover_session_id AS takeoverSessionId,
        task_id AS taskId,
        execution_id AS executionId,
        operator_id AS operatorId,
        action_type AS actionType,
        reason_code AS reasonCode,
        action_payload_json AS actionPayloadJson,
        before_state_json AS beforeStateJson,
        after_state_json AS afterStateJson,
        created_at AS createdAt
       FROM operator_actions
       WHERE task_id = ?
       ORDER BY created_at ASC`, taskId);
    }
}
//# sourceMappingURL=approval-repository.js.map