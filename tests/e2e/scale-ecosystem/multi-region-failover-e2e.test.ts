import assert from "node:assert/strict";
import test from "node:test";

import {
  RegionFailoverOrchestrator,
  RegionHealthCheckService,
  type RegionHealthCheckConfig,
} from "../../../src/scale-ecosystem/multi-region/region-health-check-service.js";

function createRegionConfig(regionId: string, latencyMs: number, errorRate = 0): RegionHealthCheckConfig {
  return {
    regionId,
    endpoint: `https://${regionId}.example.test`,
    checkIntervalMs: 1000,
    timeoutMs: 100,
    retryCount: 2,
    metricSnapshot: {
      latencyMs,
      errorRate,
      cpuUsage: 0.2,
      memoryUsage: 0.3,
    },
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.8,
    },
  };
}

test("E2E Multi-Region: health snapshots drive degraded region detection", async () => {
  const service = new RegionHealthCheckService();
  service.registerRegion(createRegionConfig("region-primary", 40));
  service.registerRegion(createRegionConfig("region-secondary", 500, 0.2));

  await service.checkAllRegions();

  assert.equal(service.getHealthStatus("region-primary"), "healthy");
  assert.equal(service.shouldFailover("region-secondary"), true);
});

test("E2E Multi-Region: orchestrator selects the healthiest failover target and records failover", async () => {
  const health = new RegionHealthCheckService();
  const orchestrator = new RegionFailoverOrchestrator(health);

  orchestrator.registerRegion(createRegionConfig("region-a", 400, 0.2));
  orchestrator.registerRegion(createRegionConfig("region-b", 30));
  orchestrator.registerRegion(createRegionConfig("region-c", 80));

  await health.checkAllRegions();

  const target = orchestrator.selectFailoverTarget("region-a", ["region-a", "region-b", "region-c"]);
  assert.equal(target, "region-b");

  const result = await orchestrator.orchestrateFailover("region-a", ["region-a", "region-b", "region-c"]);
  assert.equal(result.success, true);
  assert.equal(result.targetRegionId, "region-b");
  assert.ok(orchestrator.getLatestFailoverRecord());
});
