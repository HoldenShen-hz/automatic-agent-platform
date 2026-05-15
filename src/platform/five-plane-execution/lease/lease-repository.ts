/**
 * Lease Repository Interface
 *
 * Abstracts all lease-related database operations behind a repository interface,
 * enabling both SQLite (single-node) and PostgreSQL (multi-node) backends.
 */

import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AsyncSqlDatabase } from "../../five-plane-state-evidence/truth/async-sql-database.js";
import type { SqliteAuthoritativeStorageBackendHandle, PostgresAuthoritativeStorageBackendHandle } from "../../five-plane-state-evidence/truth/storage-backend-factory.js";
import type { ExecutionLeaseRecord, LeaseAuditRecord } from "../../contracts/types/domain.js";
import { SqliteLeaseRepository } from "./lease-repository-sqlite.js";
import { PostgresLeaseRepository } from "./lease-repository-postgres.js";

export interface LeaseRepository {
  // Lease Operations
  insertLease(lease: ExecutionLeaseRecord): Promise<void>;
  getLease(leaseId: string): Promise<ExecutionLeaseRecord | undefined>;
  getActiveLeaseForExecution(executionId: string): Promise<ExecutionLeaseRecord | undefined>;
  getLatestFencingToken(executionId: string): Promise<number>;
  listExecutionLeases(executionId: string): Promise<ExecutionLeaseRecord[]>;
  updateLeaseStatus(leaseId: string, status: ExecutionLeaseRecord["status"]): Promise<void>;
  updateLeaseHeartbeat(leaseId: string, lastHeartbeatAt: string): Promise<void>;
  updateLeaseRelease(leaseId: string, releasedAt: string, reasonCode: string | null): Promise<void>;

  // Audit Operations
  insertLeaseAudit(audit: LeaseAuditRecord): Promise<void>;
  listLeaseAudits(executionId: string): Promise<LeaseAuditRecord[]>;
}

// ── Repository Factory ────────────────────────────────────────────────────────

export type AnyStorageBackendHandle = SqliteAuthoritativeStorageBackendHandle | PostgresAuthoritativeStorageBackendHandle;

/**
 * Creates the appropriate Lease repository based on the storage backend type.
 *
 * - SQLite backend: uses SqliteLeaseRepository (sync operations)
 * - PostgreSQL backend: uses PostgresLeaseRepository (async operations)
 *
 * @param backend - The storage backend handle (SQLite or PostgreSQL)
 * @returns A LeaseRepository implementation for the given backend
 */
export function createLeaseRepository(backend: AnyStorageBackendHandle): LeaseRepository {
  if (backend.driver === "postgres") {
    return new PostgresLeaseRepository(backend.asyncSql as AsyncSqlDatabase);
  }
  return new SqliteLeaseRepository(backend.sql as AuthoritativeSqlDatabase);
}
