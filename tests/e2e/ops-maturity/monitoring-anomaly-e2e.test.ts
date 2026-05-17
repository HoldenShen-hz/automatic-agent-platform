/**
 * E2E Monitoring and Anomaly Detection Tests
 *
 * End-to-end tests covering monitoring service and anomaly detection:
 * 1. Anomaly detection service
 * 2. Monitoring metrics collection
 * 3. Alert generation
 * 4. System health evaluation
 *
 * Uses node:test + node:assert/strict. ESM imports with .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../../helpers/e2e-harness.js";
import { AnomalyDetectionService } from "../../../src/ops-maturity/monitoring/anomaly-detection-service.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createMetricSample(
  overrides: Partial<{
    metricName: string;
    value: number;
    timestamp: string;
    labels: Record<string, string>;
    unit: string;
  }> = {},
) {
  return {
    metricName: overrides.metricName ?? "latency_p99_ms",
    value: overrides.value ?? 500,
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    labels: overrides.labels ?? { divisionId: "devops" },
    unit: overrides.unit ?? "ms",
    ...overrides,
  };
}

function recentIso(minutesAgo: number): string {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

// ---------------------------------------------------------------------------
// Test Suite 1: Anomaly Detection Service
// ---------------------------------------------------------------------------

test("E2E Monitoring: AnomalyDetectionService identifies spike in latency metrics", async () => {
  const harness = createE2EHarness("aa-e2e-anomaly-");
  try {
    const service = new AnomalyDetectionService();

    // Normal baseline metrics
    const baseline = [
      createMetricSample({ value: 450, timestamp: recentIso(4) }),
      createMetricSample({ value: 480, timestamp: recentIso(3) }),
      createMetricSample({ value: 510, timestamp: recentIso(2) }),
      createMetricSample({ value: 500, timestamp: recentIso(1) }),
    ];
    for (const sample of baseline) {
      service.ingestMetric(sample.metricName, sample.value, sample.timestamp);
    }

    // Anomalous metric
    const anomalySample = createMetricSample({
      value: 2500,
      timestamp: recentIso(0),
    });

    service.ingestMetric(anomalySample.metricName, anomalySample.value, anomalySample.timestamp);
    const alerts = service.detectAnomalies("latency_p99_ms");
    const alert = alerts[0];

    assert.ok(alert, "Should detect anomaly");
    assert.equal(alert?.severity, "warning", "Should flag threshold breach");
    assert.ok(alert?.reason, "Should provide anomaly reason");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 2: Metric Pattern Analysis
// ---------------------------------------------------------------------------

test("E2E Monitoring: Service exposes stats for gradual degradation trend", async () => {
  const harness = createE2EHarness("aa-e2e-degrade-");
  try {
    const service = new AnomalyDetectionService();

    // Gradual degradation pattern
    const degradingMetrics = [
      createMetricSample({ value: 500, timestamp: recentIso(4) }),
      createMetricSample({ value: 650, timestamp: recentIso(3) }),
      createMetricSample({ value: 800, timestamp: recentIso(2) }),
      createMetricSample({ value: 950, timestamp: recentIso(1) }),
    ];
    for (const sample of degradingMetrics) {
      service.ingestMetric(sample.metricName, sample.value, sample.timestamp);
    }
    const stats = service.getMetricStats("latency_p99_ms", 10);
    assert.ok(stats, "Should return metric stats");
    assert.ok(stats!.mean > 0, "Should compute rolling mean");
    assert.equal(stats!.count, degradingMetrics.length, "Should include all ingested samples");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 3: System Health Evaluation
// ---------------------------------------------------------------------------

test("E2E Monitoring: Service analyzes multiple metric streams", async () => {
  const harness = createE2EHarness("aa-e2e-health-");
  try {
    const service = new AnomalyDetectionService();

    const metrics = [
      createMetricSample({ metricName: "error_rate", value: 0.005, timestamp: recentIso(5) }),
      createMetricSample({ metricName: "error_rate", value: 0.01, timestamp: recentIso(4) }),
      createMetricSample({ metricName: "error_rate", value: 0.02, timestamp: recentIso(3) }),
      createMetricSample({ metricName: "error_rate", value: 0.03, timestamp: recentIso(2) }),
      createMetricSample({ metricName: "error_rate", value: 0.06, timestamp: recentIso(1) }),
      createMetricSample({ metricName: "latency_p99_ms", value: 700, timestamp: recentIso(5) }),
      createMetricSample({ metricName: "latency_p99_ms", value: 800, timestamp: recentIso(4) }),
      createMetricSample({ metricName: "latency_p99_ms", value: 900, timestamp: recentIso(3) }),
      createMetricSample({ metricName: "latency_p99_ms", value: 1200, timestamp: recentIso(2) }),
      createMetricSample({ metricName: "latency_p99_ms", value: 1300, timestamp: recentIso(1) }),
    ];
    for (const sample of metrics) {
      service.ingestMetric(sample.metricName, sample.value, sample.timestamp);
    }
    const alerts = service.detectAllAnomalies();
    assert.ok(alerts.length > 0, "Should detect anomalies across tracked metrics");
    assert.ok(alerts.some((alert) => alert.metricName === "error_rate" || alert.metricName === "latency_p99_ms"));
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 4: Alert Management
// ---------------------------------------------------------------------------

test("E2E Monitoring: Anomaly signal drops after metrics return to normal", async () => {
  const harness = createE2EHarness("aa-e2e-alert-clear-");
  try {
    const service = new AnomalyDetectionService();
    const samples = [
      createMetricSample({ value: 450, timestamp: recentIso(4) }),
      createMetricSample({ value: 470, timestamp: recentIso(3) }),
      createMetricSample({ value: 490, timestamp: recentIso(2) }),
      createMetricSample({ value: 510, timestamp: recentIso(1) }),
      createMetricSample({ value: 2500, timestamp: recentIso(0) }),
    ];
    for (const sample of samples) {
      service.ingestMetric(sample.metricName, sample.value, sample.timestamp);
    }
    assert.ok(service.detectAnomalies("latency_p99_ms").length > 0, "Should detect anomaly after spike");

    service.ingestMetric("latency_p99_ms", 480, new Date().toISOString());
    const recoveredAlerts = service.detectAnomalies("latency_p99_ms");
    assert.equal(recoveredAlerts.length, 0, "Latest normalized metric should clear the active anomaly signal");
  } finally {
    harness.cleanup();
  }
});
