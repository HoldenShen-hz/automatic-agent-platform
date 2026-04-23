/**
 * AsyncDispatchRepository - Async data access for executions, sessions, messages, and gateway targets.
 */
import { asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
import { resolveTenantScope } from "../sqlite/authoritative-task-store-types.js";
export class AsyncDispatchRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    async listExecutionsByStatuses(statuses) {
        if (statuses.length === 0)
            return [];
        const placeholders = statuses.map((_, i) => `$${i + 1}`).join(", ");
        return asyncQueryAll(this.conn, `SELECT
        id,
        task_id AS "taskId",
        workflow_id AS "workflowId",
        parent_execution_id AS "parentExecutionId",
        agent_id AS "agentId",
        role_id AS "roleId",
        run_kind AS "runKind",
        status,
        input_ref AS "inputRef",
        trace_id AS "traceId",
        attempt,
        timeout_ms AS "timeoutMs",
        budget_usd_limit AS "budgetUsdLimit",
        requires_approval AS "requiresApproval",
        sandbox_mode AS "sandboxMode",
        allowed_tools_json AS "allowedToolsJson",
        allowed_paths_json AS "allowedPathsJson",
        max_retries AS "maxRetries",
        retry_backoff AS "retryBackoff",
        last_error_code AS "lastErrorCode",
        last_error_message AS "lastErrorMessage",
        started_at AS "startedAt",
        finished_at AS "finishedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM executions
       WHERE status IN (${placeholders})
       ORDER BY updated_at ASC, created_at ASC, id ASC`, ...statuses);
    }
    async getExecution(executionId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            const result = await asyncQueryOne(this.conn, `SELECT
          e.id,
          e.task_id AS "taskId",
          e.workflow_id AS "workflowId",
          e.parent_execution_id AS "parentExecutionId",
          e.agent_id AS "agentId",
          e.role_id AS "roleId",
          e.run_kind AS "runKind",
          e.status,
          e.input_ref AS "inputRef",
          e.trace_id AS "traceId",
          e.attempt,
          e.timeout_ms AS "timeoutMs",
          e.budget_usd_limit AS "budgetUsdLimit",
          e.requires_approval AS "requiresApproval",
          e.sandbox_mode AS "sandboxMode",
          e.allowed_tools_json AS "allowedToolsJson",
          e.allowed_paths_json AS "allowedPathsJson",
          e.max_retries AS "maxRetries",
          e.retry_backoff AS "retryBackoff",
          e.last_error_code AS "lastErrorCode",
          e.last_error_message AS "lastErrorMessage",
          e.started_at AS "startedAt",
          e.finished_at AS "finishedAt",
          e.created_at AS "createdAt",
          e.updated_at AS "updatedAt"
         FROM executions e
         INNER JOIN tasks t ON t.id = e.task_id
         WHERE e.id = $1 AND t.tenant_id = $2`, executionId, scopedTenantId);
            return result ?? null;
        }
        const result = await asyncQueryOne(this.conn, `SELECT
        id,
        task_id AS "taskId",
        workflow_id AS "workflowId",
        parent_execution_id AS "parentExecutionId",
        agent_id AS "agentId",
        role_id AS "roleId",
        run_kind AS "runKind",
        status,
        input_ref AS "inputRef",
        trace_id AS "traceId",
        attempt,
        timeout_ms AS "timeoutMs",
        budget_usd_limit AS "budgetUsdLimit",
        requires_approval AS "requiresApproval",
        sandbox_mode AS "sandboxMode",
        allowed_tools_json AS "allowedToolsJson",
        allowed_paths_json AS "allowedPathsJson",
        max_retries AS "maxRetries",
        retry_backoff AS "retryBackoff",
        last_error_code AS "lastErrorCode",
        last_error_message AS "lastErrorMessage",
        started_at AS "startedAt",
        finished_at AS "finishedAt",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM executions WHERE id = $1`, executionId);
        return result ?? null;
    }
    async getExecutionPrecheck(executionId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            const result = await asyncQueryOne(this.conn, `SELECT ep.id, ep.execution_id AS "executionId", ep.allowed, ep.reason_code AS "reasonCode",
                ep.resolved_budget_usd AS "resolvedBudgetUsd", ep.resolved_timeout_ms AS "resolvedTimeoutMs",
                ep.resolved_sandbox_mode AS "resolvedSandboxMode", ep.resolved_tools_json AS "resolvedToolsJson",
                ep.resolved_paths_json AS "resolvedPathsJson", ep.checked_at AS "checkedAt"
         FROM execution_prechecks ep
         INNER JOIN executions e ON e.id = ep.execution_id
         INNER JOIN tasks t ON t.id = e.task_id
         WHERE ep.execution_id = $1 AND t.tenant_id = $2`, executionId, scopedTenantId);
            return result ?? null;
        }
        const result = await asyncQueryOne(this.conn, `SELECT id, execution_id AS "executionId", allowed, reason_code AS "reasonCode",
              resolved_budget_usd AS "resolvedBudgetUsd", resolved_timeout_ms AS "resolvedTimeoutMs",
              resolved_sandbox_mode AS "resolvedSandboxMode", resolved_tools_json AS "resolvedToolsJson",
              resolved_paths_json AS "resolvedPathsJson", checked_at AS "checkedAt"
       FROM execution_prechecks WHERE execution_id = $1`, executionId);
        return result ?? null;
    }
    async getDeadLetterByExecutionId(executionId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            const result = await asyncQueryOne(this.conn, `SELECT d.id, d.execution_id AS "executionId", d.task_id AS "taskId",
                d.final_reason_code AS "finalReasonCode", d.retry_count AS "retryCount",
                d.last_error_message AS "lastErrorMessage", d.moved_at AS "movedAt"
         FROM dead_letters d INNER JOIN tasks t ON t.id = d.task_id
         WHERE d.execution_id = $1 AND t.tenant_id = $2`, executionId, scopedTenantId);
            return result ?? null;
        }
        const result = await asyncQueryOne(this.conn, `SELECT id, execution_id AS "executionId", task_id AS "taskId", final_reason_code AS "finalReasonCode",
              retry_count AS "retryCount", last_error_message AS "lastErrorMessage", moved_at AS "movedAt"
       FROM dead_letters WHERE execution_id = $1`, executionId);
        return result ?? null;
    }
    async listDeadLettersByTask(taskId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return asyncQueryAll(this.conn, `SELECT d.id, d.execution_id AS "executionId", d.task_id AS "taskId",
                d.final_reason_code AS "finalReasonCode", d.retry_count AS "retryCount",
                d.last_error_message AS "lastErrorMessage", d.moved_at AS "movedAt"
         FROM dead_letters d INNER JOIN tasks t ON t.id = d.task_id
         WHERE d.task_id = $1 AND t.tenant_id = $2 ORDER BY d.moved_at ASC`, taskId, scopedTenantId);
        }
        return asyncQueryAll(this.conn, `SELECT id, execution_id AS "executionId", task_id AS "taskId", final_reason_code AS "finalReasonCode",
              retry_count AS "retryCount", last_error_message AS "lastErrorMessage", moved_at AS "movedAt"
       FROM dead_letters WHERE task_id = $1 ORDER BY moved_at ASC`, taskId);
    }
    async getSession(sessionId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            const result = await asyncQueryOne(this.conn, `SELECT s.id, s.task_id AS "taskId", s.channel, s.status,
                s.external_session_id AS "externalSessionId", s.created_at AS "createdAt", s.updated_at AS "updatedAt"
         FROM sessions s INNER JOIN tasks t ON t.id = s.task_id
         WHERE s.id = $1 AND t.tenant_id = $2`, sessionId, scopedTenantId);
            return result ?? null;
        }
        const result = await asyncQueryOne(this.conn, `SELECT id, task_id AS "taskId", channel, status, external_session_id AS "externalSessionId",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM sessions WHERE id = $1`, sessionId);
        return result ?? null;
    }
    async selectLatestSessionByTask(taskId) {
        const result = await asyncQueryOne(this.conn, `SELECT id, task_id AS "taskId", channel, status, external_session_id AS "externalSessionId",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM sessions WHERE task_id = $1
       ORDER BY created_at DESC, updated_at DESC, rowid DESC LIMIT 1`, taskId);
        return result ?? null;
    }
    async getGatewayTarget(targetId) {
        const result = await asyncQueryOne(this.conn, `SELECT target_id AS "targetId", channel, target_kind AS "targetKind",
              external_target_id AS "externalTargetId", display_name AS "displayName",
              aliases_json AS "aliasesJson", metadata_json AS "metadataJson", source,
              last_seen_at AS "lastSeenAt", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM gateway_targets WHERE target_id = $1`, targetId);
        return result ?? null;
    }
    async listGatewayTargets(limit = 100, channel) {
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 100;
        const baseCols = `target_id AS "targetId", channel, target_kind AS "targetKind",
        external_target_id AS "externalTargetId", display_name AS "displayName",
        aliases_json AS "aliasesJson", metadata_json AS "metadataJson", source,
        last_seen_at AS "lastSeenAt", created_at AS "createdAt", updated_at AS "updatedAt"`;
        const sql = channel
            ? `SELECT ${baseCols} FROM gateway_targets WHERE channel = $1 ORDER BY updated_at DESC, created_at DESC, target_id ASC LIMIT $2`
            : `SELECT ${baseCols} FROM gateway_targets ORDER BY updated_at DESC, created_at DESC, target_id ASC LIMIT $1`;
        return asyncQueryAll(this.conn, sql, ...(channel ? [channel, safeLimit] : [safeLimit]));
    }
    async listMessagesBySession(sessionId, tenantId) {
        const scopedTenantId = resolveTenantScope(tenantId);
        if (scopedTenantId !== undefined) {
            return asyncQueryAll(this.conn, `SELECT m.id, m.session_id AS "sessionId", m.direction, m.message_type AS "messageType",
                m.content, m.parts_json AS "partsJson", m.attachments_json AS "attachmentsJson", m.created_at AS "createdAt"
         FROM messages m INNER JOIN sessions s ON s.id = m.session_id
         INNER JOIN tasks t ON t.id = s.task_id
         WHERE m.session_id = $1 AND t.tenant_id = $2 ORDER BY m.created_at ASC, m.id ASC`, sessionId, scopedTenantId);
        }
        return asyncQueryAll(this.conn, `SELECT id, session_id AS "sessionId", direction, message_type AS "messageType",
              content, parts_json AS "partsJson", attachments_json AS "attachmentsJson", created_at AS "createdAt"
       FROM messages WHERE session_id = $1 ORDER BY created_at ASC, id ASC`, sessionId);
    }
    async getWorkerSnapshot(workerId) {
        const result = await asyncQueryOne(this.conn, `SELECT
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
       FROM worker_snapshots WHERE worker_id = $1`, workerId);
        return result ?? null;
    }
}
//# sourceMappingURL=dispatch-repository.js.map