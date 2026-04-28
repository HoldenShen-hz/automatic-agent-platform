import type { AgentExecutionRecord, DispatchTarget, DispatchDecisionTrace, DispatchWorkerEvaluation, DispatchWorkerRejectionReason, ExecutionTicketRecord, RemoteAvailability, TaskPriority, WorkerIsolationLevel } from "../../contracts/types/domain.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { RegisteredWorkerView } from "../worker-pool/worker-registry-service.js";
import { resolveRemoteAuthorityBlockReason } from "../worker-pool/remote-session-guard.js";

export interface CreateExecutionTicketInput {
  executionId: string;
  priority?: TaskPriority;
  queueName?: string | null;
  dispatchTarget?: DispatchTarget | null;
  requiredIsolationLevel?: WorkerIsolationLevel | null;
  requiredRepoVersion?: string | null;
  requiredCapabilities?: string[];
  dispatchAfter?: string | null;
  occurredAt?: string;
}

export interface DispatchExecutionOptions {
  queueName?: string | null;
  preferredWorkerId?: string | null;
  leaseTtlMs: number;
  includeDegraded?: boolean;
  occurredAt?: string;
}

export interface DispatchQueueAvailabilitySnapshot {
  state: "available" | "degraded" | "unavailable";
  reasonCode?: string | null;
}

export interface ExecutionTicketDecision {
  outcome: "created" | "exists";
  ticket: ExecutionTicketRecord;
}

export interface DispatchExecutionDecision {
  outcome: "dispatched" | "no_ticket" | "no_worker" | "blocked";
  reasonCode: string | null;
  ticket: ExecutionTicketRecord | null;
  worker: RegisteredWorkerView | null;
  leaseId: string | null;
  trace: DispatchDecisionTrace | null;
}

export const DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS = {
  memoryHighWatermarkMb: Number.POSITIVE_INFINITY,
  eventLoopLagThresholdMs: Number.POSITIVE_INFINITY,
} as const;
export const AFFINITY_SELECTION_BONUS = 0.35;
export const LOAD_SKEW_SELECTION_PENALTY = 0.75;

const ISOLATION_LEVEL_ORDER: Record<WorkerIsolationLevel, number> = {
  standard: 0,
  hardened: 1,
  strict: 2,
};

export function isRemoteSessionReadyForDispatch(worker: RegisteredWorkerView): boolean {
  return (
    worker.placement !== "remote"
    || (
      worker.remoteSessionStatus === "connected"
      && resolveRemoteAuthorityBlockReason({
        placement: worker.placement,
        remoteSessionStatus: worker.remoteSessionStatus,
        lastAcknowledgedStreamOffset: worker.lastAcknowledgedStreamOffset,
        sessionConsistencyCheckStatus: worker.sessionConsistencyCheckStatus,
        workspaceSyncStatus: worker.workspaceSyncStatus,
      }) == null
    )
  );
}

export function normalizeStringArray(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))).sort();
}

export function parseJsonArray(value: string, onError?: (message: string) => void): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch (err) {
    onError?.(err instanceof Error ? err.message : String(err));
    return [];
  }
}

export function resolveDispatchTarget(target: DispatchTarget | null | undefined): DispatchTarget {
  switch (target) {
    case "local_only":
    case "prefer_remote":
    case "require_remote":
      return target;
    default:
      return "any";
  }
}

export function resolveRequiredIsolationLevel(level: WorkerIsolationLevel | null | undefined): WorkerIsolationLevel {
  switch (level) {
    case "hardened":
    case "strict":
      return level;
    default:
      return "standard";
  }
}

export function resolveRequiredRepoVersion(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function meetsIsolationRequirement(
  workerIsolationLevel: WorkerIsolationLevel,
  requiredIsolationLevel: WorkerIsolationLevel,
): boolean {
  return ISOLATION_LEVEL_ORDER[workerIsolationLevel] >= ISOLATION_LEVEL_ORDER[requiredIsolationLevel];
}

export function resolveRemoteAvailability(
  dispatchTarget: DispatchTarget,
  evaluations: DispatchWorkerEvaluation[],
): RemoteAvailability | null {
  if (dispatchTarget !== "prefer_remote" && dispatchTarget !== "require_remote") return null;
  const remoteEvaluations = evaluations.filter(
    (evaluation) => evaluation.placement === "remote" && evaluation.rejectionReason !== "worker_placement_mismatch",
  );
  if (remoteEvaluations.length === 0) return "unavailable";
  if (remoteEvaluations.some((evaluation) => evaluation.accepted)) {
    return remoteEvaluations.every((evaluation) => evaluation.accepted) ? "healthy" : "partial_available";
  }
  if (
    remoteEvaluations.some(
      (evaluation) =>
        evaluation.rejectionReason === "worker_degraded_filtered"
        || evaluation.rejectionReason === "worker_untrusted"
        || evaluation.rejectionReason === "worker_remote_session_unready",
    )
  ) {
    return "degraded";
  }
  if (
    remoteEvaluations.every(
      (evaluation) =>
        evaluation.rejectionReason === "worker_unavailable"
        || evaluation.rejectionReason === "worker_draining"
        || evaluation.rejectionReason === "worker_offline"
        || evaluation.rejectionReason === "worker_quarantined",
    )
  ) {
    return "unavailable";
  }
  return "partial_available";
}

export function resolveRemoteRepoVersionReason(
  dispatchTarget: DispatchTarget,
  evaluations: DispatchWorkerEvaluation[],
  requiredRepoVersion: string | null,
): string | null {
  if (requiredRepoVersion == null || (dispatchTarget !== "prefer_remote" && dispatchTarget !== "require_remote")) return null;
  const remoteEvaluations = evaluations.filter(
    (evaluation) => evaluation.placement === "remote" && evaluation.rejectionReason !== "worker_placement_mismatch",
  );
  if (remoteEvaluations.length === 0) return null;
  if (
    remoteEvaluations.some((evaluation) => evaluation.accepted)
    || !remoteEvaluations.every((evaluation) => evaluation.rejectionReason === "worker_repo_version_mismatch")
  ) {
    return null;
  }
  return dispatchTarget === "require_remote"
    ? "remote.repo_version_mismatch"
    : "remote.fallback_local.repo_version_mismatch";
}

export function resolveRemoteSessionReason(
  dispatchTarget: DispatchTarget,
  evaluations: DispatchWorkerEvaluation[],
): string | null {
  if (dispatchTarget !== "prefer_remote" && dispatchTarget !== "require_remote") return null;
  const remoteEvaluations = evaluations.filter(
    (evaluation) => evaluation.placement === "remote" && evaluation.rejectionReason !== "worker_placement_mismatch",
  );
  if (remoteEvaluations.length === 0) return null;
  if (
    remoteEvaluations.some((evaluation) => evaluation.accepted)
    || !remoteEvaluations.every((evaluation) => evaluation.rejectionReason === "worker_remote_session_unready")
  ) {
    return null;
  }
  return dispatchTarget === "require_remote"
    ? "remote.session_unready"
    : "remote.fallback_local.session_unready";
}

export function resolveRemoteTrustReason(
  dispatchTarget: DispatchTarget,
  evaluations: DispatchWorkerEvaluation[],
): string | null {
  if (dispatchTarget !== "prefer_remote" && dispatchTarget !== "require_remote") return null;
  const remoteEvaluations = evaluations.filter(
    (evaluation) => evaluation.placement === "remote" && evaluation.rejectionReason !== "worker_placement_mismatch",
  );
  if (remoteEvaluations.length === 0) return null;
  if (
    remoteEvaluations.some((evaluation) => evaluation.accepted)
    || !remoteEvaluations.every((evaluation) => evaluation.rejectionReason === "worker_untrusted")
  ) {
    return null;
  }
  return dispatchTarget === "require_remote"
    ? "remote.untrusted"
    : "remote.fallback_local.untrusted";
}

export function selectWorkersForDispatch(
  dispatchTarget: DispatchTarget,
  eligibleWorkers: RegisteredWorkerView[],
  remoteAvailability: RemoteAvailability | null,
  remoteTrustReason: string | null,
  remoteSessionReason: string | null,
  remoteRepoVersionReason: string | null,
): {
  workers: RegisteredWorkerView[];
  reasonCode: string | null;
  fallbackApplied: boolean;
} {
  if (dispatchTarget !== "prefer_remote") {
    return { workers: eligibleWorkers, reasonCode: null, fallbackApplied: false };
  }
  const remoteWorkers = eligibleWorkers.filter((worker) => worker.placement === "remote");
  if (remoteWorkers.length > 0) {
    return { workers: remoteWorkers, reasonCode: null, fallbackApplied: false };
  }
  const localWorkers = eligibleWorkers.filter((worker) => worker.placement === "local");
  return {
    workers: localWorkers,
    reasonCode:
      localWorkers.length > 0
        ? (
          remoteTrustReason
          ?? remoteSessionReason
          ?? remoteRepoVersionReason
          ?? (remoteAvailability != null ? `remote.fallback_local.${remoteAvailability}` : null)
        )
        : null,
    fallbackApplied: localWorkers.length > 0,
  };
}

export function toWorkerEvaluation(
  worker: RegisteredWorkerView,
  accepted: boolean,
  rejectionReason: DispatchWorkerRejectionReason | null,
  missingCapabilities: string[],
): DispatchWorkerEvaluation {
  return {
    workerId: worker.workerId,
    status: worker.status,
    schedulingStatus: worker.schedulingStatus,
    placement: worker.placement,
    isolationLevel: worker.isolationLevel,
    repoVersion: worker.repoVersion,
    remoteSessionStatus: worker.remoteSessionStatus,
    lastAcknowledgedStreamOffset: worker.lastAcknowledgedStreamOffset,
    sessionConsistencyCheckStatus: worker.sessionConsistencyCheckStatus,
    workspaceSyncStatus: worker.workspaceSyncStatus,
    queueAffinity: worker.queueAffinity,
    availableSlots: worker.availableSlots,
    accepted,
    rejectionReason,
    missingCapabilities,
  };
}

export function buildDispatchAgentExecutionRecord(
  store: AuthoritativeTaskStore,
  execution: NonNullable<ReturnType<AuthoritativeTaskStore["getExecution"]>>,
  occurredAt: string,
  updates: {
    taskId: string;
    status?: string;
    planJson?: string;
    lastDecisionJson?: string | null;
    progressMessage?: string | null;
  },
): AgentExecutionRecord {
  const existing = store.worker.getAgentExecutionRecord(execution.id);
  return {
    executionId: execution.id,
    taskId: updates.taskId,
    agentId: existing?.agentId ?? execution.agentId,
    workflowId: execution.workflowId,
    roleId: execution.roleId,
    runKind: execution.runKind,
    runtimeInstanceId: existing?.runtimeInstanceId ?? null,
    restartedFromRuntimeInstanceId: existing?.restartedFromRuntimeInstanceId ?? null,
    restartGeneration: existing?.restartGeneration ?? 0,
    status: updates.status ?? existing?.status ?? execution.status,
    planJson:
      updates.planJson ??
      existing?.planJson ??
      JSON.stringify({ workflowId: execution.workflowId, roleId: execution.roleId, runKind: execution.runKind }),
    currentStepId: existing?.currentStepId ?? null,
    lastToolName: existing?.lastToolName ?? null,
    toolCallCount: existing?.toolCallCount ?? 0,
    lastDecisionJson: updates.lastDecisionJson === undefined ? (existing?.lastDecisionJson ?? null) : updates.lastDecisionJson,
    lastErrorCode: execution.lastErrorCode,
    retryCount: existing?.retryCount ?? Math.max(execution.attempt - 1, 0),
    progressMessage: updates.progressMessage === undefined ? (existing?.progressMessage ?? null) : updates.progressMessage,
    startedAt: existing?.startedAt ?? null,
    createdAt: existing?.createdAt ?? occurredAt,
    updatedAt: occurredAt,
    completedAt: existing?.completedAt ?? null,
  };
}

export function resolveDispatchBackpressureReason(
  ticket: ExecutionTicketRecord,
  snapshot: { degradationMode: string; queueGovernance: { starvationDetected: boolean } } | null,
): string | null {
  if (!snapshot) return null;
  if (snapshot.degradationMode === "read_only_operations_only") return "backpressure.read_only_mode";
  if (snapshot.degradationMode === "pause_non_critical" && !isElevatedPriority(ticket.priority)) return "backpressure.pause_non_critical";
  if (snapshot.degradationMode === "queue_only" && snapshot.queueGovernance.starvationDetected && ticket.priority === "low") {
    return "backpressure.starvation_protection";
  }
  if (snapshot.degradationMode === "queue_only" && !isElevatedPriority(ticket.priority)) return "backpressure.queue_only";
  return null;
}

export function isElevatedPriority(priority: TaskPriority): boolean {
  return priority === "high" || priority === "critical";
}
