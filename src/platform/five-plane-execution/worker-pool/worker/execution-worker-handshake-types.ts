import type { WorkerSnapshotRecord } from "../../../contracts/types/domain.js";
import type { ExecutionResourceCeilingGuard } from "../../dispatcher/execution-resource-ceiling-guard.js";

export interface WorkerClaimExecutionInput {
  ticketId: string;
  workerId: string;
  leaseId: string;
  fencingToken: number;
  runtimeInstanceId?: string | null;
  restartedFromRuntimeInstanceId?: string | null;
  progressMessage?: string | null;
  lastToolName?: string | null;
  toolCallCount?: number;
  cpuPct?: number | null;
  memoryMb?: number | null;
  remoteSessionStatus?: WorkerSnapshotRecord["remoteSessionStatus"];
  lastAcknowledgedStreamOffset?: string | null;
  streamResumeSuccessRate?: number | null;
  credentialRefreshSuccessRate?: number | null;
  sessionConsistencyCheckStatus?: WorkerSnapshotRecord["sessionConsistencyCheckStatus"];
  sessionConsistencyCheckedAt?: string | null;
  workspaceSyncStatus?: WorkerSnapshotRecord["workspaceSyncStatus"];
  workspaceSyncCheckedAt?: string | null;
  saturation?: number | null;
  activeLeaseCount?: number;
  meanStartupLatencyMs?: number | null;
  sandboxSuccessRate?: number | null;
  repoCacheHitRate?: number | null;
  toolBacklogCount?: number;
  currentStepId?: string | null;
  lastProgressAt?: string | null;
  remoteLogs?: WorkerRemoteLogInput[];
  occurredAt?: string;
}

export interface WorkerExecutionHeartbeatInput {
  executionId: string;
  workerId: string;
  leaseId: string;
  fencingToken: number;
  runtimeInstanceId?: string | null;
  restartedFromRuntimeInstanceId?: string | null;
  ttlMs: number;
  progressMessage?: string | null;
  lastToolName?: string | null;
  toolCallCount?: number;
  cpuPct?: number | null;
  memoryMb?: number | null;
  remoteSessionStatus?: WorkerSnapshotRecord["remoteSessionStatus"];
  lastAcknowledgedStreamOffset?: string | null;
  streamResumeSuccessRate?: number | null;
  credentialRefreshSuccessRate?: number | null;
  sessionConsistencyCheckStatus?: WorkerSnapshotRecord["sessionConsistencyCheckStatus"];
  sessionConsistencyCheckedAt?: string | null;
  workspaceSyncStatus?: WorkerSnapshotRecord["workspaceSyncStatus"];
  workspaceSyncCheckedAt?: string | null;
  saturation?: number | null;
  activeLeaseCount?: number;
  meanStartupLatencyMs?: number | null;
  sandboxSuccessRate?: number | null;
  repoCacheHitRate?: number | null;
  toolBacklogCount?: number;
  currentStepId?: string | null;
  lastProgressAt?: string | null;
  remoteLogs?: WorkerRemoteLogInput[];
  occurredAt?: string;
}

export interface WorkerRemoteLogInput {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown> | null;
  occurredAt?: string;
}

export interface WorkerHandshakeDecision {
  accepted: boolean;
  reasonCode:
    | "ticket_not_found"
    | "ticket_not_claimed"
    | "worker_mismatch"
    | "lease_mismatch"
    | "worker_not_registered"
    | "worker_not_trusted"
    | "lease_not_found"
    | "no_active_lease"
    | "stale_fencing_token"
    | "ttl_out_of_bounds"
    | "execution_not_found"
    | "lease_not_active"
    | "lease_expired"
    | "remote_session_viewer_only"
    | "remote_session_consistency_mismatch"
    | "remote_workspace_sync_conflict"
    | "remote_session_resume_offset_missing"
    | "resource_limit_exceeded"
    | null;
  executionId: string | null;
  ticketId: string | null;
  leaseId: string | null;
}

export interface ExecutionWorkerHandshakeServiceOptions {
  resourceCeilingGuard?: ExecutionResourceCeilingGuard;
}
