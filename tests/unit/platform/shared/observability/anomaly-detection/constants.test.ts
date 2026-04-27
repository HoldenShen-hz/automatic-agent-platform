import assert from "node:assert/strict";
import test from "node:test";

import {
  ANOMALY_CATEGORY_LABELS,
  DEFAULT_CONFIG,
} from "../../../../../../src/platform/shared/observability/anomaly-detection/constants.js";

test("ANOMALY_CATEGORY_LABELS has entries for all anomaly categories", () => {
  const categories = [
    "spike",
    "dip",
    "trend_change",
    "level_shift",
    "seasonal_violation",
    "rate_of_change",
    "static",
    "pattern_break",
  ] as const;

  for (const category of categories) {
    assert.ok(ANOMALY_CATEGORY_LABELS[category] !== undefined, `Missing label for ${category}`);
    assert.ok(typeof ANOMALY_CATEGORY_LABELS[category] === "string");
    assert.ok(ANOMALY_CATEGORY_LABELS[category].length > 0, `Empty label for ${category}`);
  }
});

test("ANOMALY_CATEGORY_LABELS spike label is descriptive", () => {
  assert.equal(ANOMALY_CATEGORY_LABELS.spike, "Sudden increase");
});

test("ANOMALY_CATEGORY_LABELS dip label is descriptive", () => {
  assert.equal(ANOMALY_CATEGORY_LABELS.dip, "Sudden decrease");
});

test("ANOMALY_CATEGORY_LABELS trend_change label is descriptive", () => {
  assert.equal(ANOMALY_CATEGORY_LABELS.trend_change, "Trend direction changed");
});

test("ANOMALY_CATEGORY_LABELS level_shift label is descriptive", () => {
  assert.equal(ANOMALY_CATEGORY_LABELS.level_shift, "Level shifted abruptly");
});

test("ANOMALY_CATEGORY_LABELS seasonal_violation label is descriptive", () => {
  assert.equal(ANOMALY_CATEGORY_LABELS.seasonal_violation, "Seasonal pattern broken");
});

test("ANOMALY_CATEGORY_LABELS rate_of_change label is descriptive", () => {
  assert.equal(ANOMALY_CATEGORY_LABELS.rate_of_change, "Rate of change exceeded threshold");
});

test("ANOMALY_CATEGORY_LABELS static label is descriptive", () => {
  assert.equal(ANOMALY_CATEGORY_LABELS.static, "Expected variation absent");
});

test("ANOMALY_CATEGORY_LABELS pattern_break label is descriptive", () => {
  assert.equal(ANOMALY_CATEGORY_LABELS.pattern_break, "Known pattern disrupted");
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

test("DEFAULT_CONFIG sensitivity is in valid range", () => {
  assert.ok(DEFAULT_CONFIG.sensitivity >= 0);
  assert.ok(DEFAULT_CONFIG.sensitivity <= 1);
});

test("DEFAULT_CONFIG windowSize is positive", () => {
  assert.ok(DEFAULT_CONFIG.windowSize > 0);
});

test("DEFAULT_CONFIG minDataPoints is positive", () => {
  assert.ok(DEFAULT_CONFIG.minDataPoints > 0);
});

test("DEFAULT_CONFIG windowSize is greater than minDataPoints", () => {
  assert.ok(DEFAULT_CONFIG.windowSize > DEFAULT_CONFIG.minDataPoints);
});

test("ANOMALY_CATEGORY_LABELS is a frozen object", () => {
  assert.ok(Object.isFrozen(ANOMALY_CATEGORY_LABELS));
});

test("ANOMALY_CATEGORY_LABELS values are not empty strings", () => {
  for (const label of Object.values(ANOMALY_CATEGORY_LABELS)) {
    assert.ok(label.length > 0, `Found empty label`);
  }
});
