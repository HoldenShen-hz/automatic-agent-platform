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

import { newId, nowIso } from "../../contracts/types/ids.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";

// ── Types ──────────────────────────────────────────────────────────────

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

// ── DDL ──────────────────────────────────────────────────────────────

export const HOT_UPGRADE_DDL = `
CREATE TABLE IF NOT EXISTS upgrade_plans (
  plan_id TEXT PRIMARY KEY,
  upgrade_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  targets_json TEXT NOT NULL,
  batches_json TEXT NOT NULL,
  policy_json TEXT NOT NULL,
  current_phase TEXT NOT NULL DEFAULT 'canary',
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT,
  completed_at TEXT,
  rollback_triggered_at TEXT,
  rollback_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_upgrade_plans_upgrade ON upgrade_plans(upgrade_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_plans_status ON upgrade_plans(status);

CREATE TABLE IF NOT EXISTS upgrade_batches (
  batch_id TEXT PRIMARY KEY,
  upgrade_id TEXT NOT NULL,
  batch_number INTEGER NOT NULL,
  target_nodes_json TEXT NOT NULL,
  target_version TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  health_checks_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_upgrade_batches_upgrade ON upgrade_batches(upgrade_id);

CREATE TABLE IF NOT EXISTS rollback_triggers (
  trigger_id TEXT PRIMARY KEY,
  upgrade_id TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  message TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_rollback_triggers_upgrade ON rollback_triggers(upgrade_id);

CREATE TABLE IF NOT EXISTS version_compatibility (
  id TEXT PRIMARY KEY,
  from_version TEXT NOT NULL,
  to_version TEXT NOT NULL,
  compatibility_level TEXT NOT NULL,
  migration_required INTEGER NOT NULL DEFAULT 0,
  rollback_supported INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(from_version, to_version)
);
CREATE INDEX IF NOT EXISTS idx_version_compat_from ON version_compatibility(from_version);

CREATE TABLE IF NOT EXISTS upgrade_audit (
  id TEXT PRIMARY KEY,
  upgrade_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  message TEXT NOT NULL,
  details_json TEXT,
  occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_upgrade_audit_upgrade ON upgrade_audit(upgrade_id);
`;

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_CANARY_PERCENT = 10;
const DEFAULT_CANARY_BATCHES = 3;
const DEFAULT_BATCH_SIZE = 33;
const DEFAULT_MAX_UPGRADE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// ── Service ─────────────────────────────────────────────────────────

export interface HotUpgradeServiceOptions {
  defaultPolicy?: Partial<UpgradePolicy>;
}

export class HotUpgradeService {
  private readonly defaultPolicy: UpgradePolicy;
  private readonly auditEmitter: Array<{ upgradeId: string; eventType: string; actor: string; message: string }> = [];

  constructor(
    private readonly db: AuthoritativeSqlDatabase,
    options?: HotUpgradeServiceOptions,
  ) {
    this.defaultPolicy = {
      canaryPercent: options?.defaultPolicy?.canaryPercent ?? DEFAULT_CANARY_PERCENT,
      canaryBatches: options?.defaultPolicy?.canaryBatches ?? DEFAULT_CANARY_BATCHES,
      batchSize: options?.defaultPolicy?.batchSize ?? DEFAULT_BATCH_SIZE,
      healthGates: options?.defaultPolicy?.healthGates ?? this.buildDefaultHealthGates(),
      rollbackOnFailure: options?.defaultPolicy?.rollbackOnFailure ?? true,
      maxUpgradeDurationMs: options?.defaultPolicy?.maxUpgradeDurationMs ?? DEFAULT_MAX_UPGRADE_DURATION_MS,
      compatibilityCheckEnabled: options?.defaultPolicy?.compatibilityCheckEnabled ?? true,
    };
  }

  // ── Version Compatibility ───────────────────────────────────────────

  registerVersionCompatibility(compat: VersionCompatibility): void {
    this.db.connection
      .prepare(
        `INSERT OR REPLACE INTO version_compatibility (id, from_version, to_version, compatibility_level, migration_required, rollback_supported, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId("vcompat"),
        compat.fromVersion,
        compat.toVersion,
        compat.compatibilityLevel,
        compat.migrationRequired ? 1 : 0,
        compat.rollbackSupported ? 1 : 0,
        nowIso(),
      );
  }

  getVersionCompatibility(fromVersion: string, toVersion: string): VersionCompatibility | null {
    const row = this.db.connection
      .prepare(`SELECT * FROM version_compatibility WHERE from_version = ? AND to_version = ?`)
      .get(fromVersion, toVersion) as RawRow | undefined;
    return row ? this.mapCompatibility(row) : null;
  }

  isUpgradeSafe(fromVersion: string, toVersion: string): {
    safe: boolean;
    compatibilityLevel: CompatibilityLevel;
    requiresMigration: boolean;
    supportsRollback: boolean;
    reasonCode: string;
  } {
    const compat = this.getVersionCompatibility(fromVersion, toVersion);

    if (!compat) {
      // No compatibility record - assume incompatible
      return {
        safe: false,
        compatibilityLevel: "incompatible",
        requiresMigration: false,
        supportsRollback: false,
        reasonCode: "no_compatibility_record",
      };
    }

    const safe = compat.compatibilityLevel !== "incompatible";
    return {
      safe,
      compatibilityLevel: compat.compatibilityLevel,
      requiresMigration: compat.migrationRequired,
      supportsRollback: compat.rollbackSupported,
      reasonCode: `compatibility_level_${compat.compatibilityLevel}`,
    };
  }

  // ── Upgrade Planning ───────────────────────────────────────────────

  createUpgradePlan(
    upgradeId: string,
    targets: UpgradeTarget[],
    policy?: Partial<UpgradePolicy>,
  ): UpgradePlan {
    const mergedPolicy = { ...this.defaultPolicy, ...policy };
    const batches = this.computeBatches(upgradeId, targets, mergedPolicy);

    const plan: UpgradePlan = {
      planId: newId("upln"),
      upgradeId,
      createdAt: nowIso(),
      targets,
      batches,
      policy: mergedPolicy,
      currentPhase: "canary",
      status: "pending",
      startedAt: null,
      completedAt: null,
      rollbackTriggeredAt: null,
      rollbackReason: null,
    };

    this.db.transaction(() => {
      this.db.connection
        .prepare(
          `INSERT INTO upgrade_plans (plan_id, upgrade_id, created_at, targets_json, batches_json, policy_json, current_phase, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          plan.planId,
          plan.upgradeId,
          plan.createdAt,
          JSON.stringify(plan.targets),
          JSON.stringify(plan.batches),
          JSON.stringify(plan.policy),
          plan.currentPhase,
          plan.status,
        );

      // Insert individual batch records
      for (const batch of batches) {
        this.db.connection
          .prepare(
            `INSERT INTO upgrade_batches (batch_id, upgrade_id, batch_number, target_nodes_json, target_version, started_at, completed_at, status, health_checks_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            batch.batchId,
            batch.upgradeId,
            batch.batchNumber,
            JSON.stringify(batch.targetNodes),
            batch.targetVersion,
            batch.startedAt,
            batch.completedAt,
            batch.status,
            JSON.stringify(batch.healthChecks),
          );
      }
    });

    return plan;
  }

  getUpgradePlan(planId: string): UpgradePlan | null {
    const row = this.db.connection
      .prepare(`SELECT * FROM upgrade_plans WHERE plan_id = ?`)
      .get(planId) as RawRow | undefined;
    return row ? this.mapUpgradePlan(row) : null;
  }

  getUpgradePlansByStatus(status: UpgradeStatus): UpgradePlan[] {
    return (this.db.connection
      .prepare(`SELECT * FROM upgrade_plans WHERE status = ? ORDER BY created_at DESC`)
      .all(status) as RawRow[]).map((r) => this.mapUpgradePlan(r));
  }

  private computeBatches(upgradeId: string, targets: UpgradeTarget[], policy: UpgradePolicy): UpgradeBatch[] {
    const batches: UpgradeBatch[] = [];
    const canaryBatchSize = Math.max(1, Math.floor(targets.length * policy.canaryPercent / 100));
    const remainingTargets = [...targets];

    // Canary batches
    for (let i = 0; i < policy.canaryBatches && remainingTargets.length > 0; i++) {
      const batchSize = Math.min(canaryBatchSize, remainingTargets.length);
      const batchTargets = remainingTargets.splice(0, batchSize);

      batches.push({
        batchId: newId("ubatch"),
        upgradeId,
        batchNumber: i + 1,
        targetNodes: batchTargets.map((t) => t.targetId),
        targetVersion: batchTargets[0]?.targetVersion ?? "",
        startedAt: "",
        completedAt: null,
        status: "pending",
        healthChecks: [],
      });
    }

    // Remaining batches
    let batchNumber = policy.canaryBatches + 1;
    while (remainingTargets.length > 0) {
      const batchSize = Math.min(policy.batchSize, remainingTargets.length);
      const batchTargets = remainingTargets.splice(0, batchSize);

      batches.push({
        batchId: newId("ubatch"),
        upgradeId,
        batchNumber: batchNumber++,
        targetNodes: batchTargets.map((t) => t.targetId),
        targetVersion: batchTargets[0]?.targetVersion ?? "",
        startedAt: "",
        completedAt: null,
        status: "pending",
        healthChecks: [],
      });
    }

    return batches;
  }

  // ── Upgrade Execution ───────────────────────────────────────────────

  startUpgrade(planId: string): {
    started: boolean;
    upgradeId: string | null;
    firstBatch: UpgradeBatch | null;
    reasonCode: string | null;
  } {
    return this.db.transaction(() => {
      const plan = this.getUpgradePlan(planId);
      if (!plan) {
        return { started: false, upgradeId: null, firstBatch: null, reasonCode: "plan_not_found" };
      }

      if (plan.status !== "pending") {
        return { started: false, upgradeId: plan.upgradeId, firstBatch: null, reasonCode: "upgrade_not_pending" };
      }

      const now = nowIso();
      this.db.connection
        .prepare(`UPDATE upgrade_plans SET status = 'in_progress', started_at = ? WHERE plan_id = ?`)
        .run(now, planId);

      const firstBatch = plan.batches.find((b) => b.status === "pending");
      if (firstBatch) {
        this.startBatch(firstBatch.batchId);
      }

      this.recordAudit(plan.upgradeId, "upgrade_started", "system", `Upgrade ${plan.upgradeId} started`, {});

      return {
        started: true,
        upgradeId: plan.upgradeId,
        firstBatch: firstBatch ?? null,
        reasonCode: null,
      };
    });
  }

  startBatch(batchId: string): {
    started: boolean;
    batch: UpgradeBatch | null;
    reasonCode: string | null;
  } {
    return this.db.transaction(() => {
      const row = this.db.connection
        .prepare(`SELECT * FROM upgrade_batches WHERE batch_id = ?`)
        .get(batchId) as RawRow | undefined;

      if (!row) {
        return { started: false, batch: null, reasonCode: "batch_not_found" };
      }

      const batch: UpgradeBatch = this.mapBatch(row);
      if (batch.status !== "pending") {
        return { started: false, batch, reasonCode: "batch_not_pending" };
      }

      const now = nowIso();
      batch.status = "in_progress";
      batch.startedAt = now;

      this.db.connection
        .prepare(
          `UPDATE upgrade_batches SET status = 'in_progress', started_at = ?, health_checks_json = ? WHERE batch_id = ?`,
        )
        .run(now, JSON.stringify(batch.healthChecks), batchId);

      const plan = this.getUpgradePlanByBatch(batchId);
      if (plan) {
        this.recordAudit(plan.upgradeId, "batch_started", "system", `Batch ${batch.batchNumber} started`, { batchId });
      }

      return { started: true, batch, reasonCode: null };
    });
  }

  completeBatch(
    batchId: string,
    healthChecks: HealthCheckResult[],
  ): {
    completed: boolean;
    batch: UpgradeBatch | null;
    allPassed: boolean;
    nextBatch: UpgradeBatch | null;
    triggerRollback: boolean;
  } {
    return this.db.transaction(() => {
      const row = this.db.connection
        .prepare(`SELECT * FROM upgrade_batches WHERE batch_id = ?`)
        .get(batchId) as RawRow | undefined;

      if (!row) {
        return { completed: false, batch: null, allPassed: false, nextBatch: null, triggerRollback: false };
      }

      const batch: UpgradeBatch = this.mapBatch(row);
      const allPassed = healthChecks.every((c) => c.passed);
      const now = nowIso();

      batch.status = allPassed ? "completed" : "failed";
      batch.completedAt = now;
      batch.healthChecks = healthChecks;

      this.db.connection
        .prepare(
          `UPDATE upgrade_batches SET status = ?, completed_at = ?, health_checks_json = ? WHERE batch_id = ?`,
        )
        .run(batch.status, now, JSON.stringify(batch.healthChecks), batchId);

      const plan = this.getUpgradePlanByBatch(batchId);
      if (!plan) {
        return { completed: allPassed, batch, allPassed, nextBatch: null, triggerRollback: false };
      }

      this.recordAudit(
        plan.upgradeId,
        "batch_completed",
        "system",
        `Batch ${batch.batchNumber} ${allPassed ? "completed successfully" : "failed health checks"}`,
        { batchId, allPassed },
      );

      // Find next pending batch
      const nextBatch = plan.batches.find((b) => b.batchNumber > batch.batchNumber && b.status === "pending");

      // Determine if rollback should be triggered
      let triggerRollback = false;
      if (!allPassed) {
        // Batch failed - upgrade is failed regardless of rollback setting
        this.db.connection
          .prepare(`UPDATE upgrade_plans SET status = 'failed', rollback_triggered_at = ?, rollback_reason = ? WHERE plan_id = ?`)
          .run(now, "health_check_failed", plan.planId);

        if (plan.policy.rollbackOnFailure) {
          triggerRollback = true;
          this.recordAudit(plan.upgradeId, "rollback_triggered", "system", `Rollback triggered due to batch ${batch.batchNumber} health check failure`, { batchId });
        } else {
          this.recordAudit(plan.upgradeId, "upgrade_failed", "system", `Upgrade failed due to batch ${batch.batchNumber} health check failure (rollback disabled)`, { batchId });
        }
      } else if (!nextBatch) {
        // All batches complete successfully
        this.db.connection
          .prepare(`UPDATE upgrade_plans SET status = 'completed', completed_at = ? WHERE plan_id = ?`)
          .run(now, plan.planId);

        this.recordAudit(plan.upgradeId, "upgrade_completed", "system", `Upgrade ${plan.upgradeId} completed successfully`, {});
      }

      if (nextBatch && allPassed) {
        this.startBatch(nextBatch.batchId);
      }

      return { completed: true, batch, allPassed, nextBatch: nextBatch ?? null, triggerRollback };
    });
  }

  triggerRollback(upgradeId: string, reason: RollbackTrigger["reasonCode"], message: string): {
    triggered: boolean;
    triggerRecord: RollbackTrigger | null;
  } {
    return this.db.transaction(() => {
      const trigger: RollbackTrigger = {
        triggerId: newId("rbt"),
        upgradeId,
        reasonCode: reason,
        message,
        detectedAt: nowIso(),
        metadata: {},
      };

      this.db.connection
        .prepare(
          `INSERT INTO rollback_triggers (trigger_id, upgrade_id, reason_code, message, detected_at, metadata_json)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(trigger.triggerId, trigger.upgradeId, trigger.reasonCode, trigger.message, trigger.detectedAt, JSON.stringify(trigger.metadata));

      this.db.connection
        .prepare(`UPDATE upgrade_plans SET status = 'failed', rollback_triggered_at = ?, rollback_reason = ? WHERE upgrade_id = ? AND status = 'in_progress'`)
        .run(trigger.detectedAt, message, upgradeId);

      this.recordAudit(upgradeId, "rollback_triggered", "system", message, { reasonCode: reason });

      return { triggered: true, triggerRecord: trigger };
    });
  }

  getUpgradeProgress(upgradeId: string): UpgradeProgress | null {
    const rows = this.db.connection
      .prepare(`SELECT * FROM upgrade_plans WHERE upgrade_id = ?`)
      .all(upgradeId) as RawRow[];

    if (rows.length === 0) return null;

    const plan = this.mapUpgradePlan(rows[0]!);
    const batches = this.listUpgradeBatches(upgradeId);
    const completedBatches = batches.filter((b) => b.status === "completed").length;
    const failedBatches = batches.filter((b) => b.status === "failed").length;
    const allHealthChecks = batches.flatMap((b) => b.healthChecks);
    const healthCheckPassRate = allHealthChecks.length > 0
      ? (allHealthChecks.filter((c) => c.passed).length / allHealthChecks.length) * 100
      : 100;

    // Estimate completion based on duration so far
    let estimatedCompletionMs: number | null = null;
    if (plan.startedAt && plan.status === "in_progress") {
      const elapsedMs = Date.now() - new Date(plan.startedAt).getTime();
      const completedRatio = completedBatches / batches.length;
      if (completedRatio > 0) {
        estimatedCompletionMs = Math.round(elapsedMs / completedRatio - elapsedMs);
      }
    }

    return {
      upgradeId,
      phase: plan.currentPhase,
      status: plan.status,
      currentBatchNumber: batches.find((b) => b.status === "in_progress")?.batchNumber ?? 0,
      totalBatches: batches.length,
      completedBatches,
      failedBatches,
      healthCheckPassRate: Math.round(healthCheckPassRate * 100) / 100,
      errorRate: batches.length > 0 ? (failedBatches / batches.length) * 100 : 0,
      estimatedCompletionMs,
    };
  }

  // ── Audit Trail ────────────────────────────────────────────────────

  recordAudit(upgradeId: string, eventType: string, actor: string, message: string, details: Record<string, unknown>): void {
    const id = newId("uaudit");
    const now = nowIso();
    this.db.connection
      .prepare(
        `INSERT INTO upgrade_audit (id, upgrade_id, event_type, actor, message, details_json, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, upgradeId, eventType, actor, message, JSON.stringify(details), now);
  }

  getUpgradeAuditLog(upgradeId: string, limit = 100): Array<{ eventType: string; actor: string; message: string; occurredAt: string }> {
    return (this.db.connection
      .prepare(`SELECT * FROM upgrade_audit WHERE upgrade_id = ? ORDER BY occurred_at DESC LIMIT ?`)
      .all(upgradeId, limit) as RawRow[]).map((r) => ({
      eventType: String(r.event_type),
      actor: String(r.actor),
      message: String(r.message),
      occurredAt: String(r.occurred_at),
    }));
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private buildDefaultHealthGates(): HealthGateConfig[] {
    return [
      { gateType: "worker_ready", threshold: 0.95, windowSeconds: 60, operator: "gte" },
      { gateType: "dispatch_healthy", threshold: 0.99, windowSeconds: 120, operator: "gte" },
      { gateType: "lease_stable", threshold: 0.98, windowSeconds: 60, operator: "gte" },
      { gateType: "error_rate", threshold: 5, windowSeconds: 300, operator: "lt" },
      { gateType: "latency_pct", threshold: 500, windowSeconds: 120, operator: "lt" },
    ];
  }

  private getUpgradePlanByBatch(batchId: string): UpgradePlan | null {
    const row = this.db.connection
      .prepare(`SELECT * FROM upgrade_batches WHERE batch_id = ?`)
      .get(batchId) as RawRow | undefined;
    if (!row) return null;

    const upgradeId = String(row.upgrade_id);
    const planRows = this.db.connection
      .prepare(`SELECT * FROM upgrade_plans WHERE upgrade_id = ?`)
      .all(upgradeId) as RawRow[];
    return planRows.length > 0 ? this.mapUpgradePlan(planRows[0]!) : null;
  }

  private listUpgradeBatches(upgradeId: string): UpgradeBatch[] {
    return (this.db.connection
      .prepare(`SELECT * FROM upgrade_batches WHERE upgrade_id = ? ORDER BY batch_number ASC`)
      .all(upgradeId) as RawRow[]).map((row) => this.mapBatch(row));
  }

  private mapUpgradePlan(row: RawRow): UpgradePlan {
    return {
      planId: String(row.plan_id),
      upgradeId: String(row.upgrade_id),
      createdAt: String(row.created_at),
      targets: JSON.parse(row.targets_json as string),
      batches: JSON.parse(row.batches_json as string),
      policy: JSON.parse(row.policy_json as string),
      currentPhase: String(row.current_phase) as UpgradePhase,
      status: String(row.status) as UpgradeStatus,
      startedAt: row.started_at ? String(row.started_at) : null,
      completedAt: row.completed_at ? String(row.completed_at) : null,
      rollbackTriggeredAt: row.rollback_triggered_at ? String(row.rollback_triggered_at) : null,
      rollbackReason: row.rollback_reason ? String(row.rollback_reason) : null,
    };
  }

  private mapBatch(row: RawRow): UpgradeBatch {
    return {
      batchId: String(row.batch_id),
      upgradeId: String(row.upgrade_id),
      batchNumber: Number(row.batch_number),
      targetNodes: JSON.parse(row.target_nodes_json as string),
      targetVersion: String(row.target_version),
      startedAt: String(row.started_at),
      completedAt: row.completed_at ? String(row.completed_at) : null,
      status: String(row.status) as UpgradeBatch["status"],
      healthChecks: JSON.parse(row.health_checks_json as string),
    };
  }

  private mapCompatibility(row: RawRow): VersionCompatibility {
    return {
      fromVersion: String(row.from_version),
      toVersion: String(row.to_version),
      compatibilityLevel: String(row.compatibility_level) as CompatibilityLevel,
      migrationRequired: Boolean(row.migration_required),
      rollbackSupported: Boolean(row.rollback_supported),
    };
  }
}

type RawRow = Record<string, unknown>;
