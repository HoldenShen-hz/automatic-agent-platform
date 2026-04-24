import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useStabilityVm } from "../hooks";

export function StabilityWebView(): ReactElement {
  const vm = useStabilityVm();
  return (
    <FeatureScaffold title="Stability Panel" summary="稳定性、恢复和 backlog 视图" status="Implemented/Internal">
      <FeatureWorkbenchPanel
        metrics={vm.metrics}
        items={vm.items}
        actions={[
          { id: "stability-runbook", label: "生成修复 Runbook", tone: "accent" },
          { id: "stability-escalate", label: "升级高优先级事件", tone: "danger" },
          { id: "stability-export", label: "导出恢复摘要", tone: "neutral" },
        ]}
      />
    </FeatureScaffold>
  );
}
