/**
 * Config Rollout Service
 *
 * Implements canary rollout strategy for configuration changes.
 * Supports gradual rollout phases: 0% → 5% → 25% → 50% → 100%
 *
 * Also emits config.changed events to the event bus when configs are updated.
 */

import { createHash } from "node:crypto";

import { DurableEventBus } from "../../five-plane-state-evidence/events/durable-event-bus.js";
import { MS_PER_DAY } from "../../contracts/constants/time.js";
import { ValidationError } from "../../contracts/errors.js";
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
  healthGates?: HealthGateConfig;
  lastHealthCheckAt?: string | null;
  lastHealthCheckPassed?: boolean | null;
  lastObservedErrorRate?: number | null;
  lastObservedLatencyRegression?: number | null;
  lastObservedIncidentRate?: number | null;
  lastHealthCheckReasons?: readonly string[];
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
  store?: ConfigRolloutStore | null;
  stages?: RolloutStage[];
  defaultMinDurationMs?: number;
  healthThresholds?: {
    maxErrorRate: number;
    maxLatencyRegression: number;
    maxIncidentRate: number;
  };
}

export interface RolloutHealthSnapshot {
  errorRate: number;
  latencyRegression: number;
  incidentRate: number;
}

export interface HealthGateConfig {
  maxErrorRate?: number;
  maxLatencyRegression?: number;
  maxIncidentRate?: number;
}

export interface ConfigRolloutStore {
  save(rollout: ConfigRollout): void;
  loadAll(): ConfigRollout[];
  delete(rolloutId: string): void;
}

function toFiniteThreshold(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseHealthGateValue(
  healthGates: Record<string, unknown> | undefined,
  key: keyof HealthGateConfig,
  maxInclusive: number,
): number | undefined {
  const value = healthGates?.[key];
  if (value == null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maxInclusive) {
    throw new ValidationError(
      "config_rollout.invalid_health_gate",
      `config_rollout.invalid_health_gate:${String(key)}`,
      {
        details: { key, value, maxInclusive },
        retryable: false,
      },
    );
  }
  return value;
}

function normalizeHealthGates(healthGates?: Record<string, unknown>): HealthGateConfig | undefined {
  if (healthGates == null) {
    return undefined;
  }
  return {
    ...(parseHealthGateValue(healthGates, "maxErrorRate", 1) === undefined ? {} : { maxErrorRate: parseHealthGateValue(healthGates, "maxErrorRate", 1) }),
    ...(parseHealthGateValue(healthGates, "maxLatencyRegression", 10) === undefined ? {} : { maxLatencyRegression: parseHealthGateValue(healthGates, "maxLatencyRegression", 10) }),
    ...(parseHealthGateValue(healthGates, "maxIncidentRate", 1) === undefined ? {} : { maxIncidentRate: parseHealthGateValue(healthGates, "maxIncidentRate", 1) }),
  };
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
  private readonly store: ConfigRolloutStore | null;
  private readonly stages: RolloutStage[];
  private readonly defaultMinDurationMs: number;
  private readonly healthThresholds: {
    maxErrorRate: number;
    maxLatencyRegression: number;
    maxIncidentRate: number;
  };
  private readonly activeRollouts = new Map<string, ConfigRollout>();

  public constructor(options: ConfigRolloutServiceOptions = {}) {
    this.eventBus = options.eventBus ?? null;
    this.store = options.store ?? null;
    this.stages = options.stages ?? DEFAULT_ROLLOUT_STAGES;
    this.defaultMinDurationMs = options.defaultMinDurationMs ?? 300000;
    this.healthThresholds = options.healthThresholds ?? {
      maxErrorRate: 0.05,
      maxLatencyRegression: 0.2,
      maxIncidentRate: 0.02,
    };
    for (const rollout of this.store?.loadAll() ?? []) {
      this.activeRollouts.set(rollout.rolloutId, rollout);
    }
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
    healthGates?: Record<string, unknown>,
  ): ConfigRollout {
    const rolloutId = newId("rollout");
    const now = nowIso();

    const startStage = this.resolveInitialStage(targetPercentage);

    const normalizedHealthGates = normalizeHealthGates(healthGates);
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
      ...(normalizedHealthGates !== undefined ? { healthGates: normalizedHealthGates } : {}),
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
    const updatedRollout: ConfigRollout = {
      ...rollout,
      stage: nextStage,
      currentPercentage: nextStage.percentage,
      updatedAt: nowIso(),
    };

    this.persistRollout(updatedRollout);
    this.activeRollouts.set(rolloutId, updatedRollout);
    this.emitRolloutEvent("config.rollout.promoted", updatedRollout);

    return updatedRollout;
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

    const cancelledStage = this.stages.find((s) => s.phase === RolloutPhase.CANCELLED) ?? {
      phase: RolloutPhase.CANCELLED,
      percentage: 0,
      minDurationMs: 0,
      autoProgress: false,
    };
    const updatedRollout: ConfigRollout = {
      ...rollout,
      stage: cancelledStage,
      updatedAt: nowIso(),
    };

    this.persistRollout(updatedRollout);
    this.activeRollouts.set(rolloutId, updatedRollout);
    this.emitRolloutEvent("config.rollout.cancelled", updatedRollout);

    return updatedRollout;
  }

  /**
   * Auto-progresses rollouts based on elapsed time.
   * Should be called periodically by a scheduler.
   *
   * @returns Number of rollouts that were auto-progressed
   */
  public autoProgressRollouts(
    healthSnapshots: Record<string, RolloutHealthSnapshot> = {},
  ): number {
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
      const snapshot = healthSnapshots[rollout.rolloutId];
      const healthEvaluation = this.evaluateHealthGate(rollout, snapshot);
      const updatedRollout: ConfigRollout = {
        ...rollout,
        lastHealthCheckAt: nowIso(),
        lastHealthCheckPassed: healthEvaluation.passed,
        lastObservedErrorRate: snapshot?.errorRate ?? null,
        lastObservedLatencyRegression: snapshot?.latencyRegression ?? null,
        lastObservedIncidentRate: snapshot?.incidentRate ?? null,
        lastHealthCheckReasons: healthEvaluation.reasons,
      };

      if (elapsedMs < rollout.stage.minDurationMs || !healthEvaluation.passed) {
        this.persistRollout(updatedRollout);
        this.activeRollouts.set(rollout.rolloutId, updatedRollout);
        continue;
      }

      const nextStage = this.stages[currentIndex + 1]!;
      const promotedRollout: ConfigRollout = {
        ...updatedRollout,
        stage: nextStage,
        currentPercentage: nextStage.percentage,
        updatedAt: nowIso(),
      };
      this.persistRollout(promotedRollout);
      this.activeRollouts.set(rollout.rolloutId, promotedRollout);
      this.emitRolloutEvent("config.rollout.auto_progressed", promotedRollout);
      progressCount++;
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
  public cleanupRollouts(maxAgeMs: number = MS_PER_DAY): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;

    for (const [rolloutId, rollout] of this.activeRollouts.entries()) {
      const ageMs = Date.now() - new Date(rollout.updatedAt).getTime();
      if (ageMs >= maxAgeMs && (rollout.stage.phase === RolloutPhase.FULL || rollout.stage.phase === RolloutPhase.CANCELLED)) {
        this.activeRollouts.delete(rolloutId);
        this.store?.delete(rolloutId);
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
    const digest = createHash("sha256").update(hashValue).digest();
    const bucket = digest.readUInt32BE(0);
    return Math.floor((bucket / 0x1_0000_0000) * 100);
  }

  private resolveInitialStage(targetPercentage: number): RolloutStage {
    const pendingStage = this.stages.find((stage) => stage.phase === RolloutPhase.PENDING);
    if (targetPercentage <= 0 && pendingStage != null) {
      return pendingStage;
    }

    const progressiveStages = this.stages.filter((stage) => (
      stage.phase !== RolloutPhase.PENDING &&
      stage.phase !== RolloutPhase.CANCELLED
    ));
    if (progressiveStages.length === 0) {
      return this.stages[0]!;
    }

    // Full rollouts must still begin at the initial canary stage so that
    // health gates can observe 5%/25%/50% progression before 100%.
    if (targetPercentage >= 100) {
      return progressiveStages[0]!;
    }

    return progressiveStages.find((stage) => stage.percentage >= targetPercentage) ?? progressiveStages.at(-1)!;
  }

  private evaluateHealthGate(
    rollout: ConfigRollout,
    snapshot: RolloutHealthSnapshot | undefined,
  ): { passed: boolean; reasons: readonly string[] } {
    if (snapshot == null) {
      return { passed: false, reasons: ["missing_health_snapshot"] };
    }

      const thresholds = {
      maxErrorRate: toFiniteThreshold(rollout.healthGates?.maxErrorRate, this.healthThresholds.maxErrorRate),
      maxLatencyRegression: toFiniteThreshold(rollout.healthGates?.maxLatencyRegression, this.healthThresholds.maxLatencyRegression),
      maxIncidentRate: toFiniteThreshold(rollout.healthGates?.maxIncidentRate, this.healthThresholds.maxIncidentRate),
    };
    const reasons: string[] = [];
    if (snapshot.errorRate > thresholds.maxErrorRate) {
      reasons.push("error_rate_exceeded");
    }
    if (snapshot.latencyRegression > thresholds.maxLatencyRegression) {
      reasons.push("latency_regression_exceeded");
    }
    if (snapshot.incidentRate > thresholds.maxIncidentRate) {
      reasons.push("incident_rate_exceeded");
    }
    return {
      passed: reasons.length === 0,
      reasons,
    };
  }

  private persistRollout(rollout: ConfigRollout): void {
    this.store?.save(rollout);
  }
}
