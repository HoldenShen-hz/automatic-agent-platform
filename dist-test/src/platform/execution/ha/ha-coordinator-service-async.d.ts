/**
 * @fileoverview Async HA Coordinator Service using Repository Pattern
 *
 * This is the async version of HaCoordinatorService that uses HaRepository
 * for data access, enabling both SQLite and PostgreSQL backends.
 *
 * Provides:
 * - Multi-coordinator leader election with authoritative backend
 * - Leadership epoch tracking and fencing
 * - Failover decision making
 * - Follower restriction enforcement for leader-authority-only actions
 */
import type { HaRepository } from "./ha-repository.js";
import type { CoordinatorNode, CoordinatorNodeStatus, FailoverDecision, HaCoordinatorServiceOptions, LeaderActionAuthority, LeaderActionAuthorization, LeaderLease, LeadershipAcquisitionInput, LeadershipEpoch, LeadershipQueryResult, LeadershipRenewalInput } from "./types.js";
import { DEFAULT_LEASE_TTL_MS, EPOCH_FENCING_TOKEN_START, MAX_LEASE_TTL_MS, MIN_LEASE_TTL_MS } from "./types.js";
export { DEFAULT_LEASE_TTL_MS, EPOCH_FENCING_TOKEN_START, MAX_LEASE_TTL_MS, MIN_LEASE_TTL_MS };
export type { CoordinatorNode, CoordinatorNodeStatus, FailoverDecision, HaCoordinatorServiceOptions, LeaderActionAuthority, LeaderActionAuthorization, LeaderLease, LeadershipAcquisitionInput, LeadershipEpoch, LeadershipQueryResult, LeadershipRenewalInput, } from "./types.js";
/**
 * Options for HaCoordinatorServiceAsync
 */
export interface HaCoordinatorServiceAsyncOptions extends HaCoordinatorServiceOptions {
    /** Coordinator ID for this node (used in PostgreSQL advisory lock) */
    coordinatorId?: string;
}
export declare class HaCoordinatorServiceAsync {
    private readonly repo;
    private readonly defaultTtlMs;
    private readonly strictLeaderAuthority;
    private readonly fencingTokenCounter;
    private readonly coordinatorId;
    constructor(repo: HaRepository, options?: HaCoordinatorServiceAsyncOptions);
    registerNode(nodeId: string, region: string, metadata?: Record<string, unknown>): Promise<CoordinatorNode>;
    getNode(nodeId: string): Promise<CoordinatorNode | null>;
    listNodes(status?: CoordinatorNodeStatus): Promise<CoordinatorNode[]>;
    updateNodeHeartbeat(nodeId: string, status?: CoordinatorNodeStatus): Promise<CoordinatorNode | null>;
    removeNode(nodeId: string): Promise<boolean>;
    acquireLeadership(input: LeadershipAcquisitionInput): Promise<{
        acquired: boolean;
        lease: LeaderLease | null;
        epoch: number;
        fencingToken: number;
        cause?: string;
    }>;
    renewLeadership(input: LeadershipRenewalInput): Promise<{
        renewed: boolean;
        lease: LeaderLease | null;
        fencingToken: number;
    }>;
    releaseLeadership(nodeId: string): Promise<boolean>;
    getCurrentLeader(): Promise<CoordinatorNode | null>;
    getActiveLease(): Promise<LeaderLease | null>;
    queryLeadership(): Promise<LeadershipQueryResult>;
    authorizeAction(requestingNodeId: string, actionType: string, requiredAuthority: LeaderActionAuthority): Promise<LeaderActionAuthorization>;
    getLatestEpoch(): Promise<LeadershipEpoch>;
    listEpochs(limit?: number): Promise<LeadershipEpoch[]>;
    triggerFailover(cause: FailoverDecision["cause"], forceNodeId?: string): Promise<FailoverDecision>;
    getFailoverHistory(limit?: number): Promise<FailoverDecision[]>;
    verifyWriteAuthority(presentedFencingToken: number): boolean;
    purgeExpiredLeases(): Promise<number>;
    purgeOldFailoverDecisions(olderThanDays?: number): Promise<number>;
    private nextFencingToken;
    private recordActionAudit;
}
