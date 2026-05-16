import type {
  CoordinatorInstanceRecord,
  HeartbeatSnapshotRecord,
  WorkerSnapshotRecord,
} from "../sqlite-repository-contracts.js";
import { resolveTenantScope } from "../authoritative-task-store-types.js";
import { execute, queryAll, queryOne, type SqliteConnection } from "../query-helper.js";

const WORKER_SNAPSHOT_SELECT = `SELECT
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
  updated_at AS "updatedAt",
  version
 FROM worker_snapshots`;

const COORDINATOR_SNAPSHOT_SELECT = `SELECT
  coordinator_id AS "coordinatorId",
  region,
  role,
  queue_affinity AS "queueAffinity",
  status,
  max_concurrent_dispatches AS "maxConcurrentDispatches",
  active_dispatch_count AS "activeDispatchCount",
  backlog_count AS "backlogCount",
  cpu_pct AS "cpuPct",
  shard_json AS "shardJson",
  last_heartbeat_at AS "lastHeartbeatAt",
  metadata_json AS "metadataJson",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
 FROM coordinator_instance_snapshots`;

const HEARTBEAT_SNAPSHOT_SELECT = `SELECT
  h.id,
  h.execution_id AS "executionId",
  h.agent_id AS "agentId",
  h.runtime_instance_id AS "runtimeInstanceId",
  h.restart_generation AS "restartGeneration",
  h.status,
  h.progress_message AS "progressMessage",
  h.cpu_pct AS "cpuPct",
  h.memory_mb AS "memoryMb",
  h.sampled_at AS "sampledAt"
 FROM heartbeat_snapshots h`;

export class WorkerSnapshotRepository {
  public constructor(private readonly conn: SqliteConnection) {}

  public insertHeartbeatSnapshot(snapshot: HeartbeatSnapshotRecord): void {
    execute(
      this.conn,
      `INSERT INTO heartbeat_snapshots (
        id, execution_id, agent_id, runtime_instance_id, restart_generation,
        status, progress_message, cpu_pct, memory_mb, sampled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  public upsertWorkerSnapshot(snapshot: WorkerSnapshotRecord): void {
    const expectedVersion = typeof snapshot.version === "number" ? snapshot.version : 0;
    const insertedVersion = expectedVersion > 0 ? expectedVersion : 1;
    const changes = execute(
      this.conn,
      `INSERT INTO worker_snapshots (
        worker_id, status, placement, isolation_level, repo_version, remote_session_status,
        last_acknowledged_stream_offset, stream_resume_success_rate, credential_refresh_success_rate,
        session_consistency_check_status, session_consistency_checked_at, workspace_sync_status,
        workspace_sync_checked_at, saturation, active_lease_count, mean_startup_latency_ms,
        sandbox_success_rate, repo_cache_hit_rate, registration_verified_at, registration_challenge_id,
        capabilities_json, running_executions_json, max_concurrency, queue_affinity, runtime_instance_id,
        restarted_from_runtime_instance_id, restart_generation, cpu_pct, memory_mb, tool_backlog_count,
        current_step_id, last_progress_at, last_heartbeat_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      WHERE ? = 0 OR worker_snapshots.version = ?`,
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
      expectedVersion,
    );
    if (changes === 0) {
      throw new Error(`worker_snapshot.version_conflict:${snapshot.workerId}:${expectedVersion}`);
    }
  }

  public upsertCoordinatorInstanceSnapshot(snapshot: CoordinatorInstanceRecord): void {
    execute(
      this.conn,
      `INSERT INTO coordinator_instance_snapshots (
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

  public getWorkerSnapshot(workerId: string): WorkerSnapshotRecord | undefined {
    return queryOne<WorkerSnapshotRecord>(
      this.conn,
      `${WORKER_SNAPSHOT_SELECT}
       WHERE worker_id = ?`,
      workerId,
    );
  }

  public listWorkerSnapshots(status?: string, limit?: number): WorkerSnapshotRecord[] {
    const params: Array<string | number> = [];
    let sql = WORKER_SNAPSHOT_SELECT;
    if (status != null) {
      sql += " WHERE status = ?";
      params.push(status);
    }
    sql += status == null && limit == null ? " ORDER BY worker_id ASC" : " ORDER BY last_heartbeat_at DESC";
    if (limit != null) {
      sql += " LIMIT ?";
      params.push(limit);
    }
    return queryAll<WorkerSnapshotRecord>(this.conn, sql, ...params);
  }

  public listStaleWorkerSnapshots(heartbeatBefore: string): WorkerSnapshotRecord[] {
    return queryAll<WorkerSnapshotRecord>(
      this.conn,
      `${WORKER_SNAPSHOT_SELECT}
       WHERE last_heartbeat_at < ?
       ORDER BY last_heartbeat_at ASC`,
      heartbeatBefore,
    );
  }

  public getCoordinatorInstanceSnapshot(coordinatorId: string): CoordinatorInstanceRecord | undefined {
    return queryOne<CoordinatorInstanceRecord>(
      this.conn,
      `${COORDINATOR_SNAPSHOT_SELECT}
       WHERE coordinator_id = ?`,
      coordinatorId,
    );
  }

  public listCoordinatorInstanceSnapshots(limit = 100): CoordinatorInstanceRecord[] {
    return queryAll<CoordinatorInstanceRecord>(
      this.conn,
      `${COORDINATOR_SNAPSHOT_SELECT}
       ORDER BY last_heartbeat_at DESC
       LIMIT ?`,
      limit,
    );
  }

  public listHeartbeatSnapshotsByExecution(
    executionId: string,
    tenantId?: string | null,
  ): HeartbeatSnapshotRecord[] {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId !== undefined) {
      return queryAll<HeartbeatSnapshotRecord>(
        this.conn,
        `${HEARTBEAT_SNAPSHOT_SELECT}
         INNER JOIN agent_execution_records a ON a.execution_id = h.execution_id
         INNER JOIN tasks t ON t.id = a.task_id
         WHERE h.execution_id = ?
           AND t.tenant_id = ?
         ORDER BY h.sampled_at ASC, h.id ASC`,
        executionId,
        scopedTenantId,
      );
    }
    return queryAll<HeartbeatSnapshotRecord>(
      this.conn,
      `${HEARTBEAT_SNAPSHOT_SELECT}
       WHERE h.execution_id = ?
       ORDER BY h.sampled_at ASC, h.id ASC`,
      executionId,
    );
  }
}
