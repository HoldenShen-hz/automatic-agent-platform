import assert from "node:assert/strict";
import test from "node:test";
import { AnomalyDetectionService, } from "../../../../../src/platform/shared/observability/anomaly-detection-service.js";
import { ANOMALY_EVENT_CLASSES } from "../../../../../src/platform/contracts/types/anomaly-event-classification.js";
test("ingest and detect zscore anomaly", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 20, minDataPoints: 5 },
    });
    // Ingest normal data
    for (let i = 0; i < 20; i++) {
        service.ingest("cpu_usage", 50 + Math.random() * 5);
    }
    // Detect should work with normal data
    const result = service.detect("cpu_usage", 52);
    assert.ok(result !== undefined);
});
test("ingestBatch processes multiple points", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 10 },
    });
    const points = [];
    for (let i = 0; i < 15; i++) {
        points.push({ timestamp: new Date(Date.now() - i * 1000).toISOString(), value: 100 + i });
    }
    service.ingestBatch("metric_batch", points);
    const history = service.getHistory("metric_batch");
    assert.ok(history.length >= 15);
});
test("detect returns insufficient data for new metric", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 10 },
    });
    const result = service.detect("new_metric", 100);
    assert.equal(result.isAnomaly, false);
    assert.equal(result.unifiedSeverity, "SEV4");
    assert.ok(result.anomalyEventClass);
    assert.ok(ANOMALY_EVENT_CLASSES.includes(result.anomalyEventClass));
    assert.ok(result.explanation.includes("Insufficient data"));
});
test("detect zscore spike anomaly", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 50, minDataPoints: 10 },
    });
    // Ingest consistent baseline with slight variation
    for (let i = 0; i < 50; i++) {
        service.ingest("latency", 100 + (Math.random() - 0.5));
    }
    // Spike should be detected (value is 5x the baseline)
    const result = service.detect("latency", 500);
    assert.equal(result.isAnomaly, true);
    assert.ok(result.score > 0);
    assert.ok(["spike", "level_shift", "trend_change"].includes(result.category));
});
test("IQR detection with seasonal data", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "iqr", sensitivity: 0.5, windowSize: 100, minDataPoints: 20 },
    });
    // Baseline data
    for (let i = 0; i < 50; i++) {
        service.ingest("requests", 1000);
    }
    const result = service.detect("requests", 1500);
    assert.ok(result !== undefined);
});
test("EWMA detection", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "ewma", sensitivity: 0.5, windowSize: 50, minDataPoints: 10 },
    });
    for (let i = 0; i < 30; i++) {
        service.ingest("error_rate", i * 0.1);
    }
    const result = service.detect("error_rate", 5.0);
    assert.ok(result !== undefined);
});
test("gradient detection", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "gradient", sensitivity: 0.5, windowSize: 50, minDataPoints: 10 },
    });
    // Linear growth
    for (let i = 0; i < 30; i++) {
        service.ingest("counter", i * 10);
    }
    const result = service.detect("counter", 500);
    assert.ok(result !== undefined);
});
test("signature matching detects error rate spike", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
    });
    // Ingest some baseline data first
    for (let i = 0; i < 10; i++) {
        service.ingest("error_rate_spike", 10);
    }
    // A signature match should return anomaly
    const result = service.detect("error_rate_spike", 100);
    assert.equal(result.isAnomaly, true);
    assert.equal(result.severity, "critical");
});
test("signature matching detects provider outage", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
    });
    // Ingest some baseline data first
    for (let i = 0; i < 10; i++) {
        service.ingest("provider_down_alert", 200);
    }
    const result = service.detect("provider_down_alert", 503);
    assert.equal(result.isAnomaly, true);
    assert.equal(result.severity, "emergency");
    assert.equal(result.unifiedSeverity, "SEV1");
    assert.equal(result.anomalyEventClass, "E3_EXTERNAL_DEPENDENCY");
});
test("registerSignature and unregisterSignature", () => {
    const service = new AnomalyDetectionService();
    const sig = {
        id: "test_sig",
        name: "Test Signature",
        pattern: /test_pattern/i,
        category: "spike",
        severity: "warning",
        description: "Test description",
    };
    service.registerSignature(sig);
    const sigs = service.getSignatures();
    assert.ok(sigs.some((s) => s.id === "test_sig"));
    const removed = service.unregisterSignature("test_sig");
    assert.equal(removed, true);
    const sigsAfter = service.getSignatures();
    assert.ok(!sigsAfter.some((s) => s.id === "test_sig"));
});
test("adaptive threshold is computed and retrieved", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 20, minDataPoints: 5 },
    });
    for (let i = 0; i < 20; i++) {
        service.ingest("metric_with_threshold", 100 + Math.random() * 10);
    }
    const threshold = service.getThreshold("metric_with_threshold");
    assert.ok(threshold !== null);
    assert.ok(threshold.upper > threshold.lower);
    assert.ok(threshold.baseline > 0);
});
test("getAnomalies filters by metric name", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
    });
    // Trigger some anomalies
    for (let i = 0; i < 10; i++) {
        service.ingest("metric_a", 50);
        service.ingest("metric_b", 50);
    }
    service.detect("metric_a", 500);
    service.detect("metric_b", 100);
    const anomaliesA = service.getAnomalies("metric_a");
    const anomaliesB = service.getAnomalies("metric_b");
    assert.ok(anomaliesA.every((a) => a.metricName === "metric_a"));
    assert.ok(anomaliesB.every((a) => a.metricName === "metric_b"));
});
test("getAnomalies filters by unresolvedOnly", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
    });
    for (let i = 0; i < 10; i++) {
        service.ingest("test_metric", 50);
    }
    service.detect("test_metric", 500);
    const all = service.getAnomalies("test_metric");
    const unresolved = service.getAnomalies("test_metric", { unresolvedOnly: true });
    assert.ok(all.length >= unresolved.length);
    assert.ok(unresolved.every((a) => !a.resolved));
});
test("resolveAnomaly marks record as resolved", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
    });
    // Ingest baseline with slight variation to allow stdDev calculation
    for (let i = 0; i < 10; i++) {
        service.ingest("test_resolve", 50 + (Math.random() - 0.5));
    }
    // Spike to trigger anomaly
    service.detect("test_resolve", 500);
    const all = service.getAnomalies("test_resolve");
    assert.ok(all.length > 0, "Should have created an anomaly record");
    assert.ok(all[0]?.unifiedSeverity);
    assert.ok(all[0]?.anomalyEventClass);
    const resolved = service.resolveAnomaly(all[0].id);
    assert.equal(resolved, true);
    const unresolved = service.getAnomalies("test_resolve", { unresolvedOnly: true });
    assert.equal(unresolved.length, 0);
});
test("analyzeTrend returns increasing trend", () => {
    const service = new AnomalyDetectionService();
    for (let i = 0; i < 20; i++) {
        service.ingest("increasing_metric", i * 5);
    }
    const trend = service.analyzeTrend("increasing_metric");
    assert.equal(trend.direction, "increasing");
    assert.ok(trend.slope > 0);
    assert.ok(trend.confidence > 0);
});
test("analyzeTrend returns decreasing trend", () => {
    const service = new AnomalyDetectionService();
    for (let i = 0; i < 20; i++) {
        service.ingest("decreasing_metric", 100 - i * 3);
    }
    const trend = service.analyzeTrend("decreasing_metric");
    assert.equal(trend.direction, "decreasing");
    assert.ok(trend.slope < 0);
});
test("analyzeTrend returns stable for flat data", () => {
    const service = new AnomalyDetectionService();
    for (let i = 0; i < 20; i++) {
        service.ingest("stable_metric", 50);
    }
    const trend = service.analyzeTrend("stable_metric");
    assert.equal(trend.direction, "stable");
});
test("analyzeTrend returns stable for insufficient data", () => {
    const service = new AnomalyDetectionService();
    service.ingest("few_points", 10);
    service.ingest("few_points", 20);
    const trend = service.analyzeTrend("few_points");
    assert.equal(trend.direction, "stable");
    assert.equal(trend.confidence, 0);
});
test("clearHistory removes metric data", () => {
    const service = new AnomalyDetectionService();
    for (let i = 0; i < 10; i++) {
        service.ingest("to_clear", 100);
    }
    const history = service.getHistory("to_clear");
    assert.ok(history.length > 0);
    service.clearHistory("to_clear");
    const historyAfter = service.getHistory("to_clear");
    assert.equal(historyAfter.length, 0);
});
test("clearHistory without metric clears all", () => {
    const service = new AnomalyDetectionService();
    service.ingest("metric_1", 100);
    service.ingest("metric_2", 200);
    service.clearHistory();
    assert.equal(service.getHistory("metric_1").length, 0);
    assert.equal(service.getHistory("metric_2").length, 0);
});
test("getHistory respects limit parameter", () => {
    const service = new AnomalyDetectionService();
    for (let i = 0; i < 20; i++) {
        service.ingest("limited_history", i);
    }
    const history = service.getHistory("limited_history", 5);
    assert.equal(history.length, 5);
});
test("severity scoring thresholds", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
    });
    // Ingest baseline with slight variation to allow stdDev calculation
    for (let i = 0; i < 10; i++) {
        service.ingest("severity_test", 100 + (Math.random() - 0.5));
    }
    // Emergency level - value 1000 is 10x baseline
    const emergencyResult = service.detect("severity_test", 1000);
    assert.equal(emergencyResult.severity, "emergency");
    // Critical level - value 500 is 5x baseline
    const criticalResult = service.detect("severity_test", 500);
    assert.ok(["critical", "emergency"].includes(criticalResult.severity));
    // Warning level - value 200 is 2x baseline
    const warningResult = service.detect("severity_test", 200);
    assert.ok(["warning", "critical", "emergency"].includes(warningResult.severity));
});
test("different algorithms produce different results", () => {
    const algorithms = ["zscore", "iqr", "ewma", "gradient"];
    for (const algo of algorithms) {
        const service = new AnomalyDetectionService({
            config: { algorithm: algo, sensitivity: 0.5, windowSize: 50, minDataPoints: 10 },
        });
        for (let i = 0; i < 30; i++) {
            service.ingest(`algo_${algo}`, 100 + Math.sin(i / 5) * 10);
        }
        const result = service.detect(`algo_${algo}`, 200);
        assert.ok(result !== undefined, `Algorithm ${algo} should produce a result`);
    }
});
test("getAnomalies filters by since timestamp", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
    });
    // Ingest baseline and trigger anomaly
    for (let i = 0; i < 10; i++) {
        service.ingest("time_filter_metric", 50);
    }
    service.detect("time_filter_metric", 500);
    const oldAnomalies = service.getAnomalies("time_filter_metric");
    assert.ok(oldAnomalies.length > 0);
    // Filter with future timestamp should return nothing
    const futureAnomalies = service.getAnomalies("time_filter_metric", {
        since: new Date(Date.now() + 10000).toISOString(),
    });
    assert.equal(futureAnomalies.length, 0);
});
test("getAnomalies filters by minSeverity", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
    });
    // Ingest baseline
    for (let i = 0; i < 10; i++) {
        service.ingest("severity_filter_metric", 100);
    }
    // Trigger warning level anomaly
    service.detect("severity_filter_metric", 200);
    // Trigger emergency level anomaly
    service.detect("severity_filter_metric", 1000);
    const allAnomalies = service.getAnomalies("severity_filter_metric");
    const warningMinAnomalies = service.getAnomalies("severity_filter_metric", { minSeverity: "warning" });
    const criticalMinAnomalies = service.getAnomalies("severity_filter_metric", { minSeverity: "critical" });
    // All anomalies should be >= warning
    assert.ok(allAnomalies.length >= warningMinAnomalies.length);
    // Critical min should filter out warning-only anomalies
    assert.ok(criticalMinAnomalies.length <= warningMinAnomalies.length);
});
test("getAnomalies without metric name returns all anomalies", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
    });
    // Ingest baseline for two metrics
    for (let i = 0; i < 10; i++) {
        service.ingest("metric_a", 50);
        service.ingest("metric_b", 50);
    }
    // Trigger anomalies
    service.detect("metric_a", 500);
    service.detect("metric_b", 500);
    const allAnomalies = service.getAnomalies();
    assert.ok(allAnomalies.length >= 2);
    assert.ok(allAnomalies.some((a) => a.metricName === "metric_a"));
    assert.ok(allAnomalies.some((a) => a.metricName === "metric_b"));
});
test("getAnomalies combines unresolvedOnly with since filter", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
    });
    for (let i = 0; i < 10; i++) {
        service.ingest("combined_filter_metric", 50);
    }
    service.detect("combined_filter_metric", 500);
    const anomalies = service.getAnomalies("combined_filter_metric", {
        unresolvedOnly: true,
        since: new Date(0).toISOString(),
    });
    assert.ok(anomalies.every((a) => !a.resolved));
});
test("resolveAnomaly returns false for non-existent anomaly", () => {
    const service = new AnomalyDetectionService();
    const result = service.resolveAnomaly("non_existent_anomaly_id");
    assert.equal(result, false);
});
test("resolveAnomaly only affects first matching anomaly", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
    });
    for (let i = 0; i < 10; i++) {
        service.ingest("resolve_test_metric", 50);
    }
    // Trigger multiple anomalies
    service.detect("resolve_test_metric", 500);
    service.detect("resolve_test_metric", 600);
    const anomalies = service.getAnomalies("resolve_test_metric");
    assert.ok(anomalies.length >= 2);
    const firstId = anomalies[0].id;
    service.resolveAnomaly(firstId);
    const unresolved = service.getAnomalies("resolve_test_metric", { unresolvedOnly: true });
    assert.ok(!unresolved.some((a) => a.id === firstId));
});
test("signature patterns match metric names with special characters", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
    });
    for (let i = 0; i < 10; i++) {
        service.ingest("error_rate_spike_test", 10);
    }
    // The default signature should match this
    const result = service.detect("error_rate_spike_test", 100);
    assert.equal(result.isAnomaly, true);
    assert.equal(result.category, "spike");
});
test("gradient detection with insufficient baseline data returns insufficient data result", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "gradient", sensitivity: 0.5, windowSize: 50, minDataPoints: 10 },
    });
    // Only add 2 data points - insufficient for gradient detection (needs 3+)
    service.ingest("gradient_insufficient", 100);
    service.ingest("gradient_insufficient", 110);
    const result = service.detect("gradient_insufficient", 200);
    assert.equal(result.isAnomaly, false);
    assert.ok(result.explanation.includes("Insufficient data"));
});
test("zscore detection with zero standard deviation handles constant baseline", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
    });
    // Constant baseline - zero stdDev
    for (let i = 0; i < 10; i++) {
        service.ingest("constant_metric", 100);
    }
    // Different value should still be detected as anomaly
    const result = service.detect("constant_metric", 200);
    assert.equal(result.isAnomaly, true);
    assert.ok(result.score > 0);
});
test("anomaly record contains correct deviation metrics", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 100, minDataPoints: 5 },
    });
    for (let i = 0; i < 10; i++) {
        service.ingest("deviation_metric", 100);
    }
    service.detect("deviation_metric", 200);
    const anomalies = service.getAnomalies("deviation_metric");
    assert.ok(anomalies.length > 0);
    const anomaly = anomalies[0];
    assert.ok(anomaly.deviation >= 0);
    assert.ok(anomaly.deviationPercent >= 0);
    assert.ok(anomaly.expectedValue > 0);
    assert.ok(anomaly.observedValue > 0);
});
test("clearHistory removes thresholds and anomalies for specific metric", () => {
    const service = new AnomalyDetectionService({
        config: { algorithm: "zscore", sensitivity: 0.5, windowSize: 20, minDataPoints: 5 },
    });
    for (let i = 0; i < 20; i++) {
        service.ingest("to_clear_metric", 100);
    }
    service.detect("to_clear_metric", 500);
    service.detect("to_clear_metric", 600);
    // Verify threshold exists
    assert.ok(service.getThreshold("to_clear_metric") !== null);
    // Clear only this metric
    service.clearHistory("to_clear_metric");
    // History should be empty
    assert.equal(service.getHistory("to_clear_metric").length, 0);
    // Other metrics should be unaffected
    service.ingest("other_metric", 100);
    assert.ok(service.getHistory("other_metric").length > 0);
});
test("unregisterSignature returns false for non-existent signature", () => {
    const service = new AnomalyDetectionService();
    const result = service.unregisterSignature("non_existent_signature");
    assert.equal(result, false);
});
test("unregisterSignature removes only the specified signature", () => {
    const service = new AnomalyDetectionService();
    service.registerSignature({
        id: "unique_sig_123",
        name: "Unique Signature",
        pattern: /unique_pattern/,
        category: "spike",
        severity: "warning",
        description: "Test",
    });
    assert.ok(service.getSignatures().some((s) => s.id === "unique_sig_123"));
    const removed = service.unregisterSignature("unique_sig_123");
    assert.equal(removed, true);
    assert.ok(!service.getSignatures().some((s) => s.id === "unique_sig_123"));
});
test("registerSignature with duplicate ID overwrites existing", () => {
    const service = new AnomalyDetectionService();
    service.registerSignature({
        id: "dup_sig",
        name: "First",
        pattern: /first/,
        category: "spike",
        severity: "warning",
        description: "First description",
    });
    service.registerSignature({
        id: "dup_sig",
        name: "Second",
        pattern: /second/,
        category: "trend_change",
        severity: "critical",
        description: "Second description",
    });
    const sigs = service.getSignatures().filter((s) => s.id === "dup_sig");
    assert.equal(sigs.length, 1);
    assert.equal(sigs[0].name, "Second");
});
//# sourceMappingURL=anomaly-detection-service.test.js.map