import { jsx, jsxs } from "react/jsx-runtime";
import {
  BarChart,
  EChartSurface,
  FeatureScaffold,
  GaugeChart,
  HeatmapGrid,
  MetricGrid,
  MiniTrendBars,
  PieChart,
  ScatterPlot,
  TimelineChart,
  createPanelStyle,
  designTokens,
  resolveTheme
} from "@aa/ui-core";
import { useState } from "react";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useThemeState } from "@aa/shared-state";
import { useAnalyticsVm } from "../hooks";
function AnalyticsWebView() {
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
    y: point.value
  }));
  const heatmapColumns = timeSeriesData.slice(-3).map((point) => point.timestamp.slice(5, 10));
  const heatmapRows = ["Tasks", "Workflows", "Approvals"];
  const heatmapValues = heatmapRows.map((_, rowIndex) => heatmapColumns.map((_2, columnIndex) => {
    const point = timeSeriesData[timeSeriesData.length - heatmapColumns.length + columnIndex];
    return Math.max(0, (point?.value ?? 0) - rowIndex);
  }));
  const numericMetricTotal = vm.metrics.reduce((sum, metric) => sum + Number(metric.value || 0), 0);
  return /* @__PURE__ */ jsxs(FeatureScaffold, { title: featureCopy.title, summary: featureCopy.summary, status: "Implemented/Partial", children: [
    /* @__PURE__ */ jsx(MetricGrid, { metrics: vm.metrics }),
    /* @__PURE__ */ jsxs("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 16 }, children: [
      /* @__PURE__ */ jsxs("label", { style: { display: "grid", gap: 4 }, children: [
        /* @__PURE__ */ jsx("span", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: translateMessage("ui.analytics.filter.start") }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "date",
            value: vm.dateRange.startDate,
            onChange: (event) => vm.setDateRange(event.currentTarget.value, vm.dateRange.endDate)
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("label", { style: { display: "grid", gap: 4 }, children: [
        /* @__PURE__ */ jsx("span", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: translateMessage("ui.analytics.filter.end") }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "date",
            value: vm.dateRange.endDate,
            onChange: (event) => vm.setDateRange(vm.dateRange.startDate, event.currentTarget.value)
          }
        )
      ] }),
      /* @__PURE__ */ jsx("button", { type: "button", onClick: () => vm.exportData("csv"), children: translateMessage("ui.analytics.export.csv") }),
      /* @__PURE__ */ jsx("button", { type: "button", onClick: () => vm.exportData("json"), children: translateMessage("ui.analytics.export.json") })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 16 }, children: [
      /* @__PURE__ */ jsxs("article", { style: createPanelStyle(designTokens.color.border), children: [
        /* @__PURE__ */ jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: translateMessage("ui.analytics.chart.line") }),
        /* @__PURE__ */ jsx("div", { style: { marginTop: 12 }, children: /* @__PURE__ */ jsx(EChartSurface, { title: translateMessage("ui.analytics.trendTitle"), values: vm.trendSummary, showTableFallback: true, theme }) })
      ] }),
      /* @__PURE__ */ jsxs("article", { style: createPanelStyle(designTokens.color.border), children: [
        /* @__PURE__ */ jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: translateMessage("ui.analytics.chart.sparkline") }),
        /* @__PURE__ */ jsx("div", { style: { marginTop: 12 }, children: /* @__PURE__ */ jsx(MiniTrendBars, { values: vm.trendSummary }) })
      ] }),
      /* @__PURE__ */ jsxs("article", { style: createPanelStyle(designTokens.color.border), children: [
        /* @__PURE__ */ jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: translateMessage("ui.analytics.chart.bar") }),
        /* @__PURE__ */ jsx("div", { style: { marginTop: 12 }, children: /* @__PURE__ */ jsx(BarChart, { points: layerGroups.map((group) => ({ label: group.label, value: group.value })) }) })
      ] }),
      /* @__PURE__ */ jsxs("article", { style: createPanelStyle(designTokens.color.border), children: [
        /* @__PURE__ */ jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: translateMessage("ui.analytics.chart.scatter") }),
        /* @__PURE__ */ jsx("div", { style: { marginTop: 12 }, children: /* @__PURE__ */ jsx(ScatterPlot, { points: scatterPoints }) })
      ] }),
      /* @__PURE__ */ jsxs("article", { style: createPanelStyle(designTokens.color.border), children: [
        /* @__PURE__ */ jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: translateMessage("ui.analytics.chart.gauge") }),
        /* @__PURE__ */ jsx("div", { style: { marginTop: 12 }, children: /* @__PURE__ */ jsx(GaugeChart, { label: translateMessage("ui.analytics.chart.gaugeLabel"), value: numericMetricTotal, max: Math.max(numericMetricTotal, 1) }) })
      ] }),
      /* @__PURE__ */ jsxs("article", { style: createPanelStyle(designTokens.color.border), children: [
        /* @__PURE__ */ jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: translateMessage("ui.analytics.chart.heatmap") }),
        /* @__PURE__ */ jsx("div", { style: { marginTop: 12 }, children: /* @__PURE__ */ jsx(HeatmapGrid, { rows: heatmapRows, columns: heatmapColumns, values: heatmapValues }) })
      ] }),
      /* @__PURE__ */ jsxs("article", { style: createPanelStyle(designTokens.color.border), children: [
        /* @__PURE__ */ jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: translateMessage("ui.analytics.chart.pie") }),
        /* @__PURE__ */ jsx("div", { style: { marginTop: 12 }, children: /* @__PURE__ */ jsx(PieChart, { slices: layerGroups.map((group) => ({ label: group.label, value: group.value })) }) })
      ] }),
      /* @__PURE__ */ jsxs("article", { style: createPanelStyle(designTokens.color.info), children: [
        /* @__PURE__ */ jsx("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }, children: breakdowns.map((breakdown) => /* @__PURE__ */ jsx("button", { type: "button", onClick: () => setSelectedDimension(breakdown.dimension), children: translateMessage(`ui.analytics.dimension.${breakdown.dimension}`) }, breakdown.dimension)) }),
        /* @__PURE__ */ jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12, marginTop: 12 }, children: translateMessage("ui.analytics.breakdown") }),
        /* @__PURE__ */ jsx("div", { style: { marginTop: 12 }, children: activeBreakdown.dimension === "time" ? /* @__PURE__ */ jsx(TimelineChart, { points: activeBreakdown.groups.map((group) => ({ label: group.label, value: group.value })) }) : /* @__PURE__ */ jsx(PieChart, { slices: activeBreakdown.groups.map((group) => ({ label: group.label, value: group.value })) }) })
      ] }),
      /* @__PURE__ */ jsxs("article", { style: createPanelStyle(designTokens.color.info), children: [
        /* @__PURE__ */ jsx("div", { style: { color: designTokens.color.subtle, fontSize: 12 }, children: translateMessage("ui.analytics.contractBoundary.title") }),
        /* @__PURE__ */ jsx("p", { style: { margin: "12px 0 0" }, children: translateMessage("ui.analytics.contractBoundary.description") })
      ] })
    ] })
  ] });
}
export {
  AnalyticsWebView
};
