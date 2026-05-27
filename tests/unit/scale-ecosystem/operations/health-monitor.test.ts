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
} from "../../../../src/ops-maturity/platform-ops-agent/health-monitor/index.js";
import type { OpsHealthProbe } from "../../../../src/ops-maturity/platform-ops-agent/health-monitor/index.js";

function makeProbe(overrides: Partial<OpsHealthProbe> = {}): OpsHealthProbe {
  const result: OpsHealthProbe = {
    component: overrides.component ?? "test-component",
    status: overrides.status ?? "healthy",
    timestamp: overrides.timestamp ?? "2026-04-25T00:00:00.000Z",
    ...(overrides.latencyMs !== undefined ? { latencyMs: overrides.latencyMs } : {}),
    ...(overrides.metadata !== undefined ? { metadata: overrides.metadata } : {}),
  };
  return result;
}

test("OpsHealthMonitorService.evaluate returns snapshot with status degraded when any probe degraded [health-monitor]", () => {
  const service = new OpsHealthMonitorService();
  const probes: OpsHealthProbe[] = [
    makeProbe({ component: "comp-a", status: "healthy", latencyMs: 10 }),
    makeProbe({ component: "comp-b", status: "degraded", latencyMs: 300 }),
  ];

  const snapshot = service.evaluate(probes);

  assert.equal(snapshot.status, "degraded");
  assert.equal(snapshot.alerts.length, 1);
  assert.equal(snapshot.alerts[0]!.severity, "warning");
  assert.equal(snapshot.alerts[0]!.reasonCode, "ops.health.component_degraded");
});

test("OpsHealthMonitorService.evaluate returns snapshot with status failed when any probe failed [health-monitor]", () => {
  const service = new OpsHealthMonitorService();
  const probes: OpsHealthProbe[] = [
    makeProbe({ component: "comp-a", status: "healthy", latencyMs: 10 }),
    makeProbe({ component: "comp-b", status: "failed", latencyMs: 5000 }),
  ];

  const snapshot = service.evaluate(probes);

  assert.equal(snapshot.status, "failed");
  assert.equal(snapshot.alerts.some((a) => a.severity === "critical"), true);
});

test("OpsHealthMonitorService.evaluate includes latency anomaly alerts [health-monitor]", () => {
  const service = new OpsHealthMonitorService();
  const probes: OpsHealthProbe[] = [
    makeProbe({ component: "comp-a", status: "healthy", latencyMs: 2000 }),
  ];

  const snapshot = service.evaluate(probes, { latencyThresholdMs: 1000 });

  assert.ok(snapshot.alerts.some((a) => a.reasonCode === "ops.health.latency_anomaly"));
});

test("OpsHealthMonitorService.evaluate uses custom latency threshold [health-monitor]", () => {
  const service = new OpsHealthMonitorService();
  const probes: OpsHealthProbe[] = [
    makeProbe({ component: "comp-a", status: "healthy", latencyMs: 800 }),
  ];

  const snapshot = service.evaluate(probes, { latencyThresholdMs: 1000 });

  assert.equal(snapshot.alerts.length, 0);
});

test("OpsHealthMonitorService.evaluate marks double-threshold as critical [health-monitor]", () => {
  const service = new OpsHealthMonitorService();
  const probes: OpsHealthProbe[] = [
    makeProbe({ component: "comp-a", status: "healthy", latencyMs: 5000 }),
  ];

  const snapshot = service.evaluate(probes, { latencyThresholdMs: 1000 });

  const latencyAlert = snapshot.alerts.find((a) => a.reasonCode === "ops.health.latency_anomaly");
  assert.ok(latencyAlert);
  assert.equal(latencyAlert.severity, "critical");
});

test("OpsHealthMonitorService.evaluate calculates correct metrics [health-monitor]", () => {
  const service = new OpsHealthMonitorService();
  const probes: OpsHealthProbe[] = [
    makeProbe({ component: "comp-a", status: "healthy", latencyMs: 100 }),
    makeProbe({ component: "comp-b", status: "degraded", latencyMs: 300 }),
    makeProbe({ component: "comp-c", status: "healthy", latencyMs: 200 }),
  ];

  const snapshot = service.evaluate(probes);

  assert.equal(snapshot.metrics.totalComponents, 3);
  assert.equal(snapshot.metrics.healthyCount, 2);
  assert.equal(snapshot.metrics.degradedCount, 1);
  assert.equal(snapshot.metrics.failedCount, 0);
  assert.equal(snapshot.metrics.healthScore, Math.round((100 + 50 + 100) / 3));
});

test("OpsHealthMonitorService.evaluate returns empty alerts for all-healthy probes [health-monitor]", () => {
  const service = new OpsHealthMonitorService();
  const probes: OpsHealthProbe[] = [
    makeProbe({ component: "comp-a", status: "healthy", latencyMs: 50 }),
    makeProbe({ component: "comp-b", status: "healthy", latencyMs: 75 }),
  ];

  const snapshot = service.evaluate(probes);

  assert.equal(snapshot.status, "healthy");
  assert.equal(snapshot.alerts.length, 0);
});

test("OpsHealthMonitorService.evaluate handles empty probe array [health-monitor]", () => {
  const service = new OpsHealthMonitorService();
  const snapshot = service.evaluate([]);

  assert.equal(snapshot.status, "healthy");
  assert.equal(snapshot.metrics.totalComponents, 0);
  assert.equal(snapshot.metrics.healthScore, 100);
  assert.equal(snapshot.alerts.length, 0);
});

test("summarizeOpsHealth returns healthy for all-healthy probes [health-monitor]", () => {
  const probes: OpsHealthProbe[] = [
    makeProbe({ status: "healthy" }),
    makeProbe({ status: "healthy" }),
  ];

  const result = summarizeOpsHealth(probes);

  assert.equal(result, "healthy");
});

test("summarizeOpsHealth returns failed if any probe failed [health-monitor]", () => {
  const probes: OpsHealthProbe[] = [
    makeProbe({ status: "healthy" }),
    makeProbe({ status: "failed" }),
    makeProbe({ status: "healthy" }),
  ];

  const result = summarizeOpsHealth(probes);

  assert.equal(result, "failed");
});

test("summarizeOpsHealth returns degraded when no failures but some degraded [health-monitor]", () => {
  const probes: OpsHealthProbe[] = [
    makeProbe({ status: "degraded" }),
    makeProbe({ status: "healthy" }),
  ];

  const result = summarizeOpsHealth(probes);

  assert.equal(result, "degraded");
});

test("findUnhealthyComponents returns non-healthy component names [health-monitor]", () => {
  const probes: OpsHealthProbe[] = [
    makeProbe({ component: "comp-a", status: "healthy" }),
    makeProbe({ component: "comp-b", status: "degraded" }),
    makeProbe({ component: "comp-c", status: "failed" }),
    makeProbe({ component: "comp-d", status: "healthy" }),
  ];

  const result = findUnhealthyComponents(probes);

  assert.equal(result.length, 2);
  assert.ok(result.includes("comp-b"));
  assert.ok(result.includes("comp-c"));
});

test("calculateHealthMetrics returns correct health score [health-monitor]", () => {
  const probes: OpsHealthProbe[] = [
    makeProbe({ status: "healthy", latencyMs: 100 }),
    makeProbe({ status: "healthy", latencyMs: 200 }),
  ];

  const metrics = calculateHealthMetrics(probes);

  assert.equal(metrics.healthScore, 100);
  assert.equal(metrics.totalComponents, 2);
  assert.equal(metrics.healthyCount, 2);
});

test("calculateHealthMetrics returns 100 for empty probes [health-monitor]", () => {
  const metrics = calculateHealthMetrics([]);

  assert.equal(metrics.healthScore, 100);
});

test("calculateHealthMetrics averageLatencyMs is null when no latencies [health-monitor]", () => {
  const probes: OpsHealthProbe[] = [
    makeProbe({}),
    makeProbe({}),
  ];

  const metrics = calculateHealthMetrics(probes);

  assert.equal(metrics.averageLatencyMs, null);
});

test("calculateHealthMetrics slowestComponent is null for empty probes [health-monitor]", () => {
  const metrics = calculateHealthMetrics([]);

  assert.equal(metrics.slowestComponent, null);
});

test("groupProbesByStatus separates probes correctly [health-monitor]", () => {
  const probes: OpsHealthProbe[] = [
    makeProbe({ component: "healthy-1", status: "healthy" }),
    makeProbe({ component: "healthy-2", status: "healthy" }),
    makeProbe({ component: "degraded-1", status: "degraded" }),
    makeProbe({ component: "failed-1", status: "failed" }),
  ];

  const grouped = groupProbesByStatus(probes);

  assert.equal(grouped.healthy.length, 2);
  assert.equal(grouped.degraded.length, 1);
  assert.equal(grouped.failed.length, 1);
});

test("analyzeLatencyTrends returns sorted by latency descending [health-monitor]", () => {
  const probes: OpsHealthProbe[] = [
    makeProbe({ component: "fast", latencyMs: 50 }),
    makeProbe({ component: "slow", latencyMs: 500 }),
    makeProbe({ component: "medium", latencyMs: 200 }),
  ];

  const trends = analyzeLatencyTrends(probes);

  assert.equal(trends.length, 3);
  assert.equal(trends[0]!.component, "slow");
  assert.equal(trends[1]!.component, "medium");
  assert.equal(trends[2]!.component, "fast");
});

test("analyzeLatencyTrends ignores probes without latency [health-monitor]", () => {
  const probes: OpsHealthProbe[] = [
    makeProbe({ component: "with-latency", latencyMs: 100 }),
    makeProbe({ component: "no-latency" }),
  ];

  const trends = analyzeLatencyTrends(probes);

  assert.equal(trends.length, 1);
  assert.equal(trends[0]!.component, "with-latency");
});

test("hasLatencyAnomalies returns true when any probe exceeds threshold [health-monitor]", () => {
  const probes: OpsHealthProbe[] = [
    makeProbe({ component: "normal", latencyMs: 50 }),
    makeProbe({ component: "anomaly", latencyMs: 2000 }),
  ];

  const result = hasLatencyAnomalies(probes, 1000);

  assert.equal(result, true);
});

test("hasLatencyAnomalies returns false when all probes under threshold [health-monitor]", () => {
  const probes: OpsHealthProbe[] = [
    makeProbe({ component: "fast-1", latencyMs: 50 }),
    makeProbe({ component: "fast-2", latencyMs: 100 }),
  ];

  const result = hasLatencyAnomalies(probes, 1000);

  assert.equal(result, false);
});

test("generateHealthSummary formats string correctly [health-monitor]", () => {
  const probes: OpsHealthProbe[] = [
    makeProbe({ component: "comp-a", status: "healthy", latencyMs: 100 }),
    makeProbe({ component: "comp-b", status: "degraded", latencyMs: 300 }),
  ];

  const summary = generateHealthSummary(probes);

  assert.ok(summary.includes("DEGRADED"));
  assert.ok(summary.includes("Score:"));
  assert.ok(summary.includes("degraded"));
});
