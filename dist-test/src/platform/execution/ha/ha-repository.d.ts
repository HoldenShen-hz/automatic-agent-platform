/**
 * HA Repository Interface
 *
 * Abstracts all HA-related database operations behind a repository interface,
 * enabling both SQLite (single-node) and PostgreSQL (multi-node HA) backends.
 */
import type { SqliteAuthoritativeStorageBackendHandle, PostgresAuthoritativeStorageBackendHandle } from "../../state-evidence/truth/storage-backend-factory.js";
import type { CoordinatorNode, CoordinatorNodeStatus, FailoverDecision, LeaderLease, LeadershipEpoch } from "./types.js";
export interface HaRepository {
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
}
export interface LeaderActionAuditEntry {
    id: string;
    actionType: string;
    requestingNodeId: string;
    leaderNodeId: string | null;
    epoch: number;
    fencingToken: number;
    authorized: boolean;
    reasonCode: string;
    performedAt: string;
}
export type AnyStorageBackendHandle = SqliteAuthoritativeStorageBackendHandle | PostgresAuthoritativeStorageBackendHandle;
/**
 * Creates the appropriate HA repository based on the storage backend type.
 *
 * - SQLite backend: uses SqliteHaRepository (sync operations)
 * - PostgreSQL backend: uses PostgresHaRepository (async operations with advisory locks)
 *
 * @param backend - The storage backend handle (SQLite or PostgreSQL)
 * @param coordinatorId - Optional coordinator ID for PostgreSQL advisory locks
 * @returns A HaRepository implementation for the given backend
 */
export declare function createHaRepository(backend: AnyStorageBackendHandle, coordinatorId?: string): HaRepository;
