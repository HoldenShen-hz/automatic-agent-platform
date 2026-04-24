import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import type { ReactElement } from "react";
import { useAgentManagerVm } from "../hooks";

export function AgentManagerWebView(): ReactElement {
  const vm = useAgentManagerVm();
  return (
    <FeatureScaffold title="Agent Manager" summary="Agent 实时监控中心与详情页" status="Planned">
      <FeatureWorkbenchPanel
        metrics={vm.metrics}
        items={vm.items}
        actions={[
          { id: "agent-isolate", label: "隔离异常 Agent", tone: "danger" },
          { id: "agent-trend", label: "查看负载趋势", tone: "neutral" },
          { id: "agent-summary", label: "复制治理摘要", tone: "neutral" },
        ]}
      />
    </FeatureScaffold>
  );
}
