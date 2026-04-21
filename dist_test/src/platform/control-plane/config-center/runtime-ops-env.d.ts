/** Log levels for remote worker logging */
type RemoteLogLevel = "debug" | "info" | "warn" | "error";
/**
 * Payload structure for remote log entries sent from workers.
 */
export interface RemoteLogPayload {
    level: RemoteLogLevel;
    message: string;
    context?: Record<string, unknown> | null;
    occurredAt?: string;
}
/**
 * Configuration for dispatch execution CLI operations.
 * Used by coordinators to dispatch execution requests to workers.
 */
export interface DispatchExecutionCliEnvConfig {
    dbPath: string | undefined;
    executionId: string;
    priority: "low" | "normal" | "high" | "urgent" | undefined;
    queueName: string | null;
    dispatchTarget: "any" | "local_only" | "prefer_remote" | "require_remote" | undefined;
    requiredIsolationLevel: "standard" | "hardened" | "strict" | undefined;
    requiredRepoVersion: string | null;
    requiredCapabilities: string[];
    dispatchAfter: string | null;
    createOnly: boolean;
    preferredWorkerId: string | null;
    leaseTtlMs: number;
    includeDegraded: boolean;
}
/**
 * Configuration for worker handshake CLI operations.
 * Used during worker claim and heartbeat interactions with coordinator.
 */
export interface WorkerHandshakeCliEnvConfig {
    dbPath: string | undefined;
    action: "claim" | "heartbeat";
    ticketId: string | undefined;
    executionId: string | undefined;
    workerId: string;
    leaseId: string;
    fencingToken: number;
    leaseTtlMs: number;
    occurredAt: string | undefined;
    cpuPct: number | undefined;
    memoryMb: number | undefined;
    remoteSessionStatus: "connecting" | "connected" | "reconnecting" | "degraded" | "failed" | "viewer_only" | undefined;
    lastAcknowledgedStreamOffset: string | undefined;
    streamResumeSuccessRate: number | undefined;
    credentialRefreshSuccessRate: number | undefined;
    sessionConsistencyCheckStatus: "unknown" | "passed" | "mismatch" | undefined;
    sessionConsistencyCheckedAt: string | undefined;
    workspaceSyncStatus: "unknown" | "aligned" | "conflict" | undefined;
    workspaceSyncCheckedAt: string | undefined;
    saturation: number | undefined;
    activeLeaseCount: number | undefined;
    meanStartupLatencyMs: number | undefined;
    sandboxSuccessRate: number | undefined;
    repoCacheHitRate: number | undefined;
    toolBacklogCount: number | undefined;
    toolCallCount: number | undefined;
    currentStepId: string | undefined;
    lastProgressAt: string | undefined;
    lastToolName: string | undefined;
    runtimeInstanceId: string | undefined;
    restartedFromRuntimeInstanceId: string | undefined;
    progressMessage: string | null;
    remoteLogs: RemoteLogPayload[] | undefined;
}
/**
 * Configuration for worker writeback CLI operations.
 * Used when workers report execution completion back to coordinator.
 */
export interface WorkerWritebackCliEnvConfig {
    dbPath: string | undefined;
    executionId: string;
    workerId: string;
    leaseId: string;
    fencingToken: number;
    terminalStatus: "done" | "failed" | "cancelled";
    occurredAt: string | undefined;
    cpuPct: number | undefined;
    memoryMb: number | undefined;
    toolBacklogCount: number | undefined;
    toolCallCount: number | undefined;
    currentStepId: string | undefined;
    lastProgressAt: string | undefined;
    workspaceSyncStatus: "unknown" | "aligned" | "conflict" | undefined;
    workspaceSyncCheckedAt: string | undefined;
    lastToolName: string | undefined;
    runtimeInstanceId: string | undefined;
    restartedFromRuntimeInstanceId: string | undefined;
    remoteLogs: RemoteLogPayload[] | undefined;
    taskOutputJson: string | null;
    outputsJson: string | null;
    reasonCode: string | null;
    progressMessage: string | null;
}
/**
 * Loads dispatch execution CLI configuration from environment variables.
 * Used by coordinators to dispatch execution requests to workers.
 */
export declare function loadDispatchExecutionCliEnv(env?: NodeJS.ProcessEnv): DispatchExecutionCliEnvConfig;
/**
 * Loads worker handshake CLI configuration from environment variables.
 * Used during worker claim and heartbeat interactions with coordinator.
 */
export declare function loadWorkerHandshakeCliEnv(env?: NodeJS.ProcessEnv): WorkerHandshakeCliEnvConfig;
/**
 * Loads worker writeback CLI configuration from environment variables.
 * Used when workers report execution completion back to coordinator.
 */
export declare function loadWorkerWritebackCliEnv(env?: NodeJS.ProcessEnv): WorkerWritebackCliEnvConfig;
export {};
