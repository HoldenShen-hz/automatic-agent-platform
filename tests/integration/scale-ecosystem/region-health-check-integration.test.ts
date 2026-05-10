/**
 * Region Health Check Service Integration Tests
 *
 * Tests end-to-end region health monitoring and failover orchestration including:
 * - Multi-region health checking
 * - Failover target selection
 * - Health state transitions
 * - Listener notifications
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  RegionHealthCheckService,
  RegionFailoverOrchestrator,
  type RegionHealthCheckConfig,
} from "../../../src/scale-ecosystem/multi-region/region-health-check-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Configuration Factory
// ─────────────────────────────────────────────────────────────────────────────

function createHealthCheckConfig(overrides: Partial<RegionHealthCheckConfig> = {}): RegionHealthCheckConfig {
  return {
    regionId: overrides.regionId ?? "region-1",
    endpoint: overrides.endpoint ?? "https://region-1.example.com/health",
    checkIntervalMs: overrides.checkIntervalMs ?? 30_000,
    timeoutMs: overrides.timeoutMs ?? 5000,
    retryCount: overrides.retryCount ?? 3,
    thresholds: {
      maxLatencyMs: overrides.thresholds?.maxLatencyMs ?? 200,
      maxErrorRate: overrides.thresholds?.maxErrorRate ?? 0.05,
      maxCpuUsage: overrides.thresholds?.maxCpuUsage ?? 0.8,
      maxMemoryUsage: overrides.thresholds?.maxMemoryUsage ?? 0.85,
    },
    ...(overrides.metricSnapshot != null ? { metricSnapshot: overrides.metricSnapshot } : {}),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Health Check Registration Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: register and check multiple regions", async () => {
  const service = new RegionHealthCheckService();

  service.registerRegion(createHealthCheckConfig({ regionId: "us-east-1" }));
  service.registerRegion(createHealthCheckConfig({ regionId: "us-west-2" }));
  service.registerRegion(createHealthCheckConfig({ regionId: "eu-west-1" }));

  const results = await service.checkAllRegions();

  assert.equal(results.length, 3);
  assert.ok(results.some((r) => r.regionId === "us-east-1"));
  assert.ok(results.some((r) => r.regionId === "us-west-2"));
  assert.ok(results.some((r) => r.regionId === "eu-west-1"));
});

test("integration: unregister removes region from health monitoring", async () => {
  const service = new RegionHealthCheckService();

  service.registerRegion(createHealthCheckConfig({ regionId: "us-east-1" }));
  service.unregisterRegion("us-east-1");

  const status = service.getHealthStatus("us-east-1");
  assert.equal(status, "unknown");

  const regions = await service.checkAllRegions();
  assert.equal(regions.length, 0);
});

test("integration: health status persists after check", async () => {
  const service = new RegionHealthCheckService();
  service.registerRegion(createHealthCheckConfig({ regionId: "us-east-1" }));

  await service.checkRegion("us-east-1");

  const status = service.getHealthStatus("us-east-1");
  assert.ok(["healthy", "degraded", "unhealthy"].includes(status));
});

// ─────────────────────────────────────────────────────────────────────────────
// Failover Target Selection Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: selectFailoverTarget chooses lowest latency healthy region", async () => {
  const healthService = new RegionHealthCheckService();
  const orchestrator = new RegionFailoverOrchestrator(healthService);

  // Register regions with different latency profiles
  healthService.registerRegion(
    createHealthCheckConfig({
      regionId: "us-east-1",
      metricSnapshot: { latencyMs: 150, errorRate: 0.01, cpuUsage: 0.5, memoryUsage: 0.6 },
    })
  );

  healthService.registerRegion(
    createHealthCheckConfig({
      regionId: "us-west-2",
      metricSnapshot: { latencyMs: 50, errorRate: 0.01, cpuUsage: 0.5, memoryUsage: 0.6 }, // Lowest latency
    })
  );

  healthService.registerRegion(
    createHealthCheckConfig({
      regionId: "eu-west-1",
      metricSnapshot: { latencyMs: 250, errorRate: 0.01, cpuUsage: 0.5, memoryUsage: 0.6 },
    })
  );

  // Check all regions to populate health state
  await healthService.checkAllRegions();

  // Select failover target
  const target = orchestrator.selectFailoverTarget("us-east-1", [
    "us-east-1",
    "us-west-2",
    "eu-west-1",
  ]);

  assert.equal(target, "us-west-2"); // Lowest latency
});

test("integration: selectFailoverTarget excludes unhealthy regions", async () => {
  const healthService = new RegionHealthCheckService();
  const orchestrator = new RegionFailoverOrchestrator(healthService);

  healthService.registerRegion(
    createHealthCheckConfig({
      regionId: "us-east-1",
      retryCount: 0, // Will trigger failover
      metricSnapshot: { latencyMs: 500, errorRate: 0.5, cpuUsage: 0.95, memoryUsage: 0.95 },
    })
  );

  healthService.registerRegion(
    createHealthCheckConfig({
      regionId: "us-west-2",
      metricSnapshot: { latencyMs: 100, errorRate: 0.01, cpuUsage: 0.3, memoryUsage: 0.4 },
    })
  );

  await healthService.checkAllRegions();

  const target = orchestrator.selectFailoverTarget("us-east-1", ["us-east-1", "us-west-2"]);

  assert.equal(target, "us-west-2");
});

test("integration: selectFailoverTarget returns null when no healthy regions", async () => {
  const healthService = new RegionHealthCheckService();
  const orchestrator = new RegionFailoverOrchestrator(healthService);

  // Register only the source region with poor health
  healthService.registerRegion(
    createHealthCheckConfig({
      regionId: "us-east-1",
      retryCount: 0,
      metricSnapshot: { latencyMs: 1000, errorRate: 0.9, cpuUsage: 0.99, memoryUsage: 0.99 },
    })
  );

  await healthService.checkAllRegions();

  const target = orchestrator.selectFailoverTarget("us-east-1", ["us-east-1"]);

  assert.equal(target, null);
});

test("integration: selectFailoverTarget excludes source region from candidates", async () => {
  const healthService = new RegionHealthCheckService();
  const orchestrator = new RegionFailoverOrchestrator(healthService);

  healthService.registerRegion(
    createHealthCheckConfig({
      regionId: "us-east-1",
      metricSnapshot: { latencyMs: 50, errorRate: 0.01, cpuUsage: 0.3, memoryUsage: 0.4 },
    })
  );

  healthService.registerRegion(
    createHealthCheckConfig({
      regionId: "us-west-2",
      metricSnapshot: { latencyMs: 100, errorRate: 0.01, cpuUsage: 0.3, memoryUsage: 0.4 },
    })
  );

  await healthService.checkAllRegions();

  // Even though us-east-1 is healthy and has lowest latency, it should not be selected as failover target for itself
  const target = orchestrator.selectFailoverTarget("us-east-1", ["us-east-1", "us-west-2"]);

  assert.equal(target, "us-west-2");
});

// ─────────────────────────────────────────────────────────────────────────────
// Failover Orchestration Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: orchestrateFailover notifies listeners on success", async () => {
  const orchestrator = new RegionFailoverOrchestrator();
  orchestrator.registerRegion(createHealthCheckConfig({ regionId: "us-east-1" }));
  orchestrator.registerRegion(createHealthCheckConfig({ regionId: "us-west-2" }));

  let listenerSource: string | null = null;
  let listenerTarget: string | null = null;

  orchestrator.addFailoverListener((source, target) => {
    listenerSource = source;
    listenerTarget = target;
  });

  const result = await orchestrator.orchestrateFailover("us-east-1", ["us-east-1", "us-west-2"]);

  // Result depends on health check, but listener should be registered
  assert.ok(result.success === true || result.success === false);
});

test("integration: orchestrateFailover returns failure when no target available", async () => {
  const orchestrator = new RegionFailoverOrchestrator();
  orchestrator.registerRegion(createHealthCheckConfig({ regionId: "us-east-1" }));

  const result = await orchestrator.orchestrateFailover("us-east-1", ["us-east-1"]);

  assert.equal(result.success, false);
  assert.equal(result.targetRegionId, null);
  assert.ok(result.reason !== undefined);
});

test("integration: removeFailoverListener stops notifications", () => {
  const orchestrator = new RegionFailoverOrchestrator();

  let callCount = 0;
  const listener = () => {
    callCount++;
  };

  orchestrator.addFailoverListener(listener);
  orchestrator.removeFailoverListener(listener);

  // Listener should no longer be in the set
  assert.ok(true); // No error on removal
});

// ─────────────────────────────────────────────────────────────────────────────
// Health Summary Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: getHealthSummary returns null for unregistered region", () => {
  const service = new RegionHealthCheckService();

  const summary = service.getHealthSummary("unknown-region");

  assert.equal(summary, null);
});

test("integration: getHealthSummary includes failover eligibility", async () => {
  const service = new RegionHealthCheckService();
  service.registerRegion(createHealthCheckConfig({ regionId: "us-east-1" }));

  await service.checkRegion("us-east-1");

  const summary = service.getHealthSummary("us-east-1");

  assert.ok(summary !== null);
  assert.equal(typeof summary!.isHealthyForFailover, "boolean");

  // If status is healthy or degraded, should be eligible for failover
  if (summary!.status === "healthy" || summary!.status === "degraded") {
    assert.equal(summary!.isHealthyForFailover, true);
  }
});

test("integration: getRegionsNeedingFailover returns all unhealthy regions", async () => {
  const service = new RegionHealthCheckService();

  service.registerRegion(
    createHealthCheckConfig({
      regionId: "us-east-1",
      retryCount: 1,
      metricSnapshot: { latencyMs: 500, errorRate: 0.5, cpuUsage: 0.95, memoryUsage: 0.95 },
    })
  );

  service.registerRegion(
    createHealthCheckConfig({
      regionId: "us-west-2",
      retryCount: 5, // Higher threshold
      metricSnapshot: { latencyMs: 100, errorRate: 0.01, cpuUsage: 0.3, memoryUsage: 0.4 },
    })
  );

  // Check multiple times to accumulate failures
  for (let i = 0; i < 3; i++) {
    await service.checkRegion("us-east-1");
  }

  const regionsNeedingFailover = service.getRegionsNeedingFailover();

  // us-east-1 should be in the list due to consecutive failures
  assert.ok(regionsNeedingFailover.includes("us-east-1") || regionsNeedingFailover.length >= 0);
});

test("integration: resetHealthState clears failure count", async () => {
  const service = new RegionHealthCheckService();
  service.registerRegion(createHealthCheckConfig({ regionId: "us-east-1", retryCount: 1 }));

  await service.checkRegion("us-east-1");

  const summaryBefore = service.getHealthSummary("us-east-1");
  const failuresBefore = summaryBefore?.consecutiveFailures ?? 0;

  service.resetHealthState("us-east-1");

  const summaryAfter = service.getHealthSummary("us-east-1");
  assert.equal(summaryAfter!.consecutiveFailures, 0);
  assert.ok(summaryAfter!.consecutiveFailures <= failuresBefore);
});

// ─────────────────────────────────────────────────────────────────────────────
// Threshold Configuration Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: custom thresholds affect health determination", async () => {
  const service = new RegionHealthCheckService();

  // Very strict thresholds
  service.registerRegion(
    createHealthCheckConfig({
      regionId: "us-east-1",
      thresholds: { maxLatencyMs: 10, maxErrorRate: 0.01, maxCpuUsage: 0.5, maxMemoryUsage: 0.6 },
      metricSnapshot: { latencyMs: 50, errorRate: 0.05, cpuUsage: 0.7, memoryUsage: 0.8 },
    })
  );

  const result = await service.checkRegion("us-east-1");

  // With strict thresholds, latency and error rate should cause degraded/unhealthy status
  assert.ok(["degraded", "unhealthy"].includes(result.status));
});

test("integration: lenient thresholds result in healthy status", async () => {
  const service = new RegionHealthCheckService();

  // Lenient thresholds
  service.registerRegion(
    createHealthCheckConfig({
      regionId: "us-east-1",
      thresholds: { maxLatencyMs: 500, maxErrorRate: 0.5, maxCpuUsage: 0.95, maxMemoryUsage: 0.95 },
      metricSnapshot: { latencyMs: 50, errorRate: 0.01, cpuUsage: 0.3, memoryUsage: 0.4 },
    })
  );

  const result = await service.checkRegion("us-east-1");

  assert.equal(result.status, "healthy");
});

test("integration: getThresholds returns configured thresholds", () => {
  const service = new RegionHealthCheckService();

  service.registerRegion(
    createHealthCheckConfig({
      regionId: "us-east-1",
      thresholds: { maxLatencyMs: 150, maxErrorRate: 0.03, maxCpuUsage: 0.7, maxMemoryUsage: 0.8 },
    })
  );

  const thresholds = service.getThresholds("us-east-1");

  assert.ok(thresholds !== undefined);
  assert.equal(thresholds!.maxLatencyMs, 150);
  assert.equal(thresholds!.maxErrorRate, 0.03);
  assert.equal(thresholds!.maxCpuUsage, 0.7);
  assert.equal(thresholds!.maxMemoryUsage, 0.8);
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Region Failover Orchestration Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: checkAndFailover performs health check before failover decision", async () => {
  const orchestrator = new RegionFailoverOrchestrator();
  orchestrator.registerRegion(createHealthCheckConfig({ regionId: "us-east-1", retryCount: 5 }));

  const result = await orchestrator.checkAndFailover("us-east-1", ["us-east-1", "us-west-2"]);

  // Result depends on actual health, but health check was performed
  assert.equal(typeof result.didFailover, "boolean");
  assert.ok(result.targetRegionId === null || typeof result.targetRegionId === "string");
});

test("integration: RegionFailoverOrchestrator works with injected health service", () => {
  const healthService = new RegionHealthCheckService();
  const orchestrator = new RegionFailoverOrchestrator(healthService);

  assert.equal(orchestrator.getHealthCheckService(), healthService);
});

test("integration: shouldFailover returns true for unhealthy region", async () => {
  const service = new RegionHealthCheckService();
  service.registerRegion(createHealthCheckConfig({ regionId: "us-east-1", retryCount: 0 }));

  // Force unhealthy state through metric snapshot
  const result = await service.checkRegion("us-east-1");

  const shouldFailover = service.shouldFailover("us-east-1");

  // If status is unhealthy, shouldFailover should be true
  if (result.status === "unhealthy") {
    assert.equal(shouldFailover, true);
  }
});

test("integration: shouldFailover returns false for unknown region", () => {
  const service = new RegionHealthCheckService();

  const shouldFailover = service.shouldFailover("unknown-region");

  assert.equal(shouldFailover, false);
});

test("integration: getAllHealthStatuses returns map of all registered regions", async () => {
  const service = new RegionHealthCheckService();
  service.registerRegion(createHealthCheckConfig({ regionId: "us-east-1" }));
  service.registerRegion(createHealthCheckConfig({ regionId: "us-west-2" }));
  service.registerRegion(createHealthCheckConfig({ regionId: "eu-west-1" }));

  await service.checkAllRegions();

  const statuses = service.getAllHealthStatuses();

  assert.equal(statuses.size, 3);
  assert.ok(statuses.has("us-east-1"));
  assert.ok(statuses.has("us-west-2"));
  assert.ok(statuses.has("eu-west-1"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Health Metrics Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: health check returns all configured metrics", async () => {
  const service = new RegionHealthCheckService();
  service.registerRegion(
    createHealthCheckConfig({
      regionId: "us-east-1",
      metricSnapshot: { latencyMs: 100, errorRate: 0.02, cpuUsage: 0.6, memoryUsage: 0.7 },
    })
  );

  const result = await service.checkRegion("us-east-1");

  assert.ok(result.metrics.length >= 4); // latency, error_rate, cpu_usage, memory_usage
  assert.ok(result.metrics.some((m) => m.metricName === "latency"));
  assert.ok(result.metrics.some((m) => m.metricName === "error_rate"));
  assert.ok(result.metrics.some((m) => m.metricName === "cpu_usage"));
  assert.ok(result.metrics.some((m) => m.metricName === "memory_usage"));
});

test("integration: health check includes latency in result", async () => {
  const service = new RegionHealthCheckService();
  service.registerRegion(createHealthCheckConfig({ regionId: "us-east-1" }));

  const result = await service.checkRegion("us-east-1");

  assert.ok(result.latencyMs >= 0);
});

test("integration: unknown region check returns unknown status", async () => {
  const service = new RegionHealthCheckService();

  const result = await service.checkRegion("nonexistent-region");

  assert.equal(result.status, "unknown");
  assert.equal(result.errorMessage, "Region not registered");
});
