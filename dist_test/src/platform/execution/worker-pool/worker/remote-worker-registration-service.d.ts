import { AuthoritativeTaskStore } from "../../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../state-evidence/truth/authoritative-sql-database.js";
export interface RemoteWorkerRegistrationServiceOptions {
    challengeTtlMs?: number;
    allowedCapabilities?: string[];
}
export interface IssueRemoteWorkerRegistrationChallengeInput {
    workerId: string;
    requestedCapabilities: string[];
    occurredAt?: string;
    ttlMs?: number;
}
export interface IssueRemoteWorkerRegistrationChallengeDecision {
    issued: boolean;
    reasonCode: "capability_not_allowed" | "challenge_ttl_invalid" | null;
    challengeId: string | null;
    challengeToken: string | null;
    expiresAt: string | null;
    allowedCapabilities: string[];
    rejectedCapabilities: string[];
}
export interface CompleteRemoteWorkerRegistrationInput {
    workerId: string;
    challengeId: string;
    challengeToken: string;
    capabilities: string[];
    maxConcurrency: number;
    queueAffinity?: string | null;
    isolationLevel?: "standard" | "hardened" | "strict" | null;
    repoVersion?: string | null;
    runtimeInstanceId?: string | null;
    restartedFromRuntimeInstanceId?: string | null;
    remoteSessionStatus?: "connecting" | "connected" | "reconnecting" | "degraded" | "failed" | "viewer_only" | null;
    lastAcknowledgedStreamOffset?: string | null;
    sessionConsistencyCheckStatus?: "unknown" | "passed" | "mismatch" | null;
    sessionConsistencyCheckedAt?: string | null;
    workspaceSyncStatus?: "unknown" | "aligned" | "conflict" | null;
    workspaceSyncCheckedAt?: string | null;
    occurredAt?: string;
}
export interface CompleteRemoteWorkerRegistrationDecision {
    accepted: boolean;
    reasonCode: "challenge_not_found" | "challenge_worker_mismatch" | "challenge_expired" | "challenge_already_used" | "challenge_token_invalid" | "capability_not_allowed" | null;
    workerId: string;
    registrationVerifiedAt: string | null;
    registrationChallengeId: string | null;
    allowedCapabilities: string[];
    rejectedCapabilities: string[];
}
export declare class RemoteWorkerRegistrationService {
    private readonly db;
    private readonly store;
    private readonly workers;
    private readonly allowedCapabilities;
    private readonly challengeTtlMs;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, options?: RemoteWorkerRegistrationServiceOptions);
    issueChallenge(input: IssueRemoteWorkerRegistrationChallengeInput): IssueRemoteWorkerRegistrationChallengeDecision;
    completeRegistration(input: CompleteRemoteWorkerRegistrationInput): CompleteRemoteWorkerRegistrationDecision;
}
