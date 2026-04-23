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
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
/** Deployment slot identifiers */
export type DeploymentSlot = "blue" | "green" | "canary";
/** Status of a deployment slot */
export type DeploymentSlotStatus = "active" | "standby" | "draining" | "retired";
/** Status of a traffic shift operation */
export type TrafficShiftStatus = "pending" | "in_progress" | "completed" | "rolled_back" | "failed";
/** Trigger reason for a rollback */
export type RollbackTrigger = "manual" | "health_check_failed" | "error_rate_exceeded" | "latency_exceeded" | "auto_timeout";
/**
 * A registered deployment slot with its current state.
 */
export interface DeploymentSlotRecord {
    id: string;
    slot: DeploymentSlot;
    version: string;
    status: DeploymentSlotStatus;
    trafficWeight: number;
    healthScore: number | null;
    instanceCount: number;
    createdAt: string;
    updatedAt: string;
    metadata: string | null;
}
/**
 * A traffic shift operation moving traffic between slots.
 */
export interface TrafficShiftRecord {
    id: string;
    fromSlot: DeploymentSlot;
    toSlot: DeploymentSlot;
    fromWeight: number;
    toWeight: number;
    status: TrafficShiftStatus;
    shiftSteps: string;
    currentStep: number;
    totalSteps: number;
    startedAt: string;
    completedAt: string | null;
    initiatedBy: string;
    rollbackReason: string | null;
}
/**
 * Configuration for canary deployment progression.
 */
export interface CanaryConfig {
    initialWeightPct: number;
    stepIncrementPct: number;
    stepIntervalMinutes: number;
    healthThreshold: number;
    errorRateThreshold: number;
    autoPromoteOnSuccess: boolean;
}
/**
 * A recorded rollback operation.
 */
export interface RollbackRecord {
    id: string;
    shiftId: string;
    trigger: RollbackTrigger;
    fromVersion: string;
    toVersion: string;
    reason: string;
    executedAt: string;
    completedAt: string | null;
    success: boolean;
}
/** Default canary configuration for gradual traffic shifting */
export declare const DEFAULT_CANARY_CONFIG: CanaryConfig;
export declare const TRAFFIC_ROUTING_DDL = "\nCREATE TABLE IF NOT EXISTS deployment_slots (\n  id TEXT PRIMARY KEY,\n  slot TEXT NOT NULL,\n  version TEXT NOT NULL,\n  status TEXT NOT NULL DEFAULT 'standby',\n  traffic_weight REAL NOT NULL DEFAULT 0,\n  health_score REAL NULL,\n  instance_count INTEGER NOT NULL DEFAULT 1,\n  created_at TEXT NOT NULL,\n  updated_at TEXT NOT NULL,\n  metadata TEXT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_deployment_slots_slot ON deployment_slots(slot, status);\n\nCREATE TABLE IF NOT EXISTS traffic_shifts (\n  id TEXT PRIMARY KEY,\n  from_slot TEXT NOT NULL,\n  to_slot TEXT NOT NULL,\n  from_weight REAL NOT NULL,\n  to_weight REAL NOT NULL,\n  status TEXT NOT NULL DEFAULT 'pending',\n  shift_steps TEXT NOT NULL DEFAULT '[]',\n  current_step INTEGER NOT NULL DEFAULT 0,\n  total_steps INTEGER NOT NULL DEFAULT 1,\n  started_at TEXT NOT NULL,\n  completed_at TEXT NULL,\n  initiated_by TEXT NOT NULL DEFAULT 'system',\n  rollback_reason TEXT NULL\n);\nCREATE INDEX IF NOT EXISTS idx_traffic_shifts_status ON traffic_shifts(status, started_at);\n\nCREATE TABLE IF NOT EXISTS rollback_records (\n  id TEXT PRIMARY KEY,\n  shift_id TEXT NOT NULL,\n  trigger TEXT NOT NULL,\n  from_version TEXT NOT NULL,\n  to_version TEXT NOT NULL,\n  reason TEXT NOT NULL,\n  executed_at TEXT NOT NULL,\n  completed_at TEXT NULL,\n  success INTEGER NOT NULL DEFAULT 0\n);\nCREATE INDEX IF NOT EXISTS idx_rollback_records_shift ON rollback_records(shift_id);\n";
/**
 * Service for managing deployment slots and traffic shifting.
 *
 * Supports blue-green and canary deployment strategies with gradual
 * traffic shifting and health-gated promotion/rollback.
 */
export declare class TrafficRoutingService {
    private readonly db;
    constructor(db: AuthoritativeSqlDatabase);
    /**
     * Registers a new deployment slot with a specific version.
     */
    registerSlot(slot: DeploymentSlot, version: string, instanceCount?: number, metadata?: Record<string, unknown>): DeploymentSlotRecord;
    /**
     * Gets the active slot for a given deployment slot identifier.
     */
    getActiveSlot(slot: DeploymentSlot): DeploymentSlotRecord | null;
    /**
     * Lists all active and standby slots.
     */
    listSlots(): DeploymentSlotRecord[];
    /**
     * Updates the health score for a deployment slot.
     */
    updateHealth(slotId: string, healthScore: number): void;
    /**
     * Initiates a canary traffic shift from one slot to another.
     *
     * Configures the shift steps based on the canary configuration,
     * starting with initial weight and incrementing until complete.
     */
    startCanaryShift(fromSlot: DeploymentSlot, toSlot: DeploymentSlot, config?: CanaryConfig, initiatedBy?: string): TrafficShiftRecord;
    /**
     * Advances a traffic shift to the next step.
     *
     * If all steps are complete, finishes the shift and promotes the new slot.
     * Otherwise, updates weights according to the next step value.
     */
    advanceShift(shiftId: string): TrafficShiftRecord | null;
    /**
     * Rolls back a traffic shift, restoring traffic to the original slot.
     */
    rollbackShift(shiftId: string, trigger: RollbackTrigger, reason: string): RollbackRecord;
    /**
     * Checks if the canary slot in an active shift meets health criteria.
     *
     * Returns healthy=true if the canary's health score meets the threshold.
     */
    checkCanaryHealth(shiftId: string, config?: CanaryConfig): {
        healthy: boolean;
        reason: string;
    };
    /**
     * Gets a traffic shift by ID.
     */
    getShift(shiftId: string): TrafficShiftRecord | null;
    /**
     * Lists recent traffic shifts.
     */
    listShifts(limit?: number): TrafficShiftRecord[];
    /**
     * Lists recent rollback records.
     */
    listRollbacks(limit?: number): RollbackRecord[];
    /**
     * Applies traffic weights to two slots.
     */
    private applyTrafficWeights;
    /**
     * Retires a slot, marking it as draining.
     */
    private retireSlot;
    /**
     * Activates a slot.
     */
    private activateSlot;
    /**
     * Gets the version of a slot.
     */
    private getSlotVersion;
    private mapSlot;
    private mapShift;
    private mapRollback;
}
