/**
 * Config Rollout Service
 *
 * Implements canary rollout strategy for configuration changes.
 * Supports gradual rollout phases: 0% → 5% → 25% → 50% → 100%
 *
 * Also emits config.changed events to the event bus when configs are updated.
 */
import { DurableEventBus } from "../../state-evidence/events/durable-event-bus.js";
/**
 * Rollout phase enum.
 */
export declare enum RolloutPhase {
    /** Rollout is pending, not started */
    PENDING = "pending",
    /** Initial canary: 5% of traffic */
    CANARY_5 = "canary_5",
    /** Expanded canary: 25% of traffic */
    CANARY_25 = "canary_25",
    /** Half rollout: 50% of traffic */
    HALF = "half",
    /** Full rollout: 100% of traffic */
    FULL = "full",
    /** Rollout was cancelled */
    CANCELLED = "cancelled"
}
/**
 * Rollout stage definition.
 */
export interface RolloutStage {
    phase: RolloutPhase;
    percentage: number;
    minDurationMs: number;
    autoProgress: boolean;
}
/**
 * Default rollout stages in order.
 */
export declare const DEFAULT_ROLLOUT_STAGES: RolloutStage[];
/**
 * Active config rollout record.
 */
export interface ConfigRollout {
    rolloutId: string;
    configPath: string;
    layer: string;
    sourceId: string | null;
    stage: RolloutStage;
    startedAt: string;
    updatedAt: string;
    targetPercentage: number;
    currentPercentage: number;
    metadata: Record<string, unknown> | undefined;
}
/**
 * Result of checking if a config should apply.
 */
export interface RolloutDecision {
    shouldApply: boolean;
    percentage: number;
    rolloutId: string | null;
    reason: string;
}
/**
 * Options for ConfigRolloutService.
 */
export interface ConfigRolloutServiceOptions {
    eventBus?: DurableEventBus | null;
    stages?: RolloutStage[];
    defaultMinDurationMs?: number;
}
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
export declare class ConfigRolloutService {
    private readonly eventBus;
    private readonly stages;
    private readonly defaultMinDurationMs;
    private readonly activeRollouts;
    constructor(options?: ConfigRolloutServiceOptions);
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
    startRollout(configPath: string, layer: string, sourceId?: string | null, targetPercentage?: number, metadata?: Record<string, unknown>): ConfigRollout;
    /**
     * Gets the current rollout for a config path.
     *
     * @param configPath - Dot-notation config path
     * @param layer - Hierarchy layer
     * @param sourceId - Source ID if applicable
     */
    getActiveRollout(configPath: string, layer: string, sourceId?: string | null): ConfigRollout | null;
    /**
     * Checks if a config value should be applied based on rollout percentage.
     *
     * @param configPath - Dot-notation config path
     * @param layer - Hierarchy layer
     * @param sourceId - Source ID
     * @param hashValue - A hash value (e.g., tenant ID hash) for deterministic percentage assignment
     */
    shouldApplyConfig(configPath: string, layer: string, sourceId: string | null, hashValue: string): RolloutDecision;
    /**
     * Manually promotes a rollout to the next stage.
     *
     * @param rolloutId - The rollout ID to promote
     * @returns Updated rollout or null if not found
     */
    promoteRollout(rolloutId: string): ConfigRollout | null;
    /**
     * Cancels an active rollout.
     *
     * @param rolloutId - The rollout ID to cancel
     * @returns Updated rollout or null if not found
     */
    cancelRollout(rolloutId: string): ConfigRollout | null;
    /**
     * Auto-progresses rollouts based on elapsed time.
     * Should be called periodically by a scheduler.
     *
     * @returns Number of rollouts that were auto-progressed
     */
    autoProgressRollouts(): number;
    /**
     * Gets all active rollouts.
     */
    getActiveRollouts(): ConfigRollout[];
    /**
     * Cleans up completed (FULL) or cancelled rollouts older than specified age.
     *
     * @param maxAgeMs - Maximum age in milliseconds
     * @returns Number of rollouts cleaned up
     */
    cleanupRollouts(maxAgeMs?: number): number;
    /**
     * Emits a rollout event to the event bus.
     */
    private emitRolloutEvent;
    /**
     * Converts a string hash to a percentage (0-100).
     * Uses a simple deterministic algorithm for consistent percentage assignment.
     */
    private hashToPercentage;
}
