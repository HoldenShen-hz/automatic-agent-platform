import type { AgentExecutionRecord, RemoteLogRecord } from "../../../../contracts/types/domain.js";
import { resolveTenantScope } from "../authoritative-task-store-types.js";
import { execute, queryAll, queryOne, type SqliteConnection } from "../query-helper.js";

const AGENT_EXECUTION_SELECT = `SELECT
  execution_id AS "executionId",
  task_id AS "taskId",
  agent_id AS "agentId",
  workflow_id AS "workflowId",
  role_id AS "roleId",
  run_kind AS "runKind",
  runtime_instance_id AS "runtimeInstanceId",
  restarted_from_runtime_instance_id AS "restartedFromRuntimeInstanceId",
  restart_generation AS "restartGeneration",
  status,
  plan_json AS "planJson",
  current_step_id AS "currentStepId",
  last_tool_name AS "lastToolName",
  tool_call_count AS "toolCallCount",
  last_decision_json AS "lastDecisionJson",
  last_error_code AS "lastErrorCode",
  retry_count AS "retryCount",
  progress_message AS "progressMessage",
  started_at AS "startedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  completed_at AS "completedAt"
 FROM agent_execution_records`;

const REMOTE_LOG_SELECT = `SELECT
  id,
  task_id AS "taskId",
  execution_id AS "executionId",
  worker_id AS "workerId",
  runtime_instance_id AS "runtimeInstanceId",
  level,
  message,
  context_json AS "contextJson",
  created_at AS "createdAt"
 FROM remote_log_entries`;

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
        `${AGENT_EXECUTION_SELECT} a
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
       WHERE execution_id = ?`,
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
        `${AGENT_EXECUTION_SELECT} a
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
       WHERE task_id = ?
       ORDER BY updated_at ASC, execution_id ASC`,
      taskId,
    );
  }

  public listRemoteLogsByTask(taskId: string, tenantId?: string | null): RemoteLogRecord[] {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryAll<RemoteLogRecord>(
        this.conn,
        `${REMOTE_LOG_SELECT} r
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
       WHERE task_id = ?
       ORDER BY created_at ASC, id ASC`,
      taskId,
    );
  }

  public listRemoteLogsByExecution(executionId: string, tenantId?: string | null): RemoteLogRecord[] {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryAll<RemoteLogRecord>(
        this.conn,
        `${REMOTE_LOG_SELECT} r
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
       WHERE execution_id = ?
       ORDER BY created_at ASC, id ASC`,
      executionId,
    );
  }
}
