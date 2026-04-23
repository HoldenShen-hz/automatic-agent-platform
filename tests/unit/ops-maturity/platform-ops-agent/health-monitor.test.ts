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
} from "../../../../src/ops-maturity/platform-ops-agent/health-monitor/index.js";

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
    { component: "comp1", status: "healthy" },    // 100
    { component: "comp2", status: "healthy" },    // 100
    { component: "comp3", status: "degraded" },   // 50
    { component: "comp4", status: "failed" },     // 0
  ];
  const metrics = calculateHealthMetrics(probes);
  // (100 + 100 + 50 + 0) / 4 = 62.5, rounded to 63
  assert.equal(metrics.healthScore, 63);
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

test("groupProbesByStatus groups probes correctly", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "degraded" },
    { component: "comp3", status: "failed" },
    { component: "comp4", status: "healthy" },
    { component: "comp5", status: "degraded" },
  ];
  const grouped = groupProbesByStatus(probes);
  assert.equal(grouped.healthy?.length, 2);
  assert.equal(grouped.degraded?.length, 2);
  assert.equal(grouped.failed?.length, 1);
});

test("groupProbesByStatus handles empty array", () => {
  const grouped = groupProbesByStatus([]);
  assert.equal(grouped.healthy?.length, 0);
  assert.equal(grouped.degraded?.length, 0);
  assert.equal(grouped.failed?.length, 0);
});

test("groupProbesByStatus handles all same status", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "healthy" },
  ];
  const grouped = groupProbesByStatus(probes);
  assert.equal(grouped.healthy?.length, 2);
  assert.equal(grouped.degraded?.length, 0);
  assert.equal(grouped.failed?.length, 0);
});

test("analyzeLatencyTrends returns sorted latency list", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", latencyMs: 100 },
    { component: "comp2", status: "healthy", latencyMs: 500 },
    { component: "comp3", status: "healthy", latencyMs: 300 },
    { component: "comp4", status: "healthy" }, // No latency
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
  // At threshold, should return false (not above)
  assert.equal(hasLatencyAnomalies(probes, 300), false);
  // Above threshold
  assert.equal(hasLatencyAnomalies(probes, 299), true);
});

test("generateHealthSummary returns a string", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "degraded" },
  ];
  const summary = generateHealthSummary(probes);
  assert.ok(typeof summary === "string");
  assert.ok(summary.length > 0);
});

test("generateHealthSummary includes status in output", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
  ];
  const summary = generateHealthSummary(probes);
  assert.ok(summary.includes("HEALTHY") || summary.includes("healthy"));
});

test("generateHealthSummary includes component counts", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "healthy" },
    { component: "comp3", status: "degraded" },
    { component: "comp4", status: "failed" },
  ];
  const summary = generateHealthSummary(probes);
  assert.ok(summary.includes("2") || summary.includes("healthy"));
  assert.ok(summary.includes("1") || summary.includes("degraded"));
  assert.ok(summary.includes("1") || summary.includes("failed"));
});

test("generateHealthSummary includes latency when present", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", latencyMs: 150 },
  ];
  const summary = generateHealthSummary(probes);
  assert.ok(summary.includes("150") || summary.includes("latency"));
});

test("generateHealthSummary includes slowest component when present", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", latencyMs: 100 },
    { component: "comp2", status: "healthy", latencyMs: 500 },
  ];
  const summary = generateHealthSummary(probes);
  assert.ok(summary.includes("comp2") || summary.includes("Slowest"));
});

test("generateHealthSummary handles empty probes", () => {
  const summary = generateHealthSummary([]);
  assert.ok(typeof summary === "string");
});

// Additional edge case tests for improved coverage

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
  // (100 + 50) / 2 = 75
  assert.equal(metrics.healthScore, 75);
});

test("calculateHealthMetrics mixed healthy and failed", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "failed" },
  ];
  const metrics = calculateHealthMetrics(probes);
  // (100 + 0) / 2 = 50
  assert.equal(metrics.healthScore, 50);
});

test("calculateHealthMetrics mixed degraded and failed", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "degraded" },
    { component: "comp2", status: "failed" },
  ];
  const metrics = calculateHealthMetrics(probes);
  // (50 + 0) / 2 = 25
  assert.equal(metrics.healthScore, 25);
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
  // (101 + 102 + 103) / 3 = 102
  assert.equal(metrics.averageLatencyMs, 102);
});

test("calculateHealthMetrics slowest component with equal latencies returns first", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy", latencyMs: 100 },
    { component: "comp2", status: "healthy", latencyMs: 100 },
  ];
  const metrics = calculateHealthMetrics(probes);
  // First one with max latency should be returned
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

test("generateHealthSummary includes health score value", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
  ];
  const summary = generateHealthSummary(probes);
  assert.ok(summary.includes("100"));
});

test("generateHealthSummary handles all degraded components", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "degraded" },
    { component: "comp2", status: "degraded" },
  ];
  const summary = generateHealthSummary(probes);
  assert.ok(summary.includes("DEGRADED") || summary.includes("degraded"));
});

test("generateHealthSummary handles all failed components", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "failed" },
    { component: "comp2", status: "failed" },
  ];
  const summary = generateHealthSummary(probes);
  assert.ok(summary.includes("FAILED") || summary.includes("failed"));
});

test("generateHealthSummary does not include latency when absent", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
  ];
  const summary = generateHealthSummary(probes);
  assert.ok(!summary.includes("Avg latency"));
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

test("summarizeOpsHealth returns healthy for empty array", () => {
  assert.equal(summarizeOpsHealth([]), "healthy");
});

test("summarizeOpsHealth failed takes priority over degraded", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "degraded" },
    { component: "comp2", status: "failed" },
    { component: "comp3", status: "degraded" },
  ];
  assert.equal(summarizeOpsHealth(probes), "failed");
});

test("findUnhealthyComponents returns empty for all healthy", () => {
  const probes: OpsHealthProbe[] = [
    { component: "comp1", status: "healthy" },
    { component: "comp2", status: "healthy" },
  ];
  const unhealthy = findUnhealthyComponents(probes);
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

test("OpsHealthMonitorService emits alerts for failed and slow probes", () => {
  const service = new OpsHealthMonitorService();
  const snapshot = service.evaluate([
    { component: "worker-a", status: "failed", latencyMs: 2500 },
    { component: "worker-b", status: "degraded", latencyMs: 1200 },
    { component: "worker-c", status: "healthy", latencyMs: 100 },
  ], { latencyThresholdMs: 1000 });

  assert.equal(snapshot.status, "failed");
  assert.ok(snapshot.alerts.some((item) => item.component === "worker-a" && item.reasonCode === "ops.health.component_failed"));
  assert.ok(snapshot.alerts.some((item) => item.reasonCode === "ops.health.latency_anomaly"));
});

test("OpsHealthMonitorService returns healthy snapshot without alerts", () => {
  const service = new OpsHealthMonitorService();
  const snapshot = service.evaluate([
    { component: "worker-a", status: "healthy", latencyMs: 50 },
    { component: "worker-b", status: "healthy", latencyMs: 70 },
  ], { latencyThresholdMs: 1000 });

  assert.equal(snapshot.status, "healthy");
  assert.equal(snapshot.alerts.length, 0);
});

test("OpsHealthMonitorService emits warning alerts for degraded and mildly slow probes", () => {
  const service = new OpsHealthMonitorService();
  const snapshot = service.evaluate([
    { component: "worker-a", status: "degraded", latencyMs: 1200 },
  ], { latencyThresholdMs: 1000 });

  assert.equal(snapshot.status, "degraded");
  assert.ok(snapshot.alerts.some((item) => item.severity === "warning" && item.reasonCode === "ops.health.component_degraded"));
});
