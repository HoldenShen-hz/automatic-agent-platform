import type { StructuredLogger } from "../../shared/observability/structured-logger.js";
import type { WorkerSnapshotRecord } from "../../contracts/types/domain.js";
import type { WorkerRegistryService } from "../worker-pool/worker-registry-service.js";

export function plusMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) + ms).toISOString();
}

export function parseJsonArray(value: string, logger: StructuredLogger): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch (err) {
    logger.log({
      level: "warn",
      message: "Failed to parse JSON array",
      data: { error: err instanceof Error ? err.message : String(err), value: value.substring(0, 100) },
    });
    return [];
  }
}

export function mergeExecutionIds(existing: string[], executionId: string): string[] {
  return Array.from(new Set([...existing, executionId])).sort();
}

export function removeExecutionId(existing: string[], executionId: string): string[] {
  return existing.filter((value) => value !== executionId).sort();
}

export function toWorkerStatus(
  snapshot: WorkerSnapshotRecord,
  runningExecutionIds: string[],
): WorkerSnapshotRecord["status"] {
  if (snapshot.status === "unavailable") {
    return "unavailable";
  }
  if (snapshot.status === "quarantined") {
    return "quarantined";
  }
  if (snapshot.status === "offline") {
    return "offline";
  }
  if (snapshot.status === "draining") {
    return "draining";
  }
  if (snapshot.status === "degraded") {
    return "degraded";
  }
  return runningExecutionIds.length > 0 ? "busy" : "idle";
}

export function buildWorkerSnapshotRefreshInput(
  snapshot: WorkerSnapshotRecord,
  runningExecutionIds: string[],
  occurredAt: string,
  logger: StructuredLogger,
): Parameters<WorkerRegistryService["recordHeartbeat"]>[0] {
  return {
    workerId: snapshot.workerId,
    status: toWorkerStatus(snapshot, runningExecutionIds),
    placement: snapshot.placement ?? null,
    isolationLevel: snapshot.isolationLevel ?? null,
    repoVersion: snapshot.repoVersion ?? null,
    remoteSessionStatus: snapshot.remoteSessionStatus ?? null,
    lastAcknowledgedStreamOffset: snapshot.lastAcknowledgedStreamOffset ?? null,
    streamResumeSuccessRate: snapshot.streamResumeSuccessRate ?? null,
    credentialRefreshSuccessRate: snapshot.credentialRefreshSuccessRate ?? null,
    sessionConsistencyCheckStatus: snapshot.sessionConsistencyCheckStatus ?? null,
    sessionConsistencyCheckedAt: snapshot.sessionConsistencyCheckedAt ?? null,
    saturation: snapshot.saturation ?? null,
    activeLeaseCount: snapshot.activeLeaseCount ?? 0,
    meanStartupLatencyMs: snapshot.meanStartupLatencyMs ?? null,
    sandboxSuccessRate: snapshot.sandboxSuccessRate ?? null,
    repoCacheHitRate: snapshot.repoCacheHitRate ?? null,
    capabilities: parseJsonArray(snapshot.capabilitiesJson, logger),
    runningExecutionIds,
    maxConcurrency: snapshot.maxConcurrency,
    queueAffinity: snapshot.queueAffinity,
    runtimeInstanceId: snapshot.runtimeInstanceId,
    restartedFromRuntimeInstanceId: snapshot.restartedFromRuntimeInstanceId,
    cpuPct: snapshot.cpuPct,
    memoryMb: snapshot.memoryMb,
    toolBacklogCount: snapshot.toolBacklogCount,
    currentStepId: snapshot.currentStepId,
    lastProgressAt: snapshot.lastProgressAt,
    occurredAt,
  };
}
