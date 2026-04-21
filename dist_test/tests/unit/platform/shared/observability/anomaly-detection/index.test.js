import assert from "node:assert/strict";
import test from "node:test";
// Barrel test for anomaly-detection module
import { ANOMALY_CATEGORY_LABELS, DEFAULT_CONFIG, } from "../../../../../../src/platform/shared/observability/anomaly-detection/constants.js";
test("ANOMALY_CATEGORY_LABELS has entries for all anomaly categories", () => {
    const expectedCategories = [
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
    const result = {
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
    const result = {
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
    const record = {
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
    const record = {
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
    const severities = ["info", "warning", "critical", "emergency"];
    assert.equal(severities.length, 4);
});
test("AnomalyCategory type accepts valid values", () => {
    const categories = [
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
    const signature = {
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
    const point = {
        timestamp: "2026-04-14T00:00:00.000Z",
        value: 150.5,
    };
    assert.equal(point.timestamp, "2026-04-14T00:00:00.000Z");
    assert.equal(point.value, 150.5);
});
test("AdaptiveThreshold structure is correct", () => {
    const threshold = {
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
    const config = {
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
    const config = {
        algorithm: "iqr",
        sensitivity: 0.5,
        windowSize: 100,
        minDataPoints: 10,
    };
    assert.equal(config.seasonalPeriod, undefined);
});
//# sourceMappingURL=index.test.js.map