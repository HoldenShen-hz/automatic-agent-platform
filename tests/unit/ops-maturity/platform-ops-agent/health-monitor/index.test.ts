import assert from "node:assert/strict";
import test from "node:test";

import {
  OpsHealthMonitorService,
  summarizeOpsHealth,
  findUnhealthyComponents,
  calculateHealthMetrics,
  groupProbesByStatus,
  analyzeLatencyTrends,
  hasLatencyAnomalies,
  generateHealthSummary,
  type OpsHealthProbe,
  type OpsHealthMetrics,
  type OpsHealthAlert,
  type OpsHealthSnapshot,
} from "../../../../../src/ops-maturity/platform-ops-agent/health-monitor/index.js";

// ============================================================================
// OpsHealthProbe Interface Tests
// ============================================================================

test("OpsHealthProbe accepts valid healthy status", () => {
  const probe: OpsHealthProbe = {
    component: "test-component",
    status: "healthy",
  };
  assert.equal(probe.status, "healthy");
  assert.equal(probe.component, "test-component");
});

test("OpsHealthProbe accepts optional latencyMs", () => {
  const probe: OpsHealthProbe = {
    component: "test-component",
    status: "healthy",
    latencyMs: 150,
  };
  assert.equal(probe.latencyMs, 150);
});

test("OpsHealthProbe accepts optional timestamp", () => {
  const probe: OpsHealthProbe = {
    component: "test-component",
    status: "healthy",
    timestamp: "2026-04-23T10:00:00.000Z",
  };
  assert.equal(probe.timestamp, "2026-04-23T10:00:00.000Z");
});

test("OpsHealthProbe accepts optional metadata", () => {
  const probe: OpsHealthProbe = {
    component: "test-component",
    status: "healthy",
    metadata: { region: "us-east", env: "production" },
  };
  assert.equal(probe.metadata?.region, "us-east");
  assert.equal(probe.metadata?.env, "production");
});

test("OpsHealthProbe accepts all status values", () => {
  const healthy: OpsHealthProbe = { component: "c", status: "healthy" };
  const degraded: OpsHealthProbe = { component: "c", status: "degraded" };
  const failed: OpsHealthProbe = { component: "c", status: "failed" };

  assert.equal(healthy.status, "healthy");
  assert.equal(degraded.status, "degraded");
  assert.equal(failed.status, "failed");
});

// ============================================================================
// OpsHealthMetrics Interface Tests
// ============================================================================

test("OpsHealthMetrics structure is correct", () => {
  const metrics: OpsHealthMetrics = {
    totalComponents: 3,
    healthyCount: 1,
    degradedCount: 1,
    failedCount: 1,
    healthScore: 50,
    averageLatencyMs: 100,
    slowestComponent: "comp2",
    mostRecentCheck: "2026-04-23T10:00:00.000Z",
  };

  assert.equal(metrics.totalComponents, 3);
  assert.equal(metrics.healthyCount, 1);
  assert.equal(metrics.degradedCount, 1);
  assert.equal(metrics.failedCount, 1);
  assert.equal(metrics.healthScore, 50);
  assert.equal(metrics.averageLatencyMs, 100);
  assert.equal(metrics.slowestComponent, "comp2");
  assert.equal(metrics.mostRecentCheck, "2026-04-23T10:00:00.000Z");
});

test("OpsHealthMetrics allows null optional fields", () => {
  const metrics: OpsHealthMetrics = {
    totalComponents: 0,
    healthyCount: 0,
    degradedCount: 0,
    failedCount: 0,
    healthScore: 100,
    averageLatencyMs: null,
    slowestComponent: null,
    mostRecentCheck: null,
  };

  assert.equal(metrics.averageLatencyMs, null);
  assert.equal(metrics.slowestComponent, null);
  assert.equal(metrics.mostRecentCheck, null);
});

// ============================================================================
// OpsHealthAlert Interface Tests
// ============================================================================

test("OpsHealthAlert structure is correct", () => {
  const alert: OpsHealthAlert = {
    component: "test-component",
    severity: "critical",
    reasonCode: "ops.health.component_failed",
  };

  assert.equal(alert.component, "test-component");
  assert.equal(alert.severity, "critical");
  assert.equal(alert.reasonCode, "ops.health.component_failed");
});

test("OpsHealthAlert accepts warning severity", () => {
  const alert: OpsHealthAlert = {
    component: "test-component",
    severity: "warning",
    reasonCode: "ops.health.latency_anomaly",
  };

  assert.equal(alert.severity, "warning");
});

// ============================================================================
// OpsHealthSnapshot Interface Tests
// ============================================================================

test("OpsHealthSnapshot structure is correct", () => {
  const snapshot: OpsHealthSnapshot = {
    status: "healthy",
    metrics: {
      totalComponents: 1,
      healthyCount: 1,
      degradedCount: 0,
      failedCount: 0,
      healthScore: 100,
      averageLatencyMs: null,
      slowestComponent: null,
      mostRecentCheck: null,
    },
    alerts: [],
  };

  assert.equal(snapshot.status, "healthy");
  assert.equal(snapshot.metrics.totalComponents, 1);
  assert.equal(snapshot.alerts.length, 0);
});

// ============================================================================
// summarizeOpsHealth Tests
// ============================================================================

test("summarizeOpsHealth returns healthy when all probes are healthy", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "healthy" },
  ];
  assert.equal(summarizeOpsHealth(probes), "healthy");
});

test("summarizeOpsHealth returns degraded when any probe is degraded", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "degraded" },
  ];
  assert.equal(summarizeOpsHealth(probes), "degraded");
});

test("summarizeOpsHealth returns failed when any probe is failed", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "failed" },
  ];
  assert.equal(summarizeOpsHealth(probes), "failed");
});

test("summarizeOpsHealth prioritizes failed over degraded", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "degraded" },
    { component: "comp2", status: "failed" },
  ];
  assert.equal(summarizeOpsHealth(probes), "failed");
});

test("summarizeOpsHealth handles empty probes array", () => {
  assert.equal(summarizeOpsHealth([]), "healthy");
});

test("summarizeOpsHealth returns healthy for single healthy probe", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
  ];
  assert.equal(summarizeOpsHealth(probes), "healthy");
});

test("summarizeOpsHealth returns degraded for single degraded probe", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "degraded" },
  ];
  assert.equal(summarizeOpsHealth(probes), "degraded");
});

test("summarizeOpsHealth returns failed for single failed probe", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "failed" },
  ];
  assert.equal(summarizeOpsHealth(probes), "failed");
});

test("summarizeOpsHealth failed takes priority even with multiple degraded", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "degraded" },
    { component: "comp2", status: "failed" },
    { component: "comp3", status: "degraded" },
  ];
  assert.equal(summarizeOpsHealth(probes), "failed");
});

// ============================================================================
// findUnhealthyComponents Tests
// ============================================================================

test("findUnhealthyComponents returns all unhealthy component names", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "degraded" },
    { component: "comp3", status: "failed" },
    { component: "comp4", status: "healthy" },
  ];
  const unhealthy = findUnhealthyComponents(probes);
  assert.equal(unhealthy.length, 2);
  assert.ok(unhealthy.includes("comp2"));
  assert.ok(unhealthy.includes("comp3"));
});

test("findUnhealthyComponents returns empty array when all healthy", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "healthy" },
  ];
  const unhealthy = findUnhealthyComponents(probes);
  assert.equal(unhealthy.length, 0);
});

test("findUnhealthyComponents handles empty probes array", () => {
  const unhealthy = findUnhealthyComponents([]);
  assert.equal(unhealthy.length, 0);
});

test("findUnhealthyComponents returns only degraded when no failed", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "degraded" },
  ];
  const unhealthy = findUnhealthyComponents(probes);
  assert.equal(unhealthy.length, 1);
  assert.ok(unhealthy.includes("comp2"));
});

test("findUnhealthyComponents returns only failed when no degraded", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "failed" },
  ];
  const unhealthy = findUnhealthyComponents(probes);
  assert.equal(unhealthy.length, 1);
  assert.ok(unhealthy.includes("comp2"));
});

test("findUnhealthyComponents returns both degraded and failed", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "degraded" },
    { component: "comp2", status: "failed" },
  ];
  const unhealthy = findUnhealthyComponents(probes);
  assert.equal(unhealthy.length, 2);
  assert.ok(unhealthy.includes("comp1"));
  assert.ok(unhealthy.includes("comp2"));
});

// ============================================================================
// calculateHealthMetrics Tests
// ============================================================================

test("calculateHealthMetrics computes correct counts", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "healthy" },
    { component: "comp3", status: "degraded" },
    { component: "comp4", status: "failed" },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.totalComponents, 4);
  assert.equal(metrics.healthyCount, 2);
  assert.equal(metrics.degradedCount, 1);
  assert.equal(metrics.failedCount, 1);
});

test("calculateHealthMetrics computes correct health score", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "healthy" },
    { component: "comp3", status: "degraded" },
    { component: "comp4", status: "failed" },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.healthScore, 63); // (100 + 100 + 50 + 0) / 4 = 62.5, rounded to 63
});

test("calculateHealthMetrics handles all healthy probes", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "healthy" },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.healthScore, 100);
});

test("calculateHealthMetrics handles all failed probes", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "failed" },
    { component: "comp2", status: "failed" },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.healthScore, 0);
});

test("calculateHealthMetrics handles empty probes array", () => {
  const metrics = calculateHealthMetrics([]);
  assert.equal(metrics.totalComponents, 0);
  assert.equal(metrics.healthyCount, 0);
  assert.equal(metrics.degradedCount, 0);
  assert.equal(metrics.failedCount, 0);
  assert.equal(metrics.healthScore, 100);
});

test("calculateHealthMetrics computes average latency", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", latencyMs: 100 },
    { component: "comp2", status: "healthy", latencyMs: 200 },
    { component: "comp3", status: "healthy", latencyMs: 300 },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.averageLatencyMs, 200);
});

test("calculateHealthMetrics returns null latency when no probes have latency", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "healthy" },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.averageLatencyMs, null);
});

test("calculateHealthMetrics returns null latency for empty array", () => {
  const metrics = calculateHealthMetrics([]);
  assert.equal(metrics.averageLatencyMs, null);
});

test("calculateHealthMetrics finds slowest component", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", latencyMs: 100 },
    { component: "comp2", status: "healthy", latencyMs: 500 },
    { component: "comp3", status: "healthy", latencyMs: 300 },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.slowestComponent, "comp2");
});

test("calculateHealthMetrics returns null slowest when no probes have latency", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "healthy" },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.slowestComponent, null);
});

test("calculateHealthMetrics returns null slowest for empty array", () => {
  const metrics = calculateHealthMetrics([]);
  assert.equal(metrics.slowestComponent, null);
});

test("calculateHealthMetrics finds most recent check timestamp", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", timestamp: "2026-04-22T10:00:00.000Z" },
    { component: "comp2", status: "healthy", timestamp: "2026-04-22T12:00:00.000Z" },
    { component: "comp3", status: "healthy", timestamp: "2026-04-22T11:00:00.000Z" },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.mostRecentCheck, "2026-04-22T12:00:00.000Z");
});

test("calculateHealthMetrics returns null mostRecentCheck when no timestamps", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "healthy" },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.mostRecentCheck, null);
});

test("calculateHealthMetrics all degraded returns 50 score", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "degraded" },
    { component: "comp2", status: "degraded" },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.healthScore, 50);
});

test("calculateHealthMetrics mixed healthy and degraded", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "degraded" },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.healthScore, 75); // (100 + 50) / 2 = 75
});

test("calculateHealthMetrics mixed healthy and failed", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "failed" },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.healthScore, 50); // (100 + 0) / 2 = 50
});

test("calculateHealthMetrics mixed degraded and failed", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "degraded" },
    { component: "comp2", status: "failed" },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.healthScore, 25); // (50 + 0) / 2 = 25
});

test("calculateHealthMetrics single healthy probe", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.healthScore, 100);
  assert.equal(metrics.totalComponents, 1);
  assert.equal(metrics.healthyCount, 1);
  assert.equal(metrics.degradedCount, 0);
  assert.equal(metrics.failedCount, 0);
});

test("calculateHealthMetrics single degraded probe", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "degraded" },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.healthScore, 50);
  assert.equal(metrics.totalComponents, 1);
  assert.equal(metrics.healthyCount, 0);
  assert.equal(metrics.degradedCount, 1);
  assert.equal(metrics.failedCount, 0);
});

test("calculateHealthMetrics single failed probe", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "failed" },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.healthScore, 0);
  assert.equal(metrics.totalComponents, 1);
  assert.equal(metrics.healthyCount, 0);
  assert.equal(metrics.degradedCount, 0);
  assert.equal(metrics.failedCount, 1);
});

test("calculateHealthMetrics rounds average latency", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", latencyMs: 101 },
    { component: "comp2", status: "healthy", latencyMs: 102 },
    { component: "comp3", status: "healthy", latencyMs: 103 },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.averageLatencyMs, 102);
});

test("calculateHealthMetrics slowest component with equal latencies returns first", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", latencyMs: 100 },
    { component: "comp2", status: "healthy", latencyMs: 100 },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.slowestComponent, "comp1");
});

test("calculateHealthMetrics handles zero latency", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", latencyMs: 0 },
    { component: "comp2", status: "healthy", latencyMs: 100 },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.slowestComponent, "comp2");
});

test("calculateHealthMetrics handles mixed probes with and without latency", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "degraded", latencyMs: 200 },
    { component: "comp3", status: "failed" },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.averageLatencyMs, 200);
  assert.equal(metrics.slowestComponent, "comp2");
  assert.equal(metrics.healthyCount, 1);
  assert.equal(metrics.degradedCount, 1);
  assert.equal(metrics.failedCount, 1);
});

test("calculateHealthMetrics handles probes with metadata", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", metadata: { region: "us-east" } },
    { component: "comp2", status: "healthy", metadata: { region: "us-west" } },
  ];
  const metrics = calculateHealthMetrics(probes);
  assert.equal(metrics.totalComponents, 2);
  assert.equal(metrics.healthScore, 100);
});

// ============================================================================
// groupProbesByStatus Tests
// ============================================================================

test("groupProbesByStatus groups probes correctly", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "degraded" },
    { component: "comp3", status: "failed" },
    { component: "comp4", status: "healthy" },
    { component: "comp5", status: "degraded" },
  ];
  const grouped = groupProbesByStatus(probes);
  assert.equal(grouped.healthy.length, 2);
  assert.equal(grouped.degraded.length, 2);
  assert.equal(grouped.failed.length, 1);
});

test("groupProbesByStatus handles empty array", () => {
  const grouped = groupProbesByStatus([]);
  assert.equal(grouped.healthy.length, 0);
  assert.equal(grouped.degraded.length, 0);
  assert.equal(grouped.failed.length, 0);
});

test("groupProbesByStatus handles all same status", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "healthy" },
  ];
  const grouped = groupProbesByStatus(probes);
  assert.equal(grouped.healthy.length, 2);
  assert.equal(grouped.degraded.length, 0);
  assert.equal(grouped.failed.length, 0);
});

test("groupProbesByStatus preserves probe objects", () => {
  const probe1 = { component: "comp1", status: "healthy" as const };
  const probes: OpsHealthProbe[] = [probe1];
  const grouped = groupProbesByStatus(probes);
  assert.strictEqual(grouped.healthy[0], probe1);
});

test("groupProbesByStatus handles single probe of each status", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "degraded" },
    { component: "comp3", status: "failed" },
  ];
  const grouped = groupProbesByStatus(probes);
  assert.equal(grouped.healthy.length, 1);
  assert.equal(grouped.degraded.length, 1);
  assert.equal(grouped.failed.length, 1);
  assert.equal(grouped.healthy[0]?.component, "comp1");
  assert.equal(grouped.degraded[0]?.component, "comp2");
  assert.equal(grouped.failed[0]?.component, "comp3");
});

// ============================================================================
// analyzeLatencyTrends Tests
// ============================================================================

test("analyzeLatencyTrends returns sorted latency list", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", latencyMs: 100 },
    { component: "comp2", status: "healthy", latencyMs: 500 },
    { component: "comp3", status: "healthy", latencyMs: 300 },
    { component: "comp4", status: "healthy" },
  ];
  const trends = analyzeLatencyTrends(probes);
  assert.equal(trends.length, 3);
  assert.equal(trends[0]!.component, "comp2");
  assert.equal(trends[0]!.latencyMs, 500);
  assert.equal(trends[1]!.component, "comp3");
  assert.equal(trends[2]!.component, "comp1");
});

test("analyzeLatencyTrends handles empty array", () => {
  const trends = analyzeLatencyTrends([]);
  assert.equal(trends.length, 0);
});

test("analyzeLatencyTrends handles no probes with latency", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "healthy" },
  ];
  const trends = analyzeLatencyTrends(probes);
  assert.equal(trends.length, 0);
});

test("analyzeLatencyTrends returns empty for empty array", () => {
  const trends = analyzeLatencyTrends([]);
  assert.equal(trends.length, 0);
});

test("analyzeLatencyTrends returns empty when no latencies", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "healthy" },
  ];
  const trends = analyzeLatencyTrends(probes);
  assert.equal(trends.length, 0);
});

test("analyzeLatencyTrends returns single probe sorted", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", latencyMs: 100 },
  ];
  const trends = analyzeLatencyTrends(probes);
  assert.equal(trends.length, 1);
  assert.equal(trends[0]?.component, "comp1");
  assert.equal(trends[0]?.latencyMs, 100);
});

test("analyzeLatencyTrends ignores probes without latency", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "healthy", latencyMs: 100 },
    { component: "comp3", status: "healthy" },
  ];
  const trends = analyzeLatencyTrends(probes);
  assert.equal(trends.length, 1);
  assert.equal(trends[0]?.component, "comp2");
});

// ============================================================================
// hasLatencyAnomalies Tests
// ============================================================================

test("hasLatencyAnomalies returns true when above threshold", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", latencyMs: 100 },
    { component: "comp2", status: "healthy", latencyMs: 500 },
  ];
  assert.equal(hasLatencyAnomalies(probes, 300), true);
});

test("hasLatencyAnomalies returns false when all below threshold", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", latencyMs: 100 },
    { component: "comp2", status: "healthy", latencyMs: 200 },
  ];
  assert.equal(hasLatencyAnomalies(probes, 300), false);
});

test("hasLatencyAnomalies ignores probes without latency", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "healthy", latencyMs: 1000 },
  ];
  assert.equal(hasLatencyAnomalies(probes, 500), true);
});

test("hasLatencyAnomalies handles empty array", () => {
  assert.equal(hasLatencyAnomalies([], 300), false);
});

test("hasLatencyAnomalies uses exact threshold comparison", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", latencyMs: 300 },
  ];
  assert.equal(hasLatencyAnomalies(probes, 300), false);
  assert.equal(hasLatencyAnomalies(probes, 299), true);
});

test("hasLatencyAnomalies returns false for empty array", () => {
  assert.equal(hasLatencyAnomalies([], 100), false);
});

test("hasLatencyAnomalies returns false when no probes have latency", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "healthy" },
  ];
  assert.equal(hasLatencyAnomalies(probes, 100), false);
});

test("hasLatencyAnomalies detects exact threshold as not anomalous", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", latencyMs: 100 },
  ];
  assert.equal(hasLatencyAnomalies(probes, 100), false);
});

test("hasLatencyAnomalies detects above threshold", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", latencyMs: 101 },
  ];
  assert.equal(hasLatencyAnomalies(probes, 100), true);
});

test("hasLatencyAnomalies handles zero threshold", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", latencyMs: 1 },
  ];
  assert.equal(hasLatencyAnomalies(probes, 0), true);
});

test("hasLatencyAnomalies ignores zero latency probes", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", latencyMs: 0 },
  ];
  assert.equal(hasLatencyAnomalies(probes, 0), false);
});
