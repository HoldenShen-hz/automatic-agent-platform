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

    // Add metric help and type headers
    lines.push("# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds.");
    lines.push("# TYPE process_cpu_seconds_total counter");
    lines.push(`process_cpu_seconds_total ${this.getCpuSeconds()}`);

    lines.push("");
    lines.push("# HELP process_meminfo_bytes Process memory information in bytes.");
    lines.push("# TYPE process_meminfo_bytes gauge");
    const memUsage = this.getMemoryUsage();
    lines.push(`process_meminfo_bytes{type="rss"} ${memUsage.rss}`);
    lines.push(`process_meminfo_bytes{type="heap_total"} ${memUsage.heapTotal}`);
    lines.push(`process_meminfo_bytes{type="heap_used"} ${memUsage.heapUsed}`);
    lines.push(`process_meminfo_bytes{type="external"} ${memUsage.external}`);

    lines.push("");
    lines.push("# HELP http_requests_total Total number of HTTP requests.");
    lines.push("# TYPE http_requests_total counter");
    for (const metric of this.getHttpRequestCounts()) {
      const path = sanitizeLabelValue(metric.path);
      lines.push(`http_requests_total{method="${metric.method}",path="${path}",status="${metric.status}"} ${metric.count}`);
    }

    lines.push("");
    lines.push("# HELP http_request_duration_ms HTTP request duration in milliseconds.");
    lines.push("# TYPE http_request_duration_ms histogram");
    for (const line of this.renderHistogramSeries("http_request_duration_ms")) {
      lines.push(line);
    }

    lines.push("");
    lines.push("# HELP task_executions_total Total number of task executions by status.");
    lines.push("# TYPE task_executions_total counter");
    const executionMetrics = this.getExecutionMetrics();
    for (const [status, count] of Object.entries(executionMetrics)) {
      lines.push(`task_executions_total{status="${status}"} ${count}`);
    }

    lines.push("");
    lines.push("# HELP agent_rounds_total Total number of agent rounds (workflow step completions).");
    lines.push("# TYPE agent_rounds_total counter");
    lines.push(`agent_rounds_total ${this.getAgentRoundsCount()}`);

    lines.push("");
    lines.push("# HELP process_start_time_seconds Start time of the process since unix epoch in seconds.");
    lines.push("# TYPE process_start_time_seconds gauge");
    lines.push(`process_start_time_seconds ${Math.floor(this.processStartTime / 1000)}`);

    lines.push("");
    lines.push("# HELP process_uptime_seconds Process uptime in seconds.");
    lines.push("# TYPE process_uptime_seconds gauge");
    lines.push(`process_uptime_seconds ${Math.floor((Date.now() - this.processStartTime) / 1000)}`);

    const summary = this.metricsService.buildSummary(nowIso());

    lines.push("");
    lines.push("# HELP active_executions Current active executions.");
    lines.push("# TYPE active_executions gauge");
    lines.push(`active_executions ${summary.runtimeMetrics.activeExecutions}`);

    lines.push("");
    lines.push("# HELP queued_tasks Current queued tasks.");
    lines.push("# TYPE queued_tasks gauge");
    lines.push(`queued_tasks ${summary.runtimeMetrics.queuedTasks}`);

    lines.push("");
    lines.push("# HELP dead_letter_count Current dead letter count.");
    lines.push("# TYPE dead_letter_count gauge");
    lines.push(`dead_letter_count ${summary.recoveryMetrics.deadLetterCount}`);

    lines.push("");
    lines.push("# HELP provider_success_rate Rolling provider success rate.");
    lines.push("# TYPE provider_success_rate gauge");
    lines.push(`provider_success_rate ${summary.runtimeMetrics.providerSuccessRate}`);

    lines.push("");
    lines.push("# HELP memory_rss_bytes Resident set size in bytes.");
    lines.push("# TYPE memory_rss_bytes gauge");
    lines.push(`memory_rss_bytes ${Math.round(summary.runtimeMetrics.memoryRssMb * 1024 * 1024)}`);

    lines.push("");
    lines.push("# HELP memory_heap_used_bytes Heap used in bytes.");
    lines.push("# TYPE memory_heap_used_bytes gauge");
    lines.push(`memory_heap_used_bytes ${memUsage.heapUsed}`);

    lines.push("");
    lines.push("# HELP event_loop_lag_ms Event loop lag in milliseconds.");
    lines.push("# TYPE event_loop_lag_ms gauge");
    lines.push(`event_loop_lag_ms ${summary.runtimeMetrics.eventLoopLagMs ?? 0}`);

    lines.push("");
    lines.push("# HELP healthy_workers Healthy workers available.");
    lines.push("# TYPE healthy_workers gauge");
    lines.push(`healthy_workers ${summary.runtimeMetrics.workerHealth.healthyWorkers}`);

    lines.push("");
    lines.push("# HELP total_workers Total workers registered.");
    lines.push("# TYPE total_workers gauge");
    lines.push(`total_workers ${summary.runtimeMetrics.workerHealth.totalWorkers}`);

    lines.push("");
    lines.push("# HELP oapeflir_loop_duration_ms OAPEFLIR stage duration in milliseconds.");
    lines.push("# TYPE oapeflir_loop_duration_ms histogram");
    for (const line of this.renderHistogramSeries("oapeflir_loop_duration_ms")) {
      lines.push(line);
    }

    lines.push("");
    lines.push("# HELP oapeflir_stage_outcome_total OAPEFLIR stage outcomes by result.");
    lines.push("# TYPE oapeflir_stage_outcome_total counter");
    for (const line of this.renderCounterSeries("oapeflir_stage_outcome_total")) {
      lines.push(line);
    }

    lines.push("");
    lines.push("# HELP knowledge_query_duration_ms Knowledge query duration in milliseconds.");
    lines.push("# TYPE knowledge_query_duration_ms histogram");
    for (const line of this.renderHistogramSeries("knowledge_query_duration_ms")) {
      lines.push(line);
    }

    lines.push("");
    lines.push("# HELP knowledge_query_total Knowledge queries by operation and result.");
    lines.push("# TYPE knowledge_query_total counter");
    for (const line of this.renderCounterSeries("knowledge_query_total")) {
      lines.push(line);
    }

    return lines.join("\n");
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
      `${name}${formatPrometheusLabels(series.labels)} ${series.value}`
    ));
  }

  private renderHistogramSeries(name: string): string[] {
    const lines: string[] = [];
    for (const series of runtimeMetricsRegistry.getHistograms(name)) {
      let cumulative = 0;
      for (let index = 0; index < series.buckets.length; index += 1) {
        cumulative += series.bucketCounts[index] ?? 0;
        lines.push(`${name}_bucket${formatPrometheusLabels({ ...series.labels, le: String(series.buckets[index]) })} ${cumulative}`);
      }
      lines.push(`${name}_bucket${formatPrometheusLabels({ ...series.labels, le: "+Inf" })} ${series.count}`);
      lines.push(`${name}_sum${formatPrometheusLabels(series.labels)} ${series.sum}`);
      lines.push(`${name}_count${formatPrometheusLabels(series.labels)} ${series.count}`);
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
  const entries = Object.entries(labels);
  if (entries.length === 0) {
    return "";
  }
  return `{${entries.map(([key, value]) => `${key}="${sanitizeLabelValue(value)}"`).join(",")}}`;
}
