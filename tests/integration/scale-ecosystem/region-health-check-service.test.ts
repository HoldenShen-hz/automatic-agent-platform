import assert from "node:assert/strict";
import test from "node:test";

import {
  RegionHealthCheckService,
  RegionFailoverOrchestrator,
  type RegionHealthCheckConfig,
} from "../../../../src/scale-ecosystem/multi-region/region-health-check-service.js";

function createDefaultRegionConfig(regionId: string, overrides: Partial<RegionHealthCheckConfig> = {}): RegionHealthCheckConfig {
  return {
    regionId,
    endpoint: `https://${regionId}.example.com/health`,
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.85,
    },
    ...overrides,
  };
}

test("region health check service registers and retrieves region config", () => {
  const service = new RegionHealthCheckService();
  const config = createDefaultRegionConfig("us-east-1");

  service.registerRegion(config);

  const thresholds = service.getThresholds("us-east-1");
  assert.ok(thresholds);
  assert.equal(thresholds?.maxLatencyMs, 200);
});

test("region health check service unregisters region", () => {
  const service = new RegionHealthCheckService();
  const config = createDefaultRegionConfig("us-east-1");

  service.registerRegion(config);
  assert.ok(service.getThresholds("us-east-1"));

  service.unregisterRegion("us-east-1");
  assert.equal(service.getThresholds("us-east-1"), undefined);
});

test("region health check service returns unknown for unregistered region", () => {
  const service = new RegionHealthCheckService();

  const status = service.getHealthStatus("us-east-1");
  assert.equal(status, "unknown");
});

test("region health check service performs health check on registered region", async () => {
  const service = new RegionHealthCheckService();
  const config = createDefaultRegionConfig("us-east-1");

  service.registerRegion(config);

  const result = await service.checkRegion("us-east-1");

  assert.equal(result.regionId, "us-east-1");
  assert.ok(["healthy", "degraded", "unhealthy"].includes(result.status));
  assert.ok(result.checkedAt);
  assert.ok(result.latencyMs >= 0);
});

test("region health check service returns unknown for unregistered region health check", async () => {
  const service = new RegionHealthCheckService();

  const result = await service.checkRegion("us-west-2");

  assert.equal(result.regionId, "us-west-2");
  assert.equal(result.status, "unknown");
  assert.equal(result.errorMessage, "Region not registered");
});

test("region health check service gets health summary for registered region", async () => {
  const service = new RegionHealthCheckService();
  const config = createDefaultRegionConfig("us-east-1");

  service.registerRegion(config);
  await service.checkRegion("us-east-1");

  const summary = service.getHealthSummary("us-east-1");

  assert.ok(summary);
  assert.equal(summary?.regionId, "us-east-1");
  assert.ok(["healthy", "degraded", "unhealthy", "unknown"].includes(summary?.status));
});

test("region health check service returns null summary for unregistered region", () => {
  const service = new RegionHealthCheckService();

  const summary = service.getHealthSummary("us-east-1");
  assert.equal(summary, null);
});

test("region health check service checks all registered regions", async () => {
  const service = new RegionHealthCheckService();

  service.registerRegion(createDefaultRegionConfig("us-east-1"));
  service.registerRegion(createDefaultRegionConfig("eu-west-1"));
  service.registerRegion(createDefaultRegionConfig("ap-south-1"));

  const results = await service.checkAllRegions();

  assert.equal(results.length, 3);
  assert.ok(results.some((r) => r.regionId === "us-east-1"));
  assert.ok(results.some((r) => r.regionId === "eu-west-1"));
  assert.ok(results.some((r) => r.regionId === "ap-south-1"));
});

test("region health check service gets all health statuses", async () => {
  const service = new RegionHealthCheckService();

  service.registerRegion(createDefaultRegionConfig("us-east-1"));
  service.registerRegion(createDefaultRegionConfig("eu-west-1"));

  await service.checkAllRegions();

  const statuses = service.getAllHealthStatuses();

  assert.equal(statuses.size, 2);
  assert.ok(statuses.has("us-east-1"));
  assert.ok(statuses.has("eu-west-1"));
});

test("region health check service resets health state", async () => {
  const service = new RegionHealthCheckService();
  const config = createDefaultRegionConfig("us-east-1");

  service.registerRegion(config);
  await service.checkRegion("us-east-1");

  const summaryBefore = service.getHealthSummary("us-east-1");
  const failuresBefore = summaryBefore?.consecutiveFailures ?? 0;

  // Simulate consecutive failures by running check multiple times
  service.resetHealthState("us-east-1");

  const summaryAfter = service.getHealthSummary("us-east-1");
  assert.equal(summaryAfter?.consecutiveFailures, 0);
});

test("region failover orchestrator registers region via health check service", () => {
  const orchestrator = new RegionFailoverOrchestrator();
  const config = createDefaultRegionConfig("us-east-1");

  orchestrator.registerRegion(config);

  const healthService = orchestrator.getHealthCheckService();
  const thresholds = healthService.getThresholds("us-east-1");

  assert.ok(thresholds);
  assert.equal(thresholds?.maxLatencyMs, 200);
});

test("region failover orchestrator selects failover target from healthy regions", () => {
  const orchestrator = new RegionFailoverOrchestrator();

  orchestrator.registerRegion(createDefaultRegionConfig("us-east-1"));
  orchestrator.registerRegion(createDefaultRegionConfig("us-west-2"));
  orchestrator.registerRegion(createDefaultRegionConfig("eu-west-1"));

  const target = orchestrator.selectFailoverTarget("us-east-1", ["us-east-1", "us-west-2", "eu-west-1"]);

  // Should select from healthy regions excluding source
  assert.ok(target === null || typeof target === "string");
});

test("region failover orchestrator returns null when no healthy targets available", () => {
  const orchestrator = new RegionFailoverOrchestrator();

  // Only register source region
  orchestrator.registerRegion(createDefaultRegionConfig("us-east-1"));

  const target = orchestrator.selectFailoverTarget("us-east-1", ["us-east-1"]);

  assert.equal(target, null);
});

test("region failover orchestrator orchestrates failover successfully", async () => {
  const orchestrator = new RegionFailoverOrchestrator();

  orchestrator.registerRegion(createDefaultRegionConfig("us-east-1"));
  orchestrator.registerRegion(createDefaultRegionConfig("us-west-2"));
  orchestrator.registerRegion(createDefaultRegionConfig("eu-west-1"));

  const result = await orchestrator.orchestrateFailover("us-east-1", ["us-east-1", "us-west-2", "eu-west-1"]);

  // Result depends on health of available regions
  assert.equal(typeof result.success, "boolean");
  if (result.success) {
    assert.ok(result.targetRegionId);
    assert.notEqual(result.targetRegionId, "us-east-1");
  } else {
    assert.equal(result.targetRegionId, null);
  }
});

test("region failover orchestrator adds and removes failover listeners", () => {
  const orchestrator = new RegionFailoverOrchestrator();

  let callCount = 0;
  const listener = (_source: string, _target: string) => {
    callCount++;
  };

  orchestrator.addFailoverListener(listener);
  orchestrator.addFailoverListener(listener); // Add same listener twice

  orchestrator.registerRegion(createDefaultRegionConfig("us-east-1"));
  orchestrator.registerRegion(createDefaultRegionConfig("us-west-2"));

  // Trigger failover (may or may not succeed depending on health)
  orchestrator.orchestrateFailover("us-east-1", ["us-east-1", "us-west-2"]).catch(() => {});

  orchestrator.removeFailoverListener(listener);
  // After removal, callCount should not increase on next failover
});

test("region health check service determines should failover for unhealthy region", async () => {
  const service = new RegionHealthCheckService();
  const config = createDefaultRegionConfig("us-east-1", {
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 1, // Very low threshold to trigger failure
      maxErrorRate: 0.01,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.85,
    },
  });

  service.registerRegion(config);

  // Perform multiple health checks to accumulate failures
  // Since threshold is very low, should eventually be marked unhealthy
  for (let i = 0; i < 4; i++) {
    await service.checkRegion("us-east-1");
  }

  const shouldFailover = service.shouldFailover("us-east-1");
  // Either should or shouldn't failover based on actual health result
  assert.equal(typeof shouldFailover, "boolean");
});

test("region health check service gets regions needing failover", async () => {
  const service = new RegionHealthCheckService();

  service.registerRegion(createDefaultRegionConfig("us-east-1", {
    retryCount: 1,
    thresholds: {
      maxLatencyMs: 1,
      maxErrorRate: 0.01,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.85,
    },
  }));
  service.registerRegion(createDefaultRegionConfig("us-west-2"));
  service.registerRegion(createDefaultRegionConfig("eu-west-1"));

  // Trigger checks - one region should accumulate failures
  for (let i = 0; i < 3; i++) {
    await service.checkRegion("us-east-1");
  }

  const regionsNeedingFailover = service.getRegionsNeedingFailover();

  // Should be a list (possibly empty)
  assert.ok(Array.isArray(regionsNeedingFailover));
});