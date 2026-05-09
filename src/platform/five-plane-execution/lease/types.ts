import type { ExecutionLeaseRecord, WorkerIsolationLevel } from "../../contracts/types/domain.js";

export const DEFAULT_LEASE_TTL_MS = 10_000;
export const MIN_LEASE_TTL_MS = 5_000;
export const MAX_LEASE_TTL_MS = 30_000;
export const DEFAULT_RENEWAL_INTERVAL_MS = 3_000;

export interface AcquireExecutionLeaseInput {
  executionId: string;
  workerId: string;
  ttlMs: number;
  queueName?: string | null;
  occurredAt?: string;
}

export interface RenewExecutionLeaseInput {
  leaseId: string;
  workerId: string;
  ttlMs: number;
  occurredAt?: string;
}

export interface ReleaseExecutionLeaseInput {
  leaseId: string;
  workerId: string;
  reasonCode?: string | null;
  occurredAt?: string;
}

export interface HandoverExecutionLeaseInput {
  leaseId: string;
  workerId: string;
  newWorkerId: string;
  ttlMs: number;
  // R13-20: Verification requirements for lease handover
  requiredCapabilities?: string[];
  requiredIsolationLevel?: WorkerIsolationLevel | null;
  requiredRepoVersion?: string | null;
  reasonCode?: string | null;
  occurredAt?: string;
}

export interface ValidateExecutionWriteInput {
  executionId: string;
  workerId: string;
  fencingToken: number;
  leaseId?: string | null;
  occurredAt?: string;
}

export interface ExecutionLeaseDecision {
  outcome: "granted" | "blocked" | "released" | "renewed";
  reasonCode: string | null;
  lease: ExecutionLeaseRecord | null;
}

export interface ExecutionLeaseHandoverDecision {
  outcome: "handed_over" | "blocked";
  reasonCode: string | null;
  previousLease: ExecutionLeaseRecord | null;
  lease: ExecutionLeaseRecord | null;
}

// R6-21 FIX: Added "lease_expired" to reasonCode for proper TTL-based validation
export interface ExecutionWriteValidationResult {
  allowed: boolean;
  reasonCode: "lease_not_found" | "no_active_lease" | "stale_fencing_token" | "worker_mismatch" | "lease_mismatch" | "lease_expired" | null;
  authoritativeFencingToken: number;
  activeLeaseId: string | null;
}
