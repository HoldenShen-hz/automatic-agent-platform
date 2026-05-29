import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BarChart, EChartSurface, FeatureScaffold, GaugeChart, HeatmapGrid, MetricGrid, MiniTrendBars, PieChart, ScatterPlot, TimelineChart, createPanelStyle, designTokens, resolveTheme, } from "@aa/ui-core";
import { useState } from "react";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useThemeState } from "@aa/shared-state";
import { useAnalyticsVm } from "../hooks";
export function AnalyticsWebView() {
    const vm = useAnalyticsVm();
    const featureCopy = translateFeatureCopy("analytics");
    const resolvedColorScheme = useThemeState((state) => state.resolvedColorScheme);
    const theme = resolveTheme(resolvedColorScheme);
    const breakdowns = vm.breakdowns ?? [];
    const initialDimension = breakdowns[0]?.dimension ?? "time";
    const [selectedDimension, setSelectedDimension] = useState(initialDimension);
    const activeBreakdown = breakdowns.find((item) => item.dimension === selectedDimension) ?? breakdowns[0] ?? { dimension: "time", groups: [] };
    const layerBreakdown = breakdowns.find((item) => item.dimension === "layer") ?? activeBreakdown;
    const layerGroups = layerBreakdown.groups;
    const timeSeriesData = vm.timeSeriesData ?? [];
    const scatterPoints = timeSeriesData.map((point, index) => ({
        label: point.timestamp.slice(5, 10),
        x: index + 1,
        y: point.value,
    }));
    const heatmapColumns = timeSeriesData.slice(-3).map((point) => point.timestamp.slice(5, 10));
    const heatmapRows = ["Tasks", "Workflows", "Approvals"];
    const heatmapValues = heatmapRows.map((_, rowIndex) => heatmapColumns.map((_, columnIndex) => {
        const point = timeSeriesData[(timeSeriesData.length - heatmapColumns.length) + columnIndex];
        return Math.max(0, (point?.value ?? 0) - rowIndex);
    }));
    const numericMetricTotal = vm.metrics.reduce((sum, metric) => sum + Number(metric.value || 0), 0);
    return (_jsxs(FeatureScaffold, { title: featureCopy.title, summary: featureCopy.summary, status: "Planned", children: [_jsx(MetricGrid, { metrics: vm.metrics }), _jsxs("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 16 }, children: [_jsxs("label", { style: { display: "grid", gap: 4 }, children: [_jsx("span", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: "Start" }), _jsx("input", { type: "date", value: vm.dateRange.startDate, onChange: (event) => vm.setDateRange(event.currentTarget.value, vm.dateRange.endDate) })] }), _jsxs("label", { style: { display: "grid", gap: 4 }, children: [_jsx("span", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: "End" }), _jsx("input", { type: "date", value: vm.dateRange.endDate, onChange: (event) => vm.setDateRange(vm.dateRange.startDate, event.currentTarget.value) })] }), _jsx("button", { type: "button", onClick: () => vm.exportData("csv"), children: "Export CSV" }), _jsx("button", { type: "button", onClick: () => vm.exportData("json"), children: "Export JSON" })] }), _jsxs("div", { style: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 16 }, children: [_jsxs("article", { style: createPanelStyle(designTokens.color.border), children: [_jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: "Line" }), _jsx("div", { style: { marginTop: 12 }, children: _jsx(EChartSurface, { title: "Analytics Trend", values: vm.trendSummary, showTableFallback: true, theme: theme }) })] }), _jsxs("article", { style: createPanelStyle(designTokens.color.border), children: [_jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: "Sparkline" }), _jsx("div", { style: { marginTop: 12 }, children: _jsx(MiniTrendBars, { values: vm.trendSummary }) })] }), _jsxs("article", { style: createPanelStyle(designTokens.color.border), children: [_jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: "Bar" }), _jsx("div", { style: { marginTop: 12 }, children: _jsx(BarChart, { points: layerGroups.map((group) => ({ label: group.label, value: group.value })) }) })] }), _jsxs("article", { style: createPanelStyle(designTokens.color.border), children: [_jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: "Scatter" }), _jsx("div", { style: { marginTop: 12 }, children: _jsx(ScatterPlot, { points: scatterPoints }) })] }), _jsxs("article", { style: createPanelStyle(designTokens.color.border), children: [_jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: "Gauge" }), _jsx("div", { style: { marginTop: 12 }, children: _jsx(GaugeChart, { label: "Portfolio Coverage", value: numericMetricTotal, max: Math.max(numericMetricTotal, 1) }) })] }), _jsxs("article", { style: createPanelStyle(designTokens.color.border), children: [_jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: "Heatmap" }), _jsx("div", { style: { marginTop: 12 }, children: _jsx(HeatmapGrid, { rows: heatmapRows, columns: heatmapColumns, values: heatmapValues }) })] }), _jsxs("article", { style: createPanelStyle(designTokens.color.border), children: [_jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: "Pie" }), _jsx("div", { style: { marginTop: 12 }, children: _jsx(PieChart, { slices: layerGroups.map((group) => ({ label: group.label, value: group.value })) }) })] }), _jsxs("article", { style: createPanelStyle(designTokens.color.info), children: [_jsx("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }, children: breakdowns.map((breakdown) => (_jsx("button", { type: "button", onClick: () => setSelectedDimension(breakdown.dimension), children: breakdown.dimension }, breakdown.dimension))) }), _jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12, marginTop: 12 }, children: translateMessage("ui.analytics.breakdown") }), _jsx("div", { style: { marginTop: 12 }, children: activeBreakdown.dimension === "time"
                                    ? _jsx(TimelineChart, { points: activeBreakdown.groups.map((group) => ({ label: group.label, value: group.value })) })
                                    : _jsx(PieChart, { slices: activeBreakdown.groups.map((group) => ({ label: group.label, value: group.value })) }) })] })] })] }));
}
