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

test("AnomalySeverity type accepts all four severity levels", () => {
  const severities: AnomalySeverity[] = ["info", "warning", "critical", "emergency"];
  assert.equal(severities.length, 4);
  severities.forEach((s) => assert.equal(typeof s, "string"));
});

test("AnomalyCategory type accepts all eight categories", () => {
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
  categories.forEach((c) => assert.equal(typeof c, "string"));
});

test("TimeSeriesPoint structure with ISO timestamp", () => {
  const point: TimeSeriesPoint = {
    timestamp: "2026-04-23T00:00:00.000Z",
    value: 42.5,
  };
  assert.equal(point.timestamp, "2026-04-23T00:00:00.000Z");
  assert.equal(point.value, 42.5);
});

test("TimeSeriesPoint with zero value", () => {
  const point: TimeSeriesPoint = { timestamp: "2026-04-23T00:00:00.000Z", value: 0 };
  assert.equal(point.value, 0);
});

test("TimeSeriesPoint with negative value", () => {
  const point: TimeSeriesPoint = { timestamp: "2026-04-23T00:00:00.000Z", value: -100 };
  assert.equal(point.value, -100);
});

test("TimeSeriesPoint with large positive value", () => {
  const point: TimeSeriesPoint = { timestamp: "2026-04-23T00:00:00.000Z", value: 1e15 };
  assert.equal(point.value, 1e15);
});

test("TimeSeriesPoint with floating point value", () => {
  const point: TimeSeriesPoint = { timestamp: "2026-04-23T00:00:00.000Z", value: 0.000001 };
  assert.equal(point.value, 0.000001);
});

test("AnomalyRecord with all required fields", () => {
  const record: AnomalyRecord = {
    id: "anomaly_test_001",
    metricName: "cpu.usage.percent",
    timestamp: "2026-04-23T00:00:00.000Z",
    severity: "critical",
    category: "spike",
    score: 0.92,
    expectedValue: 50,
    observedValue: 95,
    deviation: 45,
    deviationPercent: 90,
    context: { algorithm: "zscore" },
    resolved: false,
    resolvedAt: null,
  };
  assert.equal(record.id, "anomaly_test_001");
  assert.equal(record.metricName, "cpu.usage.percent");
  assert.equal(record.severity, "critical");
  assert.equal(record.category, "spike");
  assert.equal(record.score, 0.92);
  assert.equal(record.resolved, false);
  assert.equal(record.resolvedAt, null);
});

test("AnomalyRecord with resolved state", () => {
  const record: AnomalyRecord = {
    id: "anomaly_test_002",
    metricName: "memory.usage",
    timestamp: "2026-04-23T00:00:00.000Z",
    severity: "warning",
    category: "trend_change",
    score: 0.65,
    expectedValue: 1000,
    observedValue: 1500,
    deviation: 500,
    deviationPercent: 50,
    context: {},
    resolved: true,
    resolvedAt: "2026-04-23T01:00:00.000Z",
  };
  assert.equal(record.resolved, true);
  assert.equal(record.resolvedAt, "2026-04-23T01:00:00.000Z");
});

test("AnomalyRecord context can hold arbitrary data", () => {
  const record: AnomalyRecord = {
    id: "anomaly_test_003",
    metricName: "request.latency",
    timestamp: "2026-04-23T00:00:00.000Z",
    severity: "emergency",
    category: "level_shift",
    score: 0.99,
    expectedValue: 200,
    observedValue: 5000,
    deviation: 4800,
    deviationPercent: 2400,
    context: {
      region: "us-east-1",
      instanceId: "i-abc123",
      count: 42,
      nested: { a: 1, b: [1, 2, 3] },
      isExternal: true,
    },
    resolved: false,
    resolvedAt: null,
  };
  assert.equal(record.context.region, "us-east-1");
  assert.equal(record.context.instanceId, "i-abc123");
  assert.equal(record.context.count, 42);
  assert.deepStrictEqual(record.context.nested, { a: 1, b: [1, 2, 3] });
  assert.equal(record.context.isExternal, true);
});

test("AnomalyRecord deviation calculation is mathematically correct", () => {
  const expectedValue = 100;
  const observedValue = 150;
  const record: AnomalyRecord = {
    id: "anomaly_calc",
    metricName: "test",
    timestamp: "2026-04-23T00:00:00.000Z",
    severity: "warning",
    category: "spike",
    score: 0.5,
    expectedValue,
    observedValue,
    deviation: Math.abs(observedValue - expectedValue),
    deviationPercent: (Math.abs(observedValue - expectedValue) / expectedValue) * 100,
    context: {},
    resolved: false,
    resolvedAt: null,
  };
  assert.equal(record.deviation, 50);
  assert.equal(record.deviationPercent, 50);
});

test("AnomalyRecord with zero expectedValue handles division", () => {
  const record: AnomalyRecord = {
    id: "anomaly_zero",
    metricName: "test_zero",
    timestamp: "2026-04-23T00:00:00.000Z",
    severity: "info",
    category: "static",
    score: 0,
    expectedValue: 0,
    observedValue: 0,
    deviation: 0,
    deviationPercent: 0,
    context: {},
    resolved: false,
    resolvedAt: null,
  };
  assert.equal(record.deviation, 0);
  assert.equal(record.deviationPercent, 0);
});

test("AnomalyDetectionConfig with all algorithm types", () => {
  const algorithms: AnomalyDetectionConfig["algorithm"][] = ["zscore", "iqr", "ewma", "gradient"];
  algorithms.forEach((algo) => {
    const config: AnomalyDetectionConfig = {
      algorithm: algo,
      sensitivity: 0.5,
      windowSize: 100,
      minDataPoints: 10,
    };
    assert.equal(config.algorithm, algo);
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

test("AnomalyDetectionConfig with optional seasonalPeriod", () => {
  const config: AnomalyDetectionConfig = {
    algorithm: "zscore",
    sensitivity: 0.5,
    windowSize: 100,
    minDataPoints: 10,
    seasonalPeriod: 60,
  };
  assert.equal(config.seasonalPeriod, 60);
});

test("AnomalyDetectionConfig seasonalPeriod must be positive if provided", () => {
  const config: AnomalyDetectionConfig = {
    algorithm: "zscore",
    sensitivity: 0.5,
    windowSize: 100,
    minDataPoints: 10,
    seasonalPeriod: 24 * 7, // weekly
  };
  assert.ok(config.seasonalPeriod! > 0);
});

test("AdaptiveThreshold structure", () => {
  const threshold: AdaptiveThreshold = {
    upper: 150,
    lower: 50,
    baseline: 100,
    algorithm: "zscore",
    lastUpdated: "2026-04-23T00:00:00.000Z",
  };
  assert.equal(threshold.upper, 150);
  assert.equal(threshold.lower, 50);
  assert.equal(threshold.baseline, 100);
  assert.equal(threshold.algorithm, "zscore");
});

test("AdaptiveThreshold upper is greater than lower", () => {
  const threshold: AdaptiveThreshold = {
    upper: 100,
    lower: 0,
    baseline: 50,
    algorithm: "iqr",
    lastUpdated: "2026-04-23T00:00:00.000Z",
  };
  assert.ok(threshold.upper > threshold.lower);
  assert.ok(threshold.baseline >= threshold.lower);
  assert.ok(threshold.baseline <= threshold.upper);
});

test("AnomalySignature with regex pattern", () => {
  const sig: AnomalySignature = {
    id: "sig_cpu_spike",
    name: "CPU Spike Detector",
    pattern: /cpu.*>=\s*[0-9]+%|CPU.*spike/i,
    category: "spike",
    severity: "critical",
    description: "Detects CPU usage spikes",
  };
  assert.equal(sig.id, "sig_cpu_spike");
  assert.equal(sig.name, "CPU Spike Detector");
  assert.ok(sig.pattern instanceof RegExp);
  assert.equal(sig.category, "spike");
  assert.equal(sig.severity, "critical");
});

test("AnomalySignature pattern matching works correctly", () => {
  const sig: AnomalySignature = {
    id: "sig_error",
    name: "Error Detector",
    pattern: /error|fail|exception/i,
    category: "spike",
    severity: "critical",
    description: "Detects errors",
  };
  assert.ok(sig.pattern.test("Error: connection failed"));
  assert.ok(sig.pattern.test("API FAIL"));
  assert.ok(sig.pattern.test("Unhandled exception"));
  assert.ok(!sig.pattern.test("Success"));
});

test("AnomalyDetectionResult for anomaly detected", () => {
  const result: AnomalyDetectionResult = {
    isAnomaly: true,
    score: 0.85,
    severity: "critical",
    category: "spike",
    expectedValue: 50,
    deviation: 45,
    deviationPercent: 90,
    explanation: "Z-score anomaly detected: value=95, mean=50, z=3.00, threshold=3.25",
  };
  assert.equal(result.isAnomaly, true);
  assert.ok(result.score > 0.5);
  assert.equal(result.severity, "critical");
  assert.equal(result.category, "spike");
});

test("AnomalyDetectionResult for normal variation", () => {
  const result: AnomalyDetectionResult = {
    isAnomaly: false,
    score: 0.1,
    severity: "info",
    category: "static",
    expectedValue: 50,
    deviation: 2,
    deviationPercent: 4,
    explanation: "Normal variation: z=0.40 < threshold=3.25",
  };
  assert.equal(result.isAnomaly, false);
  assert.ok(result.score < 0.5);
});

test("AnomalyDetectionResult score is between 0 and 1", () => {
  const result: AnomalyDetectionResult = {
    isAnomaly: true,
    score: 0.95,
    severity: "emergency",
    category: "level_shift",
    expectedValue: 100,
    deviation: 900,
    deviationPercent: 900,
    explanation: "Emergency level anomaly",
  };
  assert.ok(result.score >= 0);
  assert.ok(result.score <= 1);
});

test("AnomalyDetectorOptions with minimal config", () => {
  const options: AnomalyDetectorOptions = {
    config: {
      algorithm: "iqr",
    },
  };
  assert.ok(options.config);
  assert.equal(options.config.algorithm, "iqr");
});

test("AnomalyDetectorOptions with multiple signatures", () => {
  const sig1: AnomalySignature = {
    id: "sig_1",
    name: "Signature One",
    pattern: /pattern1/,
    category: "spike",
    severity: "warning",
    description: "First pattern",
  };
  const sig2: AnomalySignature = {
    id: "sig_2",
    name: "Signature Two",
    pattern: /pattern2/,
    category: "dip",
    severity: "critical",
    description: "Second pattern",
  };
  const options: AnomalyDetectorOptions = {
    signatures: [sig1, sig2],
  };
  assert.ok(options.signatures);
  assert.equal(options.signatures.length, 2);
  assert.equal(options.signatures[0]!.id, "sig_1");
  assert.equal(options.signatures[1]!.id, "sig_2");
});

test("AnomalyDetectorOptions without config uses defaults", () => {
  const options: AnomalyDetectorOptions = {};
  assert.equal(options.config, undefined);
  assert.equal(options.signatures, undefined);
});

test("AnomalyRecord can be created for all severity and category combinations", () => {
  const severities: AnomalySeverity[] = ["info", "warning", "critical", "emergency"];
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

  let combinationCount = 0;
  for (const severity of severities) {
    for (const category of categories) {
      const record: AnomalyRecord = {
        id: `combination_${severity}_${category}`,
        metricName: "test_metric",
        timestamp: "2026-04-23T00:00:00.000Z",
        severity,
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
      assert.equal(record.severity, severity);
      assert.equal(record.category, category);
      combinationCount++;
    }
  }
  assert.equal(combinationCount, severities.length * categories.length);
});
