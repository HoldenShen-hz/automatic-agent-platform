/**
 * Hot Upgrade Repository Interface
 *
 * Abstracts all hot upgrade-related database operations behind a repository interface,
 * enabling both SQLite (single-node) and PostgreSQL (multi-node HA) backends.
 */
import type { SqliteAuthoritativeStorageBackendHandle, PostgresAuthoritativeStorageBackendHandle } from "../../state-evidence/truth/storage-backend-factory.js";
import type { UpgradePlan, UpgradeBatch, VersionCompatibility, RollbackTrigger, HealthCheckResult } from "./hot-upgrade-service.js";
export type { UpgradePlan, UpgradeBatch, VersionCompatibility, RollbackTrigger, UpgradeProgress, HealthGateConfig, HealthCheckResult } from "./hot-upgrade-service.js";
export interface HotUpgradeRepository {
    upsertVersionCompatibility(compat: VersionCompatibility): Promise<void>;
    getVersionCompatibility(fromVersion: string, toVersion: string): Promise<VersionCompatibility | null>;
    insertUpgradePlan(plan: UpgradePlan): Promise<void>;
    updateUpgradePlanStatus(planId: string, status: string, updatedFields?: {
        startedAt?: string;
        completedAt?: string;
        rollbackTriggeredAt?: string;
        rollbackReason?: string;
    }): Promise<void>;
    getUpgradePlan(planId: string): Promise<UpgradePlan | null>;
    listUpgradePlansByStatus(status: string): Promise<UpgradePlan[]>;
    insertUpgradeBatch(batch: UpgradeBatch): Promise<void>;
    updateUpgradeBatch(batchId: string, status: string, completedAt: string | null, healthChecks: HealthCheckResult[]): Promise<void>;
    getUpgradeBatch(batchId: string): Promise<UpgradeBatch | null>;
    listUpgradeBatchesByPlan(upgradeId: string): Promise<UpgradeBatch[]>;
    insertRollbackTrigger(trigger: RollbackTrigger): Promise<void>;
    listRollbackTriggersByUpgrade(upgradeId: string): Promise<RollbackTrigger[]>;
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
export declare function createHotUpgradeRepository(backend: AnyStorageBackendHandle): HotUpgradeRepository;
