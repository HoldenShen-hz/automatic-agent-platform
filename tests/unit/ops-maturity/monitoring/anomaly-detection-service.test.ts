import assert from "node:assert/strict";
import test from "node:test";

import {
  AnomalyDetectionService,
  type MetricDatapoint,
  type SloThreshold,
} from "../../../../src/ops-maturity/monitoring/anomaly-detection-service.js";

test("AnomalyDetectionService creates with default thresholds", () => {
  const service = new AnomalyDetectionService();
  assert.ok(service instanceof AnomalyDetectionService);
});

test("AnomalyDetectionService creates with custom thresholds", () => {
  const custom: SloThreshold[] = [
    { metricName: "custom_metric", warningThreshold: 10, criticalThreshold: 20, windowSizeMinutes: 10 },
  ];
  const service = new AnomalyDetectionService(custom);
  assert.ok(service instanceof AnomalyDetectionService);
});

test("ingestMetric stores datapoint", () => {
  const service = new AnomalyDetectionService();
  service.ingestMetric("error_rate", 0.005);

  const stats = service.getMetricStats("error_rate", 5); // Use 5 min window to match default threshold
  assert.ok(stats !== null);
  assert.equal(stats.count, 1);
});

test("detectAnomalies returns empty for unknown metric", () => {
  const service = new AnomalyDetectionService();
  service.ingestMetric("unknown_metric", 100);

  const alerts = service.detectAnomalies("unknown_metric");
  assert.equal(alerts.length, 0);
});

test("detectAnomalies returns empty with insufficient data", () => {
  const service = new AnomalyDetectionService();
  // Only 4 datapoints, needs 5+
  for (let i = 0; i < 4; i++) {
    service.ingestMetric("error_rate", 0.005);
  }

  const alerts = service.detectAnomalies("error_rate");
  assert.equal(alerts.length, 0);
});

test("detectAnomalies detects warning threshold breach", () => {
  const service = new AnomalyDetectionService();
  // Add baseline data
  for (let i = 0; i < 10; i++) {
    service.ingestMetric("error_rate", 0.005);
  }
  // Add value above warning threshold (0.01)
  service.ingestMetric("error_rate", 0.02);

  const alerts = service.detectAnomalies("error_rate");
  assert.ok(alerts.length > 0);
  assert.equal(alerts[0]!.severity, "warning");
});

test("detectAnomalies detects critical threshold breach", () => {
  const service = new AnomalyDetectionService();
  // Add baseline data
  for (let i = 0; i < 10; i++) {
    service.ingestMetric("error_rate", 0.005);
  }
  // Add value above critical threshold (0.05)
  service.ingestMetric("error_rate", 0.1);

  const alerts = service.detectAnomalies("error_rate");
  assert.ok(alerts.some((a) => a.severity === "critical"));
});

test("detectAllAnomalies checks all default metrics", () => {
  const service = new AnomalyDetectionService();
  // Add sufficient data for error_rate
  for (let i = 0; i < 10; i++) {
    service.ingestMetric("error_rate", 0.005);
  }

  const alerts = service.detectAllAnomalies();
  assert.ok(Array.isArray(alerts));
});

test("getMetricStats returns null for unknown metric", () => {
  const service = new AnomalyDetectionService();

  const stats = service.getMetricStats("unknown_metric");
  assert.equal(stats, null);
});

test("getMetricStats calculates correct statistics", () => {
  const service = new AnomalyDetectionService();
  const values = [10, 20, 30, 40, 50];
  for (const v of values) {
    service.ingestMetric("latency_p99_ms", v);
  }

  const stats = service.getMetricStats("latency_p99_ms", 60);
  assert.ok(stats !== null);
  assert.equal(stats.count, 5);
  assert.equal(stats.mean, 30);
  assert.ok(stats.min >= 0);
  assert.ok(stats.max >= stats.mean);
});

test("getMetricStats handles empty buffer", () => {
  const service = new AnomalyDetectionService();

  const stats = service.getMetricStats("error_rate", 60);
  assert.equal(stats, null);
});

test("ingestMetric uses current time when timestamp not provided", () => {
  const service = new AnomalyDetectionService();
  service.ingestMetric("test_metric", 100);

  const stats = service.getMetricStats("test_metric", 60);
  assert.ok(stats !== null);
  assert.equal(stats.count, 1);
});

test("AnomalyAlert structure", () => {
  const service = new AnomalyDetectionService();
  for (let i = 0; i < 10; i++) {
    service.ingestMetric("error_rate", 0.005);
  }
  service.ingestMetric("error_rate", 0.03);

  const alerts = service.detectAnomalies("error_rate");
  assert.ok(alerts.length > 0);

  const alert = alerts[0]!;
  assert.ok(alert.alertId.startsWith("alert_"));
  assert.equal(typeof alert.metricName, "string");
  assert.ok(["warning", "critical"].includes(alert.severity));
  assert.ok(alert.currentValue > 0);
  assert.ok(typeof alert.reason, "string");
  assert.ok(Array.isArray(alert.rootCauseHints));
});

test("detectAnomalies generates root cause hints for error_rate", () => {
  const service = new AnomalyDetectionService();
  for (let i = 0; i < 10; i++) {
    service.ingestMetric("error_rate", 0.005);
  }
  service.ingestMetric("error_rate", 0.03);

  const alerts = service.detectAnomalies("error_rate");
  assert.ok(alerts.length > 0);
  assert.ok(alerts[0]!.rootCauseHints.length > 0);
});

test("detectAnomalies for latency_p99_ms generates hints", () => {
  const service = new AnomalyDetectionService();
  for (let i = 0; i < 10; i++) {
    service.ingestMetric("latency_p99_ms", 500);
  }
  service.ingestMetric("latency_p99_ms", 2000);

  const alerts = service.detectAnomalies("latency_p99_ms");
  assert.ok(alerts.length > 0);
  assert.ok(alerts[0]!.rootCauseHints.some((h) => h.includes("database")));
});

test("ingestMetric trims per-metric history to bounded length", () => {
  const service = new AnomalyDetectionService();
  for (let i = 0; i < 200; i++) {
    service.ingestMetric("error_rate", i / 1000);
  }

  const stats = service.getMetricStats("error_rate", 60);
  assert.ok(stats !== null);
  assert.equal(stats.count, 120);
});
