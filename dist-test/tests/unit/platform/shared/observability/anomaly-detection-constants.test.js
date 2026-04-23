import assert from "node:assert/strict";
import test from "node:test";
import { ANOMALY_CATEGORY_LABELS, DEFAULT_CONFIG, } from "../../../../../src/platform/shared/observability/anomaly-detection/constants.js";
test("ANOMALY_CATEGORY_LABELS contains all anomaly categories", () => {
    assert.equal(ANOMALY_CATEGORY_LABELS.spike, "Sudden increase");
    assert.equal(ANOMALY_CATEGORY_LABELS.dip, "Sudden decrease");
    assert.equal(ANOMALY_CATEGORY_LABELS.trend_change, "Trend direction changed");
    assert.equal(ANOMALY_CATEGORY_LABELS.level_shift, "Level shifted abruptly");
    assert.equal(ANOMALY_CATEGORY_LABELS.seasonal_violation, "Seasonal pattern broken");
    assert.equal(ANOMALY_CATEGORY_LABELS.rate_of_change, "Rate of change exceeded threshold");
    assert.equal(ANOMALY_CATEGORY_LABELS.static, "Expected variation absent");
    assert.equal(ANOMALY_CATEGORY_LABELS.pattern_break, "Known pattern disrupted");
});
test("DEFAULT_CONFIG has correct anomaly detection defaults", () => {
    assert.equal(DEFAULT_CONFIG.algorithm, "zscore");
    assert.equal(DEFAULT_CONFIG.sensitivity, 0.5);
    assert.equal(DEFAULT_CONFIG.windowSize, 100);
    assert.equal(DEFAULT_CONFIG.minDataPoints, 10);
});
test("ANOMALY_CATEGORY_LABELS has expected number of entries", () => {
    const entries = Object.keys(ANOMALY_CATEGORY_LABELS);
    assert.equal(entries.length, 8, "Should have 8 anomaly category labels");
});
test("ANOMALY_CATEGORY_LABELS values are all non-empty strings", () => {
    for (const [key, label] of Object.entries(ANOMALY_CATEGORY_LABELS)) {
        assert.ok(typeof label === "string", `${key} should have string label`);
        assert.ok(label.length > 0, `${key} label should not be empty`);
    }
});
test("DEFAULT_CONFIG sensitivity is within valid range (0-1)", () => {
    assert.ok(DEFAULT_CONFIG.sensitivity >= 0, "sensitivity should be >= 0");
    assert.ok(DEFAULT_CONFIG.sensitivity <= 1, "sensitivity should be <= 1");
});
test("DEFAULT_CONFIG windowSize and minDataPoints are positive integers", () => {
    assert.ok(DEFAULT_CONFIG.windowSize > 0, "windowSize should be positive");
    assert.ok(DEFAULT_CONFIG.minDataPoints > 0, "minDataPoints should be positive");
    assert.ok(Number.isInteger(DEFAULT_CONFIG.windowSize), "windowSize should be integer");
    assert.ok(Number.isInteger(DEFAULT_CONFIG.minDataPoints), "minDataPoints should be integer");
});
//# sourceMappingURL=anomaly-detection-constants.test.js.map