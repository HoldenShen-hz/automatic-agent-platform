/**
 * HA Repository Interface
 *
 * Abstracts all HA-related database operations behind a repository interface,
 * enabling both SQLite (single-node) and PostgreSQL (multi-node HA) backends.
 */

import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AsyncSqlDatabase } from "../../five-plane-state-evidence/truth/async-sql-database.js";
import type {
  SqliteAuthoritativeStorageBackendHandle,
  PostgresAuthoritativeStorageBackendHandle,
} from "../../five-plane-state-evidence/truth/storage-backend-factory.js";
import type { CoordinatorNode, CoordinatorNodeStatus, FailoverDecision, LeaderLease, LeadershipEpoch } from "./types.js";
import { SqliteHaRepository } from "./ha-repository-sqlite.js";
import { PostgresHaRepository } from "./ha-repository-postgres.js";

export interface HaRepository {
  // Node Management
  upsertNode(node: CoordinatorNode): Promise<void>;
  getNode(nodeId: string): Promise<CoordinatorNode | undefined>;
  listNodes(status?: CoordinatorNodeStatus): Promise<CoordinatorNode[]>;
  updateNodeHeartbeat(nodeId: string, status?: CoordinatorNodeStatus): Promise<void>;
  deleteNode(nodeId: string): Promise<void>;

  // Lease Management
  insertLease(lease: LeaderLease): Promise<void>;
  updateLeaseStatus(leaseId: string, status: LeaderLease["status"]): Promise<void>;
  updateLeaseExpiration(leaseId: string, expiresAt: string): Promise<void>;
  getActiveLease(): Promise<LeaderLease | undefined>;
  getLeaseByNodeId(nodeId: string): Promise<LeaderLease | undefined>;
  getLeaseById(leaseId: string): Promise<LeaderLease | undefined>;
  getExpiredLeases(): Promise<LeaderLease[]>;
  getActiveLeaseByNode(nodeId: string): Promise<LeaderLease | undefined>;

  // Epoch Management
  insertEpoch(epoch: LeadershipEpoch): Promise<void>;
  updateEpochEnd(epochNumber: number, endedAt: string, cause: string): Promise<void>;
  getLatestEpoch(): Promise<LeadershipEpoch | undefined>;
  listEpochs(limit?: number): Promise<LeadershipEpoch[]>;

  // Failover Decisions
  insertFailoverDecision(decision: FailoverDecision): Promise<void>;
  listFailoverDecisions(limit?: number): Promise<FailoverDecision[]>;

  // Leader Action Audit
  recordActionAudit(entry: LeaderActionAuditEntry): Promise<void>;

  // Stale Detection
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

// ── Repository Factory ────────────────────────────────────────────────────────

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
export function createHaRepository(
  backend: AnyStorageBackendHandle,
  coordinatorId?: string,
): HaRepository {
  if (backend.driver === "postgres") {
    if (!coordinatorId) {
      throw new Error("coordinatorId is required for PostgreSQL HA repository");
    }
    return new PostgresHaRepository(backend.asyncSql as AsyncSqlDatabase, coordinatorId as string);
  }
  return new SqliteHaRepository(backend.sql as AuthoritativeSqlDatabase);
}
