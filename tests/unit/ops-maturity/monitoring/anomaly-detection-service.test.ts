import assert from "node:assert/strict";
import test from "node:test";

import { AnomalyDetectionService } from "../../../../src/ops-maturity/monitoring/anomaly-detection-service.js";

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

test("AnomalyDetectionService.ingestMetric stores metric data", () => {
  const service = new AnomalyDetectionService();
  service.ingestMetric("error_rate", 0.01, minutesAgo(10));
  service.ingestMetric("error_rate", 0.02, minutesAgo(9));

  const stats = service.getMetricStats("error_rate", 60);
  assert.ok(stats !== null);
  assert.equal(stats.count, 2);
});

test("AnomalyDetectionService.detectAnomalies detects critical threshold breach", () => {
  const service = new AnomalyDetectionService();
  // Add 5+ baseline data points within the recent window
  for (let i = 5; i >= 1; i--) {
    service.ingestMetric("error_rate", 0.01, minutesAgo(i + 1));
  }
  // Add a critical value
  service.ingestMetric("error_rate", 0.10, minutesAgo(0));

  const alerts = service.detectAnomalies("error_rate");
  assert.ok(alerts.length > 0, "Should detect anomaly");
  assert.equal(alerts[0]!.severity, "critical");
});

test("AnomalyDetectionService.detectAnomalies detects warning threshold", () => {
  const service = new AnomalyDetectionService();
  for (let i = 5; i >= 1; i--) {
    service.ingestMetric("error_rate", 0.005, minutesAgo(i + 1));
  }
  service.ingestMetric("error_rate", 0.02, minutesAgo(0));

  const alerts = service.detectAnomalies("error_rate");
  assert.ok(alerts.some((a) => a.severity === "warning"), "Should detect warning");
});

test("AnomalyDetectionService.detectAnomalies returns empty for unknown metric", () => {
  const service = new AnomalyDetectionService();
  const alerts = service.detectAnomalies("unknown_metric");
  assert.equal(alerts.length, 0);
});

test("AnomalyDetectionService.detectAnomalies returns empty with insufficient data", () => {
  const service = new AnomalyDetectionService();
  service.ingestMetric("error_rate", 0.01);
  const alerts = service.detectAnomalies("error_rate");
  assert.equal(alerts.length, 0);
});

test("AnomalyDetectionService.detectAllAnomalies checks all thresholds", () => {
  const service = new AnomalyDetectionService();

  // Error rate
  for (let i = 5; i >= 1; i--) {
    service.ingestMetric("error_rate", 0.01, minutesAgo(i + 1));
  }
  service.ingestMetric("error_rate", 0.10, minutesAgo(0));

  // Latency
  for (let i = 5; i >= 1; i--) {
    service.ingestMetric("latency_p99_ms", 500, minutesAgo(i + 1));
  }
  service.ingestMetric("latency_p99_ms", 6000, minutesAgo(0));

  const alerts = service.detectAllAnomalies();
  assert.ok(alerts.length > 0);
});

test("AnomalyDetectionService.getMetricStats computes correct statistics", () => {
  const service = new AnomalyDetectionService();
  service.ingestMetric("latency_p99_ms", 100, minutesAgo(3));
  service.ingestMetric("latency_p99_ms", 200, minutesAgo(2));
  service.ingestMetric("latency_p99_ms", 300, minutesAgo(1));

  const stats = service.getMetricStats("latency_p99_ms", 60);
  assert.ok(stats !== null);
  assert.equal(stats.count, 3);
  assert.equal(stats.min, 100);
  assert.equal(stats.max, 300);
  assert.equal(stats.mean, 200);
});

test("AnomalyDetectionService.getMetricStats returns null for unknown metric", () => {
  const service = new AnomalyDetectionService();
  const stats = service.getMetricStats("unknown");
  assert.equal(stats, null);
});

test("AnomalyDetectionService.custom thresholds work correctly", () => {
  const customThresholds = [
    { metricName: "cpu_usage", warningThreshold: 0.5, criticalThreshold: 0.8, windowSizeMinutes: 5 },
  ];
  const service = new AnomalyDetectionService(customThresholds);

  for (let i = 5; i >= 1; i--) {
    service.ingestMetric("cpu_usage", 0.3, minutesAgo(i + 1));
  }
  service.ingestMetric("cpu_usage", 0.9, minutesAgo(0));

  const alerts = service.detectAnomalies("cpu_usage");
  assert.ok(alerts.some((a) => a.severity === "critical"));
});

test("AnomalyDetectionService.alert contains root cause hints", () => {
  const service = new AnomalyDetectionService();
  for (let i = 5; i >= 1; i--) {
    service.ingestMetric("error_rate", 0.01, minutesAgo(i + 1));
  }
  service.ingestMetric("error_rate", 0.10, minutesAgo(0));

  const alerts = service.detectAnomalies("error_rate");
  assert.ok(alerts[0]!.rootCauseHints.length > 0);
  assert.ok(alerts[0]!.rootCauseHints.some((h) => h.includes("deployment")));
});

test("AnomalyDetectionService.alert contains expected range", () => {
  const service = new AnomalyDetectionService();
  for (let i = 5; i >= 1; i--) {
    service.ingestMetric("latency_p99_ms", 500, minutesAgo(i + 1));
  }
  service.ingestMetric("latency_p99_ms", 2000, minutesAgo(0));

  const alerts = service.detectAnomalies("latency_p99_ms");
  assert.ok(alerts[0]!.expectedRange.low < alerts[0]!.expectedRange.high);
});
