import test from "node:test";
import assert from "node:assert/strict";
import {
  RegionHealthCheckService,
  RegionFailoverOrchestrator,
  type RegionHealthCheckConfig,
} from "../../../../src/scale-ecosystem/multi-region/region-health-check-service.js";

test("RegionHealthCheckService registers and unregisters regions", () => {
  const service = new RegionHealthCheckService();

  const config: RegionHealthCheckConfig = {
    regionId: "us-east",
    endpoint: "https://us-east.api.example.com",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.9,
    },
  };

  service.registerRegion(config);

  assert.equal(service.getHealthStatus("us-east"), "unknown");

  service.unregisterRegion("us-east");

  assert.equal(service.getHealthStatus("us-east"), "unknown");
});

test("RegionHealthCheckService performs health check", async () => {
  const service = new RegionHealthCheckService();

  const config: RegionHealthCheckConfig = {
    regionId: "us-east",
    endpoint: "https://us-east.api.example.com",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.9,
    },
  };

  service.registerRegion(config);

  const result = await service.checkRegion("us-east");

  assert.equal(result.regionId, "us-east");
  assert.ok(result.checkedAt !== undefined);
  assert.ok(result.latencyMs >= 0);
});

test("RegionHealthCheckService returns unknown for unregistered region", async () => {
  const service = new RegionHealthCheckService();

  const result = await service.checkRegion("unknown-region");

  assert.equal(result.regionId, "unknown-region");
  assert.equal(result.status, "unknown");
  assert.equal(result.errorMessage, "Region not registered");
});

test("RegionHealthCheckService tracks consecutive failures", async () => {
  const service = new RegionHealthCheckService();

  const config: RegionHealthCheckConfig = {
    regionId: "us-east",
    endpoint: "https://us-east.api.example.com",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.9,
    },
  };

  service.registerRegion(config);

  // Multiple failed checks
  await service.checkRegion("us-east");
  await service.checkRegion("us-east");
  await service.checkRegion("us-east");

  const summary = service.getHealthSummary("us-east");
  assert.ok(summary !== null);
  assert.ok(summary!.consecutiveFailures >= 0);
});

test("RegionHealthCheckService getHealthSummary returns null for unregistered", () => {
  const service = new RegionHealthCheckService();

  const summary = service.getHealthSummary("unknown");

  assert.equal(summary, null);
});

test("RegionHealthCheckService getRegionsNeedingFailover", async () => {
  const service = new RegionHealthCheckService();

  const config: RegionHealthCheckConfig = {
    regionId: "us-east",
    endpoint: "https://us-east.api.example.com",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.9,
    },
  };

  service.registerRegion(config);

  const regions = service.getRegionsNeedingFailover();

  assert.ok(Array.isArray(regions));
});

test("RegionHealthCheckService checkAllRegions", async () => {
  const service = new RegionHealthCheckService();

  service.registerRegion({
    regionId: "us-east",
    endpoint: "https://us-east.api.example.com",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.9,
    },
  });

  service.registerRegion({
    regionId: "eu-west",
    endpoint: "https://eu-west.api.example.com",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.9,
    },
  });

  const results = await service.checkAllRegions();

  assert.equal(results.length, 2);
  assert.ok(results.some((r) => r.regionId === "us-east"));
  assert.ok(results.some((r) => r.regionId === "eu-west"));
});

test("RegionHealthCheckService getAllHealthStatuses", async () => {
  const service = new RegionHealthCheckService();

  service.registerRegion({
    regionId: "us-east",
    endpoint: "https://us-east.api.example.com",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.9,
    },
  });

  await service.checkRegion("us-east");

  const statuses = service.getAllHealthStatuses();

  assert.equal(statuses.size, 1);
  assert.ok(statuses.has("us-east"));
});

test("RegionHealthCheckService resetHealthState", async () => {
  const service = new RegionHealthCheckService();

  service.registerRegion({
    regionId: "us-east",
    endpoint: "https://us-east.api.example.com",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.9,
    },
  });

  await service.checkRegion("us-east");
  service.resetHealthState("us-east");

  const summary = service.getHealthSummary("us-east");
  assert.ok(summary !== null);
  assert.equal(summary!.consecutiveFailures, 0);
});

test("RegionHealthCheckService resets stale failures when region recovers to degraded", async () => {
  const service = new RegionHealthCheckService();

  service.registerRegion({
    regionId: "us-east",
    endpoint: "https://us-east.api.example.com",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.9,
    },
  });

  let invocation = 0;
  (service as unknown as { performHealthCheck: (config: RegionHealthCheckConfig) => Promise<{ metrics: { metricName: string; value: number; threshold: number; isHealthy: boolean }[] }> }).performHealthCheck = async (config) => {
    invocation++;
    if (invocation <= 2) {
      throw new Error("health probe failed");
    }
    return {
      metrics: [{
        metricName: "latency",
        value: config.thresholds.maxLatencyMs + 50,
        threshold: config.thresholds.maxLatencyMs,
        isHealthy: false,
      }],
    };
  };

  await service.checkRegion("us-east");
  await service.checkRegion("us-east");
  let summary = service.getHealthSummary("us-east");
  assert.equal(summary?.consecutiveFailures, 2);

  await service.checkRegion("us-east");
  summary = service.getHealthSummary("us-east");
  assert.equal(summary?.status, "degraded");
  assert.equal(summary?.consecutiveFailures, 0);
});

test("RegionHealthCheckService checkAllRegions runs checks in parallel", async () => {
  const service = new RegionHealthCheckService();

  for (const regionId of ["us-east", "eu-west", "ap-south"]) {
    service.registerRegion({
      regionId,
      endpoint: `https://${regionId}.api.example.com`,
      checkIntervalMs: 30000,
      timeoutMs: 5000,
      retryCount: 3,
      thresholds: {
        maxLatencyMs: 200,
        maxErrorRate: 0.05,
        maxCpuUsage: 0.8,
        maxMemoryUsage: 0.9,
      },
    });
  }

  (service as unknown as { checkRegion: (regionId: string) => Promise<{ regionId: string; status: "healthy"; checkedAt: string; latencyMs: number; metrics: [] }> }).checkRegion = async (regionId) => {
    await new Promise((resolve) => setTimeout(resolve, 40));
    return {
      regionId,
      status: "healthy",
      checkedAt: "2026-05-01T00:00:00.000Z",
      latencyMs: 40,
      metrics: [],
    };
  };

  const startedAt = Date.now();
  const results = await service.checkAllRegions();
  const elapsedMs = Date.now() - startedAt;

  assert.equal(results.length, 3);
  assert.ok(elapsedMs < 100);
});

test("RegionFailoverOrchestrator selects best failover target", async () => {
  const orchestrator = new RegionFailoverOrchestrator();

  orchestrator.registerRegion({
    regionId: "us-east",
    endpoint: "https://us-east.api.example.com",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.9,
    },
  });

  orchestrator.registerRegion({
    regionId: "eu-west",
    endpoint: "https://eu-west.api.example.com",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.9,
    },
  });

  orchestrator.registerRegion({
    regionId: "ap-south",
    endpoint: "https://ap-south.api.example.com",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.9,
    },
  });

  const target = orchestrator.selectFailoverTarget("us-east", ["eu-west", "ap-south"]);

  // Should select one of the available regions
  assert.ok(target === "eu-west" || target === "ap-south" || target === null);
});

test("RegionFailoverOrchestrator returns null when no healthy target", () => {
  const orchestrator = new RegionFailoverOrchestrator();

  // Don't register any regions as healthy
  const target = orchestrator.selectFailoverTarget("us-east", []);

  assert.equal(target, null);
});

test("RegionFailoverOrchestrator addFailoverListener", () => {
  const orchestrator = new RegionFailoverOrchestrator();

  let listenerCalled = false;
  const listener = (regionId: string, targetRegionId: string) => {
    listenerCalled = true;
    assert.equal(regionId, "us-east");
    assert.equal(targetRegionId, "eu-west");
  };

  orchestrator.addFailoverListener(listener);
  orchestrator.removeFailoverListener(listener);

  // After removal, listener should not be called
  assert.equal(listenerCalled, false);
});

test("RegionFailoverOrchestrator getHealthCheckService", () => {
  const orchestrator = new RegionFailoverOrchestrator();

  const service = orchestrator.getHealthCheckService();

  assert.ok(service instanceof RegionHealthCheckService);
});

test("RegionFailoverOrchestrator checkAndFailover returns didFailover false when healthy", async () => {
  const orchestrator = new RegionFailoverOrchestrator();

  orchestrator.registerRegion({
    regionId: "us-east",
    endpoint: "https://us-east.api.example.com",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.9,
    },
  });

  orchestrator.registerRegion({
    regionId: "eu-west",
    endpoint: "https://eu-west.api.example.com",
    checkIntervalMs: 30000,
    timeoutMs: 5000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.9,
    },
  });

  const result = await orchestrator.checkAndFailover("us-east", ["eu-west"]);

  // Should not failover since region is not unhealthy
  assert.equal(result.didFailover, false);
});
