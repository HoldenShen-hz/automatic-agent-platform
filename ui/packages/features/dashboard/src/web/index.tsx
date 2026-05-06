import { useThemeState } from "@aa/shared-state";
import { EChartSurface, FeatureScaffold, MetricGrid, resolveTheme } from "@aa/ui-core";
import type { ReactElement } from "react";
import { useDashboardVm } from "../hooks";

export function DashboardWebView(): ReactElement {
  const vm = useDashboardVm();
  const { resolvedColorScheme } = useThemeState();
  const theme = resolveTheme(resolvedColorScheme);
  return (
    <FeatureScaffold title="Dashboard" summary="Mission Control 首页" status="Implemented/Internal">
      {vm.loading ? <p>Loading dashboard snapshot...</p> : (
        <>
          <MetricGrid metrics={vm.metrics} />
          <div style={{ marginTop: 16 }}>
            <EChartSurface
              title="Mission Trend"
              values={vm.metrics.map((metric) => Number(metric.value) || metric.label.length)}
              theme={theme}
            />
          </div>
        </>
      )}
    </FeatureScaffold>
  );
}
