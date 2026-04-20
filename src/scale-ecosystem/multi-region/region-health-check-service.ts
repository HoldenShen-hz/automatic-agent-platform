/**
 * Region Health Check Service
 *
 * Implements region health monitoring for multi-region failover.
 * Complements §52 CDC replication with automatic health-based failover.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §59
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";

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
   */
  public async checkAllRegions(): Promise<readonly RegionHealthCheckResult[]> {
    const results: RegionHealthCheckResult[] = [];

    for (const regionId of this.configs.keys()) {
      const result = await this.checkRegion(regionId);
      results.push(result);
    }

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
   * Perform the actual health check
   */
  private async performHealthCheck(
    config: RegionHealthCheckConfig,
  ): Promise<{ metrics: HealthCheckMetric[] }> {
    // Simulate health check metrics
    // In production, this would actually ping endpoints and collect metrics
    const metrics: HealthCheckMetric[] = [
      {
        metricName: "latency",
        value: Math.random() * config.thresholds.maxLatencyMs,
        threshold: config.thresholds.maxLatencyMs,
        isHealthy: true,
      },
      {
        metricName: "error_rate",
        value: Math.random() * 0.1,
        threshold: config.thresholds.maxErrorRate,
        isHealthy: true,
      },
    ];

    return { metrics };
  }

  /**
   * Determine overall status from metrics
   */
  private determineStatus(metrics: HealthCheckMetric[], latencyMs: number): RegionHealthStatus {
    if (metrics.length === 0) {
      return "unhealthy";
    }

    const unhealthyMetrics = metrics.filter((m) => !m.isHealthy);
    if (unhealthyMetrics.length > 0) {
      return "degraded";
    }

    const config = this.configs.get(metrics[0]?.metricName);
    if (config && latencyMs > config.thresholds.maxLatencyMs) {
      return "degraded";
    }

    return "healthy";
  }

  /**
   * Update health state after a check
   */
  private updateHealthState(regionId: string, result: RegionHealthCheckResult): void {
    this.healthResults.set(regionId, result);
    this.lastCheckTime.set(regionId, result.checkedAt);

    if (result.status === "healthy") {
      this.consecutiveFailures.set(regionId, 0);
    }
  }
}

/**
 * Region failover orchestrator
 *
 * Coordinates automatic failover based on health checks.
 */
export class RegionFailoverOrchestrator {
  private readonly healthCheckService: RegionHealthCheckService;
  private readonly failoverListeners = new Set<(regionId: string, targetRegionId: string) => void>();

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

    // Select region with lowest latency
    let bestRegion: string | null = null;
    let lowestLatency = Infinity;

    for (const regionId of healthyRegions) {
      const summary = this.healthCheckService.getHealthSummary(regionId);
      if (summary && summary.overallLatencyMs < lowestLatency) {
        lowestLatency = summary.overallLatencyMs;
        bestRegion = regionId;
      }
    }

    return bestRegion;
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
        console.error(`Failover listener error: ${error}`);
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
