import type { AgentExecutionRecord, DispatchTarget, DispatchDecisionTrace, DispatchWorkerEvaluation, DispatchWorkerRejectionReason, ExecutionTicketRecord, RemoteAvailability, TaskPriority, WorkerIsolationLevel } from "../../contracts/types/domain.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { RegisteredWorkerView } from "../worker-pool/worker-registry-service.js";
export interface CreateExecutionTicketInput {
    executionId: string;
    priority?: TaskPriority;
    queueName?: string | null;
    dispatchTarget?: DispatchTarget | null;
    requiredIsolationLevel?: WorkerIsolationLevel | null;
    requiredRepoVersion?: string | null;
    requiredCapabilities?: string[];
    dispatchAfter?: string | null;
    occurredAt?: string;
}
export interface DispatchExecutionOptions {
    queueName?: string | null;
    preferredWorkerId?: string | null;
    leaseTtlMs: number;
    includeDegraded?: boolean;
    occurredAt?: string;
}
export interface DispatchQueueAvailabilitySnapshot {
    state: "available" | "degraded" | "unavailable";
    reasonCode?: string | null;
}
export interface ExecutionTicketDecision {
    outcome: "created" | "exists";
    ticket: ExecutionTicketRecord;
}
export interface DispatchExecutionDecision {
    outcome: "dispatched" | "no_ticket" | "no_worker" | "blocked";
    reasonCode: string | null;
    ticket: ExecutionTicketRecord | null;
    worker: RegisteredWorkerView | null;
    leaseId: string | null;
    trace: DispatchDecisionTrace | null;
}
export declare const DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS: {
    readonly memoryHighWatermarkMb: number;
    readonly eventLoopLagThresholdMs: number;
};
export declare const AFFINITY_SELECTION_BONUS = 0.35;
export declare const LOAD_SKEW_SELECTION_PENALTY = 0.75;
export declare function isRemoteSessionReadyForDispatch(worker: RegisteredWorkerView): boolean;
export declare function normalizeStringArray(values: string[]): string[];
export declare function parseJsonArray(value: string, onError?: (message: string) => void): string[];
export declare function resolveDispatchTarget(target: DispatchTarget | null | undefined): DispatchTarget;
export declare function resolveRequiredIsolationLevel(level: WorkerIsolationLevel | null | undefined): WorkerIsolationLevel;
export declare function resolveRequiredRepoVersion(value: string | null | undefined): string | null;
export declare function meetsIsolationRequirement(workerIsolationLevel: WorkerIsolationLevel, requiredIsolationLevel: WorkerIsolationLevel): boolean;
export declare function resolveRemoteAvailability(dispatchTarget: DispatchTarget, evaluations: DispatchWorkerEvaluation[]): RemoteAvailability | null;
export declare function resolveRemoteRepoVersionReason(dispatchTarget: DispatchTarget, evaluations: DispatchWorkerEvaluation[], requiredRepoVersion: string | null): string | null;
export declare function resolveRemoteSessionReason(dispatchTarget: DispatchTarget, evaluations: DispatchWorkerEvaluation[]): string | null;
export declare function resolveRemoteTrustReason(dispatchTarget: DispatchTarget, evaluations: DispatchWorkerEvaluation[]): string | null;
export declare function selectWorkersForDispatch(dispatchTarget: DispatchTarget, eligibleWorkers: RegisteredWorkerView[], remoteAvailability: RemoteAvailability | null, remoteTrustReason: string | null, remoteSessionReason: string | null, remoteRepoVersionReason: string | null): {
    workers: RegisteredWorkerView[];
    reasonCode: string | null;
    fallbackApplied: boolean;
};
export declare function toWorkerEvaluation(worker: RegisteredWorkerView, accepted: boolean, rejectionReason: DispatchWorkerRejectionReason | null, missingCapabilities: string[]): DispatchWorkerEvaluation;
export declare function buildDispatchAgentExecutionRecord(store: AuthoritativeTaskStore, execution: NonNullable<ReturnType<AuthoritativeTaskStore["getExecution"]>>, occurredAt: string, updates: {
    taskId: string;
    status?: string;
    planJson?: string;
    lastDecisionJson?: string | null;
    progressMessage?: string | null;
}): AgentExecutionRecord;
export declare function resolveDispatchBackpressureReason(ticket: ExecutionTicketRecord, snapshot: {
    degradationMode: string;
    queueGovernance: {
        starvationDetected: boolean;
    };
} | null): string | null;
export declare function isElevatedPriority(priority: TaskPriority): boolean;
