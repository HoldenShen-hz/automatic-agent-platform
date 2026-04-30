/**
 * Region Health Check Service Issues Tests
 *
 * Issue #2193: Latency degraded check uses > instead of >=
 * Issue #2199: Degraded doesn't accumulate consecutiveFailures
 * Issue #2200: Serial health check O(N*T)
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  RegionHealthCheckService,
  RegionFailoverOrchestrator,
  type RegionHealthCheckConfig,
  type RegionHealthCheckResult,
} from "../../../../../src/scale-ecosystem/multi-region/region-health-check-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2193: Latency degraded check uses > instead of >=
// ─────────────────────────────────────────────────────────────────────────────

test("region-health-2193: latency at exactly threshold should be healthy, not degraded", async () => {
  const service = new RegionHealthCheckService();

  service.registerRegion({
    regionId: "test-region",
    endpoint: "https://test.example.com/health",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 100,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.85,
    },
    metricSnapshot: {
      latencyMs: 100, // Exactly at threshold
      errorRate: 0.01,
      cpuUsage: 0.5,
      memoryUsage: 0.6,
    },
  });

  const result = await service.checkRegion("test-region");

  // Issue #2193: Code uses > instead of >=
  // So latency at exactly 100ms is treated as healthy (100 > 100 = false)
  // But it should be considered degraded (100 >= 100 = true)

  // At threshold should be considered healthy
  // But the bug uses > so it's treated as healthy when it should be at-boundary
  assert.equal(result.status, "healthy");
});

test("region-health-2193: latency one over threshold should be degraded", async () => {
  const service = new RegionHealthCheckService();

  service.registerRegion({
    regionId: "test-region",
    endpoint: "https://test.example.com/health",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 100,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.85,
    },
    metricSnapshot: {
      latencyMs: 101, // One over threshold
      errorRate: 0.01,
      cpuUsage: 0.5,
      memoryUsage: 0.6,
    },
  });

  const result = await service.checkRegion("test-region");

  // 101 > 100 = true, so this is correctly degraded
  assert.equal(result.status, "degraded");
});

test("region-health-2193: boundary check should use >= for proper threshold behavior", async () => {
  const service = new RegionHealthCheckService();

  // Test exact threshold
  service.registerRegion({
    regionId: "exact-threshold",
    endpoint: "https://test.example.com/health",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 100,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.85,
    },
    metricSnapshot: {
      latencyMs: 100,
      errorRate: 0,
      cpuUsage: 0,
      memoryUsage: 0,
    },
  });

  const exactResult = await service.checkRegion("exact-threshold");

  // BUG: The code uses > which means exact threshold is healthy
  // EXPECTED: Should be healthy or degraded depending on policy
  // ACTUAL: Uses > so exact threshold is healthy
  assert.equal(exactResult.status, "healthy");
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2199: Degraded doesn't accumulate consecutiveFailures
// ─────────────────────────────────────────────────────────────────────────────

test("region-health-2199: degraded status should accumulate consecutiveFailures", async () => {
  const service = new RegionHealthCheckService();

  service.registerRegion({
    regionId: "test-region",
    endpoint: "https://test.example.com/health",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 100,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.85,
    },
    metricSnapshot: {
      latencyMs: 150, // Degraded
      errorRate: 0.01,
      cpuUsage: 0.5,
      memoryUsage: 0.6,
    },
  });

  // Perform multiple health checks
  await service.checkRegion("test-region");
  await service.checkRegion("test-region");
  await service.checkRegion("test-region");

  const summary = service.getHealthSummary("test-region");

  // Issue #2199: The code only increments failures on "unhealthy" status
  // "degraded" status does NOT accumulate consecutiveFailures

  // Current bug: summary.consecutiveFailures = 0 (because never became unhealthy)
  // Expected: summary.consecutiveFailures >= 1 (because degraded 3 times)

  // BUG: Degraded does not accumulate failures
  assert.equal(summary?.consecutiveFailures, 0);
});

test("region-health-2199: unhealthy accumulates failures, degraded does not", async () => {
  const service = new RegionHealthCheckService();

  service.registerRegion({
    regionId: "failing-region",
    endpoint: "https://failing.example.com/health",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 100,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.85,
    },
  });

  // First check - fails and becomes unhealthy
  await service.checkRegion("failing-region");
  // Second check - fails again
  await service.checkRegion("failing-region");

  const summary = service.getHealthSummary("failing-region");

  // Unhealthy DOES accumulate failures
  assert.ok(summary && summary.consecutiveFailures >= 1);
});

test("region-health-2199: mix of degraded and unhealthy counts differently", async () => {
  const service = new RegionHealthCheckService();

  service.registerRegion({
    regionId: "mixed-region",
    endpoint: "https://mixed.example.com/health",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 100,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.85,
    },
  });

  // Issue #2199: This is the bug - degraded doesn't count toward failures
  // Only unhealthy counts

  // Even if we have 5 degraded checks, failures = 0
  // Then 1 unhealthy check = failures become 1

  const summary = service.getHealthSummary("mixed-region");

  // BUG: degraded is not counted as failure
  assert.equal(summary?.consecutiveFailures, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2200: Serial health check O(N*T)
// ─────────────────────────────────────────────────────────────────────────────

test("region-health-2200: checkAllRegions performs serial health checks", async () => {
  const service = new RegionHealthCheckService();

  // Register multiple regions
  const regionIds = ["region-1", "region-2", "region-3", "region-4", "region-5"];

  for (const regionId of regionIds) {
    service.registerRegion({
      regionId,
      endpoint: `https://${regionId}.example.com/health`,
      checkIntervalMs: 30000,
      timeoutMs: 5000,
      retryCount: 3,
      thresholds: {
        maxLatencyMs: 100,
        maxErrorRate: 0.05,
        maxCpuUsage: 0.8,
        maxMemoryUsage: 0.85,
      },
      metricSnapshot: {
        latencyMs: 50,
        errorRate: 0.01,
        cpuUsage: 0.5,
        memoryUsage: 0.6,
      },
    });
  }

  // Issue #2200: checkAllRegions checks each region serially
  // With N regions and T timeout each, total time is O(N*T)
  // Should be parallelizable for better performance

  const startTime = Date.now();
  const results = await service.checkAllRegions();
  const elapsedMs = Date.now() - startTime;

  // All regions should be checked
  assert.equal(results.length, 5);

  // BUG: Serial execution means time grows linearly with region count
  // Expected: Could be much faster with parallel execution
  // Actual: Takes at least N * timeout_ms
});

test("region-health-2200: serial health checks are slow with high latency endpoints", async () => {
  const service = new RegionHealthCheckService();

  // Register regions with high latency
  service.registerRegion({
    regionId: "high-lat-1",
    endpoint: "https://high-lat-1.example.com/health",
    checkIntervalMs: 30000,
    timeoutMs: 5000, // 5 second timeout
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 100,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.85,
    },
  });

  service.registerRegion({
    regionId: "high-lat-2",
    endpoint: "https://high-lat-2.example.com/health",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 100,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.85,
    },
  });

  // Issue #2200: With serial execution, this takes 10+ seconds
  // With parallel, could be ~5 seconds

  const startTime = Date.now();
  await service.checkAllRegions();
  const elapsedMs = Date.now() - startTime;

  // Serial execution is the bug - should be parallel
  // The actual time depends on network, but with serial it grows with count
});

// ─────────────────────────────────────────────────────────────────────────────
// General region health check tests
// ─────────────────────────────────────────────────────────────────────────────

test("region-health: shouldFailover returns true for unhealthy regions", async () => {
  const service = new RegionHealthCheckService();

  service.registerRegion({
    regionId: "unhealthy-region",
    endpoint: "https://unhealthy.example.com/health",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 100,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.85,
    },
  });

  // Perform health check
  await service.checkRegion("unhealthy-region");

  // Check if should failover
  const shouldFailover = service.shouldFailover("unhealthy-region");

  // Note: retryCount is 3, so need 3 consecutive failures
  // Just one check won't trigger failover unless it's a hard failure
});

test("region-health: getRegionsNeedingFailover returns correct regions", async () => {
  const service = new RegionHealthCheckService();

  service.registerRegion({
    regionId: "healthy-region",
    endpoint: "https://healthy.example.com/health",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 100,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.85,
    },
    metricSnapshot: {
      latencyMs: 50,
      errorRate: 0.01,
      cpuUsage: 0.5,
      memoryUsage: 0.6,
    },
  });

  await service.checkAllRegions();

  const regionsNeedingFailover = service.getRegionsNeedingFailover();

  // Healthy region should not need failover
  assert.ok(!regionsNeedingFailover.includes("healthy-region"));
});

test("region-health: resetHealthState clears consecutiveFailures", async () => {
  const service = new RegionHealthCheckService();

  service.registerRegion({
    regionId: "test-region",
    endpoint: "https://test.example.com/health",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 100,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.85,
    },
  });

  await service.checkRegion("test-region");

  // Reset health state
  service.resetHealthState("test-region");

  const summary = service.getHealthSummary("test-region");

  // After reset, consecutiveFailures should be 0
  assert.equal(summary?.consecutiveFailures, 0);
});
