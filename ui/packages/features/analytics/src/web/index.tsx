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

function toNumericMetricValue(value: string | number): number {
  if (typeof value === "number") {
    return value;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isPercentMetric(metric: { id: string; label: string; description?: string }): boolean {
  const id = metric.id.toLowerCase();
  const label = metric.label.toLowerCase();
  const description = metric.description?.toLowerCase() ?? "";
  return id === "uptime"
    || id === "error-rate"
    || label.includes("uptime")
    || label.includes("error rate")
    || description.includes("percentage");
}

function findGaugeMetric(metrics: readonly { id: string; label: string; value: string | number; description?: string }[]): { label: string; value: number } | null {
  const preferredMetric = metrics.find((metric) => metric.id === "uptime" && isPercentMetric(metric))
    ?? metrics.find((metric) => isPercentMetric(metric))
    ?? null;
  if (preferredMetric == null) {
    return null;
  }
  return {
    label: preferredMetric.label,
    value: toNumericMetricValue(preferredMetric.value),
  };
}

function SnapshotOnlyNotice(): ReactElement {
  return (
    <p style={{ margin: 0 }}>
      {translateMessage("ui.analytics.snapshotOnly.description")}
    </p>
  );
}

function EmptyLayerNotice(): ReactElement {
  return (
    <p style={{ margin: 0 }}>
      No live metrics are available for the selected layer.
    </p>
  );
}

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
  const filteredMetrics = vm.getFilteredMetrics();
  const hasFilteredMetrics = filteredMetrics.length > 0;
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
  const gaugeMetric = findGaugeMetric(filteredMetrics);
  const snapshotMetricPoints = filteredMetrics.map((metric) => ({
    label: metric.label,
    value: toNumericMetricValue(metric.value),
  }));

  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Implemented/Partial">
      <MetricGrid metrics={vm.metrics} />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 16 }}>
        {vm.historicalSeriesAvailable ? (
          <>
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
          </>
        ) : (
          <span style={{ color: designTokens.color.subtle, fontSize: 12 }}>
            {translateMessage("ui.analytics.snapshotOnly.filters")}
          </span>
        )}
        <button type="button" onClick={() => vm.exportData("csv")}>{translateMessage("ui.analytics.export.csv")}</button>
        <button type="button" onClick={() => vm.exportData("json")}>{translateMessage("ui.analytics.export.json")}</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
        <span style={{ color: designTokens.color.subtle, fontSize: 12 }}>{translateMessage("ui.analytics.selectedLayer")}</span>
        {vm.availableLayers.map((layer) => (
          <button key={layer} type="button" onClick={() => vm.setLayer(layer)}>
            {translateMessage(`ui.analytics.dimension.${layer}`)}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 16 }}>
        <article style={createPanelStyle(designTokens.color.border)}>
          <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{translateMessage("ui.analytics.chart.line")}</div>
          <div style={{ marginTop: 12 }}>
            {vm.historicalSeriesAvailable
              ? <EChartSurface title={translateMessage("ui.analytics.trendTitle")} values={vm.trendSummary} showTableFallback theme={theme} />
              : <SnapshotOnlyNotice />}
          </div>
        </article>
        <article style={createPanelStyle(designTokens.color.border)}>
          <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{translateMessage("ui.analytics.chart.sparkline")}</div>
          <div style={{ marginTop: 12 }}>
            {vm.historicalSeriesAvailable
              ? <MiniTrendBars values={vm.trendSummary} />
              : <SnapshotOnlyNotice />}
          </div>
        </article>
        <article style={createPanelStyle(designTokens.color.border)}>
          <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{translateMessage("ui.analytics.chart.bar")}</div>
          <div style={{ marginTop: 12 }}>
            {hasFilteredMetrics
              ? <BarChart points={snapshotMetricPoints} />
              : <EmptyLayerNotice />}
          </div>
        </article>
        <article style={createPanelStyle(designTokens.color.border)}>
          <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{translateMessage("ui.analytics.chart.scatter")}</div>
          <div style={{ marginTop: 12 }}>
            {vm.historicalSeriesAvailable
              ? <ScatterPlot points={scatterPoints} />
              : <SnapshotOnlyNotice />}
          </div>
        </article>
        <article style={createPanelStyle(designTokens.color.border)}>
          <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{translateMessage("ui.analytics.chart.gauge")}</div>
          <div style={{ marginTop: 12 }}>
            {gaugeMetric == null
              ? (hasFilteredMetrics ? <SnapshotOnlyNotice /> : <EmptyLayerNotice />)
              : <GaugeChart label={gaugeMetric.label} value={gaugeMetric.value} max={100} />}
          </div>
        </article>
        <article style={createPanelStyle(designTokens.color.border)}>
          <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{translateMessage("ui.analytics.chart.heatmap")}</div>
          <div style={{ marginTop: 12 }}>
            {vm.historicalSeriesAvailable
              ? <HeatmapGrid rows={heatmapRows} columns={heatmapColumns} values={heatmapValues} />
              : <SnapshotOnlyNotice />}
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
              ? (vm.historicalSeriesAvailable
                ? <TimelineChart points={activeBreakdown.groups.map((group) => ({ label: group.label, value: group.value }))} />
                : <SnapshotOnlyNotice />)
              : <PieChart slices={activeBreakdown.groups.map((group) => ({ label: group.label, value: group.value }))} />}
          </div>
        </article>
        <article style={createPanelStyle(designTokens.color.info)}>
          <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{translateMessage("ui.analytics.contractBoundary.title")}</div>
          <p style={{ margin: "12px 0 0" }}>{translateMessage("ui.analytics.contractBoundary.description")}</p>
        </article>
      </div>
    </FeatureScaffold>
  );
}
