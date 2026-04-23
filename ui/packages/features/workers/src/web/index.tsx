import type { ReactElement } from "react";
import { FeatureScaffold, MetricGrid } from "@aa/ui-core";
import { useWorkersVm } from "../hooks";

export function WorkersWebView(): ReactElement {
  const vm = useWorkersVm();
  return (
    <FeatureScaffold title="Workers" summary="执行 Worker 运行面板" status="Implemented/Internal">
      <MetricGrid metrics={vm.metrics} />
    </FeatureScaffold>
  );
}
