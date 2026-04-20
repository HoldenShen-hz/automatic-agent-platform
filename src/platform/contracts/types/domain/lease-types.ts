/**
 * @fileoverview Lease Types - Execution lease and lease audit records.
 *
 * Contains records related to execution lease management,
 * fencing tokens, and lease lifecycle auditing.
 *
 * Part of the domain.ts split (see src/core/types/domain/index.ts).
 */

import type {
  LeaseStatus,
  LeaseAuditEventType,
  Timestamp,
} from "./primitives.js";

// ---------------------------------------------------------------------------
// Execution lease record
// ---------------------------------------------------------------------------

/**
 * Execution lease record - temporary exclusive right to execute work on behalf of a task.
 *
 * A lease grants a worker the exclusive right to work on an execution. Leases
 * have expiration times and require renewal via heartbeat. The fencingToken
 * prevents split-brain scenarios where two workers think they own the same execution.
 *
 * @see Lease and Fencing Contract: docs_zh/contracts/task_lease_and_fencing_contract.md
 */
export interface ExecutionLeaseRecord {
  id: string;
  executionId: string;
  workerId: string;
  attempt: number;
  /** Monotonically increasing token that proves lease ownership across renewals */
  fencingToken: number;
  queueName: string | null;
  status: LeaseStatus;
  leasedAt: Timestamp;
  expiresAt: Timestamp;
  lastHeartbeatAt: Timestamp | null;
  releasedAt: Timestamp | null;
  reasonCode: string | null;
}

// ---------------------------------------------------------------------------
// Lease audit record
// ---------------------------------------------------------------------------

/**
 * Lease audit record - immutable history of lease lifecycle events.
 *
 * Records every state transition of a lease (granted, renewed, expired, etc.)
 * for debugging and compliance auditing. The fencingToken at each event
 * proves which lease instance was active at that time.
 */
export interface LeaseAuditRecord {
  id: string;
  executionId: string;
  leaseId: string;
  workerId: string;
  fencingToken: number;
  eventType: LeaseAuditEventType;
  reasonCode: string | null;
  recordedAt: Timestamp;
}
