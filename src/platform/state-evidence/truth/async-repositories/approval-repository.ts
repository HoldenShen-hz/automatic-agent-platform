/**
 * AsyncApprovalRepository - Async data access for approvals and takeover sessions.
 *
 * This is the async PostgreSQL-compatible version of ApprovalRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */

import type { ApprovalRecord, OperatorActionRecord, TakeoverSessionRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
import { resolveTenantScope } from "../sqlite/authoritative-task-store-types.js";

export class AsyncApprovalRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  /**
   * List approvals for a task.
   */
  public async listApprovalsByTask(taskId: string, tenantId?: string | null): Promise<ApprovalRecord[]> {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return asyncQueryAll<ApprovalRecord>(
        this.conn,
        `SELECT
          a.id,
          a.task_id AS "taskId",
          a.execution_id AS "executionId",
          a.status,
          a.request_json AS "requestJson",
          a.response_json AS "responseJson",
          a.timeout_policy AS "timeoutPolicy",
          a.created_at AS "createdAt",
          a.responded_at AS "respondedAt"
         FROM approvals a
         INNER JOIN tasks t ON t.id = a.task_id
         WHERE a.task_id = $1
           AND t.tenant_id = $2
         ORDER BY a.created_at ASC`,
        taskId,
        scopedTenantId,
      );
    }
    return asyncQueryAll<ApprovalRecord>(
      this.conn,
      `SELECT
        id,
        task_id AS "taskId",
        execution_id AS "executionId",
        status,
        request_json AS "requestJson",
        response_json AS "responseJson",
        timeout_policy AS "timeoutPolicy",
        created_at AS "createdAt",
        responded_at AS "respondedAt"
       FROM approvals
       WHERE task_id = $1
       ORDER BY created_at ASC`,
      taskId,
    );
  }

  /**
   * Get an approval by ID with optional tenant scoping.
   */
  public async getApproval(approvalId: string, tenantId?: string | null): Promise<ApprovalRecord | null> {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      const result = await asyncQueryOne<ApprovalRecord>(
        this.conn,
        `SELECT
          a.id,
          a.task_id AS "taskId",
          a.execution_id AS "executionId",
          a.status,
          a.request_json AS "requestJson",
          a.response_json AS "responseJson",
          a.timeout_policy AS "timeoutPolicy",
          a.created_at AS "createdAt",
          a.responded_at AS "respondedAt"
         FROM approvals a
         INNER JOIN tasks t ON t.id = a.task_id
         WHERE a.id = $1
           AND t.tenant_id = $2`,
        approvalId,
        scopedTenantId,
      );
      return result ?? null;
    }
    const result = await asyncQueryOne<ApprovalRecord>(
      this.conn,
      `SELECT
        id,
        task_id AS "taskId",
        execution_id AS "executionId",
        status,
        request_json AS "requestJson",
        response_json AS "responseJson",
        timeout_policy AS "timeoutPolicy",
        created_at AS "createdAt",
        responded_at AS "respondedAt"
       FROM approvals
       WHERE id = $1`,
      approvalId,
    );
    return result ?? null;
  }

  /**
   * Insert a new approval record.
   */
  public async insertApproval(approval: ApprovalRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO approvals (
        id, task_id, execution_id, status, request_json, response_json,
        timeout_policy, created_at, responded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      approval.id,
      approval.taskId,
      approval.executionId,
      approval.status,
      approval.requestJson,
      approval.responseJson,
      approval.timeoutPolicy,
      approval.createdAt,
      approval.respondedAt,
    );
  }

  /**
   * Update approval decision.
   */
  public async updateApprovalDecision(input: {
    approvalId: string;
    status: ApprovalRecord["status"];
    responseJson: string;
    respondedAt: string;
  }): Promise<number> {
    return asyncExecute(
      this.conn,
      `UPDATE approvals
       SET status = $1, response_json = $2, responded_at = $3
       WHERE id = $4`,
      input.status,
      input.responseJson,
      input.respondedAt,
      input.approvalId,
    );
  }

  /**
   * List approvals by status.
   */
  public async listApprovalsByStatus(status: ApprovalRecord["status"]): Promise<ApprovalRecord[]> {
    return asyncQueryAll<ApprovalRecord>(
      this.conn,
      `SELECT
        id,
        task_id AS "taskId",
        execution_id AS "executionId",
        status,
        request_json AS "requestJson",
        response_json AS "responseJson",
        timeout_policy AS "timeoutPolicy",
        created_at AS "createdAt",
        responded_at AS "respondedAt"
       FROM approvals
       WHERE status = $1
       ORDER BY created_at ASC`,
      status,
    );
  }

  /**
   * List takeover sessions for a task.
   */
  public async listTakeoverSessionsByTask(taskId: string, tenantId?: string | null): Promise<TakeoverSessionRecord[]> {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return asyncQueryAll<TakeoverSessionRecord>(
        this.conn,
        `SELECT
          x.id,
          x.task_id AS "taskId",
          x.execution_id AS "executionId",
          x.operator_id AS "operatorId",
          x.status,
          x.reason_code AS "reasonCode",
          x.started_at AS "startedAt",
          x.closed_at AS "closedAt"
         FROM takeover_sessions x
         INNER JOIN tasks t ON t.id = x.task_id
         WHERE x.task_id = $1
           AND t.tenant_id = $2
         ORDER BY x.started_at ASC`,
        taskId,
        scopedTenantId,
      );
    }
    return asyncQueryAll<TakeoverSessionRecord>(
      this.conn,
      `SELECT
        id,
        task_id AS "taskId",
        execution_id AS "executionId",
        operator_id AS "operatorId",
        status,
        reason_code AS "reasonCode",
        started_at AS "startedAt",
        closed_at AS "closedAt"
       FROM takeover_sessions
       WHERE task_id = $1
       ORDER BY started_at ASC`,
      taskId,
    );
  }

  public async insertTakeoverSession(session: TakeoverSessionRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO takeover_sessions (
        id, task_id, execution_id, operator_id, status, reason_code, started_at, closed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      session.id,
      session.taskId,
      session.executionId,
      session.operatorId,
      session.status,
      session.reasonCode,
      session.startedAt,
      session.closedAt,
    );
  }

  /**
   * Get a takeover session by ID.
   */
  public async getTakeoverSession(sessionId: string, tenantId?: string | null): Promise<TakeoverSessionRecord | null> {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      const result = await asyncQueryOne<TakeoverSessionRecord>(
        this.conn,
        `SELECT
          x.id,
          x.task_id AS "taskId",
          x.execution_id AS "executionId",
          x.operator_id AS "operatorId",
          x.status,
          x.reason_code AS "reasonCode",
          x.started_at AS "startedAt",
          x.closed_at AS "closedAt"
         FROM takeover_sessions x
         INNER JOIN tasks t ON t.id = x.task_id
         WHERE x.id = $1
           AND t.tenant_id = $2`,
        sessionId,
        scopedTenantId,
      );
      return result ?? null;
    }
    const result = await asyncQueryOne<TakeoverSessionRecord>(
      this.conn,
      `SELECT
        id,
        task_id AS "taskId",
        execution_id AS "executionId",
        operator_id AS "operatorId",
        status,
        reason_code AS "reasonCode",
        started_at AS "startedAt",
        closed_at AS "closedAt"
       FROM takeover_sessions
       WHERE id = $1`,
      sessionId,
    );
    return result ?? null;
  }

  /**
   * Close a takeover session.
   */
  public async closeTakeoverSession(sessionId: string, closedAt: string): Promise<number> {
    return asyncExecute(
      this.conn,
      `UPDATE takeover_sessions SET status = 'closed', closed_at = $1 WHERE id = $2`,
      closedAt,
      sessionId,
    );
  }

  /**
   * Insert an operator action record.
   */
  public async insertOperatorAction(action: OperatorActionRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO operator_actions (
        id, takeover_session_id, task_id, execution_id, operator_id, action_type, reason_code,
        action_payload_json, before_state_json, after_state_json, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      action.id,
      action.takeoverSessionId,
      action.taskId,
      action.executionId,
      action.operatorId,
      action.actionType,
      action.reasonCode,
      action.actionPayloadJson,
      action.beforeStateJson,
      action.afterStateJson,
      action.createdAt,
    );
  }

  /**
   * List operator actions for a task.
   */
  public async listOperatorActionsByTask(taskId: string, tenantId?: string | null): Promise<OperatorActionRecord[]> {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return asyncQueryAll<OperatorActionRecord>(
        this.conn,
        `SELECT
          o.id,
          o.takeover_session_id AS "takeoverSessionId",
          o.task_id AS "taskId",
          o.execution_id AS "executionId",
          o.operator_id AS "operatorId",
          o.action_type AS "actionType",
          o.reason_code AS "reasonCode",
          o.action_payload_json AS "actionPayloadJson",
          o.before_state_json AS "beforeStateJson",
          o.after_state_json AS "afterStateJson",
          o.created_at AS "createdAt"
         FROM operator_actions o
         INNER JOIN tasks t ON t.id = o.task_id
         WHERE o.task_id = $1
           AND t.tenant_id = $2
         ORDER BY o.created_at ASC`,
        taskId,
        scopedTenantId,
      );
    }
    return asyncQueryAll<OperatorActionRecord>(
      this.conn,
      `SELECT
        id,
        takeover_session_id AS "takeoverSessionId",
        task_id AS "taskId",
        execution_id AS "executionId",
        operator_id AS "operatorId",
        action_type AS "actionType",
        reason_code AS "reasonCode",
        action_payload_json AS "actionPayloadJson",
        before_state_json AS "beforeStateJson",
        after_state_json AS "afterStateJson",
        created_at AS "createdAt"
       FROM operator_actions
       WHERE task_id = $1
       ORDER BY created_at ASC`,
      taskId,
    );
  }
}
