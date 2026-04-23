import { FeatureScaffold, MetricGrid } from "@aa/ui-core";
import type { ReactElement } from "react";
import { useDashboardVm } from "../hooks";

export function DashboardWebView(): ReactElement {
  const vm = useDashboardVm();
  return (
    <FeatureScaffold title="Dashboard" summary="Mission Control 首页" status="Implemented/Internal">
      {vm.loading ? <p>Loading dashboard snapshot...</p> : <MetricGrid metrics={vm.metrics} />}
    </FeatureScaffold>
  );
}
