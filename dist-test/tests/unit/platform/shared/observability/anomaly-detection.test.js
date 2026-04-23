import assert from "node:assert/strict";
import test from "node:test";
import { ANOMALY_CATEGORY_LABELS, DEFAULT_CONFIG, } from "../../../../../src/platform/shared/observability/anomaly-detection/constants.js";
// Tests for ANOMALY_CATEGORY_LABELS constant
test("ANOMALY_CATEGORY_LABELS has correct number of entries", () => {
    const entries = Object.keys(ANOMALY_CATEGORY_LABELS);
    assert.equal(entries.length, 8);
});
test("ANOMALY_CATEGORY_LABELS spike has correct label", () => {
    assert.equal(ANOMALY_CATEGORY_LABELS.spike, "Sudden increase");
});
test("ANOMALY_CATEGORY_LABELS dip has correct label", () => {
    assert.equal(ANOMALY_CATEGORY_LABELS.dip, "Sudden decrease");
});
test("ANOMALY_CATEGORY_LABELS trend_change has correct label", () => {
    assert.equal(ANOMALY_CATEGORY_LABELS.trend_change, "Trend direction changed");
});
test("ANOMALY_CATEGORY_LABELS level_shift has correct label", () => {
    assert.equal(ANOMALY_CATEGORY_LABELS.level_shift, "Level shifted abruptly");
});
test("ANOMALY_CATEGORY_LABELS seasonal_violation has correct label", () => {
    assert.equal(ANOMALY_CATEGORY_LABELS.seasonal_violation, "Seasonal pattern broken");
});
test("ANOMALY_CATEGORY_LABELS rate_of_change has correct label", () => {
    assert.equal(ANOMALY_CATEGORY_LABELS.rate_of_change, "Rate of change exceeded threshold");
});
test("ANOMALY_CATEGORY_LABELS static has correct label", () => {
    assert.equal(ANOMALY_CATEGORY_LABELS.static, "Expected variation absent");
});
test("ANOMALY_CATEGORY_LABELS pattern_break has correct label", () => {
    assert.equal(ANOMALY_CATEGORY_LABELS.pattern_break, "Known pattern disrupted");
});
test("ANOMALY_CATEGORY_LABELS all values are non-empty strings", () => {
    for (const [key, label] of Object.entries(ANOMALY_CATEGORY_LABELS)) {
        assert.ok(typeof label === "string", `${key} should have string label`);
        assert.ok(label.length > 0, `${key} label should not be empty`);
    }
});
// Tests for DEFAULT_CONFIG constant
test("DEFAULT_CONFIG has correct algorithm", () => {
    assert.equal(DEFAULT_CONFIG.algorithm, "zscore");
});
test("DEFAULT_CONFIG has correct sensitivity", () => {
    assert.equal(DEFAULT_CONFIG.sensitivity, 0.5);
});
test("DEFAULT_CONFIG has correct windowSize", () => {
    assert.equal(DEFAULT_CONFIG.windowSize, 100);
});
test("DEFAULT_CONFIG has correct minDataPoints", () => {
    assert.equal(DEFAULT_CONFIG.minDataPoints, 10);
});
test("DEFAULT_CONFIG sensitivity is within valid range 0-1", () => {
    assert.ok(DEFAULT_CONFIG.sensitivity >= 0);
    assert.ok(DEFAULT_CONFIG.sensitivity <= 1);
});
test("DEFAULT_CONFIG windowSize is positive integer", () => {
    assert.ok(DEFAULT_CONFIG.windowSize > 0);
    assert.ok(Number.isInteger(DEFAULT_CONFIG.windowSize));
});
test("DEFAULT_CONFIG minDataPoints is positive integer", () => {
    assert.ok(DEFAULT_CONFIG.minDataPoints > 0);
    assert.ok(Number.isInteger(DEFAULT_CONFIG.minDataPoints));
});
test("DEFAULT_CONFIG does not have seasonalPeriod", () => {
    assert.equal(DEFAULT_CONFIG.seasonalPeriod, undefined);
});
// Tests for AnomalySeverity type
test("AnomalySeverity accepts info", () => {
    const severity = "info";
    assert.equal(severity, "info");
});
test("AnomalySeverity accepts warning", () => {
    const severity = "warning";
    assert.equal(severity, "warning");
});
test("AnomalySeverity accepts critical", () => {
    const severity = "critical";
    assert.equal(severity, "critical");
});
test("AnomalySeverity accepts emergency", () => {
    const severity = "emergency";
    assert.equal(severity, "emergency");
});
// Tests for AnomalyCategory type
test("AnomalyCategory accepts spike", () => {
    const category = "spike";
    assert.equal(category, "spike");
});
test("AnomalyCategory accepts dip", () => {
    const category = "dip";
    assert.equal(category, "dip");
});
test("AnomalyCategory accepts trend_change", () => {
    const category = "trend_change";
    assert.equal(category, "trend_change");
});
test("AnomalyCategory accepts level_shift", () => {
    const category = "level_shift";
    assert.equal(category, "level_shift");
});
test("AnomalyCategory accepts seasonal_violation", () => {
    const category = "seasonal_violation";
    assert.equal(category, "seasonal_violation");
});
test("AnomalyCategory accepts rate_of_change", () => {
    const category = "rate_of_change";
    assert.equal(category, "rate_of_change");
});
test("AnomalyCategory accepts static", () => {
    const category = "static";
    assert.equal(category, "static");
});
test("AnomalyCategory accepts pattern_break", () => {
    const category = "pattern_break";
    assert.equal(category, "pattern_break");
});
// Tests for TimeSeriesPoint interface
test("TimeSeriesPoint accepts valid timestamp and value", () => {
    const point = {
        timestamp: "2026-04-23T10:00:00.000Z",
        value: 42.5,
    };
    assert.equal(point.timestamp, "2026-04-23T10:00:00.000Z");
    assert.equal(point.value, 42.5);
});
test("TimeSeriesPoint accepts zero value", () => {
    const point = {
        timestamp: "2026-04-23T00:00:00.000Z",
        value: 0,
    };
    assert.equal(point.value, 0);
});
test("TimeSeriesPoint accepts negative value", () => {
    const point = {
        timestamp: "2026-04-23T00:00:00.000Z",
        value: -100.5,
    };
    assert.equal(point.value, -100.5);
});
test("TimeSeriesPoint accepts large value", () => {
    const point = {
        timestamp: "2026-04-23T00:00:00.000Z",
        value: 1e15,
    };
    assert.equal(point.value, 1e15);
});
// Tests for AnomalyRecord interface
test("AnomalyRecord with all fields", () => {
    const record = {
        id: "anomaly_001",
        metricName: "cpu.usage",
        timestamp: "2026-04-23T10:00:00.000Z",
        severity: "critical",
        category: "spike",
        score: 0.95,
        expectedValue: 50,
        observedValue: 100,
        deviation: 50,
        deviationPercent: 100,
        context: { region: "us-east-1", pod: "api-1" },
        resolved: false,
        resolvedAt: null,
    };
    assert.equal(record.id, "anomaly_001");
    assert.equal(record.metricName, "cpu.usage");
    assert.equal(record.severity, "critical");
    assert.equal(record.category, "spike");
    assert.equal(record.score, 0.95);
    assert.equal(record.resolved, false);
    assert.equal(record.resolvedAt, null);
});
test("AnomalyRecord resolved state", () => {
    const record = {
        id: "anomaly_002",
        metricName: "memory.usage",
        timestamp: "2026-04-23T10:00:00.000Z",
        severity: "warning",
        category: "level_shift",
        score: 0.75,
        expectedValue: 60,
        observedValue: 85,
        deviation: 25,
        deviationPercent: 41.67,
        context: {},
        resolved: true,
        resolvedAt: "2026-04-23T11:00:00.000Z",
    };
    assert.equal(record.resolved, true);
    assert.equal(record.resolvedAt, "2026-04-23T11:00:00.000Z");
});
test("AnomalyRecord with empty context", () => {
    const record = {
        id: "anomaly_003",
        metricName: "latency",
        timestamp: "2026-04-23T10:00:00.000Z",
        severity: "info",
        category: "static",
        score: 0.1,
        expectedValue: 100,
        observedValue: 105,
        deviation: 5,
        deviationPercent: 5,
        context: {},
        resolved: false,
        resolvedAt: null,
    };
    assert.deepEqual(record.context, {});
});
test("AnomalyRecord with various severity levels", () => {
    const severities = ["info", "warning", "critical", "emergency"];
    for (const severity of severities) {
        const record = {
            id: `anomaly_${severity}`,
            metricName: "test.metric",
            timestamp: "2026-04-23T10:00:00.000Z",
            severity,
            category: "spike",
            score: 0.5,
            expectedValue: 50,
            observedValue: 75,
            deviation: 25,
            deviationPercent: 50,
            context: {},
            resolved: false,
            resolvedAt: null,
        };
        assert.equal(record.severity, severity);
    }
});
// Tests for AnomalyDetectionConfig interface
test("AnomalyDetectionConfig with zscore algorithm", () => {
    const config = {
        algorithm: "zscore",
        sensitivity: 0.5,
        windowSize: 100,
        minDataPoints: 10,
    };
    assert.equal(config.algorithm, "zscore");
});
test("AnomalyDetectionConfig with iqr algorithm", () => {
    const config = {
        algorithm: "iqr",
        sensitivity: 0.5,
        windowSize: 100,
        minDataPoints: 10,
    };
    assert.equal(config.algorithm, "iqr");
});
test("AnomalyDetectionConfig with ewma algorithm", () => {
    const config = {
        algorithm: "ewma",
        sensitivity: 0.5,
        windowSize: 100,
        minDataPoints: 10,
    };
    assert.equal(config.algorithm, "ewma");
});
test("AnomalyDetectionConfig with gradient algorithm", () => {
    const config = {
        algorithm: "gradient",
        sensitivity: 0.5,
        windowSize: 100,
        minDataPoints: 10,
    };
    assert.equal(config.algorithm, "gradient");
});
test("AnomalyDetectionConfig with optional seasonalPeriod", () => {
    const config = {
        algorithm: "zscore",
        sensitivity: 0.5,
        windowSize: 100,
        minDataPoints: 10,
        seasonalPeriod: 60,
    };
    assert.equal(config.seasonalPeriod, 60);
});
test("AnomalyDetectionConfig sensitivity boundary values", () => {
    const lowConfig = {
        algorithm: "zscore",
        sensitivity: 0,
        windowSize: 100,
        minDataPoints: 10,
    };
    assert.equal(lowConfig.sensitivity, 0);
    const highConfig = {
        algorithm: "zscore",
        sensitivity: 1,
        windowSize: 100,
        minDataPoints: 10,
    };
    assert.equal(highConfig.sensitivity, 1);
});
// Tests for AdaptiveThreshold interface
test("AdaptiveThreshold structure", () => {
    const threshold = {
        upper: 150,
        lower: 50,
        baseline: 100,
        algorithm: "zscore",
        lastUpdated: "2026-04-23T10:00:00.000Z",
    };
    assert.equal(threshold.upper, 150);
    assert.equal(threshold.lower, 50);
    assert.equal(threshold.baseline, 100);
    assert.equal(threshold.algorithm, "zscore");
    assert.equal(threshold.lastUpdated, "2026-04-23T10:00:00.000Z");
});
test("AdaptiveThreshold with different algorithms", () => {
    const algorithms = ["zscore", "iqr", "ewma", "gradient"];
    for (const algo of algorithms) {
        const threshold = {
            upper: 100,
            lower: 0,
            baseline: 50,
            algorithm: algo,
            lastUpdated: "2026-04-23T10:00:00.000Z",
        };
        assert.equal(threshold.algorithm, algo);
    }
});
// Tests for AnomalySignature interface
test("AnomalySignature structure", () => {
    const sig = {
        id: "sig_001",
        name: "High CPU Usage",
        pattern: /cpu.*usage.*>[0-9]+/i,
        category: "spike",
        severity: "critical",
        description: "Detects high CPU usage spikes",
    };
    assert.equal(sig.id, "sig_001");
    assert.equal(sig.name, "High CPU Usage");
    assert.ok(sig.pattern instanceof RegExp);
    assert.equal(sig.category, "spike");
    assert.equal(sig.severity, "critical");
    assert.equal(sig.description, "Detects high CPU usage spikes");
});
test("AnomalySignature pattern matching", () => {
    const sig = {
        id: "sig_002",
        name: "Error Rate Spike",
        pattern: /error.*rate.*spike/i,
        category: "spike",
        severity: "critical",
        description: "Detects error rate spikes",
    };
    assert.ok(sig.pattern.test("ERROR RATE SPIKE DETECTED"));
    assert.ok(sig.pattern.test("error rate spike"));
    assert.ok(!sig.pattern.test("normal error rate"));
});
test("AnomalySignature with various categories", () => {
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
    for (const category of categories) {
        const sig = {
            id: `sig_${category}`,
            name: "Test",
            pattern: /test/,
            category,
            severity: "info",
            description: "Test",
        };
        assert.equal(sig.category, category);
    }
});
// Tests for AnomalyDetectionResult interface
test("AnomalyDetectionResult anomaly detected", () => {
    const result = {
        isAnomaly: true,
        score: 0.92,
        severity: "critical",
        category: "spike",
        expectedValue: 50,
        deviation: 45,
        deviationPercent: 90,
        explanation: "Z-score exceeded threshold",
    };
    assert.equal(result.isAnomaly, true);
    assert.equal(result.score, 0.92);
    assert.equal(result.severity, "critical");
    assert.equal(result.category, "spike");
    assert.equal(result.expectedValue, 50);
    assert.equal(result.deviation, 45);
    assert.equal(result.deviationPercent, 90);
    assert.equal(result.explanation, "Z-score exceeded threshold");
});
test("AnomalyDetectionResult no anomaly", () => {
    const result = {
        isAnomaly: false,
        score: 0.1,
        severity: "info",
        category: "static",
        expectedValue: 100,
        deviation: 2,
        deviationPercent: 2,
        explanation: "Within normal range",
    };
    assert.equal(result.isAnomaly, false);
    assert.equal(result.score, 0.1);
    assert.equal(result.severity, "info");
});
test("AnomalyDetectionResult with zero deviation", () => {
    const result = {
        isAnomaly: false,
        score: 0,
        severity: "info",
        category: "static",
        expectedValue: 50,
        deviation: 0,
        deviationPercent: 0,
        explanation: "Exact match",
    };
    assert.equal(result.deviation, 0);
    assert.equal(result.deviationPercent, 0);
});
test("AnomalyDetectionResult with negative deviation", () => {
    const result = {
        isAnomaly: true,
        score: 0.85,
        severity: "warning",
        category: "dip",
        expectedValue: 100,
        deviation: -30,
        deviationPercent: -30,
        explanation: "Value below expected",
    };
    assert.equal(result.deviation, -30);
    assert.equal(result.deviationPercent, -30);
});
// Tests for AnomalyDetectorOptions interface
test("AnomalyDetectorOptions with minimal config", () => {
    const options = {
        config: {
            algorithm: "zscore",
        },
    };
    assert.equal(options.config.algorithm, "zscore");
});
test("AnomalyDetectorOptions with full config", () => {
    const options = {
        config: {
            algorithm: "ewma",
            sensitivity: 0.8,
            windowSize: 200,
            minDataPoints: 20,
            seasonalPeriod: 24,
        },
    };
    assert.equal(options.config.algorithm, "ewma");
    assert.equal(options.config.sensitivity, 0.8);
    assert.equal(options.config.windowSize, 200);
    assert.equal(options.config.seasonalPeriod, 24);
});
test("AnomalyDetectorOptions with signatures", () => {
    const options = {
        signatures: [
            {
                id: "sig_1",
                name: "High Memory",
                pattern: /memory.*>[0-9]+/,
                category: "spike",
                severity: "warning",
                description: "High memory usage",
            },
            {
                id: "sig_2",
                name: "High CPU",
                pattern: /cpu.*>[0-9]+/,
                category: "spike",
                severity: "critical",
                description: "High CPU usage",
            },
        ],
    };
    assert.equal(options.signatures.length, 2);
    assert.ok(options.signatures[0] != null);
    assert.ok(options.signatures[1] != null);
    assert.equal(options.signatures[0].id, "sig_1");
    assert.equal(options.signatures[1].id, "sig_2");
});
test("AnomalyDetectorOptions with both config and signatures", () => {
    const options = {
        config: {
            algorithm: "iqr",
            sensitivity: 0.6,
        },
        signatures: [
            {
                id: "sig_1",
                name: "Test",
                pattern: /test/,
                category: "spike",
                severity: "info",
                description: "Test signature",
            },
        ],
    };
    assert.equal(options.config.algorithm, "iqr");
    assert.equal(options.signatures.length, 1);
});
test("AnomalyDetectorOptions without config or signatures", () => {
    const options = {};
    assert.equal(options.config, undefined);
    assert.equal(options.signatures, undefined);
});
//# sourceMappingURL=anomaly-detection.test.js.map