import assert from "node:assert/strict";
import test from "node:test";

import { PrometheusMetricsExporter } from "../../../../../src/platform/shared/observability/prometheus-metrics-exporter.js";
import { runtimeMetricsRegistry } from "../../../../../src/platform/shared/observability/runtime-metrics-registry.js";

test("PrometheusMetricsExporter is a constructor function", () => {
  assert.equal(typeof PrometheusMetricsExporter, "function");
});

test("HttpRequestMetric interface is correct", () => {
  const metric = {
    method: "GET",
    path: "/api/test",
    status: 200,
    count: 5,
  };
  assert.equal(metric.method, "GET");
  assert.equal(metric.path, "/api/test");
  assert.equal(metric.status, 200);
  assert.equal(metric.count, 5);
});

test("PrometheusMetricsExporterOptions interface is correct", () => {
  const options = {
    metricPrefix: "app_",
  };
  assert.equal(options.metricPrefix, "app_");
});

test("PrometheusMetricsExporter exports histogram and runtime gauges", () => {
  runtimeMetricsRegistry.reset();
  const exporter = new PrometheusMetricsExporter(
    {
      connection: {
        prepare() {
          return {
            get() {
              return { count: 4 };
            },
          };
        },
      },
    } as never,
    {
      buildSummary() {
        return {
          executionMetrics: { total: 6, activeCount: 2, supersededCount: 1 },
          taskMetrics: { successCount: 3, failedCount: 1, cancelledCount: 0 },
          recoveryMetrics: { deadLetterCount: 5 },
          runtimeMetrics: {
            activeExecutions: 2,
            queuedTasks: 7,
            providerSuccessRate: 0.98,
            memoryRssMb: 64,
            eventLoopLagMs: 11,
            workerHealth: { healthyWorkers: 3, totalWorkers: 4 },
          },
        };
      },
    } as never,
  );

  exporter.recordHttpRequest("GET", "/health", 200, 42);
  runtimeMetricsRegistry.recordOapeflirStage("execute", "completed", 25);
  runtimeMetricsRegistry.recordKnowledgeQuery("domain", 17, "ok");

  const output = exporter.export();
  assert.match(output, /http_request_duration_ms_bucket\{method="GET",path="\/health",status="200",le="50"\} 1/);
  assert.match(output, /active_executions 2/);
  assert.match(output, /queued_tasks 7/);
  assert.match(output, /oapeflir_stage_outcome_total\{stage="execute",result="completed"\} 1/);
  assert.match(output, /knowledge_query_total\{operation="domain",result="ok"\} 1/);
});
