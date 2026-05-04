import type { AgentExecutionRecord, WorkerSnapshotRecord } from "../../../contracts/types/domain.js";

import { newId } from "../../../contracts/types/ids.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
import type { AuthoritativeTaskStore } from "../../../state-evidence/truth/authoritative-task-store.js";
import type { WorkerHandshakeDecision, WorkerRemoteLogInput } from "./execution-worker-handshake-types.js";

// R27-05 FIX: Extract shared utilities to common module to prevent maintenance divergence
// Re-export from writeback-support for consumers that need both
export { parseJsonArray, toWorkerStatus, persistRemoteLogs } from "./execution-worker-writeback-support.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

export function mergeExecutionIds(existing: string[], executionId: string): string[] {
  return Array.from(new Set([...existing, executionId])).sort();
}

// buildAgentExecutionRecord has different signatures in handshake vs writeback
// Keep handshake version here and re-export writeback version under different name if needed
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
