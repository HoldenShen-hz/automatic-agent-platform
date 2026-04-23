/**
 * Config Rollout Service
 *
 * Implements canary rollout strategy for configuration changes.
 * Supports gradual rollout phases: 0% → 5% → 25% → 50% → 100%
 *
 * Also emits config.changed events to the event bus when configs are updated.
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
/**
 * Rollout phase enum.
 */
export var RolloutPhase;
(function (RolloutPhase) {
    /** Rollout is pending, not started */
    RolloutPhase["PENDING"] = "pending";
    /** Initial canary: 5% of traffic */
    RolloutPhase["CANARY_5"] = "canary_5";
    /** Expanded canary: 25% of traffic */
    RolloutPhase["CANARY_25"] = "canary_25";
    /** Half rollout: 50% of traffic */
    RolloutPhase["HALF"] = "half";
    /** Full rollout: 100% of traffic */
    RolloutPhase["FULL"] = "full";
    /** Rollout was cancelled */
    RolloutPhase["CANCELLED"] = "cancelled";
})(RolloutPhase || (RolloutPhase = {}));
/**
 * Default rollout stages in order.
 */
export const DEFAULT_ROLLOUT_STAGES = [
    { phase: RolloutPhase.PENDING, percentage: 0, minDurationMs: 0, autoProgress: false },
    { phase: RolloutPhase.CANARY_5, percentage: 5, minDurationMs: 1800000, autoProgress: true },
    { phase: RolloutPhase.CANARY_25, percentage: 25, minDurationMs: 300000, autoProgress: true },
    { phase: RolloutPhase.HALF, percentage: 50, minDurationMs: 600000, autoProgress: true },
    { phase: RolloutPhase.FULL, percentage: 100, minDurationMs: 0, autoProgress: false },
    { phase: RolloutPhase.CANCELLED, percentage: 0, minDurationMs: 0, autoProgress: false },
];
/**
 * Service for managing configuration rollout with canary support.
 *
 * Implements gradual rollout strategy:
 * 1. Start with 0% (pending) - config not applied
 * 2. Move to 5% canary - small percentage gets new config
 * 3. Expand to 25% - more users see new config
 * 4. Expand to 50% - half of users see new config
 * 5. Finally 100% - all users see new config
 *
 * Each stage has a minimum duration before auto-progressing to next stage.
 * Manual promotion/cancellation is also supported.
 */
export class ConfigRolloutService {
    eventBus;
    stages;
    defaultMinDurationMs;
    activeRollouts = new Map();
    constructor(options = {}) {
        this.eventBus = options.eventBus ?? null;
        this.stages = options.stages ?? DEFAULT_ROLLOUT_STAGES;
        this.defaultMinDurationMs = options.defaultMinDurationMs ?? 300000;
    }
    /**
     * Starts a new config rollout with canary strategy.
     *
     * @param configPath - Dot-notation path to the config value
     * @param layer - Hierarchy layer (platform, tenant, pack, task_type)
     * @param sourceId - Source ID (e.g., tenantId) if applicable
     * @param targetPercentage - Target rollout percentage (default 100)
     * @param metadata - Additional metadata about the rollout
     * @returns The created rollout record
     */
    startRollout(configPath, layer, sourceId = null, targetPercentage = 100, metadata) {
        const rolloutId = newId("rollout");
        const now = nowIso();
        // Find the starting stage based on target percentage
        const startStage = this.stages.find((s) => s.percentage >= targetPercentage) ?? this.stages[this.stages.length - 1];
        const rollout = {
            rolloutId,
            configPath,
            layer,
            sourceId,
            stage: startStage,
            startedAt: now,
            updatedAt: now,
            targetPercentage,
            currentPercentage: startStage.percentage,
            metadata,
        };
        this.activeRollouts.set(rolloutId, rollout);
        this.emitRolloutEvent("config.rollout.started", rollout);
        return rollout;
    }
    /**
     * Gets the current rollout for a config path.
     *
     * @param configPath - Dot-notation config path
     * @param layer - Hierarchy layer
     * @param sourceId - Source ID if applicable
     */
    getActiveRollout(configPath, layer, sourceId = null) {
        for (const rollout of this.activeRollouts.values()) {
            if (rollout.configPath === configPath &&
                rollout.layer === layer &&
                rollout.sourceId === sourceId) {
                return rollout;
            }
        }
        return null;
    }
    /**
     * Checks if a config value should be applied based on rollout percentage.
     *
     * @param configPath - Dot-notation config path
     * @param layer - Hierarchy layer
     * @param sourceId - Source ID
     * @param hashValue - A hash value (e.g., tenant ID hash) for deterministic percentage assignment
     */
    shouldApplyConfig(configPath, layer, sourceId, hashValue) {
        const rollout = this.getActiveRollout(configPath, layer, sourceId);
        if (!rollout) {
            // No active rollout - apply immediately (backward compatible)
            return {
                shouldApply: true,
                percentage: 100,
                rolloutId: null,
                reason: "no_active_rollout",
            };
        }
        if (rollout.stage.phase === RolloutPhase.CANCELLED) {
            return {
                shouldApply: false,
                percentage: 0,
                rolloutId: rollout.rolloutId,
                reason: "rollout_cancelled",
            };
        }
        if (rollout.stage.phase === RolloutPhase.PENDING) {
            return {
                shouldApply: false,
                percentage: 0,
                rolloutId: rollout.rolloutId,
                reason: "rollout_pending",
            };
        }
        // Deterministic percentage based on hash
        const percentage = this.hashToPercentage(hashValue);
        if (percentage < rollout.currentPercentage) {
            return {
                shouldApply: true,
                percentage: rollout.currentPercentage,
                rolloutId: rollout.rolloutId,
                reason: `within_rollout_percentage:${rollout.currentPercentage}%`,
            };
        }
        return {
            shouldApply: false,
            percentage: rollout.currentPercentage,
            rolloutId: rollout.rolloutId,
            reason: `outside_rollout_percentage:${rollout.currentPercentage}%`,
        };
    }
    /**
     * Manually promotes a rollout to the next stage.
     *
     * @param rolloutId - The rollout ID to promote
     * @returns Updated rollout or null if not found
     */
    promoteRollout(rolloutId) {
        const rollout = this.activeRollouts.get(rolloutId);
        if (!rollout) {
            return null;
        }
        const currentIndex = this.stages.findIndex((s) => s.phase === rollout.stage.phase);
        if (currentIndex === -1 || currentIndex >= this.stages.length - 1) {
            // Already at final stage
            return rollout;
        }
        const nextStage = this.stages[currentIndex + 1];
        rollout.stage = nextStage;
        rollout.currentPercentage = nextStage.percentage;
        rollout.updatedAt = nowIso();
        this.emitRolloutEvent("config.rollout.promoted", rollout);
        return rollout;
    }
    /**
     * Cancels an active rollout.
     *
     * @param rolloutId - The rollout ID to cancel
     * @returns Updated rollout or null if not found
     */
    cancelRollout(rolloutId) {
        const rollout = this.activeRollouts.get(rolloutId);
        if (!rollout) {
            return null;
        }
        rollout.stage = this.stages.find((s) => s.phase === RolloutPhase.CANCELLED) ?? {
            phase: RolloutPhase.CANCELLED,
            percentage: 0,
            minDurationMs: 0,
            autoProgress: false,
        };
        rollout.updatedAt = nowIso();
        this.emitRolloutEvent("config.rollout.cancelled", rollout);
        return rollout;
    }
    /**
     * Auto-progresses rollouts based on elapsed time.
     * Should be called periodically by a scheduler.
     *
     * @returns Number of rollouts that were auto-progressed
     */
    autoProgressRollouts() {
        const now = Date.now();
        let progressCount = 0;
        for (const rollout of this.activeRollouts.values()) {
            if (!rollout.stage.autoProgress) {
                continue;
            }
            const currentIndex = this.stages.findIndex((s) => s.phase === rollout.stage.phase);
            if (currentIndex === -1 || currentIndex >= this.stages.length - 1) {
                continue;
            }
            const elapsedMs = now - new Date(rollout.updatedAt).getTime();
            if (elapsedMs >= rollout.stage.minDurationMs) {
                const nextStage = this.stages[currentIndex + 1];
                rollout.stage = nextStage;
                rollout.currentPercentage = nextStage.percentage;
                rollout.updatedAt = nowIso();
                this.emitRolloutEvent("config.rollout.auto_progressed", rollout);
                progressCount++;
            }
        }
        return progressCount;
    }
    /**
     * Gets all active rollouts.
     */
    getActiveRollouts() {
        return Array.from(this.activeRollouts.values());
    }
    /**
     * Cleans up completed (FULL) or cancelled rollouts older than specified age.
     *
     * @param maxAgeMs - Maximum age in milliseconds
     * @returns Number of rollouts cleaned up
     */
    cleanupRollouts(maxAgeMs = 86400000) {
        const cutoff = Date.now() - maxAgeMs;
        let cleaned = 0;
        for (const [rolloutId, rollout] of this.activeRollouts.entries()) {
            const ageMs = Date.now() - new Date(rollout.updatedAt).getTime();
            if (ageMs > maxAgeMs && (rollout.stage.phase === RolloutPhase.FULL || rollout.stage.phase === RolloutPhase.CANCELLED)) {
                this.activeRollouts.delete(rolloutId);
                cleaned++;
            }
        }
        return cleaned;
    }
    /**
     * Emits a rollout event to the event bus.
     */
    emitRolloutEvent(eventType, rollout) {
        if (!this.eventBus) {
            return;
        }
        this.eventBus.publish({
            eventType,
            payload: {
                rolloutId: rollout.rolloutId,
                configPath: rollout.configPath,
                layer: rollout.layer,
                sourceId: rollout.sourceId,
                stage: rollout.stage.phase,
                percentage: rollout.currentPercentage,
                targetPercentage: rollout.targetPercentage,
                metadata: rollout.metadata,
                timestamp: nowIso(),
            },
        });
    }
    /**
     * Converts a string hash to a percentage (0-100).
     * Uses a simple deterministic algorithm for consistent percentage assignment.
     */
    hashToPercentage(hashValue) {
        let hash = 0;
        for (let i = 0; i < hashValue.length; i++) {
            const char = hashValue.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash % 100);
    }
}
//# sourceMappingURL=config-rollout-service.js.map