/**
 * PostgreSQL Hot Upgrade Repository
 *
 * Implements HotUpgradeRepository for multi-node PostgreSQL-backed hot upgrade state.
 * Uses AsyncSqlDatabase for async operations with proper connection pooling.
 */
import { asyncQueryAll, asyncQueryOne } from "../../state-evidence/truth/async-query-helper.js";
export class PostgresHotUpgradeRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    // Version Compatibility
    async upsertVersionCompatibility(compat) {
        await this.db.asyncConnection.execute(`INSERT INTO version_compatibility (id, from_version, to_version, compatibility_level, migration_required, rollback_supported, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT(from_version, to_version) DO UPDATE SET
         compatibility_level = EXCLUDED.compatibility_level,
         migration_required = EXCLUDED.migration_required,
         rollback_supported = EXCLUDED.rollback_supported`, `vcompat_${compat.fromVersion}_${compat.toVersion}`, compat.fromVersion, compat.toVersion, compat.compatibilityLevel, compat.migrationRequired ? 1 : 0, compat.rollbackSupported ? 1 : 0);
    }
    async getVersionCompatibility(fromVersion, toVersion) {
        const result = await asyncQueryOne(this.db.asyncConnection, `SELECT * FROM version_compatibility WHERE from_version = $1 AND to_version = $2`, fromVersion, toVersion);
        return result ? this.mapCompatibility(result) : null;
    }
    // Upgrade Plans
    async insertUpgradePlan(plan) {
        await this.db.asyncConnection.execute(`INSERT INTO upgrade_plans (plan_id, upgrade_id, created_at, targets_json, batches_json, policy_json, current_phase, status, started_at, completed_at, rollback_triggered_at, rollback_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, plan.planId, plan.upgradeId, plan.createdAt, JSON.stringify(plan.targets), JSON.stringify(plan.batches), JSON.stringify(plan.policy), plan.currentPhase, plan.status, plan.startedAt, plan.completedAt, plan.rollbackTriggeredAt, plan.rollbackReason);
    }
    async updateUpgradePlanStatus(planId, status, updatedFields) {
        const fields = ["status = $1"];
        const values = [status];
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
        await this.db.asyncConnection.execute(`UPDATE upgrade_plans SET ${fields.join(", ")} WHERE plan_id = $${paramIndex}`, ...values);
    }
    async getUpgradePlan(planId) {
        const result = await asyncQueryOne(this.db.asyncConnection, `SELECT * FROM upgrade_plans WHERE plan_id = $1`, planId);
        return result ? this.mapUpgradePlan(result) : null;
    }
    async listUpgradePlansByStatus(status) {
        const results = await asyncQueryAll(this.db.asyncConnection, `SELECT * FROM upgrade_plans WHERE status = $1 ORDER BY created_at DESC`, status);
        return results.map((r) => this.mapUpgradePlan(r));
    }
    // Upgrade Batches
    async insertUpgradeBatch(batch) {
        await this.db.asyncConnection.execute(`INSERT INTO upgrade_batches (batch_id, upgrade_id, batch_number, target_nodes_json, target_version, started_at, completed_at, status, health_checks_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, batch.batchId, batch.upgradeId, batch.batchNumber, JSON.stringify(batch.targetNodes), batch.targetVersion, batch.startedAt, batch.completedAt, batch.status, JSON.stringify(batch.healthChecks));
    }
    async updateUpgradeBatch(batchId, status, completedAt, healthChecks) {
        await this.db.asyncConnection.execute(`UPDATE upgrade_batches SET status = $1, completed_at = $2, health_checks_json = $3 WHERE batch_id = $4`, status, completedAt, JSON.stringify(healthChecks), batchId);
    }
    async getUpgradeBatch(batchId) {
        const result = await asyncQueryOne(this.db.asyncConnection, `SELECT * FROM upgrade_batches WHERE batch_id = $1`, batchId);
        return result ? this.mapBatch(result) : null;
    }
    async listUpgradeBatchesByPlan(upgradeId) {
        const results = await asyncQueryAll(this.db.asyncConnection, `SELECT * FROM upgrade_batches WHERE upgrade_id = $1 ORDER BY batch_number ASC`, upgradeId);
        return results.map((r) => this.mapBatch(r));
    }
    // Rollback Triggers
    async insertRollbackTrigger(trigger) {
        await this.db.asyncConnection.execute(`INSERT INTO rollback_triggers (trigger_id, upgrade_id, reason_code, message, detected_at, metadata_json)
       VALUES ($1, $2, $3, $4, $5, $6)`, trigger.triggerId, trigger.upgradeId, trigger.reasonCode, trigger.message, trigger.detectedAt, JSON.stringify(trigger.metadata));
    }
    async listRollbackTriggersByUpgrade(upgradeId) {
        const results = await asyncQueryAll(this.db.asyncConnection, `SELECT * FROM rollback_triggers WHERE upgrade_id = $1 ORDER BY detected_at DESC`, upgradeId);
        return results.map((r) => this.mapRollbackTrigger(r));
    }
    // Audit
    async insertUpgradeAudit(entry) {
        await this.db.asyncConnection.execute(`INSERT INTO upgrade_audit (id, upgrade_id, event_type, actor, message, details_json, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`, entry.id, entry.upgradeId, entry.eventType, entry.actor, entry.message, entry.details != null ? JSON.stringify(entry.details) : null, entry.occurredAt);
    }
    async listUpgradeAudits(upgradeId, limit = 100) {
        const results = await asyncQueryAll(this.db.asyncConnection, `SELECT * FROM upgrade_audit WHERE upgrade_id = $1 ORDER BY occurred_at DESC LIMIT $2`, upgradeId, limit);
        return results.map((r) => this.mapAudit(r));
    }
    // Mappers
    mapUpgradePlan(row) {
        return {
            planId: String(row.plan_id),
            upgradeId: String(row.upgrade_id),
            createdAt: String(row.created_at),
            targets: JSON.parse(row.targets_json),
            batches: JSON.parse(row.batches_json),
            policy: JSON.parse(row.policy_json),
            currentPhase: String(row.current_phase),
            status: String(row.status),
            startedAt: row.started_at ? String(row.started_at) : null,
            completedAt: row.completed_at ? String(row.completed_at) : null,
            rollbackTriggeredAt: row.rollback_triggered_at ? String(row.rollback_triggered_at) : null,
            rollbackReason: row.rollback_reason ? String(row.rollback_reason) : null,
        };
    }
    mapBatch(row) {
        return {
            batchId: String(row.batch_id),
            upgradeId: String(row.upgrade_id),
            batchNumber: Number(row.batch_number),
            targetNodes: JSON.parse(row.target_nodes_json),
            targetVersion: String(row.target_version),
            startedAt: String(row.started_at),
            completedAt: row.completed_at ? String(row.completed_at) : null,
            status: String(row.status),
            healthChecks: JSON.parse(row.health_checks_json),
        };
    }
    mapCompatibility(row) {
        return {
            fromVersion: String(row.from_version),
            toVersion: String(row.to_version),
            compatibilityLevel: String(row.compatibility_level),
            migrationRequired: Boolean(row.migration_required),
            rollbackSupported: Boolean(row.rollback_supported),
        };
    }
    mapRollbackTrigger(row) {
        return {
            triggerId: String(row.trigger_id),
            upgradeId: String(row.upgrade_id),
            reasonCode: String(row.reason_code),
            message: String(row.message),
            detectedAt: String(row.detected_at),
            metadata: row.metadata_json ? JSON.parse(row.metadata_json) : {},
        };
    }
    mapAudit(row) {
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
//# sourceMappingURL=hot-upgrade-repository-postgres.js.map