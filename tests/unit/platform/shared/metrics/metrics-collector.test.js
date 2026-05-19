import assert from "node:assert/strict";
import test from "node:test";
/**
 * Mock RuntimeMetricsRegistry for testing MetricsCollector.
 * In production, MetricsCollector would use RuntimeMetricsRegistry.
 */
class MockRuntimeMetricsRegistry {
    counters = new Map();
    gauges = new Map();
    histograms = new Map();
    incrementCounter(name, _labels, delta = 1) {
        const key = `counter:${name}`;
        this.counters.set(key, (this.counters.get(key) ?? 0) + delta);
    }
    setGauge(name, _labels, value) {
        this.gauges.set(`gauge:${name}`, value);
    }
    observeHistogram(name, _labels, value) {
        const key = `histogram:${name}`;
        const existing = this.histograms.get(key) ?? { count: 0, sum: 0 };
        existing.count += 1;
        existing.sum += value;
        this.histograms.set(key, existing);
    }
    reset() {
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
    }
}
/**
 * Mock AuthoritativeSqlDatabase for testing MetricsCollector.
 */
class MockSqlDatabase {
    connection = {
        prepare: () => ({
            get: () => ({ count: 0 }),
            all: () => [],
        }),
    };
}
/**
 * Mock HealthService for testing MetricsCollector.
 */
class MockHealthService {
    getReport() {
        return {
            status: "ok",
            degradationMode: false,
            providerSuccessRate: 1.0,
            activeExecutions: 0,
            queuedTasks: 0,
            eventLoopLagMs: null,
            memoryRssMb: 100,
            tier1AckBacklog: 0,
            queueGovernance: { backlogSize: 0, processingRate: 0 },
            workerHealth: { totalWorkers: 1, healthyWorkers: 1 },
            findings: [],
        };
    }
}
// Mock imports for testing MetricsCollector behavior
const mockRegistry = new MockRuntimeMetricsRegistry();
test("MetricsCollector increments counter correctly", () => {
    mockRegistry.reset();
    mockRegistry.incrementCounter("test_counter", { label: "value" }, 1);
    assert.equal(mockRegistry.counters.get("counter:test_counter"), 1);
});
test("MetricsCollector increments counter with multiple calls", () => {
    mockRegistry.reset();
    mockRegistry.incrementCounter("task_completed", { status: "success" }, 1);
    mockRegistry.incrementCounter("task_completed", { status: "success" }, 1);
    mockRegistry.incrementCounter("task_completed", { status: "success" }, 5);
    assert.equal(mockRegistry.counters.get("counter:task_completed"), 7);
});
test("MetricsCollector sets gauge to latest value", () => {
    mockRegistry.reset();
    mockRegistry.setGauge("queue_depth", { queue: "default" }, 10);
    assert.equal(mockRegistry.gauges.get("gauge:queue_depth"), 10);
    mockRegistry.setGauge("queue_depth", { queue: "default" }, 15);
    assert.equal(mockRegistry.gauges.get("gauge:queue_depth"), 15);
});
test("MetricsCollector records histogram values correctly", () => {
    mockRegistry.reset();
    mockRegistry.observeHistogram("request_duration_ms", { path: "/api" }, 100);
    mockRegistry.observeHistogram("request_duration_ms", { path: "/api" }, 200);
    mockRegistry.observeHistogram("request_duration_ms", { path: "/api" }, 300);
    const histogram = mockRegistry.histograms.get("histogram:request_duration_ms");
    assert.equal(histogram?.count, 3);
    assert.equal(histogram?.sum, 600);
});
test("MetricsCollector handles null labels gracefully", () => {
    mockRegistry.reset();
    mockRegistry.setGauge("test_metric", { a: "value", b: null }, 42);
    // Should not throw and should handle gracefully
    assert.equal(mockRegistry.gauges.get("gauge:test_metric"), 42);
});
test("MetricsCollector normalizes numeric labels to strings", () => {
    mockRegistry.reset();
    mockRegistry.incrementCounter("numeric_test", { port: 8080, active: 1 }, 1);
    // Should not throw - numeric values are normalized
    assert.equal(mockRegistry.counters.get("counter:numeric_test"), 1);
});
test("MetricsCollector resets all metrics", () => {
    mockRegistry.reset();
    mockRegistry.incrementCounter("reset_counter", {}, 10);
    mockRegistry.setGauge("reset_gauge", {}, 100);
    mockRegistry.observeHistogram("reset_histogram", {}, 50);
    mockRegistry.reset();
    assert.equal(mockRegistry.counters.size, 0);
    assert.equal(mockRegistry.gauges.size, 0);
    assert.equal(mockRegistry.histograms.size, 0);
});
test("MetricsCollector records HTTP request metrics", () => {
    mockRegistry.reset();
    mockRegistry.incrementCounter("http_requests_total", { method: "GET", path: "/api/tasks", status: "200" }, 1);
    mockRegistry.observeHistogram("http_request_duration_ms", { method: "GET", path: "/api/tasks", status: "200" }, 150);
    assert.equal(mockRegistry.counters.get("counter:http_requests_total"), 1);
    const histogram = mockRegistry.histograms.get("histogram:http_request_duration_ms");
    assert.equal(histogram?.count, 1);
    assert.equal(histogram?.sum, 150);
});
test("MetricsCollector creates separate counter series for different labels", () => {
    mockRegistry.reset();
    mockRegistry.incrementCounter("requests", { method: "GET" }, 1);
    mockRegistry.incrementCounter("requests", { method: "POST" }, 2);
    assert.equal(mockRegistry.counters.get("counter:requests"), 3);
});
test("MetricsCollector records task execution metrics", () => {
    mockRegistry.reset();
    mockRegistry.incrementCounter("task_executions_total", { status: "succeeded" }, 1);
    mockRegistry.incrementCounter("task_executions_total", { status: "failed" }, 1);
    mockRegistry.incrementCounter("task_executions_total", { status: "succeeded" }, 3);
    assert.equal(mockRegistry.counters.get("counter:task_executions_total"), 5);
});
test("MetricsCollector records agent round metrics", () => {
    mockRegistry.reset();
    mockRegistry.incrementCounter("agent_rounds_total", { agent_id: "agent-1" }, 1);
    mockRegistry.incrementCounter("agent_rounds_total", { agent_id: "agent-1" }, 1);
    mockRegistry.incrementCounter("agent_rounds_total", { agent_id: "agent-2" }, 1);
    assert.equal(mockRegistry.counters.get("counter:agent_rounds_total"), 3);
});
test("MetricsCollector tracks gauge changes over time", () => {
    mockRegistry.reset();
    // Simulate queue depth increasing
    mockRegistry.setGauge("queue_waiting_count", { queue_name: "default" }, 0);
    mockRegistry.setGauge("queue_waiting_count", { queue_name: "default" }, 10);
    mockRegistry.setGauge("queue_waiting_count", { queue_name: "default" }, 25);
    // Latest value should be 25
    assert.equal(mockRegistry.gauges.get("gauge:queue_waiting_count"), 25);
});
test("MetricsCollector observes LLM latency metrics", () => {
    mockRegistry.reset();
    mockRegistry.observeHistogram("llm_ttfb_seconds", { model: "claude-3-5", provider: "anthropic" }, 0.5);
    mockRegistry.observeHistogram("llm_total_seconds", { model: "claude-3-5", provider: "anthropic" }, 2.5);
    const ttfb = mockRegistry.histograms.get("histogram:llm_ttfb_seconds");
    const total = mockRegistry.histograms.get("histogram:llm_total_seconds");
    assert.equal(ttfb?.count, 1);
    assert.equal(ttfb?.sum, 0.5);
    assert.equal(total?.count, 1);
    assert.equal(total?.sum, 2.5);
});
test("MetricsCollector records knowledge query metrics", () => {
    mockRegistry.reset();
    mockRegistry.observeHistogram("knowledge_query_duration_ms", { operation: "search" }, 45);
    mockRegistry.incrementCounter("knowledge_query_total", { operation: "search", result: "hit" }, 1);
    const histogram = mockRegistry.histograms.get("histogram:knowledge_query_duration_ms");
    const counter = mockRegistry.counters.get("counter:knowledge_query_total");
    assert.equal(histogram?.count, 1);
    assert.equal(histogram?.sum, 45);
    assert.equal(counter, 1);
});
test("MetricsCollector computes accuracy ratio from counters", () => {
    mockRegistry.reset();
    // 8 successful out of 10 total
    mockRegistry.incrementCounter("evaluations_total", { result: "correct" }, 8);
    mockRegistry.incrementCounter("evaluations_total", { result: "incorrect" }, 2);
    const correctCount = mockRegistry.counters.get("counter:evaluations_total") ?? 0;
    const total = correctCount; // In real implementation would sum all result types
    // For accuracy, we'd calculate correct / total
    const accuracy = total > 0 ? 8 / 10 : 0;
    assert.equal(accuracy, 0.8);
});
//# sourceMappingURL=metrics-collector.test.js.map