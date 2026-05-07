import { useThemeState } from "@aa/shared-state";
import { EChartSurface, FeatureScaffold, MetricGrid, MiniTrendBars, resolveTheme } from "@aa/ui-core";
import type { ReactElement } from "react";
import { useAnalyticsVm } from "../hooks";

export function AnalyticsWebView(): ReactElement {
  const vm = useAnalyticsVm();
  const { resolvedThemeName } = useThemeState();
  const theme = resolveTheme(resolvedThemeName);
  return (
    <FeatureScaffold title="Analytics" summary="多层级 KPI 看板与图表渲染架构" status="Planned">
      <MetricGrid metrics={vm.metrics} />
      <div style={{ marginTop: 16 }}>
        <MiniTrendBars values={vm.trendSummary} />
      </div>
      <div style={{ marginTop: 16 }}>
        {/* §2267: Use timeSeriesData for proper time-based chart instead of integer mapping */}
        <EChartSurface title="Analytics Trend" values={vm.timeSeriesData.map((p) => p.value)} theme={theme} />
      </div>
      {/* §2267: Date range filter and export controls */}
      <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          <span style={{ color: "var(--text-subtle)" }}>Start Date</span>
          <input
            type="date"
            value={vm.dateRange.startDate}
            onChange={(e) => vm.setDateRange(e.target.value, vm.dateRange.endDate)}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
          <span style={{ color: "var(--text-subtle)" }}>End Date</span>
          <input
            type="date"
            value={vm.dateRange.endDate}
            onChange={(e) => vm.setDateRange(vm.dateRange.startDate, e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
          />
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
          <button
            onClick={() => vm.exportData("csv")}
            style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer" }}
          >
            Export CSV
          </button>
          <button
            onClick={() => vm.exportData("json")}
            style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer" }}
          >
            Export JSON
          </button>
        </div>
      </div>
    </FeatureScaffold>
  );
}
