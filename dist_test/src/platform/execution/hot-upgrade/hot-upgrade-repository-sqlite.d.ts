/**
 * SQLite Hot Upgrade Repository
 *
 * Implements HotUpgradeRepository for single-node SQLite-backed hot upgrade state.
 * Uses synchronous operations via AuthoritativeSqlDatabase.
 */
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { HotUpgradeRepository, UpgradeAuditEntry } from "./hot-upgrade-repository.js";
import type { UpgradePlan, UpgradeBatch, VersionCompatibility, RollbackTrigger, HealthCheckResult } from "./hot-upgrade-service.js";
export declare class SqliteHotUpgradeRepository implements HotUpgradeRepository {
    private readonly db;
    constructor(db: AuthoritativeSqlDatabase);
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
    private mapUpgradePlan;
    private mapBatch;
    private mapCompatibility;
    private mapRollbackTrigger;
    private mapAudit;
}
