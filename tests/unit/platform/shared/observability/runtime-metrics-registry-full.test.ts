/**
 * Unit tests for RuntimeMetricsRegistry - counters, gauges, and histograms
 */

import assert from "node:assert/strict";
import test from "node:test";
import { RuntimeMetricsRegistry } from "../../../../../src/platform/shared/observability/runtime-metrics-registry.js";

test("incrementCounter creates new counter when not exists", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.incrementCounter("requests_total", { method: "GET" }, 1);

  const counters = registry.getCounters("requests_total");
  assert.equal(counters.length, 1);
  assert.equal(counters[0]!.value, 1);
  assert.deepEqual(counters[0]!.labels, { method: "GET" });
});

test("incrementCounter accumulates value for same labels", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.incrementCounter("requests_total", { method: "GET" }, 1);
  registry.incrementCounter("requests_total", { method: "GET" }, 2);
  registry.incrementCounter("requests_total", { method: "POST" }, 1);

  const counters = registry.getCounters("requests_total");
  assert.equal(counters.length, 2);

  const getCounter = counters.find((c) => c.labels.method === "GET");
  assert.ok(getCounter !== undefined);
  assert.equal(getCounter.value, 3);

  const postCounter = counters.find((c) => c.labels.method === "POST");
  assert.ok(postCounter !== undefined);
  assert.equal(postCounter.value, 1);
});

test("incrementCounter handles null and undefined labels", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.incrementCounter("test_metric", { a: "value", b: null as any, c: undefined as any }, 1);

  const counters = registry.getCounters("test_metric");
  assert.equal(counters.length, 1);
  assert.deepEqual(counters[0]!.labels, { a: "value" });
});

test("incrementCounter handles number and boolean labels", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.incrementCounter("test_metric", { count: 42, enabled: true, active: false as any }, 1);

  const counters = registry.getCounters("test_metric");
  assert.equal(counters.length, 1);
  assert.deepEqual(counters[0]!.labels, { count: "42", enabled: "true", active: "false" });
});

test("setGauge creates or updates gauge", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.setGauge("cpu_usage", { core: "0" }, 75.5);
  registry.setGauge("cpu_usage", { core: "1" }, 80.0);
  registry.setGauge("cpu_usage", { core: "0" }, 78.0);

  const gauges = registry.getGauges("cpu_usage");
  assert.equal(gauges.length, 2);

  const core0Gauge = gauges.find((g) => g.labels.core === "0");
  assert.ok(core0Gauge !== undefined);
  assert.equal(core0Gauge.value, 78.0);
});

test("observeHistogram creates histogram and tracks buckets", () => {
  const registry = new RuntimeMetricsRegistry();
  const customBuckets = [10, 50, 100, 500];

  registry.observeHistogram("request_duration_ms", { path: "/api" }, 25, customBuckets);
  registry.observeHistogram("request_duration_ms", { path: "/api" }, 75, customBuckets);
  registry.observeHistogram("request_duration_ms", { path: "/api" }, 150, customBuckets);

  const histograms = registry.getHistograms("request_duration_ms");
  assert.equal(histograms.length, 1);

  const h = histograms[0]!;
  assert.equal(h.count, 3);
  assert.equal(h.sum, 250);
  assert.deepEqual(h.buckets, customBuckets);
  // 25 <= 10: 0, <= 50: 1, <= 100: 2, <= 500: 3
  // Values: 25 (bucket 1), 75 (bucket 2), 150 (bucket 3)
  assert.equal(h.bucketCounts[0], 0); // 25 > 10
  assert.equal(h.bucketCounts[1], 1); // 25 <= 50
  assert.equal(h.bucketCounts[2], 2); // 25, 75 <= 100
  assert.equal(h.bucketCounts[3], 3); // all <= 500
});

test("recordHttpRequest records both counter and histogram", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordHttpRequest("GET", "/api/users", 200, 45.5);

  const counters = registry.getCounters("http_requests_total");
  assert.equal(counters.length, 1);
  assert.equal(counters[0]!.labels.method, "GET");
  assert.equal(counters[0]!.labels.path, "/api/users");
  assert.equal(counters[0]!.labels.status, "200");

  const histograms = registry.getHistograms("http_request_duration_ms");
  assert.equal(histograms.length, 1);
  assert.equal(histograms[0]!.count, 1);
  assert.equal(histograms[0]!.sum, 45.5);
});

test("recordHttpRequest ignores null duration", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordHttpRequest("GET", "/api/health", 200, null);

  const counters = registry.getCounters("http_requests_total");
  assert.equal(counters.length, 1);

  const histograms = registry.getHistograms("http_request_duration_ms");
  assert.equal(histograms.length, 0);
});

test("recordHttpRequest ignores negative duration", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordHttpRequest("GET", "/api/health", 200, -1);

  const histograms = registry.getHistograms("http_request_duration_ms");
  assert.equal(histograms.length, 0);
});

test("recordHttpRequest ignores NaN duration", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordHttpRequest("GET", "/api/health", 200, NaN);

  const histograms = registry.getHistograms("http_request_duration_ms");
  assert.equal(histograms.length, 0);
});

test("recordKnowledgeQuery records histogram and counter", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.recordKnowledgeQuery("search", 120, "success");

  const histograms = registry.getHistograms("knowledge_query_duration_ms");
  assert.equal(histograms.length, 1);
  assert.equal(histograms[0]!.count, 1);
  assert.equal(histograms[0]!.sum, 120);

  const counters = registry.getCounters("knowledge_query_total");
  assert.equal(counters.length, 1);
  assert.equal(counters[0]!.labels.operation, "search");
  assert.equal(counters[0]!.labels.result, "success");
});

test("getCounters returns all matching counters with prefix", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.incrementCounter("api_requests", { method: "GET" }, 1);
  registry.incrementCounter("api_requests", { method: "POST" }, 1);
  registry.incrementCounter("db_queries", {}, 1);

  const counters = registry.getCounters("api_requests");
  assert.equal(counters.length, 2);
});

test("getGauges returns all matching gauges with prefix", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.setGauge("cpu_usage", { core: "0" }, 50);
  registry.setGauge("cpu_usage", { core: "1" }, 60);
  registry.setGauge("memory_usage", {}, 70);

  const gauges = registry.getGauges("cpu_usage");
  assert.equal(gauges.length, 2);
});

test("getHistograms returns all matching histograms with prefix", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.observeHistogram("http_request_duration", { method: "GET" }, 50);
  registry.observeHistogram("http_request_duration", { method: "POST" }, 100);
  registry.observeHistogram("db_query_duration", {}, 30);

  const histograms = registry.getHistograms("http_request_duration");
  assert.equal(histograms.length, 2);
});

test("reset clears all metrics", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.incrementCounter("test_counter", {}, 1);
  registry.setGauge("test_gauge", {}, 100);
  registry.observeHistogram("test_histogram", {}, 50);

  registry.reset();

  assert.equal(registry.getCounters("test_counter").length, 0);
  assert.equal(registry.getGauges("test_gauge").length, 0);
  assert.equal(registry.getHistograms("test_histogram").length, 0);
});

test("counter returns independent copies", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.incrementCounter("requests", { method: "GET" }, 1);

  const counters = registry.getCounters("requests");
  const counter = counters[0]!;

  // Modifying the returned object shouldn't affect internal state
  counter.value = 999;

  const counters2 = registry.getCounters("requests");
  assert.equal(counters2[0]!.value, 1);
});

test("gauge returns independent copies", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.setGauge("cpu", { core: "0" }, 50);

  const gauges = registry.getGauges("cpu");
  const gauge = gauges[0]!;

  gauge.value = 999;

  const gauges2 = registry.getGauges("cpu");
  assert.equal(gauges2[0]!.value, 50);
});

test("histogram returns independent copies of arrays", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.observeHistogram("duration", {}, 50);

  const histograms = registry.getHistograms("duration");
  const h = histograms[0]!;

  h.buckets[0] = 999;
  h.bucketCounts[0] = 999;
  h.count = 999;
  h.sum = 999;

  const histograms2 = registry.getHistograms("duration");
  const h2 = histograms2[0]!;
  assert.equal(h2.buckets[0], 10); // original value
  assert.equal(h2.bucketCounts[0], 1); // original value
  assert.equal(h2.count, 1);
  assert.equal(h2.sum, 50);
});

test("observeHistogram uses default buckets", () => {
  const registry = new RuntimeMetricsRegistry();

  registry.observeHistogram("test_metric", {}, 500);

  const histograms = registry.getHistograms("test_metric");
  assert.equal(histograms.length, 1);
  assert.deepEqual(histograms[0]!.buckets, [10, 50, 100, 250, 500, 1000, 5000]);
});

test("empty getCounters returns empty array", () => {
  const registry = new RuntimeMetricsRegistry();
  assert.deepEqual(registry.getCounters("nonexistent"), []);
});

test("empty getGauges returns empty array", () => {
  const registry = new RuntimeMetricsRegistry();
  assert.deepEqual(registry.getGauges("nonexistent"), []);
});

test("empty getHistograms returns empty array", () => {
  const registry = new RuntimeMetricsRegistry();
  assert.deepEqual(registry.getHistograms("nonexistent"), []);
});