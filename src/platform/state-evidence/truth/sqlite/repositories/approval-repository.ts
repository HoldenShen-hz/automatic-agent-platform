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

import type { ApprovalRecord, TakeoverSessionRecord, OperatorActionRecord } from "../../../../contracts/types/domain.js";
import type { SqliteConnection } from "../query-helper.js";
import { queryAll, queryOne, execute } from "../query-helper.js";
import { resolveTenantScope } from "../authoritative-task-store-types.js";

export class ApprovalRepository {
  public constructor(private readonly conn: SqliteConnection) {}

  /**
   * List approvals for a task.
   */
  public listApprovalsByTask(taskId: string, tenantId?: string | null): ApprovalRecord[] {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryAll<ApprovalRecord>(
        this.conn,
        `SELECT
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
         ORDER BY a.created_at ASC`,
        taskId,
        scopedTenantId,
      );
    }
    return queryAll<ApprovalRecord>(
      this.conn,
      `SELECT
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
       ORDER BY created_at ASC`,
      taskId,
    );
  }

  /**
   * Get an approval by ID with optional tenant scoping.
   */
  public getApproval(approvalId: string, tenantId?: string | null): ApprovalRecord | null {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryOne<ApprovalRecord>(
        this.conn,
        `SELECT
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
           AND t.tenant_id = ?`,
        approvalId,
        scopedTenantId,
      ) ?? null;
    }
    return queryOne<ApprovalRecord>(
      this.conn,
      `SELECT
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
       WHERE id = ?`,
      approvalId,
    ) ?? null;
  }

  /**
   * Insert a new approval record.
   */
  public insertApproval(approval: ApprovalRecord): void {
    execute(
      this.conn,
      `INSERT INTO approvals (
        id, task_id, execution_id, status, request_json, response_json,
        timeout_policy, created_at, responded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  public updateApprovalDecision(input: {
    approvalId: string;
    status: ApprovalRecord["status"];
    responseJson: string;
    respondedAt: string;
  }): void {
    execute(
      this.conn,
      `UPDATE approvals
       SET status = ?, response_json = ?, responded_at = ?
       WHERE id = ?`,
      input.status,
      input.responseJson,
      input.respondedAt,
      input.approvalId,
    );
  }

  /**
   * List approvals by status.
   */
  public listApprovalsByStatus(status: ApprovalRecord["status"]): ApprovalRecord[] {
    return queryAll<ApprovalRecord>(
      this.conn,
      `SELECT
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
       ORDER BY created_at ASC`,
      status,
    );
  }

  /**
   * List takeover sessions for a task.
   */
  public listTakeoverSessionsByTask(taskId: string, tenantId?: string | null): TakeoverSessionRecord[] {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryAll<TakeoverSessionRecord>(
        this.conn,
        `SELECT
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
         ORDER BY x.started_at ASC`,
        taskId,
        scopedTenantId,
      );
    }
    return queryAll<TakeoverSessionRecord>(
      this.conn,
      `SELECT
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
       ORDER BY started_at ASC`,
      taskId,
    );
  }

  public insertTakeoverSession(session: TakeoverSessionRecord): void {
    execute(
      this.conn,
      `INSERT INTO takeover_sessions (
        id, task_id, execution_id, operator_id, status, reason_code, started_at, closed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
  public getTakeoverSession(sessionId: string, tenantId?: string | null): TakeoverSessionRecord | null {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryOne<TakeoverSessionRecord>(
        this.conn,
        `SELECT
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
           AND t.tenant_id = ?`,
        sessionId,
        scopedTenantId,
      ) ?? null;
    }
    return queryOne<TakeoverSessionRecord>(
      this.conn,
      `SELECT
        id,
        task_id AS taskId,
        execution_id AS executionId,
        operator_id AS operatorId,
        status,
        reason_code AS reasonCode,
        started_at AS startedAt,
        closed_at AS closedAt
       FROM takeover_sessions
       WHERE id = ?`,
      sessionId,
    ) ?? null;
  }

  /**
   * Close a takeover session.
   */
  public closeTakeoverSession(sessionId: string, closedAt: string): void {
    execute(
      this.conn,
      `UPDATE takeover_sessions SET status = 'closed', closed_at = ? WHERE id = ?`,
      closedAt,
      sessionId,
    );
  }

  /**
   * Insert an operator action record.
   */
  public insertOperatorAction(action: OperatorActionRecord): void {
    execute(
      this.conn,
      `INSERT INTO operator_actions (
        id, takeover_session_id, task_id, execution_id, operator_id, action_type, reason_code,
        action_payload_json, before_state_json, after_state_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  public listOperatorActionsByTask(taskId: string, tenantId?: string | null): OperatorActionRecord[] {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryAll<OperatorActionRecord>(
        this.conn,
        `SELECT
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
         ORDER BY o.created_at ASC`,
        taskId,
        scopedTenantId,
      );
    }
    return queryAll<OperatorActionRecord>(
      this.conn,
      `SELECT
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
       ORDER BY created_at ASC`,
      taskId,
    );
  }
}
