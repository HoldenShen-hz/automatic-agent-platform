/**
 * WorkerRepository - Data access for workers, tickets, leases, heartbeats, and runtime snapshots.
 */
import { execute, queryAll, queryOne } from "../query-helper.js";
import { resolveTenantScope } from "../authoritative-task-store-types.js";
const WORKER_SNAPSHOT_COLS = `worker_id AS workerId,
        status,
        placement,
        isolation_level AS isolationLevel,
        repo_version AS repoVersion,
        remote_session_status AS remoteSessionStatus,
        last_acknowledged_stream_offset AS lastAcknowledgedStreamOffset,
        stream_resume_success_rate AS streamResumeSuccessRate,
        credential_refresh_success_rate AS credentialRefreshSuccessRate,
        session_consistency_check_status AS sessionConsistencyCheckStatus,
        session_consistency_checked_at AS sessionConsistencyCheckedAt,
        workspace_sync_status AS workspaceSyncStatus,
        workspace_sync_checked_at AS workspaceSyncCheckedAt,
        saturation,
        active_lease_count AS activeLeaseCount,
        mean_startup_latency_ms AS meanStartupLatencyMs,
        sandbox_success_rate AS sandboxSuccessRate,
        repo_cache_hit_rate AS repoCacheHitRate,
        registration_verified_at AS registrationVerifiedAt,
        registration_challenge_id AS registrationChallengeId,
        capabilities_json AS capabilitiesJson,
        running_executions_json AS runningExecutionsJson,
        max_concurrency AS maxConcurrency,
        queue_affinity AS queueAffinity,
        runtime_instance_id AS runtimeInstanceId,
        restarted_from_runtime_instance_id AS restartedFromRuntimeInstanceId,
        restart_generation AS restartGeneration,
        cpu_pct AS cpuPct,
        memory_mb AS memoryMb,
        tool_backlog_count AS toolBacklogCount,
        current_step_id AS currentStepId,
        last_progress_at AS lastProgressAt,
        last_heartbeat_at AS lastHeartbeatAt,
        updated_at AS updatedAt`;
const AGENT_EXECUTION_COLS = `execution_id AS executionId,
        task_id AS taskId,
        agent_id AS agentId,
        workflow_id AS workflowId,
        role_id AS roleId,
        run_kind AS runKind,
        runtime_instance_id AS runtimeInstanceId,
        restarted_from_runtime_instance_id AS restartedFromRuntimeInstanceId,
        restart_generation AS restartGeneration,
        status,
        plan_json AS planJson,
        current_step_id AS currentStepId,
        last_tool_name AS lastToolName,
        tool_call_count AS toolCallCount,
        last_decision_json AS lastDecisionJson,
        last_error_code AS lastErrorCode,
        retry_count AS retryCount,
        progress_message AS progressMessage,
        started_at AS startedAt,
        created_at AS createdAt,
        updated_at AS updatedAt,
        completed_at AS completedAt`;
const AGENT_EXECUTION_COLS_PREFIXED = `a.execution_id AS executionId,
        a.task_id AS taskId,
        a.agent_id AS agentId,
        a.workflow_id AS workflowId,
        a.role_id AS roleId,
        a.run_kind AS runKind,
        a.runtime_instance_id AS runtimeInstanceId,
        a.restarted_from_runtime_instance_id AS restartedFromRuntimeInstanceId,
        a.restart_generation AS restartGeneration,
        a.status,
        a.plan_json AS planJson,
        a.current_step_id AS currentStepId,
        a.last_tool_name AS lastToolName,
        a.tool_call_count AS toolCallCount,
        a.last_decision_json AS lastDecisionJson,
        a.last_error_code AS lastErrorCode,
        a.retry_count AS retryCount,
        a.progress_message AS progressMessage,
        a.started_at AS startedAt,
        a.created_at AS createdAt,
        a.updated_at AS updatedAt,
        a.completed_at AS completedAt`;
const REMOTE_LOG_COLS = `id,
        task_id AS taskId,
        execution_id AS executionId,
        worker_id AS workerId,
        runtime_instance_id AS runtimeInstanceId,
        level,
        message,
        context_json AS contextJson,
        created_at AS createdAt`;
const REMOTE_LOG_COLS_PREFIXED = `r.id,
        r.task_id AS taskId,
        r.execution_id AS executionId,
        r.worker_id AS workerId,
        r.runtime_instance_id AS runtimeInstanceId,
        r.level,
        r.message,
        r.context_json AS contextJson,
        r.created_at AS createdAt`;
const COORDINATOR_COLS = `coordinator_id AS coordinatorId,
        region,
        role,
        queue_affinity AS queueAffinity,
        status,
        max_concurrent_dispatches AS maxConcurrentDispatches,
        active_dispatch_count AS activeDispatchCount,
        backlog_count AS backlogCount,
        cpu_pct AS cpuPct,
        shard_json AS shardJson,
        last_heartbeat_at AS lastHeartbeatAt,
        metadata_json AS metadataJson,
        created_at AS createdAt,
        updated_at AS updatedAt`;
const HEARTBEAT_COLS = `id,
        execution_id AS executionId,
        agent_id AS agentId,
        runtime_instance_id AS runtimeInstanceId,
        restart_generation AS restartGeneration,
        status,
        progress_message AS progressMessage,
        cpu_pct AS cpuPct,
        memory_mb AS memoryMb,
        sampled_at AS sampledAt`;
const HEARTBEAT_COLS_PREFIXED = `h.id,
        h.execution_id AS executionId,
        h.agent_id AS agentId,
        h.runtime_instance_id AS runtimeInstanceId,
        h.restart_generation AS restartGeneration,
        h.status,
        h.progress_message AS progressMessage,
        h.cpu_pct AS cpuPct,
        h.memory_mb AS memoryMb,
        h.sampled_at AS sampledAt`;
const EXECUTION_TICKET_COLS = `id,
        execution_id AS executionId,
        task_id AS taskId,
        priority,
        queue_name AS queueName,
        dispatch_target AS dispatchTarget,
        required_isolation_level AS requiredIsolationLevel,
        required_repo_version AS requiredRepoVersion,
        required_capabilities_json AS requiredCapabilitiesJson,
        dispatch_after AS dispatchAfter,
        attempt,
        status,
        assigned_worker_id AS assignedWorkerId,
        lease_id AS leaseId,
        claimed_at AS claimedAt,
        consumed_at AS consumedAt,
        invalidated_at AS invalidatedAt,
        created_at AS createdAt,
        updated_at AS updatedAt`;
const EXECUTION_LEASE_COLS = `id,
        execution_id AS executionId,
        worker_id AS workerId,
        attempt,
        fencing_token AS fencingToken,
        queue_name AS queueName,
        status,
        leased_at AS leasedAt,
        expires_at AS expiresAt,
        last_heartbeat_at AS lastHeartbeatAt,
        released_at AS releasedAt,
        reason_code AS reasonCode`;
export class WorkerRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    insertHeartbeatSnapshot(snapshot) {
        this.conn
            .prepare(`INSERT INTO heartbeat_snapshots (
          id, execution_id, agent_id, runtime_instance_id, restart_generation,
          status, progress_message, cpu_pct, memory_mb, sampled_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(snapshot.id, snapshot.executionId, snapshot.agentId, snapshot.runtimeInstanceId, snapshot.restartGeneration, snapshot.status, snapshot.progressMessage, snapshot.cpuPct, snapshot.memoryMb, snapshot.sampledAt);
    }
    insertRemoteLog(record) {
        this.conn
            .prepare(`INSERT INTO remote_log_entries (
          id, task_id, execution_id, worker_id, runtime_instance_id, level, message, context_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(record.id, record.taskId, record.executionId, record.workerId, record.runtimeInstanceId, record.level, record.message, record.contextJson, record.createdAt);
    }
    upsertAgentExecutionRecord(record) {
        this.conn
            .prepare(`INSERT INTO agent_execution_records (
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
          completed_at = excluded.completed_at`)
            .run(record.executionId, record.taskId, record.agentId, record.workflowId, record.roleId, record.runKind, record.runtimeInstanceId, record.restartedFromRuntimeInstanceId, record.restartGeneration, record.status, record.planJson, record.currentStepId, record.lastToolName, record.toolCallCount, record.lastDecisionJson, record.lastErrorCode, record.retryCount, record.progressMessage, record.startedAt, record.createdAt, record.updatedAt, record.completedAt);
    }
    upsertWorkerSnapshot(snapshot) {
        this.conn
            .prepare(`INSERT INTO worker_snapshots (
          worker_id, status, placement, isolation_level, repo_version, remote_session_status,
          last_acknowledged_stream_offset, stream_resume_success_rate, credential_refresh_success_rate,
          session_consistency_check_status, session_consistency_checked_at, workspace_sync_status,
          workspace_sync_checked_at, saturation, active_lease_count, mean_startup_latency_ms,
          sandbox_success_rate, repo_cache_hit_rate, registration_verified_at, registration_challenge_id,
          capabilities_json, running_executions_json, max_concurrency, queue_affinity, runtime_instance_id,
          restarted_from_runtime_instance_id, restart_generation, cpu_pct, memory_mb, tool_backlog_count,
          current_step_id, last_progress_at, last_heartbeat_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          updated_at = excluded.updated_at`)
            .run(snapshot.workerId, snapshot.status, snapshot.placement ?? "local", snapshot.isolationLevel ?? "standard", snapshot.repoVersion ?? null, snapshot.remoteSessionStatus ?? null, snapshot.lastAcknowledgedStreamOffset ?? null, snapshot.streamResumeSuccessRate ?? null, snapshot.credentialRefreshSuccessRate ?? null, snapshot.sessionConsistencyCheckStatus ?? null, snapshot.sessionConsistencyCheckedAt ?? null, snapshot.workspaceSyncStatus ?? null, snapshot.workspaceSyncCheckedAt ?? null, snapshot.saturation ?? null, snapshot.activeLeaseCount ?? 0, snapshot.meanStartupLatencyMs ?? null, snapshot.sandboxSuccessRate ?? null, snapshot.repoCacheHitRate ?? null, snapshot.registrationVerifiedAt ?? null, snapshot.registrationChallengeId ?? null, snapshot.capabilitiesJson, snapshot.runningExecutionsJson, snapshot.maxConcurrency, snapshot.queueAffinity, snapshot.runtimeInstanceId, snapshot.restartedFromRuntimeInstanceId, snapshot.restartGeneration, snapshot.cpuPct, snapshot.memoryMb, snapshot.toolBacklogCount, snapshot.currentStepId, snapshot.lastProgressAt, snapshot.lastHeartbeatAt, snapshot.updatedAt);
    }
    upsertCoordinatorInstanceSnapshot(snapshot) {
        this.conn
            .prepare(`INSERT INTO coordinator_instance_snapshots (
          coordinator_id, region, role, queue_affinity, status, max_concurrent_dispatches,
          active_dispatch_count, backlog_count, cpu_pct, shard_json, last_heartbeat_at,
          metadata_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          updated_at = excluded.updated_at`)
            .run(snapshot.coordinatorId, snapshot.region, snapshot.role, snapshot.queueAffinity, snapshot.status, snapshot.maxConcurrentDispatches, snapshot.activeDispatchCount, snapshot.backlogCount, snapshot.cpuPct, snapshot.shardJson, snapshot.lastHeartbeatAt, snapshot.metadataJson, snapshot.createdAt, snapshot.updatedAt);
    }
    getWorkerSnapshot(workerId) {
        return queryOne(this.conn, `SELECT ${WORKER_SNAPSHOT_COLS}
       FROM worker_snapshots
       WHERE worker_id = ?`, workerId);
    }
    getAgentExecutionRecord(executionId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return queryOne(this.conn, `SELECT ${AGENT_EXECUTION_COLS_PREFIXED}
         FROM agent_execution_records a
         INNER JOIN tasks t ON t.id = a.task_id
         WHERE a.execution_id = ?
           AND t.tenant_id = ?`, executionId, scopedTenantId);
        }
        return queryOne(this.conn, `SELECT ${AGENT_EXECUTION_COLS}
       FROM agent_execution_records
       WHERE execution_id = ?`, executionId);
    }
    listAgentExecutionRecordsByTask(taskId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return queryAll(this.conn, `SELECT ${AGENT_EXECUTION_COLS_PREFIXED}
         FROM agent_execution_records a
         INNER JOIN tasks t ON t.id = a.task_id
         WHERE a.task_id = ?
           AND t.tenant_id = ?
         ORDER BY a.updated_at ASC, a.execution_id ASC`, taskId, scopedTenantId);
        }
        return queryAll(this.conn, `SELECT ${AGENT_EXECUTION_COLS}
       FROM agent_execution_records
       WHERE task_id = ?
       ORDER BY updated_at ASC, execution_id ASC`, taskId);
    }
    listWorkerSnapshots(status, limit) {
        const params = [];
        let sql = `SELECT ${WORKER_SNAPSHOT_COLS}
       FROM worker_snapshots`;
        if (status != null) {
            sql += ` WHERE status = ?`;
            params.push(status);
        }
        sql += status == null && limit == null ? ` ORDER BY worker_id ASC` : ` ORDER BY last_heartbeat_at DESC`;
        if (limit != null) {
            sql += ` LIMIT ?`;
            params.push(limit);
        }
        return queryAll(this.conn, sql, ...params);
    }
    listStaleWorkerSnapshots(heartbeatBefore) {
        return queryAll(this.conn, `SELECT ${WORKER_SNAPSHOT_COLS}
       FROM worker_snapshots
       WHERE last_heartbeat_at < ?
       ORDER BY last_heartbeat_at ASC`, heartbeatBefore);
    }
    listRemoteLogsByTask(taskId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return queryAll(this.conn, `SELECT ${REMOTE_LOG_COLS_PREFIXED}
         FROM remote_log_entries r
         INNER JOIN tasks t ON t.id = r.task_id
         WHERE r.task_id = ?
           AND t.tenant_id = ?
         ORDER BY r.created_at ASC, r.id ASC`, taskId, scopedTenantId);
        }
        return queryAll(this.conn, `SELECT ${REMOTE_LOG_COLS}
       FROM remote_log_entries
       WHERE task_id = ?
       ORDER BY created_at ASC, id ASC`, taskId);
    }
    listRemoteLogsByExecution(executionId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return queryAll(this.conn, `SELECT ${REMOTE_LOG_COLS_PREFIXED}
         FROM remote_log_entries r
         INNER JOIN tasks t ON t.id = r.task_id
         WHERE r.execution_id = ?
           AND t.tenant_id = ?
         ORDER BY r.created_at ASC, r.id ASC`, executionId, scopedTenantId);
        }
        return queryAll(this.conn, `SELECT ${REMOTE_LOG_COLS}
       FROM remote_log_entries
       WHERE execution_id = ?
       ORDER BY created_at ASC, id ASC`, executionId);
    }
    getCoordinatorInstanceSnapshot(coordinatorId) {
        return queryOne(this.conn, `SELECT ${COORDINATOR_COLS}
       FROM coordinator_instance_snapshots
       WHERE coordinator_id = ?`, coordinatorId);
    }
    listCoordinatorInstanceSnapshots(limit = 100) {
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 100;
        return queryAll(this.conn, `SELECT ${COORDINATOR_COLS}
       FROM coordinator_instance_snapshots
       ORDER BY updated_at DESC, coordinator_id ASC
       LIMIT ?`, safeLimit);
    }
    listHeartbeatSnapshotsByExecution(executionId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return queryAll(this.conn, `SELECT ${HEARTBEAT_COLS_PREFIXED}
         FROM heartbeat_snapshots h
         INNER JOIN executions e ON e.id = h.execution_id
         INNER JOIN tasks t ON t.id = e.task_id
         WHERE h.execution_id = ?
           AND t.tenant_id = ?
         ORDER BY h.sampled_at ASC, h.id ASC`, executionId, scopedTenantId);
        }
        return queryAll(this.conn, `SELECT ${HEARTBEAT_COLS}
       FROM heartbeat_snapshots
       WHERE execution_id = ?
       ORDER BY sampled_at ASC, id ASC`, executionId);
    }
    insertWorkerRegistrationChallenge(record) {
        this.conn
            .prepare(`INSERT INTO worker_registration_challenges (
          id, worker_id, challenge_token_hash, allowed_capabilities_json, expires_at, used_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
            .run(record.id, record.workerId, record.challengeTokenHash, record.allowedCapabilitiesJson, record.expiresAt, record.usedAt, record.createdAt);
    }
    getWorkerRegistrationChallenge(challengeId) {
        return queryOne(this.conn, `SELECT
        id,
        worker_id AS workerId,
        challenge_token_hash AS challengeTokenHash,
        allowed_capabilities_json AS allowedCapabilitiesJson,
        expires_at AS expiresAt,
        used_at AS usedAt,
        created_at AS createdAt
       FROM worker_registration_challenges
       WHERE id = ?`, challengeId);
    }
    consumeWorkerRegistrationChallenge(challengeId, usedAt) {
        execute(this.conn, `UPDATE worker_registration_challenges
       SET used_at = ?
       WHERE id = ?`, usedAt, challengeId);
    }
    insertExecutionTicket(ticket) {
        this.conn
            .prepare(`INSERT INTO execution_tickets (
          id, execution_id, task_id, priority, queue_name, dispatch_target,
          required_isolation_level, required_repo_version, required_capabilities_json,
          dispatch_after, attempt, status, assigned_worker_id, lease_id, claimed_at,
          consumed_at, invalidated_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(ticket.id, ticket.executionId, ticket.taskId, ticket.priority, ticket.queueName, ticket.dispatchTarget ?? "any", ticket.requiredIsolationLevel ?? "standard", ticket.requiredRepoVersion ?? null, ticket.requiredCapabilitiesJson, ticket.dispatchAfter, ticket.attempt, ticket.status, ticket.assignedWorkerId, ticket.leaseId, ticket.claimedAt, ticket.consumedAt, ticket.invalidatedAt, ticket.createdAt, ticket.updatedAt);
    }
    claimExecutionTicket(ticketIdOrInput, assignedWorkerId, claimedAt) {
        const input = typeof ticketIdOrInput === "string"
            ? {
                ticketId: ticketIdOrInput,
                assignedWorkerId: assignedWorkerId ?? "",
                leaseId: null,
                claimedAt: claimedAt ?? new Date().toISOString(),
            }
            : ticketIdOrInput;
        execute(this.conn, `UPDATE execution_tickets
       SET status = 'claimed',
           assigned_worker_id = ?,
           lease_id = COALESCE(?, lease_id),
           claimed_at = ?,
           updated_at = ?
       WHERE id = ?
         AND status = 'pending'`, input.assignedWorkerId, input.leaseId, input.claimedAt, input.claimedAt, input.ticketId);
    }
    consumeExecutionTicket(ticketId, consumedAt) {
        execute(this.conn, `UPDATE execution_tickets
       SET status = 'consumed',
           consumed_at = ?,
           updated_at = ?
       WHERE id = ?`, consumedAt, consumedAt, ticketId);
    }
    invalidateExecutionTicket(ticketIdOrInput, invalidatedAt) {
        const input = typeof ticketIdOrInput === "string"
            ? {
                ticketId: ticketIdOrInput,
                status: "cancelled",
                invalidatedAt: invalidatedAt ?? new Date().toISOString(),
            }
            : ticketIdOrInput;
        execute(this.conn, `UPDATE execution_tickets
       SET status = ?,
           invalidated_at = ?,
           updated_at = ?
       WHERE id = ?`, input.status, input.invalidatedAt, input.invalidatedAt, input.ticketId);
    }
    listPendingExecutionTickets(queueName, limit) {
        const params = [];
        let sql = `SELECT ${EXECUTION_TICKET_COLS}
       FROM execution_tickets
       WHERE status = 'pending'
         AND dispatch_after <= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', 'utc')`;
        if (queueName != null) {
            sql += ` AND queue_name = ?`;
            params.push(queueName);
        }
        sql += ` ORDER BY priority DESC, created_at ASC`;
        if (limit != null) {
            sql += ` LIMIT ?`;
            params.push(limit);
        }
        return queryAll(this.conn, sql, ...params);
    }
    getExecutionTicket(ticketId) {
        return queryOne(this.conn, `SELECT ${EXECUTION_TICKET_COLS}
       FROM execution_tickets
       WHERE id = ?`, ticketId);
    }
    getActiveExecutionTicket(executionId, attempt) {
        return queryOne(this.conn, `SELECT ${EXECUTION_TICKET_COLS}
       FROM execution_tickets
       WHERE execution_id = ?
         AND attempt = ?
         AND status IN ('pending', 'claimed')
       ORDER BY created_at ASC
       LIMIT 1`, executionId, attempt);
    }
    listExecutionTicketsByExecution(executionId) {
        return queryAll(this.conn, `SELECT ${EXECUTION_TICKET_COLS}
       FROM execution_tickets
       WHERE execution_id = ?
       ORDER BY created_at ASC, id ASC`, executionId);
    }
    listExecutionTicketsByStatuses(statuses) {
        if (statuses.length === 0) {
            return [];
        }
        const placeholders = statuses.map(() => "?").join(", ");
        return queryAll(this.conn, `SELECT ${EXECUTION_TICKET_COLS}
       FROM execution_tickets
       WHERE status IN (${placeholders})
       ORDER BY created_at ASC, id ASC`, ...statuses);
    }
    listDispatchableExecutionTickets(now, queueName = null) {
        const params = queueName == null ? [now] : [now, queueName];
        const queuePredicate = queueName == null ? "" : "AND queue_name = ?";
        return queryAll(this.conn, `SELECT ${EXECUTION_TICKET_COLS}
       FROM execution_tickets
       WHERE status = 'pending'
         AND (dispatch_after IS NULL OR dispatch_after <= ?)
         ${queuePredicate}
       ORDER BY
         CASE priority
           WHEN 'urgent' THEN 4
           WHEN 'high' THEN 3
           WHEN 'normal' THEN 2
           ELSE 1
         END DESC,
         COALESCE(dispatch_after, created_at) ASC,
         created_at ASC,
         id ASC`, ...params);
    }
    insertExecutionLease(lease) {
        this.conn
            .prepare(`INSERT INTO execution_leases (
          id, execution_id, worker_id, attempt, fencing_token, queue_name, status,
          leased_at, expires_at, last_heartbeat_at, released_at, reason_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(lease.id, lease.executionId, lease.workerId, lease.attempt, lease.fencingToken, lease.queueName, lease.status, lease.leasedAt, lease.expiresAt, lease.lastHeartbeatAt, lease.releasedAt, lease.reasonCode);
    }
    renewExecutionLease(leaseId, expiresAt, lastHeartbeatAt) {
        execute(this.conn, `UPDATE execution_leases
       SET expires_at = ?,
           last_heartbeat_at = COALESCE(?, last_heartbeat_at)
       WHERE id = ?`, expiresAt, lastHeartbeatAt ?? null, leaseId);
    }
    closeExecutionLease(leaseIdOrInput, releasedAt) {
        const input = typeof leaseIdOrInput === "string"
            ? {
                leaseId: leaseIdOrInput,
                status: "released",
                releasedAt: releasedAt ?? new Date().toISOString(),
                reasonCode: null,
            }
            : leaseIdOrInput;
        execute(this.conn, `UPDATE execution_leases
       SET status = ?,
           released_at = ?,
           reason_code = ?
       WHERE id = ?`, input.status, input.releasedAt, input.reasonCode, input.leaseId);
    }
    insertLeaseAudit(audit) {
        this.conn
            .prepare(`INSERT INTO lease_audits (
          id, execution_id, lease_id, worker_id, fencing_token, event_type, reason_code, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(audit.id, audit.executionId, audit.leaseId, audit.workerId, audit.fencingToken, audit.eventType, audit.reasonCode, audit.recordedAt);
    }
    getExecutionLease(leaseId) {
        return queryOne(this.conn, `SELECT ${EXECUTION_LEASE_COLS}
       FROM execution_leases
       WHERE id = ?`, leaseId);
    }
    getActiveExecutionLease(executionId) {
        return queryOne(this.conn, `SELECT ${EXECUTION_LEASE_COLS}
       FROM execution_leases
       WHERE execution_id = ?
         AND status = 'active'`, executionId);
    }
    getLatestExecutionLease(executionId) {
        return queryOne(this.conn, `SELECT ${EXECUTION_LEASE_COLS}
       FROM execution_leases
       WHERE execution_id = ?
       ORDER BY fencing_token DESC
       LIMIT 1`, executionId);
    }
    listExecutionLeases(executionId) {
        return queryAll(this.conn, `SELECT ${EXECUTION_LEASE_COLS}
       FROM execution_leases
       WHERE execution_id = ?
       ORDER BY fencing_token ASC`, executionId);
    }
    listExecutionLeasesByStatuses(statuses) {
        if (statuses.length === 0) {
            return [];
        }
        const placeholders = statuses.map(() => "?").join(", ");
        return queryAll(this.conn, `SELECT ${EXECUTION_LEASE_COLS}
       FROM execution_leases
       WHERE status IN (${placeholders})
       ORDER BY leased_at ASC, id ASC`, ...statuses);
    }
    listExpiredExecutionLeases(now) {
        return queryAll(this.conn, `SELECT ${EXECUTION_LEASE_COLS}
       FROM execution_leases
       WHERE status = 'active'
         AND expires_at < ?
       ORDER BY expires_at ASC`, now);
    }
    getLatestFencingToken(executionId) {
        const row = queryOne(this.conn, `SELECT MAX(fencing_token) AS maxFencingToken
       FROM execution_leases
       WHERE execution_id = ?`, executionId);
        return Number(row?.maxFencingToken ?? 0);
    }
}
//# sourceMappingURL=worker-repository.js.map