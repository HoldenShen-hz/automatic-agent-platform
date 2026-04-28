/**
 * AsyncWorkerRepository - Async data access for workers, tickets, leases, heartbeats, and runtime snapshots.
 */

import type {
  AgentExecutionRecord,
  CoordinatorInstanceRecord,
  ExecutionLeaseRecord,
  ExecutionTicketRecord,
  HeartbeatSnapshotRecord,
  LeaseAuditRecord,
  RemoteLogRecord,
  WorkerRegistrationChallengeRecord,
  WorkerSnapshotRecord,
} from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
import { resolveTenantScope } from "../sqlite/authoritative-task-store-types.js";

export class AsyncWorkerRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  public async insertHeartbeatSnapshot(snapshot: HeartbeatSnapshotRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO heartbeat_snapshots (
        id, execution_id, agent_id, runtime_instance_id, restart_generation,
        status, progress_message, cpu_pct, memory_mb, sampled_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      snapshot.id,
      snapshot.executionId,
      snapshot.agentId,
      snapshot.runtimeInstanceId,
      snapshot.restartGeneration,
      snapshot.status,
      snapshot.progressMessage,
      snapshot.cpuPct,
      snapshot.memoryMb,
      snapshot.sampledAt,
    );
  }

  public async insertRemoteLog(record: RemoteLogRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO remote_log_entries (
        id, task_id, execution_id, worker_id, runtime_instance_id, level, message, context_json, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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

  public async upsertAgentExecutionRecord(record: AgentExecutionRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO agent_execution_records (
        execution_id, task_id, agent_id, workflow_id, role_id, run_kind,
        runtime_instance_id, restarted_from_runtime_instance_id, restart_generation,
        status, plan_json, current_step_id, last_tool_name, tool_call_count,
        last_decision_json, last_error_code, retry_count, progress_message,
        started_at, created_at, updated_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
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

  public async upsertWorkerSnapshot(snapshot: WorkerSnapshotRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO worker_snapshots (
        worker_id, status, placement, isolation_level, repo_version, remote_session_status,
        last_acknowledged_stream_offset, stream_resume_success_rate, credential_refresh_success_rate,
        session_consistency_check_status, session_consistency_checked_at, workspace_sync_status,
        workspace_sync_checked_at, saturation, active_lease_count, mean_startup_latency_ms,
        sandbox_success_rate, repo_cache_hit_rate, registration_verified_at, registration_challenge_id,
        capabilities_json, running_executions_json, max_concurrency, queue_affinity, runtime_instance_id,
        restarted_from_runtime_instance_id, restart_generation, cpu_pct, memory_mb, tool_backlog_count,
        current_step_id, last_progress_at, last_heartbeat_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)
      ON CONFLICT(worker_id) DO UPDATE SET
        status = excluded.status,
        placement = excluded.placement,
        isolation_level = excluded.isolation_level,
        repo_version = excluded.repo_version,
        remote_session_status = excluded.remote_session_status,
        last_acknowledged_stream_offset = excluded.last_acknowledged_stream_offset,
        stream_resume_success_rate = excluded.stream_resume_success_rate,
        credential_refresh_success_rate = excluded.credential_refresh_success_rate,
        session_consistency_check_status = excluded.session_consistency_check_status,
        session_consistency_checked_at = excluded.session_consistency_checked_at,
        workspace_sync_status = excluded.workspace_sync_status,
        workspace_sync_checked_at = excluded.workspace_sync_checked_at,
        saturation = excluded.saturation,
        active_lease_count = excluded.active_lease_count,
        mean_startup_latency_ms = excluded.mean_startup_latency_ms,
        sandbox_success_rate = excluded.sandbox_success_rate,
        repo_cache_hit_rate = excluded.repo_cache_hit_rate,
        registration_verified_at = excluded.registration_verified_at,
        registration_challenge_id = excluded.registration_challenge_id,
        capabilities_json = excluded.capabilities_json,
        running_executions_json = excluded.running_executions_json,
        max_concurrency = excluded.max_concurrency,
        queue_affinity = excluded.queue_affinity,
        runtime_instance_id = excluded.runtime_instance_id,
        restarted_from_runtime_instance_id = excluded.restarted_from_runtime_instance_id,
        restart_generation = excluded.restart_generation,
        cpu_pct = excluded.cpu_pct,
        memory_mb = excluded.memory_mb,
        tool_backlog_count = excluded.tool_backlog_count,
        current_step_id = excluded.current_step_id,
        last_progress_at = excluded.last_progress_at,
        last_heartbeat_at = excluded.last_heartbeat_at,
        updated_at = excluded.updated_at`,
      snapshot.workerId,
      snapshot.status,
      snapshot.placement ?? "local",
      snapshot.isolationLevel ?? "standard",
      snapshot.repoVersion ?? null,
      snapshot.remoteSessionStatus ?? null,
      snapshot.lastAcknowledgedStreamOffset ?? null,
      snapshot.streamResumeSuccessRate ?? null,
      snapshot.credentialRefreshSuccessRate ?? null,
      snapshot.sessionConsistencyCheckStatus ?? null,
      snapshot.sessionConsistencyCheckedAt ?? null,
      snapshot.workspaceSyncStatus ?? null,
      snapshot.workspaceSyncCheckedAt ?? null,
      snapshot.saturation ?? null,
      snapshot.activeLeaseCount ?? 0,
      snapshot.meanStartupLatencyMs ?? null,
      snapshot.sandboxSuccessRate ?? null,
      snapshot.repoCacheHitRate ?? null,
      snapshot.registrationVerifiedAt ?? null,
      snapshot.registrationChallengeId ?? null,
      snapshot.capabilitiesJson,
      snapshot.runningExecutionsJson,
      snapshot.maxConcurrency,
      snapshot.queueAffinity,
      snapshot.runtimeInstanceId,
      snapshot.restartedFromRuntimeInstanceId,
      snapshot.restartGeneration,
      snapshot.cpuPct,
      snapshot.memoryMb,
      snapshot.toolBacklogCount,
      snapshot.currentStepId,
      snapshot.lastProgressAt,
      snapshot.lastHeartbeatAt,
      snapshot.updatedAt,
    );
  }

  public async upsertCoordinatorInstanceSnapshot(snapshot: CoordinatorInstanceRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO coordinator_instance_snapshots (
        coordinator_id, region, role, queue_affinity, status, max_concurrent_dispatches,
        active_dispatch_count, backlog_count, cpu_pct, shard_json, last_heartbeat_at,
        metadata_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT(coordinator_id) DO UPDATE SET
        region = excluded.region,
        role = excluded.role,
        queue_affinity = excluded.queue_affinity,
        status = excluded.status,
        max_concurrent_dispatches = excluded.max_concurrent_dispatches,
        active_dispatch_count = excluded.active_dispatch_count,
        backlog_count = excluded.backlog_count,
        cpu_pct = excluded.cpu_pct,
        shard_json = excluded.shard_json,
        last_heartbeat_at = excluded.last_heartbeat_at,
        metadata_json = excluded.metadata_json,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at`,
      snapshot.coordinatorId,
      snapshot.region,
      snapshot.role,
      snapshot.queueAffinity,
      snapshot.status,
      snapshot.maxConcurrentDispatches,
      snapshot.activeDispatchCount,
      snapshot.backlogCount,
      snapshot.cpuPct,
      snapshot.shardJson,
      snapshot.lastHeartbeatAt,
      snapshot.metadataJson,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  public async getWorkerSnapshot(workerId: string): Promise<WorkerSnapshotRecord | null> {
    const result = await asyncQueryOne<WorkerSnapshotRecord>(
      this.conn,
      `SELECT
        worker_id AS "workerId",
        status,
        placement,
        isolation_level AS "isolationLevel",
        repo_version AS "repoVersion",
        remote_session_status AS "remoteSessionStatus",
        last_acknowledged_stream_offset AS "lastAcknowledgedStreamOffset",
        stream_resume_success_rate AS "streamResumeSuccessRate",
        credential_refresh_success_rate AS "credentialRefreshSuccessRate",
        session_consistency_check_status AS "sessionConsistencyCheckStatus",
        session_consistency_checked_at AS "sessionConsistencyCheckedAt",
        workspace_sync_status AS "workspaceSyncStatus",
        workspace_sync_checked_at AS "workspaceSyncCheckedAt",
        saturation,
        active_lease_count AS "activeLeaseCount",
        mean_startup_latency_ms AS "meanStartupLatencyMs",
        sandbox_success_rate AS "sandboxSuccessRate",
        repo_cache_hit_rate AS "repoCacheHitRate",
        registration_verified_at AS "registrationVerifiedAt",
        registration_challenge_id AS "registrationChallengeId",
        capabilities_json AS "capabilitiesJson",
        running_executions_json AS "runningExecutionsJson",
        max_concurrency AS "maxConcurrency",
        queue_affinity AS "queueAffinity",
        runtime_instance_id AS "runtimeInstanceId",
        restarted_from_runtime_instance_id AS "restartedFromRuntimeInstanceId",
        restart_generation AS "restartGeneration",
        cpu_pct AS "cpuPct",
        memory_mb AS "memoryMb",
        tool_backlog_count AS "toolBacklogCount",
        current_step_id AS "currentStepId",
        last_progress_at AS "lastProgressAt",
        last_heartbeat_at AS "lastHeartbeatAt",
        updated_at AS "updatedAt"
       FROM worker_snapshots
       WHERE worker_id = $1`,
      workerId,
    );
    return result ?? null;
  }

  public async getAgentExecutionRecord(
    executionId: string,
    tenantId?: string | null,
  ): Promise<AgentExecutionRecord | null> {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      const result = await asyncQueryOne<AgentExecutionRecord>(
        this.conn,
        `SELECT
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
         FROM agent_execution_records a
         INNER JOIN tasks t ON t.id = a.task_id
         WHERE a.execution_id = $1
           AND t.tenant_id = $2`,
        executionId,
        scopedTenantId,
      );
      return result ?? null;
    }
    const result = await asyncQueryOne<AgentExecutionRecord>(
      this.conn,
      `SELECT
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
       FROM agent_execution_records
       WHERE execution_id = $1`,
      executionId,
    );
    return result ?? null;
  }

  public async listAgentExecutionRecordsByTask(
    taskId: string,
    tenantId?: string | null,
  ): Promise<AgentExecutionRecord[]> {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return asyncQueryAll<AgentExecutionRecord>(
        this.conn,
        `SELECT
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
         FROM agent_execution_records a
         INNER JOIN tasks t ON t.id = a.task_id
         WHERE a.task_id = $1
           AND t.tenant_id = $2
         ORDER BY a.updated_at ASC, a.execution_id ASC`,
        taskId,
        scopedTenantId,
      );
    }
    return asyncQueryAll<AgentExecutionRecord>(
      this.conn,
      `SELECT
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
       FROM agent_execution_records
       WHERE task_id = $1
       ORDER BY updated_at ASC, execution_id ASC`,
      taskId,
    );
  }

  public async listWorkerSnapshots(status?: string, limit?: number): Promise<WorkerSnapshotRecord[]> {
    const params: unknown[] = [];
    let sql = `SELECT
       worker_id AS "workerId",
       status,
       placement,
       isolation_level AS "isolationLevel",
       repo_version AS "repoVersion",
       remote_session_status AS "remoteSessionStatus",
       last_acknowledged_stream_offset AS "lastAcknowledgedStreamOffset",
       stream_resume_success_rate AS "streamResumeSuccessRate",
       credential_refresh_success_rate AS "credentialRefreshSuccessRate",
       session_consistency_check_status AS "sessionConsistencyCheckStatus",
       session_consistency_checked_at AS "sessionConsistencyCheckedAt",
       workspace_sync_status AS "workspaceSyncStatus",
       workspace_sync_checked_at AS "workspaceSyncCheckedAt",
       saturation,
       active_lease_count AS "activeLeaseCount",
       mean_startup_latency_ms AS "meanStartupLatencyMs",
       sandbox_success_rate AS "sandboxSuccessRate",
       repo_cache_hit_rate AS "repoCacheHitRate",
       registration_verified_at AS "registrationVerifiedAt",
       registration_challenge_id AS "registrationChallengeId",
       capabilities_json AS "capabilitiesJson",
       running_executions_json AS "runningExecutionsJson",
       max_concurrency AS "maxConcurrency",
       queue_affinity AS "queueAffinity",
       runtime_instance_id AS "runtimeInstanceId",
       restarted_from_runtime_instance_id AS "restartedFromRuntimeInstanceId",
       restart_generation AS "restartGeneration",
       cpu_pct AS "cpuPct",
       memory_mb AS "memoryMb",
       tool_backlog_count AS "toolBacklogCount",
       current_step_id AS "currentStepId",
       last_progress_at AS "lastProgressAt",
       last_heartbeat_at AS "lastHeartbeatAt",
       updated_at AS "updatedAt"
       FROM worker_snapshots`;
    if (status != null) {
      sql += ` WHERE status = $${params.length + 1}`;
      params.push(status);
    }
    sql += status == null && limit == null ? ` ORDER BY worker_id ASC` : ` ORDER BY last_heartbeat_at DESC`;
    if (limit != null) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }
    return asyncQueryAll<WorkerSnapshotRecord>(this.conn, sql, ...params);
  }

  public async listStaleWorkerSnapshots(heartbeatBefore: string): Promise<WorkerSnapshotRecord[]> {
    return asyncQueryAll<WorkerSnapshotRecord>(
      this.conn,
      `SELECT
       worker_id AS "workerId",
       status,
       placement,
       isolation_level AS "isolationLevel",
       repo_version AS "repoVersion",
       remote_session_status AS "remoteSessionStatus",
       last_acknowledged_stream_offset AS "lastAcknowledgedStreamOffset",
       stream_resume_success_rate AS "streamResumeSuccessRate",
       credential_refresh_success_rate AS "credentialRefreshSuccessRate",
       session_consistency_check_status AS "sessionConsistencyCheckStatus",
       session_consistency_checked_at AS "sessionConsistencyCheckedAt",
       workspace_sync_status AS "workspaceSyncStatus",
       workspace_sync_checked_at AS "workspaceSyncCheckedAt",
       saturation,
       active_lease_count AS "activeLeaseCount",
       mean_startup_latency_ms AS "meanStartupLatencyMs",
       sandbox_success_rate AS "sandboxSuccessRate",
       repo_cache_hit_rate AS "repoCacheHitRate",
       registration_verified_at AS "registrationVerifiedAt",
       registration_challenge_id AS "registrationChallengeId",
       capabilities_json AS "capabilitiesJson",
       running_executions_json AS "runningExecutionsJson",
       max_concurrency AS "maxConcurrency",
       queue_affinity AS "queueAffinity",
       runtime_instance_id AS "runtimeInstanceId",
       restarted_from_runtime_instance_id AS "restartedFromRuntimeInstanceId",
       restart_generation AS "restartGeneration",
       cpu_pct AS "cpuPct",
       memory_mb AS "memoryMb",
       tool_backlog_count AS "toolBacklogCount",
       current_step_id AS "currentStepId",
       last_progress_at AS "lastProgressAt",
       last_heartbeat_at AS "lastHeartbeatAt",
       updated_at AS "updatedAt"
       FROM worker_snapshots
       WHERE last_heartbeat_at < $1
       ORDER BY last_heartbeat_at ASC`,
      heartbeatBefore,
    );
  }

  public async listRemoteLogsByTask(taskId: string, tenantId?: string | null): Promise<RemoteLogRecord[]> {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return asyncQueryAll<RemoteLogRecord>(
        this.conn,
        `SELECT
          r.id,
          r.task_id AS "taskId",
          r.execution_id AS "executionId",
          r.worker_id AS "workerId",
          r.runtime_instance_id AS "runtimeInstanceId",
          r.level,
          r.message,
          r.context_json AS "contextJson",
          r.created_at AS "createdAt"
         FROM remote_log_entries r
         INNER JOIN tasks t ON t.id = r.task_id
         WHERE r.task_id = $1
           AND t.tenant_id = $2
         ORDER BY r.created_at ASC, r.id ASC`,
        taskId,
        scopedTenantId,
      );
    }
    return asyncQueryAll<RemoteLogRecord>(
      this.conn,
      `SELECT
        id,
        task_id AS "taskId",
        execution_id AS "executionId",
        worker_id AS "workerId",
        runtime_instance_id AS "runtimeInstanceId",
        level,
        message,
        context_json AS "contextJson",
        created_at AS "createdAt"
       FROM remote_log_entries
       WHERE task_id = $1
       ORDER BY created_at ASC, id ASC`,
      taskId,
    );
  }

  public async listRemoteLogsByExecution(executionId: string, tenantId?: string | null): Promise<RemoteLogRecord[]> {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return asyncQueryAll<RemoteLogRecord>(
        this.conn,
        `SELECT
          r.id,
          r.task_id AS "taskId",
          r.execution_id AS "executionId",
          r.worker_id AS "workerId",
          r.runtime_instance_id AS "runtimeInstanceId",
          r.level,
          r.message,
          r.context_json AS "contextJson",
          r.created_at AS "createdAt"
         FROM remote_log_entries r
         INNER JOIN tasks t ON t.id = r.task_id
         WHERE r.execution_id = $1
           AND t.tenant_id = $2
         ORDER BY r.created_at ASC, r.id ASC`,
        executionId,
        scopedTenantId,
      );
    }
    return asyncQueryAll<RemoteLogRecord>(
      this.conn,
      `SELECT
        id,
        task_id AS "taskId",
        execution_id AS "executionId",
        worker_id AS "workerId",
        runtime_instance_id AS "runtimeInstanceId",
        level,
        message,
        context_json AS "contextJson",
        created_at AS "createdAt"
       FROM remote_log_entries
       WHERE execution_id = $1
       ORDER BY created_at ASC, id ASC`,
      executionId,
    );
  }

  public async listHeartbeatSnapshotsByExecution(executionId: string): Promise<HeartbeatSnapshotRecord[]> {
    return asyncQueryAll<HeartbeatSnapshotRecord>(
      this.conn,
      `SELECT
        id,
        execution_id AS "executionId",
        agent_id AS "agentId",
        runtime_instance_id AS "runtimeInstanceId",
        restart_generation AS "restartGeneration",
        status,
        progress_message AS "progressMessage",
        cpu_pct AS "cpuPct",
        memory_mb AS "memoryMb",
        sampled_at AS "sampledAt"
       FROM heartbeat_snapshots
       WHERE execution_id = $1
       ORDER BY sampled_at ASC, id ASC`,
      executionId,
    );
  }

  public async insertExecutionTicket(ticket: ExecutionTicketRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO execution_tickets (
        id, execution_id, task_id, priority, queue_name, dispatch_target,
        required_isolation_level, required_repo_version, required_capabilities_json,
        dispatch_after, attempt, status, assigned_worker_id, lease_id, claimed_at,
        consumed_at, invalidated_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      ticket.id,
      ticket.executionId,
      ticket.taskId,
      ticket.priority,
      ticket.queueName,
      ticket.dispatchTarget ?? "any",
      ticket.requiredIsolationLevel ?? "standard",
      ticket.requiredRepoVersion ?? null,
      ticket.requiredCapabilitiesJson,
      ticket.dispatchAfter,
      ticket.attempt,
      ticket.status,
      ticket.assignedWorkerId,
      ticket.leaseId,
      ticket.claimedAt,
      ticket.consumedAt,
      ticket.invalidatedAt,
      ticket.createdAt,
      ticket.updatedAt,
    );
  }

  public async claimExecutionTicket(input: {
    ticketId: string;
    assignedWorkerId: string;
    leaseId: string;
    claimedAt: string;
  }): Promise<void> {
    await asyncExecute(
      this.conn,
      `UPDATE execution_tickets
       SET status = 'claimed',
           assigned_worker_id = $1,
           lease_id = COALESCE($2, lease_id),
           claimed_at = $3,
           updated_at = $4
       WHERE id = $5
         AND status = 'pending'`,
      input.assignedWorkerId,
      input.leaseId,
      input.claimedAt,
      input.claimedAt,
      input.ticketId,
    );
  }

  public async consumeExecutionTicket(ticketId: string, consumedAt: string): Promise<void> {
    await asyncExecute(
      this.conn,
      `UPDATE execution_tickets
       SET status = 'consumed',
           consumed_at = $1,
           updated_at = $2
       WHERE id = $3`,
      consumedAt,
      consumedAt,
      ticketId,
    );
  }

  public async invalidateExecutionTicket(input: {
    ticketId: string;
    status: Extract<ExecutionTicketRecord["status"], "cancelled" | "expired">;
    invalidatedAt: string;
  }): Promise<void> {
    await asyncExecute(
      this.conn,
      `UPDATE execution_tickets
       SET status = $1,
           invalidated_at = $2,
           updated_at = $3
       WHERE id = $4`,
      input.status,
      input.invalidatedAt,
      input.invalidatedAt,
      input.ticketId,
    );
  }

  public async listPendingExecutionTickets(queueName?: string, limit?: number): Promise<ExecutionTicketRecord[]> {
    const params: unknown[] = [];
    let sql = `SELECT
       id,
       execution_id AS "executionId",
       task_id AS "taskId",
       priority,
       queue_name AS "queueName",
       dispatch_target AS "dispatchTarget",
       required_isolation_level AS "requiredIsolationLevel",
       required_repo_version AS "requiredRepoVersion",
       required_capabilities_json AS "requiredCapabilitiesJson",
       dispatch_after AS "dispatchAfter",
       attempt,
       status,
       assigned_worker_id AS "assignedWorkerId",
       lease_id AS "leaseId",
       claimed_at AS "claimedAt",
       consumed_at AS "consumedAt",
       invalidated_at AS "invalidatedAt",
       created_at AS "createdAt",
       updated_at AS "updatedAt"
       FROM execution_tickets
       WHERE status = 'pending'
         AND dispatch_after <= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', 'utc')`;
    if (queueName != null) {
      sql += ` AND queue_name = $${params.length + 1}`;
      params.push(queueName);
    }
    sql += ` ORDER BY priority DESC, created_at ASC`;
    if (limit != null) {
      sql += ` LIMIT $${params.length + 1}`;
      params.push(limit);
    }
    return asyncQueryAll<ExecutionTicketRecord>(this.conn, sql, ...params);
  }

  public async getExecutionTicket(ticketId: string): Promise<ExecutionTicketRecord | null> {
    const result = await asyncQueryOne<ExecutionTicketRecord>(
      this.conn,
      `SELECT
        id,
        execution_id AS "executionId",
        task_id AS "taskId",
        priority,
        queue_name AS "queueName",
        dispatch_target AS "dispatchTarget",
        required_isolation_level AS "requiredIsolationLevel",
        required_repo_version AS "requiredRepoVersion",
        required_capabilities_json AS "requiredCapabilitiesJson",
        dispatch_after AS "dispatchAfter",
        attempt,
        status,
        assigned_worker_id AS "assignedWorkerId",
        lease_id AS "leaseId",
        claimed_at AS "claimedAt",
        consumed_at AS "consumedAt",
        invalidated_at AS "invalidatedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM execution_tickets
       WHERE id = $1`,
      ticketId,
    );
    return result ?? null;
  }

  public async getActiveExecutionTicket(executionId: string, attempt: number): Promise<ExecutionTicketRecord | null> {
    const result = await asyncQueryOne<ExecutionTicketRecord>(
      this.conn,
      `SELECT
        id,
        execution_id AS "executionId",
        task_id AS "taskId",
        priority,
        queue_name AS "queueName",
        dispatch_target AS "dispatchTarget",
        required_isolation_level AS "requiredIsolationLevel",
        required_repo_version AS "requiredRepoVersion",
        required_capabilities_json AS "requiredCapabilitiesJson",
        dispatch_after AS "dispatchAfter",
        attempt,
        status,
        assigned_worker_id AS "assignedWorkerId",
        lease_id AS "leaseId",
        claimed_at AS "claimedAt",
        consumed_at AS "consumedAt",
        invalidated_at AS "invalidatedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM execution_tickets
       WHERE execution_id = $1
         AND attempt = $2
         AND status IN ('pending', 'claimed')
       ORDER BY created_at ASC
       LIMIT 1`,
      executionId,
      attempt,
    );
    return result ?? null;
  }

  public async listExecutionTicketsByExecution(executionId: string): Promise<ExecutionTicketRecord[]> {
    return asyncQueryAll<ExecutionTicketRecord>(
      this.conn,
      `SELECT
        id,
        execution_id AS "executionId",
        task_id AS "taskId",
        priority,
        queue_name AS "queueName",
        dispatch_target AS "dispatchTarget",
        required_isolation_level AS "requiredIsolationLevel",
        required_repo_version AS "requiredRepoVersion",
        required_capabilities_json AS "requiredCapabilitiesJson",
        dispatch_after AS "dispatchAfter",
        attempt,
        status,
        assigned_worker_id AS "assignedWorkerId",
        lease_id AS "leaseId",
        claimed_at AS "claimedAt",
        consumed_at AS "consumedAt",
        invalidated_at AS "invalidatedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM execution_tickets
       WHERE execution_id = $1
       ORDER BY created_at ASC, id ASC`,
      executionId,
    );
  }

  public async insertExecutionLease(lease: ExecutionLeaseRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO execution_leases (
        id, execution_id, worker_id, attempt, fencing_token, queue_name, status,
        leased_at, expires_at, last_heartbeat_at, released_at, reason_code
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      lease.id,
      lease.executionId,
      lease.workerId,
      lease.attempt,
      lease.fencingToken,
      lease.queueName,
      lease.status,
      lease.leasedAt,
      lease.expiresAt,
      lease.lastHeartbeatAt,
      lease.releasedAt,
      lease.reasonCode,
    );
  }

  public async renewExecutionLease(leaseId: string, expiresAt: string, lastHeartbeatAt?: string): Promise<void> {
    await asyncExecute(
      this.conn,
      `UPDATE execution_leases
       SET expires_at = $1,
           last_heartbeat_at = COALESCE($2, last_heartbeat_at)
       WHERE id = $3`,
      expiresAt,
      lastHeartbeatAt ?? null,
      leaseId,
    );
  }

  public async closeExecutionLease(input: {
    leaseId: string;
    status: ExecutionLeaseRecord["status"];
    releasedAt: string;
    reasonCode: string | null;
  }): Promise<void> {
    await asyncExecute(
      this.conn,
      `UPDATE execution_leases
       SET status = $1,
           released_at = $2,
           reason_code = $3
       WHERE id = $4`,
      input.status,
      input.releasedAt,
      input.reasonCode,
      input.leaseId,
    );
  }

  public async insertLeaseAudit(audit: LeaseAuditRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO lease_audits (
        id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      audit.id,
      audit.executionId,
      audit.leaseId,
      audit.workerId,
      audit.fencingToken,
      audit.eventType,
      audit.reasonCode,
      audit.recordedAt,
    );
  }

  public async getExecutionLease(leaseId: string): Promise<ExecutionLeaseRecord | null> {
    const result = await asyncQueryOne<ExecutionLeaseRecord>(
      this.conn,
      `SELECT
        id,
        execution_id AS "executionId",
        worker_id AS "workerId",
        attempt,
        fencing_token AS "fencingToken",
        queue_name AS "queueName",
        status,
        leased_at AS "leasedAt",
        expires_at AS "expiresAt",
        last_heartbeat_at AS "lastHeartbeatAt",
        released_at AS "releasedAt",
        reason_code AS "reasonCode"
       FROM execution_leases
       WHERE id = $1`,
      leaseId,
    );
    return result ?? null;
  }

  public async getActiveExecutionLease(executionId: string): Promise<ExecutionLeaseRecord | null> {
    const result = await asyncQueryOne<ExecutionLeaseRecord>(
      this.conn,
      `SELECT
        id,
        execution_id AS "executionId",
        worker_id AS "workerId",
        attempt,
        fencing_token AS "fencingToken",
        queue_name AS "queueName",
        status,
        leased_at AS "leasedAt",
        expires_at AS "expiresAt",
        last_heartbeat_at AS "lastHeartbeatAt",
        released_at AS "releasedAt",
        reason_code AS "reasonCode"
       FROM execution_leases
       WHERE execution_id = $1
         AND status = 'active'`,
      executionId,
    );
    return result ?? null;
  }

  public async getLatestExecutionLease(executionId: string): Promise<ExecutionLeaseRecord | null> {
    const result = await asyncQueryOne<ExecutionLeaseRecord>(
      this.conn,
      `SELECT
        id,
        execution_id AS "executionId",
        worker_id AS "workerId",
        attempt,
        fencing_token AS "fencingToken",
        queue_name AS "queueName",
        status,
        leased_at AS "leasedAt",
        expires_at AS "expiresAt",
        last_heartbeat_at AS "lastHeartbeatAt",
        released_at AS "releasedAt",
        reason_code AS "reasonCode"
       FROM execution_leases
       WHERE execution_id = $1
       ORDER BY fencing_token DESC
       LIMIT 1`,
      executionId,
    );
    return result ?? null;
  }

  public async listExecutionLeases(executionId: string): Promise<ExecutionLeaseRecord[]> {
    return asyncQueryAll<ExecutionLeaseRecord>(
      this.conn,
      `SELECT
        id,
        execution_id AS "executionId",
        worker_id AS "workerId",
        attempt,
        fencing_token AS "fencingToken",
        queue_name AS "queueName",
        status,
        leased_at AS "leasedAt",
        expires_at AS "expiresAt",
        last_heartbeat_at AS "lastHeartbeatAt",
        released_at AS "releasedAt",
        reason_code AS "reasonCode"
       FROM execution_leases
       WHERE execution_id = $1
       ORDER BY fencing_token ASC`,
      executionId,
    );
  }

  public async listExpiredExecutionLeases(now: string): Promise<ExecutionLeaseRecord[]> {
    return asyncQueryAll<ExecutionLeaseRecord>(
      this.conn,
      `SELECT
        id,
        execution_id AS "executionId",
        worker_id AS "workerId",
        attempt,
        fencing_token AS "fencingToken",
        queue_name AS "queueName",
        status,
        leased_at AS "leasedAt",
        expires_at AS "expiresAt",
        last_heartbeat_at AS "lastHeartbeatAt",
        released_at AS "releasedAt",
        reason_code AS "reasonCode"
       FROM execution_leases
       WHERE status = 'active'
         AND expires_at < $1
       ORDER BY expires_at ASC`,
      now,
    );
  }

  public async getLatestFencingToken(executionId: string): Promise<number> {
    const result = await asyncQueryOne<{ maxFencingToken?: number }>(
      this.conn,
      `SELECT MAX(fencing_token) AS "maxFencingToken"
       FROM execution_leases
       WHERE execution_id = $1`,
      executionId,
    );
    return Number(result?.maxFencingToken ?? 0);
  }
}
