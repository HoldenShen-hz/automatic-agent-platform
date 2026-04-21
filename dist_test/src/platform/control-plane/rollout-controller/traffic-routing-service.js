/**
 * Blue-Green / Canary Traffic Routing Service
 *
 * Provides:
 * - Deployment slot management (blue/green/canary)
 * - Traffic weight distribution with gradual shifting
 * - Health-gated promotion and automated rollback
 * - Deployment history and audit trail
 *
 * @see docs_zh/contracts/release_rollout_and_rollback_contract.md
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
/** Default canary configuration for gradual traffic shifting */
export const DEFAULT_CANARY_CONFIG = {
    initialWeightPct: 5,
    stepIncrementPct: 10,
    stepIntervalMinutes: 5,
    healthThreshold: 0.95,
    errorRateThreshold: 0.02,
    autoPromoteOnSuccess: true,
};
// ── DDL ────────────────────────────────────────────────────────────────
export const TRAFFIC_ROUTING_DDL = `
CREATE TABLE IF NOT EXISTS deployment_slots (
  id TEXT PRIMARY KEY,
  slot TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'standby',
  traffic_weight REAL NOT NULL DEFAULT 0,
  health_score REAL NULL,
  instance_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  metadata TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_deployment_slots_slot ON deployment_slots(slot, status);

CREATE TABLE IF NOT EXISTS traffic_shifts (
  id TEXT PRIMARY KEY,
  from_slot TEXT NOT NULL,
  to_slot TEXT NOT NULL,
  from_weight REAL NOT NULL,
  to_weight REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  shift_steps TEXT NOT NULL DEFAULT '[]',
  current_step INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 1,
  started_at TEXT NOT NULL,
  completed_at TEXT NULL,
  initiated_by TEXT NOT NULL DEFAULT 'system',
  rollback_reason TEXT NULL
);
CREATE INDEX IF NOT EXISTS idx_traffic_shifts_status ON traffic_shifts(status, started_at);

CREATE TABLE IF NOT EXISTS rollback_records (
  id TEXT PRIMARY KEY,
  shift_id TEXT NOT NULL,
  trigger TEXT NOT NULL,
  from_version TEXT NOT NULL,
  to_version TEXT NOT NULL,
  reason TEXT NOT NULL,
  executed_at TEXT NOT NULL,
  completed_at TEXT NULL,
  success INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rollback_records_shift ON rollback_records(shift_id);
`;
// ── Service ────────────────────────────────────────────────────────────
/**
 * Service for managing deployment slots and traffic shifting.
 *
 * Supports blue-green and canary deployment strategies with gradual
 * traffic shifting and health-gated promotion/rollback.
 */
export class TrafficRoutingService {
    db;
    constructor(db) {
        this.db = db;
    }
    // ── Slot Management ────────────────────────────────────────────────
    /**
     * Registers a new deployment slot with a specific version.
     */
    registerSlot(slot, version, instanceCount = 1, metadata) {
        const now = nowIso();
        const record = {
            id: newId("dslot"),
            slot,
            version,
            status: "standby",
            trafficWeight: 0,
            healthScore: null,
            instanceCount,
            createdAt: now,
            updatedAt: now,
            metadata: metadata ? JSON.stringify(metadata) : null,
        };
        this.db.connection
            .prepare(`INSERT INTO deployment_slots (id, slot, version, status, traffic_weight, health_score, instance_count, created_at, updated_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(record.id, record.slot, record.version, record.status, record.trafficWeight, record.healthScore, record.instanceCount, record.createdAt, record.updatedAt, record.metadata);
        return record;
    }
    /**
     * Gets the active slot for a given deployment slot identifier.
     */
    getActiveSlot(slot) {
        const row = this.db.connection
            .prepare(`SELECT * FROM deployment_slots WHERE slot = ? AND status IN ('active', 'standby') ORDER BY created_at DESC LIMIT 1`)
            .get(slot);
        return row ? this.mapSlot(row) : null;
    }
    /**
     * Lists all active and standby slots.
     */
    listSlots() {
        return this.db.connection
            .prepare(`SELECT * FROM deployment_slots WHERE status IN ('active', 'standby') ORDER BY slot, created_at DESC`)
            .all().map((r) => this.mapSlot(r));
    }
    /**
     * Updates the health score for a deployment slot.
     */
    updateHealth(slotId, healthScore) {
        const now = nowIso();
        this.db.connection
            .prepare(`UPDATE deployment_slots SET health_score = ?, updated_at = ? WHERE id = ?`)
            .run(healthScore, now, slotId);
    }
    // ── Traffic Shifting ───────────────────────────────────────────────
    /**
     * Initiates a canary traffic shift from one slot to another.
     *
     * Configures the shift steps based on the canary configuration,
     * starting with initial weight and incrementing until complete.
     */
    startCanaryShift(fromSlot, toSlot, config = DEFAULT_CANARY_CONFIG, initiatedBy = "system") {
        const now = nowIso();
        const steps = [];
        let weight = config.initialWeightPct;
        while (weight < 100) {
            steps.push(weight);
            weight += config.stepIncrementPct;
        }
        steps.push(100);
        const shift = {
            id: newId("tshift"),
            fromSlot,
            toSlot,
            fromWeight: 100,
            toWeight: config.initialWeightPct,
            status: "in_progress",
            shiftSteps: JSON.stringify(steps),
            currentStep: 0,
            totalSteps: steps.length,
            startedAt: now,
            completedAt: null,
            initiatedBy,
            rollbackReason: null,
        };
        this.db.connection
            .prepare(`INSERT INTO traffic_shifts (id, from_slot, to_slot, from_weight, to_weight, status, shift_steps, current_step, total_steps, started_at, completed_at, initiated_by, rollback_reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(shift.id, shift.fromSlot, shift.toSlot, shift.fromWeight, shift.toWeight, shift.status, shift.shiftSteps, shift.currentStep, shift.totalSteps, shift.startedAt, shift.completedAt, shift.initiatedBy, shift.rollbackReason);
        // Apply initial weight
        this.applyTrafficWeights(fromSlot, 100 - config.initialWeightPct, toSlot, config.initialWeightPct);
        return shift;
    }
    /**
     * Advances a traffic shift to the next step.
     *
     * If all steps are complete, finishes the shift and promotes the new slot.
     * Otherwise, updates weights according to the next step value.
     */
    advanceShift(shiftId) {
        const row = this.db.connection
            .prepare(`SELECT * FROM traffic_shifts WHERE id = ? AND status = 'in_progress'`)
            .get(shiftId);
        if (!row)
            return null;
        const steps = JSON.parse(String(row.shift_steps));
        const currentStep = Number(row.current_step) + 1;
        if (currentStep >= steps.length) {
            // Complete the shift
            const now = nowIso();
            this.db.connection
                .prepare(`UPDATE traffic_shifts SET status = 'completed', current_step = ?, to_weight = 100, completed_at = ? WHERE id = ?`)
                .run(currentStep, now, shiftId);
            this.applyTrafficWeights(String(row.from_slot), 0, String(row.to_slot), 100);
            this.retireSlot(String(row.from_slot));
            this.activateSlot(String(row.to_slot));
            return this.getShift(shiftId);
        }
        const newWeight = steps[currentStep];
        this.db.connection
            .prepare(`UPDATE traffic_shifts SET current_step = ?, to_weight = ? WHERE id = ?`)
            .run(currentStep, newWeight, shiftId);
        this.applyTrafficWeights(String(row.from_slot), 100 - newWeight, String(row.to_slot), newWeight);
        return this.getShift(shiftId);
    }
    // ── Rollback ───────────────────────────────────────────────────────
    /**
     * Rolls back a traffic shift, restoring traffic to the original slot.
     */
    rollbackShift(shiftId, trigger, reason) {
        const now = nowIso();
        const shift = this.getShift(shiftId);
        this.db.connection
            .prepare(`UPDATE traffic_shifts SET status = 'rolled_back', rollback_reason = ?, completed_at = ? WHERE id = ?`)
            .run(reason, now, shiftId);
        // Restore traffic to original slot
        if (shift) {
            this.applyTrafficWeights(shift.fromSlot, 100, shift.toSlot, 0);
            this.activateSlot(shift.fromSlot);
        }
        const fromVersion = shift ? this.getSlotVersion(shift.toSlot) : "unknown";
        const toVersion = shift ? this.getSlotVersion(shift.fromSlot) : "unknown";
        const rollback = {
            id: newId("rbk"),
            shiftId,
            trigger,
            fromVersion,
            toVersion,
            reason,
            executedAt: now,
            completedAt: nowIso(),
            success: true,
        };
        this.db.connection
            .prepare(`INSERT INTO rollback_records (id, shift_id, trigger, from_version, to_version, reason, executed_at, completed_at, success)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(rollback.id, rollback.shiftId, rollback.trigger, rollback.fromVersion, rollback.toVersion, rollback.reason, rollback.executedAt, rollback.completedAt, rollback.success ? 1 : 0);
        return rollback;
    }
    // ── Health-Gated Check ─────────────────────────────────────────────
    /**
     * Checks if the canary slot in an active shift meets health criteria.
     *
     * Returns healthy=true if the canary's health score meets the threshold.
     */
    checkCanaryHealth(shiftId, config = DEFAULT_CANARY_CONFIG) {
        const shift = this.getShift(shiftId);
        if (!shift || shift.status !== "in_progress") {
            return { healthy: false, reason: "shift_not_active" };
        }
        const canary = this.getActiveSlot(shift.toSlot);
        if (!canary || canary.healthScore == null) {
            return { healthy: false, reason: "no_health_data" };
        }
        if (canary.healthScore < config.healthThreshold) {
            return { healthy: false, reason: `health_score_${canary.healthScore}_below_${config.healthThreshold}` };
        }
        return { healthy: true, reason: "canary_healthy" };
    }
    // ── Queries ───────────────────────────────────────────────────────
    /**
     * Gets a traffic shift by ID.
     */
    getShift(shiftId) {
        const row = this.db.connection
            .prepare(`SELECT * FROM traffic_shifts WHERE id = ?`)
            .get(shiftId);
        return row ? this.mapShift(row) : null;
    }
    /**
     * Lists recent traffic shifts.
     */
    listShifts(limit = 50) {
        return this.db.connection
            .prepare(`SELECT * FROM traffic_shifts ORDER BY started_at DESC LIMIT ?`)
            .all(limit).map((r) => this.mapShift(r));
    }
    /**
     * Lists recent rollback records.
     */
    listRollbacks(limit = 50) {
        return this.db.connection
            .prepare(`SELECT * FROM rollback_records ORDER BY executed_at DESC LIMIT ?`)
            .all(limit).map((r) => this.mapRollback(r));
    }
    // ── Internal ───────────────────────────────────────────────────────
    /**
     * Applies traffic weights to two slots.
     */
    applyTrafficWeights(slotA, weightA, slotB, weightB) {
        const now = nowIso();
        this.db.connection
            .prepare(`UPDATE deployment_slots SET traffic_weight = ?, status = CASE WHEN ? > 0 THEN 'active' ELSE status END, updated_at = ? WHERE slot = ? AND status IN ('active', 'standby')`)
            .run(weightA, weightA, now, slotA);
        this.db.connection
            .prepare(`UPDATE deployment_slots SET traffic_weight = ?, status = CASE WHEN ? > 0 THEN 'active' ELSE status END, updated_at = ? WHERE slot = ? AND status IN ('active', 'standby')`)
            .run(weightB, weightB, now, slotB);
    }
    /**
     * Retires a slot, marking it as draining.
     */
    retireSlot(slot) {
        const now = nowIso();
        this.db.connection
            .prepare(`UPDATE deployment_slots SET status = 'draining', traffic_weight = 0, updated_at = ? WHERE slot = ? AND status IN ('active', 'standby')`)
            .run(now, slot);
    }
    /**
     * Activates a slot.
     */
    activateSlot(slot) {
        const now = nowIso();
        this.db.connection
            .prepare(`UPDATE deployment_slots SET status = 'active', updated_at = ? WHERE slot = ? AND status IN ('active', 'standby', 'draining')`)
            .run(now, slot);
    }
    /**
     * Gets the version of a slot.
     */
    getSlotVersion(slot) {
        const row = this.db.connection
            .prepare(`SELECT version FROM deployment_slots WHERE slot = ? ORDER BY created_at DESC LIMIT 1`)
            .get(slot);
        return row ? String(row.version) : "unknown";
    }
    // ── Mappers ───────────────────────────────────────────────────────
    mapSlot(row) {
        return {
            id: String(row.id),
            slot: String(row.slot),
            version: String(row.version ?? ""),
            status: String(row.status ?? "standby"),
            trafficWeight: Number(row.traffic_weight ?? 0),
            healthScore: row.health_score != null ? Number(row.health_score) : null,
            instanceCount: Number(row.instance_count ?? 1),
            createdAt: String(row.created_at ?? ""),
            updatedAt: String(row.updated_at ?? ""),
            metadata: row.metadata != null ? String(row.metadata) : null,
        };
    }
    mapShift(row) {
        return {
            id: String(row.id),
            fromSlot: String(row.from_slot),
            toSlot: String(row.to_slot),
            fromWeight: Number(row.from_weight ?? 0),
            toWeight: Number(row.to_weight ?? 0),
            status: String(row.status ?? "pending"),
            shiftSteps: String(row.shift_steps ?? "[]"),
            currentStep: Number(row.current_step ?? 0),
            totalSteps: Number(row.total_steps ?? 1),
            startedAt: String(row.started_at ?? ""),
            completedAt: row.completed_at != null ? String(row.completed_at) : null,
            initiatedBy: String(row.initiated_by ?? "system"),
            rollbackReason: row.rollback_reason != null ? String(row.rollback_reason) : null,
        };
    }
    mapRollback(row) {
        return {
            id: String(row.id),
            shiftId: String(row.shift_id ?? ""),
            trigger: String(row.trigger ?? "manual"),
            fromVersion: String(row.from_version ?? ""),
            toVersion: String(row.to_version ?? ""),
            reason: String(row.reason ?? ""),
            executedAt: String(row.executed_at ?? ""),
            completedAt: row.completed_at != null ? String(row.completed_at) : null,
            success: Boolean(row.success),
        };
    }
}
//# sourceMappingURL=traffic-routing-service.js.map