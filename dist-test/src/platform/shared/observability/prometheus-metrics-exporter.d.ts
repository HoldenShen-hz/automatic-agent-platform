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
export declare class PrometheusMetricsExporter {
    private readonly metricPrefix;
    private readonly db;
    private readonly metricsService;
    private processStartTime;
    constructor(db: AuthoritativeSqlDatabase, metricsService: MetricsService, options?: PrometheusMetricsExporterOptions);
    /**
     * Record an HTTP request for metrics.
     */
    recordHttpRequest(method: string, path: string, status: number, durationMs?: number | null): void;
    /**
     * Reset HTTP request counters (typically called after scraping).
     */
    resetHttpRequestCounts(): void;
    /**
     * Export all metrics in Prometheus exposition format.
     */
    export(): string;
    private getCpuSeconds;
    private getMemoryUsage;
    private getDiskUsage;
    private getExecutionMetrics;
    private getAgentRoundsCount;
    private getHttpRequestCounts;
    private renderCounterSeries;
    private renderHistogramSeries;
}
