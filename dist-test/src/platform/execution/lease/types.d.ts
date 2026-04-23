import type { ExecutionLeaseRecord } from "../../contracts/types/domain.js";
export declare const DEFAULT_LEASE_TTL_MS = 10000;
export declare const MIN_LEASE_TTL_MS = 5000;
export declare const MAX_LEASE_TTL_MS = 30000;
export declare const DEFAULT_RENEWAL_INTERVAL_MS = 3000;
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
export interface ExecutionWriteValidationResult {
    allowed: boolean;
    reasonCode: "lease_not_found" | "no_active_lease" | "stale_fencing_token" | "worker_mismatch" | "lease_mismatch" | null;
    authoritativeFencingToken: number;
    activeLeaseId: string | null;
}
