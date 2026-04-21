export interface DispatchReconcileCliEnvConfig {
    action: "scan" | "repair";
    occurredAt: string | null;
}
export interface LeaseHandoverCliEnvConfig {
    leaseId: string;
    workerId: string;
    newWorkerId: string;
    ttlMs: number;
    reasonCode: string | null;
    occurredAt: string | null;
}
export interface EventOpsCliEnvConfig {
    dbPath: string;
    consumerId: string | null;
}
export interface OrphanCleanupCliEnvConfig {
    action: "scan" | "repair";
    occurredAt: string | null;
}
export interface ReplayRecoveryCliEnvConfig {
    dbPath: string;
    kind: "task" | "execution";
    taskId: string | null;
    executionId: string | null;
}
export interface ProfileHomeCliEnvConfig {
    create: boolean;
}
export interface AuthoritativeStorageAdminCliEnvConfig {
    dbPath: string;
    action: "summary" | "migrate" | "plan" | "status" | "up" | "down";
}
export declare function loadDispatchReconcileCliEnv(env?: NodeJS.ProcessEnv): DispatchReconcileCliEnvConfig;
export declare function loadLeaseHandoverCliEnv(env?: NodeJS.ProcessEnv): LeaseHandoverCliEnvConfig;
export declare function loadEventOpsCliEnv(env?: NodeJS.ProcessEnv): EventOpsCliEnvConfig;
export declare function loadOrphanCleanupCliEnv(env?: NodeJS.ProcessEnv): OrphanCleanupCliEnvConfig;
export declare function loadReplayRecoveryCliEnv(env?: NodeJS.ProcessEnv): ReplayRecoveryCliEnvConfig;
export declare function loadProfileHomeCliEnv(env?: NodeJS.ProcessEnv): ProfileHomeCliEnvConfig;
export declare function loadAuthoritativeStorageAdminCliEnv(env?: NodeJS.ProcessEnv): AuthoritativeStorageAdminCliEnvConfig;
