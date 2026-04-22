import assert from "node:assert/strict";
import test from "node:test";

import {
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
