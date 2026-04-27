import assert from "node:assert/strict";
import test from "node:test";

import type {
  AnomalySeverity,
  AnomalyCategory,
  TimeSeriesPoint,
  AnomalyRecord,
  AnomalyDetectionConfig,
  AdaptiveThreshold,
  AnomalySignature,
  AnomalyDetectionResult,
  AnomalyDetectorOptions,
} from "../../../../../../src/platform/shared/observability/anomaly-detection/types.js";

// AnomalySeverity
test("AnomalySeverity accepts info", () => {
  const severity: AnomalySeverity = "info";
  assert.equal(severity, "info");
});

test("AnomalySeverity accepts warning", () => {
  const severity: AnomalySeverity = "warning";
  assert.equal(severity, "warning");
});

test("AnomalySeverity accepts critical", () => {
  const severity: AnomalySeverity = "critical";
  assert.equal(severity, "critical");
});

test("AnomalySeverity accepts emergency", () => {
  const severity: AnomalySeverity = "emergency";
  assert.equal(severity, "emergency");
});

// AnomalyCategory
test("AnomalyCategory accepts spike", () => {
  const category: AnomalyCategory = "spike";
  assert.equal(category, "spike");
});

test("AnomalyCategory accepts dip", () => {
  const category: AnomalyCategory = "dip";
  assert.equal(category, "dip");
});

test("AnomalyCategory accepts trend_change", () => {
  const category: AnomalyCategory = "trend_change";
  assert.equal(category, "trend_change");
});

test("AnomalyCategory accepts level_shift", () => {
  const category: AnomalyCategory = "level_shift";
  assert.equal(category, "level_shift");
});

test("AnomalyCategory accepts seasonal_violation", () => {
  const category: AnomalyCategory = "seasonal_violation";
  assert.equal(category, "seasonal_violation");
});

test("AnomalyCategory accepts rate_of_change", () => {
  const category: AnomalyCategory = "rate_of_change";
  assert.equal(category, "rate_of_change");
});

test("AnomalyCategory accepts static", () => {
  const category: AnomalyCategory = "static";
  assert.equal(category, "static");
});

test("AnomalyCategory accepts pattern_break", () => {
  const category: AnomalyCategory = "pattern_break";
  assert.equal(category, "pattern_break");
});

// TimeSeriesPoint
test("TimeSeriesPoint structure is correct", () => {
  const point: TimeSeriesPoint = {
    timestamp: "2026-04-14T00:00:00.000Z",
    value: 42.5,
  };
  assert.equal(point.timestamp, "2026-04-14T00:00:00.000Z");
  assert.equal(point.value, 42.5);
});

test("TimeSeriesPoint allows negative values", () => {
  const point: TimeSeriesPoint = {
    timestamp: "2026-04-14T00:00:00.000Z",
    value: -10.5,
  };
  assert.equal(point.value, -10.5);
});

test("TimeSeriesPoint allows zero", () => {
  const point: TimeSeriesPoint = {
    timestamp: "2026-04-14T00:00:00.000Z",
    value: 0,
  };
  assert.equal(point.value, 0);
});

// AnomalyRecord
test("AnomalyRecord structure is correct", () => {
  const record: AnomalyRecord = {
    id: "anomaly_123",
    metricName: "cpu_usage",
    timestamp: "2026-04-14T00:00:00.000Z",
    severity: "warning",
    category: "spike",
    score: 2.5,
    expectedValue: 50,
    observedValue: 95,
    deviation: 45,
    deviationPercent: 90,
    context: {},
    resolved: false,
    resolvedAt: null,
  };
  assert.equal(record.id, "anomaly_123");
  assert.equal(record.metricName, "cpu_usage");
  assert.equal(record.severity, "warning");
  assert.equal(record.category, "spike");
  assert.equal(record.resolved, false);
  assert.equal(record.resolvedAt, null);
});

test("AnomalyRecord allows optional unifiedSeverity", () => {
  const record: AnomalyRecord = {
    id: "anomaly_1",
    metricName: "memory_usage",
    timestamp: "2026-04-14T00:00:00.000Z",
    severity: "critical",
    category: "level_shift",
    score: 3.0,
    expectedValue: 60,
    observedValue: 95,
    deviation: 35,
    deviationPercent: 58,
    context: {},
    resolved: false,
    resolvedAt: null,
    unifiedSeverity: "high",
  };
  assert.equal(record.unifiedSeverity, "high");
});

test("AnomalyRecord allows optional anomalyEventClass", () => {
  const record: AnomalyRecord = {
    id: "anomaly_2",
    metricName: "error_rate",
    timestamp: "2026-04-14T00:00:00.000Z",
    severity: "emergency",
    category: "spike",
    score: 5.0,
    expectedValue: 1,
    observedValue: 50,
    deviation: 49,
    deviationPercent: 4900,
    context: {},
    resolved: false,
    resolvedAt: null,
    anomalyEventClass: "provider_error_rate_spike",
  };
  assert.equal(record.anomalyEventClass, "provider_error_rate_spike");
});

test("AnomalyRecord allows resolved state", () => {
  const record: AnomalyRecord = {
    id: "anomaly_resolved",
    metricName: "latency",
    timestamp: "2026-04-14T00:00:00.000Z",
    severity: "warning",
    category: "dip",
    score: 1.5,
    expectedValue: 100,
    observedValue: 30,
    deviation: -70,
    deviationPercent: -70,
    context: {},
    resolved: true,
    resolvedAt: "2026-04-14T01:00:00.000Z",
  };
  assert.equal(record.resolved, true);
  assert.equal(record.resolvedAt, "2026-04-14T01:00:00.000Z");
});

test("AnomalyRecord context can contain arbitrary data", () => {
  const record: AnomalyRecord = {
    id: "anomaly_ctx",
    metricName: "queue_depth",
    timestamp: "2026-04-14T00:00:00.000Z",
    severity: "info",
    category: "trend_change",
    score: 2.0,
    expectedValue: 100,
    observedValue: 150,
    deviation: 50,
    deviationPercent: 50,
    context: {
      region: "us-east-1",
      service: "worker-pool",
      previousValue: 100,
    },
    resolved: false,
    resolvedAt: null,
  };
  assert.equal(record.context.region, "us-east-1");
  assert.equal(record.context.service, "worker-pool");
});

// AnomalyDetectionConfig
test("AnomalyDetectionConfig structure is correct", () => {
  const config: AnomalyDetectionConfig = {
    algorithm: "zscore",
    sensitivity: 0.5,
    windowSize: 100,
    minDataPoints: 10,
  };
  assert.equal(config.algorithm, "zscore");
  assert.equal(config.sensitivity, 0.5);
  assert.equal(config.windowSize, 100);
  assert.equal(config.minDataPoints, 10);
});

test("AnomalyDetectionConfig allows iqr algorithm", () => {
  const config: AnomalyDetectionConfig = {
    algorithm: "iqr",
    sensitivity: 0.75,
    windowSize: 200,
    minDataPoints: 20,
  };
  assert.equal(config.algorithm, "iqr");
});

test("AnomalyDetectionConfig allows ewma algorithm", () => {
  const config: AnomalyDetectionConfig = {
    algorithm: "ewma",
    sensitivity: 0.6,
    windowSize: 150,
    minDataPoints: 15,
  };
  assert.equal(config.algorithm, "ewma");
});

test("AnomalyDetectionConfig allows gradient algorithm", () => {
  const config: AnomalyDetectionConfig = {
    algorithm: "gradient",
    sensitivity: 0.4,
    windowSize: 100,
    minDataPoints: 10,
  };
  assert.equal(config.algorithm, "gradient");
});

test("AnomalyDetectionConfig allows optional seasonalPeriod", () => {
  const config: AnomalyDetectionConfig = {
    algorithm: "zscore",
    sensitivity: 0.5,
    windowSize: 100,
    minDataPoints: 10,
    seasonalPeriod: 24,
  };
  assert.equal(config.seasonalPeriod, 24);
});

// AdaptiveThreshold
test("AdaptiveThreshold structure is correct", () => {
  const threshold: AdaptiveThreshold = {
    upper: 100,
    lower: 50,
    baseline: 75,
    algorithm: "zscore",
    lastUpdated: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(threshold.upper, 100);
  assert.equal(threshold.lower, 50);
  assert.equal(threshold.baseline, 75);
  assert.equal(threshold.algorithm, "zscore");
  assert.equal(threshold.lastUpdated, "2026-04-14T00:00:00.000Z");
});

test("AdaptiveThreshold allows lower to be greater than upper (inverted)", () => {
  const threshold: AdaptiveThreshold = {
    upper: 50,
    lower: 100,
    baseline: 75,
    algorithm: "zscore",
    lastUpdated: "2026-04-14T00:00:00.000Z",
  };
  // Valid for certain metrics where lower is worse
  assert.equal(threshold.upper, 50);
  assert.equal(threshold.lower, 100);
});

test("AdaptiveThreshold baseline can be between upper and lower", () => {
  const threshold: AdaptiveThreshold = {
    upper: 200,
    lower: 0,
    baseline: 100,
    algorithm: "ewma",
    lastUpdated: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(threshold.baseline, 100);
  assert.ok(threshold.baseline > threshold.lower);
  assert.ok(threshold.baseline < threshold.upper);
});

// AnomalySignature
test("AnomalySignature structure is correct", () => {
  const signature: AnomalySignature = {
    id: "sig_1",
    name: "High CPU Spike",
    pattern: /cpu.*spike/i,
    category: "spike",
    severity: "warning",
    description: "Detects sudden increases in CPU usage",
  };
  assert.equal(signature.id, "sig_1");
  assert.equal(signature.name, "High CPU Spike");
  assert.ok(signature.pattern instanceof RegExp);
  assert.equal(signature.category, "spike");
  assert.equal(signature.severity, "warning");
});

test("AnomalySignature pattern can match strings", () => {
  const signature: AnomalySignature = {
    id: "sig_2",
    name: "Memory Leak",
    pattern: /memory.*leak/i,
    category: "trend_change",
    severity: "critical",
    description: "Detects gradual memory increase",
  };
  assert.ok(signature.pattern.test("memory leak detected"));
  assert.ok(signature.pattern.test("Memory Leak Warning"));
});

// AnomalyDetectionResult
test("AnomalyDetectionResult structure is correct", () => {
  const result: AnomalyDetectionResult = {
    isAnomaly: true,
    score: 2.5,
    severity: "warning",
    category: "spike",
    expectedValue: 50,
    deviation: 40,
    deviationPercent: 80,
    explanation: "Value is 80% above expected",
  };
  assert.equal(result.isAnomaly, true);
  assert.equal(result.score, 2.5);
  assert.equal(result.severity, "warning");
  assert.equal(result.category, "spike");
});

test("AnomalyDetectionResult allows optional unifiedSeverity", () => {
  const result: AnomalyDetectionResult = {
    isAnomaly: true,
    score: 3.0,
    severity: "critical",
    category: "level_shift",
    expectedValue: 100,
    deviation: 90,
    deviationPercent: 90,
    explanation: "Significant level shift detected",
    unifiedSeverity: "high",
  };
  assert.equal(result.unifiedSeverity, "high");
});

test("AnomalyDetectionResult isAnomaly can be false", () => {
  const result: AnomalyDetectionResult = {
    isAnomaly: false,
    score: 0.5,
    severity: "info",
    category: "static",
    expectedValue: 100,
    deviation: 5,
    deviationPercent: 5,
    explanation: "Value is within normal range",
  };
  assert.equal(result.isAnomaly, false);
});

// AnomalyDetectorOptions
test("AnomalyDetectorOptions allows partial config", () => {
  const options: AnomalyDetectorOptions = {
    config: {
      sensitivity: 0.8,
    },
  };
  assert.ok(options.config !== undefined);
  assert.equal(options.config!.sensitivity, 0.8);
});

test("AnomalyDetectorOptions allows signatures", () => {
  const signature: AnomalySignature = {
    id: "sig_custom",
    name: "Custom Anomaly",
    pattern: /custom/i,
    category: "pattern_break",
    severity: "warning",
    description: "Custom pattern",
  };
  const options: AnomalyDetectorOptions = {
    signatures: [signature],
  };
  assert.ok(options.signatures !== undefined);
  assert.equal(options.signatures!.length, 1);
  assert.equal(options.signatures![0]!.id, "sig_custom");
});

test("AnomalyDetectorOptions allows empty options", () => {
  const options: AnomalyDetectorOptions = {};
  assert.ok(options !== undefined);
});
