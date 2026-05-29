import { useCallback, useMemo, useState } from "react";
import { useAnalyticsQuery } from "@aa/shared-state";
export const MAX_ANALYTICS_EXPORT_BYTES = 512 * 1024;
const LAYER_LABELS = {
    overview: "概览",
    tasks: "任务",
    workflows: "工作流",
    approvals: "审批",
    cost: "成本",
    agents: "代理",
};
function getMetricLayer(metric) {
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
function toNumericValue(value) {
    if (typeof value === "number") {
        return value;
    }
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
function ensureAnalyticsExportSize(payload) {
    const bytes = new TextEncoder().encode(payload).byteLength;
    if (bytes > MAX_ANALYTICS_EXPORT_BYTES) {
        throw new RangeError(`analytics.export_too_large:${bytes}`);
    }
    return payload;
}
export function buildAnalyticsExportPayload(format, metrics, timeSeriesData, breakdowns, dateRange) {
    if (format === "json") {
        return ensureAnalyticsExportSize(JSON.stringify({ metrics, timeSeriesData, breakdowns, dateRange }, null, 2));
    }
    return ensureAnalyticsExportSize([
        "label,value,layer,changePercent",
        ...metrics.map((metric) => [
            metric.label,
            toNumericValue(metric.value),
            getMetricLayer(metric),
            metric.changePercent ?? 0,
        ].join(",")),
    ].join("\n"));
}
export function mapAnalyticsToVm(metrics) {
    const layerSummaries = ["overview", "tasks", "workflows", "approvals", "cost", "agents"].map((layer) => {
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
function computeBreakdowns(metrics, layer) {
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
export function useAnalyticsVm() {
    const queryData = useAnalyticsQuery();
    const metrics = queryData.data ?? [];
    const [selectedLayer, setSelectedLayer] = useState("overview");
    const [chartConfig, setChartConfig] = useState({
        chartType: "bar",
        layer: "overview",
        timeRange: "7d",
    });
    const [dateRange, setDateRangeState] = useState({
        startDate: "2026-05-01",
        endDate: "2026-05-08",
    });
    const baseVm = useMemo(() => mapAnalyticsToVm(metrics), [metrics]);
    const availableLayers = useMemo(() => {
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
            const allLayers = ["tasks", "workflows", "approvals", "cost", "agents"];
            return allLayers.flatMap((layer) => computeBreakdowns(metrics, layer));
        }
        return computeBreakdowns(metrics, selectedLayer);
    }, [metrics, selectedLayer]);
    const breakdowns = useMemo(() => {
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
    const setLayer = useCallback((layer) => {
        setSelectedLayer(layer);
        setChartConfig((current) => ({ ...current, layer }));
    }, []);
    const setChartType = useCallback((chartType) => {
        setChartConfig((current) => ({ ...current, chartType }));
    }, []);
    const setTimeRange = useCallback((timeRange) => {
        setChartConfig((current) => ({ ...current, timeRange }));
    }, []);
    const setDateRange = useCallback((startDate, endDate) => {
        setDateRangeState({ startDate, endDate });
    }, []);
    const exportData = useCallback((format) => {
        const payload = buildAnalyticsExportPayload(format, metrics, timeSeriesData, breakdowns, dateRange);
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
    const getFilteredMetrics = useCallback(() => {
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
