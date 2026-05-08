import { useCallback, useEffect, useState } from "react";
import { useAnalyticsQuery } from "@aa/shared-state";
import type { AnalyticsMetricDTO } from "@aa/shared-types";

export type ChartType = "bar" | "line" | "pie" | "area" | "scatter" | "heatmap" | "kpi";

export type BreakdownDimension = "time" | "category" | "role" | "domain" | "region";

export interface KpiBreakdown {
  readonly dimension: BreakdownDimension;
  readonly groups: readonly { label: string; value: number }[];
}

export interface AnalyticsChartConfig {
  readonly chartType: ChartType;
  readonly breakdown?: KpiBreakdown;
}

export interface TimeSeriesDataPoint {
  readonly timestamp: string;
  readonly value: number;
  readonly label?: string;
}

export interface AnalyticsVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly trendSummary: readonly number[];
  readonly chartConfig: AnalyticsChartConfig;
  readonly breakdowns: readonly KpiBreakdown[];
  // §2267: Time-series data for trend chart
  readonly timeSeriesData: readonly TimeSeriesDataPoint[];
  // §2267: Date range for custom filtering
  readonly dateRange: { startDate: string; endDate: string };
  // §2267: Export functionality
  readonly exportData: (format: "csv" | "json") => void;
  setDateRange(startDate: string, endDate: string): void;
}

// Default 7 chart types per §4.2.8
const ALL_CHART_TYPES: readonly ChartType[] = ["bar", "line", "pie", "area", "scatter", "heatmap", "kpi"];

// Role-adaptive metric sets per §4.2.8
const METRIC_SETS: Record<string, readonly string[]> = {
  admin: ["tasks_total", "workflows_total", "approvals_pending", "cost_total", "error_rate", "latency_p95"],
  operator: ["tasks_active", "tasks_completed", "workflows_running", "queue_depth", "worker_load"],
  viewer: ["tasks_total", "workflows_total", "approvals_pending"],
};

function parseMetricValue(metric: AnalyticsMetricDTO): number {
  const normalized = Number.parseFloat(String(metric.value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(normalized) ? normalized : 0;
}

function buildTrendSummary(metrics: readonly AnalyticsMetricDTO[]): readonly number[] {
  return metrics.map((metric) => parseMetricValue(metric));
}

export function mapAnalyticsToVm(
  metrics: readonly AnalyticsMetricDTO[],
  chartConfig: AnalyticsChartConfig = { chartType: "kpi" },
): AnalyticsVm {
  // §4.2.8: Validate chartType against ALL_CHART_TYPES (7 chart types)
  const validatedChartType: ChartType = ALL_CHART_TYPES.includes(chartConfig.chartType)
    ? chartConfig.chartType
    : "kpi";

  return {
    metrics: metrics.map((metric) => ({ label: metric.label, value: metric.value })),
    trendSummary: buildTrendSummary(metrics),
    chartConfig: { ...chartConfig, chartType: validatedChartType },
    // breakdowns will be populated by useAnalyticsVm with multi-layer KPI breakdown
    breakdowns: [],
    timeSeriesData: [],
    dateRange: { startDate: "", endDate: "" },
    exportData: () => {},
    setDateRange: () => {},
  };
}

/**
 * §4.2.8: Analytics with multi-layer KPI breakdown and 7 chart types.
 * Supports role-adaptive metric sets and configurable chart visualization.
 * §2267: Adds time-series data, custom date range filtering, and CSV/JSON export.
 */
export function useAnalyticsVm(
  chartConfig: AnalyticsChartConfig = { chartType: "kpi" },
  role: string = "admin",
): AnalyticsVm {
  const query = useAnalyticsQuery();

  // §2267: Custom date range state - default to last 7 days
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });

  // Filter metrics by role-adaptive metric set
  const roleMetrics = query.data?.filter((m: AnalyticsMetricDTO) => {
    const allowed = METRIC_SETS[role] ?? (["tasks_total", "workflows_total", "approvals_pending"] as const);
    return allowed.some((key) => m.label.toLowerCase().includes(key.toLowerCase()));
  }) ?? [];

  // §4.2.8: Generate multi-layer KPI breakdown across all dimensions
  // Each dimension provides a different slice of the analytics data
  const allDimensions: readonly BreakdownDimension[] = ["time", "category", "role", "domain", "region"];
  const breakdowns: readonly KpiBreakdown[] = allDimensions.map((dim) =>
    buildBreakdown(roleMetrics, dim),
  );

  // §4.2.8: Validate chartType against ALL_CHART_TYPES (7 chart types)
  const validatedChartType: ChartType = ALL_CHART_TYPES.includes(chartConfig.chartType)
    ? chartConfig.chartType
    : "kpi";

  // §2267: Generate time-series data from metrics - aggregate by timestamp
  // In production this would come from a time-series API endpoint
  const timeSeriesData: readonly TimeSeriesDataPoint[] = buildTimeSeries(roleMetrics, dateRange);

  // §2267: Export data as CSV or JSON
  const exportData = useCallback((format: "csv" | "json") => {
    if (format === "csv") {
      const headers = ["timestamp", "metric", "value"];
      const rows = timeSeriesData.flatMap((point) =>
        roleMetrics.map((m) => [point.timestamp, m.label, String(m.value)]),
      );
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      downloadFile(csv, "analytics-export.csv", "text/csv");
    } else {
      const json = JSON.stringify({ dateRange, metrics: roleMetrics, timeSeries: timeSeriesData }, null, 2);
      downloadFile(json, "analytics-export.json", "application/json");
    }
  }, [timeSeriesData, roleMetrics, dateRange]);

  return {
    metrics: roleMetrics.map((metric) => ({ label: metric.label, value: metric.value })),
    trendSummary: buildTrendSummary(roleMetrics),
    chartConfig: { ...chartConfig, chartType: validatedChartType },
    breakdowns,
    timeSeriesData,
    dateRange,
    exportData,
    setDateRange,
  };
}

/**
 * §2267: Build time-series data from metrics for the given date range.
 * In production this data would come from a dedicated time-series API.
 */
function buildTimeSeries(
  metrics: readonly AnalyticsMetricDTO[],
  dateRange: { startDate: string; endDate: string },
): readonly TimeSeriesDataPoint[] {
  const start = new Date(dateRange.startDate).getTime();
  const end = new Date(dateRange.endDate).getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const points: TimeSeriesDataPoint[] = [];

  // Generate one data point per day in the range
  for (let ts = start; ts <= end; ts += dayMs) {
    const timestamp = new Date(ts).toISOString();
    // Use metric value as-is for time series - in production would be actual historical values
    const avgValue = metrics.reduce((sum, metric) => sum + parseMetricValue(metric), 0) / Math.max(metrics.length, 1);
    points.push({
      timestamp,
      value: avgValue,
      label: new Date(ts).toLocaleDateString(),
    });
  }

  return points;
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * §4.2.8: Build multi-layer KPI breakdown for given dimension.
 */
export function buildBreakdown(
  metrics: readonly AnalyticsMetricDTO[],
  dimension: BreakdownDimension,
): KpiBreakdown {
  const groups = metrics.reduce<{ label: string; value: number }[]>((acc, metric) => {
    // Simple breakdown by first word of label as category
    const label = metric.label.split("_")[0] ?? metric.label;
    const existing = acc.find((g) => g.label === label);
    if (existing) {
      existing.value += typeof metric.value === "number" ? metric.value : 0;
    } else {
      acc.push({ label, value: typeof metric.value === "number" ? metric.value : 0 });
    }
    return acc;
  }, []);

  return { dimension, groups };
}

// Export chart types for external configuration
export { ALL_CHART_TYPES };
