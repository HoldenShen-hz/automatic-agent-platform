/**
 * Region Health Check Service
 *
 * Implements region health monitoring for multi-region failover.
 * Complements §52 CDC replication with automatic health-based failover.
 *
 * @see docs_zh/reviews/architecture-design-vs-implementation-review.md §59
 */
import { nowIso } from "../../platform/contracts/types/ids.js";
/**
 * Health check event types
 */
export const HEALTH_CHECK_EVENTS = [
    "region:health_check_passed",
    "region:health_check_failed",
    "region:health_degraded",
    "region:health_restored",
];
/**
 * Region Health Check Service
 *
 * Monitors region health and determines if failover is needed.
 */
export class RegionHealthCheckService {
    configs = new Map();
    healthResults = new Map();
    consecutiveFailures = new Map();
    lastCheckTime = new Map();
    /**
     * Register a region for health monitoring
     */
    registerRegion(config) {
        this.configs.set(config.regionId, config);
        this.consecutiveFailures.set(config.regionId, 0);
    }
    /**
     * Unregister a region from health monitoring
     */
    unregisterRegion(regionId) {
        this.configs.delete(regionId);
        this.healthResults.delete(regionId);
        this.consecutiveFailures.delete(regionId);
        this.lastCheckTime.delete(regionId);
    }
    /**
     * Perform health check on a region
     */
    async checkRegion(regionId) {
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
            const healthResult = {
                regionId,
                status: this.determineStatus(result.metrics, latencyMs),
                checkedAt: nowIso(),
                latencyMs,
                metrics: result.metrics,
            };
            this.updateHealthState(regionId, healthResult);
            return healthResult;
        }
        catch (error) {
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
    getHealthStatus(regionId) {
        const result = this.healthResults.get(regionId);
        return result?.status ?? "unknown";
    }
    /**
     * Get health summary for a region
     */
    getHealthSummary(regionId) {
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
    shouldFailover(regionId) {
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
    getRegionsNeedingFailover() {
        const regionsNeedingFailover = [];
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
    async checkAllRegions() {
        const results = [];
        for (const regionId of this.configs.keys()) {
            const result = await this.checkRegion(regionId);
            results.push(result);
        }
        return results;
    }
    /**
     * Get health status for all regions
     */
    getAllHealthStatuses() {
        const statuses = new Map();
        for (const regionId of this.configs.keys()) {
            statuses.set(regionId, this.getHealthStatus(regionId));
        }
        return statuses;
    }
    /**
     * Reset health state for a region
     */
    resetHealthState(regionId) {
        this.consecutiveFailures.set(regionId, 0);
        this.healthResults.delete(regionId);
    }
    /**
     * Get configured thresholds for a region
     */
    getThresholds(regionId) {
        const config = this.configs.get(regionId);
        return config?.thresholds;
    }
    /**
     * Perform the actual health check
     */
    async performHealthCheck(config) {
        // Simulate health check metrics
        // In production, this would actually ping endpoints and collect metrics
        const metrics = [
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
    determineStatus(metrics, latencyMs) {
        if (metrics.length === 0) {
            return "unhealthy";
        }
        const unhealthyMetrics = metrics.filter((m) => !m.isHealthy);
        if (unhealthyMetrics.length > 0) {
            return "degraded";
        }
        const config = this.configs.get(metrics[0].metricName ?? "");
        if (config && latencyMs > config.thresholds.maxLatencyMs) {
            return "degraded";
        }
        return "healthy";
    }
    /**
     * Update health state after a check
     */
    updateHealthState(regionId, result) {
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
    healthCheckService;
    failoverListeners = new Set();
    constructor(healthCheckService) {
        this.healthCheckService = healthCheckService ?? new RegionHealthCheckService();
    }
    /**
     * Get the health check service
     */
    getHealthCheckService() {
        return this.healthCheckService;
    }
    /**
     * Register a region for health monitoring
     */
    registerRegion(config) {
        this.healthCheckService.registerRegion(config);
    }
    /**
     * Select the best failover target from healthy regions
     */
    selectFailoverTarget(sourceRegionId, availableRegions) {
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
        let bestRegion = null;
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
    async orchestrateFailover(sourceRegionId, availableRegions) {
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
            }
            catch (error) {
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
    addFailoverListener(listener) {
        this.failoverListeners.add(listener);
    }
    /**
     * Remove failover listener
     */
    removeFailoverListener(listener) {
        this.failoverListeners.delete(listener);
    }
    /**
     * Check if failover is needed and orchestrate if necessary
     */
    async checkAndFailover(primaryRegionId, availableRegions) {
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
//# sourceMappingURL=region-health-check-service.js.map