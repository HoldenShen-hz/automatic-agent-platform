/**
 * Cross-Region Deployment Service Tests
 *
 * Tests for the multi-region deployment service including region management,
 * topology, routing, failover, and health monitoring.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CrossRegionDeploymentService, CROSS_REGION_DDL } from "../../../src/platform/execution/ha/cross-region-deployment-service.js";
import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import { join } from "node:path";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "cross-region.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(CROSS_REGION_DDL);
  return { workspace, db };
}

test("CrossRegionDeploymentService registers a new region", () => {
  const harness = createHarness("aa-cross-region-");
  try {
    const service = new CrossRegionDeploymentService(harness.db);

    const region = service.registerRegion({
      regionId: "region-1",
      name: "us-east-1",
      endpoint: "https://us-east-1.example.com",
      status: "active",
      priority: 1,
      weight: 100,
      latencyMs: 50,
      healthScore: 95,
      maxConcurrency: 1000,
      currentLoad: 100,
      metadata: null,
    });

    assert.equal(region.regionId, "region-1");
    assert.equal(region.name, "us-east-1");
    assert.equal(region.status, "active");
    assert.equal(region.priority, 1);
    assert.ok(region.createdAt, "Should have createdAt");
    assert.ok(region.updatedAt, "Should have updatedAt");
    assert.ok(region.lastHealthCheckAt, "Should have lastHealthCheckAt");
  } finally {
    cleanupPath(harness.workspace);
  }
});

test("CrossRegionDeploymentService retrieves registered region", () => {
  const harness = createHarness("aa-cross-region-get-");
  try {
    const service = new CrossRegionDeploymentService(harness.db);

    service.registerRegion({
      regionId: "region-2",
      name: "us-west-2",
      endpoint: "https://us-west-2.example.com",
      status: "active",
      priority: 2,
      weight: 80,
      latencyMs: 75,
      healthScore: 90,
      maxConcurrency: 800,
      currentLoad: 50,
      metadata: null,
    });

    const retrieved = service.getRegion("region-2");
    assert.ok(retrieved, "Should retrieve region");
    assert.equal(retrieved?.name, "us-west-2");
    assert.equal(retrieved?.endpoint, "https://us-west-2.example.com");
    assert.equal(retrieved?.healthScore, 90);
  } finally {
    cleanupPath(harness.workspace);
  }
});

test("CrossRegionDeploymentService returns null for unknown region", () => {
  const harness = createHarness("aa-cross-region-unknown-");
  try {
    const service = new CrossRegionDeploymentService(harness.db);
    const result = service.getRegion("nonexistent");
    assert.equal(result, null);
  } finally {
    cleanupPath(harness.workspace);
  }
});

test("CrossRegionDeploymentService lists regions", () => {
  const harness = createHarness("aa-cross-region-list-");
  try {
    const service = new CrossRegionDeploymentService(harness.db);

    service.registerRegion({
      regionId: "region-a",
      name: "us-east",
      endpoint: "https://us-east.example.com",
      status: "active",
      priority: 1,
      weight: 100,
      latencyMs: 50,
      healthScore: 95,
      maxConcurrency: 1000,
      currentLoad: 100,
      metadata: null,
    });

    service.registerRegion({
      regionId: "region-b",
      name: "eu-west",
      endpoint: "https://eu-west.example.com",
      status: "active",
      priority: 2,
      weight: 90,
      latencyMs: 100,
      healthScore: 88,
      maxConcurrency: 800,
      currentLoad: 40,
      metadata: null,
    });

    const regions = service.listRegions();
    assert.equal(regions.length, 2, "Should list 2 regions");
    assert.equal(regions[0]?.regionId, "region-a", "Should be sorted by priority");
    assert.equal(regions[1]?.regionId, "region-b");
  } finally {
    cleanupPath(harness.workspace);
  }
});

test("CrossRegionDeploymentService filters regions by status", () => {
  const harness = createHarness("aa-cross-region-filter-");
  try {
    const service = new CrossRegionDeploymentService(harness.db);

    service.registerRegion({
      regionId: "region-active",
      name: "Active Region",
      endpoint: "https://active.example.com",
      status: "active",
      priority: 1,
      weight: 100,
      latencyMs: 50,
      healthScore: 95,
      maxConcurrency: 1000,
      currentLoad: 100,
      metadata: null,
    });

    service.registerRegion({
      regionId: "region-draining",
      name: "Draining Region",
      endpoint: "https://draining.example.com",
      status: "draining",
      priority: 2,
      weight: 50,
      latencyMs: 60,
      healthScore: 70,
      maxConcurrency: 500,
      currentLoad: 0,
      metadata: null,
    });

    const activeRegions = service.listRegions("active");
    assert.equal(activeRegions.length, 1, "Should have 1 active region");
    assert.equal(activeRegions[0]?.regionId, "region-active");

    const drainingRegions = service.listRegions("draining");
    assert.equal(drainingRegions.length, 1, "Should have 1 draining region");
    assert.equal(drainingRegions[0]?.regionId, "region-draining");
  } finally {
    cleanupPath(harness.workspace);
  }
});

test("CrossRegionDeploymentService updates region health", () => {
  const harness = createHarness("aa-cross-region-health-");
  try {
    const service = new CrossRegionDeploymentService(harness.db);

    service.registerRegion({
      regionId: "region-health",
      name: "Health Check Region",
      endpoint: "https://health.example.com",
      status: "active",
      priority: 1,
      weight: 100,
      latencyMs: 50,
      healthScore: 95,
      maxConcurrency: 1000,
      currentLoad: 100,
      metadata: null,
    });

    service.updateRegionHealth({
      checkId: "check-123",
      regionId: "region-health",
      status: "degraded",
      latencyMs: 200,
      healthScore: 60,
      errorMessage: "High latency detected",
      checkedAt: "2026-04-26T00:00:00.000Z",
    });

    const updated = service.getRegion("region-health");
    assert.ok(updated, "Should retrieve updated region");
    assert.equal(updated?.status, "degraded", "Status should be updated");
    assert.equal(updated?.latencyMs, 200, "Latency should be updated");
    assert.equal(updated?.healthScore, 60, "Health score should be updated");
  } finally {
    cleanupPath(harness.workspace);
  }
});

test("CrossRegionDeploymentService updates region status", () => {
  const harness = createHarness("aa-cross-region-status-");
  try {
    const service = new CrossRegionDeploymentService(harness.db);

    service.registerRegion({
      regionId: "region-status",
      name: "Status Region",
      endpoint: "https://status.example.com",
      status: "active",
      priority: 1,
      weight: 100,
      latencyMs: 50,
      healthScore: 95,
      maxConcurrency: 1000,
      currentLoad: 100,
      metadata: null,
    });

    const result = service.updateRegionStatus("region-status", "offline");

    assert.ok(result, "Should return updated region");
    assert.equal(result?.status, "offline", "Status should be offline");
  } finally {
    cleanupPath(harness.workspace);
  }
});

test("CrossRegionDeploymentService sets region weight", () => {
  const harness = createHarness("aa-cross-region-weight-");
  try {
    const service = new CrossRegionDeploymentService(harness.db);

    service.registerRegion({
      regionId: "region-weight",
      name: "Weight Region",
      endpoint: "https://weight.example.com",
      status: "active",
      priority: 1,
      weight: 100,
      latencyMs: 50,
      healthScore: 95,
      maxConcurrency: 1000,
      currentLoad: 100,
      metadata: null,
    });

    service.setRegionWeight("region-weight", 75, "2026-04-26T00:00:00.000Z", "2099-01-01T00:00:00.000Z");

    const weights = service.getEffectiveWeights();
    assert.ok(weights.length > 0, "Should have weights");
    const regionWeight = weights.find((w) => w.regionId === "region-weight");
    assert.ok(regionWeight, "Should find region weight");
    assert.equal(regionWeight?.weight, 75);
  } finally {
    cleanupPath(harness.workspace);
  }
});

test("CrossRegionDeploymentService creates topology", () => {
  const harness = createHarness("aa-cross-region-topology-");
  try {
    const service = new CrossRegionDeploymentService(harness.db);

    // Register regions first
    service.registerRegion({
      regionId: "topo-region-1",
      name: "Primary",
      endpoint: "https://primary.example.com",
      status: "active",
      priority: 1,
      weight: 100,
      latencyMs: 50,
      healthScore: 95,
      maxConcurrency: 1000,
      currentLoad: 100,
      metadata: null,
    });

    service.registerRegion({
      regionId: "topo-region-2",
      name: "Secondary",
      endpoint: "https://secondary.example.com",
      status: "active",
      priority: 2,
      weight: 50,
      latencyMs: 100,
      healthScore: 85,
      maxConcurrency: 800,
      currentLoad: 50,
      metadata: null,
    });

    const topology = service.createTopology({
      topologyId: "topology-1",
      name: "Primary Topology",
      description: "Main topology",
      regions: [
        {
          regionId: "topo-region-1",
          name: "Primary",
          endpoint: "https://primary.example.com",
          status: "active",
          priority: 1,
          weight: 100,
          latencyMs: 50,
          healthScore: 95,
          maxConcurrency: 1000,
          currentLoad: 100,
          metadata: null,
          lastHealthCheckAt: "2026-04-26T00:00:00.000Z",
          createdAt: "2026-04-26T00:00:00.000Z",
          updatedAt: "2026-04-26T00:00:00.000Z",
        },
      ],
      defaultRoutingStrategy: "latency_based",
      failoverRegionId: "topo-region-2",
      activeRegionId: "topo-region-1",
    });

    assert.equal(topology.topologyId, "topology-1");
    assert.equal(topology.name, "Primary Topology");
    assert.equal(topology.defaultRoutingStrategy, "latency_based");
    assert.ok(topology.createdAt, "Should have createdAt");
  } finally {
    cleanupPath(harness.workspace);
  }
});

test("CrossRegionDeploymentService retrieves topology", () => {
  const harness = createHarness("aa-cross-region-get-topology-");
  try {
    const service = new CrossRegionDeploymentService(harness.db);

    service.registerRegion({
      regionId: "get-topo-region",
      name: "Get Topology Region",
      endpoint: "https://get.example.com",
      status: "active",
      priority: 1,
      weight: 100,
      latencyMs: 50,
      healthScore: 95,
      maxConcurrency: 1000,
      currentLoad: 100,
      metadata: null,
    });

    service.createTopology({
      topologyId: "topology-get-1",
      name: "Get Topology",
      description: "Test topology",
      regions: [],
      defaultRoutingStrategy: "weighted",
      failoverRegionId: null,
      activeRegionId: "get-topo-region",
    });

    const retrieved = service.getTopology("topology-get-1");
    assert.ok(retrieved, "Should retrieve topology");
    assert.equal(retrieved?.name, "Get Topology");
    assert.equal(retrieved?.defaultRoutingStrategy, "weighted");
  } finally {
    cleanupPath(harness.workspace);
  }
});

test("CrossRegionDeploymentService selects region based on latency", () => {
  const harness = createHarness("aa-cross-region-select-");
  try {
    const service = new CrossRegionDeploymentService(harness.db, {
      latencyThresholdMs: 100,
      minHealthScoreForTraffic: 50,
    });

    service.registerRegion({
      regionId: "select-fast",
      name: "Fast Region",
      endpoint: "https://fast.example.com",
      status: "active",
      priority: 1,
      weight: 100,
      latencyMs: 30,
      healthScore: 95,
      maxConcurrency: 1000,
      currentLoad: 50,
      metadata: null,
    });

    service.registerRegion({
      regionId: "select-slow",
      name: "Slow Region",
      endpoint: "https://slow.example.com",
      status: "active",
      priority: 2,
      weight: 100,
      latencyMs: 200,
      healthScore: 90,
      maxConcurrency: 1000,
      currentLoad: 50,
      metadata: null,
    });

    const decision = service.selectRegion();

    assert.equal(decision.selectedRegionId, "select-fast", "Should select fast region");
    assert.equal(decision.routingStrategy, "latency_based");
    assert.equal(decision.fallbackUsed, false);
  } finally {
    cleanupPath(harness.workspace);
  }
});

test("CrossRegionDeploymentService falls back when no eligible regions", () => {
  const harness = createHarness("aa-cross-region-fallback-");
  try {
    const service = new CrossRegionDeploymentService(harness.db, {
      minHealthScoreForTraffic: 90,
    });

    service.registerRegion({
      regionId: "low-health",
      name: "Low Health Region",
      endpoint: "https://low.example.com",
      status: "active",
      priority: 1,
      weight: 100,
      latencyMs: 50,
      healthScore: 30, // Below minHealthScoreForTraffic
      maxConcurrency: 1000,
      currentLoad: 0,
      metadata: null,
    });

    const decision = service.selectRegion();

    assert.equal(decision.selectedRegionId, "low-health", "Should fallback to available");
    assert.equal(decision.fallbackUsed, true, "Should indicate fallback was used");
    assert.equal(decision.reasonCode, "fallback_no_eligible");
  } finally {
    cleanupPath(harness.workspace);
  }
});

test("CrossRegionDeploymentService returns no active regions decision", () => {
  const harness = createHarness("aa-cross-region-empty-");
  try {
    const service = new CrossRegionDeploymentService(harness.db);

    const decision = service.selectRegion();

    assert.equal(decision.selectedRegionId, "");
    assert.equal(decision.reasonCode, "no_active_regions");
    assert.equal(decision.fallbackUsed, false);
  } finally {
    cleanupPath(harness.workspace);
  }
});

test("CrossRegionDeploymentService initiates failover", () => {
  const harness = createHarness("aa-cross-region-failover-");
  try {
    const service = new CrossRegionDeploymentService(harness.db);

    service.registerRegion({
      regionId: "failover-source",
      name: "Source Region",
      endpoint: "https://source.example.com",
      status: "active",
      priority: 1,
      weight: 100,
      latencyMs: 50,
      healthScore: 95,
      maxConcurrency: 1000,
      currentLoad: 100,
      metadata: null,
    });

    service.registerRegion({
      regionId: "failover-target",
      name: "Target Region",
      endpoint: "https://target.example.com",
      status: "active",
      priority: 2,
      weight: 80,
      latencyMs: 80,
      healthScore: 90,
      maxConcurrency: 800,
      currentLoad: 20,
      metadata: null,
    });

    const plan = service.initiateFailover("failover-source", "health_check_failed");

    assert.ok(plan, "Should create failover plan");
    assert.equal(plan?.sourceRegionId, "failover-source");
    assert.equal(plan?.cause, "health_check_failed");
    assert.equal(plan?.status, "pending");
    assert.ok(plan?.steps.length === 5, "Should have 5 failover steps");
  } finally {
    cleanupPath(harness.workspace);
  }
});

test("CrossRegionDeploymentService returns null when failover source not found", () => {
  const harness = createHarness("aa-cross-region-failover-missing-");
  try {
    const service = new CrossRegionDeploymentService(harness.db);

    const plan = service.initiateFailover("nonexistent", "manual");
    assert.equal(plan, null, "Should return null for unknown source");
  } finally {
    cleanupPath(harness.workspace);
  }
});

test("CrossRegionDeploymentService completes failover step", () => {
  const harness = createHarness("aa-cross-region-complete-");
  try {
    const service = new CrossRegionDeploymentService(harness.db);

    service.registerRegion({
      regionId: "complete-source",
      name: "Source",
      endpoint: "https://source.example.com",
      status: "active",
      priority: 1,
      weight: 100,
      latencyMs: 50,
      healthScore: 95,
      maxConcurrency: 1000,
      currentLoad: 100,
      metadata: null,
    });

    service.registerRegion({
      regionId: "complete-target",
      name: "Target",
      endpoint: "https://target.example.com",
      status: "active",
      priority: 2,
      weight: 80,
      latencyMs: 80,
      healthScore: 90,
      maxConcurrency: 800,
      currentLoad: 20,
      metadata: null,
    });

    const plan = service.initiateFailover("complete-source", "manual", "complete-target");
    assert.ok(plan, "Should create plan");

    const result = service.completeFailoverStep(plan!.planId, "drain_traffic", true);

    assert.equal(result, true, "Should complete step successfully");
  } finally {
    cleanupPath(harness.workspace);
  }
});

test("CrossRegionDeploymentService records health history", () => {
  const harness = createHarness("aa-cross-region-history-");
  try {
    const service = new CrossRegionDeploymentService(harness.db);

    service.registerRegion({
      regionId: "history-region",
      name: "History",
      endpoint: "https://history.example.com",
      status: "active",
      priority: 1,
      weight: 100,
      latencyMs: 50,
      healthScore: 95,
      maxConcurrency: 1000,
      currentLoad: 100,
      metadata: null,
    });

    service.recordRegionHealth({
      regionId: "history-region",
      status: "active",
      latencyMs: 55,
      healthScore: 93,
      errorMessage: null,
      checkedAt: "2026-04-26T00:00:00.000Z",
    });

    service.recordRegionHealth({
      regionId: "history-region",
      status: "degraded",
      latencyMs: 200,
      healthScore: 50,
      errorMessage: "Latency spike",
      checkedAt: "2026-04-26T01:00:00.000Z",
    });

    const history = service.getRegionHealthHistory("history-region", 10);

    assert.ok(history.length >= 2, "Should have at least 2 health records");
  } finally {
    cleanupPath(harness.workspace);
  }
});

test("CrossRegionDeploymentService marks remaining failover steps skipped after a failure", () => {
  const harness = createHarness("aa-cross-region-failover-skip-");
  try {
    const service = new CrossRegionDeploymentService(harness.db);

    service.registerRegion({
      regionId: "skip-source",
      name: "Source",
      endpoint: "https://skip-source.example.com",
      status: "active",
      priority: 1,
      weight: 100,
      latencyMs: 50,
      healthScore: 95,
      maxConcurrency: 1000,
      currentLoad: 100,
      metadata: null,
    });

    service.registerRegion({
      regionId: "skip-target",
      name: "Target",
      endpoint: "https://skip-target.example.com",
      status: "active",
      priority: 2,
      weight: 80,
      latencyMs: 80,
      healthScore: 90,
      maxConcurrency: 800,
      currentLoad: 20,
      metadata: null,
    });

    const plan = service.initiateFailover("skip-source", "manual", "skip-target");
    assert.ok(plan, "Should create failover plan");

    const updated = service.completeFailoverStep(plan!.planId, "drain_traffic", false, "drain failed");
    assert.equal(updated, true);

    const storedPlan = service.getFailoverPlan(plan!.planId);
    assert.equal(storedPlan?.status, "failed");
    assert.equal(storedPlan?.steps[0]?.status, "failed");
    assert.ok(storedPlan?.steps.slice(1).every((step) => step.status === "skipped"));
  } finally {
    cleanupPath(harness.workspace);
  }
});

test("CrossRegionDeploymentService getEffectiveWeights filters expired", () => {
  const harness = createHarness("aa-cross-region-weights-");
  try {
    const service = new CrossRegionDeploymentService(harness.db);

    service.registerRegion({
      regionId: "weights-region",
      name: "Weights",
      endpoint: "https://weights.example.com",
      status: "active",
      priority: 1,
      weight: 100,
      latencyMs: 50,
      healthScore: 95,
      maxConcurrency: 1000,
      currentLoad: 100,
      metadata: null,
    });

    service.setRegionWeight("weights-region", 50, "2025-01-01T00:00:00.000Z", "2025-01-02T00:00:00.000Z");
    service.setRegionWeight("weights-region", 75, "2026-04-26T00:00:00.000Z", "2099-01-01T00:00:00.000Z");

    const weights = service.getEffectiveWeights();
    const activeWeights = weights.filter((w) => w.regionId === "weights-region");

    assert.ok(activeWeights.length >= 1, "Should have at least one active weight");
    const latestWeight = activeWeights.sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt))[0];
    assert.equal(latestWeight?.weight, 75, "Should use most recent active weight");
  } finally {
    cleanupPath(harness.workspace);
  }
});
