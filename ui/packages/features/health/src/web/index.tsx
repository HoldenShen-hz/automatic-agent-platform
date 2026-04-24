import type { ReactElement } from "react";
import { FeatureScaffold, FeatureWorkbenchPanel } from "@aa/ui-core";
import { useHealthVm } from "../hooks";

export function HealthWebView(): ReactElement {
  const vm = useHealthVm();
  return (
    <FeatureScaffold title="Health" summary="健康状态与基础指标" status="Implemented/Contracted">
      <FeatureWorkbenchPanel
        rows={vm.rows}
        actions={[
          { id: "health-refresh", label: "刷新健康检查", tone: "accent" },
          { id: "health-diagnose", label: "生成诊断摘要", tone: "neutral" },
          { id: "health-runbook", label: "打开恢复指引", tone: "neutral" },
        ]}
      />
    </FeatureScaffold>
  );
}
