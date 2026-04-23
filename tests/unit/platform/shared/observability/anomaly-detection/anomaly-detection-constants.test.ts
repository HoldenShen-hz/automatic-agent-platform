import assert from "node:assert/strict";
import test from "node:test";

import {
  ANOMALY_CATEGORY_LABELS,
  DEFAULT_CONFIG,
} from "../../../../../../src/platform/shared/observability/anomaly-detection/constants.js";
import type { AnomalyCategory, AnomalyDetectionConfig } from "../../../../../../src/platform/shared/observability/anomaly-detection/types.js";

test("ANOMALY_CATEGORY_LABELS contains all 8 anomaly category entries", () => {
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

  assert.equal(Object.keys(ANOMALY_CATEGORY_LABELS).length, 8);
  for (const category of expectedCategories) {
    assert.ok(ANOMALY_CATEGORY_LABELS[category], `Missing label for category: ${category}`);
    assert.equal(typeof ANOMALY_CATEGORY_LABELS[category], "string");
  }
});

test("ANOMALY_CATEGORY_LABELS spike label is descriptive", () => {
  assert.equal(ANOMALY_CATEGORY_LABELS.spike, "Sudden increase");
  assert.ok(ANOMALY_CATEGORY_LABELS.spike.length > 0);
});

test("ANOMALY_CATEGORY_LABELS dip label is descriptive", () => {
  assert.equal(ANOMALY_CATEGORY_LABELS.dip, "Sudden decrease");
  assert.ok(ANOMALY_CATEGORY_LABELS.dip.length > 0);
});

test("ANOMALY_CATEGORY_LABELS trend_change label is descriptive", () => {
  assert.equal(ANOMALY_CATEGORY_LABELS.trend_change, "Trend direction changed");
  assert.ok(ANOMALY_CATEGORY_LABELS.trend_change.length > 0);
});

test("ANOMALY_CATEGORY_LABELS level_shift label is descriptive", () => {
  assert.equal(ANOMALY_CATEGORY_LABELS.level_shift, "Level shifted abruptly");
  assert.ok(ANOMALY_CATEGORY_LABELS.level_shift.length > 0);
});

test("ANOMALY_CATEGORY_LABELS seasonal_violation label is descriptive", () => {
  assert.equal(ANOMALY_CATEGORY_LABELS.seasonal_violation, "Seasonal pattern broken");
  assert.ok(ANOMALY_CATEGORY_LABELS.seasonal_violation.length > 0);
});

test("ANOMALY_CATEGORY_LABELS rate_of_change label is descriptive", () => {
  assert.equal(ANOMALY_CATEGORY_LABELS.rate_of_change, "Rate of change exceeded threshold");
  assert.ok(ANOMALY_CATEGORY_LABELS.rate_of_change.length > 0);
});

test("ANOMALY_CATEGORY_LABELS static label is descriptive", () => {
  assert.equal(ANOMALY_CATEGORY_LABELS.static, "Expected variation absent");
  assert.ok(ANOMALY_CATEGORY_LABELS.static.length > 0);
});

test("ANOMALY_CATEGORY_LABELS pattern_break label is descriptive", () => {
  assert.equal(ANOMALY_CATEGORY_LABELS.pattern_break, "Known pattern disrupted");
  assert.ok(ANOMALY_CATEGORY_LABELS.pattern_break.length > 0);
});

test("ANOMALY_CATEGORY_LABELS all labels contain meaningful descriptive text", () => {
  for (const [key, label] of Object.entries(ANOMALY_CATEGORY_LABELS)) {
    assert.ok(label.length > 0, `${key} should have non-empty label`);
    assert.ok(
      label.includes(" ") || label.length > 3,
      `${key} label should be descriptive (not just a single character)`,
    );
  }
});

test("DEFAULT_CONFIG has correct structure", () => {
  assert.equal(DEFAULT_CONFIG.algorithm, "zscore");
  assert.equal(DEFAULT_CONFIG.sensitivity, 0.5);
  assert.equal(DEFAULT_CONFIG.windowSize, 100);
  assert.equal(DEFAULT_CONFIG.minDataPoints, 10);
});

test("DEFAULT_CONFIG algorithm is valid", () => {
  const validAlgorithms: AnomalyDetectionConfig["algorithm"][] = ["zscore", "iqr", "ewma", "gradient"];
  assert.ok(validAlgorithms.includes(DEFAULT_CONFIG.algorithm));
});

test("DEFAULT_CONFIG sensitivity is within valid range 0-1", () => {
  assert.ok(DEFAULT_CONFIG.sensitivity >= 0, "sensitivity should be >= 0");
  assert.ok(DEFAULT_CONFIG.sensitivity <= 1, "sensitivity should be <= 1");
});

test("DEFAULT_CONFIG sensitivity is 0.5 (midpoint)", () => {
  assert.equal(DEFAULT_CONFIG.sensitivity, 0.5);
});

test("DEFAULT_CONFIG windowSize is positive integer", () => {
  assert.ok(DEFAULT_CONFIG.windowSize > 0, "windowSize should be positive");
  assert.ok(Number.isInteger(DEFAULT_CONFIG.windowSize), "windowSize should be integer");
});

test("DEFAULT_CONFIG minDataPoints is positive integer", () => {
  assert.ok(DEFAULT_CONFIG.minDataPoints > 0, "minDataPoints should be positive");
  assert.ok(Number.isInteger(DEFAULT_CONFIG.minDataPoints), "minDataPoints should be integer");
});

test("DEFAULT_CONFIG windowSize is greater than minDataPoints", () => {
  assert.ok(DEFAULT_CONFIG.windowSize > DEFAULT_CONFIG.minDataPoints);
});

test("DEFAULT_CONFIG has no seasonalPeriod by default", () => {
  assert.equal(DEFAULT_CONFIG.seasonalPeriod, undefined);
});

test("DEFAULT_CONFIG can be spread to create custom config", () => {
  const customConfig: AnomalyDetectionConfig = {
    ...DEFAULT_CONFIG,
    algorithm: "iqr",
    sensitivity: 0.8,
    windowSize: 200,
    minDataPoints: 20,
  };
  assert.equal(customConfig.algorithm, "iqr");
  assert.equal(customConfig.sensitivity, 0.8);
  assert.equal(customConfig.windowSize, 200);
  assert.equal(customConfig.minDataPoints, 20);
});

test("DEFAULT_CONFIG is immutable in practice (spreading does not modify original)", () => {
  const customConfig: AnomalyDetectionConfig = {
    ...DEFAULT_CONFIG,
    sensitivity: 1.0,
  };
  assert.equal(DEFAULT_CONFIG.sensitivity, 0.5);
  assert.equal(customConfig.sensitivity, 1.0);
});

test("All ANOMALY_CATEGORY_LABELS entries can be used in AnomalyRecord category field", () => {
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

  for (const category of categories) {
    const record = {
      id: "test_record",
      metricName: "test_metric",
      timestamp: new Date().toISOString(),
      severity: "warning" as const,
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
    assert.equal(record.category, category, `Category ${category} should be assignable`);
  }
});

test("ANOMALY_CATEGORY_LABELS and AnomalyCategory type have same keys", () => {
  const labelKeys = Object.keys(ANOMALY_CATEGORY_LABELS);
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

  assert.equal(labelKeys.length, expectedCategories.length);
  for (const cat of expectedCategories) {
    assert.ok(cat in ANOMALY_CATEGORY_LABELS, `Category ${cat} should be in ANOMALY_CATEGORY_LABELS`);
  }
});

test("DEFAULT_CONFIG threshold calculation would result in reasonable values", () => {
  // With sensitivity 0.5, threshold factor should be in the middle of the range
  // zscore threshold = 2.5 + (1 - sensitivity) * 1.5 = 2.5 + 0.5 * 1.5 = 3.25
  const sensitivityFactor = 1 - DEFAULT_CONFIG.sensitivity;
  const zscoreThreshold = 2.5 + sensitivityFactor * 1.5;
  assert.ok(zscoreThreshold >= 2.5, "Threshold should be at least 2.5");
  assert.ok(zscoreThreshold <= 4.0, "Threshold should be at most 4.0");
  assert.equal(zscoreThreshold, 3.25, "With sensitivity 0.5, threshold should be 3.25");
});
