/**
 * Region Health Check Service
 *
 * Implements region health monitoring for multi-region failover.
 * Complements §52 CDC replication with automatic health-based failover.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §59
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 200 });

/**
 * Region health status
 */
export type RegionHealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

/**
 * Health check metric
 */
export interface HealthCheckMetric {
  readonly metricName: string;
  readonly value: number;
  readonly threshold: number;
  readonly isHealthy: boolean;
}

/**
 * Region health check result
 */
export interface RegionHealthCheckResult {
  readonly regionId: string;
  readonly status: RegionHealthStatus;
  readonly checkedAt: string;
  readonly latencyMs: number;
  readonly metrics: readonly HealthCheckMetric[];
  readonly errorMessage?: string;
}

/**
 * Health check configuration for a region
 */
export interface RegionHealthCheckConfig {
  readonly regionId: string;
  readonly endpoint: string;
  readonly checkIntervalMs: number;
  readonly timeoutMs: number;
  readonly retryCount: number;
  readonly metricSnapshot?: {
    readonly latencyMs?: number;
    readonly errorRate?: number;
    readonly cpuUsage?: number;
    readonly memoryUsage?: number;
  };
  readonly thresholds: {
    readonly maxLatencyMs: number;
    readonly maxErrorRate: number;
    readonly maxCpuUsage: number;
    readonly maxMemoryUsage: number;
  };
}

/**
 * Region health summary
 */
export interface RegionHealthSummary {
  readonly regionId: string;
  readonly status: RegionHealthStatus;
  readonly lastCheckedAt: string;
  readonly consecutiveFailures: number;
  readonly overallLatencyMs: number;
  readonly isHealthyForFailover: boolean;
}

/**
 * Health check event types
 */
export const HEALTH_CHECK_EVENTS = [
  "region:health_check_passed",
  "region:health_check_failed",
  "region:health_degraded",
  "region:health_restored",
] as const;

/**
 * Region Health Check Service
 *
 * Monitors region health and determines if failover is needed.
 */
export class RegionHealthCheckService {
  private readonly configs = new Map<string, RegionHealthCheckConfig>();
  private readonly healthResults = new Map<string, RegionHealthCheckResult>();
  private readonly consecutiveFailures = new Map<string, number>();
  private readonly lastCheckTime = new Map<string, string>();

  /**
   * Register a region for health monitoring
   */
  public registerRegion(config: RegionHealthCheckConfig): void {
    this.configs.set(config.regionId, config);
    this.consecutiveFailures.set(config.regionId, 0);
  }

  /**
   * Unregister a region from health monitoring
   */
  public unregisterRegion(regionId: string): void {
    this.configs.delete(regionId);
    this.healthResults.delete(regionId);
    this.consecutiveFailures.delete(regionId);
    this.lastCheckTime.delete(regionId);
  }

  /**
   * Perform health check on a region
   */
  public async checkRegion(regionId: string): Promise<RegionHealthCheckResult> {
    const config = this.configs.get(regionId);

    if (!config) {
      return {
        regionId,
        status: "unknown",
        checkedAt: nowIso(),
        latencyMs: 0,
        metrics: [],
        errorMessage: "Region not registered",
      };
    }

    const startTime = Date.now();

    try {
      const result = await this.performHealthCheck(config);
      const latencyMs = Date.now() - startTime;

      const healthResult: RegionHealthCheckResult = {
        regionId,
        status: this.determineStatus(result.metrics, latencyMs),
        checkedAt: nowIso(),
        latencyMs,
        metrics: result.metrics,
      };

      this.updateHealthState(regionId, healthResult);
      return healthResult;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const failures = (this.consecutiveFailures.get(regionId) ?? 0) + 1;
      this.consecutiveFailures.set(regionId, failures);
      this.lastCheckTime.set(regionId, nowIso());

      return {
        regionId,
        status: "unhealthy",
        checkedAt: nowIso(),
        latencyMs,
        metrics: [],
        errorMessage: error instanceof Error ? error.message : "Health check failed",
      };
    }
  }

  /**
   * Get current health status for a region
   */
  public getHealthStatus(regionId: string): RegionHealthStatus {
    const result = this.healthResults.get(regionId);
    return result?.status ?? "unknown";
  }

  /**
   * Get health summary for a region
   */
  public getHealthSummary(regionId: string): RegionHealthSummary | null {
    const config = this.configs.get(regionId);
    const result = this.healthResults.get(regionId);
    const failures = this.consecutiveFailures.get(regionId) ?? 0;
    const lastChecked = this.lastCheckTime.get(regionId);

    if (!config) {
      return null;
    }

    const status = result?.status ?? "unknown";
    const isHealthyForFailover = status === "healthy" || status === "degraded";

    return {
      regionId,
      status,
      lastCheckedAt: lastChecked ?? nowIso(),
      consecutiveFailures: failures,
      overallLatencyMs: result?.latencyMs ?? 0,
      isHealthyForFailover,
    };
  }

  /**
   * Check if a region should failover
   */
  public shouldFailover(regionId: string): boolean {
    const summary = this.getHealthSummary(regionId);
    if (!summary) {
      return false;
    }

    // Failover if unhealthy or consecutive failures exceed threshold
    if (summary.status === "unhealthy") {
      return true;
    }

    const config = this.configs.get(regionId);
    if (config && summary.consecutiveFailures >= config.retryCount) {
      return true;
    }

    return false;
  }

  /**
   * Get all regions that need failover
   */
  public getRegionsNeedingFailover(): readonly string[] {
    const regionsNeedingFailover: string[] = [];

    for (const regionId of this.configs.keys()) {
      if (this.shouldFailover(regionId)) {
        regionsNeedingFailover.push(regionId);
      }
    }

    return regionsNeedingFailover;
  }

  /**
   * Check all registered regions
   * Root cause: Serial await causes linear delay with many regions
   * Fix: Use Promise.all for parallel execution
   */
  public async checkAllRegions(): Promise<readonly RegionHealthCheckResult[]> {
    const results = await Promise.all(
      [...this.configs.keys()].map((regionId) => this.checkRegion(regionId))
    );
    return results;
  }

  /**
   * Get health status for all regions
   */
  public getAllHealthStatuses(): Map<string, RegionHealthStatus> {
    const statuses = new Map<string, RegionHealthStatus>();

    for (const regionId of this.configs.keys()) {
      statuses.set(regionId, this.getHealthStatus(regionId));
    }

    return statuses;
  }

  /**
   * Reset health state for a region
   */
  public resetHealthState(regionId: string): void {
    this.consecutiveFailures.set(regionId, 0);
    this.healthResults.delete(regionId);
  }

  /**
   * Get configured thresholds for a region
   */
  public getThresholds(regionId: string) {
    const config = this.configs.get(regionId);
    return config?.thresholds;
  }

  /**
   * Perform the actual health check with real network probing per §52.5
   */
  private async performHealthCheck(
    config: RegionHealthCheckConfig,
  ): Promise<{ metrics: HealthCheckMetric[] }> {
    const snapshot = config.metricSnapshot ?? {};

    // Perform real network probe to measure latency
    let measuredLatencyMs = snapshot.latencyMs ?? null;
    if (measuredLatencyMs === null) {
      measuredLatencyMs = await this.measureNetworkLatency(config.endpoint);
    }

    const metrics: HealthCheckMetric[] = [
      {
        metricName: "latency",
        value: measuredLatencyMs,
        threshold: config.thresholds.maxLatencyMs,
        isHealthy: measuredLatencyMs <= config.thresholds.maxLatencyMs,
      },
      {
        metricName: "error_rate",
        value: snapshot.errorRate ?? 0,
        threshold: config.thresholds.maxErrorRate,
        isHealthy: (snapshot.errorRate ?? 0) <= config.thresholds.maxErrorRate,
      },
      {
        metricName: "cpu_usage",
        value: snapshot.cpuUsage ?? 0,
        threshold: config.thresholds.maxCpuUsage,
        isHealthy: (snapshot.cpuUsage ?? 0) <= config.thresholds.maxCpuUsage,
      },
      {
        metricName: "memory_usage",
        value: snapshot.memoryUsage ?? 0,
        threshold: config.thresholds.maxMemoryUsage,
        isHealthy: (snapshot.memoryUsage ?? 0) <= config.thresholds.maxMemoryUsage,
      },
    ];

    return { metrics };
  }

  /**
   * Measure actual network latency to a region endpoint per §52.5
   * Uses HTTP HEAD request to measure round-trip time
   */
  private async measureNetworkLatency(endpoint: string): Promise<number> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const start = Date.now();
      const response = await fetch(`${endpoint}/health`, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        return 5000; // Treat non-2xx as timeout
      }
      return Date.now() - start;
    } catch {
      clearTimeout(timeout);
      return 5000; // Treat errors as high latency
    }
  }

  /**
   * Determine overall status from metrics
   * §187-2193: Fixed equality comparison - latencyMs is a number, not a reference.
   * Changed from identity check (===) to value comparison with threshold.
   */
  private determineStatus(metrics: HealthCheckMetric[], latencyMs: number): RegionHealthStatus {
    if (metrics.length === 0) {
      return "unhealthy";
    }

    const unhealthyMetrics = metrics.filter((m) => !m.isHealthy);
    if (unhealthyMetrics.length > 0) {
      return "degraded";
    }

    const regionId = [...this.healthResults.entries()]
      .find(([, result]) =>
        result.metrics.length === metrics.length &&
        result.metrics.every((m, i) => {
          const other = metrics[i];
          return other !== undefined && m.metricName === other.metricName && m.value === other.value;
        })
      )?.[0];
    const config = regionId == null ? null : this.configs.get(regionId);
    // §187-2193: Fixed - was checking `latencyMs === config.thresholds.maxLatencyMs`
    // which is a dead equality check that never triggers degradation.
    // Changed to proper inequality check for exceeding threshold.
    if (config && latencyMs > config.thresholds.maxLatencyMs) {
      return "degraded";
    }

    return "healthy";
  }

  /**
   * Update health state after a check
   * §187-2199: Reset consecutiveFailures when region is "healthy" OR "degraded"
   * - "healthy": Clear failures, region is fully recovered
   * - "degraded": Clear failures since some metrics passed (partial recovery)
   * - "unhealthy": Do NOT reset - keep accumulating to drive failover
   */
  private updateHealthState(regionId: string, result: RegionHealthCheckResult): void {
    this.healthResults.set(regionId, result);
    this.lastCheckTime.set(regionId, result.checkedAt);

    // Reset failures for both healthy and degraded (metrics are passing)
    // Only keep accumulating for unhealthy status
    if (result.status === "healthy" || result.status === "degraded") {
      this.consecutiveFailures.set(regionId, 0);
    }
    // "unhealthy" status does NOT reset - failures keep accumulating
  }
}

/**
 * Helper function to select the region with lowest latency.
 * Used as fallback when election algorithm cannot determine a winner.
 */
function selectLowestLatencyRegion(
  regionIds: readonly string[],
  healthCheckService: RegionHealthCheckService,
): string | null {
  let bestRegion: string | null = null;
  let lowestLatency = Infinity;

  for (const regionId of regionIds) {
    const summary = healthCheckService.getHealthSummary(regionId);
    if (summary && summary.overallLatencyMs < lowestLatency) {
      lowestLatency = summary.overallLatencyMs;
      bestRegion = regionId;
    }
  }

  return bestRegion;
}

/**
 * Region failover orchestrator
 *
 * Coordinates automatic failover based on health checks.
 */
export class RegionFailoverOrchestrator {
  private readonly healthCheckService: RegionHealthCheckService;
  private readonly failoverListeners = new Set<(regionId: string, targetRegionId: string) => void>();
  private readonly regionPriorities = new Map<string, number>();

  public constructor(healthCheckService?: RegionHealthCheckService) {
    this.healthCheckService = healthCheckService ?? new RegionHealthCheckService();
  }

  /**
   * Get the health check service
   */
  public getHealthCheckService(): RegionHealthCheckService {
    return this.healthCheckService;
  }

  /**
   * Register a region for health monitoring
   */
  public registerRegion(config: RegionHealthCheckConfig): void {
    this.healthCheckService.registerRegion(config);
  }

  /**
   * Set region priority for election (higher = more likely to be elected)
   */
  public setRegionPriority(regionId: string, priority: number): void {
    this.regionPriorities.set(regionId, priority);
  }

  /**
   * Get region priority
   */
  public getRegionPriority(regionId: string): number {
    return this.regionPriorities.get(regionId) ?? 0;
  }

  /**
   * Elect a region as leader using a multi-factor election algorithm.
   * Factors: health status, latency, and configured priority.
   *
   * Returns the elected region ID or null if no suitable candidate.
   */
  public electRegion(candidateRegionIds: readonly string[]): string | null {
    if (candidateRegionIds.length === 0) {
      return null;
    }

    if (candidateRegionIds.length === 1) {
      // Single candidate - elect if healthy
      const summary = this.healthCheckService.getHealthSummary(candidateRegionIds[0]);
      return summary?.isHealthyForFailover ?? false ? candidateRegionIds[0] : null;
    }

    // Score each candidate based on multiple factors
    interface ScoredCandidate {
      regionId: string;
      score: number;
      healthScore: number;
      latencyScore: number;
      priorityScore: number;
    }

    const scoredCandidates: ScoredCandidate[] = [];

    for (const regionId of candidateRegionIds) {
      const summary = this.healthCheckService.getHealthSummary(regionId);
      const priority = this.getRegionPriority(regionId);

      // Health score: 100 for healthy, 50 for degraded, 0 for unhealthy
      let healthScore = 0;
      if (summary) {
        switch (summary.status) {
          case "healthy":
            healthScore = 100;
            break;
          case "degraded":
            healthScore = 50;
            break;
          case "unhealthy":
          case "unknown":
            healthScore = 0;
            break;
        }
      }

      // Latency score: lower latency = higher score (inverse relationship)
      // Max latency of 5000ms gets 0 score, 0ms gets 100 score
      const latencyScore = summary ? Math.max(0, 100 - (summary.overallLatencyMs / 50)) : 0;

      // Priority score: direct mapping of configured priority
      const priorityScore = priority;

      // Weighted total score
      // Health is most important (50%), then latency (30%), then priority (20%)
      const totalScore = (healthScore * 0.5) + (latencyScore * 0.3) + (priorityScore * 0.2);

      scoredCandidates.push({
        regionId,
        score: totalScore,
        healthScore,
        latencyScore,
        priorityScore,
      });
    }

    // Sort by score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Only return the top candidate if they have a non-zero health score
    const elected = scoredCandidates[0];
    if (elected && elected.healthScore > 0) {
      return elected.regionId;
    }

    return null;
  }

  /**
   * Select the best failover target from healthy regions
   */
  public selectFailoverTarget(
    sourceRegionId: string,
    availableRegions: readonly string[],
  ): string | null {
    // Filter to healthy regions excluding the source
    const healthyRegions = availableRegions.filter((regionId) => {
      if (regionId === sourceRegionId) {
        return false;
      }
      const summary = this.healthCheckService.getHealthSummary(regionId);
      return summary?.isHealthyForFailover ?? false;
    });

    if (healthyRegions.length === 0) {
      return null;
    }

    // Use election algorithm to select the best target
    return this.electRegion(healthyRegions) ?? selectLowestLatencyRegion(healthyRegions, this.healthCheckService);
  }

  /**
   * Orchestrate failover from source to target region
   */
  public async orchestrateFailover(
    sourceRegionId: string,
    availableRegions: readonly string[],
  ): Promise<{ success: boolean; targetRegionId: string | null; reason?: string }> {
    const targetRegionId = this.selectFailoverTarget(sourceRegionId, availableRegions);

    if (!targetRegionId) {
      return {
        success: false,
        targetRegionId: null,
        reason: "No healthy failover target available",
      };
    }

    // Notify listeners
    for (const listener of this.failoverListeners) {
      try {
        listener(sourceRegionId, targetRegionId);
      } catch (error) {
        logger.error(`Failover listener error`, { error: String(error) });
      }
    }

    return {
      success: true,
      targetRegionId,
    };
  }

  /**
   * Add failover listener
   */
  public addFailoverListener(listener: (regionId: string, targetRegionId: string) => void): void {
    this.failoverListeners.add(listener);
  }

  /**
   * Remove failover listener
   */
  public removeFailoverListener(listener: (regionId: string, targetRegionId: string) => void): void {
    this.failoverListeners.delete(listener);
  }

  /**
   * Check if failover is needed and orchestrate if necessary
   */
  public async checkAndFailover(
    primaryRegionId: string,
    availableRegions: readonly string[],
  ): Promise<{ didFailover: boolean; targetRegionId: string | null }> {
    // Check primary region health
    await this.healthCheckService.checkRegion(primaryRegionId);

    // Check if failover is needed
    if (!this.healthCheckService.shouldFailover(primaryRegionId)) {
      return { didFailover: false, targetRegionId: null };
    }

    // Orchestrate failover
    const result = await this.orchestrateFailover(primaryRegionId, availableRegions);

    return {
      didFailover: result.success,
      targetRegionId: result.targetRegionId,
    };
  }
}
