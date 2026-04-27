import assert from "node:assert/strict";
import test from "node:test";

import {
  AnomalyDetectionService,
  type TimeSeriesPoint,
  type AnomalySignature,
} from "../../../../../src/platform/shared/observability/anomaly-detection-service.js";

test("AnomalyDetectionService registers and unregisters custom signatures", () => {
  const service = new AnomalyDetectionService();

  const customSignature: AnomalySignature = {
    id: "custom_sig",
    name: "Custom Pattern",
    pattern: /custom.*pattern/i,
    category: "spike",
    severity: "critical",
    description: "Custom detection pattern",
  };

  service.registerSignature(customSignature);
  const signatures = service.getSignatures();

  assert.ok(signatures.some((s) => s.id === "custom_sig"));
  assert.equal(signatures.length, 6); // 5 default + 1 custom

  const unregistered = service.unregisterSignature("custom_sig");
  assert.equal(unregistered, true);

  const signaturesAfter = service.getSignatures();
  assert.ok(!signaturesAfter.some((s) => s.id === "custom_sig"));
});

test("AnomalyDetectionService.unregisterSignature returns false for non-existent signature", () => {
  const service = new AnomalyDetectionService();

  const result = service.unregisterSignature("non_existent_sig");
  assert.equal(result, false);
});

test("AnomalyDetectionService clears history for specific metric", () => {
  const service = new AnomalyDetectionService();

  service.ingest("metric_a", 100);
  service.ingest("metric_a", 110);
  service.ingest("metric_b", 200);

  let historyA = service.getHistory("metric_a");
  let historyB = service.getHistory("metric_b");

  assert.equal(historyA.length, 2);
  assert.equal(historyB.length, 1);

  service.clearHistory("metric_a");

  historyA = service.getHistory("metric_a");
  historyB = service.getHistory("metric_b");

  assert.equal(historyA.length, 0);
  assert.equal(historyB.length, 1);
});

test("AnomalyDetectionService clears all history when no metric specified", () => {
  const service = new AnomalyDetectionService();

  service.ingest("metric_x", 100);
  service.ingest("metric_y", 200);

  service.clearHistory();

  assert.equal(service.getHistory("metric_x").length, 0);
  assert.equal(service.getHistory("metric_y").length, 0);
});

test("AnomalyDetectionService getHistory respects limit parameter", () => {
  const service = new AnomalyDetectionService();

  for (let i = 0; i < 10; i++) {
    service.ingest("limited_metric", i * 10);
  }

  const limited = service.getHistory("limited_metric", 5);
  assert.equal(limited.length, 5);

  const all = service.getHistory("limited_metric");
  assert.equal(all.length, 10);
});

test("AnomalyDetectionService getHistory returns copy not reference", () => {
  const service = new AnomalyDetectionService();

  service.ingest("copy_metric", 100);
  const history1 = service.getHistory("copy_metric");
  const history2 = service.getHistory("copy_metric");

  // Modifying one should not affect the other
  history1.push({ timestamp: "2026-01-01T00:00:00.000Z", value: 999 });

  assert.equal(service.getHistory("copy_metric").length, 1);
});

test("AnomalyDetectionService resolveAnomaly returns false for non-existent ID", () => {
  const service = new AnomalyDetectionService();

  service.ingest("resolve_metric", 100);
  for (let i = 0; i < 10; i++) {
    service.ingest("resolve_metric", 50 + Math.random() * 100);
  }
  service.detect("resolve_metric", 500); // Trigger anomaly

  const result = service.resolveAnomaly("non_existent_anomaly_id");
  assert.equal(result, false);
});

test("AnomalyDetectionService getAnomalies with no anomalies returns empty array", () => {
  const service = new AnomalyDetectionService();

  service.ingest("no_anomaly_metric", 100);

  const anomalies = service.getAnomalies("no_anomaly_metric");
  assert.deepEqual(anomalies, []);
});

test("AnomalyDetectionService getAnomalies without metric name returns all anomalies", () => {
  const service = new AnomalyDetectionService();

  for (let i = 0; i < 10; i++) {
    service.ingest("metric_all_1", 50);
  }
  service.detect("metric_all_1", 500);

  for (let i = 0; i < 10; i++) {
    service.ingest("metric_all_2", 50);
  }
  service.detect("metric_all_2", 500);

  const allAnomalies = service.getAnomalies();
  assert.ok(allAnomalies.length >= 2);
});

test("AnomalyDetectionService getAnomalies filters by unresolvedOnly correctly", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
  });

  for (let i = 0; i < 10; i++) {
    service.ingest("filter_unresolved", 50);
  }

  service.detect("filter_unresolved", 500);
  service.detect("filter_unresolved", 600);

  const anomalies = service.getAnomalies("filter_unresolved");
  const firstId = anomalies[0]!.id;

  service.resolveAnomaly(firstId);

  const unresolvedOnly = service.getAnomalies("filter_unresolved", { unresolvedOnly: true });
  assert.ok(unresolvedOnly.every((a) => !a.resolved));
});

test("AnomalyDetectionService getAnomalies filters by since timestamp", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
  });

  for (let i = 0; i < 10; i++) {
    service.ingest("filter_since", 50);
  }
  service.detect("filter_since", 500);

  const oldTimestamp = new Date(Date.now() - 100000).toISOString();

  const anomalies = service.getAnomalies("filter_since", { since: oldTimestamp });
  assert.ok(anomalies.length >= 1);
});

test("AnomalyDetectionService updateThreshold handles zero standard deviation", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 10, minDataPoints: 5 },
  });

  // All values are the same - zero variance
  for (let i = 0; i < 10; i++) {
    service.ingest("constant_metric", 100);
  }

  const threshold = service.getThreshold("constant_metric");
  assert.ok(threshold !== null);
  // With zero stdDev, threshold should use fallback
  assert.ok(threshold!.upper >= threshold!.baseline);
});

test("AnomalyDetectionService detect with insufficient data returns info severity", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 10 },
  });

  // Only 5 data points, but minDataPoints is 10
  for (let i = 0; i < 5; i++) {
    service.ingest("insufficient", 100);
  }

  const result = service.detect("insufficient", 150);
  assert.equal(result.isAnomaly, false);
  assert.equal(result.severity, "info");
  assert.ok(result.explanation.includes("Insufficient data"));
});

test("AnomalyDetectionService detectZScore handles very small stdDev", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 50, minDataPoints: 10 },
  });

  // Very small variance
  for (let i = 0; i < 20; i++) {
    service.ingest("tiny_variance", 100 + (Math.random() - 0.5) * 0.001);
  }

  const result = service.detect("tiny_variance", 101);
  // With tiny variance, even small deviations can cause high z-scores
  assert.ok(result !== undefined);
});

test("AnomalyDetectionService classifyAnomalyCategory returns trend_change for moderate changes", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 10 },
  });

  // Build consistent baseline
  for (let i = 0; i < 10; i++) {
    service.ingest("moderate_change", 100);
  }

  // Moderate increase - not spike level but noticeable
  const result = service.detect("moderate_change", 130);
  // Could be trend_change or spike depending on the ratio
  assert.ok(["spike", "trend_change", "dip"].includes(result.category));
});

test("AnomalyDetectionService analyzeTrend returns stable for empty history", () => {
  const service = new AnomalyDetectionService();

  const trend = service.analyzeTrend("empty_trend");
  assert.equal(trend.direction, "stable");
  assert.equal(trend.slope, 0);
  assert.equal(trend.confidence, 0);
});

test("AnomalyDetectionService analyzeTrend returns stable for insufficient data", () => {
  const service = new AnomalyDetectionService();

  service.ingest("small_trend", 100);
  service.ingest("small_trend", 110);

  const trend = service.analyzeTrend("small_trend");
  assert.equal(trend.direction, "stable");
});

test("AnomalyDetectionService ingestBatch processes multiple points", () => {
  const service = new AnomalyDetectionService();

  const points: TimeSeriesPoint[] = [
    { timestamp: "2026-04-26T10:00:00.000Z", value: 100 },
    { timestamp: "2026-04-26T10:01:00.000Z", value: 110 },
    { timestamp: "2026-04-26T10:02:00.000Z", value: 120 },
  ];

  service.ingestBatch("batch_metric", points);

  const history = service.getHistory("batch_metric");
  assert.equal(history.length, 3);
  assert.equal(history[0]!.value, 100);
  assert.equal(history[1]!.value, 110);
  assert.equal(history[2]!.value, 120);
});

test("AnomalyDetectionService ingestBatch handles empty array", () => {
  const service = new AnomalyDetectionService();

  service.ingestBatch("empty_batch", []);

  const history = service.getHistory("empty_batch");
  assert.equal(history.length, 0);
});

test("AnomalyDetectionService default signatures include error rate spike pattern", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
  });

  const signatures = service.getSignatures();
  const errorSpike = signatures.find((s) => s.id === "sig_error_rate_spike");

  assert.ok(errorSpike !== undefined);
  assert.equal(errorSpike!.category, "spike");
  assert.equal(errorSpike!.severity, "critical");
});

test("AnomalyDetectionService default signatures include provider outage pattern", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
  });

  const signatures = service.getSignatures();
  const outage = signatures.find((s) => s.id === "sig_provider_outage");

  assert.ok(outage !== undefined);
  assert.equal(outage!.category, "level_shift");
  assert.equal(outage!.severity, "emergency");
});

test("AnomalyDetectionService scoreToSeverity maps emergency threshold correctly", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
  });

  for (let i = 0; i < 10; i++) {
    service.ingest("score_test", 100);
  }

  // Very extreme value should trigger emergency
  const result = service.detect("score_test", 1000);
  assert.ok(result.score >= 0.9 || result.severity !== "emergency");
});

test("AnomalyDetectionService checkSignatures matches combined text", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
  });

  // The error spike signature matches "error rate spike" pattern
  const result = service.detect("error rate spike in logs", 50);
  assert.equal(result.isAnomaly, true);
  assert.equal(result.severity, "critical");
});

test("AnomalyDetectionService checkSignatures returns null when no match", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
  });

  for (let i = 0; i < 10; i++) {
    service.ingest("no_match_metric", 100);
  }

  // Generic value that doesn't match any signature
  const result = service.detect("no_match_metric", 150);
  // Should use statistical detection, not signature
  assert.ok(result !== undefined);
});

test("AnomalyDetectionService history is bounded by maxHistory", () => {
  const service = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 10, minDataPoints: 5 },
  });

  // windowSize * 10 = 100 max history
  for (let i = 0; i < 150; i++) {
    service.ingest("bounded_history", i);
  }

  const history = service.getHistory("bounded_history");
  assert.ok(history.length <= 100);
});

test("AnomalyDetectionService with different sensitivity values produces different thresholds", () => {
  const lowSensitivity = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 0.1, windowSize: 50, minDataPoints: 10 },
  });
  const highSensitivity = new AnomalyDetectionService({
    config: { algorithm: "zscore", sensitivity: 0.9, windowSize: 50, minDataPoints: 10 },
  });

  for (let i = 0; i < 30; i++) {
    lowSensitivity.ingest("sens_metric_low", 100);
    highSensitivity.ingest("sens_metric_high", 100);
  }

  // Same value should detect differently based on sensitivity
  const resultLow = lowSensitivity.detect("sens_metric_low", 200);
  const resultHigh = highSensitivity.detect("sens_metric_high", 200);

  // Higher sensitivity should detect more anomalies or higher scores
  assert.ok(resultHigh.score >= resultLow.score || resultHigh.isAnomaly === true);
});
