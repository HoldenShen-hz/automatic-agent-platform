/**
 * Composite Health Score Service
 *
 * Per §9/§27: Provides weighted multi-dimensional numerical HealthScore
 * combining multiple health indicators into a single 0-100 score.
 */

import { newId, nowIso } from "../contracts/types/ids.js";

/**
 * Health status levels (legacy 4-level for backward compatibility).
 */
export type HealthStatus = "ok" | "degraded" | "overloaded" | "unhealthy";

/**
 * Health indicator categories.
 */
export type HealthDimension =
  | "system"
  | "execution"
  | "queue"
  | "storage"
  | "network"
  | "compute"
  | "memory";

/**
 * Individual health indicator.
 */
export interface HealthIndicator {
  /** Unique indicator ID */
  indicatorId: string;
  /** Dimension/category */
  dimension: HealthDimension;
  /** Human-readable name */
  name: string;
  /** Current raw value */
  rawValue: number;
  /** Normalized score (0-100) */
  score: number;
  /** Weight in composite calculation (0-1) */
  weight: number;
  /** When this was last updated */
  updatedAt: string;
  /** Whether this indicator is healthy */
  isHealthy: boolean;
}

/**
 * Composite health score result.
 */
export interface HealthScore {
  /** Overall composite score (0-100 weighted) */
  overallScore: number;
  /** Legacy status for backward compatibility */
  status: HealthStatus;
  /** Individual indicator scores */
  indicators: HealthIndicator[];
  /** Score by dimension */
  dimensionScores: Record<HealthDimension, number>;
  /** When this score was computed */
  computedAt: string;
  /** Whether all indicators are healthy */
  isHealthy: boolean;
  /** Trace ID for debugging */
  traceId: string;
}

/**
 * Health threshold configuration.
 */
export interface HealthThresholds {
  /** Score below this is unhealthy (default: 40) */
  unhealthyThreshold: number;
  /** Score below this is degraded (default: 70) */
  degradedThreshold: number;
  /** Score above this may indicate overloaded (default: 90) */
  overloadedThreshold: number;
}

/**
 * Options for CompositeHealthScoreService.
 */
export interface CompositeHealthScoreServiceOptions {
  /** Custom health thresholds */
  thresholds?: Partial<HealthThresholds>;
  /** Default weight per dimension */
  defaultWeights?: Partial<Record<HealthDimension, number>>;
}

/**
 * Service for computing composite health scores.
 *
 * Per §9/§27: Implements weighted multi-dimensional numerical HealthScore
 * combining system, execution, queue, storage, network, compute, and memory
 * indicators into a single 0-100 score.
 */
export class CompositeHealthScoreService {
  private readonly thresholds: HealthThresholds;
  private readonly defaultWeights: Record<HealthDimension, number>;

  /** Registered health indicators by ID */
  private readonly indicators = new Map<string, HealthIndicator>();

  /** Last computed health score (cached) */
  private lastHealthScore: HealthScore | null = null;

  public constructor(options: CompositeHealthScoreServiceOptions = {}) {
    this.thresholds = {
      unhealthyThreshold: options.thresholds?.unhealthyThreshold ?? 40,
      degradedThreshold: options.thresholds?.degradedThreshold ?? 70,
      overloadedThreshold: options.thresholds?.overloadedThreshold ?? 90,
    };

    // Default weights per dimension (must sum to 1.0)
    this.defaultWeights = {
      system: 0.15,
      execution: 0.25,
      queue: 0.15,
      storage: 0.15,
      network: 0.10,
      compute: 0.10,
      memory: 0.10,
      ...options.defaultWeights,
    };
  }

  /**
   * Registers a health indicator.
   *
   * @param dimension - Health dimension
   * @param name - Indicator name
   * @param rawValue - Current raw value
   * @param weight - Optional weight override
   * @returns The registered indicator
   */
  public registerIndicator(
    dimension: HealthDimension,
    name: string,
    rawValue: number,
    weight?: number,
  ): HealthIndicator {
    const indicatorId = newId("hlt");

    const indicator: HealthIndicator = {
      indicatorId,
      dimension,
      name,
      rawValue,
      score: this.normalizeScore(rawValue, dimension),
      weight: weight ?? this.defaultWeights[dimension] ?? 0.1,
      updatedAt: nowIso(),
      isHealthy: true,
    };

    this.indicators.set(indicatorId, indicator);
    this.lastHealthScore = null; // Invalidate cache

    return indicator;
  }

  /**
   * Updates a health indicator's raw value.
   *
   * @param indicatorId - Indicator to update
   * @param rawValue - New raw value
   */
  public updateIndicator(indicatorId: string, rawValue: number): void {
    const indicator = this.indicators.get(indicatorId);
    if (!indicator) {
      return;
    }

    indicator.rawValue = rawValue;
    indicator.score = this.normalizeScore(rawValue, indicator.dimension);
    indicator.updatedAt = nowIso();
    indicator.isHealthy = indicator.score >= this.thresholds.degradedThreshold;
    this.lastHealthScore = null; // Invalidate cache
  }

  /**
   * Removes a health indicator.
   *
   * @param indicatorId - Indicator to remove
   */
  public removeIndicator(indicatorId: string): void {
    this.indicators.delete(indicatorId);
    this.lastHealthScore = null;
  }

  /**
   * Gets the current composite health score.
   *
   * @param forceRecompute - Force recomputation even if cached
   * @returns The composite health score
   */
  public getHealthScore(forceRecompute = false): HealthScore {
    if (!forceRecompute && this.lastHealthScore) {
      return this.lastHealthScore;
    }

    const indicators = Array.from(this.indicators.values());
    if (indicators.length === 0) {
      this.lastHealthScore = {
        overallScore: 100,
        status: "ok",
        indicators,
        dimensionScores: {
          system: 100,
          execution: 100,
          queue: 100,
          storage: 100,
          network: 100,
          compute: 100,
          memory: 100,
        },
        computedAt: nowIso(),
        isHealthy: true,
        traceId: newId("htrace"),
      };
      return this.lastHealthScore;
    }
    const dimensionScores = this.computeDimensionScores(indicators);
    const overallScore = this.computeOverallScore(indicators);
    const status = this.determineStatus(overallScore);

    this.lastHealthScore = {
      overallScore,
      status,
      indicators,
      dimensionScores,
      computedAt: nowIso(),
      isHealthy: status === "ok" || status === "degraded",
      traceId: newId("htrace"),
    };

    return this.lastHealthScore;
  }

  /**
   * Gets all registered indicators.
   */
  public getIndicators(): HealthIndicator[] {
    return Array.from(this.indicators.values());
  }

  /**
   * Gets indicators filtered by dimension.
   */
  public getIndicatorsByDimension(dimension: HealthDimension): HealthIndicator[] {
    return Array.from(this.indicators.values()).filter(
      (ind) => ind.dimension === dimension,
    );
  }

  /**
   * Normalizes a raw value to a 0-100 score based on dimension.
   */
  private normalizeScore(rawValue: number, dimension: HealthDimension): number {
    // Dimension-specific normalization logic
    switch (dimension) {
      case "system":
        // System health: higher is better (0-100 scale where 100 is perfect)
        return Math.min(100, Math.max(0, rawValue));

      case "execution":
        // Execution success rate: percentage (0-100)
        return Math.min(100, Math.max(0, rawValue));

      case "queue":
        // Queue depth: lower is better (0 = empty = 100, 100+ = 0)
        if (rawValue <= 0) return 100;
        if (rawValue >= 100) return 0;
        return 100 - rawValue;

      case "storage":
        // Storage usage: lower is better (0 = empty = 100, 100 = full = 0)
        if (rawValue <= 0) return 100;
        if (rawValue >= 100) return 0;
        return 100 - rawValue;

      case "network":
        // Network latency: lower is better (0ms = 100, 1000ms+ = 0)
        if (rawValue <= 0) return 100;
        if (rawValue >= 1000) return 0;
        return 100 - (rawValue / 1000) * 100;

      case "compute":
        // CPU usage: lower is better (0% = 100, 100% = 0)
        if (rawValue <= 0) return 100;
        if (rawValue >= 100) return 0;
        return 100 - rawValue;

      case "memory":
        // Memory usage: lower is better (0% = 100, 100% = 0)
        if (rawValue <= 0) return 100;
        if (rawValue >= 100) return 0;
        return 100 - rawValue;

      default:
        return 50; // Unknown dimension defaults to neutral
    }
  }

  /**
   * Computes scores per dimension by averaging indicator scores.
   */
  private computeDimensionScores(
    indicators: HealthIndicator[],
  ): Record<HealthDimension, number> {
    const dimensionScores: Record<HealthDimension, number> = {
      system: 0,
      execution: 0,
      queue: 0,
      storage: 0,
      network: 0,
      compute: 0,
      memory: 0,
    };

    const dimensionCounts: Record<HealthDimension, number> = {
      system: 0,
      execution: 0,
      queue: 0,
      storage: 0,
      network: 0,
      compute: 0,
      memory: 0,
    };

    for (const indicator of indicators) {
      dimensionScores[indicator.dimension] += indicator.score;
      dimensionCounts[indicator.dimension]++;
    }

    // Average scores per dimension
    for (const dim of Object.keys(dimensionScores) as HealthDimension[]) {
      if (dimensionCounts[dim] > 0) {
        dimensionScores[dim] = dimensionScores[dim] / dimensionCounts[dim];
      } else {
        dimensionScores[dim] = 100; // Default to healthy if no indicators
      }
    }

    return dimensionScores;
  }

  /**
   * Computes the weighted overall score.
   */
  private computeOverallScore(indicators: HealthIndicator[]): number {
    if (indicators.length === 0) {
      return 100; // No indicators = assume healthy
    }

    // Sum weights for normalization
    const totalWeight = indicators.reduce((sum, ind) => sum + ind.weight, 0);
    if (totalWeight === 0) {
      return 100;
    }

    // Weighted average
    let weightedSum = 0;
    for (const indicator of indicators) {
      weightedSum += (indicator.weight / totalWeight) * indicator.score;
    }

    return Math.round(weightedSum * 100) / 100;
  }

  /**
   * Determines the legacy health status from the score.
   */
  private determineStatus(score: number): HealthStatus {
    if (score < this.thresholds.unhealthyThreshold) {
      return "unhealthy";
    }
    if (score < this.thresholds.degradedThreshold) {
      return "degraded";
    }
    if (score >= this.thresholds.overloadedThreshold) {
      return "overloaded";
    }
    return "ok";
  }
}
