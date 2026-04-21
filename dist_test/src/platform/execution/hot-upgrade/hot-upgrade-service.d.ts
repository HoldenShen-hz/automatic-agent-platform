/**
 * @fileoverview Hot Upgrade Service
 *
 * Provides true zero-downtime upgrade orchestration:
 * - Version compatibility matrix (N/N-1 compatibility)
 * - Canary deployment with health gates
 * - Blue-green traffic shifting
 * - Rollback trigger monitoring
 * - Step-boundary handover automation
 *
 * @see docs_zh/contracts/ha_coordinator_and_leader_election_contract.md
 * @see docs_zh/contracts/task_lease_and_fencing_contract.md
 * @see docs_zh/contracts/release_rollout_and_rollback_contract.md
 */
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
export type UpgradePhase = "canary" | "rollout" | "full" | "rollback";
export type UpgradeStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";
export type CompatibilityLevel = "full" | "n_minus_1" | "incompatible";
export interface VersionCompatibility {
    fromVersion: string;
    toVersion: string;
    compatibilityLevel: CompatibilityLevel;
    migrationRequired: boolean;
    rollbackSupported: boolean;
}
export interface UpgradeTarget {
    targetId: string;
    targetType: "coordinator" | "worker_pool" | "database" | "config";
    currentVersion: string;
    targetVersion: string;
    healthCheckEndpoint?: string;
}
export interface UpgradeBatch {
    batchId: string;
    upgradeId: string;
    batchNumber: number;
    targetNodes: string[];
    targetVersion: string;
    startedAt: string;
    completedAt: string | null;
    status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
    healthChecks: HealthCheckResult[];
}
export interface HealthCheckResult {
    checkId: string;
    checkType: "worker_health" | "dispatch_routing" | "lease_handover" | "schema_compat" | "custom";
    passed: boolean;
    message: string;
    checkedAt: string;
    details: Record<string, unknown>;
}
export interface UpgradePolicy {
    canaryPercent: number;
    canaryBatches: number;
    batchSize: number;
    healthGates: HealthGateConfig[];
    rollbackOnFailure: boolean;
    maxUpgradeDurationMs: number;
    compatibilityCheckEnabled: boolean;
}
export interface HealthGateConfig {
    gateType: "worker_ready" | "dispatch_healthy" | "lease_stable" | "error_rate" | "latency_pct";
    threshold: number;
    windowSeconds: number;
    operator: "gt" | "lt" | "gte" | "lte" | "eq";
}
export interface UpgradePlan {
    planId: string;
    upgradeId: string;
    createdAt: string;
    targets: UpgradeTarget[];
    batches: UpgradeBatch[];
    policy: UpgradePolicy;
    currentPhase: UpgradePhase;
    status: UpgradeStatus;
    startedAt: string | null;
    completedAt: string | null;
    rollbackTriggeredAt: string | null;
    rollbackReason: string | null;
}
export interface RollbackTrigger {
    triggerId: string;
    upgradeId: string;
    reasonCode: "health_check_failed" | "dispatch_error_rate_high" | "lease_handover_failed" | "manual" | "timeout";
    message: string;
    detectedAt: string;
    metadata: Record<string, unknown>;
}
export interface UpgradeProgress {
    upgradeId: string;
    phase: UpgradePhase;
    status: UpgradeStatus;
    currentBatchNumber: number;
    totalBatches: number;
    completedBatches: number;
    failedBatches: number;
    healthCheckPassRate: number;
    errorRate: number;
    estimatedCompletionMs: number | null;
}
export declare const HOT_UPGRADE_DDL = "\nCREATE TABLE IF NOT EXISTS upgrade_plans (\n  plan_id TEXT PRIMARY KEY,\n  upgrade_id TEXT NOT NULL,\n  created_at TEXT NOT NULL,\n  targets_json TEXT NOT NULL,\n  batches_json TEXT NOT NULL,\n  policy_json TEXT NOT NULL,\n  current_phase TEXT NOT NULL DEFAULT 'canary',\n  status TEXT NOT NULL DEFAULT 'pending',\n  started_at TEXT,\n  completed_at TEXT,\n  rollback_triggered_at TEXT,\n  rollback_reason TEXT\n);\nCREATE INDEX IF NOT EXISTS idx_upgrade_plans_upgrade ON upgrade_plans(upgrade_id);\nCREATE INDEX IF NOT EXISTS idx_upgrade_plans_status ON upgrade_plans(status);\n\nCREATE TABLE IF NOT EXISTS upgrade_batches (\n  batch_id TEXT PRIMARY KEY,\n  upgrade_id TEXT NOT NULL,\n  batch_number INTEGER NOT NULL,\n  target_nodes_json TEXT NOT NULL,\n  target_version TEXT NOT NULL,\n  started_at TEXT NOT NULL,\n  completed_at TEXT,\n  status TEXT NOT NULL DEFAULT 'pending',\n  health_checks_json TEXT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_upgrade_batches_upgrade ON upgrade_batches(upgrade_id);\n\nCREATE TABLE IF NOT EXISTS rollback_triggers (\n  trigger_id TEXT PRIMARY KEY,\n  upgrade_id TEXT NOT NULL,\n  reason_code TEXT NOT NULL,\n  message TEXT NOT NULL,\n  detected_at TEXT NOT NULL,\n  metadata_json TEXT\n);\nCREATE INDEX IF NOT EXISTS idx_rollback_triggers_upgrade ON rollback_triggers(upgrade_id);\n\nCREATE TABLE IF NOT EXISTS version_compatibility (\n  id TEXT PRIMARY KEY,\n  from_version TEXT NOT NULL,\n  to_version TEXT NOT NULL,\n  compatibility_level TEXT NOT NULL,\n  migration_required INTEGER NOT NULL DEFAULT 0,\n  rollback_supported INTEGER NOT NULL DEFAULT 1,\n  created_at TEXT NOT NULL,\n  UNIQUE(from_version, to_version)\n);\nCREATE INDEX IF NOT EXISTS idx_version_compat_from ON version_compatibility(from_version);\n\nCREATE TABLE IF NOT EXISTS upgrade_audit (\n  id TEXT PRIMARY KEY,\n  upgrade_id TEXT NOT NULL,\n  event_type TEXT NOT NULL,\n  actor TEXT NOT NULL,\n  message TEXT NOT NULL,\n  details_json TEXT,\n  occurred_at TEXT NOT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_upgrade_audit_upgrade ON upgrade_audit(upgrade_id);\n";
export interface HotUpgradeServiceOptions {
    defaultPolicy?: Partial<UpgradePolicy>;
}
export declare class HotUpgradeService {
    private readonly db;
    private readonly defaultPolicy;
    private readonly auditEmitter;
    constructor(db: AuthoritativeSqlDatabase, options?: HotUpgradeServiceOptions);
    registerVersionCompatibility(compat: VersionCompatibility): void;
    getVersionCompatibility(fromVersion: string, toVersion: string): VersionCompatibility | null;
    isUpgradeSafe(fromVersion: string, toVersion: string): {
        safe: boolean;
        compatibilityLevel: CompatibilityLevel;
        requiresMigration: boolean;
        supportsRollback: boolean;
        reasonCode: string;
    };
    createUpgradePlan(upgradeId: string, targets: UpgradeTarget[], policy?: Partial<UpgradePolicy>): UpgradePlan;
    getUpgradePlan(planId: string): UpgradePlan | null;
    getUpgradePlansByStatus(status: UpgradeStatus): UpgradePlan[];
    private computeBatches;
    startUpgrade(planId: string): {
        started: boolean;
        upgradeId: string | null;
        firstBatch: UpgradeBatch | null;
        reasonCode: string | null;
    };
    startBatch(batchId: string): {
        started: boolean;
        batch: UpgradeBatch | null;
        reasonCode: string | null;
    };
    completeBatch(batchId: string, healthChecks: HealthCheckResult[]): {
        completed: boolean;
        batch: UpgradeBatch | null;
        allPassed: boolean;
        nextBatch: UpgradeBatch | null;
        triggerRollback: boolean;
    };
    triggerRollback(upgradeId: string, reason: RollbackTrigger["reasonCode"], message: string): {
        triggered: boolean;
        triggerRecord: RollbackTrigger | null;
    };
    getUpgradeProgress(upgradeId: string): UpgradeProgress | null;
    recordAudit(upgradeId: string, eventType: string, actor: string, message: string, details: Record<string, unknown>): void;
    getUpgradeAuditLog(upgradeId: string, limit?: number): Array<{
        eventType: string;
        actor: string;
        message: string;
        occurredAt: string;
    }>;
    private buildDefaultHealthGates;
    private getUpgradePlanByBatch;
    private mapUpgradePlan;
    private mapBatch;
    private mapCompatibility;
}
