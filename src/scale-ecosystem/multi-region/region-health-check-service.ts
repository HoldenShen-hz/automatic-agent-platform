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
import { CircuitBreaker, CircuitState } from "../../platform/stability/circuit-breaker.js";
import { getRpoRtoTrackingService } from "./rpo-rto-tracking.js";

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

export interface FailoverRecord {
  readonly failoverId: string;
  readonly sourceRegionId: string;
  readonly targetRegionId: string;
  readonly recordedAt: string;
  readonly fencingEpoch: number;
  readonly reason: string;
  readonly status: "committed";
}

export interface FailoverControlEvent {
  readonly eventId: string;
  readonly eventType: "multi_region.failover_recorded" | "multi_region.fencing_epoch_changed";
  readonly sourceRegionId: string;
  readonly targetRegionId: string;
  readonly recordedAt: string;
  readonly fencingEpoch: number;
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
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();

  /**
   * Register a region for health monitoring
   */
  public registerRegion(config: RegionHealthCheckConfig): void {
    this.configs.set(config.regionId, config);
    this.consecutiveFailures.set(config.regionId, 0);
    // R21-04: Per-region circuit breaker with closed/open/half-open states
    this.circuitBreakers.set(
      config.regionId,
      new CircuitBreaker({
        failureThreshold: config.retryCount,
        resetTimeout: config.checkIntervalMs * 2,
      }),
    );
  }

  /**
   * Unregister a region from health monitoring
   */
  public unregisterRegion(regionId: string): void {
    this.configs.delete(regionId);
    this.healthResults.delete(regionId);
    this.consecutiveFailures.delete(regionId);
    this.lastCheckTime.delete(regionId);
    this.circuitBreakers.delete(regionId);
  }

  /**
   * Perform health check on a region
   */
  public async checkRegion(regionId: string): Promise<RegionHealthCheckResult> {
    const config = this.configs.get(regionId);
    const circuitBreaker = this.circuitBreakers.get(regionId);

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

    // R21-04: Check circuit breaker state before performing health check
    if (circuitBreaker && circuitBreaker.getState() === CircuitState.OPEN) {
      return {
        regionId,
        status: "unhealthy",
        checkedAt: nowIso(),
        latencyMs: 0,
        metrics: [],
        errorMessage: "Circuit breaker is OPEN - skipping health check",
      };
    }

    const startTime = Date.now();

    try {
      const result = await (circuitBreaker
        ? circuitBreaker.execute(() => this.performHealthCheck(config))
        : this.performHealthCheck(config));
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
    // R21-04: Also reset circuit breaker when health state is reset
    this.resetCircuitBreaker(regionId);
  }

  /**
   * Get configured thresholds for a region
   */
  public getThresholds(regionId: string) {
    const config = this.configs.get(regionId);
    return config?.thresholds;
  }

  /**
   * Get circuit breaker state for a region (R21-04)
   */
  public getCircuitBreakerState(regionId: string): CircuitState | null {
    const cb = this.circuitBreakers.get(regionId);
    return cb?.getState() ?? null;
  }

  /**
   * Get circuit breaker stats for a region (R21-04)
   */
  public getCircuitBreakerStats(regionId: string) {
    const cb = this.circuitBreakers.get(regionId);
    return cb?.getStats() ?? null;
  }

  /**
   * Reset circuit breaker for a region (R21-04)
   */
  public resetCircuitBreaker(regionId: string): void {
    const cb = this.circuitBreakers.get(regionId);
    if (cb) {
      cb.reset();
    }
  }

  /**
   * Perform the actual health check via real network probe
   */
  private async performHealthCheck(
    config: RegionHealthCheckConfig,
  ): Promise<{ metrics: HealthCheckMetric[] }> {
    const snapshot = config.metricSnapshot ?? {};

    // Perform real network probe if no snapshot is provided
    let measuredLatencyMs: number;
    if (snapshot.latencyMs != null) {
      measuredLatencyMs = snapshot.latencyMs;
    } else {
      measuredLatencyMs = await this.measureNetworkLatency(config.endpoint, config.timeoutMs);
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
   * Measure actual network latency to a region endpoint using HTTP HEAD request
   */
  private async measureNetworkLatency(endpoint: string, timeoutMs: number): Promise<number> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const startTime = Date.now();
    try {
      // Use HTTP HEAD request to measure latency with minimal payload
      const url = endpoint.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
      const response = await fetch(`${url}/health`, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent": "RegionHealthCheck/1.0",
        },
      });
      clearTimeout(timeout);
      // If response is received, calculate actual RTT
      return Date.now() - startTime;
    } catch {
      clearTimeout(timeout);
      // On error, return a high latency value to indicate unhealthy connection
      return timeoutMs + 1;
    }
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

    const regionId = [...this.healthResults.entries()]
      .find(([, result]) => result.metrics === metrics)?.[0];
    const config = regionId == null ? null : this.configs.get(regionId);
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
 * RTO breach error - thrown when failover duration exceeds RTO SLA
 */
export class RtoBreachError extends Error {
  constructor(
    public readonly sourceRegionId: string,
    public readonly targetRegionId: string,
    public readonly elapsedMs: number,
    public readonly rtoMs: number,
  ) {
    super(`RTO_BREACH:${sourceRegionId}->${targetRegionId} failover elapsed=${elapsedMs}ms exceeds RTO=${rtoMs}ms`);
    this.name = "RtoBreachError";
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
  private readonly failoverRecords: FailoverRecord[] = [];
  private readonly failoverEvents: FailoverControlEvent[] = [];
  private readonly fencingEpochByRegion = new Map<string, number>();
  /** Default RTO target in milliseconds (30 seconds per §52) */
  private readonly defaultRtoMs = 30_000;

  public constructor(healthCheckService?: RegionHealthCheckService) {
    this.healthCheckService = healthCheckService ?? new RegionHealthCheckService();
  }

  /**
   * Get the health check service
   */
  public getHealthCheckService(): RegionHealthCheckService {
    return this.healthCheckService;
  }

  public getFailoverRecords(): readonly FailoverRecord[] {
    return [...this.failoverRecords];
  }

  public getLatestFailoverRecord(): FailoverRecord | null {
    return this.failoverRecords[this.failoverRecords.length - 1] ?? null;
  }

  public getFailoverEvents(): readonly FailoverControlEvent[] {
    return [...this.failoverEvents];
  }

  public getFencingEpoch(sourceRegionId: string): number {
    return this.fencingEpochByRegion.get(sourceRegionId) ?? 0;
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
   * R21-06: Start tracking failover timer for RTO SLA compliance.
   * Returns the start timestamp for the failover.
   */
  public startFailoverTimer(
    sourceRegionId: string,
    targetRegionId: string,
  ): number {
    const key = `${sourceRegionId}:${targetRegionId}`;
    const startTime = Date.now();
    this.fencingEpochByRegion.set(`failover_start:${key}`, startTime);
    return startTime;
  }

  /**
   * R21-06: Get elapsed failover time in milliseconds.
   * Returns the time since failover was started, or 0 if not started.
   */
  public getFailoverElapsedMs(sourceRegionId: string, targetRegionId: string): number {
    const key = `${sourceRegionId}:${targetRegionId}`;
    const startTime = this.fencingEpochByRegion.get(`failover_start:${key}`);
    if (startTime == null) {
      return 0;
    }
    return Date.now() - startTime;
  }

  /**
   * R21-06: Assert failover completed within RTO SLA.
   * Throws RtoBreachError if failover duration exceeds the RTO target.
   * Used to enforce §52 RTO guarantees - RTO<30s SLA.
   */
  public assertFailoverWithinRto(
    sourceRegionId: string,
    targetRegionId: string,
    rtoMs = this.defaultRtoMs,
  ): void {
    const elapsedMs = this.getFailoverElapsedMs(sourceRegionId, targetRegionId);
    if (elapsedMs > rtoMs) {
      throw new RtoBreachError(sourceRegionId, targetRegionId, elapsedMs, rtoMs);
    }
  }

  /**
   * R21-06: Complete failover and assert RTO SLA compliance.
   * Throws RtoBreachError if the failover took longer than RTO target.
   */
  public completeFailoverWithRtoCheck(
    sourceRegionId: string,
    targetRegionId: string,
    rtoMs = this.defaultRtoMs,
  ): void {
    const elapsedMs = this.getFailoverElapsedMs(sourceRegionId, targetRegionId);
    const key = `${sourceRegionId}:${targetRegionId}`;
    this.fencingEpochByRegion.delete(`failover_start:${key}`);
    if (elapsedMs > rtoMs) {
      throw new RtoBreachError(sourceRegionId, targetRegionId, elapsedMs, rtoMs);
    }
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

    const recordedAt = nowIso();
    const fencingEpoch = (this.fencingEpochByRegion.get(sourceRegionId) ?? 0) + 1;
    this.fencingEpochByRegion.set(sourceRegionId, fencingEpoch);

    // R21-06: Track failover for RTO SLA compliance - start timer BEFORE failover
    const rpoRtoService = getRpoRtoTrackingService();
    const regionPairId = `${sourceRegionId}->${targetRegionId}`;
    rpoRtoService.startFailover(sourceRegionId, targetRegionId);
    this.startFailoverTimer(sourceRegionId, targetRegionId);

    const record: FailoverRecord = {
      failoverId: newId("failover"),
      sourceRegionId,
      targetRegionId,
      recordedAt,
      fencingEpoch,
      reason: "health_check_failover",
      status: "committed",
    };
    this.failoverRecords.push(record);
    this.failoverEvents.push({
      eventId: newId("failover_event"),
      eventType: "multi_region.failover_recorded",
      sourceRegionId,
      targetRegionId,
      recordedAt,
      fencingEpoch,
    });
    this.failoverEvents.push({
      eventId: newId("fencing_epoch"),
      eventType: "multi_region.fencing_epoch_changed",
      sourceRegionId,
      targetRegionId,
      recordedAt,
      fencingEpoch,
    });

    // Notify listeners
    for (const listener of this.failoverListeners) {
      try {
        listener(sourceRegionId, targetRegionId);
      } catch (error) {
        logger.error(`Failover listener error`, { error: String(error) });
      }
    }

    // R21-06: Complete failover tracking and assert RTO SLA compliance
    rpoRtoService.completeFailover(sourceRegionId, targetRegionId, true, null);

    // R21-06: Enforce RTO<30s SLA - throw if exceeded
    this.assertFailoverWithinRto(sourceRegionId, targetRegionId);

    try {
      rpoRtoService.assertSlaCompliance(regionPairId);
    } catch (slaError) {
      logger.error(`RTO SLA breach detected for ${regionPairId}`, { error: String(slaError) });
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
