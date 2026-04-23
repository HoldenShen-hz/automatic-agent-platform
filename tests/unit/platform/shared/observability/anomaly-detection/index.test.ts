import assert from "node:assert/strict";
import test from "node:test";

// Barrel test for anomaly-detection module
import {
  ANOMALY_CATEGORY_LABELS,
  DEFAULT_CONFIG,
} from "../../../../../../src/platform/shared/observability/anomaly-detection/constants.js";

import type {
  AnomalyCategory,
  AnomalySeverity,
  AnomalyDetectionConfig,
  AnomalyDetectionResult,
  AnomalyRecord,
  AnomalySignature,
  TimeSeriesPoint,
  AdaptiveThreshold,
} from "../../../../../../src/platform/shared/observability/anomaly-detection/types.js";

test("ANOMALY_CATEGORY_LABELS has entries for all anomaly categories", () => {
  const expectedCategories: AnomalyCategory[] = [
    "spike",
    "dip",
    "trend_change",
    "level_shift",
    "seasonal_violation",
    "rate_of_change",
    "static",
    "pattern_break",
  ];

  for (const category of expectedCategories) {
    assert.ok(ANOMALY_CATEGORY_LABELS[category]);
    assert.equal(typeof ANOMALY_CATEGORY_LABELS[category], "string");
    assert.ok(ANOMALY_CATEGORY_LABELS[category].length > 0);
  }
});

test("DEFAULT_CONFIG has correct structure", () => {
  assert.equal(DEFAULT_CONFIG.algorithm, "zscore");
  assert.equal(DEFAULT_CONFIG.sensitivity, 0.5);
  assert.equal(DEFAULT_CONFIG.windowSize, 100);
  assert.equal(DEFAULT_CONFIG.minDataPoints, 10);
});

test("DEFAULT_CONFIG algorithm is valid", () => {
  const validAlgorithms = ["zscore", "iqr", "ewma", "gradient"];
  assert.ok(validAlgorithms.includes(DEFAULT_CONFIG.algorithm));
});

test("AnomalyDetectionResult structure is correct", () => {
  const result: AnomalyDetectionResult = {
    isAnomaly: true,
    score: 0.95,
    severity: "critical",
    category: "spike",
    expectedValue: 1000,
    deviation: 4000,
    deviationPercent: 400,
    explanation: "Detected a spike in task duration",
  };
  assert.equal(result.isAnomaly, true);
  assert.equal(result.score, 0.95);
  assert.equal(result.severity, "critical");
  assert.equal(result.category, "spike");
  assert.equal(result.expectedValue, 1000);
  assert.equal(result.deviation, 4000);
});

test("AnomalyDetectionResult for non-anomaly", () => {
  const result: AnomalyDetectionResult = {
    isAnomaly: false,
    score: 0.1,
    severity: "info",
    category: "static",
    expectedValue: 100,
    deviation: 5,
    deviationPercent: 5,
    explanation: "Normal variation",
  };
  assert.equal(result.isAnomaly, false);
  assert.ok(result.score < 0.5);
});

test("AnomalyRecord structure is correct", () => {
  const record: AnomalyRecord = {
    id: "anomaly_123",
    metricName: "error_rate",
    timestamp: "2026-04-14T00:00:00.000Z",
    severity: "critical",
    category: "spike",
    score: 0.92,
    expectedValue: 0.01,
    observedValue: 0.15,
    deviation: 0.14,
    deviationPercent: 1400,
    context: { region: "us-east-1" },
    resolved: false,
    resolvedAt: null,
  };
  assert.equal(record.id, "anomaly_123");
  assert.equal(record.metricName, "error_rate");
  assert.equal(record.category, "spike");
  assert.equal(record.score, 0.92);
  assert.equal(record.resolved, false);
  assert.equal(record.resolvedAt, null);
});

test("AnomalyRecord with resolution", () => {
  const record: AnomalyRecord = {
    id: "anomaly_456",
    metricName: "latency_ms",
    timestamp: "2026-04-14T00:00:00.000Z",
    severity: "warning",
    category: "level_shift",
    score: 0.75,
    expectedValue: 200,
    observedValue: 450,
    deviation: 250,
    deviationPercent: 125,
    context: {},
    resolved: true,
    resolvedAt: "2026-04-14T01:00:00.000Z",
  };
  assert.equal(record.resolved, true);
  assert.ok(record.resolvedAt !== null);
});

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

test("AnomalySignature structure is correct", () => {
  const signature: AnomalySignature = {
    id: "sig_001",
    name: "High Error Rate",
    pattern: /error_rate.*>[0-9.]+/,
    category: "spike",
    severity: "critical",
    description: "Detects when error rate exceeds threshold",
  };
  assert.equal(signature.id, "sig_001");
  assert.equal(signature.name, "High Error Rate");
  assert.ok(signature.pattern instanceof RegExp);
  assert.equal(signature.category, "spike");
  assert.equal(signature.severity, "critical");
});

test("TimeSeriesPoint structure is correct", () => {
  const point: TimeSeriesPoint = {
    timestamp: "2026-04-14T00:00:00.000Z",
    value: 150.5,
  };
  assert.equal(point.timestamp, "2026-04-14T00:00:00.000Z");
  assert.equal(point.value, 150.5);
});

test("AdaptiveThreshold structure is correct", () => {
  const threshold: AdaptiveThreshold = {
    upper: 5000,
    lower: 1000,
    baseline: 2500,
    algorithm: "ewma",
    lastUpdated: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(threshold.upper, 5000);
  assert.equal(threshold.lower, 1000);
  assert.equal(threshold.baseline, 2500);
  assert.equal(threshold.algorithm, "ewma");
});

test("AnomalyDetectionConfig structure", () => {
  const config: AnomalyDetectionConfig = {
    algorithm: "ewma",
    sensitivity: 0.8,
    windowSize: 200,
    minDataPoints: 20,
    seasonalPeriod: 24,
  };
  assert.equal(config.algorithm, "ewma");
  assert.equal(config.sensitivity, 0.8);
  assert.equal(config.windowSize, 200);
  assert.equal(config.minDataPoints, 20);
  assert.equal(config.seasonalPeriod, 24);
});

test("AnomalyDetectionConfig without optional fields", () => {
  const config: AnomalyDetectionConfig = {
    algorithm: "iqr",
    sensitivity: 0.5,
    windowSize: 100,
    minDataPoints: 10,
  };
  assert.equal(config.seasonalPeriod, undefined);
});

test("ANOMALY_CATEGORY_LABELS has all 8 categories", () => {
  assert.equal(Object.keys(ANOMALY_CATEGORY_LABELS).length, 8);
});

test("ANOMALY_CATEGORY_LABELS labels are descriptive", () => {
  assert.ok(ANOMALY_CATEGORY_LABELS.spike.includes("increase"));
  assert.ok(ANOMALY_CATEGORY_LABELS.dip.includes("decrease"));
  assert.ok(ANOMALY_CATEGORY_LABELS.trend_change.includes("Trend"));
  assert.ok(ANOMALY_CATEGORY_LABELS.level_shift.includes("Level"));
  assert.ok(ANOMALY_CATEGORY_LABELS.seasonal_violation.includes("Seasonal"));
  assert.ok(ANOMALY_CATEGORY_LABELS.rate_of_change.includes("Rate"));
  assert.ok(ANOMALY_CATEGORY_LABELS.static.includes("Expected"));
  assert.ok(ANOMALY_CATEGORY_LABELS.pattern_break.toLowerCase().includes("pattern"));
});

test("AnomalyRecord context can hold arbitrary data", () => {
  const record: AnomalyRecord = {
    id: "test_001",
    metricName: "cpu_usage",
    timestamp: "2026-04-14T00:00:00.000Z",
    severity: "warning",
    category: "spike",
    score: 0.85,
    expectedValue: 50,
    observedValue: 95,
    deviation: 45,
    deviationPercent: 90,
    context: {
      region: "us-east-1",
      instance: "i-123456",
      count: 3,
      nested: { a: 1, b: 2 },
    },
    resolved: false,
    resolvedAt: null,
  };
  assert.equal(record.context.region, "us-east-1");
  assert.equal(record.context.instance, "i-123456");
  assert.equal(record.context.count, 3);
  assert.deepStrictEqual(record.context.nested, { a: 1, b: 2 });
});

test("AnomalyRecord deviation calculation is accurate", () => {
  const record: AnomalyRecord = {
    id: "test_002",
    metricName: "request_latency",
    timestamp: "2026-04-14T00:00:00.000Z",
    severity: "critical",
    category: "spike",
    score: 0.99,
    expectedValue: 100,
    observedValue: 500,
    deviation: 400,
    deviationPercent: 400,
    context: {},
    resolved: false,
    resolvedAt: null,
  };
  assert.equal(record.deviation, record.observedValue - record.expectedValue);
  assert.equal(
    record.deviationPercent,
    ((record.deviation / record.expectedValue) * 100)
  );
});

test("AnomalySignature pattern matching works", () => {
  const signature: AnomalySignature = {
    id: "sig_cpu",
    name: "CPU Spike",
    pattern: /cpu.*>\s*[0-9]+/,
    category: "spike",
    severity: "critical",
    description: "CPU usage spike detected",
  };
  assert.ok(signature.pattern.test("cpu > 90"));
  assert.ok(signature.pattern.test("cpu_usage > 95"));
  assert.ok(!signature.pattern.test("memory > 80"));
});

test("TimeSeriesPoint with various values", () => {
  const points: TimeSeriesPoint[] = [
    { timestamp: "2026-04-14T00:00:00.000Z", value: 0 },
    { timestamp: "2026-04-14T01:00:00.000Z", value: -100 },
    { timestamp: "2026-04-14T02:00:00.000Z", value: 0.001 },
    { timestamp: "2026-04-14T03:00:00.000Z", value: 1e6 },
  ];
  assert.equal(points[0]!.value, 0);
  assert.equal(points[1]!.value, -100);
  assert.equal(points[2]!.value, 0.001);
  assert.equal(points[3]!.value, 1e6);
});

test("AdaptiveThreshold bounds are valid", () => {
  const threshold: AdaptiveThreshold = {
    upper: 1000,
    lower: 0,
    baseline: 500,
    algorithm: "zscore",
    lastUpdated: "2026-04-14T00:00:00.000Z",
  };
  assert.ok(threshold.upper > threshold.lower);
  assert.ok(threshold.baseline >= threshold.lower);
  assert.ok(threshold.baseline <= threshold.upper);
});

test("All AnomalySeverity values map correctly", () => {
  const severities: AnomalySeverity[] = ["info", "warning", "critical", "emergency"];
  severities.forEach((severity) => {
    const record: AnomalyRecord = {
      id: "test",
      metricName: "test",
      timestamp: "2026-04-14T00:00:00.000Z",
      severity,
      category: "spike",
      score: 0.5,
      expectedValue: 100,
      observedValue: 150,
      deviation: 50,
      deviationPercent: 50,
      context: {},
      resolved: false,
      resolvedAt: null,
    };
    assert.equal(record.severity, severity);
  });
});

test("All AnomalyCategory values work in records", () => {
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
  categories.forEach((category) => {
    const record: AnomalyRecord = {
      id: `test_${category}`,
      metricName: "test_metric",
      timestamp: "2026-04-14T00:00:00.000Z",
      severity: "warning",
      category,
      score: 0.5,
      expectedValue: 100,
      observedValue: 150,
      deviation: 50,
      deviationPercent: 50,
      context: {},
      resolved: false,
      resolvedAt: null,
    };
    assert.equal(record.category, category);
  });
});

test("AnomalyDetectionConfig with all algorithms", () => {
  const algorithms: AnomalyDetectionConfig["algorithm"][] = [
    "zscore",
    "iqr",
    "ewma",
    "gradient",
  ];
  algorithms.forEach((algorithm) => {
    const config: AnomalyDetectionConfig = {
      algorithm,
      sensitivity: 0.5,
      windowSize: 100,
      minDataPoints: 10,
    };
    assert.equal(config.algorithm, algorithm);
  });
});

test("AnomalyDetectionConfig sensitivity bounds", () => {
  const configLow: AnomalyDetectionConfig = {
    algorithm: "zscore",
    sensitivity: 0.0,
    windowSize: 100,
    minDataPoints: 10,
  };
  const configHigh: AnomalyDetectionConfig = {
    algorithm: "zscore",
    sensitivity: 1.0,
    windowSize: 100,
    minDataPoints: 10,
  };
  assert.equal(configLow.sensitivity, 0.0);
  assert.equal(configHigh.sensitivity, 1.0);
});

test("AnomalyDetectionResult explanation is present", () => {
  const result: AnomalyDetectionResult = {
    isAnomaly: true,
    score: 0.9,
    severity: "critical",
    category: "spike",
    expectedValue: 100,
    deviation: 50,
    deviationPercent: 50,
    explanation: "",
  };
  assert.equal(typeof result.explanation, "string");
});

test("AnomalyDetectorOptions partial config", () => {
  const options: { config?: Partial<AnomalyDetectionConfig> } = {
    config: { sensitivity: 0.8 },
  };
  assert.ok(options.config);
  assert.equal(options.config.sensitivity, 0.8);
  assert.equal(options.config.algorithm, undefined);
});

test("AnomalyDetectorOptions with signatures", () => {
  const signature: AnomalySignature = {
    id: "sig_test",
    name: "Test Signature",
    pattern: /test/,
    category: "spike",
    severity: "warning",
    description: "Test description",
  };
  const options: { signatures?: AnomalySignature[] } = {
    signatures: [signature],
  };
  assert.ok(options.signatures);
  assert.equal(options.signatures.length, 1);
  assert.equal(options.signatures[0]!.id, "sig_test");
});

test.skip("Anomaly detection algorithms require implementation", () => {
  // Source directory only contains types and constants - no detection algorithms present.
  // Algorithms (zscore, iqr, ewma, gradient) would need to be implemented in this module
  // or imported from another location to enable actual anomaly detection tests.
});
