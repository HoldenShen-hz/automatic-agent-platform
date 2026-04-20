/**
 * SQLite Hot Upgrade Repository
 *
 * Implements HotUpgradeRepository for single-node SQLite-backed hot upgrade state.
 * Uses synchronous operations via AuthoritativeSqlDatabase.
 */

import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { queryAll, queryOne } from "../../state-evidence/truth/sqlite/query-helper.js";
import type { HotUpgradeRepository, UpgradeAuditEntry } from "./hot-upgrade-repository.js";
import type { UpgradePlan, UpgradeBatch, VersionCompatibility, RollbackTrigger, HealthCheckResult } from "./hot-upgrade-service.js";

export class SqliteHotUpgradeRepository implements HotUpgradeRepository {
  constructor(private readonly db: AuthoritativeSqlDatabase) {}

  // Version Compatibility

  async upsertVersionCompatibility(compat: VersionCompatibility): Promise<void> {
    this.db.connection
      .prepare(
        `INSERT OR REPLACE INTO version_compatibility (id, from_version, to_version, compatibility_level, migration_required, rollback_supported, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        `vcompat_${compat.fromVersion}_${compat.toVersion}`,
        compat.fromVersion,
        compat.toVersion,
        compat.compatibilityLevel,
        compat.migrationRequired ? 1 : 0,
        compat.rollbackSupported ? 1 : 0,
        new Date().toISOString(),
      );
  }

  async getVersionCompatibility(fromVersion: string, toVersion: string): Promise<VersionCompatibility | null> {
    const row = queryOne<VersionCompatRow>(
      this.db.connection,
      `SELECT * FROM version_compatibility WHERE from_version = ? AND to_version = ?`,
      fromVersion,
      toVersion,
    );
    return row ? this.mapCompatibility(row) : null;
  }

  // Upgrade Plans

  async insertUpgradePlan(plan: UpgradePlan): Promise<void> {
    this.db.connection
      .prepare(
        `INSERT INTO upgrade_plans (plan_id, upgrade_id, created_at, targets_json, batches_json, policy_json, current_phase, status, started_at, completed_at, rollback_triggered_at, rollback_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        plan.startedAt,
        plan.completedAt,
        plan.rollbackTriggeredAt,
        plan.rollbackReason,
      );
  }

  async updateUpgradePlanStatus(
    planId: string,
    status: string,
    updatedFields?: { startedAt?: string; completedAt?: string; rollbackTriggeredAt?: string; rollbackReason?: string },
  ): Promise<void> {
    const fields: string[] = ["status = ?"];
    const values: (string | number | null)[] = [status];

    if (updatedFields?.startedAt !== undefined) {
      fields.push("started_at = ?");
      values.push(updatedFields.startedAt);
    }
    if (updatedFields?.completedAt !== undefined) {
      fields.push("completed_at = ?");
      values.push(updatedFields.completedAt);
    }
    if (updatedFields?.rollbackTriggeredAt !== undefined) {
      fields.push("rollback_triggered_at = ?");
      values.push(updatedFields.rollbackTriggeredAt);
    }
    if (updatedFields?.rollbackReason !== undefined) {
      fields.push("rollback_reason = ?");
      values.push(updatedFields.rollbackReason);
    }

    values.push(planId);
    this.db.connection
      .prepare(`UPDATE upgrade_plans SET ${fields.join(", ")} WHERE plan_id = ?`)
      .run(...values as (string | number | null)[]);
  }

  async getUpgradePlan(planId: string): Promise<UpgradePlan | null> {
    const row = queryOne<UpgradePlanRow>(
      this.db.connection,
      `SELECT * FROM upgrade_plans WHERE plan_id = ?`,
      planId,
    );
    return row ? this.mapUpgradePlan(row) : null;
  }

  async listUpgradePlansByStatus(status: string): Promise<UpgradePlan[]> {
    const rows = queryAll<UpgradePlanRow>(
      this.db.connection,
      `SELECT * FROM upgrade_plans WHERE status = ? ORDER BY created_at DESC`,
      status,
    );
    return rows.map((r) => this.mapUpgradePlan(r));
  }

  // Upgrade Batches

  async insertUpgradeBatch(batch: UpgradeBatch): Promise<void> {
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

  async updateUpgradeBatch(
    batchId: string,
    status: string,
    completedAt: string | null,
    healthChecks: HealthCheckResult[],
  ): Promise<void> {
    this.db.connection
      .prepare(
        `UPDATE upgrade_batches SET status = ?, completed_at = ?, health_checks_json = ? WHERE batch_id = ?`,
      )
      .run(status, completedAt, JSON.stringify(healthChecks), batchId);
  }

  async getUpgradeBatch(batchId: string): Promise<UpgradeBatch | null> {
    const row = queryOne<UpgradeBatchRow>(
      this.db.connection,
      `SELECT * FROM upgrade_batches WHERE batch_id = ?`,
      batchId,
    );
    return row ? this.mapBatch(row) : null;
  }

  async listUpgradeBatchesByPlan(upgradeId: string): Promise<UpgradeBatch[]> {
    const rows = queryAll<UpgradeBatchRow>(
      this.db.connection,
      `SELECT * FROM upgrade_batches WHERE upgrade_id = ? ORDER BY batch_number ASC`,
      upgradeId,
    );
    return rows.map((r) => this.mapBatch(r));
  }

  // Rollback Triggers

  async insertRollbackTrigger(trigger: RollbackTrigger): Promise<void> {
    this.db.connection
      .prepare(
        `INSERT INTO rollback_triggers (trigger_id, upgrade_id, reason_code, message, detected_at, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        trigger.triggerId,
        trigger.upgradeId,
        trigger.reasonCode,
        trigger.message,
        trigger.detectedAt,
        JSON.stringify(trigger.metadata),
      );
  }

  async listRollbackTriggersByUpgrade(upgradeId: string): Promise<RollbackTrigger[]> {
    const rows = queryAll<RollbackTriggerRow>(
      this.db.connection,
      `SELECT * FROM rollback_triggers WHERE upgrade_id = ? ORDER BY detected_at DESC`,
      upgradeId,
    );
    return rows.map((r) => this.mapRollbackTrigger(r));
  }

  // Audit

  async insertUpgradeAudit(entry: UpgradeAuditEntry): Promise<void> {
    this.db.connection
      .prepare(
        `INSERT INTO upgrade_audit (id, upgrade_id, event_type, actor, message, details_json, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.upgradeId,
        entry.eventType,
        entry.actor,
        entry.message,
        entry.details != null ? JSON.stringify(entry.details) : null,
        entry.occurredAt,
      );
  }

  async listUpgradeAudits(upgradeId: string, limit = 100): Promise<UpgradeAuditEntry[]> {
    const rows = queryAll<UpgradeAuditRow>(
      this.db.connection,
      `SELECT * FROM upgrade_audit WHERE upgrade_id = ? ORDER BY occurred_at DESC LIMIT ?`,
      upgradeId,
      limit,
    );
    return rows.map((r) => this.mapAudit(r));
  }

  // Mappers

  private mapUpgradePlan(row: UpgradePlanRow): UpgradePlan {
    return {
      planId: String(row.plan_id),
      upgradeId: String(row.upgrade_id),
      createdAt: String(row.created_at),
      targets: JSON.parse(row.targets_json as string),
      batches: JSON.parse(row.batches_json as string),
      policy: JSON.parse(row.policy_json as string),
      currentPhase: String(row.current_phase) as UpgradePlan["currentPhase"],
      status: String(row.status) as UpgradePlan["status"],
      startedAt: row.started_at ? String(row.started_at) : null,
      completedAt: row.completed_at ? String(row.completed_at) : null,
      rollbackTriggeredAt: row.rollback_triggered_at ? String(row.rollback_triggered_at) : null,
      rollbackReason: row.rollback_reason ? String(row.rollback_reason) : null,
    };
  }

  private mapBatch(row: UpgradeBatchRow): UpgradeBatch {
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

  private mapCompatibility(row: VersionCompatRow): VersionCompatibility {
    return {
      fromVersion: String(row.from_version),
      toVersion: String(row.to_version),
      compatibilityLevel: String(row.compatibility_level) as VersionCompatibility["compatibilityLevel"],
      migrationRequired: Boolean(row.migration_required),
      rollbackSupported: Boolean(row.rollback_supported),
    };
  }

  private mapRollbackTrigger(row: RollbackTriggerRow): RollbackTrigger {
    return {
      triggerId: String(row.trigger_id),
      upgradeId: String(row.upgrade_id),
      reasonCode: String(row.reason_code) as RollbackTrigger["reasonCode"],
      message: String(row.message),
      detectedAt: String(row.detected_at),
      metadata: row.metadata_json ? JSON.parse(row.metadata_json as string) : {},
    };
  }

  private mapAudit(row: UpgradeAuditRow): UpgradeAuditEntry {
    return {
      id: String(row.id),
      upgradeId: String(row.upgrade_id),
      eventType: String(row.event_type),
      actor: String(row.actor),
      message: String(row.message),
      details: row.details_json ? JSON.parse(row.details_json as string) : null,
      occurredAt: String(row.occurred_at),
    };
  }
}

// Row types
interface VersionCompatRow {
  id: string;
  from_version: string;
  to_version: string;
  compatibility_level: string;
  migration_required: number;
  rollback_supported: number;
  created_at: string;
}

interface UpgradePlanRow {
  plan_id: string;
  upgrade_id: string;
  created_at: string;
  targets_json: string;
  batches_json: string;
  policy_json: string;
  current_phase: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  rollback_triggered_at: string | null;
  rollback_reason: string | null;
}

interface UpgradeBatchRow {
  batch_id: string;
  upgrade_id: string;
  batch_number: number;
  target_nodes_json: string;
  target_version: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  health_checks_json: string;
}

interface RollbackTriggerRow {
  trigger_id: string;
  upgrade_id: string;
  reason_code: string;
  message: string;
  detected_at: string;
  metadata_json: string | null;
}

interface UpgradeAuditRow {
  id: string;
  upgrade_id: string;
  event_type: string;
  actor: string;
  message: string;
  details_json: string | null;
  occurred_at: string;
}
