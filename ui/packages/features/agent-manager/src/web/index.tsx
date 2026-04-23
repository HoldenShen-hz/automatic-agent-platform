import { FeatureScaffold, ListCard, MetricGrid } from "@aa/ui-core";
import type { ReactElement } from "react";
import { useAgentManagerVm } from "../hooks";

export function AgentManagerWebView(): ReactElement {
  const vm = useAgentManagerVm();
  return (
    <FeatureScaffold title="Agent Manager" summary="Agent 实时监控中心与详情页" status="Planned">
      <MetricGrid metrics={vm.metrics} />
      <div style={{ marginTop: 16 }}>
        <ListCard items={vm.items} />
      </div>
    </FeatureScaffold>
  );
}
