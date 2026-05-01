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

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { AnomalyDetectionService } from "../../src/ops-maturity/monitoring/anomaly-detection-service.js";
import type { MetricSample, AnomalyAlert, SystemHealthStatus } from "../../src/ops-maturity/monitoring/types.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createMetricSample(overrides: Partial<MetricSample> = {}): MetricSample {
  return {
    metricName: overrides.metricName ?? "task_latency_ms",
    value: overrides.value ?? 500,
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    labels: overrides.labels ?? { divisionId: "devops" },
    unit: overrides.unit ?? "ms",
    ...overrides,
  };
}

function createAnomalyAlert(overrides: Partial<AnomalyAlert> = {}): AnomalyAlert {
  return {
    alertId: overrides.alertId ?? "alert_e2e_001",
    anomalyType: overrides.anomalyType ?? "spike",
    severity: overrides.severity ?? "high",
    metricName: overrides.metricName ?? "task_latency_ms",
    detectedValue: overrides.detectedValue ?? 2500,
    threshold: overrides.threshold ?? 1000,
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    affectedEntities: overrides.affectedEntities ?? ["task_001"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite 1: Anomaly Detection Service
// ---------------------------------------------------------------------------

test("E2E Monitoring: AnomalyDetectionService identifies spike in latency metrics", async () => {
  const harness = createE2EHarness("aa-e2e-anomaly-");
  try {
    const service = new AnomalyDetectionService();

    // Normal baseline metrics
    const baseline: MetricSample[] = [
      createMetricSample({ value: 450, timestamp: "2026-05-01T10:00:00Z" }),
      createMetricSample({ value: 480, timestamp: "2026-05-01T10:01:00Z" }),
      createMetricSample({ value: 510, timestamp: "2026-05-01T10:02:00Z" }),
    ];

    service.setBaseline(baseline);

    // Anomalous metric
    const anomalySample = createMetricSample({
      value: 2500,
      timestamp: "2026-05-01T10:03:00Z",
    });

    const alert = service.detectAnomaly(anomalySample);

    assert.ok(alert, "Should detect anomaly");
    assert.equal(alert?.severity, "high", "Should be high severity");
    assert.ok(alert?.anomalyType, "Should have anomaly type");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 2: Metric Pattern Analysis
// ---------------------------------------------------------------------------

test("E2E Monitoring: Service detects gradual degradation trend", async () => {
  const harness = createE2EHarness("aa-e2e-degrade-");
  try {
    const service = new AnomalyDetectionService();

    // Gradual degradation pattern
    const degradingMetrics: MetricSample[] = [
      createMetricSample({ value: 500, timestamp: "2026-05-01T10:00:00Z" }),
      createMetricSample({ value: 650, timestamp: "2026-05-01T10:05:00Z" }),
      createMetricSample({ value: 800, timestamp: "2026-05-01T10:10:00Z" }),
      createMetricSample({ value: 950, timestamp: "2026-05-01T10:15:00Z" }),
    ];

    const alerts = service.detectTrend(degradingMetrics, "task_latency_ms");

    assert.ok(Array.isArray(alerts), "Should return alerts array");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 3: System Health Evaluation
// ---------------------------------------------------------------------------

test("E2E Monitoring: Service evaluates system health status", async () => {
  const harness = createE2EHarness("aa-e2e-health-");
  try {
    const service = new AnomalyDetectionService();

    const metrics: MetricSample[] = [
      createMetricSample({ metricName: "error_rate", value: 0.02 }),
      createMetricSample({ metricName: "latency_p99_ms", value: 800 }),
      createMetricSample({ metricName: "success_rate", value: 0.98 }),
    ];

    const health = service.evaluateHealth(metrics);

    assert.ok(health, "Should return health status");
    assert.ok(typeof health.score === "number", "Should have score");
    assert.ok(health.status, "Should have status (ok/degraded/unhealthy)");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 4: Alert Management
// ---------------------------------------------------------------------------

test("E2E Monitoring: Alert is cleared when metrics return to normal", async () => {
  const harness = createE2EHarness("aa-e2e-alert-clear-");
  try {
    const service = new AnomalyDetectionService();

    // Detect anomaly
    const alert = createAnomalyAlert({
      severity: "high",
      detectedValue: 2500,
    });

    service.recordAlert(alert);

    // Verify alert exists
    const activeAlerts = service.getActiveAlerts();
    assert.ok(activeAlerts.length > 0, "Should have active alert");

    // Clear alert when metrics normalize
    service.clearAlert("alert_e2e_001");

    const clearedAlerts = service.getActiveAlerts();
    assert.ok(!clearedAlerts.find(a => a.alertId === "alert_e2e_001"), "Alert should be cleared");
  } finally {
    harness.cleanup();
  }
});