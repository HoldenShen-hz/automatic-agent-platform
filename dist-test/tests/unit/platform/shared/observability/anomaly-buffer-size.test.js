import assert from "node:assert/strict";
import test from "node:test";
import { AnomalyDetectionService } from "../../../../../src/platform/shared/observability/anomaly-detection-service.js";
/**
 * [SYS-PERF-3.4] anomaly detection metricBuffer has size limit
 *
 * Background: The manual documents 20+ places use unbounded Map without deletion,
 * causing memory leaks over time. This test verifies the AnomalyDetectionService
 * uses BoundedCache for its metric history, preventing unbounded memory growth.
 *
 * The service uses BoundedCache<string, TimeSeriesPoint[]> with max 100 entries
 * for the history map. When ingesting many unique metric names, older entries
 * are evicted via FIFO policy.
 */
test("[SYS-PERF-3.4] anomaly detection metricBuffer has size limit", () => {
    const service = new AnomalyDetectionService();
    // Ingest 100,000 unique metrics - should not cause unbounded memory growth
    for (let i = 0; i < 100_000; i++) {
        service.ingest(`metric-${i}`, Math.random(), new Date().toISOString());
    }
    // BoundedCache has a size property - verify eviction policy keeps buffer bounded
    // The BoundedCache is configured with max 100 entries for metric history
    const bufferSize = service.history.size;
    assert.ok(bufferSize <= 10_000, `Buffer size ${bufferSize} exceeds limit — must have eviction policy`);
});
test("[SYS-PERF-3.4] metricBuffer eviction is FIFO (oldest entries removed)", () => {
    const service = new AnomalyDetectionService();
    // Ingest first metric and verify it has data
    service.ingest("first-metric", 100, new Date().toISOString());
    // Ingest many other metrics to trigger eviction
    for (let i = 0; i < 200; i++) {
        service.ingest(`other-metric-${i}`, Math.random(), new Date().toISOString());
    }
    // The first-metric should have been evicted due to FIFO eviction
    const firstMetricHistory = service.getHistory("first-metric");
    assert.equal(firstMetricHistory.length, 0, "Oldest metric should be evicted when buffer is full");
    // Recent metrics should still have data
    const recentMetricHistory = service.getHistory("other-metric-199");
    assert.ok(recentMetricHistory.length > 0, "Recent metrics should be retained after eviction");
});
test("[SYS-PERF-3.4] each metric series has bounded point count", () => {
    const service = new AnomalyDetectionService({
        config: { windowSize: 100, minDataPoints: 10 },
    });
    // Ingest many points for a single metric
    for (let i = 0; i < 5000; i++) {
        service.ingest("high-frequency-metric", i, new Date().toISOString());
    }
    // The series should be bounded to windowSize * 10 = 1000 points
    const history = service.getHistory("high-frequency-metric");
    const maxExpectedPoints = 100 * 10; // windowSize * 10
    assert.ok(history.length <= maxExpectedPoints, `History length ${history.length} exceeds max expected ${maxExpectedPoints}`);
});
//# sourceMappingURL=anomaly-buffer-size.test.js.map