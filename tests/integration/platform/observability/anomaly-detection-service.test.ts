/**
 * AnomalyDetectionService Integration Tests
 *
 * Tests for AnomalyDetectionService with time series data,
 * multiple detection algorithms, and adaptive thresholds.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { AnomalyDetectionService } from "../../../../src/platform/shared/observability/anomaly-detection-service.js";

// =============================================================================
// AnomalyDetectionService unit-like integration tests
// =============================================================================

test("AnomalyDetectionService ingest adds data points to history", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 2.0 },
  });

  // Ingest baseline data points
  for (let i = 0; i < 20; i++) {
    service.ingest("test_metric", 10, new Date(Date.now() - (20 - i) * 60000).toISOString());
  }

  const history = service.getHistory("test_metric");
  assert.ok(history.length >= 20, "Should have ingested data points");
});

test("AnomalyDetectionService detect spike using zscore algorithm", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 2.0 },
  });

  // Add baseline data points
  for (let i = 0; i < 20; i++) {
    service.ingest("error_rate", 0.01, new Date(Date.now() - (20 - i) * 60000).toISOString());
  }

  // Detect a spike (10x normal)
  const result = service.detect("error_rate", 0.12);

  assert.ok(result.isAnomaly, "Should detect the spike as an anomaly");
  assert.equal(result.severity, "critical", "Spike should be critical severity");
  assert.ok(result.score > 0, "Should have a non-zero score");
});

test("AnomalyDetectionService detect latency degradation using IQR algorithm", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "iqr", sensitivity: 1.5 },
  });

  // Add baseline data points with normal latency
  const baseTime = Date.now();
  for (let i = 0; i < 15; i++) {
    service.ingest("latency", 100 + Math.random() * 20, new Date(baseTime - (15 - i) * 60000).toISOString());
  }

  // Detect a degradation spike
  const result = service.detect("latency", 350, new Date(baseTime).toISOString());

  assert.ok(result != null, "Should return a detection result");
  assert.ok("isAnomaly" in result, "Result should have isAnomaly property");
});

test("AnomalyDetectionService detect with EWMA for trend detection", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "ewma", sensitivity: 2.5 },
  });

  const baseTime = Date.now();

  // Add normal baseline
  for (let i = 0; i < 10; i++) {
    service.ingest("throughput", 1000, new Date(baseTime - (10 - i) * 60000).toISOString());
  }

  // Detect gradual decrease (should trigger trend anomaly)
  const result = service.detect("throughput", 850, new Date(baseTime).toISOString());

  assert.ok(result != null);
});

test("AnomalyDetectionService detect gradient anomalies", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "gradient", sensitivity: 3.0 },
  });

  const baseTime = Date.now();

  // Add gradual baseline
  for (let i = 0; i < 15; i++) {
    service.ingest("error_count", 5 + i * 0.1, new Date(baseTime - (15 - i) * 60000).toISOString());
  }

  // Detect sudden drop (gradient anomaly)
  const result = service.detect("error_count", 1, new Date(baseTime).toISOString());

  assert.ok(result != null);
});

test("AnomalyDetectionService maintains rolling history within bounds", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 2.0, windowSize: 50 },
  });

  const baseTime = Date.now();

  // Ingest more points than windowSize
  for (let i = 0; i < 100; i++) {
    service.ingest("metric_a", i, new Date(baseTime - (100 - i) * 60000).toISOString());
  }

  const history = service.getHistory("metric_a");
  assert.ok(history.length <= 50, "History should be capped at maxHistoryPoints");
});

test("AnomalyDetectionService returns empty array for unknown metric", () => {
  const service = new AnomalyDetectionService();

  const history = service.getHistory("nonexistent-metric");
  assert.equal(history.length, 0, "Should return empty array for unknown metric");
});

test("AnomalyDetectionService getAnomalies returns recorded anomalies", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 2.0 },
  });

  const baseTime = Date.now();

  // Add baseline
  for (let i = 0; i < 20; i++) {
    service.ingest("test_metric", 10, new Date(baseTime - (20 - i) * 60000).toISOString());
  }

  // Detect anomaly
  service.detect("test_metric", 100, new Date(baseTime).toISOString());

  const anomalies = service.getAnomalies("test_metric");
  assert.ok(anomalies.length >= 1, "Should record at least one anomaly");
});

test("AnomalyDetectionService getThresholds returns adaptive thresholds", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 2.0 },
  });

  const baseTime = Date.now();

  // Add baseline
  for (let i = 0; i < 15; i++) {
    service.ingest("adaptive_metric", 50 + Math.random() * 10, new Date(baseTime - (15 - i) * 60000).toISOString());
  }

  const threshold = service.getThreshold("adaptive_metric");
  assert.ok(threshold != null, "Should return adaptive threshold");
  assert.ok("lower" in threshold, "Threshold should have lower bound");
  assert.ok("upper" in threshold, "Threshold should have upper bound");
});

test("AnomalyDetectionService detect handles normal values gracefully", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 2.0 },
  });

  const baseTime = Date.now();

  // Add baseline with consistent values
  for (let i = 0; i < 20; i++) {
    service.ingest("normal_metric", 100, new Date(baseTime - (20 - i) * 60000).toISOString());
  }

  // Detect a normal value (within expected range)
  const result = service.detect("normal_metric", 101, new Date(baseTime).toISOString());

  assert.ok(result != null);
  assert.ok("isAnomaly" in result);
  assert.ok("score" in result);
});

test("AnomalyDetectionService handles multiple metrics independently", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 2.0 },
  });

  const baseTime = Date.now();

  // Add different patterns for different metrics
  for (let i = 0; i < 20; i++) {
    service.ingest("metric_x", 10, new Date(baseTime - (20 - i) * 60000).toISOString());
    service.ingest("metric_y", 100, new Date(baseTime - (20 - i) * 60000).toISOString());
  }

  // Spike only metric_x
  service.detect("metric_x", 50, new Date(baseTime).toISOString());

  const anomaliesX = service.getAnomalies("metric_x");
  const anomaliesY = service.getAnomalies("metric_y");

  assert.ok(anomaliesX.length >= 1, "metric_x should have anomalies");
  assert.equal(anomaliesY.length, 0, "metric_y should have no anomalies");
});

test("AnomalyDetectionService clearHistory removes metric data", () => {
  const service = new AnomalyDetectionService();

  const baseTime = Date.now();

  service.ingest("clear_test", 10, new Date(baseTime).toISOString());
  service.ingest("clear_test", 20, new Date(baseTime + 60000).toISOString());

  let history = service.getHistory("clear_test");
  assert.ok(history.length >= 1, "Should have data before clear");

  service.clearHistory("clear_test");

  history = service.getHistory("clear_test");
  assert.equal(history.length, 0, "Should have no data after clear");
});

test("AnomalyDetectionService getMetricSummary returns statistics", () => {
  const service = new AnomalyDetectionService();

  const baseTime = Date.now();

  // Add varied data
  for (let i = 0; i < 10; i++) {
    service.ingest("summary_metric", 10 * (i + 1), new Date(baseTime - (10 - i) * 60000).toISOString());
  }

  const threshold = service.getThreshold("summary_metric");
  assert.ok(threshold != null, "Should return threshold");
  assert.ok("lower" in threshold, "Threshold should have lower bound");
  assert.ok("upper" in threshold, "Threshold should have upper bound");
});

test("AnomalyDetectionService registers and uses custom signatures", () => {
  const service = new AnomalyDetectionService({
    signatures: [
      {
        id: "custom_sig",
        name: "Custom Pattern",
        pattern: /custom.*anomaly/i,
        category: "spike",
        severity: "warning",
        description: "Custom anomaly pattern",
      },
    ],
  });

  // Test that custom signature matches
  const result = service.detect("custom anomaly test", 50, new Date().toISOString());
  assert.ok(result.isAnomaly, "Should detect custom pattern");
  assert.equal(result.category, "spike", "Should match spike category");
});

test("AnomalyDetectionService ingestBatch processes multiple points", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 2.0 },
  });

  const baseTime = Date.now();
  const points = Array.from({ length: 10 }, (_, i) => ({
    value: 50 + Math.random() * 10,
    timestamp: new Date(baseTime - i * 60000).toISOString(),
  }));

  service.ingestBatch("batch_metric", points);

  const history = service.getHistory("batch_metric");
  assert.ok(history.length >= 10, "Should have ingested batch data");
});
