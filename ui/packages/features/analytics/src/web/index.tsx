import { EChartSurface, FeatureScaffold, MetricGrid, MiniTrendBars, createPanelStyle, designTokens } from "@aa/ui-core";
import type { ReactElement } from "react";
import { translateFeatureCopy, translateMessage } from "@aa/shared-i18n";
import { useAnalyticsVm } from "../hooks";

export function AnalyticsWebView(): ReactElement {
  const vm = useAnalyticsVm();
  const featureCopy = translateFeatureCopy("analytics");
  return (
    <FeatureScaffold title={featureCopy.title} summary={featureCopy.summary} status="Planned">
      <MetricGrid metrics={vm.metrics} />
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 16 }}>
        {vm.layerSummaries.map((summary) => (
          <article key={summary.layer} style={createPanelStyle(designTokens.color.border)}>
            <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{translateMessage("ui.analytics.layerSummary")}</div>
            <div style={{ color: designTokens.color.text, fontWeight: 700, marginTop: 8 }}>{summary.label}</div>
            <div style={{ color: designTokens.color.text, fontSize: 20, marginTop: 8 }}>{summary.metricCount} metrics</div>
            <p style={{ color: designTokens.color.subtle, marginBottom: 0 }}>
              {translateMessage("ui.analytics.selectedLayer")}: {summary.label} · Δ {summary.netChangePercent.toFixed(1)}%
            </p>
          </article>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <MiniTrendBars values={vm.trendSummary} />
      </div>
      <div style={{ marginTop: 16 }}>
        <EChartSurface title={translateMessage("ui.analytics.trendTitle")} values={vm.trendSummary} />
      </div>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 16 }}>
        {vm.kpiBreakdowns.map((item) => (
          <article key={`${item.layer}-${item.label}`} style={createPanelStyle(designTokens.color.info)}>
            <div style={{ color: designTokens.color.subtle, fontSize: 12 }}>{translateMessage("ui.analytics.breakdown")}</div>
            <div style={{ color: designTokens.color.text, fontWeight: 700, marginTop: 8 }}>{item.label}</div>
            <div style={{ color: designTokens.color.text, fontSize: 20, marginTop: 8 }}>{item.value}</div>
            <p style={{ color: designTokens.color.subtle, marginBottom: 0 }}>Δ {item.changePercent.toFixed(1)}%</p>
          </article>
        ))}
      </div>
    </FeatureScaffold>
  );
}
