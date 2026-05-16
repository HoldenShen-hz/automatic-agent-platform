import assert from "node:assert/strict";
import test from "node:test";

import {
  OpsHealthMonitorService,
  generateHealthSummary,
  type OpsHealthProbe,
} from "../../../../../src/ops-maturity/platform-ops-agent/health-monitor/index.js";

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

test("OpsHealthMonitorService uses default latency threshold when not provided", () => {
  const service = new OpsHealthMonitorService();
  const snapshot = service.evaluate([
    { component: "worker-a", status: "healthy", latencyMs: 500 },
    { component: "worker-b", status: "healthy", latencyMs: 1500 },
  ]);

  assert.equal(snapshot.status, "healthy");
  assert.ok(snapshot.alerts.some((item) => item.reasonCode === "ops.health.latency_anomaly"));
});

test("OpsHealthMonitorService emits critical alert for very slow probes", () => {
  const service = new OpsHealthMonitorService();
  const snapshot = service.evaluate([
    { component: "worker-a", status: "healthy", latencyMs: 2500 },
  ], { latencyThresholdMs: 1000 });

  assert.ok(snapshot.alerts.some((item) => item.severity === "critical" && item.reasonCode === "ops.health.latency_anomaly"));
});

test("OpsHealthMonitorService emits warning alert for mildly slow probes", () => {
  const service = new OpsHealthMonitorService();
  const snapshot = service.evaluate([
    { component: "worker-a", status: "healthy", latencyMs: 1200 },
  ], { latencyThresholdMs: 1000 });

  assert.ok(snapshot.alerts.some((item) => item.severity === "warning" && item.reasonCode === "ops.health.latency_anomaly"));
});

test("OpsHealthMonitorService handles empty probes array", () => {
  const service = new OpsHealthMonitorService();
  const snapshot = service.evaluate([], { latencyThresholdMs: 1000 });

  assert.equal(snapshot.status, "healthy");
  assert.equal(snapshot.alerts.length, 0);
  assert.equal(snapshot.metrics.totalComponents, 0);
});

test("OpsHealthMonitorService returns correct metrics for probes", () => {
  const service = new OpsHealthMonitorService();
  const snapshot = service.evaluate([
    { component: "comp1", status: "healthy", latencyMs: 100 },
    { component: "comp2", status: "degraded", latencyMs: 200 },
    { component: "comp3", status: "failed", latencyMs: 300 },
  ], { latencyThresholdMs: 1000 });

  assert.equal(snapshot.metrics.totalComponents, 3);
  assert.equal(snapshot.metrics.healthyCount, 1);
  assert.equal(snapshot.metrics.degradedCount, 1);
  assert.equal(snapshot.metrics.failedCount, 1);
});

test("OpsHealthMonitorService combines alerts from multiple conditions", () => {
  const service = new OpsHealthMonitorService();
  const snapshot = service.evaluate([
    { component: "worker-a", status: "failed", latencyMs: 3000 },
  ], { latencyThresholdMs: 1000 });

  assert.ok(snapshot.alerts.length >= 2);
  assert.ok(snapshot.alerts.some((item) => item.reasonCode === "ops.health.component_failed"));
  assert.ok(snapshot.alerts.some((item) => item.reasonCode === "ops.health.latency_anomaly"));
});

test("OpsHealthMonitorService does not emit latency alert when latency is at threshold", () => {
  const service = new OpsHealthMonitorService();
  const snapshot = service.evaluate([
    { component: "worker-a", status: "healthy", latencyMs: 1000 },
  ], { latencyThresholdMs: 1000 });

  assert.equal(snapshot.alerts.length, 0);
});

test("OpsHealthMonitorService emits latency alert when latency exceeds threshold", () => {
  const service = new OpsHealthMonitorService();
  const snapshot = service.evaluate([
    { component: "worker-a", status: "healthy", latencyMs: 1001 },
  ], { latencyThresholdMs: 1000 });

  assert.ok(snapshot.alerts.some((item) => item.reasonCode === "ops.health.latency_anomaly"));
});

test("OpsHealthMonitorService ignores probes without latency for anomaly detection", () => {
  const service = new OpsHealthMonitorService();
  const snapshot = service.evaluate([
    { component: "worker-a", status: "healthy" },
  ], { latencyThresholdMs: 1000 });

  assert.equal(snapshot.alerts.length, 0);
});

test("OpsHealthMonitorService handles all failed probes", () => {
  const service = new OpsHealthMonitorService();
  const snapshot = service.evaluate([
    { component: "comp1", status: "failed" },
    { component: "comp2", status: "failed" },
  ], { latencyThresholdMs: 1000 });

  assert.equal(snapshot.status, "failed");
  assert.equal(snapshot.alerts.filter((a) => a.reasonCode === "ops.health.component_failed").length, 2);
});

test("OpsHealthMonitorService handles all degraded probes", () => {
  const service = new OpsHealthMonitorService();
  const snapshot = service.evaluate([
    { component: "comp1", status: "degraded" },
    { component: "comp2", status: "degraded" },
  ], { latencyThresholdMs: 1000 });

  assert.equal(snapshot.status, "degraded");
  assert.equal(snapshot.alerts.filter((a) => a.reasonCode === "ops.health.component_degraded").length, 2);
});

test("OpsHealthMonitorService handles custom latency threshold of zero", () => {
  const service = new OpsHealthMonitorService();
  const snapshot = service.evaluate([
    { component: "worker-a", status: "healthy", latencyMs: 1 },
  ], { latencyThresholdMs: 0 });

  assert.ok(snapshot.alerts.some((item) => item.reasonCode === "ops.health.latency_anomaly"));
});

test("OpsHealthMonitorService returns snapshot with correct OpsHealthSnapshot structure", () => {
  const service = new OpsHealthMonitorService();
  const snapshot = service.evaluate([
    { component: "comp1", status: "healthy" },
  ], { latencyThresholdMs: 1000 });

  assert.ok("status" in snapshot);
  assert.ok("metrics" in snapshot);
  assert.ok("alerts" in snapshot);
  assert.equal(Array.isArray(snapshot.alerts), true);
});
