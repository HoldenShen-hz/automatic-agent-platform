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

import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
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
    this.metricPrefix = options.metricPrefix ?? "";
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
    runtimeMetricsRegistry.reset();
  }

  /**
   * Export all metrics in Prometheus exposition format.
   */
  public export(): string {
    const lines: string[] = [];
    const emittedMetricNames = new Set<string>();
    const metricName = (name: string) => this.formatMetricName(name);

    // Add metric help and type headers
    emittedMetricNames.add("process_cpu_seconds_total");
    lines.push(`# HELP ${metricName("process_cpu_seconds_total")} Total user and system CPU time spent in seconds.`);
    lines.push(`# TYPE ${metricName("process_cpu_seconds_total")} counter`);
    lines.push(`${metricName("process_cpu_seconds_total")} ${this.getCpuSeconds()}`);

    lines.push("");
    emittedMetricNames.add("process_meminfo_bytes");
    lines.push(`# HELP ${metricName("process_meminfo_bytes")} Process memory information in bytes.`);
    lines.push(`# TYPE ${metricName("process_meminfo_bytes")} gauge`);
    const memUsage = this.getMemoryUsage();
    lines.push(`${metricName("process_meminfo_bytes")}{type="rss"} ${memUsage.rss}`);
    lines.push(`${metricName("process_meminfo_bytes")}{type="heap_total"} ${memUsage.heapTotal}`);
    lines.push(`${metricName("process_meminfo_bytes")}{type="heap_used"} ${memUsage.heapUsed}`);
    lines.push(`${metricName("process_meminfo_bytes")}{type="external"} ${memUsage.external}`);

    lines.push("");
    emittedMetricNames.add("http_requests_total");
    lines.push(`# HELP ${metricName("http_requests_total")} Total number of HTTP requests.`);
    lines.push(`# TYPE ${metricName("http_requests_total")} counter`);
    for (const metric of this.getHttpRequestCounts()) {
      const path = sanitizeLabelValue(metric.path);
      lines.push(`${metricName("http_requests_total")}{method="${metric.method}",path="${path}",status="${metric.status}"} ${metric.count}`);
    }

    lines.push("");
    emittedMetricNames.add("http_request_duration_ms");
    lines.push(`# HELP ${metricName("http_request_duration_ms")} HTTP request duration in milliseconds.`);
    lines.push(`# TYPE ${metricName("http_request_duration_ms")} histogram`);
    for (const line of this.renderHistogramSeries("http_request_duration_ms")) {
      lines.push(line);
    }

    lines.push("");
    emittedMetricNames.add("task_executions_total");
    lines.push(`# HELP ${metricName("task_executions_total")} Total number of task executions by status.`);
    lines.push(`# TYPE ${metricName("task_executions_total")} counter`);
    const executionMetrics = this.getExecutionMetrics();
    for (const [status, count] of Object.entries(executionMetrics)) {
      lines.push(`${metricName("task_executions_total")}{status="${status}"} ${count}`);
    }

    lines.push("");
    emittedMetricNames.add("agent_rounds_total");
    lines.push(`# HELP ${metricName("agent_rounds_total")} Total number of agent rounds (workflow step completions).`);
    lines.push(`# TYPE ${metricName("agent_rounds_total")} counter`);
    lines.push(`${metricName("agent_rounds_total")} ${this.getAgentRoundsCount()}`);

    lines.push("");
    emittedMetricNames.add("process_start_time_seconds");
    lines.push(`# HELP ${metricName("process_start_time_seconds")} Start time of the process since unix epoch in seconds.`);
    lines.push(`# TYPE ${metricName("process_start_time_seconds")} gauge`);
    lines.push(`${metricName("process_start_time_seconds")} ${Math.floor(this.processStartTime / 1000)}`);

    lines.push("");
    emittedMetricNames.add("process_uptime_seconds");
    lines.push(`# HELP ${metricName("process_uptime_seconds")} Process uptime in seconds.`);
    lines.push(`# TYPE ${metricName("process_uptime_seconds")} gauge`);
    lines.push(`${metricName("process_uptime_seconds")} ${Math.floor((Date.now() - this.processStartTime) / 1000)}`);

    const summary = this.metricsService.buildSummary(nowIso());

    lines.push("");
    emittedMetricNames.add("active_executions");
    lines.push(`# HELP ${metricName("active_executions")} Current active executions.`);
    lines.push(`# TYPE ${metricName("active_executions")} gauge`);
    lines.push(`${metricName("active_executions")} ${summary.runtimeMetrics.activeExecutions}`);

    lines.push("");
    emittedMetricNames.add("queued_tasks");
    lines.push(`# HELP ${metricName("queued_tasks")} Current queued tasks.`);
    lines.push(`# TYPE ${metricName("queued_tasks")} gauge`);
    lines.push(`${metricName("queued_tasks")} ${summary.runtimeMetrics.queuedTasks}`);

    lines.push("");
    emittedMetricNames.add("dead_letter_count");
    lines.push(`# HELP ${metricName("dead_letter_count")} Current dead letter count.`);
    lines.push(`# TYPE ${metricName("dead_letter_count")} gauge`);
    lines.push(`${metricName("dead_letter_count")} ${summary.recoveryMetrics.deadLetterCount}`);

    lines.push("");
    emittedMetricNames.add("provider_success_rate");
    lines.push(`# HELP ${metricName("provider_success_rate")} Rolling provider success rate.`);
    lines.push(`# TYPE ${metricName("provider_success_rate")} gauge`);
    lines.push(`${metricName("provider_success_rate")} ${summary.runtimeMetrics.providerSuccessRate}`);

    lines.push("");
    emittedMetricNames.add("memory_rss_bytes");
    lines.push(`# HELP ${metricName("memory_rss_bytes")} Resident set size in bytes.`);
    lines.push(`# TYPE ${metricName("memory_rss_bytes")} gauge`);
    lines.push(`${metricName("memory_rss_bytes")} ${Math.round(summary.runtimeMetrics.memoryRssMb * 1024 * 1024)}`);

    lines.push("");
    emittedMetricNames.add("memory_heap_used_bytes");
    lines.push(`# HELP ${metricName("memory_heap_used_bytes")} Heap used in bytes.`);
    lines.push(`# TYPE ${metricName("memory_heap_used_bytes")} gauge`);
    lines.push(`${metricName("memory_heap_used_bytes")} ${memUsage.heapUsed}`);

    lines.push("");
    emittedMetricNames.add("event_loop_lag_ms");
    lines.push(`# HELP ${metricName("event_loop_lag_ms")} Event loop lag in milliseconds.`);
    lines.push(`# TYPE ${metricName("event_loop_lag_ms")} gauge`);
    lines.push(`${metricName("event_loop_lag_ms")} ${summary.runtimeMetrics.eventLoopLagMs ?? 0}`);

    lines.push("");
    emittedMetricNames.add("redis_connection_errors");
    lines.push(`# HELP ${metricName("redis_connection_errors")} Total Redis connection errors observed by runtime components.`);
    lines.push(`# TYPE ${metricName("redis_connection_errors")} counter`);
    for (const line of this.renderCounterSeries("redis_connection_errors")) {
      lines.push(line);
    }

    lines.push("");
    emittedMetricNames.add("queue_enqueue_failures_total");
    lines.push(`# HELP ${metricName("queue_enqueue_failures_total")} Total queue enqueue write failures observed by backend and mode.`);
    lines.push(`# TYPE ${metricName("queue_enqueue_failures_total")} counter`);
    for (const line of this.renderCounterSeries("queue_enqueue_failures_total")) {
      lines.push(line);
    }

    lines.push("");
    emittedMetricNames.add("alert_delivery_failures_total");
    lines.push(`# HELP ${metricName("alert_delivery_failures_total")} Total alert delivery failures observed by channel.`);
    lines.push(`# TYPE ${metricName("alert_delivery_failures_total")} counter`);
    for (const line of this.renderCounterSeries("alert_delivery_failures_total")) {
      lines.push(line);
    }

    lines.push("");
    emittedMetricNames.add("healthy_workers");
    lines.push(`# HELP ${metricName("healthy_workers")} Healthy workers available.`);
    lines.push(`# TYPE ${metricName("healthy_workers")} gauge`);
    lines.push(`${metricName("healthy_workers")} ${summary.runtimeMetrics.workerHealth.healthyWorkers}`);

    lines.push("");
    emittedMetricNames.add("total_workers");
    lines.push(`# HELP ${metricName("total_workers")} Total workers registered.`);
    lines.push(`# TYPE ${metricName("total_workers")} gauge`);
    lines.push(`${metricName("total_workers")} ${summary.runtimeMetrics.workerHealth.totalWorkers}`);

    const diskUsage = this.getDiskUsage();
    lines.push("");
    emittedMetricNames.add("disk_total_bytes");
    lines.push(`# HELP ${metricName("disk_total_bytes")} Total bytes available in the current workspace filesystem.`);
    lines.push(`# TYPE ${metricName("disk_total_bytes")} gauge`);
    lines.push(`${metricName("disk_total_bytes")} ${diskUsage.totalBytes}`);

    lines.push("");
    emittedMetricNames.add("disk_free_bytes");
    lines.push(`# HELP ${metricName("disk_free_bytes")} Free bytes available in the current workspace filesystem.`);
    lines.push(`# TYPE ${metricName("disk_free_bytes")} gauge`);
    lines.push(`${metricName("disk_free_bytes")} ${diskUsage.freeBytes}`);

    lines.push("");
    emittedMetricNames.add("disk_used_ratio");
    lines.push(`# HELP ${metricName("disk_used_ratio")} Used ratio of the current workspace filesystem.`);
    lines.push(`# TYPE ${metricName("disk_used_ratio")} gauge`);
    lines.push(`${metricName("disk_used_ratio")} ${diskUsage.usedRatio}`);

    lines.push("");
    emittedMetricNames.add("oapeflir_loop_duration_ms");
    lines.push(`# HELP ${metricName("oapeflir_loop_duration_ms")} OAPEFLIR stage duration in milliseconds.`);
    lines.push(`# TYPE ${metricName("oapeflir_loop_duration_ms")} histogram`);
    for (const line of this.renderHistogramSeries("oapeflir_loop_duration_ms")) {
      lines.push(line);
    }

    lines.push("");
    emittedMetricNames.add("oapeflir_stage_outcome_total");
    lines.push(`# HELP ${metricName("oapeflir_stage_outcome_total")} OAPEFLIR stage outcomes by result.`);
    lines.push(`# TYPE ${metricName("oapeflir_stage_outcome_total")} counter`);
    for (const line of this.renderCounterSeries("oapeflir_stage_outcome_total")) {
      lines.push(line);
    }

    lines.push("");
    emittedMetricNames.add("oapeflir_stage_entry_total");
    lines.push(`# HELP ${metricName("oapeflir_stage_entry_total")} OAPEFLIR stage entry count.`);
    lines.push(`# TYPE ${metricName("oapeflir_stage_entry_total")} counter`);
    for (const line of this.renderCounterSeries("oapeflir_stage_entry_total")) {
      lines.push(line);
    }

    lines.push("");
    emittedMetricNames.add("stage_duration_seconds");
    lines.push(`# HELP ${metricName("stage_duration_seconds")} OAPEFLIR stage duration in seconds (entry to exit).`);
    lines.push(`# TYPE ${metricName("stage_duration_seconds")} histogram`);
    for (const line of this.renderHistogramSeries("stage_duration_seconds")) {
      lines.push(line);
    }

    lines.push("");
    emittedMetricNames.add("llm_ttfb_seconds");
    lines.push(`# HELP ${metricName("llm_ttfb_seconds")} LLM time-to-first-token latency in seconds.`);
    lines.push(`# TYPE ${metricName("llm_ttfb_seconds")} histogram`);
    for (const line of this.renderHistogramSeries("llm_ttfb_seconds")) {
      lines.push(line);
    }

    lines.push("");
    emittedMetricNames.add("llm_total_seconds");
    lines.push(`# HELP ${metricName("llm_total_seconds")} LLM total request latency in seconds.`);
    lines.push(`# TYPE ${metricName("llm_total_seconds")} histogram`);
    for (const line of this.renderHistogramSeries("llm_total_seconds")) {
      lines.push(line);
    }

    lines.push("");
    emittedMetricNames.add("knowledge_query_duration_ms");
    lines.push(`# HELP ${metricName("knowledge_query_duration_ms")} Knowledge query duration in milliseconds.`);
    lines.push(`# TYPE ${metricName("knowledge_query_duration_ms")} histogram`);
    for (const line of this.renderHistogramSeries("knowledge_query_duration_ms")) {
      lines.push(line);
    }

    lines.push("");
    emittedMetricNames.add("knowledge_query_total");
    lines.push(`# HELP ${metricName("knowledge_query_total")} Knowledge queries by operation and result.`);
    lines.push(`# TYPE ${metricName("knowledge_query_total")} counter`);
    for (const line of this.renderCounterSeries("knowledge_query_total")) {
      lines.push(line);
    }

    for (const name of runtimeMetricsRegistry.listGaugeNames()) {
      if (emittedMetricNames.has(name)) {
        continue;
      }
      emittedMetricNames.add(name);
      lines.push("");
      lines.push(`# HELP ${metricName(name)} Runtime gauge ${name}.`);
      lines.push(`# TYPE ${metricName(name)} gauge`);
      for (const series of runtimeMetricsRegistry.getGauges(name)) {
        lines.push(`${metricName(name)}${formatPrometheusLabels(series.labels)} ${series.value}`);
      }
    }

    for (const name of runtimeMetricsRegistry.listCounterNames()) {
      if (emittedMetricNames.has(name)) {
        continue;
      }
      emittedMetricNames.add(name);
      lines.push("");
      lines.push(`# HELP ${metricName(name)} Runtime counter ${name}.`);
      lines.push(`# TYPE ${metricName(name)} counter`);
      for (const line of this.renderCounterSeries(name)) {
        lines.push(line);
      }
    }

    for (const name of runtimeMetricsRegistry.listHistogramNames()) {
      if (emittedMetricNames.has(name)) {
        continue;
      }
      emittedMetricNames.add(name);
      lines.push("");
      lines.push(`# HELP ${metricName(name)} Runtime histogram ${name}.`);
      lines.push(`# TYPE ${metricName(name)} histogram`);
      for (const line of this.renderHistogramSeries(name)) {
        lines.push(line);
      }
    }

    return lines.join("\n");
  }

  private formatMetricName(name: string): string {
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
      `${this.formatMetricName(name)}${formatPrometheusLabels(series.labels)} ${series.value}`
    ));
  }

  private renderHistogramSeries(name: string): string[] {
    const lines: string[] = [];
    for (const series of runtimeMetricsRegistry.getHistograms(name)) {
      let cumulative = 0;
      for (let index = 0; index < series.buckets.length; index += 1) {
        cumulative += series.bucketCounts[index] ?? 0;
        lines.push(`${this.formatMetricName(name)}_bucket${formatPrometheusLabels({ ...series.labels, le: String(series.buckets[index]) })} ${cumulative}`);
      }
      lines.push(`${this.formatMetricName(name)}_bucket${formatPrometheusLabels({ ...series.labels, le: "+Inf" })} ${series.count}`);
      lines.push(`${this.formatMetricName(name)}_sum${formatPrometheusLabels(series.labels)} ${series.sum}`);
      lines.push(`${this.formatMetricName(name)}_count${formatPrometheusLabels(series.labels)} ${series.count}`);
    }
    return lines;
  }
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
