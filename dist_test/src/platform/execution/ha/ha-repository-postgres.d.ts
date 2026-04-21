/**
 * PostgreSQL HA Repository
 *
 * Implements HaRepository for multi-node PostgreSQL-backed HA state.
 * Uses PostgreSQL advisory locks for leader election.
 */
import type { AsyncSqlDatabase } from "../../state-evidence/truth/async-sql-database.js";
import type { HaRepository, LeaderActionAuditEntry } from "./ha-repository.js";
import type { CoordinatorNode, CoordinatorNodeStatus, FailoverDecision, LeaderLease, LeadershipEpoch } from "./types.js";
export declare class PostgresHaRepository implements HaRepository {
    private readonly db;
    private readonly coordinatorId;
    private readonly lockId;
    constructor(db: AsyncSqlDatabase, coordinatorId: string, lockNamespace?: string);
    upsertNode(node: CoordinatorNode): Promise<void>;
    getNode(nodeId: string): Promise<CoordinatorNode | undefined>;
    listNodes(status?: CoordinatorNodeStatus): Promise<CoordinatorNode[]>;
    updateNodeHeartbeat(nodeId: string, status?: CoordinatorNodeStatus): Promise<void>;
    deleteNode(nodeId: string): Promise<void>;
    insertLease(lease: LeaderLease): Promise<void>;
    updateLeaseStatus(leaseId: string, status: LeaderLease["status"]): Promise<void>;
    updateLeaseExpiration(leaseId: string, expiresAt: string): Promise<void>;
    getActiveLease(): Promise<LeaderLease | undefined>;
    getLeaseByNodeId(nodeId: string): Promise<LeaderLease | undefined>;
    getLeaseById(leaseId: string): Promise<LeaderLease | undefined>;
    getExpiredLeases(): Promise<LeaderLease[]>;
    getActiveLeaseByNode(nodeId: string): Promise<LeaderLease | undefined>;
    insertEpoch(epoch: LeadershipEpoch): Promise<void>;
    updateEpochEnd(epochNumber: number, endedAt: string, cause: string): Promise<void>;
    getLatestEpoch(): Promise<LeadershipEpoch | undefined>;
    listEpochs(limit?: number): Promise<LeadershipEpoch[]>;
    insertFailoverDecision(decision: FailoverDecision): Promise<void>;
    listFailoverDecisions(limit?: number): Promise<FailoverDecision[]>;
    recordActionAudit(entry: LeaderActionAuditEntry): Promise<void>;
    getStaleNodes(thresholdMs: number): Promise<CoordinatorNode[]>;
    tryAcquireAdvisoryLock(): Promise<boolean>;
    releaseAdvisoryLock(): Promise<void>;
    private mapRowToNode;
    private mapRowToLease;
    private mapRowToEpoch;
    private mapRowToFailoverDecision;
}
