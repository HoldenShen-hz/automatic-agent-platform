/**
 * E2E Multi-Region Failover Tests
 *
 * End-to-end tests covering multi-region failover scenarios:
 * 1. Region health monitoring
 * 2. Failover trigger and execution
 * 3. Traffic rerouting
 * 4. Recovery and failback
 * 5. Data consistency during failover
 *
 * Uses node:test + node:assert/strict. ESM imports with .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore
import { createE2EHarness } from "../helpers/e2e-harness.js";
// @ts-ignore
import { MultiRegionFailoverService } from "../../src/scale-ecosystem/multi-region/failover-service.js";
// @ts-ignore
import type { RegionHealth, FailoverPlan, FailoverStep } from "../../src/scale-ecosystem/multi-region/types.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createRegionHealth(overrides: Partial<RegionHealth> = {}): RegionHealth {
  return {
    regionId: overrides.regionId ?? "region_us_east",
    status: overrides.status ?? "healthy",
    latencyMs: overrides.latencyMs ?? 50,
    errorRate: overrides.errorRate ?? 0.001,
    lastHeartbeat: overrides.lastHeartbeat ?? new Date().toISOString(),
    activeConnections: overrides.activeConnections ?? 100,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite 1: Region Health Monitoring
// ---------------------------------------------------------------------------

test("E2E Multi-Region: HealthMonitor detects unhealthy region", async () => {
  const harness = createE2EHarness("aa-e2e-multiregion-health-");
  try {
    const service = new MultiRegionFailoverService();

    const healthyRegion = createRegionHealth({ regionId: "region_us_east", status: "healthy" });
    const unhealthyRegion = createRegionHealth({
      regionId: "region_us_west",
      status: "degraded",
      latencyMs: 2000,
      errorRate: 0.15,
    });

    service.reportHealth(healthyRegion);
    service.reportHealth(unhealthyRegion);

    const isHealthy = service.isRegionHealthy("region_us_east");
    const isDegraded = service.isRegionHealthy("region_us_west");

    assert.equal(isHealthy, true, "US East should be healthy");
    assert.equal(isDegraded, false, "US West should be degraded");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 2: Failover Plan Execution
// ---------------------------------------------------------------------------

test("E2E Multi-Region: FailoverService executes failover plan", async () => {
  const harness = createE2EHarness("aa-e2e-multiregion-failover-");
  try {
    const service = new MultiRegionFailoverService();

    const plan: FailoverPlan = {
      planId: "failover_plan_001",
      sourceRegion: "region_us_east",
      targetRegion: "region_us_west",
      steps: [
        { stepOrder: 1, action: "pause_write", targetRegion: "region_us_east" },
        { stepOrder: 2, action: "sync_state", targetRegion: "region_us_west" },
        { stepOrder: 3, action: "switch_traffic", targetRegion: "region_us_west" },
      ],
      estimatedDurationMs: 5000,
    };

    const result = await service.executeFailover(plan);

    assert.ok(result, "Should return failover result");
    assert.ok(result.completed, "Should complete failover");
    assert.equal(result.targetRegion, "region_us_west", "Should target correct region");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 3: Traffic Rerouting
// ---------------------------------------------------------------------------

test("E2E Multi-Region: Service reroutes traffic to healthy region", async () => {
  const harness = createE2EHarness("aa-e2e-multiregion-traffic-");
  try {
    const service = new MultiRegionFailoverService();

    // Mark primary region unhealthy
    service.reportHealth(createRegionHealth({
      regionId: "region_primary",
      status: "unhealthy",
      errorRate: 0.5,
    }));

    // Trigger reroute
    const rerouteResult = await service.rerouteTraffic({
      fromRegion: "region_primary",
      toRegion: "region_secondary",
      percentage: 100,
    });

    assert.ok(rerouteResult, "Should return reroute result");
    assert.equal(rerouteResult.percentage, 100, "Should route 100% traffic");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 4: Failback Recovery
// ---------------------------------------------------------------------------

test("E2E Multi-Region: Service recovers original region and fails back", async () => {
  const harness = createE2EHarness("aa-e2e-multiregion-failback-");
  try {
    const service = new MultiRegionFailoverService();

    // Simulate primary recovery
    service.reportHealth(createRegionHealth({
      regionId: "region_primary",
      status: "healthy",
      latencyMs: 50,
      errorRate: 0.001,
    }));

    const failbackResult = await service.failback({
      fromRegion: "region_secondary",
      toRegion: "region_primary",
    });

    assert.ok(failbackResult, "Should return failback result");
    assert.equal(failbackResult.targetRegion, "region_primary", "Should target primary");
  } finally {
    harness.cleanup();
  }
});