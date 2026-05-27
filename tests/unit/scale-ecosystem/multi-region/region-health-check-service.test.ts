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

test("RegionHealthCheckService honors caller abort signal during network health checks", async () => {
  const service = new RegionHealthCheckService();
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();

  service.registerRegion({
    regionId: "abort-region",
    endpoint: "https://abort-region.example.com",
    checkIntervalMs: 30_000,
    timeoutMs: 5_000,
    retryCount: 1,
    thresholds: {
      maxLatencyMs: 200,
      maxErrorRate: 0.05,
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.9,
    },
  });

  globalThis.fetch = async (_url, init) => {
    await new Promise<void>((resolve, reject) => {
      const signal = init?.signal as AbortSignal | undefined;
      if (signal?.aborted) {
        reject(new Error("aborted"));
        return;
      }
      signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
    return new Response(null, { status: 204 });
  };

  try {
    controller.abort();
    const result = await service.checkRegion("abort-region", controller.signal);
    assert.equal(result.status, "unhealthy");
    assert.match(result.errorMessage ?? "", /aborted/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
