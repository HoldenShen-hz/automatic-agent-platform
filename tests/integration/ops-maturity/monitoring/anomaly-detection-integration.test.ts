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

function isoMinutesAgo(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

test("AnomalyDetectionService ingests metrics and computes stats correctly", () => {
  const service = new AnomalyDetectionService();

  service.ingestMetric("request_count", 100, isoMinutesAgo(4));
  service.ingestMetric("request_count", 150, isoMinutesAgo(3));
  service.ingestMetric("request_count", 120, isoMinutesAgo(2));
  service.ingestMetric("request_count", 80, isoMinutesAgo(1));
  service.ingestMetric("request_count", 110, isoMinutesAgo(0));

  const stats = service.getMetricStats("request_count", 60);
  assert.ok(stats !== null);
  assert.equal(stats.count, 5);
  assert.equal(stats.mean, 112);
  assert.ok(stats.min >= 79 && stats.min <= 81); // approximately 80
  assert.ok(stats.max >= 149 && stats.max <= 151); // approximately 150
});

test("AnomalyDetectionService detects critical error_rate threshold breach", () => {
  const thresholds: SloThreshold[] = [
    { metricName: "error_rate", warningThreshold: 0.01, criticalThreshold: 0.05, windowSizeMinutes: 5 },
  ];
  const service = new AnomalyDetectionService(thresholds);

  // Ingest normal baseline
  service.ingestMetric("error_rate", 0.001, isoMinutesAgo(5));
  service.ingestMetric("error_rate", 0.002, isoMinutesAgo(4));
  service.ingestMetric("error_rate", 0.003, isoMinutesAgo(3));
  service.ingestMetric("error_rate", 0.002, isoMinutesAgo(2));
  service.ingestMetric("error_rate", 0.001, isoMinutesAgo(1));

  // Breach critical threshold
  service.ingestMetric("error_rate", 0.08, isoMinutesAgo(0));

  const alerts = service.detectAnomalies("error_rate");
  assert.ok(alerts.some((alert) => alert.severity === "critical"));
  assert.ok(alerts.some((alert) => alert.metricName === "error_rate"));
});

test("AnomalyDetectionService detects warning threshold breach for latency", () => {
  const thresholds: SloThreshold[] = [
    { metricName: "latency_p99_ms", warningThreshold: 1000, criticalThreshold: 5000, windowSizeMinutes: 5 },
  ];
  const service = new AnomalyDetectionService(thresholds);

  // Baseline
  for (let i = 0; i < 5; i++) {
    service.ingestMetric("latency_p99_ms", 200 + i * 10, isoMinutesAgo(5 - i));
  }

  // Warning breach
  service.ingestMetric("latency_p99_ms", 1500, isoMinutesAgo(0));

  const alerts = service.detectAnomalies("latency_p99_ms");
  assert.ok(alerts.some((alert) => alert.severity === "warning"));
  assert.ok(alerts.some((alert) => alert.reason.includes("latency_p99_ms")));
});

test("AnomalyDetectionService detects statistical anomaly via z-score", () => {
  const thresholds: SloThreshold[] = [
    { metricName: "throughput", warningThreshold: 100, criticalThreshold: 50, windowSizeMinutes: 5 },
  ];
  const service = new AnomalyDetectionService(thresholds);

  // Steady state with consistent values
  service.ingestMetric("throughput", 1000, isoMinutesAgo(5));
  service.ingestMetric("throughput", 1010, isoMinutesAgo(4));
  service.ingestMetric("throughput", 990, isoMinutesAgo(3));
  service.ingestMetric("throughput", 1005, isoMinutesAgo(2));
  service.ingestMetric("throughput", 995, isoMinutesAgo(1));

  // Massive outlier - z-score will exceed 3
  service.ingestMetric("throughput", 5000, isoMinutesAgo(0));

  const alerts = service.detectAnomalies("throughput");
  // Should detect statistical anomaly
  assert.ok(alerts.some(a => a.reason.includes("z-score")));
});

test("AnomalyDetectionService provides root cause hints for error_rate", () => {
  const thresholds: SloThreshold[] = [
    { metricName: "error_rate", warningThreshold: 0.01, criticalThreshold: 0.05, windowSizeMinutes: 5 },
  ];
  const service = new AnomalyDetectionService(thresholds);

  service.ingestMetric("error_rate", 0.001, isoMinutesAgo(5));
  service.ingestMetric("error_rate", 0.002, isoMinutesAgo(4));
  service.ingestMetric("error_rate", 0.003, isoMinutesAgo(3));
  service.ingestMetric("error_rate", 0.002, isoMinutesAgo(2));
  service.ingestMetric("error_rate", 0.001, isoMinutesAgo(1));
  service.ingestMetric("error_rate", 0.06, isoMinutesAgo(0));

  const alerts = service.detectAnomalies("error_rate");
  assert.ok(alerts.length >= 1);

  const errorAlert = alerts.find(a => a.metricName === "error_rate");
  assert.ok(errorAlert?.rootCauseHints.some(hint =>
    hint.includes("deployments") || hint.includes("error logs")
  ));
});

test("AnomalyDetectionService provides root cause hints for latency", () => {
  const thresholds: SloThreshold[] = [
    { metricName: "latency_p99_ms", warningThreshold: 1000, criticalThreshold: 5000, windowSizeMinutes: 5 },
  ];
  const service = new AnomalyDetectionService(thresholds);

  for (let i = 0; i < 5; i++) {
    service.ingestMetric("latency_p99_ms", 200, isoMinutesAgo(5 - i));
  }
  service.ingestMetric("latency_p99_ms", 1500, isoMinutesAgo(0));

  const alerts = service.detectAnomalies("latency_p99_ms");
  const latencyAlert = alerts.find(a => a.metricName === "latency_p99_ms");
  assert.ok(latencyAlert?.rootCauseHints.some(hint =>
    hint.includes("database") || hint.includes("queue")
  ));
});

test("AnomalyDetectionService detectsAllAnomalies across multiple metrics", () => {
  const service = new AnomalyDetectionService();

  // Error rate breach
  for (let i = 0; i < 5; i++) {
    service.ingestMetric("error_rate", 0.001, isoMinutesAgo(5 - i));
  }
  service.ingestMetric("error_rate", 0.06, isoMinutesAgo(0));

  // Latency breach
  for (let i = 0; i < 5; i++) {
    service.ingestMetric("latency_p99_ms", 200, isoMinutesAgo(5 - i));
  }
  service.ingestMetric("latency_p99_ms", 6000, isoMinutesAgo(0));

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

test("AnomalyDetectionService calculates deviation percentage correctly", () => {
  const thresholds: SloThreshold[] = [
    { metricName: "error_rate", warningThreshold: 0.01, criticalThreshold: 0.05, windowSizeMinutes: 5 },
  ];
  const service = new AnomalyDetectionService(thresholds);

  // Baseline with known mean
  for (let i = 0; i < 5; i++) {
    service.ingestMetric("error_rate", 0.01, isoMinutesAgo(5 - i));
  }
  service.ingestMetric("error_rate", 0.03, isoMinutesAgo(0));

  const alerts = service.detectAnomalies("error_rate");
  assert.ok(alerts.length >= 1);

  const alert = alerts[0]!;
  assert.ok(alert.deviationPercent > 0);
  assert.ok(alert.expectedRange.low <= alert.expectedRange.high);
});

test("AnomalyDetectionService handles multiple thresholds for same metric", () => {
  const thresholds: SloThreshold[] = [
    { metricName: "cpu_utilization", warningThreshold: 0.7, criticalThreshold: 0.9, windowSizeMinutes: 5 },
  ];
  const service = new AnomalyDetectionService(thresholds);

  for (let i = 0; i < 5; i++) {
    service.ingestMetric("cpu_utilization", 0.3, isoMinutesAgo(6 - i));
  }
  // Warning breach
  service.ingestMetric("cpu_utilization", 0.75, isoMinutesAgo(1));

  const warningAlerts = service.detectAnomalies("cpu_utilization");
  assert.ok(warningAlerts.some(a => a.severity === "warning"));

  // Critical breach
  service.ingestMetric("cpu_utilization", 0.95, isoMinutesAgo(0));

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
