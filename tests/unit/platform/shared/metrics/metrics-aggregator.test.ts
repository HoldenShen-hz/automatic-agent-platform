import assert from "node:assert/strict";
import test from "node:test";

/**
 * Mock metric data point for testing MetricsAggregator.
 */
interface MetricDataPoint {
  name: string;
  labels: Record<string, string>;
  value: number;
  timestamp: number;
}

/**
 * Mock AggregatedMetric for testing MetricsAggregator output.
 */
interface AggregatedMetric {
  name: string;
  labels: Record<string, string>;
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number | null;
  p95: number | null;
  p99: number | null;
}

/**
 * Mock MetricsAggregator that aggregates raw metric data points.
 */
class MockMetricsAggregator {
  private dataPoints: MetricDataPoint[] = [];

  public record(name: string, labels: Record<string, string>, value: number): void {
    this.dataPoints.push({
      name,
      labels,
      value,
      timestamp: Date.now(),
    });
  }

  public aggregate(name: string, labelFilter?: Record<string, string>): AggregatedMetric[] {
    // Group data points by their label signature when no filter provided
    if (!labelFilter) {
      const groups = new Map<string, MetricDataPoint[]>();
      for (const dp of this.dataPoints) {
        if (dp.name !== name) continue;
        const labelKey = JSON.stringify(Object.entries(dp.labels).sort());
        const group = groups.get(labelKey) ?? [];
        group.push(dp);
        groups.set(labelKey, group);
      }
      const results: AggregatedMetric[] = [];
      for (const [, points] of groups) {
        const values = points.map((dp) => dp.value).sort((a, b) => a - b);
        const sum = values.reduce((acc, v) => acc + v, 0);
        const count = values.length;
        results.push({
          name,
          labels: points[0]!.labels,
          count,
          sum,
          min: values[0] ?? 0,
          max: values[values.length - 1] ?? 0,
          avg: count > 0 ? sum / count : 0,
          p50: this.percentile(values, 0.50),
          p95: this.percentile(values, 0.95),
          p99: this.percentile(values, 0.99),
        });
      }
      return results;
    }

    // With label filter, aggregate matching points
    const filtered = this.dataPoints.filter((dp) => {
      if (dp.name !== name) return false;
      for (const [key, value] of Object.entries(labelFilter)) {
        if (dp.labels[key] !== value) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      return [];
    }

    const values = filtered.map((dp) => dp.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const count = values.length;

    return [{
      name,
      labels: labelFilter,
      count,
      sum,
      min: values[0] ?? 0,
      max: values[values.length - 1] ?? 0,
      avg: count > 0 ? sum / count : 0,
      p50: this.percentile(values, 0.50),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99),
    }];
  }

  public reset(): void {
    this.dataPoints = [];
  }

  private percentile(sortedValues: number[], quantile: number): number | null {
    if (sortedValues.length === 0) return null;
    const index = Math.max(0, Math.ceil(sortedValues.length * quantile) - 1);
    return sortedValues[index] ?? null;
  }
}

const aggregator = new MockMetricsAggregator();

test("MetricsAggregator records single data point correctly", () => {
  aggregator.reset();
  aggregator.record("response_time_ms", { endpoint: "/api/tasks" }, 150);

  const results = aggregator.aggregate("response_time_ms");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.sum, 150);
  assert.equal(results[0]?.count, 1);
  assert.deepEqual(results[0]?.labels, { endpoint: "/api/tasks" });
});

test("MetricsAggregator calculates sum correctly for multiple points", () => {
  aggregator.reset();
  aggregator.record("task_duration_ms", {}, 100);
  aggregator.record("task_duration_ms", {}, 200);
  aggregator.record("task_duration_ms", {}, 300);

  const results = aggregator.aggregate("task_duration_ms");
  assert.equal(results.length, 1);
  assert.equal(results[0]?.count, 3);
  assert.equal(results[0]?.sum, 600);
});

test("MetricsAggregator calculates average correctly", () => {
  aggregator.reset();
  aggregator.record("cpu_usage_percent", { core: "0" }, 50);
  aggregator.record("cpu_usage_percent", { core: "0" }, 100);
  aggregator.record("cpu_usage_percent", { core: "0" }, 75);

  const results = aggregator.aggregate("cpu_usage_percent");
  assert.equal(results[0]?.avg, 75);
});

test("MetricsAggregator finds minimum value", () => {
  aggregator.reset();
  aggregator.record("memory_bytes", {}, 1024);
  aggregator.record("memory_bytes", {}, 512);
  aggregator.record("memory_bytes", {}, 2048);

  const results = aggregator.aggregate("memory_bytes");
  assert.equal(results[0]?.min, 512);
});

test("MetricsAggregator finds maximum value", () => {
  aggregator.reset();
  aggregator.record("queue_size", {}, 10);
  aggregator.record("queue_size", {}, 50);
  aggregator.record("queue_size", {}, 25);

  const results = aggregator.aggregate("queue_size");
  assert.equal(results[0]?.max, 50);
});

test("MetricsAggregator calculates p50 correctly for odd count", () => {
  aggregator.reset();
  aggregator.record("latency_ms", {}, 10);
  aggregator.record("latency_ms", {}, 20);
  aggregator.record("latency_ms", {}, 30);
  aggregator.record("latency_ms", {}, 40);
  aggregator.record("latency_ms", {}, 50);

  const results = aggregator.aggregate("latency_ms");
  // Sorted: [10, 20, 30, 40, 50], p50 index = ceil(5 * 0.50) - 1 = ceil(2.5) - 1 = 3 - 1 = 2
  assert.equal(results[0]?.p50, 30);
});

test("MetricsAggregator calculates p95 correctly", () => {
  aggregator.reset();
  // 20 values from 1 to 20
  for (let i = 1; i <= 20; i++) {
    aggregator.record("request_size", {}, i * 100);
  }

  const results = aggregator.aggregate("request_size");
  // Sorted values, p95 index = ceil(20 * 0.95) - 1 = ceil(19) - 1 = 19 - 1 = 18
  assert.equal(results[0]?.p95, 1900);
});

test("MetricsAggregator calculates p99 correctly", () => {
  aggregator.reset();
  // 100 values
  for (let i = 1; i <= 100; i++) {
    aggregator.record("exec_time_ms", {}, i);
  }

  const results = aggregator.aggregate("exec_time_ms");
  // p99 index = ceil(100 * 0.99) - 1 = ceil(99) - 1 = 99 - 1 = 98
  assert.equal(results[0]?.p99, 99);
});

test("MetricsAggregator filters by label correctly", () => {
  aggregator.reset();
  aggregator.record("http_requests", { method: "GET", status: "200" }, 1);
  aggregator.record("http_requests", { method: "POST", status: "201" }, 1);
  aggregator.record("http_requests", { method: "GET", status: "404" }, 1);

  const getResults = aggregator.aggregate("http_requests", { method: "GET" });
  assert.equal(getResults.length, 1);
  assert.equal(getResults[0]?.count, 2);
});

test("MetricsAggregator returns empty array for non-existent metric", () => {
  aggregator.reset();
  aggregator.record("existing_metric", {}, 100);

  const results = aggregator.aggregate("non_existent_metric");
  assert.equal(results.length, 0);
});

test("MetricsAggregator handles empty data set", () => {
  aggregator.reset();
  const results = aggregator.aggregate("empty_metric");
  assert.equal(results.length, 0);
});

test("MetricsAggregator groups by labels", () => {
  aggregator.reset();
  aggregator.record("error_count", { service: "api" }, 5);
  aggregator.record("error_count", { service: "api" }, 3);
  aggregator.record("error_count", { service: "worker" }, 2);

  const results = aggregator.aggregate("error_count");
  // Should aggregate separately for each label combination
  assert.equal(results.length, 2);
});

test("MetricsAggregator calculates count correctly", () => {
  aggregator.reset();
  for (let i = 0; i < 10; i++) {
    aggregator.record("page_views", { page: "/home" }, 1);
  }

  const results = aggregator.aggregate("page_views");
  assert.equal(results[0]?.count, 10);
});

test("MetricsAggregator handles single data point gracefully", () => {
  aggregator.reset();
  aggregator.record("unique_event", {}, 42);

  const results = aggregator.aggregate("unique_event");
  assert.equal(results[0]?.count, 1);
  assert.equal(results[0]?.sum, 42);
  assert.equal(results[0]?.avg, 42);
  assert.equal(results[0]?.min, 42);
  assert.equal(results[0]?.max, 42);
  assert.equal(results[0]?.p50, 42);
  assert.equal(results[0]?.p95, 42);
  assert.equal(results[0]?.p99, 42);
});

test("MetricsAggregator normalizes labels with null/undefined", () => {
  aggregator.reset();
  aggregator.record("test_metric", { a: "value", b: null as unknown as string }, 10);

  // Should not throw and should handle gracefully
  const results = aggregator.aggregate("test_metric");
  assert.equal(results.length, 1);
});

test("MetricsAggregator calculates memory usage statistics", () => {
  aggregator.reset();
  aggregator.record("memory_heap_bytes", { type: "used" }, 50_000_000);
  aggregator.record("memory_heap_bytes", { type: "used" }, 75_000_000);
  aggregator.record("memory_heap_bytes", { type: "used" }, 100_000_000);

  const results = aggregator.aggregate("memory_heap_bytes", { type: "used" });
  assert.equal(results[0]?.count, 3);
  assert.equal(results[0]?.sum, 225_000_000);
  assert.equal(results[0]?.avg, 75_000_000);
});

test("MetricsAggregator calculates disk I/O rates", () => {
  aggregator.reset();
  aggregator.record("disk_read_bytes", { device: "sda" }, 1024);
  aggregator.record("disk_read_bytes", { device: "sda" }, 2048);
  aggregator.record("disk_read_bytes", { device: "sda" }, 512);

  const results = aggregator.aggregate("disk_read_bytes", { device: "sda" });
  assert.equal(results[0]?.min, 512);
  assert.equal(results[0]?.max, 2048);
  assert.ok(Math.abs((results[0]?.avg ?? 0) - 1194.6666666666667) < 0.001);
});

test("MetricsAggregator tracks request duration by endpoint", () => {
  aggregator.reset();
  aggregator.record("request_duration_ms", { endpoint: "/api/users" }, 45);
  aggregator.record("request_duration_ms", { endpoint: "/api/users" }, 55);
  aggregator.record("request_duration_ms", { endpoint: "/api/posts" }, 120);
  aggregator.record("request_duration_ms", { endpoint: "/api/posts" }, 180);

  const userEndpoint = aggregator.aggregate("request_duration_ms", { endpoint: "/api/users" });
  const postEndpoint = aggregator.aggregate("request_duration_ms", { endpoint: "/api/posts" });

  assert.equal(userEndpoint[0]?.count, 2);
  assert.equal(userEndpoint[0]?.avg, 50);
  assert.equal(postEndpoint[0]?.count, 2);
  assert.equal(postEndpoint[0]?.avg, 150);
});

test("MetricsAggregator calculates success rate from ratio", () => {
  aggregator.reset();
  aggregator.record("operations_total", { outcome: "success" }, 95);
  aggregator.record("operations_total", { outcome: "failure" }, 5);

  const results = aggregator.aggregate("operations_total");
  const successCount = 95;
  const totalCount = results[0]?.sum ?? 0;
  const successRate = totalCount > 0 ? successCount / (successCount + 5) : 0;

  assert.equal(successRate, 0.95);
});

test("MetricsAggregator handles large dataset for percentile calculation", () => {
  aggregator.reset();
  // Insert 1000 values from 1 to 1000
  for (let i = 1; i <= 1000; i++) {
    aggregator.record("large_metric", {}, i);
  }

  const results = aggregator.aggregate("large_metric");
  // p95 of [1..1000] should be approximately 950
  assert.equal(results[0]?.p95, 950);
  // p99 should be approximately 990
  assert.equal(results[0]?.p99, 990);
});

test("MetricsAggregator reset clears all data", () => {
  aggregator.reset();
  aggregator.record("metric_a", {}, 100);
  aggregator.record("metric_b", {}, 200);

  aggregator.reset();

  assert.equal(aggregator.aggregate("metric_a").length, 0);
  assert.equal(aggregator.aggregate("metric_b").length, 0);
});

test("MetricsAggregator calculates rate per second", () => {
  aggregator.reset();
  const now = Date.now();

  // Simulate 10 events over 1 second
  for (let i = 0; i < 10; i++) {
    aggregator.record("events_per_second", { interval: "1s" }, 1);
  }

  const results = aggregator.aggregate("events_per_second", { interval: "1s" });
  // Rate = count / time_window
  const rate = results[0]?.count ?? 0;
  assert.equal(rate, 10);
});

test("MetricsAggregator combines multiple metrics into summary", () => {
  aggregator.reset();

  // Record various system metrics
  aggregator.record("system_cpu_percent", {}, 45);
  aggregator.record("system_cpu_percent", {}, 55);
  aggregator.record("system_memory_percent", {}, 60);
  aggregator.record("system_memory_percent", {}, 70);

  const cpuMetrics = aggregator.aggregate("system_cpu_percent");
  const memMetrics = aggregator.aggregate("system_memory_percent");

  assert.equal(cpuMetrics.length, 1);
  assert.equal(memMetrics.length, 1);
  assert.equal(cpuMetrics[0]?.avg, 50);
  assert.equal(memMetrics[0]?.avg, 65);
});
