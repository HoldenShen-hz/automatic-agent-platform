/**
 * PrometheusMetricsExporter Format Tests
 *
 * Tests for src/platform/shared/observability/prometheus-metrics-exporter.ts
 * Focus areas:
 * - Prometheus exposition format compliance
 * - Metric type headers (HELP, TYPE)
 * - Label formatting
 * - Histogram bucket format
 * - Counter format
 * - Gauge format
 */

import assert from "node:assert/strict";
import test from "node:test";
import { PrometheusMetricsExporter } from "../../../../../src/platform/shared/observability/prometheus-metrics-exporter.js";
import { runtimeMetricsRegistry } from "../../../../../src/platform/shared/observability/runtime-metrics-registry.js";
import { renderMetricsPayload } from "../../../../../src/platform/shared/observability/metrics-server.js";

function createMockMetricsService() {
  return {
    buildSummary: () => ({
      executionMetrics: { total: 100, activeCount: 10, supersededCount: 5 },
      taskMetrics: { successCount: 80, failedCount: 10, cancelledCount: 5 },
      recoveryMetrics: { deadLetterCount: 2 },
      runtimeMetrics: {
        activeExecutions: 10,
        queuedTasks: 25,
        providerSuccessRate: 0.95,
        memoryRssMb: 256,
        eventLoopLagMs: 50,
        workerHealth: { healthyWorkers: 5, totalWorkers: 6 },
      },
    }),
  };
}

function createMockDb() {
  return {
    connection: {
      prepare: () => ({ get: () => ({ count: 42 }) }),
    },
  };
}

test("PrometheusMetricsExporter - export contains required HELP and TYPE headers", () => {
  runtimeMetricsRegistry.reset();
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  // Check for process metrics headers
  assert.match(output, /# HELP process_cpu_seconds_total/);
  assert.match(output, /# TYPE process_cpu_seconds_total counter/);

  assert.match(output, /# HELP process_meminfo_bytes/);
  assert.match(output, /# TYPE process_meminfo_bytes gauge/);

  assert.match(output, /# HELP http_requests_total/);
  assert.match(output, /# TYPE http_requests_total counter/);

  assert.match(output, /# HELP task_executions_total/);
  assert.match(output, /# TYPE task_executions_total counter/);

  assert.match(output, /# HELP agent_rounds_total/);
  assert.match(output, /# TYPE agent_rounds_total counter/);
});

test("PrometheusMetricsExporter - process_cpu_seconds_total is a valid number", () => {
  runtimeMetricsRegistry.reset();
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  const match = output.match(/^process_cpu_seconds_total ([\d.]+)$/m);
  assert.ok(match, "Should have process_cpu_seconds_total metric");
  const value = parseFloat(match[1]);
  assert.ok(value >= 0, "CPU seconds should be non-negative");
});

test("PrometheusMetricsExporter - process_meminfo_bytes has correct labels", () => {
  runtimeMetricsRegistry.reset();
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  assert.match(output, /process_meminfo_bytes\{type="rss"\} \d+/);
  assert.match(output, /process_meminfo_bytes\{type="heap_total"\} \d+/);
  assert.match(output, /process_meminfo_bytes\{type="heap_used"\} \d+/);
  assert.match(output, /process_meminfo_bytes\{type="external"\} \d+/);
});

test("PrometheusMetricsExporter - http_requests_total with labels format", () => {
  runtimeMetricsRegistry.reset();
  runtimeMetricsRegistry.incrementCounter("http_requests_total", { method: "GET", path: "/api/test", status: 200 }, 5);

  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  assert.match(output, /http_requests_total\{method="GET",path="\/api\/test",status="200"\} 5/);
});

test("PrometheusMetricsExporter - http_requests_total sanitizes label values", () => {
  runtimeMetricsRegistry.reset();
  runtimeMetricsRegistry.incrementCounter("http_requests_total", { method: "GET", path: "/api/path with spaces", status: 200 }, 1);

  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  // Spaces should be preserved, special chars escaped
  assert.match(output, /http_requests_total\{method="GET",path="\/api\/path with spaces",status="200"\}/);
});

test("PrometheusMetricsExporter - http_request_duration_ms histogram format", () => {
  runtimeMetricsRegistry.reset();
  runtimeMetricsRegistry.observeHistogram("http_request_duration_ms", { method: "GET", path: "/test", status: 200 }, 100);

  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  // Histogram should have bucket, sum, and count
  assert.match(output, /http_request_duration_ms_bucket\{le="[^"]+",method="GET",path="\/test",status="200"\}/);
  assert.match(output, /http_request_duration_ms_sum/);
  assert.match(output, /http_request_duration_ms_count/);
});

test("PrometheusMetricsExporter - histogram buckets are cumulative", () => {
  runtimeMetricsRegistry.reset();
  // Add values to different buckets
  runtimeMetricsRegistry.observeHistogram("http_request_duration_ms", { method: "GET", path: "/test", status: 200 }, 5);
  runtimeMetricsRegistry.observeHistogram("http_request_duration_ms", { method: "GET", path: "/test", status: 200 }, 25);
  runtimeMetricsRegistry.observeHistogram("http_request_duration_ms", { method: "GET", path: "/test", status: 200 }, 75);

  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  assert.match(output, /http_request_duration_ms_bucket\{le="10",method="GET",path="\/test",status="200"\} 1/);
  assert.match(output, /http_request_duration_ms_bucket\{le="50",method="GET",path="\/test",status="200"\} 2/);
  // +Inf bucket should equal total count
  const infMatch = output.match(/http_request_duration_ms_bucket\{le="\+Inf",method="GET",path="\/test",status="200"\} (\d+)/);
  assert.ok(infMatch, "Should have +Inf bucket");
  assert.equal(parseInt(infMatch[1]), 3, "+Inf bucket should be cumulative count");
});

test("PrometheusMetricsExporter - task_executions_total format", () => {
  runtimeMetricsRegistry.reset();
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  assert.match(output, /task_executions_total\{status="total"\} 100/);
  assert.match(output, /task_executions_total\{status="active"\} 10/);
  assert.match(output, /task_executions_total\{status="done"\} 80/);
  assert.match(output, /task_executions_total\{status="failed"\} 10/);
  assert.match(output, /task_executions_total\{status="cancelled"\} 5/);
  assert.match(output, /task_executions_total\{status="superseded"\} 5/);
});

test("PrometheusMetricsExporter - agent_rounds_total format", () => {
  runtimeMetricsRegistry.reset();
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  const match = output.match(/^agent_rounds_total (\d+)$/m);
  assert.ok(match, "Should have agent_rounds_total metric");
  // Default is count from workflow_step_outputs, mocked to 42
  assert.equal(parseInt(match[1]), 42);
});

test("PrometheusMetricsExporter - process_start_time_seconds is valid unix timestamp", () => {
  runtimeMetricsRegistry.reset();
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  const match = output.match(/^process_start_time_seconds ([\d.]+)$/m);
  assert.ok(match, "Should have process_start_time_seconds metric");
  const value = parseFloat(match[1]);
  // Should be a reasonable unix timestamp (after 2020, before 2100)
  assert.ok(value > 1577836800 && value < 4102444800, "Should be valid unix timestamp");
});

test("PrometheusMetricsExporter - process_uptime_seconds is non-negative", () => {
  runtimeMetricsRegistry.reset();
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  const match = output.match(/^process_uptime_seconds ([\d.]+)$/m);
  assert.ok(match, "Should have process_uptime_seconds metric");
  const value = parseFloat(match[1]);
  assert.ok(value >= 0, "Uptime should be non-negative");
});

test("PrometheusMetricsExporter - active_executions gauge format", () => {
  runtimeMetricsRegistry.reset();
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  const match = output.match(/^active_executions (\d+)$/m);
  assert.ok(match, "Should have active_executions metric");
  assert.equal(parseInt(match[1]), 10);
});

test("PrometheusMetricsExporter - queued_tasks gauge format", () => {
  runtimeMetricsRegistry.reset();
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  const match = output.match(/^queued_tasks (\d+)$/m);
  assert.ok(match, "Should have queued_tasks metric");
  assert.equal(parseInt(match[1]), 25);
});

test("PrometheusMetricsExporter - dead_letter_count gauge format", () => {
  runtimeMetricsRegistry.reset();
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  const match = output.match(/^dead_letter_count (\d+)$/m);
  assert.ok(match, "Should have dead_letter_count metric");
  assert.equal(parseInt(match[1]), 2);
});

test("PrometheusMetricsExporter - provider_success_rate gauge format", () => {
  runtimeMetricsRegistry.reset();
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  const match = output.match(/^provider_success_rate ([\d.]+)$/m);
  assert.ok(match, "Should have provider_success_rate metric");
  assert.equal(parseFloat(match[1]), 0.95);
});

test("PrometheusMetricsExporter - memory_rss_bytes gauge format", () => {
  runtimeMetricsRegistry.reset();
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  const match = output.match(/^memory_rss_bytes (\d+)$/m);
  assert.ok(match, "Should have memory_rss_bytes metric");
  // Should be approximately 256MB * 1024 * 1024 = 268435456 bytes
  const expectedBytes = 256 * 1024 * 1024;
  assert.equal(parseInt(match[1]), expectedBytes);
});

test("PrometheusMetricsExporter - event_loop_lag_ms gauge format", () => {
  runtimeMetricsRegistry.reset();
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  const match = output.match(/^event_loop_lag_ms ([\d.]+)$/m);
  assert.ok(match, "Should have event_loop_lag_ms metric");
  assert.equal(parseFloat(match[1]), 50);
});

test("PrometheusMetricsExporter - worker gauges format", () => {
  runtimeMetricsRegistry.reset();
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  const healthyMatch = output.match(/^healthy_workers (\d+)$/m);
  assert.ok(healthyMatch, "Should have healthy_workers metric");
  assert.equal(parseInt(healthyMatch[1]), 5);

  const totalMatch = output.match(/^total_workers (\d+)$/m);
  assert.ok(totalMatch, "Should have total_workers metric");
  assert.equal(parseInt(totalMatch[1]), 6);
});

test("PrometheusMetricsExporter - disk usage gauges format", () => {
  runtimeMetricsRegistry.reset();
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  assert.match(output, /^disk_total_bytes \d+$/m);
  assert.match(output, /^disk_free_bytes \d+$/m);
  assert.match(output, /^disk_used_ratio \d+(\.\d+)?$/m);
});

test("PrometheusMetricsExporter - counter series format", () => {
  runtimeMetricsRegistry.reset();
  runtimeMetricsRegistry.incrementCounter("redis_connection_errors", { component: "test-component" }, 5);

  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  assert.match(output, /redis_connection_errors\{component="test-component"\} 5/);
});

test("PrometheusMetricsExporter - OAPEFLIR stage metrics format", () => {
  runtimeMetricsRegistry.reset();
  runtimeMetricsRegistry.recordOapeflirStage("execute", "completed", 100);
  runtimeMetricsRegistry.recordOapeflirStageEntry("execute");

  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  assert.match(output, /oapeflir_loop_duration_ms_bucket/);
  assert.match(output, /oapeflir_stage_outcome_total\{result="completed",stage="execute"\}/);
  assert.match(output, /oapeflir_stage_entry_total\{stage="execute"\}/);
});

test("PrometheusMetricsExporter - knowledge query metrics format", () => {
  runtimeMetricsRegistry.reset();
  runtimeMetricsRegistry.recordKnowledgeQuery("search", 50, "ok");

  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  assert.match(output, /knowledge_query_duration_ms_bucket/);
  assert.match(output, /knowledge_query_total\{operation="search",result="ok"\}/);
});

test("PrometheusMetricsExporter - metricPrefix option prepends prefix", () => {
  runtimeMetricsRegistry.reset();
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any, {
    metricPrefix: "app_",
  });

  const output = exporter.export();

  // With prefix, metrics should be prefixed
  assert.match(output, /app_process_cpu_seconds_total/);
});

test("PrometheusMetricsExporter - recordHttpRequest adds metrics", () => {
  runtimeMetricsRegistry.reset();
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  exporter.recordHttpRequest("POST", "/api/data", 201, 150);

  const output = exporter.export();

  assert.match(output, /http_requests_total\{method="POST",path="\/api\/data",status="201"\} 1/);
  assert.match(output, /http_request_duration_ms_bucket/);
});

test("PrometheusMetricsExporter - resetHttpRequestCounts clears counters", () => {
  runtimeMetricsRegistry.reset();
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  exporter.recordHttpRequest("GET", "/test", 200, 50);
  exporter.resetHttpRequestCounts();

  const output = exporter.export();

  // After reset, the previous series should no longer be exported.
  const match = output.match(/http_requests_total\{method="GET",path="\/test",status="200"\} (\d+)/);
  assert.equal(match, null);
});

test("PrometheusMetricsExporter - sanitizeLabelValue escapes backslash", () => {
  runtimeMetricsRegistry.reset();
  runtimeMetricsRegistry.incrementCounter("test_metric", { path: "/path\\with\\backslash" }, 1);

  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  // Backslashes should be escaped
  assert.match(output, /test_metric\{path="\/path\\\\with\\\\backslash"\}/);
});

test("PrometheusMetricsExporter - sanitizeLabelValue escapes quotes", () => {
  runtimeMetricsRegistry.reset();
  runtimeMetricsRegistry.incrementCounter("test_metric", { path: '/path"with"quotes' }, 1);

  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  // Quotes should be escaped
  assert.match(output, /test_metric\{path="\/path\\"with\\"quotes"\}/);
});

test("PrometheusMetricsExporter - sanitizeLabelValue escapes newlines", () => {
  runtimeMetricsRegistry.reset();
  runtimeMetricsRegistry.incrementCounter("test_metric", { path: "/path\nwith\nnewlines" }, 1);

  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  // Newlines should be escaped
  assert.match(output, /test_metric\{path="\/path\\nwith\\nnewlines"\}/);
});

test("PrometheusMetricsExporter - formatPrometheusLabels handles empty labels", () => {
  runtimeMetricsRegistry.reset();
  runtimeMetricsRegistry.incrementCounter("no_labels", {}, 1);

  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  // Should appear as metric without labels
  assert.match(output, /^no_labels 1$/m);
});

test("PrometheusMetricsExporter - formatPrometheusLabels sorts label keys", () => {
  runtimeMetricsRegistry.reset();
  runtimeMetricsRegistry.incrementCounter("sorted_labels", { z: "zval", a: "aval", m: "mval" }, 1);

  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const output = exporter.export();

  // Labels should be sorted alphabetically
  assert.match(output, /sorted_labels\{a="aval",m="mval",z="zval"\}/);
});

test("PrometheusMetricsExporter - content-type header format", () => {
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const payload = renderMetricsPayload(exporter, "GET", "/metrics");

  assert.equal(payload.statusCode, 200);
  assert.equal(payload.headers["content-type"], "text/plain; version=0.0.4; charset=utf-8");
});

test("PrometheusMetricsExporter - 405 for non-GET methods", () => {
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const payload = renderMetricsPayload(exporter, "POST", "/metrics");

  assert.equal(payload.statusCode, 405);
  assert.equal(payload.headers.allow, "GET");
  assert.equal(payload.body, "Method Not Allowed");
});

test("PrometheusMetricsExporter - 404 for non-metrics paths", () => {
  const exporter = new PrometheusMetricsExporter(createMockDb() as any, createMockMetricsService() as any);

  const payload = renderMetricsPayload(exporter, "GET", "/other");

  assert.equal(payload.statusCode, 404);
  assert.equal(payload.body, "Not Found");
});

test("PrometheusMetricsExporter - 503 when exporter is null", () => {
  const payload = renderMetricsPayload(null, "GET", "/metrics");

  assert.equal(payload.statusCode, 503);
  assert.equal(payload.body, "metrics exporter unavailable");
});
