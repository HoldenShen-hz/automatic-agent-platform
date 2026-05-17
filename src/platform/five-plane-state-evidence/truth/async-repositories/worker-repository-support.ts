import type { WorkerSnapshotRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncExecute } from "../async-query-helper.js";

export async function executeWorkerSnapshotUpsert(
  conn: AsyncSqlConnection,
  snapshot: WorkerSnapshotRecord,
): Promise<void> {
  const expectedVersion = snapshot.version ?? null;
  const insertedVersion = typeof snapshot.version === "number" && snapshot.version > 0 ? snapshot.version : 1;
  const changes = await asyncExecute(
    conn,
    `INSERT INTO worker_snapshots (
      worker_id, status, placement, isolation_level, repo_version, remote_session_status,
      last_acknowledged_stream_offset, stream_resume_success_rate, credential_refresh_success_rate,
      session_consistency_check_status, session_consistency_checked_at, workspace_sync_status,
      workspace_sync_checked_at, saturation, active_lease_count, mean_startup_latency_ms,
      sandbox_success_rate, repo_cache_hit_rate, registration_verified_at, registration_challenge_id,
      capabilities_json, running_executions_json, max_concurrency, queue_affinity, runtime_instance_id,
      restarted_from_runtime_instance_id, restart_generation, cpu_pct, memory_mb, tool_backlog_count,
      current_step_id, last_progress_at, last_heartbeat_at, updated_at, version
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35)
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
      updated_at = excluded.updated_at,
      version = worker_snapshots.version + 1
    WHERE $36 IS NULL OR worker_snapshots.version = $36`,
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
    insertedVersion,
    expectedVersion,
  );
  if (changes === 0) {
    throw new Error(`worker_snapshot.version_conflict:${snapshot.workerId}:${expectedVersion}`);
  }
}
