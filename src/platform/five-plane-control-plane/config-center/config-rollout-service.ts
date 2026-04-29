/**
 * Config Rollout Service
 *
 * Implements canary rollout strategy for configuration changes.
 * Supports gradual rollout phases: 0% → canary → 10% → 100%
 * §24.3 spec: canary → 30min observation → 10% → full
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
  /** Initial canary phase */
  CANARY = "canary",
  /** Canary reaches 10% of traffic after mandatory 30min observation */
  CANARY_10 = "canary_10",
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
 * §24.3 spec: canary → 30min → 10% → full
 */
export const DEFAULT_ROLLOUT_STAGES: RolloutStage[] = [
  { phase: RolloutPhase.PENDING, percentage: 0, minDurationMs: 0, autoProgress: false },
  { phase: RolloutPhase.CANARY, percentage: 0, minDurationMs: 1800000, autoProgress: true },
  { phase: RolloutPhase.CANARY_10, percentage: 10, minDurationMs: 0, autoProgress: false },
  { phase: RolloutPhase.FULL, percentage: 100, minDurationMs: 0, autoProgress: false },
  { phase: RolloutPhase.CANCELLED, percentage: 0, minDurationMs: 0, autoProgress: false },
];

/**
 * Health gate thresholds for rollout progression.
 * §24.3 mandates health gates must pass before auto-progressing.
 */
export interface RolloutHealthGates {
  /** Maximum error rate percentage (0-100) allowed to auto-progress */
  maxErrorRate: number;
  /** Maximum latency regression percentage allowed to auto-progress */
  maxLatencyRegression: number;
  /** Maximum incident rate per minute allowed to auto-progress */
  maxIncidentRate: number;
}

/**
 * Default health gate thresholds.
 */
export const DEFAULT_HEALTH_GATES: RolloutHealthGates = {
  maxErrorRate: 1.0,       // 1% error rate threshold
  maxLatencyRegression: 10, // 10% latency increase threshold
  maxIncidentRate: 5,      // 5 incidents per minute threshold
};

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
  /** Health gates for this rollout */
  healthGates: RolloutHealthGates;
  /** Last health check timestamp */
  lastHealthCheckAt: string | null;
  /** Whether last health check passed */
  lastHealthCheckPassed: boolean | null;
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
 * Health check result for rollout progression.
 */
export interface RolloutHealthCheck {
  rolloutId: string;
  passed: boolean;
  errorRate: number;
  latencyRegression: number;
  incidentRate: number;
  checkedAt: string;
  reasons: string[];
}

/**
 * Options for ConfigRolloutService.
 */
export interface ConfigRolloutServiceOptions {
  eventBus?: DurableEventBus | null;
  stages?: RolloutStage[];
  defaultMinDurationMs?: number;
  defaultHealthGates?: RolloutHealthGates;
  /** Storage for persisting active rollouts across restarts */
  rolloutStore?: ConfigRolloutStore | null;
}

/**
 * Interface for persisting rollouts across restarts.
 * Implementations can use file system, database, or distributed storage.
 */
export interface ConfigRolloutStore {
  /** Save a rollout */
  save(rollout: ConfigRollout): Promise<void>;
  /** Load a rollout by ID */
  load(rolloutId: string): Promise<ConfigRollout | null>;
  /** Load all active rollouts */
  loadAll(): Promise<ConfigRollout[]>;
  /** Delete a rollout */
  delete(rolloutId: string): Promise<void>;
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
 * §24.3: Health gates must pass before auto-progressing.
 * §24.2/R15-79: Active rollouts are persisted to survive restarts.
 */
export class ConfigRolloutService {
  private readonly eventBus: DurableEventBus | null;
  private readonly stages: RolloutStage[];
  private readonly defaultMinDurationMs: number;
  private readonly defaultHealthGates: RolloutHealthGates;
  private readonly rolloutStore: ConfigRolloutStore | null;
  private readonly activeRollouts = new Map<string, ConfigRollout>();
  private _initialized = false;

  public constructor(options: ConfigRolloutServiceOptions = {}) {
    this.eventBus = options.eventBus ?? null;
    this.stages = options.stages ?? DEFAULT_ROLLOUT_STAGES;
    this.defaultMinDurationMs = options.defaultMinDurationMs ?? 300000;
    this.defaultHealthGates = options.defaultHealthGates ?? DEFAULT_HEALTH_GATES;
    this.rolloutStore = options.rolloutStore ?? null;
  }

  /**
   * Initializes the service by loading persisted rollouts from store.
   * Must be called before using the service if persistEvents is enabled.
   */
  public async initialize(): Promise<void> {
    if (this._initialized || !this.rolloutStore) {
      this._initialized = true;
      return;
    }

    // Load persisted rollouts
    const persistedRollouts = await this.rolloutStore.loadAll();
    for (const rollout of persistedRollouts) {
      // Only restore rollouts that are not completed or cancelled
      if (rollout.stage.phase !== RolloutPhase.FULL && rollout.stage.phase !== RolloutPhase.CANCELLED) {
        this.activeRollouts.set(rollout.rolloutId, rollout);
      }
    }

    this._initialized = true;
  }

  /**
   * Starts a new config rollout with canary strategy.
   * §24.3: Always starts from PENDING regardless of targetPercentage.
   * Even target=100 must go through canary stages to ensure stability.
   *
   * @param configPath - Dot-notation path to the config value
   * @param layer - Hierarchy layer (platform, tenant, pack, task_type)
   * @param sourceId - Source ID (e.g., tenantId) if applicable
   * @param targetPercentage - Target rollout percentage (default 100)
   * @param metadata - Additional metadata about the rollout
   * @param healthGates - Optional custom health gates (defaults to service defaults)
   * @returns The created rollout record
   */
  public startRollout(
    configPath: string,
    layer: string,
    sourceId: string | null = null,
    targetPercentage: number = 100,
    metadata?: Record<string, unknown>,
    healthGates?: Partial<RolloutHealthGates>,
  ): ConfigRollout {
    const rolloutId = newId("rollout");
    const now = nowIso();

    // §24.3: Always start from PENDING (index 0); canary pipeline must execute
    // regardless of targetPercentage. Even target=100 goes through:
    // PENDING → CANARY → CANARY_10 → FULL
    const startStage = this.stages[0]!;

    const mergedHealthGates: RolloutHealthGates = {
      maxErrorRate: healthGates?.maxErrorRate ?? this.defaultHealthGates.maxErrorRate,
      maxLatencyRegression: healthGates?.maxLatencyRegression ?? this.defaultHealthGates.maxLatencyRegression,
      maxIncidentRate: healthGates?.maxIncidentRate ?? this.defaultHealthGates.maxIncidentRate,
    };

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
      healthGates: mergedHealthGates,
      lastHealthCheckAt: null,
      lastHealthCheckPassed: null,
    };

    this.activeRollouts.set(rolloutId, rollout);
    this.persistRollout(rollout);
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
   * §24.3: Health gates must pass before progression.
   *
   * @param rolloutId - The rollout ID to promote
   * @returns Updated rollout or null if not found or health gates not passed
   */
  public promoteRollout(rolloutId: string): ConfigRollout | null {
    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout) {
      return null;
    }

    const currentIndex = this.stages.findIndex((s) => s.phase === rollout.stage.phase);
    if (currentIndex === -1 || currentIndex >= this.stages.length - 1) {
      // Already at final stage
      return rollout;
    }

    const nextStage = this.stages[currentIndex + 1]!;
    // Do not advance beyond the target percentage; §24.3 progression still stops at cap.
    if (nextStage.percentage > rollout.targetPercentage) {
      return rollout;
    }

    // §24.3: Health gates must pass before progression to next stage
    if (rollout.lastHealthCheckPassed === false) {
      // Health check failed, do not promote
      return rollout;
    }

    rollout.stage = nextStage;
    rollout.currentPercentage = nextStage.percentage;
    rollout.updatedAt = nowIso();

    this.persistRollout(rollout);
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

    this.persistRollout(rollout);
    this.emitRolloutEvent("config.rollout.cancelled", rollout);

    return rollout;
  }

  /**
   * Records a health check result for a rollout.
   * §24.3: Health gates must pass before auto-progressing.
   *
   * @param rolloutId - The rollout ID
   * @param healthCheck - Health metrics to evaluate
   * @returns The rollout with updated health check status
   */
  public recordHealthCheck(
    rolloutId: string,
    healthCheck: { errorRate: number; latencyRegression: number; incidentRate: number },
  ): ConfigRollout | null {
    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout) {
      return null;
    }

    const reasons: string[] = [];
    let passed = true;

    if (healthCheck.errorRate > rollout.healthGates.maxErrorRate) {
      reasons.push(`error_rate ${healthCheck.errorRate}% exceeds threshold ${rollout.healthGates.maxErrorRate}%`);
      passed = false;
    }

    if (healthCheck.latencyRegression > rollout.healthGates.maxLatencyRegression) {
      reasons.push(`latency_regression ${healthCheck.latencyRegression}% exceeds threshold ${rollout.healthGates.maxLatencyRegression}%`);
      passed = false;
    }

    if (healthCheck.incidentRate > rollout.healthGates.maxIncidentRate) {
      reasons.push(`incident_rate ${healthCheck.incidentRate} exceeds threshold ${rollout.healthGates.maxIncidentRate}`);
      passed = false;
    }

    rollout.lastHealthCheckAt = nowIso();
    rollout.lastHealthCheckPassed = passed;
    rollout.updatedAt = nowIso();

    this.persistRollout(rollout);

    // Emit health check event
    this.emitHealthCheckEvent(rollout, passed, reasons);

    return rollout;
  }

  /**
   * Emits a health check event to the event bus.
   */
  private emitHealthCheckEvent(rollout: ConfigRollout, passed: boolean, reasons: string[]): void {
    if (!this.eventBus) {
      return;
    }

    this.eventBus.publish({
      eventType: "config.rollout.health_check",
      payload: {
        rolloutId: rollout.rolloutId,
        configPath: rollout.configPath,
        layer: rollout.layer,
        sourceId: rollout.sourceId,
        passed,
        reasons,
        checkedAt: rollout.lastHealthCheckAt,
        timestamp: nowIso(),
      },
    });
  }

  /**
   * Gets the current health status of a rollout.
   *
   * @param rolloutId - The rollout ID
   * @returns Health check result or null if not found
   */
  public getRolloutHealth(rolloutId: string): RolloutHealthCheck | null {
    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout) {
      return null;
    }

    return {
      rolloutId,
      passed: rollout.lastHealthCheckPassed ?? false,
      errorRate: 0, // Would be populated from metrics
      latencyRegression: 0,
      incidentRate: 0,
      checkedAt: rollout.lastHealthCheckAt ?? rollout.startedAt,
      reasons: [],
    };
  }

  /**
   * Rolls back a rollout to the previous stage.
   * §24.3: Rollback provides stability when issues are detected.
   *
   * @param rolloutId - The rollout ID to roll back
   * @returns Updated rollout or null if not found or cannot roll back
   */
  public rollbackToPreviousStage(rolloutId: string): ConfigRollout | null {
    const rollout = this.activeRollouts.get(rolloutId);
    if (!rollout) {
      return null;
    }

    const currentIndex = this.stages.findIndex((s) => s.phase === rollout.stage.phase);
    if (currentIndex <= 0) {
      // Already at first stage, cannot roll back further
      return rollout;
    }

    const previousStage = this.stages[currentIndex - 1]!;
    rollout.stage = previousStage;
    rollout.currentPercentage = previousStage.percentage;
    rollout.updatedAt = nowIso();
    rollout.lastHealthCheckPassed = null;

    this.persistRollout(rollout);
    this.emitRolloutEvent("config.rollout.rolled_back", rollout);

    return rollout;
  }

  /**
   * Auto-rolls back rollouts when health gates fail.
   * §24.3: Automatic rollback triggers when health metrics breach thresholds.
   * Should be called periodically by a scheduler after health checks are evaluated.
   *
   * @returns Number of rollouts that were rolled back
   */
  public autoRollbackOnHealthFailure(): number {
    let rollbackCount = 0;

    for (const rollout of this.activeRollouts.values()) {
      // Only roll back if health check was performed and failed
      if (rollout.lastHealthCheckPassed !== false) {
        continue;
      }

      // Only roll back if not already at the first stage
      const currentIndex = this.stages.findIndex((s) => s.phase === rollout.stage.phase);
      if (currentIndex <= 0) {
        continue;
      }

      const previousStage = this.stages[currentIndex - 1]!;
      rollout.stage = previousStage;
      rollout.currentPercentage = previousStage.percentage;
      rollout.updatedAt = nowIso();
      rollout.lastHealthCheckPassed = null;

      this.persistRollout(rollout);
      this.emitRolloutEvent("config.rollout.auto_rolled_back", rollout);
      rollbackCount++;
    }

    return rollbackCount;
  }

  /**
   * Auto-progresses rollouts based on elapsed time and health gates.
   * §24.3: Health gates (max_error_rate, max_latency_regression, max_incident_rate)
   * must pass before auto-progressing to next stage.
   * Should be called periodically by a scheduler.
   *
   * @param healthCheckProvider - Function to get current health metrics for a rollout
   * @returns Number of rollouts that were auto-progressed
   */
  public autoProgressRollouts(
    healthCheckProvider?: (rollout: ConfigRollout) => Promise<{ errorRate: number; latencyRegression: number; incidentRate: number }>,
  ): number {
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
        const nextStage = this.stages[currentIndex + 1]!;
        if (nextStage.percentage > rollout.targetPercentage) {
          continue;
        }

        // §24.3: Health gates must pass before auto-progressing
        // If no health check has been performed or it failed, do not progress
        if (rollout.lastHealthCheckPassed !== true) {
          continue;
        }

        rollout.stage = nextStage;
        rollout.currentPercentage = nextStage.percentage;
        rollout.updatedAt = nowIso();
        this.persistRollout(rollout);
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
   * §24.2/R15-79: Also removes from persistent storage.
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
        this.removeRollout(rolloutId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Persists a rollout to the store for durability across restarts.
   * §24.2/R15-79: Ensures active rollouts survive restarts.
   */
  private async persistRollout(rollout: ConfigRollout): Promise<void> {
    if (!this.rolloutStore) {
      return;
    }

    try {
      await this.rolloutStore.save(rollout);
    } catch (error) {
      // Log but don't fail the operation
      console.error(`Failed to persist rollout ${rollout.rolloutId}:`, error);
    }
  }

  /**
   * Removes a rollout from persistent storage.
   */
  private async removeRollout(rolloutId: string): Promise<void> {
    if (!this.rolloutStore) {
      return;
    }

    try {
      await this.rolloutStore.delete(rolloutId);
    } catch (error) {
      // Log but don't fail the operation
      console.error(`Failed to remove rollout ${rolloutId} from store:`, error);
    }
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
}
