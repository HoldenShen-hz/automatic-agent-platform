import type { AgentExecutionRecord, RemoteLogRecord } from "../sqlite-repository-contracts.js";
import { resolveTenantScope } from "../authoritative-task-store-types.js";
import { execute, queryAll, queryOne, type SqliteConnection } from "../query-helper.js";

const AGENT_EXECUTION_SELECT = `SELECT
  a.execution_id AS "executionId",
  a.task_id AS "taskId",
  a.agent_id AS "agentId",
  a.workflow_id AS "workflowId",
  a.role_id AS "roleId",
  a.run_kind AS "runKind",
  a.runtime_instance_id AS "runtimeInstanceId",
  a.restarted_from_runtime_instance_id AS "restartedFromRuntimeInstanceId",
  a.restart_generation AS "restartGeneration",
  a.status,
  a.plan_json AS "planJson",
  a.current_step_id AS "currentStepId",
  a.last_tool_name AS "lastToolName",
  a.tool_call_count AS "toolCallCount",
  a.last_decision_json AS "lastDecisionJson",
  a.last_error_code AS "lastErrorCode",
  a.retry_count AS "retryCount",
  a.progress_message AS "progressMessage",
  a.started_at AS "startedAt",
  a.created_at AS "createdAt",
  a.updated_at AS "updatedAt",
  a.completed_at AS "completedAt"
 FROM agent_execution_records a`;

const REMOTE_LOG_SELECT = `SELECT
  r.id,
  r.task_id AS "taskId",
  r.execution_id AS "executionId",
  r.worker_id AS "workerId",
  r.runtime_instance_id AS "runtimeInstanceId",
  r.level,
  r.message,
  r.context_json AS "contextJson",
  r.created_at AS "createdAt"
 FROM remote_log_entries r`;

export class AgentExecutionRepository {
  public constructor(private readonly conn: SqliteConnection) {}

  public insertRemoteLog(record: RemoteLogRecord): void {
    execute(
      this.conn,
      `INSERT INTO remote_log_entries (
        id, task_id, execution_id, worker_id, runtime_instance_id, level, message, context_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id,
      record.taskId,
      record.executionId,
      record.workerId,
      record.runtimeInstanceId,
      record.level,
      record.message,
      record.contextJson,
      record.createdAt,
    );
  }

  public upsertAgentExecutionRecord(record: AgentExecutionRecord): void {
    execute(
      this.conn,
      `INSERT INTO agent_execution_records (
        execution_id, task_id, agent_id, workflow_id, role_id, run_kind,
        runtime_instance_id, restarted_from_runtime_instance_id, restart_generation,
        status, plan_json, current_step_id, last_tool_name, tool_call_count,
        last_decision_json, last_error_code, retry_count, progress_message,
        started_at, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(execution_id) DO UPDATE SET
        task_id = excluded.task_id,
        agent_id = excluded.agent_id,
        workflow_id = excluded.workflow_id,
        role_id = excluded.role_id,
        run_kind = excluded.run_kind,
        runtime_instance_id = excluded.runtime_instance_id,
        restarted_from_runtime_instance_id = excluded.restarted_from_runtime_instance_id,
        restart_generation = excluded.restart_generation,
        status = excluded.status,
        plan_json = excluded.plan_json,
        current_step_id = excluded.current_step_id,
        last_tool_name = excluded.last_tool_name,
        tool_call_count = excluded.tool_call_count,
        last_decision_json = excluded.last_decision_json,
        last_error_code = excluded.last_error_code,
        retry_count = excluded.retry_count,
        progress_message = excluded.progress_message,
        started_at = excluded.started_at,
        updated_at = excluded.updated_at,
        completed_at = excluded.completed_at`,
      record.executionId,
      record.taskId,
      record.agentId,
      record.workflowId,
      record.roleId,
      record.runKind,
      record.runtimeInstanceId,
      record.restartedFromRuntimeInstanceId,
      record.restartGeneration,
      record.status,
      record.planJson,
      record.currentStepId,
      record.lastToolName,
      record.toolCallCount,
      record.lastDecisionJson,
      record.lastErrorCode,
      record.retryCount,
      record.progressMessage,
      record.startedAt,
      record.createdAt,
      record.updatedAt,
      record.completedAt,
    );
  }

  public getAgentExecutionRecord(
    executionId: string,
    tenantId?: string | null,
  ): AgentExecutionRecord | undefined {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryOne<AgentExecutionRecord>(
        this.conn,
        `${AGENT_EXECUTION_SELECT}
         INNER JOIN tasks t ON t.id = a.task_id
         WHERE a.execution_id = ?
           AND t.tenant_id = ?`,
        executionId,
        scopedTenantId,
      );
    }
    return queryOne<AgentExecutionRecord>(
      this.conn,
      `${AGENT_EXECUTION_SELECT}
       WHERE a.execution_id = ?`,
      executionId,
    );
  }

  public listAgentExecutionRecordsByTask(
    taskId: string,
    tenantId?: string | null,
  ): AgentExecutionRecord[] {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryAll<AgentExecutionRecord>(
        this.conn,
        `${AGENT_EXECUTION_SELECT}
         INNER JOIN tasks t ON t.id = a.task_id
         WHERE a.task_id = ?
           AND t.tenant_id = ?
         ORDER BY a.updated_at ASC, a.execution_id ASC`,
        taskId,
        scopedTenantId,
      );
    }
    return queryAll<AgentExecutionRecord>(
      this.conn,
      `${AGENT_EXECUTION_SELECT}
       WHERE a.task_id = ?
       ORDER BY a.updated_at ASC, a.execution_id ASC`,
      taskId,
    );
  }

  public listRemoteLogsByTask(taskId: string, tenantId?: string | null): RemoteLogRecord[] {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryAll<RemoteLogRecord>(
        this.conn,
        `${REMOTE_LOG_SELECT}
         INNER JOIN tasks t ON t.id = r.task_id
         WHERE r.task_id = ?
           AND t.tenant_id = ?
         ORDER BY r.created_at ASC, r.id ASC`,
        taskId,
        scopedTenantId,
      );
    }
    return queryAll<RemoteLogRecord>(
      this.conn,
      `${REMOTE_LOG_SELECT}
       WHERE r.task_id = ?
       ORDER BY r.created_at ASC, r.id ASC`,
      taskId,
    );
  }

  public listRemoteLogsByExecution(executionId: string, tenantId?: string | null): RemoteLogRecord[] {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryAll<RemoteLogRecord>(
        this.conn,
        `${REMOTE_LOG_SELECT}
         INNER JOIN tasks t ON t.id = r.task_id
         WHERE r.execution_id = ?
           AND t.tenant_id = ?
         ORDER BY r.created_at ASC, r.id ASC`,
        executionId,
        scopedTenantId,
      );
    }
    return queryAll<RemoteLogRecord>(
      this.conn,
      `${REMOTE_LOG_SELECT}
       WHERE r.execution_id = ?
       ORDER BY r.created_at ASC, r.id ASC`,
      executionId,
    );
  }
}
