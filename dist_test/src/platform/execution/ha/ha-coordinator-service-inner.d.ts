/**
 * @fileoverview HA Coordinator and Leader Election Service
 *
 * Provides:
 * - Multi-coordinator leader election with authoritative backend
 * - Leadership epoch tracking and fencing
 * - Failover decision making
 * - Follower restriction enforcement for leader-authority-only actions
 *
 * @see docs_zh/contracts/ha_coordinator_and_leader_election_contract.md
 * @see docs_zh/contracts/task_lease_and_fencing_contract.md
 */
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { type CoordinatorNode, type CoordinatorNodeStatus, type FailoverDecision, type HaCoordinatorServiceOptions, type LeaderActionAuthorization, type LeaderActionAuthority, type LeaderLease, type LeadershipAcquisitionInput, type LeadershipEpoch, type LeadershipQueryResult, type LeadershipRenewalInput } from "./types.js";
export { DEFAULT_LEASE_TTL_MS, EPOCH_FENCING_TOKEN_START, HA_COORDINATOR_DDL, MAX_LEASE_TTL_MS, MIN_LEASE_TTL_MS, } from "./types.js";
export type { CoordinatorNode, CoordinatorNodeStatus, FailoverDecision, HaCoordinatorServiceOptions, LeaderActionAuthorization, LeaderActionAuthority, LeaderLease, LeadershipAcquisitionInput, LeadershipEpoch, LeadershipQueryResult, LeadershipRenewalInput, } from "./types.js";
export declare class HaCoordinatorService {
    private readonly db;
    private readonly defaultTtlMs;
    private readonly strictLeaderAuthority;
    private readonly fencingTokenCounter;
    constructor(db: AuthoritativeSqlDatabase, options?: HaCoordinatorServiceOptions);
    registerNode(nodeId: string, region: string, metadata?: Record<string, unknown>): CoordinatorNode;
    getNode(nodeId: string): CoordinatorNode | null;
    listNodes(status?: CoordinatorNodeStatus): CoordinatorNode[];
    updateNodeHeartbeat(nodeId: string, status?: CoordinatorNodeStatus): CoordinatorNode | null;
    removeNode(nodeId: string): boolean;
    /**
     * Attempt to acquire leadership. If forceAcquire is true, preempt any existing leader.
     */
    acquireLeadership(input: LeadershipAcquisitionInput): {
        acquired: boolean;
        lease: LeaderLease | null;
        epoch: number;
        fencingToken: number;
        cause?: string;
    };
    renewLeadership(input: LeadershipRenewalInput): {
        renewed: boolean;
        lease: LeaderLease | null;
        fencingToken: number;
    };
    releaseLeadership(nodeId: string): boolean;
    getCurrentLeader(): CoordinatorNode | null;
    getActiveLease(): LeaderLease | null;
    queryLeadership(): LeadershipQueryResult;
    /**
     * Check if a node is authorized to perform a leader-authority-only action.
     * In strict mode, only the current leader can perform such actions.
     */
    authorizeAction(requestingNodeId: string, actionType: string, requiredAuthority: LeaderActionAuthority): LeaderActionAuthorization;
    getLatestEpoch(): LeadershipEpoch;
    listEpochs(limit?: number): LeadershipEpoch[];
    /**
     * Perform a failover, selecting a new leader from active nodes.
     */
    triggerFailover(cause: FailoverDecision["cause"], forceNodeId?: string): FailoverDecision;
    getFailoverHistory(limit?: number): FailoverDecision[];
    /**
     * Verify that a write operation comes from the current epoch.
     * Returns true if the write is valid (current fencing token matches).
     */
    verifyWriteAuthority(presentedFencingToken: number): boolean;
    purgeExpiredLeases(): number;
    purgeOldFailoverDecisions(olderThanDays?: number): number;
    private nextFencingToken;
    private recordActionAudit;
}
