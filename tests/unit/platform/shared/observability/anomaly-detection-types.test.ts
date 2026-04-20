import assert from "node:assert/strict";
import test from "node:test";

import {
  ANOMALY_CATEGORY_LABELS,
  DEFAULT_CONFIG,
} from "../../../../../src/platform/shared/observability/anomaly-detection/constants.js";
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
} from "../../../../../src/platform/shared/observability/anomaly-detection/types.js";

test("AnomalySeverity type accepts valid values", () => {
  const severities: AnomalySeverity[] = ["info", "warning", "critical", "emergency"];
  assert.equal(severities.length, 4);
});

test("AnomalyCategory type accepts valid values", () => {
  const categories: AnomalyCategory[] = [
    "spike",
    "dip",
    "trend_change",
    "level_shift",
    "seasonal_violation",
    "rate_of_change",
    "static",
    "pattern_break",
  ];
  assert.equal(categories.length, 8);
});

test("TimeSeriesPoint structure is correct", () => {
  const point: TimeSeriesPoint = {
    timestamp: "2026-04-14T00:00:00.000Z",
    value: 42.5,
  };
  assert.equal(point.timestamp, "2026-04-14T00:00:00.000Z");
  assert.equal(point.value, 42.5);
});

test("AnomalyRecord structure is correct", () => {
  const record: AnomalyRecord = {
    id: "anomaly_abc123",
    metricName: "cpu.usage",
    timestamp: "2026-04-14T00:00:00.000Z",
    severity: "critical",
    category: "spike",
    score: 0.85,
    expectedValue: 50,
    observedValue: 95,
    deviation: 45,
    deviationPercent: 90,
    context: { algorithm: "zscore" },
    resolved: false,
    resolvedAt: null,
  };
  assert.equal(record.id, "anomaly_abc123");
  assert.equal(record.severity, "critical");
  assert.equal(record.category, "spike");
  assert.equal(record.resolved, false);
  assert.equal(record.resolvedAt, null);
});

test("AnomalyRecord allows resolved state", () => {
  const record: AnomalyRecord = {
    id: "anomaly_abc123",
    metricName: "cpu.usage",
    timestamp: "2026-04-14T00:00:00.000Z",
    severity: "critical",
    category: "spike",
    score: 0.85,
    expectedValue: 50,
    observedValue: 95,
    deviation: 45,
    deviationPercent: 90,
    context: {},
    resolved: true,
    resolvedAt: "2026-04-14T01:00:00.000Z",
  };
  assert.equal(record.resolved, true);
  assert.equal(record.resolvedAt, "2026-04-14T01:00:00.000Z");
});

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

test("AnomalyDetectionConfig allows all algorithm types", () => {
  const algorithms: AnomalyDetectionConfig["algorithm"][] = ["zscore", "iqr", "ewma", "gradient"];
  assert.equal(algorithms.length, 4);
});

test("AnomalyDetectionConfig allows optional seasonalPeriod", () => {
  const config: AnomalyDetectionConfig = {
    algorithm: "zscore",
    sensitivity: 0.5,
    windowSize: 100,
    minDataPoints: 10,
    seasonalPeriod: 60,
  };
  assert.equal(config.seasonalPeriod, 60);
});

test("AdaptiveThreshold structure is correct", () => {
  const threshold: AdaptiveThreshold = {
    upper: 100,
    lower: 10,
    baseline: 55,
    algorithm: "zscore",
    lastUpdated: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(threshold.upper, 100);
  assert.equal(threshold.lower, 10);
  assert.equal(threshold.baseline, 55);
  assert.equal(threshold.algorithm, "zscore");
});

test("AnomalySignature structure is correct", () => {
  const sig: AnomalySignature = {
    id: "sig_test",
    name: "Test Signature",
    pattern: /test.*pattern/i,
    category: "spike",
    severity: "warning",
    description: "A test signature",
  };
  assert.equal(sig.id, "sig_test");
  assert.equal(sig.name, "Test Signature");
  assert.ok(sig.pattern.test("TEST PATTERN"));
  assert.equal(sig.category, "spike");
  assert.equal(sig.severity, "warning");
});

test("AnomalyDetectionResult structure is correct", () => {
  const result: AnomalyDetectionResult = {
    isAnomaly: true,
    score: 0.75,
    severity: "critical",
    category: "spike",
    expectedValue: 50,
    deviation: 45,
    deviationPercent: 90,
    explanation: "Z-score anomaly detected",
  };
  assert.equal(result.isAnomaly, true);
  assert.equal(result.score, 0.75);
  assert.equal(result.severity, "critical");
  assert.equal(result.category, "spike");
});

test("AnomalyDetectionResult allows non-anomaly result", () => {
  const result: AnomalyDetectionResult = {
    isAnomaly: false,
    score: 0,
    severity: "info",
    category: "static",
    expectedValue: 50,
    deviation: 0,
    deviationPercent: 0,
    explanation: "Normal variation",
  };
  assert.equal(result.isAnomaly, false);
  assert.equal(result.score, 0);
});

test("AnomalyDetectorOptions allows partial config", () => {
  const options: AnomalyDetectorOptions = {
    config: {
      algorithm: "iqr",
    },
  };
  assert.equal(options.config!.algorithm, "iqr");
});

test("AnomalyDetectorOptions allows signatures", () => {
  const options: AnomalyDetectorOptions = {
    signatures: [
      {
        id: "sig_1",
        name: "Test",
        pattern: /test/,
        category: "spike",
        severity: "warning",
        description: "Test",
      },
    ],
  };
  assert.equal(options.signatures!.length, 1);
});

test("ANOMALY_CATEGORY_LABELS has all categories", () => {
  const categories: AnomalyCategory[] = [
    "spike",
    "dip",
    "trend_change",
    "level_shift",
    "seasonal_violation",
    "rate_of_change",
    "static",
    "pattern_break",
  ];
  for (const cat of categories) {
    assert.ok(ANOMALY_CATEGORY_LABELS[cat], `Missing label for ${cat}`);
    assert.equal(typeof ANOMALY_CATEGORY_LABELS[cat], "string");
  }
});

test("DEFAULT_CONFIG has correct values", () => {
  assert.equal(DEFAULT_CONFIG.algorithm, "zscore");
  assert.equal(DEFAULT_CONFIG.sensitivity, 0.5);
  assert.equal(DEFAULT_CONFIG.windowSize, 100);
  assert.equal(DEFAULT_CONFIG.minDataPoints, 10);
});

test("DEFAULT_CONFIG sensitivity is within valid range", () => {
  assert.ok(DEFAULT_CONFIG.sensitivity >= 0);
  assert.ok(DEFAULT_CONFIG.sensitivity <= 1);
});

test("DEFAULT_CONFIG windowSize is positive", () => {
  assert.ok(DEFAULT_CONFIG.windowSize > 0);
});

test("DEFAULT_CONFIG minDataPoints is positive", () => {
  assert.ok(DEFAULT_CONFIG.minDataPoints > 0);
});
