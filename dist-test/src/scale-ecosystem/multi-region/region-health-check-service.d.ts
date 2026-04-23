/**
 * Region Health Check Service
 *
 * Implements region health monitoring for multi-region failover.
 * Complements §52 CDC replication with automatic health-based failover.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §59
 */
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
export declare const HEALTH_CHECK_EVENTS: readonly ["region:health_check_passed", "region:health_check_failed", "region:health_degraded", "region:health_restored"];
/**
 * Region Health Check Service
 *
 * Monitors region health and determines if failover is needed.
 */
export declare class RegionHealthCheckService {
    private readonly configs;
    private readonly healthResults;
    private readonly consecutiveFailures;
    private readonly lastCheckTime;
    /**
     * Register a region for health monitoring
     */
    registerRegion(config: RegionHealthCheckConfig): void;
    /**
     * Unregister a region from health monitoring
     */
    unregisterRegion(regionId: string): void;
    /**
     * Perform health check on a region
     */
    checkRegion(regionId: string): Promise<RegionHealthCheckResult>;
    /**
     * Get current health status for a region
     */
    getHealthStatus(regionId: string): RegionHealthStatus;
    /**
     * Get health summary for a region
     */
    getHealthSummary(regionId: string): RegionHealthSummary | null;
    /**
     * Check if a region should failover
     */
    shouldFailover(regionId: string): boolean;
    /**
     * Get all regions that need failover
     */
    getRegionsNeedingFailover(): readonly string[];
    /**
     * Check all registered regions
     */
    checkAllRegions(): Promise<readonly RegionHealthCheckResult[]>;
    /**
     * Get health status for all regions
     */
    getAllHealthStatuses(): Map<string, RegionHealthStatus>;
    /**
     * Reset health state for a region
     */
    resetHealthState(regionId: string): void;
    /**
     * Get configured thresholds for a region
     */
    getThresholds(regionId: string): {
        readonly maxLatencyMs: number;
        readonly maxErrorRate: number;
        readonly maxCpuUsage: number;
        readonly maxMemoryUsage: number;
    } | undefined;
    /**
     * Perform the actual health check
     */
    private performHealthCheck;
    /**
     * Determine overall status from metrics
     */
    private determineStatus;
    /**
     * Update health state after a check
     */
    private updateHealthState;
}
/**
 * Region failover orchestrator
 *
 * Coordinates automatic failover based on health checks.
 */
export declare class RegionFailoverOrchestrator {
    private readonly healthCheckService;
    private readonly failoverListeners;
    constructor(healthCheckService?: RegionHealthCheckService);
    /**
     * Get the health check service
     */
    getHealthCheckService(): RegionHealthCheckService;
    /**
     * Register a region for health monitoring
     */
    registerRegion(config: RegionHealthCheckConfig): void;
    /**
     * Select the best failover target from healthy regions
     */
    selectFailoverTarget(sourceRegionId: string, availableRegions: readonly string[]): string | null;
    /**
     * Orchestrate failover from source to target region
     */
    orchestrateFailover(sourceRegionId: string, availableRegions: readonly string[]): Promise<{
        success: boolean;
        targetRegionId: string | null;
        reason?: string;
    }>;
    /**
     * Add failover listener
     */
    addFailoverListener(listener: (regionId: string, targetRegionId: string) => void): void;
    /**
     * Remove failover listener
     */
    removeFailoverListener(listener: (regionId: string, targetRegionId: string) => void): void;
    /**
     * Check if failover is needed and orchestrate if necessary
     */
    checkAndFailover(primaryRegionId: string, availableRegions: readonly string[]): Promise<{
        didFailover: boolean;
        targetRegionId: string | null;
    }>;
}
