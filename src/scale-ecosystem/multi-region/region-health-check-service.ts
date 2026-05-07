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
import type { DurableEventBusAsync } from "../runtime-services/durable-event-bus-async.js";

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
 * Failover event types
 */
export const FAILOVER_EVENTS = [
  "failover:start",
  "failover:progress",
  "failover:complete",
  "failover:failed",
] as const;

/**
 * Failover status values
 */
export type FailoverStatus = "started" | "in_progress" | "completed" | "failed";

/**
 * FailoverRecord event payload
 * Structured event emitted during failover orchestration.
 */
export interface FailoverRecord {
  readonly failoverId: string;
  readonly region: string;
  readonly timestamp: string;
  readonly status: FailoverStatus;
  readonly involvedResources: readonly string[];
  readonly targetRegion?: string;
  readonly errorMessage?: string;
}

/**
 * Circuit breaker states for per-region fault isolation.
 * §21-04: Implements closed/open/half_open state machine per region.
 */
type RegionCircuitBreakerState = "closed" | "open" | "half_open";

/**
 * Per-region circuit breaker configuration.
 */
interface RegionCircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit */
  failureThreshold: number;
  /** Milliseconds to wait before attempting half-open probe */
  resetTimeoutMs: number;
  /** Number of successful probes needed to close circuit from half_open */
  halfOpenSuccessThreshold: number;
}

/**
 * Per-region circuit breaker state machine.
 * Provides fault isolation by tracking region health with proper state transitions.
 */
class RegionCircuitBreaker {
  private state: RegionCircuitBreakerState = "closed";
  private consecutiveFailures: number = 0;
  private consecutiveSuccesses: number = 0;
  private nextAttemptAt: number | null = null;
  private halfOpenInFlight: number = 0;

  constructor(private readonly config: RegionCircuitBreakerConfig) {}

  /**
   * Check if a health check probe is allowed to execute.
   * Returns true if circuit is closed, or if in half_open with available probe slot.
   */
  public isRequestAllowed(): boolean {
    if (this.state === "closed") {
      return true;
    }

    if (this.state === "open") {
      if (this.nextAttemptAt != null && Date.now() >= this.nextAttemptAt) {
        this.state = "half_open";
        this.consecutiveSuccesses = 0;
        this.halfOpenInFlight = 1;
        return true;
      }
      return false;
    }

    // half_open state - allow at most one probe at a time
    if (this.halfOpenInFlight >= 1) {
      return false;
    }
    this.halfOpenInFlight++;
    return true;
  }

  /**
   * Record a successful health check.
   */
  public recordSuccess(): void {
    if (this.state === "half_open") {
      this.consecutiveSuccesses++;
      this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1);
      if (this.consecutiveSuccesses >= this.config.halfOpenSuccessThreshold) {
        this.state = "closed";
        this.consecutiveFailures = 0;
        this.consecutiveSuccesses = 0;
        this.nextAttemptAt = null;
      }
    } else if (this.state === "closed") {
      this.consecutiveFailures = 0;
    }
  }

  /**
   * Record a failed health check.
   */
  public recordFailure(): void {
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.halfOpenInFlight = 0;

    if (this.state === "closed" && this.consecutiveFailures >= this.config.failureThreshold) {
      this.state = "open";
      this.nextAttemptAt = Date.now() + this.config.resetTimeoutMs;
    } else if (this.state === "half_open") {
      // Any failure in half_open goes back to open
      this.state = "open";
      this.nextAttemptAt = Date.now() + this.config.resetTimeoutMs;
    }
  }

  /**
   * Get current circuit breaker state for observability.
   */
  public getState(): RegionCircuitBreakerState {
    return this.state;
  }

  /**
   * Get circuit breaker metrics for debugging/monitoring.
   */
  public getMetrics(): { state: RegionCircuitBreakerState; consecutiveFailures: number; consecutiveSuccesses: number } {
    return {
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
    };
  }

  /**
   * Reset the circuit breaker to closed state.
   * Used when health state is manually reset or region is re-registered.
   */
  public reset(): void {
    this.state = "closed";
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    this.nextAttemptAt = null;
    this.halfOpenInFlight = 0;
  }
}

/**
 * Default circuit breaker configuration per §21-04.
 */
const DEFAULT_REGION_CIRCUIT_BREAKER_CONFIG: RegionCircuitBreakerConfig = {
  failureThreshold: 3,
  resetTimeoutMs: 30_000, // 30 seconds
  halfOpenSuccessThreshold: 2,
};

/**
 * Region Health Check Service
 *
 * Monitors region health and determines if failover is needed.
 * §21-04: Includes per-region circuit breaker state machine for fault isolation.
 */
export class RegionHealthCheckService {
  private readonly configs = new Map<string, RegionHealthCheckConfig>();
  private readonly healthResults = new Map<string, RegionHealthCheckResult>();
  private readonly consecutiveFailures = new Map<string, number>();
  private readonly lastCheckTime = new Map<string, string>();
  // §21-04: Per-region circuit breakers for fault isolation
  private readonly circuitBreakers = new Map<string, RegionCircuitBreaker>();

  /**
   * Register a region for health monitoring
   */
  public registerRegion(config: RegionHealthCheckConfig): void {
    this.configs.set(config.regionId, config);
    this.consecutiveFailures.set(config.regionId, 0);
    this.circuitBreakers.set(config.regionId, new RegionCircuitBreaker(DEFAULT_REGION_CIRCUIT_BREAKER_CONFIG));
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
   * Get circuit breaker state for a region.
   * §21-04: Exposes circuit breaker state for observability.
   */
  public getCircuitBreakerState(regionId: string): RegionCircuitBreakerState | null {
    const breaker = this.circuitBreakers.get(regionId);
    return breaker?.getState() ?? null;
  }

  /**
   * Get circuit breaker metrics for a region.
   * §21-04: Exposes circuit breaker metrics for monitoring.
   */
  public getCircuitBreakerMetrics(regionId: string): { state: RegionCircuitBreakerState; consecutiveFailures: number; consecutiveSuccesses: number } | null {
    const breaker = this.circuitBreakers.get(regionId);
    return breaker?.getMetrics() ?? null;
  }

  /**
   * Perform health check on a region
   * §21-04: Uses per-region circuit breaker to determine if probe is allowed.
   */
  public async checkRegion(regionId: string): Promise<RegionHealthCheckResult> {
    const config = this.configs.get(regionId);
    const breaker = this.circuitBreakers.get(regionId);

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

    // §21-04: Check circuit breaker before attempting health check
    if (breaker && !breaker.isRequestAllowed()) {
      return {
        regionId,
        status: "unhealthy", // Treat circuit open as unhealthy
        checkedAt: nowIso(),
        latencyMs: 0,
        metrics: [],
        errorMessage: "Circuit breaker open: health check blocked",
      };
    }

    const startTime = Date.now();

    try {
      const result = await this.performHealthCheck(config);
      const latencyMs = Date.now() - startTime;

      const healthResult: RegionHealthCheckResult = {
        regionId,
        status: this.determineStatus(config, result.metrics, latencyMs),
        checkedAt: nowIso(),
        latencyMs,
        metrics: result.metrics,
      };

      // §21-04: Record success with circuit breaker
      breaker?.recordSuccess();
      this.updateHealthState(regionId, healthResult);
      return healthResult;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const failures = (this.consecutiveFailures.get(regionId) ?? 0) + 1;
      this.consecutiveFailures.set(regionId, failures);
      this.lastCheckTime.set(regionId, nowIso());

      // §21-04: Record failure with circuit breaker
      breaker?.recordFailure();

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
   * §21-04: Circuit breaker open state is treated as unhealthy and triggers failover.
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

    // §21-04: Also failover if circuit breaker is open (indicates persistent failures)
    const breakerState = this.getCircuitBreakerState(regionId);
    if (breakerState === "open") {
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
   * §21-04: Also resets the circuit breaker to allow fresh health probing.
   */
  public resetHealthState(regionId: string): void {
    this.consecutiveFailures.set(regionId, 0);
    this.healthResults.delete(regionId);
    this.circuitBreakers.get(regionId)?.reset();
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
   * Must evaluate latency against the current region's thresholds directly.
   */
  private determineStatus(
    config: RegionHealthCheckConfig,
    metrics: HealthCheckMetric[],
    latencyMs: number,
  ): RegionHealthStatus {
    if (metrics.length === 0) {
      return "unhealthy";
    }

    const unhealthyMetrics = metrics.filter((m) => !m.isHealthy);
    if (unhealthyMetrics.length > 0) {
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
  private readonly eventBus: DurableEventBusAsync | undefined;

  public constructor(healthCheckService?: RegionHealthCheckService, eventBus?: DurableEventBusAsync) {
    this.healthCheckService = healthCheckService ?? new RegionHealthCheckService();
    this.eventBus = eventBus ?? undefined;
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
      const soleCandidate = candidateRegionIds[0]!;
      const summary = this.healthCheckService.getHealthSummary(soleCandidate);
      return summary?.isHealthyForFailover ?? false ? soleCandidate : null;
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
   * Emits structured FailoverRecord events to the event bus at start, progress, and completion.
   */
  public async orchestrateFailover(
    sourceRegionId: string,
    availableRegions: readonly string[],
  ): Promise<{ success: boolean; targetRegionId: string | null; reason?: string }> {
    const failoverId = newId("failover");

    // Emit failover start event
    await this.emitFailoverEvent({
      failoverId,
      region: sourceRegionId,
      timestamp: nowIso(),
      status: "started",
      involvedResources: [sourceRegionId],
    });

    const targetRegionId = this.selectFailoverTarget(sourceRegionId, availableRegions);

    if (!targetRegionId) {
      // Emit failover failure event
      await this.emitFailoverEvent({
        failoverId,
        region: sourceRegionId,
        timestamp: nowIso(),
        status: "failed",
        involvedResources: [sourceRegionId],
        errorMessage: "No healthy failover target available",
      });
      return {
        success: false,
        targetRegionId: null,
        reason: "No healthy failover target available",
      };
    }

    // Emit failover progress event (transferring to target)
    await this.emitFailoverEvent({
      failoverId,
      region: sourceRegionId,
      timestamp: nowIso(),
      status: "in_progress",
      involvedResources: [sourceRegionId, targetRegionId],
      targetRegion: targetRegionId,
    });

    // Notify listeners
    for (const listener of this.failoverListeners) {
      try {
        listener(sourceRegionId, targetRegionId);
      } catch (error) {
        logger.error(`Failover listener error`, { error: String(error) });
      }
    }

    // Emit failover completion event
    await this.emitFailoverEvent({
      failoverId,
      region: sourceRegionId,
      timestamp: nowIso(),
      status: "completed",
      involvedResources: [sourceRegionId, targetRegionId],
      targetRegion: targetRegionId,
    });

    return {
      success: true,
      targetRegionId,
    };
  }

  /**
   * Emit a FailoverRecord event to the event bus
   */
  private async emitFailoverEvent(record: FailoverRecord): Promise<void> {
    if (!this.eventBus) {
      return;
    }

    try {
      await this.eventBus.publish({
        eventType: `failover:${record.status}`,
        payload: record as unknown as Record<string, unknown>,
      });
    } catch (error) {
      logger.error(`Failed to emit failover event`, { error: String(error), record });
    }
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
