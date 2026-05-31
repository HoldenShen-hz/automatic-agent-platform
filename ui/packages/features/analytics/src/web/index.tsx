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
  resolveTheme,
} from "@aa/ui-core";
import { useState, type ReactElement } from "react";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useThemeState } from "@aa/shared-state";
import { useAnalyticsVm } from "../hooks";

export function AnalyticsWebView(): ReactElement {
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
  const heatmapValues = heatmapRows.map((_, rowIndex) =>
    heatmapColumns.map((_, columnIndex) => {
      const point = timeSeriesData[(timeSeriesData.length - heatmapColumns.length) + columnIndex];
      return Math.max(0, (point?.value ?? 0) - rowIndex);
    }));
  const numericMetricTotal = vm.metrics.reduce((sum, metric) => sum + Number(metric.value || 0), 0);

  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Planned">
      <MetricGrid metrics={vm.metrics} />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 16 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ color: designTokens.color.subtle, fontSize: 12 }}>{translateMessage("ui.analytics.filter.start")}</span>
          <input
            type="date"
            value={vm.dateRange.startDate}
            onChange={(event) => vm.setDateRange(event.currentTarget.value, vm.dateRange.endDate)}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ color: designTokens.color.subtle, fontSize: 12 }}>{translateMessage("ui.analytics.filter.end")}</span>
          <input
            type="date"
            value={vm.dateRange.endDate}
            onChange={(event) => vm.setDateRange(vm.dateRange.startDate, event.currentTarget.value)}
          />
        </label>
        <button type="button" onClick={() => vm.exportData("csv")}>{translateMessage("ui.analytics.export.csv")}</button>
        <button type="button" onClick={() => vm.exportData("json")}>{translateMessage("ui.analytics.export.json")}</button>
      </div>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 16 }}>
        <article style={createPanelStyle(designTokens.color.border)}>
          <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{translateMessage("ui.analytics.chart.line")}</div>
          <div style={{ marginTop: 12 }}>
            <EChartSurface title={translateMessage("ui.analytics.trendTitle")} values={vm.trendSummary} showTableFallback theme={theme} />
          </div>
        </article>
        <article style={createPanelStyle(designTokens.color.border)}>
          <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{translateMessage("ui.analytics.chart.sparkline")}</div>
          <div style={{ marginTop: 12 }}>
            <MiniTrendBars values={vm.trendSummary} />
          </div>
        </article>
        <article style={createPanelStyle(designTokens.color.border)}>
          <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{translateMessage("ui.analytics.chart.bar")}</div>
          <div style={{ marginTop: 12 }}>
            <BarChart points={layerGroups.map((group) => ({ label: group.label, value: group.value }))} />
          </div>
        </article>
        <article style={createPanelStyle(designTokens.color.border)}>
          <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{translateMessage("ui.analytics.chart.scatter")}</div>
          <div style={{ marginTop: 12 }}>
            <ScatterPlot points={scatterPoints} />
          </div>
        </article>
        <article style={createPanelStyle(designTokens.color.border)}>
          <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{translateMessage("ui.analytics.chart.gauge")}</div>
          <div style={{ marginTop: 12 }}>
            <GaugeChart label={translateMessage("ui.analytics.chart.gaugeLabel")} value={numericMetricTotal} max={Math.max(numericMetricTotal, 1)} />
          </div>
        </article>
        <article style={createPanelStyle(designTokens.color.border)}>
          <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{translateMessage("ui.analytics.chart.heatmap")}</div>
          <div style={{ marginTop: 12 }}>
            <HeatmapGrid rows={heatmapRows} columns={heatmapColumns} values={heatmapValues} />
          </div>
        </article>
        <article style={createPanelStyle(designTokens.color.border)}>
          <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{translateMessage("ui.analytics.chart.pie")}</div>
          <div style={{ marginTop: 12 }}>
            <PieChart slices={layerGroups.map((group) => ({ label: group.label, value: group.value }))} />
          </div>
        </article>
        <article style={createPanelStyle(designTokens.color.info)}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {breakdowns.map((breakdown) => (
              <button key={breakdown.dimension} type="button" onClick={() => setSelectedDimension(breakdown.dimension)}>
                {translateMessage(`ui.analytics.dimension.${breakdown.dimension}`)}
              </button>
            ))}
          </div>
          <div style={{ color: designTokens.color.subtle, fontSize: 12, marginTop: 12 }}>
            {translateMessage("ui.analytics.breakdown")}
          </div>
          <div style={{ marginTop: 12 }}>
            {activeBreakdown.dimension === "time"
              ? <TimelineChart points={activeBreakdown.groups.map((group) => ({ label: group.label, value: group.value }))} />
              : <PieChart slices={activeBreakdown.groups.map((group) => ({ label: group.label, value: group.value }))} />}
          </div>
        </article>
      </div>
    </FeatureScaffold>
  );
}
