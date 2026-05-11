import { useCallback, useMemo, useState } from "react";
import { useAnalyticsQuery } from "@aa/shared-state";
import type { AnalyticsMetricDTO } from "@aa/shared-types";

export type ChartType = "bar" | "line" | "pie" | "area" | "heatmap";
export type KpiLayer = "overview" | "tasks" | "workflows" | "approvals" | "cost" | "agents";
export type AnalyticsExportFormat = "csv" | "json";

export interface AnalyticsTimeSeriesPoint {
  readonly timestamp: string;
  readonly value: number;
}

export interface AnalyticsBreakdown {
  readonly dimension: "time" | "domain" | "layer";
  readonly groups: readonly { label: string; value: number }[];
}

export interface KpiBreakdown {
  readonly layer: KpiLayer;
  readonly label: string;
  readonly value: number;
  readonly trend: number;
  readonly changePercent: number;
}

export interface AnalyticsChartConfig {
  readonly chartType: ChartType;
  readonly layer: KpiLayer;
  readonly timeRange: "24h" | "7d" | "30d" | "90d";
}

export interface AnalyticsVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly trendSummary: readonly number[];
  readonly timeSeriesData: readonly AnalyticsTimeSeriesPoint[];
  readonly dateRange: {
    startDate: string;
    endDate: string;
  };
  readonly breakdowns: readonly AnalyticsBreakdown[];
  readonly layerSummaries: readonly {
    layer: KpiLayer;
    label: string;
    metricCount: number;
    netChangePercent: number;
  }[];
  readonly kpiBreakdowns: readonly KpiBreakdown[];
  readonly selectedLayer: KpiLayer;
  readonly chartConfig: AnalyticsChartConfig;
  readonly availableLayers: readonly KpiLayer[];
  setLayer(layer: KpiLayer): void;
  setChartType(chartType: ChartType): void;
  setTimeRange(timeRange: AnalyticsChartConfig["timeRange"]): void;
  setDateRange(startDate: string, endDate: string): void;
  exportData(format: AnalyticsExportFormat): void;
  getFilteredMetrics(): readonly AnalyticsMetricDTO[];
}

const LAYER_LABELS: Record<KpiLayer, string> = {
  overview: "概览",
  tasks: "任务",
  workflows: "工作流",
  approvals: "审批",
  cost: "成本",
  agents: "代理",
};

function getMetricLayer(metric: AnalyticsMetricDTO): KpiLayer {
  if (metric.layer != null) {
    return metric.layer;
  }
  const label = metric.label.toLowerCase();
  if (label.includes("task") || label.includes("任务")) {
    return "tasks";
  }
  if (label.includes("workflow") || label.includes("工作流")) {
    return "workflows";
  }
  if (label.includes("approval") || label.includes("审批")) {
    return "approvals";
  }
  if (label.includes("cost") || label.includes("成本") || label.includes("预算")) {
    return "cost";
  }
  if (label.includes("agent") || label.includes("代理")) {
    return "agents";
  }
  return "overview";
}

function toNumericValue(value: string | number): number {
  if (typeof value === "number") {
    return value;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mapAnalyticsToVm(
  metrics: readonly AnalyticsMetricDTO[],
): Pick<AnalyticsVm, "metrics" | "trendSummary" | "layerSummaries"> {
  const layerSummaries = (["overview", "tasks", "workflows", "approvals", "cost", "agents"] as const).map((layer) => {
    const layerMetrics = layer === "overview"
      ? metrics
      : metrics.filter((metric) => getMetricLayer(metric) === layer);
    return {
      layer,
      label: LAYER_LABELS[layer],
      metricCount: layerMetrics.length,
      netChangePercent: layerMetrics.reduce((total, metric) => total + (metric.changePercent ?? 0), 0),
    };
  });

  return {
    metrics: metrics.map((metric) => ({ label: metric.label, value: metric.value })),
    trendSummary: metrics.map((metric) => toNumericValue(metric.value)),
    layerSummaries,
  };
}

function computeBreakdowns(metrics: readonly AnalyticsMetricDTO[], layer: KpiLayer): KpiBreakdown[] {
  const layerMetrics = layer === "overview"
    ? metrics
    : metrics.filter((metric) => getMetricLayer(metric) === layer);

  return layerMetrics.map((metric) => ({
    layer: getMetricLayer(metric),
    label: metric.label,
    value: toNumericValue(metric.value),
    trend: metric.trend === "up" ? 3 : metric.trend === "flat" ? 2 : 1,
    changePercent: metric.changePercent ?? 0,
  }));
}

export function useAnalyticsVm(): AnalyticsVm {
  const queryData = useAnalyticsQuery();
  const metrics = queryData.data ?? [];

  const [selectedLayer, setSelectedLayer] = useState<KpiLayer>("overview");
  const [chartConfig, setChartConfig] = useState<AnalyticsChartConfig>({
    chartType: "bar",
    layer: "overview",
    timeRange: "7d",
  });
  const [dateRange, setDateRangeState] = useState({
    startDate: "2026-05-01",
    endDate: "2026-05-08",
  });

  const baseVm = useMemo(() => mapAnalyticsToVm(metrics), [metrics]);
  const availableLayers = useMemo((): readonly KpiLayer[] => {
    return ["overview", "tasks", "workflows", "approvals", "cost", "agents"];
  }, []);

  const timeSeriesData = useMemo(() => {
    const baseTimestamp = Date.UTC(2026, 4, 8);
    return metrics.map((metric, index) => ({
      timestamp: new Date(baseTimestamp - (metrics.length - index - 1) * 24 * 60 * 60 * 1000).toISOString(),
      value: toNumericValue(metric.value),
    }));
  }, [metrics]);

  const kpiBreakdowns = useMemo(() => {
    if (selectedLayer === "overview") {
      const allLayers: KpiLayer[] = ["tasks", "workflows", "approvals", "cost", "agents"];
      return allLayers.flatMap((layer) => computeBreakdowns(metrics, layer));
    }
    return computeBreakdowns(metrics, selectedLayer);
  }, [metrics, selectedLayer]);

  const breakdowns = useMemo((): readonly AnalyticsBreakdown[] => {
    const timeGroups = timeSeriesData.map((point) => ({
      label: point.timestamp.slice(0, 10),
      value: point.value,
    }));
    const groupedByLayer = availableLayers
      .filter((layer) => layer !== "overview")
      .map((layer) => ({
        label: LAYER_LABELS[layer],
        value: computeBreakdowns(metrics, layer).reduce((sum, item) => sum + item.value, 0),
      }))
      .filter((group) => group.value > 0);

    return [
      { dimension: "time", groups: timeGroups },
      { dimension: "domain", groups: groupedByLayer },
      { dimension: "layer", groups: groupedByLayer },
    ];
  }, [availableLayers, metrics, timeSeriesData]);

  const setLayer = useCallback((layer: KpiLayer) => {
    setSelectedLayer(layer);
    setChartConfig((current) => ({ ...current, layer }));
  }, []);

  const setChartType = useCallback((chartType: ChartType) => {
    setChartConfig((current) => ({ ...current, chartType }));
  }, []);

  const setTimeRange = useCallback((timeRange: AnalyticsChartConfig["timeRange"]) => {
    setChartConfig((current) => ({ ...current, timeRange }));
  }, []);

  const setDateRange = useCallback((startDate: string, endDate: string) => {
    setDateRangeState({ startDate, endDate });
  }, []);

  const exportData = useCallback((format: AnalyticsExportFormat) => {
    const payload = format === "json"
      ? JSON.stringify({ metrics, timeSeriesData, breakdowns, dateRange }, null, 2)
      : [
        "label,value,layer,changePercent",
        ...metrics.map((metric) => [
          metric.label,
          toNumericValue(metric.value),
          getMetricLayer(metric),
          metric.changePercent ?? 0,
        ].join(",")),
      ].join("\n");

    const blob = new Blob([payload], {
      type: format === "json" ? "application/json" : "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `analytics-${dateRange.startDate}-${dateRange.endDate}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [breakdowns, dateRange, metrics, timeSeriesData]);

  const getFilteredMetrics = useCallback((): readonly AnalyticsMetricDTO[] => {
    if (selectedLayer === "overview") {
      return metrics;
    }
    return metrics.filter((metric) => getMetricLayer(metric) === selectedLayer);
  }, [metrics, selectedLayer]);

  return {
    ...baseVm,
    timeSeriesData,
    dateRange,
    breakdowns,
    kpiBreakdowns,
    selectedLayer,
    chartConfig,
    availableLayers,
    setLayer,
    setChartType,
    setTimeRange,
    setDateRange,
    exportData,
    getFilteredMetrics,
  };
}
