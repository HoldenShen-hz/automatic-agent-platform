/**
 * DispatchRepository - Data access for executions, sessions, messages, and gateway targets.
 *
 * This repository handles all data access for:
 * - ExecutionRecord (executions table)
 * - ExecutionPrecheckRecord (execution_prechecks table)
 * - DeadLetterRecord (dead_letters table)
 * - SessionRecord (sessions table)
 * - MessageRecord (messages table)
 * - GatewayTargetRecord (gateway_targets table)
 * - WorkerSnapshotRecord (worker_snapshots table)
 *
 * All SQL queries use proper column aliasing to match the camelCase domain types.
 */

import type {
  ExecutionRecord,
  ExecutionPrecheckRecord,
  DeadLetterRecord,
  SessionRecord,
  MessageRecord,
  GatewayTargetRecord,
  WorkerSnapshotRecord,
} from "../../../../contracts/types/domain.js";
import type { SqliteConnection } from "../query-helper.js";
import { queryAll, queryOne } from "../query-helper.js";
import { resolveTenantScope } from "../authoritative-task-store-types.js";

const EXECUTION_COLS = `e.id,
          e.task_id AS taskId,
          e.workflow_id AS workflowId,
          e.parent_execution_id AS parentExecutionId,
          e.agent_id AS agentId,
          e.role_id AS roleId,
          e.run_kind AS runKind,
          e.status,
          e.input_ref AS inputRef,
          e.trace_id AS traceId,
          e.attempt,
          e.timeout_ms AS timeoutMs,
          e.budget_usd_limit AS budgetUsdLimit,
          e.requires_approval AS requiresApproval,
          e.sandbox_mode AS sandboxMode,
          e.allowed_tools_json AS allowedToolsJson,
          e.allowed_paths_json AS allowedPathsJson,
          e.max_retries AS maxRetries,
          e.retry_backoff AS retryBackoff,
          e.last_error_code AS lastErrorCode,
          e.last_error_message AS lastErrorMessage,
          e.started_at AS startedAt,
          e.finished_at AS finishedAt,
          e.created_at AS createdAt,
          e.updated_at AS updatedAt`;

const EXECUTION_COLS_NO_PREFIX = `id,
        task_id AS taskId,
        workflow_id AS workflowId,
        parent_execution_id AS parentExecutionId,
        agent_id AS agentId,
        role_id AS roleId,
        run_kind AS runKind,
        status,
        input_ref AS inputRef,
        trace_id AS traceId,
        attempt,
        timeout_ms AS timeoutMs,
        budget_usd_limit AS budgetUsdLimit,
        requires_approval AS requiresApproval,
        sandbox_mode AS sandboxMode,
        allowed_tools_json AS allowedToolsJson,
        allowed_paths_json AS allowedPathsJson,
        max_retries AS maxRetries,
        retry_backoff AS retryBackoff,
        last_error_code AS lastErrorCode,
        last_error_message AS lastErrorMessage,
        started_at AS startedAt,
        finished_at AS finishedAt,
        created_at AS createdAt,
        updated_at AS updatedAt`;

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

export class DispatchRepository {
  public constructor(private readonly conn: SqliteConnection) {}

  /** List executions by status filter. */
  public listExecutionsByStatuses(statuses: ExecutionRecord["status"][]): ExecutionRecord[] {
    if (statuses.length === 0) return [];
    const placeholders = statuses.map(() => "?").join(", ");
    return queryAll<ExecutionRecord>(
      this.conn,
      `SELECT ${EXECUTION_COLS_NO_PREFIX}
       FROM executions
       WHERE status IN (${placeholders})
       ORDER BY updated_at ASC, created_at ASC, id ASC`,
      ...statuses,
    );
  }

  /** Get an execution by ID with optional tenant scoping. */
  public getExecution(executionId: string, tenantId?: string | null): ExecutionRecord | null {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryOne<ExecutionRecord>(
        this.conn,
        `SELECT ${EXECUTION_COLS}
         FROM executions e
         INNER JOIN tasks t ON t.id = e.task_id
         WHERE e.id = ? AND t.tenant_id = ?`,
        executionId,
        scopedTenantId,
      ) ?? null;
    }
    return queryOne<ExecutionRecord>(
      this.conn,
      `SELECT ${EXECUTION_COLS_NO_PREFIX}
       FROM executions WHERE id = ?`,
      executionId,
    ) ?? null;
  }

  /** Get an execution precheck by execution ID. */
  public getExecutionPrecheck(executionId: string, tenantId?: string | null): ExecutionPrecheckRecord | null {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return normalizeExecutionPrecheck(queryOne<ExecutionPrecheckRecord>(
        this.conn,
        `SELECT ep.id, ep.execution_id AS executionId, ep.allowed, ep.reason_code AS reasonCode,
                ep.resolved_budget_usd AS resolvedBudgetUsd, ep.resolved_timeout_ms AS resolvedTimeoutMs,
                ep.resolved_sandbox_mode AS resolvedSandboxMode, ep.resolved_tools_json AS resolvedToolsJson,
                ep.resolved_paths_json AS resolvedPathsJson, ep.checked_at AS checkedAt
         FROM execution_prechecks ep
         INNER JOIN executions e ON e.id = ep.execution_id
         INNER JOIN tasks t ON t.id = e.task_id
         WHERE ep.execution_id = ? AND t.tenant_id = ?`,
        executionId,
        scopedTenantId,
      ) ?? null);
    }
    return normalizeExecutionPrecheck(queryOne<ExecutionPrecheckRecord>(
      this.conn,
      `SELECT id, execution_id AS executionId, allowed, reason_code AS reasonCode,
              resolved_budget_usd AS resolvedBudgetUsd, resolved_timeout_ms AS resolvedTimeoutMs,
              resolved_sandbox_mode AS resolvedSandboxMode, resolved_tools_json AS resolvedToolsJson,
              resolved_paths_json AS resolvedPathsJson, checked_at AS checkedAt
       FROM execution_prechecks WHERE execution_id = ?`,
      executionId,
    ) ?? null);
  }

  public upsertExecutionPrecheck(precheck: {
    id?: string;
    executionId: string;
    allowed?: number | boolean;
    reasonCode?: string | null;
    resolvedBudgetUsd?: number | null;
    resolvedTimeoutMs?: number;
    resolvedSandboxMode?: string;
    resolvedToolsJson?: string | null;
    resolvedPathsJson?: string | null;
    allowedToolsJson?: string | null;
    resolvedTools?: string | null;
    checkedAt?: string;
  }): void {
    const id = precheck.id ?? `precheck-${precheck.executionId}`;
    const resolvedToolsJson = precheck.resolvedToolsJson ?? precheck.allowedToolsJson ?? precheck.resolvedTools ?? null;
    this.conn
      .prepare(
        `INSERT INTO execution_prechecks (
          id, execution_id, allowed, reason_code, resolved_budget_usd,
          resolved_timeout_ms, resolved_sandbox_mode, resolved_tools_json,
          resolved_paths_json, checked_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(execution_id) DO UPDATE SET
          allowed = excluded.allowed,
          reason_code = excluded.reason_code,
          resolved_budget_usd = excluded.resolved_budget_usd,
          resolved_timeout_ms = excluded.resolved_timeout_ms,
          resolved_sandbox_mode = excluded.resolved_sandbox_mode,
          resolved_tools_json = excluded.resolved_tools_json,
          resolved_paths_json = excluded.resolved_paths_json,
          checked_at = excluded.checked_at`,
      )
      .run(
        id,
        precheck.executionId,
        precheck.allowed === false || precheck.allowed === 0 ? 0 : 1,
        precheck.reasonCode ?? null,
        precheck.resolvedBudgetUsd ?? null,
        precheck.resolvedTimeoutMs ?? 60000,
        precheck.resolvedSandboxMode ?? "workspace_write",
        resolvedToolsJson,
        precheck.resolvedPathsJson ?? null,
        precheck.checkedAt ?? new Date().toISOString(),
      );
  }

  /** Get a dead letter record by execution ID. */
  public getDeadLetterByExecutionId(executionId: string, tenantId?: string | null): DeadLetterRecord | null {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryOne<DeadLetterRecord>(
        this.conn,
        `SELECT d.id, d.execution_id AS executionId, d.task_id AS taskId,
                d.final_reason_code AS finalReasonCode, d.retry_count AS retryCount,
                d.last_error_message AS lastErrorMessage, d.moved_at AS movedAt
         FROM dead_letters d INNER JOIN tasks t ON t.id = d.task_id
         WHERE d.execution_id = ? AND t.tenant_id = ?`,
        executionId,
        scopedTenantId,
      ) ?? null;
    }
    return queryOne<DeadLetterRecord>(
      this.conn,
      `SELECT id, execution_id AS executionId, task_id AS taskId, final_reason_code AS finalReasonCode,
              retry_count AS retryCount, last_error_message AS lastErrorMessage, moved_at AS movedAt
       FROM dead_letters WHERE execution_id = ?`,
      executionId,
    ) ?? null;
  }

  /** List dead letters for a task. */
  public listDeadLettersByTask(taskId: string, tenantId?: string | null): DeadLetterRecord[] {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryAll<DeadLetterRecord>(
        this.conn,
        `SELECT d.id, d.execution_id AS executionId, d.task_id AS taskId,
                d.final_reason_code AS finalReasonCode, d.retry_count AS retryCount,
                d.last_error_message AS lastErrorMessage, d.moved_at AS movedAt
         FROM dead_letters d INNER JOIN tasks t ON t.id = d.task_id
         WHERE d.task_id = ? AND t.tenant_id = ? ORDER BY d.moved_at ASC`,
        taskId,
        scopedTenantId,
      );
    }
    return queryAll<DeadLetterRecord>(
      this.conn,
      `SELECT id, execution_id AS executionId, task_id AS taskId, final_reason_code AS finalReasonCode,
              retry_count AS retryCount, last_error_message AS lastErrorMessage, moved_at AS movedAt
       FROM dead_letters WHERE task_id = ? ORDER BY moved_at ASC`,
      taskId,
    );
  }

  /** Get a session by ID. */
  public getSession(sessionId: string, tenantId?: string | null): SessionRecord | null {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryOne<SessionRecord>(
        this.conn,
        `SELECT s.id, s.task_id AS taskId, s.channel, s.status,
                s.external_session_id AS externalSessionId, s.created_at AS createdAt, s.updated_at AS updatedAt
         FROM sessions s INNER JOIN tasks t ON t.id = s.task_id
         WHERE s.id = ? AND t.tenant_id = ?`,
        sessionId,
        scopedTenantId,
      ) ?? null;
    }
    return queryOne<SessionRecord>(
      this.conn,
      `SELECT id, task_id AS taskId, channel, status, external_session_id AS externalSessionId,
              created_at AS createdAt, updated_at AS updatedAt
       FROM sessions WHERE id = ?`,
      sessionId,
    ) ?? null;
  }

  /** Get the latest session for a task. */
  public selectLatestSessionByTask(taskId: string): SessionRecord | null {
    return queryOne<SessionRecord>(
      this.conn,
      `SELECT id, task_id AS taskId, channel, status, external_session_id AS externalSessionId,
              created_at AS createdAt, updated_at AS updatedAt
       FROM sessions WHERE task_id = ?
       ORDER BY created_at DESC, updated_at DESC, rowid DESC LIMIT 1`,
      taskId,
    ) ?? null;
  }

  /** Get a gateway target by ID. */
  public getGatewayTarget(targetId: string): GatewayTargetRecord | null {
    return queryOne<GatewayTargetRecord>(
      this.conn,
      `SELECT target_id AS targetId, channel, target_kind AS targetKind,
              external_target_id AS externalTargetId, display_name AS displayName,
              aliases_json AS aliasesJson, metadata_json AS metadataJson, source,
              last_seen_at AS lastSeenAt, created_at AS createdAt, updated_at AS updatedAt
       FROM gateway_targets WHERE target_id = ?`,
      targetId,
    ) ?? null;
  }

  /** List gateway targets with optional channel filter. */
  public listGatewayTargets(limit = 100, channel?: string): GatewayTargetRecord[] {
    const baseCols = `target_id AS targetId, channel, target_kind AS targetKind,
        external_target_id AS externalTargetId, display_name AS displayName,
        aliases_json AS aliasesJson, metadata_json AS metadataJson, source,
        last_seen_at AS lastSeenAt, created_at AS createdAt, updated_at AS updatedAt`;
    const sql = channel
      ? `SELECT ${baseCols} FROM gateway_targets WHERE channel = ? ORDER BY updated_at DESC, created_at DESC, target_id ASC LIMIT ?`
      : `SELECT ${baseCols} FROM gateway_targets ORDER BY updated_at DESC, created_at DESC, target_id ASC LIMIT ?`;
    return queryAll<GatewayTargetRecord>(this.conn, sql, ...(channel ? [channel, limit] : [limit]));
  }

  /** List messages for a session. */
  public listMessagesBySession(sessionId: string, tenantId?: string | null): MessageRecord[] {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryAll<MessageRecord>(
        this.conn,
        `SELECT m.id, m.session_id AS sessionId, m.direction, m.message_type AS messageType,
                m.content, m.parts_json AS partsJson, m.attachments_json AS attachmentsJson, m.created_at AS createdAt
         FROM messages m INNER JOIN sessions s ON s.id = m.session_id
         INNER JOIN tasks t ON t.id = s.task_id
         WHERE m.session_id = ? AND t.tenant_id = ? ORDER BY m.created_at ASC, m.id ASC`,
        sessionId,
        scopedTenantId,
      );
    }
    return queryAll<MessageRecord>(
      this.conn,
      `SELECT id, session_id AS sessionId, direction, message_type AS messageType,
              content, parts_json AS partsJson, attachments_json AS attachmentsJson, created_at AS createdAt
       FROM messages WHERE session_id = ? ORDER BY created_at ASC, id ASC`,
      sessionId,
    );
  }

  /** Get a worker snapshot by worker ID. */
  public getWorkerSnapshot(workerId: string): WorkerSnapshotRecord | null {
    return queryOne<WorkerSnapshotRecord>(
      this.conn,
      `SELECT ${WORKER_SNAPSHOT_COLS} FROM worker_snapshots WHERE worker_id = ?`,
      workerId,
    ) ?? null;
  }
}

function normalizeExecutionPrecheck(precheck: ExecutionPrecheckRecord | null): ExecutionPrecheckRecord | null {
  if (precheck == null) {
    return null;
  }
  return {
    ...precheck,
    allowedToolsJson: precheck.resolvedToolsJson,
  } as ExecutionPrecheckRecord & { allowedToolsJson: string | null };
}
