import type { AgentExecutionRecord, WorkerSnapshotRecord } from "../../../contracts/types/domain.js";

import { newId } from "../../../contracts/types/ids.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
import type { AuthoritativeTaskStore } from "../../../state-evidence/truth/authoritative-task-store.js";
import type { WorkerHandshakeDecision, WorkerRemoteLogInput } from "./execution-worker-handshake-types.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

export function parseJsonArray(value: string): string[] {
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

export function toWorkerStatus(
  snapshot: WorkerSnapshotRecord,
  runningExecutionIds: string[],
): WorkerSnapshotRecord["status"] {
  if (snapshot.status === "unavailable") return "unavailable";
  if (snapshot.status === "quarantined") return "quarantined";
  if (snapshot.status === "offline") return "offline";
  if (snapshot.status === "draining") return "draining";
  if (snapshot.status === "degraded") return "degraded";
  return runningExecutionIds.length > 0 ? "busy" : "idle";
}

export function buildAgentExecutionRecord(
  store: AuthoritativeTaskStore,
  execution: NonNullable<ReturnType<AuthoritativeTaskStore["getExecution"]>>,
  occurredAt: string,
  updates: {
    agentId: string;
    runtimeInstanceId: string | null;
    restartedFromRuntimeInstanceId: string | null;
    restartGeneration: number;
    status: string;
    currentStepId: string | null;
    lastToolName: string | null;
    toolCallCount: number;
    progressMessage: string | null;
    lastErrorCode: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
  },
): AgentExecutionRecord {
  const existing = store.worker.getAgentExecutionRecord(execution.id);
  return {
    executionId: execution.id,
    taskId: execution.taskId,
    agentId: updates.agentId,
    workflowId: execution.workflowId,
    roleId: execution.roleId,
    runKind: execution.runKind,
    runtimeInstanceId: updates.runtimeInstanceId,
    restartedFromRuntimeInstanceId: updates.restartedFromRuntimeInstanceId,
    restartGeneration: updates.restartGeneration,
    status: updates.status,
    planJson:
      existing?.planJson ??
      JSON.stringify({
        workflowId: execution.workflowId,
        roleId: execution.roleId,
        runKind: execution.runKind,
      }),
    currentStepId: updates.currentStepId,
    lastToolName: updates.lastToolName,
    toolCallCount: Math.max(0, Math.trunc(updates.toolCallCount)),
    lastDecisionJson: existing?.lastDecisionJson ?? null,
    lastErrorCode: updates.lastErrorCode,
    retryCount: existing?.retryCount ?? Math.max(execution.attempt - 1, 0),
    progressMessage: updates.progressMessage,
    startedAt: updates.startedAt === undefined ? (existing?.startedAt ?? occurredAt) : updates.startedAt,
    createdAt: existing?.createdAt ?? occurredAt,
    updatedAt: occurredAt,
    completedAt: updates.completedAt === undefined ? (existing?.completedAt ?? null) : updates.completedAt,
  };
}

export function persistRemoteLogs(
  store: AuthoritativeTaskStore,
  taskId: string,
  executionId: string,
  traceId: string,
  workerId: string,
  runtimeInstanceId: string | null,
  remoteLogs: WorkerRemoteLogInput[] | undefined,
  defaultOccurredAt: string,
): void {
  for (const entry of remoteLogs ?? []) {
    const message = entry.message.trim();
    if (message.length === 0) continue;
    store.worker.insertRemoteLog({
      id: newId("rlog"),
      taskId,
      executionId,
      workerId,
      runtimeInstanceId,
      level: entry.level,
      message,
      contextJson: JSON.stringify({
        taskId,
        executionId,
        workerId,
        traceId,
        correlationId: taskId,
        ...(runtimeInstanceId ? { runtimeInstanceId } : {}),
        ...(entry.context ?? {}),
      }),
      createdAt: entry.occurredAt ?? defaultOccurredAt,
    });
  }
}

export function recordRejectedEvent(
  store: AuthoritativeTaskStore,
  eventType: "worker:claim_rejected" | "worker:heartbeat_rejected",
  taskId: string,
  executionId: string,
  occurredAt: string,
  payload: Record<string, unknown>,
): void {
  const execution = store.dispatch.getExecution(executionId);
  store.event.insertEvent({
    id: newId("evt"),
    taskId,
    executionId,
    eventType,
    eventTier: "tier_2",
    payloadJson: JSON.stringify(payload),
    traceId: execution?.traceId ?? null,
    createdAt: occurredAt,
  });
}

export function normalizeLeaseReason(reasonCode: string | null): WorkerHandshakeDecision["reasonCode"] {
  if (
    reasonCode === "lease_not_found" ||
    reasonCode === "lease_not_active" ||
    reasonCode === "lease_expired" ||
    reasonCode === "worker_mismatch"
  ) {
    return reasonCode;
  }
  return reasonCode === "no_active_lease" || reasonCode === "stale_fencing_token" ? reasonCode : null;
}
