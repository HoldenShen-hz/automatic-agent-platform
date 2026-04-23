/**
 * @fileoverview Hot Upgrade Service (Async)
 *
 * Async version of HotUpgradeService that uses HotUpgradeRepository for data access.
 * Provides true zero-downtime upgrade orchestration with async/await support.
 *
 * @see docs_zh/contracts/ha_coordinator_and_leader_election_contract.md
 * @see docs_zh/contracts/task_lease_and_fencing_contract.md
 * @see docs_zh/contracts/release_rollout_and_rollback_contract.md
 */
import type { AsyncSqlDatabase } from "../../state-evidence/truth/async-sql-database.js";
import type { HotUpgradeRepository } from "./hot-upgrade-repository.js";
import type { UpgradePlan, UpgradeBatch, VersionCompatibility, RollbackTrigger, UpgradeProgress, UpgradePolicy, UpgradeTarget, HealthCheckResult, UpgradeStatus } from "./hot-upgrade-service.js";
export interface HotUpgradeServiceAsyncOptions {
    defaultPolicy?: Partial<UpgradePolicy>;
}
export declare class HotUpgradeServiceAsync {
    private readonly db;
    private readonly repo;
    private readonly defaultPolicy;
    constructor(db: AsyncSqlDatabase, repo: HotUpgradeRepository, options?: HotUpgradeServiceAsyncOptions);
    registerVersionCompatibility(compat: VersionCompatibility): Promise<void>;
    getVersionCompatibility(fromVersion: string, toVersion: string): Promise<VersionCompatibility | null>;
    isUpgradeSafe(fromVersion: string, toVersion: string): Promise<{
        safe: boolean;
        compatibilityLevel: "full" | "n_minus_1" | "incompatible";
        requiresMigration: boolean;
        supportsRollback: boolean;
        reasonCode: string;
    }>;
    createUpgradePlan(upgradeId: string, targets: UpgradeTarget[], policy?: Partial<UpgradePolicy>): Promise<UpgradePlan>;
    getUpgradePlan(planId: string): Promise<UpgradePlan | null>;
    getUpgradePlansByStatus(status: UpgradeStatus): Promise<UpgradePlan[]>;
    private computeBatches;
    startUpgrade(planId: string): Promise<{
        started: boolean;
        upgradeId: string | null;
        firstBatch: UpgradeBatch | null;
        reasonCode: string | null;
    }>;
    startBatch(batchId: string): Promise<{
        started: boolean;
        batch: UpgradeBatch | null;
        reasonCode: string | null;
    }>;
    completeBatch(batchId: string, healthChecks: HealthCheckResult[]): Promise<{
        completed: boolean;
        batch: UpgradeBatch | null;
        allPassed: boolean;
        nextBatch: UpgradeBatch | null;
        triggerRollback: boolean;
    }>;
    triggerRollback(upgradeId: string, reason: RollbackTrigger["reasonCode"], message: string): Promise<{
        triggered: boolean;
        triggerRecord: RollbackTrigger | null;
    }>;
    getUpgradeProgress(upgradeId: string): Promise<UpgradeProgress | null>;
    recordAudit(upgradeId: string, eventType: string, actor: string, message: string, details: Record<string, unknown>): Promise<void>;
    getUpgradeAuditLog(upgradeId: string, limit?: number): Promise<Array<{
        eventType: string;
        actor: string;
        message: string;
        occurredAt: string;
    }>>;
    private buildDefaultHealthGates;
    private getUpgradePlanByBatch;
}
