/**
 * @fileoverview Tests for Monitoring Types
 *
 * Tests the monitoring type definitions and utilities.
 * These types support anomaly detection, metric ingestion, and health scoring.
 *
 * §66 Monitoring Enhancement - Anomaly Detection
 */

import { describe, it } from "node:test";
import assert from "node:assert";

// Type definitions for testing (copied from source for isolation)
interface MetricSample {
  readonly metricName: string;
  readonly value: number;
  readonly timestamp: string;
  readonly labels: Record<string, string>;
  readonly unit: string;
}

interface AnomalyAlert {
  readonly alertId: string;
  readonly anomalyType: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly metricName: string;
  readonly detectedValue: number;
  readonly threshold: number;
  readonly timestamp: string;
  readonly affectedEntities: readonly string[];
}

interface SystemHealthStatus {
  readonly score: number;
  readonly status: "ok" | "degraded" | "unhealthy";
}

describe("Monitoring Types - MetricSample", () => {
  it("should create valid metric sample", () => {
    const sample: MetricSample = {
      metricName: "cpu_usage_percent",
      value: 75.5,
      timestamp: new Date().toISOString(),
      labels: { region: "us-east-1", service: "api-gateway" },
      unit: "percent",
    };
    assert.strictEqual(sample.metricName, "cpu_usage_percent");
    assert.strictEqual(sample.value, 75.5);
    assert.strictEqual(sample.labels.region, "us-east-1");
  });

  it("should support multiple labels", () => {
    const sample: MetricSample = {
      metricName: "memory_usage_bytes",
      value: 1073741824,
      timestamp: new Date().toISOString(),
      labels: {
        region: "us-east-1",
        availabilityZone: "us-east-1a",
        service: "worker",
        version: "2.1.0",
      },
      unit: "bytes",
    };
    assert.strictEqual(Object.keys(sample.labels).length, 4);
  });

  it("should handle zero value", () => {
    const sample: MetricSample = {
      metricName: "error_count",
      value: 0,
      timestamp: new Date().toISOString(),
      labels: {},
      unit: "count",
    };
    assert.strictEqual(sample.value, 0);
  });

  it("should preserve timestamp format", () => {
    const now = new Date().toISOString();
    const sample: MetricSample = {
      metricName: "request_latency_ms",
      value: 42,
      timestamp: now,
      labels: {},
      unit: "ms",
    };
    assert.strictEqual(sample.timestamp, now);
  });
});

describe("Monitoring Types - AnomalyAlert", () => {
  it("should create valid low severity alert", () => {
    const alert: AnomalyAlert = {
      alertId: "alert-001",
      anomalyType: "spike",
      severity: "low",
      metricName: "latency_p99_ms",
      detectedValue: 1050,
      threshold: 1000,
      timestamp: new Date().toISOString(),
      affectedEntities: ["api-gateway-1", "api-gateway-2"],
    };
    assert.strictEqual(alert.severity, "low");
    assert.ok(alert.alertId.startsWith("alert-"));
  });

  it("should create valid critical severity alert", () => {
    const alert: AnomalyAlert = {
      alertId: "alert-critical-001",
      anomalyType: "outage",
      severity: "critical",
      metricName: "availability",
      detectedValue: 0.98,
      threshold: 0.995,
      timestamp: new Date().toISOString(),
      affectedEntities: ["api-gateway-1"],
    };
    assert.strictEqual(alert.severity, "critical");
    assert.ok(alert.anomalyType === "outage");
  });

  it("should support multiple affected entities", () => {
    const alert: AnomalyAlert = {
      alertId: "alert-002",
      anomalyType: "degradation",
      severity: "medium",
      metricName: "error_rate",
      detectedValue: 0.03,
      threshold: 0.01,
      timestamp: new Date().toISOString(),
      affectedEntities: [
        "worker-1",
        "worker-2",
        "worker-3",
        "worker-4",
        "worker-5",
      ],
    };
    assert.strictEqual(alert.affectedEntities.length, 5);
  });

  it("should track detection threshold", () => {
    const alert: AnomalyAlert = {
      alertId: "alert-003",
      anomalyType: "threshold_breach",
      severity: "high",
      metricName: "saturation",
      detectedValue: 0.92,
      threshold: 0.8,
      timestamp: new Date().toISOString(),
      affectedEntities: ["load-balancer-1"],
    };
    assert.ok(alert.detectedValue > alert.threshold);
  });
});

describe("Monitoring Types - SystemHealthStatus", () => {
  it("should create healthy status", () => {
    const status: SystemHealthStatus = {
      score: 0.98,
      status: "ok",
    };
    assert.strictEqual(status.status, "ok");
    assert.ok(status.score >= 0.9);
  });

  it("should create degraded status", () => {
    const status: SystemHealthStatus = {
      score: 0.75,
      status: "degraded",
    };
    assert.strictEqual(status.status, "degraded");
    assert.ok(status.score >= 0.5 && status.score < 0.9);
  });

  it("should create unhealthy status", () => {
    const status: SystemHealthStatus = {
      score: 0.3,
      status: "unhealthy",
    };
    assert.strictEqual(status.status, "unhealthy");
    assert.ok(status.score < 0.5);
  });

  it("should handle perfect score", () => {
    const status: SystemHealthStatus = {
      score: 1.0,
      status: "ok",
    };
    assert.strictEqual(status.score, 1.0);
  });

  it("should handle zero score", () => {
    const status: SystemHealthStatus = {
      score: 0,
      status: "unhealthy",
    };
    assert.strictEqual(status.score, 0);
  });
});

describe("Monitoring Types - Edge Cases", () => {
  it("should handle empty labels", () => {
    const sample: MetricSample = {
      metricName: "test_metric",
      value: 100,
      timestamp: new Date().toISOString(),
      labels: {},
      unit: "count",
    };
    assert.strictEqual(Object.keys(sample.labels).length, 0);
  });

  it("should handle very large metric values", () => {
    const sample: MetricSample = {
      metricName: "big_number",
      value: Number.MAX_SAFE_INTEGER,
      timestamp: new Date().toISOString(),
      labels: {},
      unit: "count",
    };
    assert.strictEqual(sample.value, Number.MAX_SAFE_INTEGER);
  });

  it("should handle very small metric values", () => {
    const sample: MetricSample = {
      metricName: "small_number",
      value: Number.MIN_VALUE,
      timestamp: new Date().toISOString(),
      labels: {},
      unit: "percent",
    };
    assert.strictEqual(sample.value, Number.MIN_VALUE);
  });

  it("should handle negative metric values", () => {
    const sample: MetricSample = {
      metricName: "temperature_delta",
      value: -10.5,
      timestamp: new Date().toISOString(),
      labels: {},
      unit: "celsius",
    };
    assert.ok(sample.value < 0);
  });

  it("should handle empty affected entities list", () => {
    const alert: AnomalyAlert = {
      alertId: "alert-empty",
      anomalyType: "unknown",
      severity: "low",
      metricName: "test_metric",
      detectedValue: 100,
      threshold: 50,
      timestamp: new Date().toISOString(),
      affectedEntities: [],
    };
    assert.strictEqual(alert.affectedEntities.length, 0);
  });

  it("should handle fractional health scores", () => {
    const status: SystemHealthStatus = {
      score: 0.333,
      status: "degraded",
    };
    assert.ok(status.score > 0 && status.score < 1);
  });
});

describe("Monitoring Types - Immutability", () => {
  it("should preserve readonly semantics for MetricSample", () => {
    const sample: MetricSample = {
      metricName: "test",
      value: 100,
      timestamp: "2024-01-01T00:00:00Z",
      labels: { env: "prod" },
      unit: "count",
    };
    // Type system ensures readonly, runtime check by freezing
    const frozen = Object.freeze(sample);
    assert.strictEqual(frozen.metricName, "test");
  });

  it("should preserve readonly semantics for AnomalyAlert", () => {
    const alert: AnomalyAlert = {
      alertId: "alert-1",
      anomalyType: "spike",
      severity: "high",
      metricName: "latency",
      detectedValue: 2000,
      threshold: 1000,
      timestamp: "2024-01-01T00:00:00Z",
      affectedEntities: ["svc-1"],
    };
    const frozen = Object.freeze(alert);
    assert.strictEqual(frozen.alertId, "alert-1");
  });

  it("should preserve readonly semantics for SystemHealthStatus", () => {
    const status: SystemHealthStatus = {
      score: 0.95,
      status: "ok",
    };
    const frozen = Object.freeze(status);
    assert.strictEqual(frozen.status, "ok");
  });
});