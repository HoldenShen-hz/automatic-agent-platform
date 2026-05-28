/**
 * @fileoverview Dispatch Types - Execution dispatch, ticket, and evaluation records.
 *
 * Contains records related to task dispatching, worker selection,
 * and dispatch decision tracking.
 *
 * Part of the domain.ts split (see src/core/types/domain/index.ts).
 */

import type {
  DispatchWorkerRejectionReason,
  DispatchTarget,
  ExecutionTicketStatus,
  RemoteAvailability,
  TaskPriority,
  WorkerPlacement,
  WorkerIsolationLevel,
  RemoteSessionStatus,
  SessionConsistencyCheckStatus,
  WorkspaceSyncStatus,
  WorkerStatus,
  WorkerSchedulingStatus,
  Timestamp,
} from "./primitives.js";

// ---------------------------------------------------------------------------
// Execution ticket record
// ---------------------------------------------------------------------------

/**
 * Execution ticket record - represents a dispatch request for an execution.
 *
 * When an execution needs a worker, a ticket is created and placed in a queue.
 * Workers claim tickets, which creates a lease granting execution rights.
 * Tickets track dispatch constraints (isolation, capabilities, affinity).
 */
export interface ExecutionTicketRecord {
  id: string;
  executionId: string;
  taskId: string;
  // R13-15: tenantId for per-tenant fair scheduling
  tenantId: string;
  priority: TaskPriority;
  queueName: string | null;
  dispatchTarget?: DispatchTarget | null;
  requiredIsolationLevel?: WorkerIsolationLevel | null;
  requiredRepoVersion?: string | null;
  requiredCapabilitiesJson: string;
  dispatchAfter: Timestamp | null;
  attempt: number;
  status: ExecutionTicketStatus;
  assignedWorkerId: string | null;
  leaseId: string | null;
  claimedAt: Timestamp | null;
  consumedAt: Timestamp | null;
  invalidatedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // R6-3: Risk class for isolation routing and capability-based dispatch
  riskClass?: string | null;
  // R6-3: Required sandbox type for this execution
  requiredSandboxType?: string | null;
  // R6-3: Tenant quota reference for resource governance
  tenantQuotaRef?: string | null;
  // R6-4: Critical path rank for deterministic graph scheduling per §14.9
  // Higher value = more critical for overall execution time
  // Used for critical-path-first ordering when selecting which ticket to dispatch next
  criticalPathRank?: number | null;
  // R6-4: Scheduler seed for deterministic dispatch ordering per §14.9
  // Ensures same ticket ordering across scheduler restarts
  // Combined with priority/risk_class/critical_path_rank for full determinism
  schedulerSeed?: string | null;
}

// ---------------------------------------------------------------------------
// Dispatch worker evaluation
// ---------------------------------------------------------------------------

/**
 * Dispatch worker evaluation - result of evaluating a single worker for dispatch.
 *
 * When selecting a worker, the dispatcher evaluates each candidate against
 * dispatch requirements (capabilities, isolation, affinity). This record captures
 * the evaluation outcome including rejection reasons if the worker was skipped.
 */
export interface DispatchWorkerEvaluation {
  workerId: string;
  status: WorkerStatus;
  schedulingStatus: WorkerSchedulingStatus;
  placement?: WorkerPlacement | null;
  isolationLevel?: WorkerIsolationLevel | null;
  repoVersion?: string | null;
  remoteSessionStatus?: RemoteSessionStatus | null;
  lastAcknowledgedStreamOffset?: string | null;
  sessionConsistencyCheckStatus?: SessionConsistencyCheckStatus | null;
  workspaceSyncStatus?: WorkspaceSyncStatus | null;
  queueAffinity: string | null;
  availableSlots: number;
  accepted: boolean;
  rejectionReason: DispatchWorkerRejectionReason | null;
  missingCapabilities: string[];
  affinityMatched?: boolean;
  activeLeaseCount?: number;
  runningExecutionCount?: number;
  saturation?: number | null;
  toolBacklogCount?: number;
  loadScore?: number;
  activeLeaseShare?: number | null;
  dispatchScore?: number;
  loadSkewPenaltyApplied?: boolean;
}

export type { WorkerStatus, WorkerSchedulingStatus };
export type { ExecutionTicketStatus } from "./primitives.js";

// ---------------------------------------------------------------------------
// Dispatch decision trace
// ---------------------------------------------------------------------------

/**
 * Dispatch decision trace - audit trail of a dispatch decision.
 *
 * Captures the complete context and outcome of selecting a worker for an execution.
 * Includes all evaluated workers, selection criteria, and any preemption applied.
 * Used for debugging dispatch issues and understanding scheduling behavior.
 */
export interface DispatchDecisionTrace {
  ticketId: string;
  executionId: string;
  taskId: string;
  queueName: string | null;
  dispatchTarget?: DispatchTarget | null;
  remoteAvailability?: RemoteAvailability | null;
  requiredIsolationLevel?: WorkerIsolationLevel | null;
  requiredRepoVersion?: string | null;
  preferredWorkerId: string | null;
  requiredCapabilities: string[];
  outcome: "dispatched" | "no_worker" | "blocked";
  reasonCode: string | null;
  selectedWorkerId: string | null;
  leaseId: string | null;
  fallbackApplied?: boolean;
  preemption?: {
    applied: boolean;
    triggerPriority: TaskPriority;
    preemptedExecutionId: string | null;
    preemptedTaskId: string | null;
    preemptedWorkerId: string | null;
    previousTicketId: string | null;
    replacementTicketId: string | null;
    recoveryStepId: string | null;
    reasonCode: string | null;
  } | null;
  evaluations: DispatchWorkerEvaluation[];
  // R6-7: §14.9 scheduler event fields
  readySet?: readonly string[];
  selectedNodeIds?: readonly string[];
  orderingPolicyVersion?: string;
  workerPoolSnapshotRef?: string;
}
