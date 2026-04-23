import type { ReactElement } from "react";
import { FeatureScaffold, ListCard, MetricGrid } from "@aa/ui-core";
import { useStabilityVm } from "../hooks";

export function StabilityWebView(): ReactElement {
  const vm = useStabilityVm();
  return (
    <FeatureScaffold title="Stability Panel" summary="稳定性、恢复和 backlog 视图" status="Implemented/Internal">
      <MetricGrid metrics={vm.metrics} />
      <div style={{ marginTop: 16 }}>
        <ListCard items={vm.items} />
      </div>
    </FeatureScaffold>
  );
}
