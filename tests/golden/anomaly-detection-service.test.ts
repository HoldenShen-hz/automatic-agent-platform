/**
 * Golden Test: Anomaly Detection Service Output
 *
 * Verifies anomaly detection service produces consistent detection results,
 * trend analysis, and anomaly records for time series metrics.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  AnomalyDetectionService,
  type TimeSeriesPoint,
} from "../../src/platform/shared/observability/anomaly-detection-service.js";
import { assertGolden } from "../helpers/golden.js";

test("golden: anomaly detection with zscore algorithm detects normal values", () => {
  const service = new AnomalyDetectionService({
    config: {
      algorithm: "zscore",
      sensitivity: 0.5,
      windowSize: 10,
      minDataPoints: 3,
    },
  });

  // Ingest baseline data points
  const baseline: TimeSeriesPoint[] = [
    { timestamp: "2026-04-27T10:00:00Z", value: 100 },
    { timestamp: "2026-04-27T10:01:00Z", value: 102 },
    { timestamp: "2026-04-27T10:02:00Z", value: 98 },
    { timestamp: "2026-04-27T10:03:00Z", value: 101 },
    { timestamp: "2026-04-27T10:04:00Z", value: 99 },
    { timestamp: "2026-04-27T10:05:00Z", value: 100 },
    { timestamp: "2026-04-27T10:06:00Z", value: 101 },
    { timestamp: "2026-04-27T10:07:00Z", value: 99 },
    { timestamp: "2026-04-27T10:08:00Z", value: 100 },
    { timestamp: "2026-04-27T10:09:00Z", value: 102 },
  ];
  service.ingestBatch("cpu_usage", baseline);

  // Test a normal value
  const result = service.detect("cpu_usage", 101, "2026-04-27T10:10:00Z");

  assert.ok(result, "Detection result should exist");
  assert.ok(typeof result.isAnomaly === "boolean", "isAnomaly should be boolean");
  assert.ok(typeof result.score === "number", "Score should be number");
  assert.ok(typeof result.severity === "string", "Severity should be string");
  assert.ok(typeof result.category === "string", "Category should be string");
  assert.ok(typeof result.expectedValue === "number", "Expected value should be number");
  assert.ok(typeof result.deviation === "number", "Deviation should be number");
  assert.ok(typeof result.explanation === "string", "Explanation should be string");

  assertGolden("anomaly-detection-zscore-normal", {
    isAnomaly: result.isAnomaly,
    score: result.score,
    severity: result.severity,
    category: result.category,
    expectedValue: result.expectedValue,
    deviation: result.deviation,
    hasExplanation: result.explanation.length > 0,
  });
});

test("golden: anomaly detection with zscore algorithm detects anomaly spike", () => {
  const service = new AnomalyDetectionService({
    config: {
      algorithm: "zscore",
      sensitivity: 0.5,
      windowSize: 10,
      minDataPoints: 3,
    },
  });

  // Ingest baseline data points
  const baseline: TimeSeriesPoint[] = [
    { timestamp: "2026-04-27T10:00:00Z", value: 100 },
    { timestamp: "2026-04-27T10:01:00Z", value: 102 },
    { timestamp: "2026-04-27T10:02:00Z", value: 98 },
    { timestamp: "2026-04-27T10:03:00Z", value: 101 },
    { timestamp: "2026-04-27T10:04:00Z", value: 99 },
    { timestamp: "2026-04-27T10:05:00Z", value: 100 },
    { timestamp: "2026-04-27T10:06:00Z", value: 101 },
    { timestamp: "2026-04-27T10:07:00Z", value: 99 },
    { timestamp: "2026-04-27T10:08:00Z", value: 100 },
    { timestamp: "2026-04-27T10:09:00Z", value: 102 },
  ];
  service.ingestBatch("cpu_usage", baseline);

  // Test an anomalous spike value
  const result = service.detect("cpu_usage", 200, "2026-04-27T10:10:00Z");

  assert.ok(result.isAnomaly === true || result.isAnomaly === false, "isAnomaly should be boolean");

  assertGolden("anomaly-detection-zscore-spike", {
    isAnomaly: result.isAnomaly,
    score: result.score,
    severity: result.severity,
    category: result.category,
    deviation: result.deviation,
    deviationPercent: result.deviationPercent,
  });
});

test("golden: anomaly detection with IQR algorithm detects outliers", () => {
  const service = new AnomalyDetectionService({
    config: {
      algorithm: "iqr",
      sensitivity: 0.5,
      windowSize: 10,
      minDataPoints: 3,
    },
  });

  // Ingest baseline data points
  const baseline: TimeSeriesPoint[] = [
    { timestamp: "2026-04-27T10:00:00Z", value: 10 },
    { timestamp: "2026-04-27T10:01:00Z", value: 11 },
    { timestamp: "2026-04-27T10:02:00Z", value: 10 },
    { timestamp: "2026-04-27T10:03:00Z", value: 11 },
    { timestamp: "2026-04-27T10:04:00Z", value: 10 },
    { timestamp: "2026-04-27T10:05:00Z", value: 11 },
    { timestamp: "2026-04-27T10:06:00Z", value: 10 },
    { timestamp: "2026-04-27T10:07:00Z", value: 11 },
    { timestamp: "2026-04-27T10:08:00Z", value: 10 },
    { timestamp: "2026-04-27T10:09:00Z", value: 11 },
  ];
  service.ingestBatch("error_rate", baseline);

  // Test normal and outlier values
  const normalResult = service.detect("error_rate", 11, "2026-04-27T10:10:00Z");
  const outlierResult = service.detect("error_rate", 50, "2026-04-27T10:10:00Z");

  assertGolden("anomaly-detection-iqr-normal", {
    isAnomaly: normalResult.isAnomaly,
    severity: normalResult.severity,
    category: normalResult.category,
  });

  assertGolden("anomaly-detection-iqr-outlier", {
    isAnomaly: outlierResult.isAnomaly,
    severity: outlierResult.severity,
    category: outlierResult.category,
    score: outlierResult.score,
  });
});

test("golden: anomaly detection with EWMA algorithm handles trend changes", () => {
  const service = new AnomalyDetectionService({
    config: {
      algorithm: "ewma",
      sensitivity: 0.5,
      windowSize: 10,
      minDataPoints: 3,
    },
  });

  // Ingest baseline data points
  const baseline: TimeSeriesPoint[] = [
    { timestamp: "2026-04-27T10:00:00Z", value: 50 },
    { timestamp: "2026-04-27T10:01:00Z", value: 51 },
    { timestamp: "2026-04-27T10:02:00Z", value: 50 },
    { timestamp: "2026-04-27T10:03:00Z", value: 51 },
    { timestamp: "2026-04-27T10:04:00Z", value: 50 },
    { timestamp: "2026-04-27T10:05:00Z", value: 51 },
    { timestamp: "2026-04-27T10:06:00Z", value: 50 },
    { timestamp: "2026-04-27T10:07:00Z", value: 51 },
    { timestamp: "2026-04-27T10:08:00Z", value: 50 },
    { timestamp: "2026-04-27T10:09:00Z", value: 51 },
  ];
  service.ingestBatch("latency_ms", baseline);

  // Test a sudden spike
  const spikeResult = service.detect("latency_ms", 200, "2026-04-27T10:10:00Z");

  assertGolden("anomaly-detection-ewma-spike", {
    isAnomaly: spikeResult.isAnomaly,
    score: spikeResult.score,
    severity: spikeResult.severity,
    category: spikeResult.category,
    expectedValue: spikeResult.expectedValue,
  });
});

test("golden: anomaly detection with gradient algorithm detects sudden changes", () => {
  const service = new AnomalyDetectionService({
    config: {
      algorithm: "gradient",
      sensitivity: 0.5,
      windowSize: 10,
      minDataPoints: 3,
    },
  });

  // Ingest gradually increasing data
  const baseline: TimeSeriesPoint[] = [
    { timestamp: "2026-04-27T10:00:00Z", value: 100 },
    { timestamp: "2026-04-27T10:01:00Z", value: 101 },
    { timestamp: "2026-04-27T10:02:00Z", value: 102 },
    { timestamp: "2026-04-27T10:03:00Z", value: 103 },
    { timestamp: "2026-04-27T10:04:00Z", value: 104 },
    { timestamp: "2026-04-27T10:05:00Z", value: 105 },
    { timestamp: "2026-04-27T10:06:00Z", value: 106 },
    { timestamp: "2026-04-27T10:07:00Z", value: 107 },
    { timestamp: "2026-04-27T10:08:00Z", value: 108 },
    { timestamp: "2026-04-27T10:09:00Z", value: 109 },
  ];
  service.ingestBatch("throughput", baseline);

  // Test a value that breaks the gradient
  const result = service.detect("throughput", 50, "2026-04-27T10:10:00Z");

  assertGolden("anomaly-detection-gradient-break", {
    isAnomaly: result.isAnomaly,
    score: result.score,
    severity: result.severity,
    category: result.category,
  });
});

test("golden: anomaly detection insufficient data returns info severity", () => {
  const service = new AnomalyDetectionService({
    config: {
      algorithm: "zscore",
      sensitivity: 0.5,
      windowSize: 10,
      minDataPoints: 5,
    },
  });

  // Only ingest a few points (less than minDataPoints)
  service.ingest("request_count", 10, "2026-04-27T10:00:00Z");
  service.ingest("request_count", 11, "2026-04-27T10:01:00Z");
  service.ingest("request_count", 10, "2026-04-27T10:02:00Z");

  const result = service.detect("request_count", 15, "2026-04-27T10:03:00Z");

  assert.ok(result.isAnomaly === false, "Should not be anomaly with insufficient data");
  assert.ok(result.severity === "info", "Should be info severity with insufficient data");

  assertGolden("anomaly-detection-insufficient-data", {
    isAnomaly: result.isAnomaly,
    score: result.score,
    severity: result.severity,
    category: result.category,
    hasInsufficientDataMessage: result.explanation.includes("Insufficient data"),
  });
});

test("golden: anomaly detection trend analysis returns direction and confidence", () => {
  const service = new AnomalyDetectionService({
    config: {
      algorithm: "zscore",
      sensitivity: 0.5,
      windowSize: 10,
      minDataPoints: 3,
    },
  });

  // Ingest increasing trend data
  const increasingTrend: TimeSeriesPoint[] = [
    { timestamp: "2026-04-27T10:00:00Z", value: 100 },
    { timestamp: "2026-04-27T10:01:00Z", value: 110 },
    { timestamp: "2026-04-27T10:02:00Z", value: 120 },
    { timestamp: "2026-04-27T10:03:00Z", value: 130 },
    { timestamp: "2026-04-27T10:04:00Z", value: 140 },
    { timestamp: "2026-04-27T10:05:00Z", value: 150 },
    { timestamp: "2026-04-27T10:06:00Z", value: 160 },
    { timestamp: "2026-04-27T10:07:00Z", value: 170 },
    { timestamp: "2026-04-27T10:08:00Z", value: 180 },
    { timestamp: "2026-04-27T10:09:00Z", value: 190 },
  ];
  service.ingestBatch("memory_growth", increasingTrend);

  const trend = service.analyzeTrend("memory_growth");

  assert.ok(trend, "Trend analysis should exist");
  assert.ok(["increasing", "decreasing", "stable"].includes(trend.direction), "Direction should be valid");
  assert.ok(typeof trend.slope === "number", "Slope should be number");
  assert.ok(typeof trend.confidence === "number", "Confidence should be number");
  assert.ok(trend.confidence >= 0 && trend.confidence <= 1, "Confidence should be 0-1");

  assertGolden("anomaly-detection-trend-increasing", {
    direction: trend.direction,
    slope: trend.slope,
    confidence: trend.confidence,
  });
});

test("golden: anomaly detection history and threshold retrieval", () => {
  const service = new AnomalyDetectionService({
    config: {
      algorithm: "zscore",
      sensitivity: 0.5,
      windowSize: 5,
      minDataPoints: 3,
    },
  });

  const baseline: TimeSeriesPoint[] = [
    { timestamp: "2026-04-27T10:00:00Z", value: 100 },
    { timestamp: "2026-04-27T10:01:00Z", value: 102 },
    { timestamp: "2026-04-27T10:02:00Z", value: 98 },
    { timestamp: "2026-04-27T10:03:00Z", value: 101 },
    { timestamp: "2026-04-27T10:04:00Z", value: 99 },
  ];
  service.ingestBatch("request_size", baseline);

  // Trigger threshold computation by detecting
  service.detect("request_size", 100, "2026-04-27T10:05:00Z");

  const history = service.getHistory("request_size");
  const threshold = service.getThreshold("request_size");

  assert.ok(Array.isArray(history), "History should be array");
  assert.ok(history.length > 0, "History should have entries");

  assertGolden("anomaly-detection-history-threshold", {
    historyLength: history.length,
    hasThreshold: threshold !== null,
    thresholdUpper: threshold?.upper,
    thresholdLower: threshold?.lower,
    thresholdBaseline: threshold?.baseline,
  });
});

test("golden: anomaly detection signature patterns match", () => {
  const service = new AnomalyDetectionService({
    config: {
      algorithm: "zscore",
      sensitivity: 0.5,
      windowSize: 10,
      minDataPoints: 3,
    },
  });

  // Test with a metric/value that matches default signature patterns
  // The error_rate_spike signature matches patterns like "error.*rate.*spike"
  const result = service.detect("error_rate_spike", 500, "2026-04-27T10:00:00Z");

  // Signature patterns should match regardless of statistical detection
  assert.ok(typeof result.isAnomaly === "boolean", "Should have detection result");

  assertGolden("anomaly-detection-signature-match", {
    isAnomaly: result.isAnomaly,
    score: result.score,
    severity: result.severity,
    category: result.category,
    hasSignatureMatch: result.explanation.includes("signature"),
  });
});

test("golden: anomaly detection getAnomalies filters correctly", () => {
  const service = new AnomalyDetectionService({
    config: {
      algorithm: "zscore",
      sensitivity: 0.5,
      windowSize: 5,
      minDataPoints: 3,
    },
  });

  // Ingest baseline
  const baseline: TimeSeriesPoint[] = [
    { timestamp: "2026-04-27T10:00:00Z", value: 100 },
    { timestamp: "2026-04-27T10:01:00Z", value: 102 },
    { timestamp: "2026-04-27T10:02:00Z", value: 98 },
    { timestamp: "2026-04-27T10:03:00Z", value: 101 },
    { timestamp: "2026-04-27T10:04:00Z", value: 99 },
  ];
  service.ingestBatch("test_metric", baseline);

  // Detect an anomaly first
  service.detect("test_metric", 300, "2026-04-27T10:05:00Z");

  const allAnomalies = service.getAnomalies();
  const metricAnomalies = service.getAnomalies("test_metric");
  const unresolvedAnomalies = service.getAnomalies(undefined, { unresolvedOnly: true });

  assert.ok(Array.isArray(allAnomalies), "Should return array");
  assert.ok(Array.isArray(metricAnomalies), "Should return array for specific metric");
  assert.ok(Array.isArray(unresolvedAnomalies), "Should return array for unresolved");

  assertGolden("anomaly-detection-get-anomalies", {
    allAnomalyCount: allAnomalies.length,
    metricAnomalyCount: metricAnomalies.length,
    unresolvedAnomalyCount: unresolvedAnomalies.length,
  });
});

test("golden: anomaly detection clear history works", () => {
  const service = new AnomalyDetectionService({
    config: {
      algorithm: "zscore",
      sensitivity: 0.5,
      windowSize: 10,
      minDataPoints: 3,
    },
  });

  // Ingest baseline
  const baseline: TimeSeriesPoint[] = [
    { timestamp: "2026-04-27T10:00:00Z", value: 100 },
    { timestamp: "2026-04-27T10:01:00Z", value: 102 },
    { timestamp: "2026-04-27T10:02:00Z", value: 98 },
    { timestamp: "2026-04-27T10:03:00Z", value: 101 },
    { timestamp: "2026-04-27T10:04:00Z", value: 99 },
  ];
  service.ingestBatch("cpu_usage", baseline);
  service.ingestBatch("memory_usage", baseline);

  // Verify history exists
  const historyBefore = service.getHistory("cpu_usage");
  assert.ok(historyBefore.length > 0, "Should have history before clear");

  // Clear specific metric
  service.clearHistory("cpu_usage");

  const cpuHistoryAfter = service.getHistory("cpu_usage");
  const memoryHistoryAfter = service.getHistory("memory_usage");

  assert.ok(cpuHistoryAfter.length === 0, "cpu_usage history should be cleared");
  assert.ok(memoryHistoryAfter.length > 0, "memory_usage history should remain");

  // Clear all
  service.clearHistory();

  const allAfterClear = service.getHistory("memory_usage");
  assert.ok(allAfterClear.length === 0, "All history should be cleared");

  assertGolden("anomaly-detection-clear-history", {
    cpuHistoryAfterClear: cpuHistoryAfter.length,
    memoryHistoryAfterPartialClear: memoryHistoryAfter.length,
    allAfterClear: allAfterClear.length,
  });
});
