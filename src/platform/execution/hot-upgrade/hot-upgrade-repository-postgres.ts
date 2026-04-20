/**
 * PostgreSQL Hot Upgrade Repository
 *
 * Implements HotUpgradeRepository for multi-node PostgreSQL-backed hot upgrade state.
 * Uses AsyncSqlDatabase for async operations with proper connection pooling.
 */

import type { AsyncSqlDatabase } from "../../state-evidence/truth/async-sql-database.js";
import type { HotUpgradeRepository, UpgradeAuditEntry } from "./hot-upgrade-repository.js";
import type { UpgradePlan, UpgradeBatch, VersionCompatibility, RollbackTrigger, HealthCheckResult } from "./hot-upgrade-service.js";
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../../state-evidence/truth/async-query-helper.js";

export class PostgresHotUpgradeRepository implements HotUpgradeRepository {
  constructor(private readonly db: AsyncSqlDatabase) {}

  // Version Compatibility

  async upsertVersionCompatibility(compat: VersionCompatibility): Promise<void> {
    await this.db.asyncConnection.execute(
      `INSERT INTO version_compatibility (id, from_version, to_version, compatibility_level, migration_required, rollback_supported, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT(from_version, to_version) DO UPDATE SET
         compatibility_level = EXCLUDED.compatibility_level,
         migration_required = EXCLUDED.migration_required,
         rollback_supported = EXCLUDED.rollback_supported`,
      `vcompat_${compat.fromVersion}_${compat.toVersion}`,
      compat.fromVersion,
      compat.toVersion,
      compat.compatibilityLevel,
      compat.migrationRequired ? 1 : 0,
      compat.rollbackSupported ? 1 : 0,
    );
  }

  async getVersionCompatibility(fromVersion: string, toVersion: string): Promise<VersionCompatibility | null> {
    const result = await asyncQueryOne<VersionCompatRow>(
      this.db.asyncConnection,
      `SELECT * FROM version_compatibility WHERE from_version = $1 AND to_version = $2`,
      fromVersion,
      toVersion,
    );
    return result ? this.mapCompatibility(result) : null;
  }

  // Upgrade Plans

  async insertUpgradePlan(plan: UpgradePlan): Promise<void> {
    await this.db.asyncConnection.execute(
      `INSERT INTO upgrade_plans (plan_id, upgrade_id, created_at, targets_json, batches_json, policy_json, current_phase, status, started_at, completed_at, rollback_triggered_at, rollback_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
    const fields: string[] = ["status = $1"];
    const values: unknown[] = [status];
    let paramIndex = 2;

    if (updatedFields?.startedAt !== undefined) {
      fields.push(`started_at = $${paramIndex++}`);
      values.push(updatedFields.startedAt);
    }
    if (updatedFields?.completedAt !== undefined) {
      fields.push(`completed_at = $${paramIndex++}`);
      values.push(updatedFields.completedAt);
    }
    if (updatedFields?.rollbackTriggeredAt !== undefined) {
      fields.push(`rollback_triggered_at = $${paramIndex++}`);
      values.push(updatedFields.rollbackTriggeredAt);
    }
    if (updatedFields?.rollbackReason !== undefined) {
      fields.push(`rollback_reason = $${paramIndex++}`);
      values.push(updatedFields.rollbackReason);
    }

    values.push(planId);
    await this.db.asyncConnection.execute(
      `UPDATE upgrade_plans SET ${fields.join(", ")} WHERE plan_id = $${paramIndex}`,
      ...values,
    );
  }

  async getUpgradePlan(planId: string): Promise<UpgradePlan | null> {
    const result = await asyncQueryOne<UpgradePlanRow>(
      this.db.asyncConnection,
      `SELECT * FROM upgrade_plans WHERE plan_id = $1`,
      planId,
    );
    return result ? this.mapUpgradePlan(result) : null;
  }

  async listUpgradePlansByStatus(status: string): Promise<UpgradePlan[]> {
    const results = await asyncQueryAll<UpgradePlanRow>(
      this.db.asyncConnection,
      `SELECT * FROM upgrade_plans WHERE status = $1 ORDER BY created_at DESC`,
      status,
    );
    return results.map((r) => this.mapUpgradePlan(r));
  }

  // Upgrade Batches

  async insertUpgradeBatch(batch: UpgradeBatch): Promise<void> {
    await this.db.asyncConnection.execute(
      `INSERT INTO upgrade_batches (batch_id, upgrade_id, batch_number, target_nodes_json, target_version, started_at, completed_at, status, health_checks_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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
    await this.db.asyncConnection.execute(
      `UPDATE upgrade_batches SET status = $1, completed_at = $2, health_checks_json = $3 WHERE batch_id = $4`,
      status,
      completedAt,
      JSON.stringify(healthChecks),
      batchId,
    );
  }

  async getUpgradeBatch(batchId: string): Promise<UpgradeBatch | null> {
    const result = await asyncQueryOne<UpgradeBatchRow>(
      this.db.asyncConnection,
      `SELECT * FROM upgrade_batches WHERE batch_id = $1`,
      batchId,
    );
    return result ? this.mapBatch(result) : null;
  }

  async listUpgradeBatchesByPlan(upgradeId: string): Promise<UpgradeBatch[]> {
    const results = await asyncQueryAll<UpgradeBatchRow>(
      this.db.asyncConnection,
      `SELECT * FROM upgrade_batches WHERE upgrade_id = $1 ORDER BY batch_number ASC`,
      upgradeId,
    );
    return results.map((r) => this.mapBatch(r));
  }

  // Rollback Triggers

  async insertRollbackTrigger(trigger: RollbackTrigger): Promise<void> {
    await this.db.asyncConnection.execute(
      `INSERT INTO rollback_triggers (trigger_id, upgrade_id, reason_code, message, detected_at, metadata_json)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      trigger.triggerId,
      trigger.upgradeId,
      trigger.reasonCode,
      trigger.message,
      trigger.detectedAt,
      JSON.stringify(trigger.metadata),
    );
  }

  async listRollbackTriggersByUpgrade(upgradeId: string): Promise<RollbackTrigger[]> {
    const results = await asyncQueryAll<RollbackTriggerRow>(
      this.db.asyncConnection,
      `SELECT * FROM rollback_triggers WHERE upgrade_id = $1 ORDER BY detected_at DESC`,
      upgradeId,
    );
    return results.map((r) => this.mapRollbackTrigger(r));
  }

  // Audit

  async insertUpgradeAudit(entry: UpgradeAuditEntry): Promise<void> {
    await this.db.asyncConnection.execute(
      `INSERT INTO upgrade_audit (id, upgrade_id, event_type, actor, message, details_json, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
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
    const results = await asyncQueryAll<UpgradeAuditRow>(
      this.db.asyncConnection,
      `SELECT * FROM upgrade_audit WHERE upgrade_id = $1 ORDER BY occurred_at DESC LIMIT $2`,
      upgradeId,
      limit,
    );
    return results.map((r) => this.mapAudit(r));
  }

  // Mappers

  private mapUpgradePlan(row: UpgradePlanRow): UpgradePlan {
    return {
      planId: String(row.plan_id),
      upgradeId: String(row.upgrade_id),
      createdAt: String(row.created_at),
      targets: JSON.parse(row.targets_json),
      batches: JSON.parse(row.batches_json),
      policy: JSON.parse(row.policy_json),
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
      targetNodes: JSON.parse(row.target_nodes_json),
      targetVersion: String(row.target_version),
      startedAt: String(row.started_at),
      completedAt: row.completed_at ? String(row.completed_at) : null,
      status: String(row.status) as UpgradeBatch["status"],
      healthChecks: JSON.parse(row.health_checks_json),
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
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : {},
    };
  }

  private mapAudit(row: UpgradeAuditRow): UpgradeAuditEntry {
    return {
      id: String(row.id),
      upgradeId: String(row.upgrade_id),
      eventType: String(row.event_type),
      actor: String(row.actor),
      message: String(row.message),
      details: row.details_json ? JSON.parse(row.details_json) : null,
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
