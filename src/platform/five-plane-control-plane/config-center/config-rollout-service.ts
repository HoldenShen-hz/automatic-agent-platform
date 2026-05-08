/**
 * Config Rollout Service
 *
 * Implements canary rollout strategy for configuration changes.
 * Supports gradual rollout phases: 0% → 5% → 25% → 50% → 100%
 *
 * Also emits config.changed events to the event bus when configs are updated.
 */

import { DurableEventBus } from "../../state-evidence/events/durable-event-bus.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

/**
 * Rollout phase enum.
 */
export enum RolloutPhase {
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
  CANCELLED = "cancelled",
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
export const DEFAULT_ROLLOUT_STAGES: RolloutStage[] = [
  { phase: RolloutPhase.PENDING, percentage: 0, minDurationMs: 0, autoProgress: false },
  { phase: RolloutPhase.CANARY_5, percentage: 5, minDurationMs: 1800000, autoProgress: true },
  { phase: RolloutPhase.CANARY_25, percentage: 25, minDurationMs: 300000, autoProgress: true },
  { phase: RolloutPhase.HALF, percentage: 50, minDurationMs: 600000, autoProgress: true },
  { phase: RolloutPhase.FULL, percentage: 100, minDurationMs: 0, autoProgress: false },
  { phase: RolloutPhase.CANCELLED, percentage: 0, minDurationMs: 0, autoProgress: false },
];

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
export class ConfigRolloutService {
  private readonly eventBus: DurableEventBus | null;
  private readonly stages: RolloutStage[];
  private readonly defaultMinDurationMs: number;
  private readonly activeRollouts = new Map<string, ConfigRollout>();

  public constructor(options: ConfigRolloutServiceOptions = {}) {
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
  public startRollout(
    configPath: string,
    layer: string,
    sourceId: string | null = null,
    targetPercentage: number = 100,
    metadata?: Record<string, unknown>,
  ): ConfigRollout {
    const rolloutId = newId("rollout");
    const now = nowIso();

    const startStage = this.resolveInitialStage(targetPercentage);

    const rollout: ConfigRollout = {
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
  public getActiveRollout(
    configPath: string,
    layer: string,
    sourceId: string | null = null,
  ): ConfigRollout | null {
    for (const rollout of this.activeRollouts.values()) {
      if (
        rollout.configPath === configPath &&
        rollout.layer === layer &&
        rollout.sourceId === sourceId
      ) {
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
  public shouldApplyConfig(
    configPath: string,
    layer: string,
    sourceId: string | null,
    hashValue: string,
  ): RolloutDecision {
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
  public promoteRollout(rolloutId: string): ConfigRollout | null {
    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout) {
      return null;
    }

    if (rollout.stage.phase === RolloutPhase.FULL || rollout.stage.phase === RolloutPhase.CANCELLED) {
      return rollout;
    }

    const currentIndex = this.stages.findIndex((s) => s.phase === rollout.stage.phase);
    if (currentIndex === -1 || currentIndex >= this.stages.length - 1) {
      // Already at final stage
      return rollout;
    }

    const nextStage = this.stages[currentIndex + 1]!;
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
  public cancelRollout(rolloutId: string): ConfigRollout | null {
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
  public autoProgressRollouts(): number {
    const now = Date.now();
    let progressCount = 0;

    for (const rollout of this.activeRollouts.values()) {
      if (!rollout.stage.autoProgress) {
        continue;
      }
      if (rollout.stage.phase === RolloutPhase.FULL || rollout.stage.phase === RolloutPhase.CANCELLED) {
        continue;
      }

      const currentIndex = this.stages.findIndex((s) => s.phase === rollout.stage.phase);
      if (currentIndex === -1 || currentIndex >= this.stages.length - 1) {
        continue;
      }

      const elapsedMs = now - new Date(rollout.updatedAt).getTime();
      if (elapsedMs >= rollout.stage.minDurationMs) {
        const nextStage = this.stages[currentIndex + 1]!;
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
  public getActiveRollouts(): ConfigRollout[] {
    return Array.from(this.activeRollouts.values());
  }

  /**
   * Cleans up completed (FULL) or cancelled rollouts older than specified age.
   *
   * @param maxAgeMs - Maximum age in milliseconds
   * @returns Number of rollouts cleaned up
   */
  public cleanupRollouts(maxAgeMs: number = 86400000): number {
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
  private emitRolloutEvent(eventType: string, rollout: ConfigRollout): void {
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
  private hashToPercentage(hashValue: string): number {
    let hash = 0;
    for (let i = 0; i < hashValue.length; i++) {
      const char = hashValue.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash % 100);
  }

  private resolveInitialStage(targetPercentage: number): RolloutStage {
    if (targetPercentage <= 0) {
      return this.stages.find((stage) => stage.phase === RolloutPhase.PENDING) ?? this.stages[0]!;
    }

    const firstCanaryStage = this.stages.find((stage) =>
      stage.percentage > 0 &&
      stage.phase !== RolloutPhase.CANCELLED &&
      stage.phase !== RolloutPhase.FULL,
    );
    if (targetPercentage >= 100 && firstCanaryStage != null) {
      return firstCanaryStage;
    }

    return this.stages.find((stage) => stage.percentage >= targetPercentage) ?? this.stages[this.stages.length - 1]!;
  }
}
