/**
 * Prometheus Metrics Exporter
 *
 * Exposes system and application metrics in Prometheus exposition format.
 * Supports:
 * - process_cpu_seconds_total
 * - process_meminfo_bytes
 * - http_requests_total (by method, path, status)
 * - task_executions_total (by status)
 * - agent_rounds_total
 */

import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { MetricsService } from "./metrics-service.js";
import { nowIso } from "../../contracts/types/ids.js";
import { runtimeMetricsRegistry } from "./runtime-metrics-registry.js";
import { statfsSync } from "node:fs";

export interface HttpRequestMetric {
  method: string;
  path: string;
  status: number;
  count: number;
}

export interface PrometheusMetricsExporterOptions {
  /** Prefix for all metric names (default: '') */
  metricPrefix?: string;
}

export class PrometheusMetricsExporter {
  private readonly metricPrefix: string;
  private readonly db: AuthoritativeSqlDatabase;
  private readonly metricsService: MetricsService;
  private processStartTime: number;

  public constructor(
    db: AuthoritativeSqlDatabase,
    metricsService: MetricsService,
    options: PrometheusMetricsExporterOptions = {},
  ) {
    this.metricPrefix = sanitizeMetricPrefix(options.metricPrefix ?? "");
    this.db = db;
    this.metricsService = metricsService;
    this.processStartTime = Date.now();
  }

  /**
   * Record an HTTP request for metrics.
   */
  public recordHttpRequest(method: string, path: string, status: number, durationMs: number | null = null): void {
    runtimeMetricsRegistry.recordHttpRequest(method, path, status, durationMs);
  }

  /**
   * Reset HTTP request counters (typically called after scraping).
   */
  public resetHttpRequestCounts(): void {
    runtimeMetricsRegistry.reset(["http_requests_total", "http_request_duration_ms"]);
  }

  /**
   * Export all metrics in Prometheus exposition format.
   */
  public export(): string {
    const lines: string[] = [];
    const renderedCounters = new Set<string>();
    const renderedHistograms = new Set<string>();

    // Add metric help and type headers
    lines.push(`# HELP ${this.metricName("process_cpu_seconds_total")} Total user and system CPU time spent in seconds.`);
    lines.push(`# TYPE ${this.metricName("process_cpu_seconds_total")} counter`);
    lines.push(`${this.metricName("process_cpu_seconds_total")} ${this.getCpuSeconds()}`);

    lines.push("");
    lines.push(`# HELP ${this.metricName("process_meminfo_bytes")} Process memory information in bytes.`);
    lines.push(`# TYPE ${this.metricName("process_meminfo_bytes")} gauge`);
    const memUsage = this.getMemoryUsage();
    lines.push(`${this.metricName("process_meminfo_bytes")}{type="rss"} ${memUsage.rss}`);
    lines.push(`${this.metricName("process_meminfo_bytes")}{type="heap_total"} ${memUsage.heapTotal}`);
    lines.push(`${this.metricName("process_meminfo_bytes")}{type="heap_used"} ${memUsage.heapUsed}`);
    lines.push(`${this.metricName("process_meminfo_bytes")}{type="external"} ${memUsage.external}`);

    lines.push("");
    lines.push(`# HELP ${this.metricName("http_requests_total")} Total number of HTTP requests.`);
    lines.push(`# TYPE ${this.metricName("http_requests_total")} counter`);
    for (const metric of this.getHttpRequestCounts()) {
      const path = sanitizeLabelValue(metric.path);
      lines.push(`${this.metricName("http_requests_total")}{method="${metric.method}",path="${path}",status="${metric.status}"} ${metric.count}`);
    }
    renderedCounters.add("http_requests_total");

    lines.push("");
    lines.push(`# HELP ${this.metricName("http_request_duration_ms")} HTTP request duration in milliseconds.`);
    lines.push(`# TYPE ${this.metricName("http_request_duration_ms")} histogram`);
    for (const line of this.renderHistogramSeries("http_request_duration_ms")) {
      lines.push(line);
    }
    renderedHistograms.add("http_request_duration_ms");

    lines.push("");
    lines.push(`# HELP ${this.metricName("task_executions_total")} Total number of task executions by status.`);
    lines.push(`# TYPE ${this.metricName("task_executions_total")} counter`);
    const executionMetrics = this.getExecutionMetrics();
    for (const [status, count] of Object.entries(executionMetrics)) {
      lines.push(`${this.metricName("task_executions_total")}{status="${status}"} ${count}`);
    }

    lines.push("");
    lines.push(`# HELP ${this.metricName("agent_rounds_total")} Total number of agent rounds (workflow step completions).`);
    lines.push(`# TYPE ${this.metricName("agent_rounds_total")} counter`);
    lines.push(`${this.metricName("agent_rounds_total")} ${this.getAgentRoundsCount()}`);

    lines.push("");
    lines.push(`# HELP ${this.metricName("process_start_time_seconds")} Start time of the process since unix epoch in seconds.`);
    lines.push(`# TYPE ${this.metricName("process_start_time_seconds")} gauge`);
    lines.push(`${this.metricName("process_start_time_seconds")} ${Math.floor(this.processStartTime / 1000)}`);

    lines.push("");
    lines.push(`# HELP ${this.metricName("process_uptime_seconds")} Process uptime in seconds.`);
    lines.push(`# TYPE ${this.metricName("process_uptime_seconds")} gauge`);
    lines.push(`${this.metricName("process_uptime_seconds")} ${Math.floor((Date.now() - this.processStartTime) / 1000)}`);

    const summary = this.metricsService.buildSummary(nowIso());

    lines.push("");
    lines.push(`# HELP ${this.metricName("active_executions")} Current active executions.`);
    lines.push(`# TYPE ${this.metricName("active_executions")} gauge`);
    lines.push(`${this.metricName("active_executions")} ${summary.runtimeMetrics.activeExecutions}`);

    lines.push("");
    lines.push(`# HELP ${this.metricName("queued_tasks")} Current queued tasks.`);
    lines.push(`# TYPE ${this.metricName("queued_tasks")} gauge`);
    lines.push(`${this.metricName("queued_tasks")} ${summary.runtimeMetrics.queuedTasks}`);

    lines.push("");
    lines.push(`# HELP ${this.metricName("dead_letter_count")} Current dead letter count.`);
    lines.push(`# TYPE ${this.metricName("dead_letter_count")} gauge`);
    lines.push(`${this.metricName("dead_letter_count")} ${summary.recoveryMetrics.deadLetterCount}`);

    lines.push("");
    lines.push(`# HELP ${this.metricName("provider_success_rate")} Rolling provider success rate.`);
    lines.push(`# TYPE ${this.metricName("provider_success_rate")} gauge`);
    lines.push(`${this.metricName("provider_success_rate")} ${summary.runtimeMetrics.providerSuccessRate}`);

    lines.push("");
    lines.push(`# HELP ${this.metricName("memory_rss_bytes")} Resident set size in bytes.`);
    lines.push(`# TYPE ${this.metricName("memory_rss_bytes")} gauge`);
    lines.push(`${this.metricName("memory_rss_bytes")} ${Math.round(summary.runtimeMetrics.memoryRssMb * 1024 * 1024)}`);

    lines.push("");
    lines.push(`# HELP ${this.metricName("memory_heap_used_bytes")} Heap used in bytes.`);
    lines.push(`# TYPE ${this.metricName("memory_heap_used_bytes")} gauge`);
    lines.push(`${this.metricName("memory_heap_used_bytes")} ${memUsage.heapUsed}`);

    lines.push("");
    lines.push(`# HELP ${this.metricName("event_loop_lag_ms")} Event loop lag in milliseconds.`);
    lines.push(`# TYPE ${this.metricName("event_loop_lag_ms")} gauge`);
    lines.push(`${this.metricName("event_loop_lag_ms")} ${summary.runtimeMetrics.eventLoopLagMs ?? 0}`);

    lines.push("");
    lines.push(`# HELP ${this.metricName("redis_connection_errors")} Total Redis connection errors observed by runtime components.`);
    lines.push(`# TYPE ${this.metricName("redis_connection_errors")} counter`);
    for (const line of this.renderCounterSeries("redis_connection_errors")) {
      lines.push(line);
    }
    renderedCounters.add("redis_connection_errors");

    lines.push("");
    lines.push(`# HELP ${this.metricName("queue_enqueue_failures_total")} Total queue enqueue write failures observed by backend and mode.`);
    lines.push(`# TYPE ${this.metricName("queue_enqueue_failures_total")} counter`);
    for (const line of this.renderCounterSeries("queue_enqueue_failures_total")) {
      lines.push(line);
    }
    renderedCounters.add("queue_enqueue_failures_total");

    lines.push("");
    lines.push(`# HELP ${this.metricName("alert_delivery_failures_total")} Total alert delivery failures observed by channel.`);
    lines.push(`# TYPE ${this.metricName("alert_delivery_failures_total")} counter`);
    for (const line of this.renderCounterSeries("alert_delivery_failures_total")) {
      lines.push(line);
    }
    renderedCounters.add("alert_delivery_failures_total");

    lines.push("");
    lines.push(`# HELP ${this.metricName("healthy_workers")} Healthy workers available.`);
    lines.push(`# TYPE ${this.metricName("healthy_workers")} gauge`);
    lines.push(`${this.metricName("healthy_workers")} ${summary.runtimeMetrics.workerHealth.healthyWorkers}`);

    lines.push("");
    lines.push(`# HELP ${this.metricName("total_workers")} Total workers registered.`);
    lines.push(`# TYPE ${this.metricName("total_workers")} gauge`);
    lines.push(`${this.metricName("total_workers")} ${summary.runtimeMetrics.workerHealth.totalWorkers}`);

    const diskUsage = this.getDiskUsage();
    lines.push("");
    lines.push(`# HELP ${this.metricName("disk_total_bytes")} Total bytes available in the current workspace filesystem.`);
    lines.push(`# TYPE ${this.metricName("disk_total_bytes")} gauge`);
    lines.push(`${this.metricName("disk_total_bytes")} ${diskUsage.totalBytes}`);

    lines.push("");
    lines.push(`# HELP ${this.metricName("disk_free_bytes")} Free bytes available in the current workspace filesystem.`);
    lines.push(`# TYPE ${this.metricName("disk_free_bytes")} gauge`);
    lines.push(`${this.metricName("disk_free_bytes")} ${diskUsage.freeBytes}`);

    lines.push("");
    lines.push(`# HELP ${this.metricName("disk_used_ratio")} Used ratio of the current workspace filesystem.`);
    lines.push(`# TYPE ${this.metricName("disk_used_ratio")} gauge`);
    lines.push(`${this.metricName("disk_used_ratio")} ${diskUsage.usedRatio}`);

    lines.push("");
    lines.push(`# HELP ${this.metricName("oapeflir_stage_duration_ms")} OAPEFLIR stage duration in milliseconds.`);
    lines.push(`# TYPE ${this.metricName("oapeflir_stage_duration_ms")} histogram`);
    for (const line of this.renderHistogramSeries("oapeflir_stage_duration_ms")) {
      lines.push(line);
    }
    renderedHistograms.add("oapeflir_stage_duration_ms");

    lines.push("");
    lines.push(`# HELP ${this.metricName("oapeflir_loop_duration_ms")} Backward-compatible alias for OAPEFLIR loop duration in milliseconds.`);
    lines.push(`# TYPE ${this.metricName("oapeflir_loop_duration_ms")} histogram`);
    for (const line of this.renderHistogramSeries("oapeflir_loop_duration_ms")) {
      lines.push(line);
    }
    renderedHistograms.add("oapeflir_loop_duration_ms");

    lines.push("");
    lines.push(`# HELP ${this.metricName("oapeflir_stage_outcome_total")} OAPEFLIR stage outcomes by result.`);
    lines.push(`# TYPE ${this.metricName("oapeflir_stage_outcome_total")} counter`);
    for (const line of this.renderCounterSeries("oapeflir_stage_outcome_total")) {
      lines.push(line);
    }
    renderedCounters.add("oapeflir_stage_outcome_total");

    lines.push("");
    lines.push(`# HELP ${this.metricName("oapeflir_stage_entry_total")} OAPEFLIR stage entry count.`);
    lines.push(`# TYPE ${this.metricName("oapeflir_stage_entry_total")} counter`);
    for (const line of this.renderCounterSeries("oapeflir_stage_entry_total")) {
      lines.push(line);
    }
    renderedCounters.add("oapeflir_stage_entry_total");

    lines.push("");
    lines.push(`# HELP ${this.metricName("llm_ttfb_seconds")} LLM time-to-first-token latency in seconds.`);
    lines.push(`# TYPE ${this.metricName("llm_ttfb_seconds")} histogram`);
    for (const line of this.renderHistogramSeries("llm_ttfb_seconds")) {
      lines.push(line);
    }
    renderedHistograms.add("llm_ttfb_seconds");

    lines.push("");
    lines.push(`# HELP ${this.metricName("llm_total_seconds")} LLM total request latency in seconds.`);
    lines.push(`# TYPE ${this.metricName("llm_total_seconds")} histogram`);
    for (const line of this.renderHistogramSeries("llm_total_seconds")) {
      lines.push(line);
    }
    renderedHistograms.add("llm_total_seconds");

    lines.push("");
    lines.push(`# HELP ${this.metricName("knowledge_query_duration_ms")} Knowledge query duration in milliseconds.`);
    lines.push(`# TYPE ${this.metricName("knowledge_query_duration_ms")} histogram`);
    for (const line of this.renderHistogramSeries("knowledge_query_duration_ms")) {
      lines.push(line);
    }
    renderedHistograms.add("knowledge_query_duration_ms");

    lines.push("");
    lines.push(`# HELP ${this.metricName("knowledge_query_total")} Knowledge queries by operation and result.`);
    lines.push(`# TYPE ${this.metricName("knowledge_query_total")} counter`);
    for (const line of this.renderCounterSeries("knowledge_query_total")) {
      lines.push(line);
    }
    renderedCounters.add("knowledge_query_total");

    for (const name of runtimeMetricsRegistry.listCounterNames()) {
      if (renderedCounters.has(name)) {
        continue;
      }
      if (!isRuntimeMetricNameAllowed(name)) {
        continue;
      }
      lines.push("");
      lines.push(`# HELP ${this.metricName(name)} Runtime counter metric.`);
      lines.push(`# TYPE ${this.metricName(name)} counter`);
      for (const line of this.renderCounterSeries(name)) {
        lines.push(line);
      }
    }

    for (const name of runtimeMetricsRegistry.listHistogramNames()) {
      if (renderedHistograms.has(name)) {
        continue;
      }
      if (!isRuntimeMetricNameAllowed(name)) {
        continue;
      }
      lines.push("");
      lines.push(`# HELP ${this.metricName(name)} Runtime histogram metric.`);
      lines.push(`# TYPE ${this.metricName(name)} histogram`);
      for (const line of this.renderHistogramSeries(name)) {
        lines.push(line);
      }
    }

    return lines.join("\n");
  }

  private metricName(name: string): string {
    return `${this.metricPrefix}${name}`;
  }

  private getCpuSeconds(): number {
    const usage = process.cpuUsage();
    // user + system CPU time in microseconds, convert to seconds
    return (usage.user + usage.system) / 1_000_000;
  }

  private getMemoryUsage(): { rss: number; heapTotal: number; heapUsed: number; external: number } {
    const mem = process.memoryUsage();
    return {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
    };
  }

  private getDiskUsage(): { totalBytes: number; freeBytes: number; usedRatio: number } {
    try {
      const stat = statfsSync(process.cwd());
      const totalBytes = Number(stat.blocks * stat.bsize);
      const freeBytes = Number(stat.bavail * stat.bsize);
      const usedRatio = totalBytes > 0 ? Number(((totalBytes - freeBytes) / totalBytes).toFixed(6)) : 0;
      return { totalBytes, freeBytes, usedRatio };
    } catch {
      return { totalBytes: 0, freeBytes: 0, usedRatio: 0 };
    }
  }

  private getExecutionMetrics(): Record<string, number> {
    const summary = this.metricsService.buildSummary(nowIso());
    return {
      total: summary.executionMetrics.total,
      active: summary.executionMetrics.activeCount,
      done: summary.taskMetrics.successCount,
      failed: summary.taskMetrics.failedCount,
      cancelled: summary.taskMetrics.cancelledCount,
      superseded: summary.executionMetrics.supersededCount,
    };
  }

  private getAgentRoundsCount(): number {
    // Count workflow step outputs as a proxy for agent rounds
    const row = this.db.connection
      .prepare("SELECT COUNT(*) AS count FROM workflow_step_outputs")
      .get() as { count: number } | undefined;
    return Number(row?.count ?? 0);
  }

  private getHttpRequestCounts(): HttpRequestMetric[] {
    return runtimeMetricsRegistry.getCounters("http_requests_total").map((series) => ({
      method: series.labels.method ?? "GET",
      path: series.labels.path ?? "/",
      status: Number(series.labels.status ?? 200),
      count: series.value,
    }));
  }

  private renderCounterSeries(name: string): string[] {
    return runtimeMetricsRegistry.getCounters(name).map((series) => (
      `${this.metricName(name)}${formatPrometheusLabels(series.labels)} ${series.value}`
    ));
  }

  private renderHistogramSeries(name: string): string[] {
    const lines: string[] = [];
    for (const series of runtimeMetricsRegistry.getHistograms(name)) {
      for (let index = 0; index < series.buckets.length; index += 1) {
        lines.push(`${this.metricName(name)}_bucket${formatPrometheusLabels({ ...series.labels, le: String(series.buckets[index]) })} ${series.bucketCounts[index] ?? 0}`);
      }
      lines.push(`${this.metricName(name)}_bucket${formatPrometheusLabels({ ...series.labels, le: "+Inf" })} ${series.count}`);
      lines.push(`${this.metricName(name)}_sum${formatPrometheusLabels(series.labels)} ${series.sum}`);
      lines.push(`${this.metricName(name)}_count${formatPrometheusLabels(series.labels)} ${series.count}`);
    }
    return lines;
  }
}

function sanitizeMetricPrefix(prefix: string): string {
  if (prefix.length === 0) {
    return "";
  }
  const normalized = prefix.replace(/[^a-zA-Z0-9_:]/g, "_");
  return /^[a-zA-Z_:]/.test(normalized) ? normalized : `metric_${normalized}`;
}

const ALLOWED_RUNTIME_METRIC_NAMES = new Set([
  "http_requests_total",
  "http_request_duration_ms",
  "redis_connection_errors",
  "queue_enqueue_failures_total",
  "alert_delivery_failures_total",
  "oapeflir_stage_duration_ms",
  "oapeflir_loop_duration_ms",
  "oapeflir_stage_outcome_total",
  "oapeflir_stage_entry_total",
  "llm_ttfb_seconds",
  "llm_total_seconds",
  "knowledge_query_duration_ms",
  "knowledge_query_total",
  "harness_run_total",
  "harness_run_duration_ms",
  "harness_steps",
  "harness_budget_consumed_total_units",
  "harness_budget_total_units",
  "harness_budget_utilization_ratio",
  "harness_execution_latency_ms",
  "harness_task_started_total",
  "harness_task_completed_total",
  "harness_plugin_invoked_total",
  "harness_policy_decision_total",
  "event_bus_backpressure_pending",
  "event_bus_backpressure_high_water",
  "otel_runtime_available",
]);

function isRuntimeMetricNameAllowed(name: string): boolean {
  return ALLOWED_RUNTIME_METRIC_NAMES.has(name) || /^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(name);
}

/**
 * Sanitize a label value for Prometheus format.
 * Replaces characters that are invalid in Prometheus labels.
 */
function sanitizeLabelValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

function formatPrometheusLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels).sort(([left], [right]) => left.localeCompare(right));
  if (entries.length === 0) {
    return "";
  }
  return `{${entries.map(([key, value]) => `${key}="${sanitizeLabelValue(value)}"`).join(",")}}`;
}
