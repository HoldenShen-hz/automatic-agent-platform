import { useCallback, useMemo, useState } from "react";
import { useAnalyticsQuery } from "@aa/shared-state";
import type { AnalyticsMetricDTO } from "@aa/shared-types";

export type ChartType = "bar" | "line" | "pie" | "area" | "heatmap";
export type KpiLayer = "overview" | "tasks" | "workflows" | "approvals" | "cost" | "agents";

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
    trendSummary: metrics.map((metric) => metric.trend === "up" ? 3 : metric.trend === "flat" ? 2 : 1),
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
    value: typeof metric.value === "string" ? parseFloat(String(metric.value)) : (metric.value as number),
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

  const baseVm = useMemo(() => mapAnalyticsToVm(metrics), [metrics]);

  const kpiBreakdowns = useMemo(() => {
    if (selectedLayer === "overview") {
      const allLayers: KpiLayer[] = ["tasks", "workflows", "approvals", "cost", "agents"];
      return allLayers.flatMap((layer) => computeBreakdowns(metrics, layer));
    }
    return computeBreakdowns(metrics, selectedLayer);
  }, [metrics, selectedLayer]);

  const availableLayers = useMemo((): readonly KpiLayer[] => {
    return ["overview", "tasks", "workflows", "approvals", "cost", "agents"];
  }, []);

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

  const getFilteredMetrics = useCallback((): readonly AnalyticsMetricDTO[] => {
    if (selectedLayer === "overview") {
      return metrics;
    }
    return metrics.filter((metric) => getMetricLayer(metric) === selectedLayer);
  }, [metrics, selectedLayer]);

  return {
    ...baseVm,
    kpiBreakdowns,
    selectedLayer,
    chartConfig,
    availableLayers,
    setLayer,
    setChartType,
    setTimeRange,
    getFilteredMetrics,
  };
}
