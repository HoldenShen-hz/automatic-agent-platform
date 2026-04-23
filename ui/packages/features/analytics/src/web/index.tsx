import { FeatureScaffold, MetricGrid, MiniTrendBars } from "@aa/ui-core";
import type { ReactElement } from "react";
import { useAnalyticsVm } from "../hooks";

export function AnalyticsWebView(): ReactElement {
  const vm = useAnalyticsVm();
  return (
    <FeatureScaffold title="Analytics" summary="多层级 KPI 看板与图表渲染架构" status="Planned">
      <MetricGrid metrics={vm.metrics} />
      <div style={{ marginTop: 16 }}>
        <MiniTrendBars values={vm.trendSummary} />
      </div>
    </FeatureScaffold>
  );
}
