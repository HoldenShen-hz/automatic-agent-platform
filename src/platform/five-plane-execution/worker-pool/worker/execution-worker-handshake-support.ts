import type { AgentExecutionRecord, WorkerSnapshotRecord } from "../../../contracts/types/domain.js";

import { newId } from "../../../contracts/types/ids.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
import type { AuthoritativeTaskStore } from "../../../state-evidence/truth/authoritative-task-store.js";
import type { WorkerHandshakeDecision, WorkerRemoteLogInput } from "./execution-worker-handshake-types.js";

// R27-05 FIX: Extract shared utilities to common module to prevent maintenance divergence
// These functions are now centralized and imported by both handshake-support and writeback-support
export { parseJsonArray, toWorkerStatus, buildAgentExecutionRecord, persistRemoteLogs } from "./execution-worker-writeback-support.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

export function mergeExecutionIds(existing: string[], executionId: string): string[] {
  return Array.from(new Set([...existing, executionId])).sort();
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
