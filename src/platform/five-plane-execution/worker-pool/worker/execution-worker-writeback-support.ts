import type { AgentExecutionRecord, StepOutputRecord, WorkerSnapshotRecord } from "../../../contracts/types/domain.js";
import type { TaskTerminalStatus } from "../../../contracts/types/status.js";

import { newId } from "../../../contracts/types/ids.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
import type { WorkerRemoteLogInput } from "../execution-worker-writeback-service.js";
import type { AuthoritativeTaskStore } from "../../../five-plane-state-evidence/truth/authoritative-task-store.js";

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

export function removeExecutionId(existing: string[], executionId: string): string[] {
  return existing.filter((value) => value !== executionId).sort();
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

export function toExecutionTerminalStatus(
  terminalStatus: TaskTerminalStatus,
): "succeeded" | "failed" | "cancelled" {
  return terminalStatus === "done" ? "succeeded" : terminalStatus;
}

export function buildAgentExecutionRecord(
  store: AuthoritativeTaskStore,
  execution: NonNullable<ReturnType<AuthoritativeTaskStore["getExecution"]>>,
  executionIdOrOccurredAt: string,
  occurredAtOrUpdates: string | {
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
  maybeUpdates?: {
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
  const legacySignature = typeof occurredAtOrUpdates !== "string";
  const executionId = legacySignature ? execution.id : executionIdOrOccurredAt;
  const occurredAt = legacySignature ? executionIdOrOccurredAt : occurredAtOrUpdates;
  const updates = legacySignature ? occurredAtOrUpdates : maybeUpdates;
  if (updates === undefined || updates === null) {
    throw new TypeError("buildAgentExecutionRecord requires updates");
  }
  const existing = store.worker.getAgentExecutionRecord(executionId);
  return {
    executionId,
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
    startedAt: updates.startedAt ?? existing?.startedAt ?? execution.startedAt ?? occurredAt,
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
