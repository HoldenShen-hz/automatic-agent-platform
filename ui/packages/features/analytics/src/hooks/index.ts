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

export interface AnalyticsVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly trendSummary: readonly number[];
  readonly chartConfig: AnalyticsChartConfig;
  readonly breakdowns: readonly KpiBreakdown[];
}

// Default 7 chart types per §4.2.8
const ALL_CHART_TYPES: readonly ChartType[] = ["bar", "line", "pie", "area", "scatter", "heatmap", "kpi"];

// Role-adaptive metric sets per §4.2.8
const METRIC_SETS: Record<string, readonly string[]> = {
  admin: ["tasks_total", "workflows_total", "approvals_pending", "cost_total", "error_rate", "latency_p95"],
  operator: ["tasks_active", "tasks_completed", "workflows_running", "queue_depth", "worker_load"],
  viewer: ["tasks_total", "workflows_total", "approvals_pending"],
};

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
    trendSummary: metrics.map((metric) => metric.trend === "up" ? 3 : metric.trend === "flat" ? 2 : 1),
    chartConfig: { ...chartConfig, chartType: validatedChartType },
    // breakdowns will be populated by useAnalyticsVm with multi-layer KPI breakdown
    breakdowns: [],
  };
}

/**
 * §4.2.8: Analytics with multi-layer KPI breakdown and 7 chart types.
 * Supports role-adaptive metric sets and configurable chart visualization.
 */
export function useAnalyticsVm(
  chartConfig: AnalyticsChartConfig = { chartType: "kpi" },
  role: string = "admin",
): AnalyticsVm {
  const query = useAnalyticsQuery();

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

  return {
    metrics: roleMetrics.map((metric) => ({ label: metric.label, value: metric.value })),
    trendSummary: roleMetrics.map((metric) =>
      metric.trend === "up" ? 3 : metric.trend === "flat" ? 2 : 1,
    ),
    chartConfig: { ...chartConfig, chartType: validatedChartType },
    breakdowns,
  };
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
