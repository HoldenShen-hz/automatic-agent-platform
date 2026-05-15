/**
 * Hot Upgrade Repository Interface
 *
 * Abstracts all hot upgrade-related database operations behind a repository interface,
 * enabling both SQLite (single-node) and PostgreSQL (multi-node HA) backends.
 */

import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AsyncSqlDatabase } from "../../five-plane-state-evidence/truth/async-sql-database.js";
import type {
  SqliteAuthoritativeStorageBackendHandle,
  PostgresAuthoritativeStorageBackendHandle,
} from "../../five-plane-state-evidence/truth/storage-backend-factory.js";
import type { UpgradePlan, UpgradeBatch, VersionCompatibility, RollbackTrigger, UpgradeProgress, HealthGateConfig, HealthCheckResult } from "./hot-upgrade-service.js";
import { SqliteHotUpgradeRepository } from "./hot-upgrade-repository-sqlite.js";
import { PostgresHotUpgradeRepository } from "./hot-upgrade-repository-postgres.js";

export type { UpgradePlan, UpgradeBatch, VersionCompatibility, RollbackTrigger, UpgradeProgress, HealthGateConfig, HealthCheckResult } from "./hot-upgrade-service.js";

export interface HotUpgradeRepository {
  // Version Compatibility
  upsertVersionCompatibility(compat: VersionCompatibility): Promise<void>;
  getVersionCompatibility(fromVersion: string, toVersion: string): Promise<VersionCompatibility | null>;

  // Upgrade Plans
  insertUpgradePlan(plan: UpgradePlan): Promise<void>;
  updateUpgradePlanStatus(planId: string, status: string, updatedFields?: { startedAt?: string; completedAt?: string; rollbackTriggeredAt?: string; rollbackReason?: string }): Promise<void>;
  getUpgradePlan(planId: string): Promise<UpgradePlan | null>;
  listUpgradePlansByStatus(status: string): Promise<UpgradePlan[]>;

  // Upgrade Batches
  insertUpgradeBatch(batch: UpgradeBatch): Promise<void>;
  updateUpgradeBatch(batchId: string, status: string, completedAt: string | null, healthChecks: HealthCheckResult[]): Promise<void>;
  getUpgradeBatch(batchId: string): Promise<UpgradeBatch | null>;
  listUpgradeBatchesByPlan(upgradeId: string): Promise<UpgradeBatch[]>;

  // Rollback Triggers
  insertRollbackTrigger(trigger: RollbackTrigger): Promise<void>;
  listRollbackTriggersByUpgrade(upgradeId: string): Promise<RollbackTrigger[]>;

  // Audit
  insertUpgradeAudit(entry: UpgradeAuditEntry): Promise<void>;
  listUpgradeAudits(upgradeId: string, limit?: number): Promise<UpgradeAuditEntry[]>;
}

export interface UpgradeAuditEntry {
  id: string;
  upgradeId: string;
  eventType: string;
  actor: string;
  message: string;
  details: Record<string, unknown> | null;
  occurredAt: string;
}

// ── Repository Factory ────────────────────────────────────────────────────────

export type AnyStorageBackendHandle = SqliteAuthoritativeStorageBackendHandle | PostgresAuthoritativeStorageBackendHandle;

/**
 * Creates the appropriate HotUpgrade repository based on the storage backend type.
 *
 * - SQLite backend: uses SqliteHotUpgradeRepository (sync operations)
 * - PostgreSQL backend: uses PostgresHotUpgradeRepository (async operations)
 *
 * @param backend - The storage backend handle (SQLite or PostgreSQL)
 * @returns A HotUpgradeRepository implementation for the given backend
 */
export function createHotUpgradeRepository(backend: AnyStorageBackendHandle): HotUpgradeRepository {
  if (backend.driver === "postgres") {
    return new PostgresHotUpgradeRepository(backend.asyncSql as AsyncSqlDatabase);
  }
  return new SqliteHotUpgradeRepository(backend.sql as AuthoritativeSqlDatabase);
}
