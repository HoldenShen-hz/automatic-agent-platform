import type { AgentExecutionRecord, WorkerSnapshotRecord } from "../../../contracts/types/domain.js";

import { newId } from "../../../contracts/types/ids.js";
import type { AuthoritativeTaskStore } from "../../../state-evidence/truth/authoritative-task-store.js";
import type { WorkerHandshakeDecision, WorkerRemoteLogInput } from "./execution-worker-handshake-types.js";
export {
  buildAgentExecutionRecord,
  parseJsonArray,
  persistRemoteLogs,
  toWorkerStatus,
} from "./execution-worker-writeback-support.js";

export function mergeExecutionIds(existing: string[], executionId: string): string[] {
  return Array.from(new Set([...existing, executionId])).sort();
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
