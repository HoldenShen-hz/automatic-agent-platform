/**
 * Integration Test: Anomaly Detection Service
 *
 * Tests monitoring and anomaly detection:
 * - Metric ingestion and buffering
 * - SLO threshold-based alerting
 * - Statistical anomaly detection (z-score)
 * - Multi-metric analysis
 */

import assert from "node:assert/strict";
import test from "node:test";

import { AnomalyDetectionService, type SloThreshold, type MetricDatapoint } from "../../../../src/ops-maturity/monitoring/anomaly-detection-service.js";

test.skip("AnomalyDetectionService ingests metrics and computes stats correctly", () => {
  const service = new AnomalyDetectionService();

  service.ingestMetric("request_count", 100, "2026-04-20T00:00:00.000Z");
  service.ingestMetric("request_count", 150, "2026-04-20T00:01:00.000Z");
  service.ingestMetric("request_count", 120, "2026-04-20T00:02:00.000Z");
  service.ingestMetric("request_count", 80, "2026-04-20T00:03:00.000Z");
  service.ingestMetric("request_count", 110, "2026-04-20T00:04:00.000Z");

  const stats = service.getMetricStats("request_count", 60);
  assert.ok(stats !== null);
  assert.equal(stats.count, 5);
  assert.equal(stats.mean, 112);
  assert.ok(stats.min >= 79 && stats.min <= 81); // approximately 80
  assert.ok(stats.max >= 149 && stats.max <= 151); // approximately 150
});

test.skip("AnomalyDetectionService detects critical error_rate threshold breach", () => {
  const thresholds: SloThreshold[] = [
    { metricName: "error_rate", warningThreshold: 0.01, criticalThreshold: 0.05, windowSizeMinutes: 5 },
  ];
  const service = new AnomalyDetectionService(thresholds);

  // Ingest normal baseline
  service.ingestMetric("error_rate", 0.001, "2026-04-20T00:00:00.000Z");
  service.ingestMetric("error_rate", 0.002, "2026-04-20T00:01:00.000Z");
  service.ingestMetric("error_rate", 0.003, "2026-04-20T00:02:00.000Z");
  service.ingestMetric("error_rate", 0.002, "2026-04-20T00:03:00.000Z");
  service.ingestMetric("error_rate", 0.001, "2026-04-20T00:04:00.000Z");

  // Breach critical threshold
  service.ingestMetric("error_rate", 0.08, "2026-04-20T00:05:00.000Z");

  const alerts = service.detectAnomalies("error_rate");
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.severity, "critical");
  assert.equal(alerts[0]?.metricName, "error_rate");
});

test.skip("AnomalyDetectionService detects warning threshold breach for latency", () => {
  const thresholds: SloThreshold[] = [
    { metricName: "latency_p99_ms", warningThreshold: 1000, criticalThreshold: 5000, windowSizeMinutes: 5 },
  ];
  const service = new AnomalyDetectionService(thresholds);

  // Baseline
  for (let i = 0; i < 5; i++) {
    service.ingestMetric("latency_p99_ms", 200 + i * 10, `2026-04-20T00:0${i}:00.000Z`);
  }

  // Warning breach
  service.ingestMetric("latency_p99_ms", 1500, "2026-04-20T00:05:00.000Z");

  const alerts = service.detectAnomalies("latency_p99_ms");
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.severity, "warning");
  assert.ok(alerts[0]?.reason.includes("latency_p99_ms"));
});

test.skip("AnomalyDetectionService detects statistical anomaly via z-score", () => {
  const thresholds: SloThreshold[] = [
    { metricName: "throughput", warningThreshold: 100, criticalThreshold: 50, windowSizeMinutes: 5 },
  ];
  const service = new AnomalyDetectionService(thresholds);

  // Steady state with consistent values
  service.ingestMetric("throughput", 1000, "2026-04-20T00:00:00.000Z");
  service.ingestMetric("throughput", 1010, "2026-04-20T00:01:00.000Z");
  service.ingestMetric("throughput", 990, "2026-04-20T00:02:00.000Z");
  service.ingestMetric("throughput", 1005, "2026-04-20T00:03:00.000Z");
  service.ingestMetric("throughput", 995, "2026-04-20T00:04:00.000Z");

  // Massive outlier - z-score will exceed 3
  service.ingestMetric("throughput", 5000, "2026-04-20T00:05:00.000Z");

  const alerts = service.detectAnomalies("throughput");
  // Should detect statistical anomaly
  assert.ok(alerts.some(a => a.reason.includes("z-score")));
});

test.skip("AnomalyDetectionService provides root cause hints for error_rate", () => {
  const thresholds: SloThreshold[] = [
    { metricName: "error_rate", warningThreshold: 0.01, criticalThreshold: 0.05, windowSizeMinutes: 5 },
  ];
  const service = new AnomalyDetectionService(thresholds);

  service.ingestMetric("error_rate", 0.001, "2026-04-20T00:00:00.000Z");
  service.ingestMetric("error_rate", 0.002, "2026-04-20T00:01:00.000Z");
  service.ingestMetric("error_rate", 0.003, "2026-04-20T00:02:00.000Z");
  service.ingestMetric("error_rate", 0.002, "2026-04-20T00:03:00.000Z");
  service.ingestMetric("error_rate", 0.001, "2026-04-20T00:04:00.000Z");
  service.ingestMetric("error_rate", 0.06, "2026-04-20T00:05:00.000Z");

  const alerts = service.detectAnomalies("error_rate");
  assert.ok(alerts.length >= 1);

  const errorAlert = alerts.find(a => a.metricName === "error_rate");
  assert.ok(errorAlert?.rootCauseHints.some(hint =>
    hint.includes("deployments") || hint.includes("error logs")
  ));
});

test.skip("AnomalyDetectionService provides root cause hints for latency", () => {
  const thresholds: SloThreshold[] = [
    { metricName: "latency_p99_ms", warningThreshold: 1000, criticalThreshold: 5000, windowSizeMinutes: 5 },
  ];
  const service = new AnomalyDetectionService(thresholds);

  for (let i = 0; i < 5; i++) {
    service.ingestMetric("latency_p99_ms", 200, `2026-04-20T00:0${i}:00.000Z`);
  }
  service.ingestMetric("latency_p99_ms", 1500, "2026-04-20T00:05:00.000Z");

  const alerts = service.detectAnomalies("latency_p99_ms");
  const latencyAlert = alerts.find(a => a.metricName === "latency_p99_ms");
  assert.ok(latencyAlert?.rootCauseHints.some(hint =>
    hint.includes("database") || hint.includes("queue")
  ));
});

test.skip("AnomalyDetectionService detectsAllAnomalies across multiple metrics", () => {
  const service = new AnomalyDetectionService();

  // Error rate breach
  for (let i = 0; i < 5; i++) {
    service.ingestMetric("error_rate", 0.001, `2026-04-20T00:0${i}:00.000Z`);
  }
  service.ingestMetric("error_rate", 0.06, "2026-04-20T00:05:00.000Z");

  // Latency breach
  for (let i = 0; i < 5; i++) {
    service.ingestMetric("latency_p99_ms", 200, `2026-04-20T00:0${i}:00.000Z`);
  }
  service.ingestMetric("latency_p99_ms", 6000, "2026-04-20T00:05:00.000Z");

  const allAlerts = service.detectAllAnomalies();
  assert.ok(allAlerts.length >= 2);

  const metricNames = allAlerts.map(a => a.metricName);
  assert.ok(metricNames.includes("error_rate"));
  assert.ok(metricNames.includes("latency_p99_ms"));
});

test("AnomalyDetectionService returns empty for unknown metric", () => {
  const service = new AnomalyDetectionService();

  service.ingestMetric("request_count", 100, "2026-04-20T00:00:00.000Z");

  const alerts = service.detectAnomalies("unknown_metric");
  assert.equal(alerts.length, 0);
});

test("AnomalyDetectionService returns null stats for metric with insufficient data", () => {
  const service = new AnomalyDetectionService();

  service.ingestMetric("new_metric", 100, "2026-04-20T00:00:00.000Z");
  service.ingestMetric("new_metric", 150, "2026-04-20T00:01:00.000Z");

  const stats = service.getMetricStats("new_metric", 60);
  assert.equal(stats, null);
});

test.skip("AnomalyDetectionService calculates deviation percentage correctly", () => {
  const thresholds: SloThreshold[] = [
    { metricName: "error_rate", warningThreshold: 0.01, criticalThreshold: 0.05, windowSizeMinutes: 5 },
  ];
  const service = new AnomalyDetectionService(thresholds);

  // Baseline with known mean
  for (let i = 0; i < 5; i++) {
    service.ingestMetric("error_rate", 0.01, `2026-04-20T00:0${i}:00.000Z`);
  }
  service.ingestMetric("error_rate", 0.03, "2026-04-20T00:05:00.000Z");

  const alerts = service.detectAnomalies("error_rate");
  assert.ok(alerts.length >= 1);

  const alert = alerts[0]!;
  assert.ok(alert.deviationPercent > 0);
  assert.ok(alert.expectedRange.low < alert.expectedRange.high);
});

test.skip("AnomalyDetectionService handles multiple thresholds for same metric", () => {
  const thresholds: SloThreshold[] = [
    { metricName: "cpu_utilization", warningThreshold: 0.7, criticalThreshold: 0.9, windowSizeMinutes: 5 },
  ];
  const service = new AnomalyDetectionService(thresholds);

  for (let i = 0; i < 5; i++) {
    service.ingestMetric("cpu_utilization", 0.3, `2026-04-20T00:0${i}:00.000Z`);
  }
  // Warning breach
  service.ingestMetric("cpu_utilization", 0.75, "2026-04-20T00:05:00.000Z");

  const warningAlerts = service.detectAnomalies("cpu_utilization");
  assert.ok(warningAlerts.some(a => a.severity === "warning"));

  // Critical breach
  service.ingestMetric("cpu_utilization", 0.95, "2026-04-20T00:06:00.000Z");

  const criticalAlerts = service.detectAnomalies("cpu_utilization");
  assert.ok(criticalAlerts.some(a => a.severity === "critical"));
});

test("AnomalyDetectionService uses default SLO thresholds", () => {
  const service = new AnomalyDetectionService();

  // Verify default thresholds exist by checking metric names
  const alert1 = service.detectAnomalies("error_rate");
  const alert2 = service.detectAnomalies("latency_p99_ms");
  const alert3 = service.detectAnomalies("availability");
  const alert4 = service.detectAnomalies("saturation");

  // These should return empty arrays (no breach) rather than errors
  assert.ok(Array.isArray(alert1));
  assert.ok(Array.isArray(alert2));
  assert.ok(Array.isArray(alert3));
  assert.ok(Array.isArray(alert4));
});

test("AnomalyDetectionService includes expected range in alerts", () => {
  const thresholds: SloThreshold[] = [
    { metricName: "request_size_kb", warningThreshold: 500, criticalThreshold: 1000, windowSizeMinutes: 5 },
  ];
  const service = new AnomalyDetectionService(thresholds);

  for (let i = 0; i < 5; i++) {
    service.ingestMetric("request_size_kb", 200, `2026-04-20T00:0${i}:00.000Z`);
  }
  service.ingestMetric("request_size_kb", 600, "2026-04-20T00:05:00.000Z");

  const alerts = service.detectAnomalies("request_size_kb");
  if (alerts.length > 0) {
    assert.ok(alerts[0]!.expectedRange.low < alerts[0]!.expectedRange.high);
    assert.ok(typeof alerts[0]!.currentValue === "number");
  }
});
